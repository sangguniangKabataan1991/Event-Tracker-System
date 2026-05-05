import { Router } from 'express';
import { query, queryOne, run } from '../db/database.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = Router();

// ── GET ALL PROGRAMS ───────────────────────────────────────────────────────
// slots_used is computed in real-time from the beneficiaries table so that
// the Dashboard "Programs Nearly Full" widget always reflects the true fill %.
router.get('/', async (req, res) => {
  try {
    const { status, category } = req.query;
    let sql = `
      SELECT
        p.*,
        u.full_name AS created_by_name,
        (SELECT COUNT(*) FROM beneficiaries   b  WHERE b.program_id  = p.id)                         AS slots_used,
        (SELECT COUNT(*) FROM applications    a  WHERE a.program_id  = p.id AND a.status = 'pending') AS pending_count,
        (SELECT COUNT(*) FROM applications    a2 WHERE a2.program_id = p.id AND a2.status = 'approved') AS approved_count,
        (SELECT COUNT(*) FROM applications    a3 WHERE a3.program_id = p.id)                          AS total_applications
      FROM programs p
      LEFT JOIN users u ON p.created_by = u.id
      WHERE 1=1
    `;
    const params = [];
    if (status)   { sql += ' AND p.status = ?';   params.push(status); }
    if (category) { sql += ' AND p.category = ?'; params.push(category); }
    sql += ' ORDER BY p.created_at DESC';

    const programs = await query(sql, params);

    // Keep the stored slots_used column in sync (best-effort, non-blocking)
    for (const p of programs) {
      run('UPDATE programs SET slots_used = ? WHERE id = ?', [p.slots_used, p.id]).catch(() => {});
    }

    res.json(programs);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET SINGLE PROGRAM ─────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const p = await queryOne(`
      SELECT
        p.*,
        u.full_name AS created_by_name,
        (SELECT COUNT(*) FROM beneficiaries b WHERE b.program_id = p.id) AS slots_used
      FROM programs p
      LEFT JOIN users u ON p.created_by = u.id
      WHERE p.id = ?
    `, [req.params.id]);
    if (!p) return res.status(404).json({ error: 'Program not found' });
    res.json(p);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── CREATE PROGRAM ─────────────────────────────────────────────────────────
router.post('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const { title, description, category, slots, requirements, start_date, end_date } = req.body;
    if (!title || !category || !slots)
      return res.status(400).json({ error: 'Title, category, and slots required' });
    const result = await run(
      'INSERT INTO programs (title, description, category, slots, requirements, start_date, end_date, created_by) VALUES (?,?,?,?,?,?,?,?)',
      [title, description || null, category, slots, requirements || null, start_date || null, end_date || null, req.user.id]
    );
    res.json({ id: result.insertId, message: 'Program created' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── UPDATE PROGRAM ─────────────────────────────────────────────────────────
router.put('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { title, description, category, slots, requirements, start_date, end_date, status } = req.body;
    await run(
      `UPDATE programs SET title=?, description=?, category=?, slots=?, requirements=?,
       start_date=?, end_date=?, status=? WHERE id=?`,
      [title, description || null, category, slots, requirements || null, start_date || null, end_date || null, status, req.params.id]
    );
    res.json({ message: 'Program updated' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── PATCH STATUS ───────────────────────────────────────────────────────────
router.patch('/:id/status', authenticate, requireAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['draft', 'open', 'closed', 'completed'].includes(status))
      return res.status(400).json({ error: 'Invalid status' });
    await run('UPDATE programs SET status=? WHERE id=?', [status, req.params.id]);
    res.json({ message: `Program ${status}` });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── DELETE PROGRAM ─────────────────────────────────────────────────────────
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    await run('DELETE FROM programs WHERE id=?', [req.params.id]);
    res.json({ message: 'Program deleted' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;