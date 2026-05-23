import { Router } from 'express';
import { query, queryOne, run } from '../db/database.js';
import { authenticate, requireAdmin, requireStaff } from '../middleware/auth.js';

const router = Router();

// ── GET ALL BENEFICIARIES (staff + admin) ──────────────────────────────────
router.get('/', authenticate, requireStaff, async (req, res) => {
  try {
    const { program_id, search } = req.query;

    let sql = `
      SELECT b.*, p.title AS program_title, p.category,
            COALESCE(b.barangay, a.barangay) AS barangay,
            COALESCE(b.age, a.age) AS age,
            u.avatar_url
      FROM beneficiaries b
      LEFT JOIN programs p ON b.program_id = p.id
      LEFT JOIN applications a ON b.application_id = a.id
      LEFT JOIN users u ON a.applicant_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (program_id) {
      sql += ' AND b.program_id = ?';
      params.push(program_id);
    }
    if (search) {
      sql += ' AND (b.full_name LIKE ? OR b.address LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    sql += ' ORDER BY b.received_at DESC';

    res.json(await query(sql, params));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── SEARCH PERSON BENEFIT HISTORY (staff + admin) ─────────────────────────
router.get('/search', authenticate, requireStaff, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.status(400).json({ error: 'Search query is required' });

    const rows = await query(`
      SELECT
        b.full_name, b.address, b.contact,
        p.title AS program_title, p.category,
        CASE
        WHEN b.application_id IS NOT NULL AND a.status = 'approved' THEN 'received'
        WHEN b.application_id IS NULL THEN 'received'
        ELSE COALESCE(a.status, 'received')
        END AS status,
        b.received_at AS created_at
      FROM beneficiaries b
      LEFT JOIN programs p ON b.program_id = p.id
      LEFT JOIN applications a ON b.application_id = a.id
      WHERE b.full_name LIKE ?
      ORDER BY b.full_name, b.received_at DESC
    `, [`%${q}%`]);

    const map = new Map();
    for (const row of rows) {
      const key = `${row.full_name}||${row.address}`;
      if (!map.has(key)) {
        map.set(key, {
          full_name: row.full_name,
          address:   row.address,
          contact:   row.contact,
          records:   [],
        });
      }
      map.get(key).records.push({
        program_title: row.program_title,
        category:      row.category,
        status:        row.status,
        created_at:    row.created_at,
      });
    }

    res.json(Array.from(map.values()));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── REPORTS SUMMARY (staff + admin) ───────────────────────────────────────
router.get('/reports/summary', authenticate, requireStaff, async (req, res) => {
  try {
    const [
      totalPrograms,
      activePrograms,
      pendingApps,
      approvedBeneficiaries,
      rejectedApps,
    ] = await Promise.all([
      queryOne('SELECT COUNT(*) AS count FROM programs'),
      queryOne("SELECT COUNT(*) AS count FROM programs WHERE status = 'open'"),
      queryOne("SELECT COUNT(*) AS count FROM applications WHERE status = 'pending'"),
      queryOne('SELECT COUNT(*) AS count FROM beneficiaries'),
      queryOne("SELECT COUNT(*) AS count FROM applications WHERE status = 'rejected'"),
    ]);

    const perProgram = await query(`
      SELECT p.title, p.category, p.slots, p.slots_used,
        COUNT(b.id) AS beneficiary_count
      FROM programs p
      LEFT JOIN beneficiaries b ON p.id = b.program_id
      GROUP BY p.id
      ORDER BY beneficiary_count DESC
    `);

    const mostAssisted = await query(`
      SELECT
        b.full_name,
        b.address,
        COUNT(*) AS program_count,
        MAX(b.id) AS id,
        MAX(u.avatar_url) AS avatar_url
      FROM beneficiaries b
      LEFT JOIN applications a ON b.application_id = a.id
      LEFT JOIN users u ON a.applicant_id = u.id
      GROUP BY b.full_name, b.address
      ORDER BY program_count DESC
      LIMIT 20
    `);

    const repeatBeneficiaries = await query(`
      SELECT full_name, address, COUNT(*) AS times_assisted
      FROM beneficiaries
      GROUP BY full_name, address
      HAVING COUNT(*) > 1
      ORDER BY times_assisted DESC
    `);

    res.json({
      summary: {
        totalPrograms:         totalPrograms.count,
        activePrograms:        activePrograms.count,
        pendingApps:           pendingApps.count,
        approvedBeneficiaries: approvedBeneficiaries.count,
        rejectedApps:          rejectedApps.count,
      },
      perProgram,
      mostAssisted,
      repeatBeneficiaries,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── MONTHLY / YEARLY SUMMARY (staff + admin) ──────────────────────────────
router.get('/reports/monthly', authenticate, requireStaff, async (req, res) => {
  try {
    const { year } = req.query;
    const targetYear = year || new Date().getFullYear();

    const monthly = await query(`
      SELECT
        MONTH(b.received_at)         AS month,
        MONTHNAME(b.received_at)     AS month_name,
        COUNT(*)                     AS beneficiary_count,
        COUNT(DISTINCT b.program_id) AS programs_active
      FROM beneficiaries b
      WHERE YEAR(b.received_at) = ?
      GROUP BY MONTH(b.received_at), MONTHNAME(b.received_at)
      ORDER BY MONTH(b.received_at)
    `, [targetYear]);

    const yearly = await query(`
      SELECT
        YEAR(b.received_at)          AS year,
        COUNT(*)                     AS beneficiary_count,
        COUNT(DISTINCT b.program_id) AS programs_count
      FROM beneficiaries b
      GROUP BY YEAR(b.received_at)
      ORDER BY year DESC
    `);

    res.json({ monthly, yearly, year: targetYear });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET BENEFICIARY PROFILE WITH HISTORY (staff + admin) ──────────────────
router.get('/:id/profile', authenticate, requireStaff, async (req, res) => {
  try {
    const beneficiary = await queryOne(`
      SELECT b.*, p.title AS program_title, p.category,
             COALESCE(b.barangay, a.barangay) AS barangay,
             COALESCE(b.age, a.age) AS age,
             u.avatar_url
      FROM beneficiaries b
      LEFT JOIN programs p ON b.program_id = p.id
      LEFT JOIN applications a ON b.application_id = a.id
      LEFT JOIN users u ON a.applicant_id = u.id
      WHERE b.id = ?
    `, [req.params.id]);

    if (!beneficiary) return res.status(404).json({ error: 'Beneficiary not found' });

    const records = await query(`
      SELECT
        p.title AS program_title,
        p.category,
        CASE
          WHEN b.application_id IS NOT NULL AND a.status = 'approved' THEN 'received'
          WHEN b.application_id IS NULL THEN 'received'
          ELSE COALESCE(a.status, 'received')
        END AS status,
        b.received_at AS created_at
      FROM beneficiaries b
      LEFT JOIN programs p ON b.program_id = p.id
      LEFT JOIN applications a ON b.application_id = a.id
      WHERE b.full_name = ? AND b.address = ?
      ORDER BY b.received_at DESC
    `, [beneficiary.full_name, beneficiary.address]);

    res.json({
      full_name: beneficiary.full_name,
      address:   beneficiary.address,
      contact:   beneficiary.contact,
      age:       beneficiary.age    || null,
      barangay:  beneficiary.barangay || null,
      notes:     beneficiary.notes    || null,
      avatar_url: beneficiary.avatar_url || null, 
      records,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── MANUAL ENCODE (staff + admin) ─────────────────────────────────────────
router.post('/manual', authenticate, requireStaff, async (req, res) => {
  try {
    const { program_id, full_name, address, age, contact, barangay, notes, received_at } = req.body;

    if (!program_id || !full_name || !address || !contact) {
      return res.status(400).json({ error: 'Program, full name, address, and contact are required' });
    }

    const program = await queryOne('SELECT * FROM programs WHERE id = ?', [program_id]);
    if (!program) return res.status(404).json({ error: 'Program not found' });

    const duplicate = await queryOne(
      'SELECT id FROM beneficiaries WHERE program_id = ? AND full_name = ? AND address = ?',
      [program_id, full_name, address]
    );
    if (duplicate) {
      return res.status(400).json({
        error: `${full_name} is already recorded as a beneficiary for this program.`,
      });
    }

    const history = await query(`
      SELECT b.full_name, p.title AS program_title
      FROM beneficiaries b
      LEFT JOIN programs p ON b.program_id = p.id
      WHERE b.full_name LIKE ? AND b.address LIKE ?
    `, [`%${full_name}%`, `%${address}%`]);

    await run(
      `INSERT INTO beneficiaries
         (application_id, program_id, full_name, address, age, contact, barangay, notes, received_at)
       VALUES (NULL, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        program_id,
        full_name,
        address,
        age ? parseInt(age) : null,
        contact,
        barangay    || null,
        notes       || null,
        received_at || null,
      ]
    );

    await run('UPDATE programs SET slots_used = slots_used + 1 WHERE id = ?', [program_id]);

    res.json({
      message: `${full_name} has been successfully added as a beneficiary.`,
      warning: history.length > 0
        ? `⚠️ Note: ${full_name} has previously received benefits from: ${history.map(h => h.program_title).join(', ')}`
        : null,
      history,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── BULK / EXCEL IMPORT (staff + admin) ───────────────────────────────────
router.post('/bulk-import', authenticate, requireStaff, async (req, res) => {
  try {
    const { program_id, beneficiaries: list } = req.body;

    if (!program_id || !list || !Array.isArray(list) || list.length === 0) {
      return res.status(400).json({ error: 'Program and a list of beneficiaries are required' });
    }

    const program = await queryOne('SELECT * FROM programs WHERE id = ?', [program_id]);
    if (!program) return res.status(404).json({ error: 'Program not found' });

    let success = 0;
    let skipped = 0;
    const skippedNames = [];
    const warnings     = [];

    for (const person of list) {
      const { full_name, address, age, contact, barangay, received_at } = person;

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

      if (history.length > 0) {
        warnings.push(`${full_name} — has history in: ${history.map(h => h.program_title).join(', ')}`);
      }

      await run(
        `INSERT INTO beneficiaries
           (application_id, program_id, full_name, address, age, contact, received_at)
         VALUES (NULL, ?, ?, ?, ?, ?, ?)`,
        [
          program_id,
          full_name,
          address,
          age ? parseInt(age) : null,
          contact,
          received_at || null,
        ]
      );

      await run('UPDATE programs SET slots_used = slots_used + 1 WHERE id = ?', [program_id]);
      success++;
    }

    res.json({
      message: `Successfully imported ${success} beneficiar${success === 1 ? 'y' : 'ies'}.`,
      success, skipped, skippedNames, warnings,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── DELETE BENEFICIARY (admin only) ──────────────────────────────────────
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    await run('DELETE FROM beneficiaries WHERE id = ?', [req.params.id]);
    res.json({ message: 'Beneficiary deleted successfully' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;