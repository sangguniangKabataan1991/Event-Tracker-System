// routes/applications.js
import { Router } from 'express';
import { query, queryOne, run } from '../db/database.js';
import { authenticate, requireAdmin, requireStaff } from '../middleware/auth.js';
import { sendApplicationApprovedEmail, sendApplicationRejectedEmail } from '../services/email.js';
import multer from 'multer';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const uploadsDir = join(__dirname, '../uploads');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename:    (req, file, cb) => cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${file.originalname.match(/\.[^.]+$/)?.[0] || ''}`)
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only images and PDF files are allowed'));
  }
});

const router = Router();

// ── GET all applications (staff + admin) ─────────────────────────────────────
router.get('/', authenticate, requireStaff, async (req, res) => {
  try {
    const { status, search, from, to } = req.query;
    let sql = `SELECT a.*, p.title as program_title,
                 u.avatar_url as applicant_avatar_url,
                 (SELECT COUNT(*) FROM application_requirements ar WHERE ar.application_id = a.id) as file_count,
                 (SELECT id FROM beneficiaries b WHERE b.application_id = a.id LIMIT 1) as beneficiary_id
               FROM applications a
               LEFT JOIN programs p ON a.program_id = p.id
               LEFT JOIN users u ON a.applicant_id = u.id
               WHERE 1=1`;
    const params = [];

    if (status) { sql += ' AND a.status = ?'; params.push(status); }
    if (search) {
      sql += ' AND (a.full_name LIKE ? OR a.address LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    if (from) { sql += ' AND DATE(a.created_at) >= ?'; params.push(from); }
    if (to)   { sql += ' AND DATE(a.created_at) <= ?'; params.push(to); }

    sql += ' ORDER BY a.created_at DESC LIMIT 500';
    res.json(await query(sql, params));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET applications by program (staff + admin) ───────────────────────────────
router.get('/program/:programId', authenticate, requireStaff, async (req, res) => {
  try {
    const { status, search, from, to } = req.query;
    let sql = `SELECT a.*, u.username, p.title as program_title,
                 u.avatar_url as applicant_avatar_url,
                 (SELECT COUNT(*) FROM application_requirements ar WHERE ar.application_id = a.id) as file_count,
                 (SELECT id FROM beneficiaries b WHERE b.application_id = a.id LIMIT 1) as beneficiary_id
               FROM applications a
               LEFT JOIN users    u ON a.applicant_id = u.id
               LEFT JOIN programs p ON a.program_id   = p.id
               WHERE a.program_id = ?`;
    const params = [req.params.programId];
    if (status) { sql += ' AND a.status = ?'; params.push(status); }
    if (search) { sql += ' AND (a.full_name LIKE ? OR a.address LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
    if (from)   { sql += ' AND DATE(a.created_at) >= ?'; params.push(from); }
    if (to)     { sql += ' AND DATE(a.created_at) <= ?'; params.push(to); }
    sql += ' ORDER BY a.created_at DESC';
    res.json(await query(sql, params));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET my applications (applicant) ───────────────────────────────────────────
router.get('/my', authenticate, async (req, res) => {
  try {
    const apps = await query(
      `SELECT a.*, p.title as program_title, p.category as program_category,
         (SELECT COUNT(*) FROM application_requirements ar WHERE ar.application_id = a.id) as file_count,
         (SELECT id FROM beneficiaries b WHERE b.application_id = a.id LIMIT 1) as beneficiary_id
       FROM applications a
       LEFT JOIN programs p ON a.program_id = p.id
       WHERE a.applicant_id = ?
       ORDER BY a.created_at DESC`,
      [req.user.id]
    );
    res.json(apps);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POST submit application ────────────────────────────────────────────────────
router.post('/', authenticate, async (req, res) => {
  try {
    const { program_id, full_name, address, age, contact, barangay, requirements_submitted } = req.body;
    if (!program_id || !full_name || !address || !age || !contact)
      return res.status(400).json({ error: 'All required fields must be filled' });

    const program = await queryOne('SELECT * FROM programs WHERE id = ?', [program_id]);
    if (!program) return res.status(404).json({ error: 'Program not found' });
    if (program.status !== 'open') return res.status(400).json({ error: 'Program is not open for registration' });
    if (program.slots_used >= program.slots) return res.status(400).json({ error: 'No more slots available' });

    if (req.user.role === 'applicant') {
      const existing = await queryOne('SELECT id FROM applications WHERE program_id=? AND applicant_id=?', [program_id, req.user.id]);
      if (existing) return res.status(400).json({ error: 'You already applied to this program' });
    }

    const result = await run(
      'INSERT INTO applications (program_id, applicant_id, full_name, address, age, contact, barangay, requirements_submitted) VALUES (?,?,?,?,?,?,?,?)',
      [program_id, req.user.id, full_name, address, age, contact, barangay || null, requirements_submitted || null]
    );

    res.json({ id: result.insertId, message: 'Application submitted successfully' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── PATCH update application status (staff + admin) ───────────────────────────
router.patch('/:id/status', authenticate, requireStaff, async (req, res) => {
  try {
    const { status, notes } = req.body;
    if (!['approved', 'rejected', 'waitlist', 'pending'].includes(status))
      return res.status(400).json({ error: 'Invalid status' });

    const app = await queryOne('SELECT * FROM applications WHERE id = ?', [req.params.id]);
    if (!app) return res.status(404).json({ error: 'Application not found' });

    await run(
      'UPDATE applications SET status=?, notes=?, reviewed_by=?, reviewed_at=NOW() WHERE id=?',
      [status, notes || null, req.user.id, req.params.id]
    );

    // ── Slot management based on status change ────────────────────────────
    const wasApproved = app.status === 'approved';
    const nowApproved = status === 'approved';

    if (!wasApproved && nowApproved) {
      await run('UPDATE programs SET slots_used = slots_used + 1 WHERE id = ?', [app.program_id]);
      await run(`
        UPDATE programs SET status = 'closed'
        WHERE id = ? AND slots_used >= slots AND status = 'open'
      `, [app.program_id]);
    } else if (wasApproved && !nowApproved) {
      await run('UPDATE programs SET slots_used = GREATEST(slots_used - 1, 0) WHERE id = ?', [app.program_id]);
      await run(`
        UPDATE programs SET status = 'open'
        WHERE id = ?
          AND status = 'closed'
          AND slots_used < slots
          AND (end_date IS NULL OR DATE(end_date) >= CURDATE())
      `, [app.program_id]);
    }

    // ── Send email notification ──────────────────────────────────────────
    if (app.applicant_id && (status === 'approved' || status === 'rejected')) {
      try {
        const applicant = await queryOne(
          'SELECT email, full_name FROM users WHERE id = ?',
          [app.applicant_id]
        );
        const program = await queryOne(
          'SELECT title FROM programs WHERE id = ?',
          [app.program_id]
        );
        if (applicant?.email && program) {
          const payload = {
            to:            applicant.email,
            full_name:     applicant.full_name || app.full_name,
            program_title: program.title,
            notes:         notes || null,
          };
          if (status === 'approved') {
            await sendApplicationApprovedEmail(payload);
          } else {
            await sendApplicationRejectedEmail(payload);
          }
        }
      } catch (emailErr) {
        console.warn('[Email] Failed to send status notification:', emailErr.message);
      }
    }

    res.json({ message: `Application ${status}` });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/:id/receive', authenticate, requireStaff, async (req, res) => {
  try {
    const app = await queryOne('SELECT * FROM applications WHERE id = ?', [req.params.id]);
    if (!app) return res.status(404).json({ error: 'Application not found' });

    if (app.status !== 'approved')
      return res.status(400).json({ error: 'Only approved applications can be marked as received' });

    const existing = await queryOne('SELECT id FROM beneficiaries WHERE application_id = ?', [req.params.id]);
    if (existing)
      return res.status(400).json({ error: `${app.full_name} is already marked as received` });

    const program = await queryOne('SELECT * FROM programs WHERE id = ?', [app.program_id]);
    const receivedCount = await queryOne(
      'SELECT COUNT(*) as count FROM beneficiaries WHERE program_id = ?',
      [app.program_id]
    );
    if (receivedCount.count >= program.slots) {
      return res.status(400).json({
        error: `Slots are already full for this program. Cannot mark as received.`
      });
    }

    await run(
      'INSERT INTO beneficiaries (application_id, program_id, full_name, address, contact) VALUES (?,?,?,?,?)',
      [req.params.id, app.program_id, app.full_name, app.address, app.contact]
    );

    res.json({ message: `${app.full_name} has been marked as received and added to beneficiaries.` });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET requirements for an application ───────────────────────────────────────
router.get('/:id/requirements', authenticate, async (req, res) => {
  try {
    const appId = req.params.id;
    const app = await queryOne('SELECT * FROM applications WHERE id = ?', [appId]);
    if (!app) return res.status(404).json({ error: 'Application not found' });

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
router.post('/:id/requirements', authenticate, upload.array('files', 10), async (req, res) => {
  try {
    const appId = req.params.id;
    const app = await queryOne('SELECT * FROM applications WHERE id = ?', [appId]);
    if (!app) return res.status(404).json({ error: 'Application not found' });

    if (req.user.role !== 'admin' && req.user.role !== 'staff' && app.applicant_id !== req.user.id)
      return res.status(403).json({ error: 'Forbidden' });

    if (!req.files || req.files.length === 0)
      return res.status(400).json({ error: 'No files uploaded' });

    const labels = req.body.labels
      ? Array.isArray(req.body.labels) ? req.body.labels : [req.body.labels]
      : [];

    const baseUrl = `${req.protocol}://${req.get('host')}`;

    for (let i = 0; i < req.files.length; i++) {
      const file    = req.files[i];
      const fileUrl = `${baseUrl}/uploads/${file.filename}`;
      await run(
        `INSERT INTO application_requirements (application_id, file_name, file_url, file_type, requirement_label)
         VALUES (?,?,?,?,?)`,
        [appId, file.originalname, fileUrl, file.mimetype, labels[i] || null]
      );
    }

    res.json({ message: `${req.files.length} file(s) uploaded successfully` });
  } catch (e) {
    if (e.message?.includes('Only images')) return res.status(400).json({ error: e.message });
    res.status(500).json({ error: e.message });
  }
});

// ── DELETE a requirement file ──────────────────────────────────────────────────
router.delete('/:id/requirements/:fileId', authenticate, async (req, res) => {
  try {
    const file = await queryOne(
      `SELECT ar.*, a.applicant_id FROM application_requirements ar
       JOIN applications a ON ar.application_id = a.id
       WHERE ar.id = ? AND ar.application_id = ?`,
      [req.params.fileId, req.params.id]
    );
    if (!file) return res.status(404).json({ error: 'File not found' });

    if (req.user.role !== 'admin' && req.user.role !== 'staff' && file.applicant_id !== req.user.id)
      return res.status(403).json({ error: 'Forbidden' });

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