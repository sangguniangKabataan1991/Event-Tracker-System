import { Router } from 'express';
import bcrypt     from 'bcryptjs';
import crypto     from 'crypto';
import { query, queryOne, run }     from '../db/database.js';
import { signToken, authenticate }  from '../middleware/auth.js';
import { sendPasswordResetEmail }   from '../services/email.js';

const router = Router();

// ── LOGIN (username OR email) ──────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).json({ error: 'Username/email and password are required' });

    const user = await queryOne(
      'SELECT * FROM users WHERE username = ? OR email = ?',
      [username, username]
    );

    if (!user || !(await bcrypt.compare(password, user.password)))
      return res.status(401).json({ error: 'Invalid username/email or password' });

    const token = signToken({
      id:        user.id,
      username:  user.username,
      role:      user.role,
      position:  user.position,
      full_name: user.full_name,
    });

  res.json({
    token,
    user: {
      id:        user.id,
      username:  user.username,
      role:      user.role,
      position:  user.position,
      full_name: user.full_name,
      email:     user.email,
      contact:   user.contact  || null,
      barangay:  user.barangay || null,
      address:   user.address  || null,
      avatar_url: user.avatar_url || null,
    },
  });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── REGISTER (public applicant signup) ────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { username, password, full_name, email, contact, address, barangay } = req.body;
    if (!username || !password || !full_name)
      return res.status(400).json({ error: 'Username, password, and full name required' });

    const hash   = await bcrypt.hash(password, 10);
    const result = await run(
      'INSERT INTO users (username, password, full_name, role, email, contact, address, barangay) VALUES (?,?,?,?,?,?,?,?)',
      [username, hash, full_name, 'applicant', email || null, contact || null, address || null, barangay || null]
    );

    const token = signToken({
      id: result.insertId, username, role: 'applicant', position: null, full_name,
    });

    res.json({
      token,
      user: {
        id:        result.insertId,
        username,
        role:      'applicant',
        position:  null,
        full_name,
        email:     email    || null,
        contact:   contact  || null,
        barangay:  barangay || null,
        address:   address  || null,
        avatar_url: null, 
      },
    });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY')
      return res.status(400).json({ error: 'Username or email already taken' });
    res.status(500).json({ error: e.message });
  }
});

// ── FORGOT PASSWORD ────────────────────────────────────────────────────────
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email)
      return res.status(400).json({ error: 'Email is required' });

    const user = await queryOne('SELECT * FROM users WHERE email = ?', [email]);

    // Always respond 200 — never leak which emails exist
    if (!user)
      return res.json({ message: 'If that email exists, a reset link has been sent.' });

    // Generate secure token valid for 1 hour
    const token     = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await run(
      `INSERT INTO password_resets (user_id, token, expires_at)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE token = VALUES(token), expires_at = VALUES(expires_at)`,
      [user.id, token, expiresAt]
    );

    await sendPasswordResetEmail({
      to:        user.email,
      full_name: user.full_name,
      token,
      role:      user.role,
    });

    res.json({ message: 'If that email exists, a reset link has been sent.' });
  } catch (e) {
    console.error('Forgot password error:', e.message);
    res.status(500).json({ error: 'Failed to send reset email. Check email configuration.' });
  }
});

// ── RESET PASSWORD ─────────────────────────────────────────────────────────
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password)
      return res.status(400).json({ error: 'Token and password are required' });
    if (password.length < 6)
      return res.status(400).json({ error: 'Password must be at least 6 characters' });

    const reset = await queryOne(
      `SELECT * FROM password_resets 
       WHERE token = ? AND expires_at > NOW()`,
      [token]
    );

    if (!reset)
      return res.status(400).json({ error: 'Link is invalid or expired.' });

    const hash = await bcrypt.hash(password, 10);

    await run(
      'UPDATE users SET password = ? WHERE id = ?',
      [hash, reset.user_id]
    );

    // Delete the used token
    await run(
      'DELETE FROM password_resets WHERE token = ?',
      [token]
    );

    res.json({ message: 'Password reset successfully.' });
  } catch (e) {
    console.error('Reset password error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── VERIFY RESET TOKEN ─────────────────────────────────────────────────────
router.get('/reset-password/verify', async (req, res) => {
  try {
    const { token } = req.query;
    if (!token)
      return res.status(400).json({ valid: false, error: 'Token is required.' });

    const reset = await queryOne(
      `SELECT pr.*, u.full_name
       FROM password_resets pr
       JOIN users u ON u.id = pr.user_id
       WHERE pr.token = ? AND pr.expires_at > NOW()`,
      [token]
    );

    if (!reset)
      return res.status(400).json({ valid: false, error: 'Link is invalid or expired.' });

    res.json({ valid: true, full_name: reset.full_name });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── ME (get current logged-in user) ───────────────────────────────────────
router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await queryOne(
      'SELECT id, username, full_name, role, position, email, contact, address, barangay, avatar_url FROM users WHERE id = ?',
      [req.user.id]
    );
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;