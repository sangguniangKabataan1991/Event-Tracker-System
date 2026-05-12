import { Router } from 'express';
import { query, queryOne, run } from '../db/database.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const { status, category } = req.query;
    let sql = `SELECT p.*, u.full_name as created_by_name,
      (SELECT COUNT(*) FROM applications WHERE program_id = p.id AND status = 'pending') as pending_count,
      (SELECT COUNT(*) FROM applications WHERE program_id = p.id AND status = 'approved') as approved_count,
      (SELECT COUNT(*) FROM applications WHERE program_id = p.id) as total_applications
      FROM programs p LEFT JOIN users u ON p.created_by = u.id WHERE 1=1`;
    const params = [];
    if (status)   { sql += ' AND p.status = ?';   params.push(status); }
    if (category) { sql += ' AND p.category = ?'; params.push(category); }
    sql += ' ORDER BY p.created_at DESC';
    res.json(await query(sql, params));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const p = await queryOne(
      `SELECT p.*, u.full_name as created_by_name FROM programs p
       LEFT JOIN users u ON p.created_by = u.id WHERE p.id = ?`,
      [req.params.id]
    );
    if (!p) return res.status(404).json({ error: 'Program not found' });
    res.json(p);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const { title, description, category, slots, requirements, start_date, end_date } = req.body;
    if (!title || !category || !slots) return res.status(400).json({ error: 'Title, category, and slots required' });
    const result = await run(
      'INSERT INTO programs (title, description, category, slots, requirements, start_date, end_date, created_by) VALUES (?,?,?,?,?,?,?,?)',
      [title, description || null, category, slots, requirements || null, start_date || null, end_date || null, req.user.id]
    );
    res.json({ id: result.insertId, message: 'Program created' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

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

router.patch('/:id/status', authenticate, requireAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['draft', 'open', 'closed', 'completed'].includes(status))
      return res.status(400).json({ error: 'Invalid status' });
    await run('UPDATE programs SET status=? WHERE id=?', [status, req.params.id]);
    res.json({ message: `Program ${status}` });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/:id/duplicate', authenticate, requireAdmin, async (req, res) => {
  try {
    const original = await queryOne('SELECT * FROM programs WHERE id = ?', [req.params.id]);
    if (!original) return res.status(404).json({ error: 'Program not found' });

    const result = await run(
      `INSERT INTO programs
         (title, description, category, slots, slots_used, requirements, start_date, end_date, status, created_by)
       VALUES (?,?,?,?,0,?,?,?,'draft',?)`,
      [
        original.title,
        original.description,
        original.category,
        original.slots,
        original.requirements,
        original.start_date,
        original.end_date,
        req.user.id,
      ]
    );
    res.json({ id: result.insertId, message: 'Program duplicated as draft' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    await run('DELETE FROM programs WHERE id=?', [req.params.id]);
    res.json({ message: 'Program deleted' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;