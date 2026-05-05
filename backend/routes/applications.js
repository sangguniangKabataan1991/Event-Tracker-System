import { Router } from 'express';
import { query, queryOne, run } from '../db/database.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

const uploadsDir = join(__dirname, '../uploads');
if (!existsSync(uploadsDir)) mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename:    (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB per file
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only images and PDF files are allowed'));
  },
});

const router = Router();

// ── GET all applications (admin) ─────────────────────────────────────────────
router.get('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const { status, search, from, to } = req.query;
    let sql = `SELECT a.*, p.title as program_title
               FROM applications a
               LEFT JOIN programs p ON a.program_id = p.id
               WHERE 1=1`;
    const params = [];

    if (status) { sql += ' AND a.status = ?';                         params.push(status); }
    if (search) {
      sql += ' AND (a.full_name LIKE ? OR a.address LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    if (from)   { sql += ' AND DATE(a.created_at) >= ?';              params.push(from); }
    if (to)     { sql += ' AND DATE(a.created_at) <= ?';              params.push(to); }

    sql += ' ORDER BY a.created_at DESC LIMIT 500';
    res.json(await query(sql, params));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET applications by program (admin) ──────────────────────────────────────
router.get('/program/:programId', authenticate, requireAdmin, async (req, res) => {
  try {
    const { status, search, from, to } = req.query;
    let sql = `SELECT a.*, u.username, p.title as program_title
               FROM applications a
               LEFT JOIN users    u ON a.applicant_id = u.id
               LEFT JOIN programs p ON a.program_id   = p.id
               WHERE a.program_id = ?`;
    const params = [req.params.programId];

    if (status) { sql += ' AND a.status = ?';                         params.push(status); }
    if (search) {
      sql += ' AND (a.full_name LIKE ? OR a.address LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    if (from)   { sql += ' AND DATE(a.created_at) >= ?';              params.push(from); }
    if (to)     { sql += ' AND DATE(a.created_at) <= ?';              params.push(to); }

    sql += ' ORDER BY a.created_at DESC';
    res.json(await query(sql, params));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET my applications (applicant) ──────────────────────────────────────────
router.get('/my', authenticate, async (req, res) => {
  try {
    const apps = await query(
      `SELECT a.*, p.title as program_title, p.category as program_category
       FROM applications a
       LEFT JOIN programs p ON a.program_id = p.id
       WHERE a.applicant_id = ?
       ORDER BY a.created_at DESC`,
      [req.user.id]
    );
    res.json(apps);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POST submit application ───────────────────────────────────────────────────
router.post('/', authenticate, async (req, res) => {
  try {
    const { program_id, full_name, address, age, contact, barangay, requirements_submitted } = req.body;

    if (!program_id || !full_name || !address || !age || !contact)
      return res.status(400).json({ error: 'All required fields must be filled' });

    const program = await queryOne('SELECT * FROM programs WHERE id = ?', [program_id]);
    if (!program)                    return res.status(404).json({ error: 'Program not found' });
    if (program.status !== 'open')   return res.status(400).json({ error: 'Program is not open for registration' });
    if (program.slots_used >= program.slots)
                                     return res.status(400).json({ error: 'No more slots available' });

    if (req.user.role === 'applicant') {
      const existing = await queryOne(
        'SELECT id FROM applications WHERE program_id = ? AND applicant_id = ?',
        [program_id, req.user.id]
      );
      if (existing) return res.status(400).json({ error: 'You already applied to this program' });
    }

    const result = await run(
      `INSERT INTO applications
         (program_id, applicant_id, full_name, address, age, contact, barangay, requirements_submitted)
       VALUES (?,?,?,?,?,?,?,?)`,
      [program_id, req.user.id, full_name, address, age, contact, barangay || null, requirements_submitted || null]
    );

    res.json({ id: result.insertId, message: 'Application submitted successfully' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── PATCH update status (admin) ───────────────────────────────────────────────
router.patch('/:id/status', authenticate, requireAdmin, async (req, res) => {
  try {
    const { status, notes } = req.body;
    if (!['approved', 'rejected', 'waitlist'].includes(status))
      return res.status(400).json({ error: 'Invalid status' });

    const app = await queryOne('SELECT * FROM applications WHERE id = ?', [req.params.id]);
    if (!app) return res.status(404).json({ error: 'Application not found' });

    await run(
      'UPDATE applications SET status=?, notes=?, reviewed_by=?, reviewed_at=NOW() WHERE id=?',
      [status, notes || null, req.user.id, req.params.id]
    );

    if (status === 'approved') {
      const existing = await queryOne(
        'SELECT id FROM beneficiaries WHERE application_id = ?',
        [req.params.id]
      );
      if (!existing) {
        await run(
          `INSERT INTO beneficiaries (application_id, program_id, full_name, address, contact)
           VALUES (?,?,?,?,?)`,
          [req.params.id, app.program_id, app.full_name, app.address, app.contact]
        );
        await run(
          'UPDATE programs SET slots_used = slots_used + 1 WHERE id = ?',
          [app.program_id]
        );
      }
    }

    res.json({ message: `Application ${status}` });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ════════════════════════════════════════════════════════════════════════════
//  REQUIREMENTS
// ════════════════════════════════════════════════════════════════════════════

// ── GET requirements for an application ──────────────────────────────────────
router.get('/:id/requirements', authenticate, async (req, res) => {
  try {
    const appId = req.params.id;

    // Make sure application exists and user is allowed to view it
    const app = await queryOne('SELECT * FROM applications WHERE id = ?', [appId]);
    if (!app) return res.status(404).json({ error: 'Application not found' });

    // Applicants can only view their own
    if (req.user.role === 'applicant' && app.applicant_id !== req.user.id)
      return res.status(403).json({ error: 'Forbidden' });

    const files = await query(
      'SELECT * FROM application_requirements WHERE application_id = ? ORDER BY uploaded_at ASC',
      [appId]
    );
    res.json(files);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POST upload requirement files ─────────────────────────────────────────────
router.post(
  '/:id/requirements',
  authenticate,
  upload.array('files', 10),
  async (req, res) => {
    try {
      const appId = req.params.id;

      const app = await queryOne('SELECT * FROM applications WHERE id = ?', [appId]);
      if (!app) return res.status(404).json({ error: 'Application not found' });

      // Only the applicant owner, staff, or admin may upload
      if (
        req.user.role !== 'admin' &&
        req.user.role !== 'staff' &&
        app.applicant_id !== req.user.id
      ) return res.status(403).json({ error: 'Forbidden' });

      if (!req.files || req.files.length === 0)
        return res.status(400).json({ error: 'No files uploaded' });

      // labels[] array sent alongside files (optional)
      const labels = req.body.labels
        ? Array.isArray(req.body.labels) ? req.body.labels : [req.body.labels]
        : [];

      const baseUrl = `${req.protocol}://${req.get('host')}`;

      for (let i = 0; i < req.files.length; i++) {
        const file    = req.files[i];
        const fileUrl = `${baseUrl}/uploads/${file.filename}`;
        await run(
          `INSERT INTO application_requirements
             (application_id, file_name, file_url, file_type, requirement_label)
           VALUES (?,?,?,?,?)`,
          [appId, file.originalname, fileUrl, file.mimetype, labels[i] || null]
        );
      }

      res.json({ message: `${req.files.length} file(s) uploaded successfully` });
    } catch (e) { res.status(500).json({ error: e.message }); }
  }
);

// ── DELETE a single requirement file ─────────────────────────────────────────
router.delete('/:id/requirements/:fileId', authenticate, async (req, res) => {
  try {
    const file = await queryOne(
      `SELECT ar.*, a.applicant_id
       FROM application_requirements ar
       JOIN applications a ON ar.application_id = a.id
       WHERE ar.id = ? AND ar.application_id = ?`,
      [req.params.fileId, req.params.id]
    );
    if (!file) return res.status(404).json({ error: 'File not found' });

    // Only applicant owner, staff, or admin may delete
    if (
      req.user.role !== 'admin' &&
      req.user.role !== 'staff' &&
      file.applicant_id !== req.user.id
    ) return res.status(403).json({ error: 'Forbidden' });

    // Remove physical file from disk
    const filename = file.file_url.split('/uploads/')[1];
    if (filename) {
      const { unlink } = await import('fs/promises');
      try { await unlink(join(uploadsDir, filename)); } catch (_) { /* already gone */ }
    }

    await run('DELETE FROM application_requirements WHERE id = ?', [req.params.fileId]);
    res.json({ message: 'File deleted' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;