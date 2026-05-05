import { Router } from 'express';
import { query, queryOne, run } from '../db/database.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = Router();

// ── GET ALL BENEFICIARIES ──────────────────────────────────────────────────
router.get('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const { program_id, search } = req.query;
    let sql = `
      SELECT b.*, p.title AS program_title, p.category
      FROM beneficiaries b
      LEFT JOIN programs p ON b.program_id = p.id
      WHERE 1=1
    `;
    const params = [];
    if (program_id) { sql += ' AND b.program_id = ?'; params.push(program_id); }
    if (search) {
      sql += ' AND (b.full_name LIKE ? OR b.address LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    sql += ' ORDER BY b.received_at DESC';
    res.json(await query(sql, params));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── SEARCH PERSON BENEFIT HISTORY ─────────────────────────────────────────
router.get('/search', authenticate, requireAdmin, async (req, res) => {
  try {
    // Support both ?q= and legacy ?name=
    const term = req.query.q || req.query.name;
    if (!term) return res.status(400).json({ error: 'Search query is required' });

    // Group by person (full_name + address), collect all their records
    const rows = await query(`
      SELECT
        b.full_name, b.address, b.contact,
        p.title AS program_title, p.category,
        a.status AS application_status,
        a.created_at
      FROM beneficiaries b
      LEFT JOIN programs p ON b.program_id = p.id
      LEFT JOIN applications a ON b.application_id = a.id
      WHERE b.full_name LIKE ?
      ORDER BY b.full_name, a.created_at DESC
    `, [`%${term}%`]);

    // Group rows by person
    const map = new Map();
    for (const row of rows) {
      const key = `${row.full_name}||${row.address}`;
      if (!map.has(key)) {
        map.set(key, { full_name: row.full_name, address: row.address, contact: row.contact, records: [] });
      }
      map.get(key).records.push({
        program_title:      row.program_title,
        category:           row.category,
        status:             row.application_status || 'approved',
        created_at:         row.created_at,
      });
    }

    res.json(Array.from(map.values()));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── BENEFICIARY PROFILE ────────────────────────────────────────────────────
router.get('/:id/profile', authenticate, requireAdmin, async (req, res) => {
  try {
    const b = await queryOne(`
      SELECT b.*, a.age, a.barangay, a.notes
      FROM beneficiaries b
      LEFT JOIN applications a ON b.application_id = a.id
      WHERE b.id = ?
    `, [req.params.id]);
    if (!b) return res.status(404).json({ error: 'Beneficiary not found' });

    const records = await query(`
      SELECT p.title AS program_title, p.category, a.status, a.created_at, b2.received_at
      FROM beneficiaries b2
      LEFT JOIN programs p ON b2.program_id = p.id
      LEFT JOIN applications a ON b2.application_id = a.id
      WHERE b2.full_name = ? AND b2.address = ?
      ORDER BY a.created_at DESC
    `, [b.full_name, b.address]);

    res.json({ ...b, records });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── REPORTS SUMMARY ───────────────────────────────────────────────────────
router.get('/reports/summary', authenticate, requireAdmin, async (req, res) => {
  try {
    const { date_from, date_to } = req.query;

    const bWhere = [];
    const bParams = [];
    if (date_from) { bWhere.push('b2.received_at >= ?'); bParams.push(date_from); }
    if (date_to)   { bWhere.push('b2.received_at <= ?'); bParams.push(date_to + ' 23:59:59'); }
    const subFilter = bWhere.length ? 'WHERE ' + bWhere.join(' AND ') : '';

    const flatWhere = [];
    const flatParams = [];
    if (date_from) { flatWhere.push('b.received_at >= ?'); flatParams.push(date_from); }
    if (date_to)   { flatWhere.push('b.received_at <= ?'); flatParams.push(date_to + ' 23:59:59'); }
    const flatFilter = flatWhere.length ? 'WHERE ' + flatWhere.join(' AND ') : '';

    // ── Summary counts ──
    const [totalPrograms, activePrograms, pendingApps, approvedBeneficiaries, rejectedApps] = await Promise.all([
      queryOne('SELECT COUNT(*) AS count FROM programs'),
      queryOne("SELECT COUNT(*) AS count FROM programs WHERE status = 'open'"),
      queryOne("SELECT COUNT(*) AS count FROM applications WHERE status = 'pending'"),
      queryOne('SELECT COUNT(*) AS count FROM beneficiaries'),
      queryOne("SELECT COUNT(*) AS count FROM applications WHERE status = 'rejected'"),
    ]);

    // ── Per-program stats — use actual beneficiary COUNT, not slots_used ──
    // Also sync slots_used in the programs table while we're here
    const perProgram = await query(`
      SELECT
        p.id,
        p.title,
        p.category,
        p.slots,
        p.status,
        COUNT(b.id)                                        AS beneficiary_count,
        COUNT(b.id)                                        AS slots_used,
        (SELECT COUNT(*) FROM applications a2
          WHERE a2.program_id = p.id AND a2.status = 'pending')   AS pending_count,
        (SELECT COUNT(*) FROM applications a3
          WHERE a3.program_id = p.id AND a3.status = 'approved')  AS approved_count
      FROM programs p
      LEFT JOIN (
        SELECT b2.id, b2.program_id FROM beneficiaries b2 ${subFilter}
      ) b ON p.id = b.program_id
      GROUP BY p.id
      ORDER BY beneficiary_count DESC
    `, bParams);

    // Sync slots_used in DB to match actual beneficiary count (fire and forget)
    for (const prog of perProgram) {
      run('UPDATE programs SET slots_used = ? WHERE id = ?', [prog.beneficiary_count, prog.id])
        .catch(() => {});
    }

    const mostAssisted = await query(`
      SELECT b.full_name, b.address, COUNT(*) AS program_count
      FROM beneficiaries b
      ${flatFilter}
      GROUP BY b.full_name, b.address
      ORDER BY program_count DESC
      LIMIT 20
    `, flatParams);

    const repeatBeneficiaries = await query(`
      SELECT b.full_name, b.address, COUNT(*) AS times_assisted
      FROM beneficiaries b
      ${flatFilter}
      GROUP BY b.full_name, b.address
      HAVING COUNT(*) > 1
      ORDER BY times_assisted DESC
    `, flatParams);

    const categoryDistribution = await query(`
      SELECT p.category, COUNT(b.id) AS count
      FROM programs p
      LEFT JOIN (
        SELECT b2.id, b2.program_id FROM beneficiaries b2 ${subFilter}
      ) b ON p.id = b.program_id
      GROUP BY p.category
      ORDER BY count DESC
    `, bParams);

    res.json({
      summary: {
        totalPrograms:        totalPrograms.count,
        activePrograms:       activePrograms.count,
        pendingApps:          pendingApps.count,
        approvedBeneficiaries: approvedBeneficiaries.count,
        rejectedApps:         rejectedApps.count,
      },
      perProgram,
      mostAssisted,
      repeatBeneficiaries,
      categoryDistribution,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── MONTHLY / YEARLY SUMMARY ───────────────────────────────────────────────
router.get('/reports/monthly', authenticate, requireAdmin, async (req, res) => {
  try {
    const { year, date_from, date_to } = req.query;
    const targetYear = year || new Date().getFullYear();

    const bWhere = ['YEAR(b.received_at) = ?'];
    const bParams = [targetYear];
    if (date_from) { bWhere.push('b.received_at >= ?'); bParams.push(date_from); }
    if (date_to)   { bWhere.push('b.received_at <= ?'); bParams.push(date_to + ' 23:59:59'); }

    const monthly = await query(`
      SELECT
        MONTH(b.received_at) AS month,
        MONTHNAME(b.received_at) AS month_name,
        COUNT(*) AS beneficiary_count,
        COUNT(DISTINCT b.program_id) AS programs_active
      FROM beneficiaries b
      WHERE ${bWhere.join(' AND ')}
      GROUP BY MONTH(b.received_at), MONTHNAME(b.received_at)
      ORDER BY MONTH(b.received_at)
    `, bParams);

    const yearly = await query(`
      SELECT
        YEAR(b.received_at) AS year,
        COUNT(*) AS beneficiary_count,
        COUNT(DISTINCT b.program_id) AS programs_count
      FROM beneficiaries b
      GROUP BY YEAR(b.received_at)
      ORDER BY year DESC
    `);

    res.json({ monthly, yearly, year: targetYear });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── MANUAL ENCODE ─────────────────────────────────────────────────────────
router.post('/manual', authenticate, requireAdmin, async (req, res) => {
  try {
    const { program_id, full_name, address, age, contact, barangay, notes } = req.body;
    if (!program_id || !full_name || !address || !contact)
      return res.status(400).json({ error: 'Program, full name, address, and contact are required' });

    const program = await queryOne('SELECT * FROM programs WHERE id = ?', [program_id]);
    if (!program) return res.status(404).json({ error: 'Program not found' });

    const duplicate = await queryOne(
      'SELECT id FROM beneficiaries WHERE program_id = ? AND full_name = ? AND address = ?',
      [program_id, full_name, address]
    );
    if (duplicate)
      return res.status(400).json({ error: `${full_name} is already recorded as a beneficiary for this program.` });

    const history = await query(`
      SELECT b.full_name, p.title AS program_title
      FROM beneficiaries b
      LEFT JOIN programs p ON b.program_id = p.id
      WHERE b.full_name LIKE ? AND b.address LIKE ?
    `, [`%${full_name}%`, `%${address}%`]);

    const appResult = await run(`
      INSERT INTO applications (program_id, full_name, address, age, contact, barangay, status, reviewed_by, reviewed_at)
      VALUES (?, ?, ?, ?, ?, ?, 'approved', ?, NOW())
    `, [program_id, full_name, address, age || 0, contact, barangay || null, req.user.id]);

    await run(
      'INSERT INTO beneficiaries (application_id, program_id, full_name, address, contact, notes) VALUES (?,?,?,?,?,?)',
      [appResult.insertId, program_id, full_name, address, contact, notes || null]
    );
    await run('UPDATE programs SET slots_used = slots_used + 1 WHERE id = ?', [program_id]);

    res.json({
      message: `${full_name} has been successfully added as a beneficiary.`,
      warning: history.length > 0
        ? `⚠️ Note: ${full_name} has previously received benefits from: ${history.map(h => h.program_title).join(', ')}`
        : null,
      history,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── BULK / EXCEL IMPORT ───────────────────────────────────────────────────
router.post('/bulk-import', authenticate, requireAdmin, async (req, res) => {
  try {
    const { program_id, beneficiaries: list } = req.body;
    if (!program_id || !list || !Array.isArray(list) || list.length === 0)
      return res.status(400).json({ error: 'Program and a list of beneficiaries are required' });

    const program = await queryOne('SELECT * FROM programs WHERE id = ?', [program_id]);
    if (!program) return res.status(404).json({ error: 'Program not found' });

    let success = 0, skipped = 0;
    const skippedNames = [], warnings = [];

    for (const person of list) {
      const { full_name, address, age, contact, barangay } = person;
      if (!full_name || !address || !contact) { skipped++; continue; }

      const duplicate = await queryOne(
        'SELECT id FROM beneficiaries WHERE program_id = ? AND full_name = ?',
        [program_id, full_name]
      );
      if (duplicate) { skipped++; skippedNames.push(full_name); continue; }

      const history = await query(`
        SELECT p.title AS program_title
        FROM beneficiaries b
        LEFT JOIN programs p ON b.program_id = p.id
        WHERE b.full_name LIKE ?
      `, [`%${full_name}%`]);

      if (history.length > 0)
        warnings.push(`${full_name} — has history in: ${history.map(h => h.program_title).join(', ')}`);

      const appResult = await run(`
        INSERT INTO applications (program_id, full_name, address, age, contact, barangay, status, reviewed_by, reviewed_at)
        VALUES (?, ?, ?, ?, ?, ?, 'approved', ?, NOW())
      `, [program_id, full_name, address, age || 0, contact, barangay || null, req.user.id]);

      await run(
        'INSERT INTO beneficiaries (application_id, program_id, full_name, address, contact) VALUES (?,?,?,?,?)',
        [appResult.insertId, program_id, full_name, address, contact]
      );
      await run('UPDATE programs SET slots_used = slots_used + 1 WHERE id = ?', [program_id]);
      success++;
    }

    res.json({
      message: `Successfully imported ${success} beneficiar${success === 1 ? 'y' : 'ies'}.`,
      success, skipped, skippedNames, warnings,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── DELETE BENEFICIARY ────────────────────────────────────────────────────
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    await run('DELETE FROM beneficiaries WHERE id = ?', [req.params.id]);
    res.json({ message: 'Beneficiary deleted successfully' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;