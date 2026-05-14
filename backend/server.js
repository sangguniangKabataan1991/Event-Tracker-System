// server.js
import 'dotenv/config';
import express from 'express';
import cors    from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join }  from 'path';
import { existsSync, mkdirSync } from 'fs';
import { initDatabase, query, queryOne, run } from './db/database.js';
import { sendWelcomeEmail, verifyEmailConnection } from './services/email.js';
import { signToken } from './middleware/auth.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app  = express();
const PORT = process.env.PORT || 3000;

const uploadsDir = join(__dirname, 'uploads');
if (!existsSync(uploadsDir)) mkdirSync(uploadsDir, { recursive: true });

app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:4173',
  ],
}));
app.use(express.json());
app.use('/uploads', express.static(uploadsDir));

// ── Routes ─────────────────────────────────────────────────────────────────
import authRoutes        from './routes/auth.js';
import programRoutes     from './routes/programs.js';
import applicationRoutes from './routes/applications.js';
import beneficiaryRoutes from './routes/beneficiaries.js';

app.use('/api/auth',          authRoutes);
app.use('/api/programs',      programRoutes);
app.use('/api/applications',  applicationRoutes);
app.use('/api/beneficiaries', beneficiaryRoutes);

// ── CATEGORIES ─────────────────────────────────────────────────────────────
app.get('/api/categories', async (req, res) => {
  res.json(await query('SELECT * FROM program_categories ORDER BY name'));
});

app.post('/api/categories', async (req, res) => {
  try {
    const { name, description } = req.body;
    const result = await run(
      'INSERT INTO program_categories (name, description) VALUES (?,?)',
      [name, description || null]
    );
    res.json({ id: result.insertId });
  } catch {
    res.status(400).json({ error: 'Category already exists' });
  }
});

app.delete('/api/categories/:name', async (req, res) => {
  try {
    await run(
      'DELETE FROM program_categories WHERE name = ?',
      [decodeURIComponent(req.params.name)]
    );
    res.json({ message: 'Category deleted' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── USERS ──────────────────────────────────────────────────────────────────
app.get('/api/users', async (req, res) => {
  res.json(
    await query(
      'SELECT id, username, full_name, role, position, email, contact, barangay, created_at FROM users ORDER BY created_at DESC'
    )
  );
});

app.post('/api/users', async (req, res) => {
  try {
    const { username, password, full_name, position, email } = req.body;

    if (!username || !password || !full_name)
      return res.status(400).json({ error: 'Username, password, and full name are required' });
    if (password.length < 6)
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    if (!position?.trim())
      return res.status(400).json({ error: 'Position is required' });

    const role = req.body.role === 'admin' ? 'admin' : 'staff';

    const bcrypt = await import('bcryptjs');
    const hash   = await bcrypt.default.hash(password, 10);

    const result = await run(
      'INSERT INTO users (username, password, full_name, role, position, email) VALUES (?,?,?,?,?,?)',
      [username, hash, full_name, role, position.trim(), email?.trim() || null]
    );

    // Send welcome email if address provided — fire and forget
    if (email?.trim()) {
      sendWelcomeEmail({
        to:       email.trim(),
        full_name,
        username,
        password,  // plaintext — user must change after first login
        position:  position.trim(),
      }).catch(err => console.warn('  Welcome email failed:', err.message));
    }

    res.json({ id: result.insertId, message: 'User created successfully' });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY')
      return res.status(400).json({ error: 'Username or email already taken' });
    res.status(500).json({ error: e.message });
  }
});

// ── PUT /api/users/:id — updated with new token issuance ──────────────────
app.put('/api/users/:id', async (req, res) => {
  try {
    const { full_name, username, position, password, email } = req.body;

    if (!full_name)
      return res.status(400).json({ error: 'Full name is required' });
    if (!username?.trim())
      return res.status(400).json({ error: 'Username is required' });

    if (password && password.length >= 6) {
      const bcrypt = await import('bcryptjs');
      const hash   = await bcrypt.default.hash(password, 10);
      await run(
        'UPDATE users SET full_name=?, username=?, position=?, email=?, password=? WHERE id=?',
        [full_name, username.trim(), position?.trim() || null, email?.trim() || null, hash, req.params.id]
      );
    } else {
      await run(
        'UPDATE users SET full_name=?, username=?, position=?, email=? WHERE id=?',
        [full_name, username.trim(), position?.trim() || null, email?.trim() || null, req.params.id]
      );
    }

    // Fetch the updated user record
    const updatedUser = await queryOne(
      'SELECT id, username, full_name, role, position, email FROM users WHERE id = ?',
      [req.params.id]
    );

    const newToken = signToken({
      id:        updatedUser.id,
      username:  updatedUser.username,
      role:      updatedUser.role,
      position:  updatedUser.position,
      full_name: updatedUser.full_name,
    });

    res.json({ message: 'User updated', updatedUser, newToken });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY')
      return res.status(400).json({ error: 'Username or email already in use by another account' });
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/users/:id', async (req, res) => {
  try {
    const user = await query('SELECT role FROM users WHERE id = ?', [req.params.id]);
    if (user[0]?.role === 'admin') {
      const adminCount = await query("SELECT COUNT(*) as count FROM users WHERE role = 'admin'");
      if (adminCount[0].count <= 1)
        return res.status(400).json({ error: 'Cannot delete the last admin account' });
    }
    await run('DELETE FROM users WHERE id = ?', [req.params.id]);
    res.json({ message: 'User deleted' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── BARANGAY INFO ──────────────────────────────────────────────────────────
app.get('/api/barangay-info', async (req, res) => {
  try {
    const rows = await query('SELECT * FROM barangay_info LIMIT 1');
    res.json(rows[0] || {});
  } catch {
    res.json({});
  }
});

app.put('/api/barangay-info', async (req, res) => {
  try {
    const { barangay_name, sk_chairperson, contact, address, municipality } = req.body;
    const existing = await query('SELECT id FROM barangay_info LIMIT 1');
    if (existing.length > 0) {
      await run(
        'UPDATE barangay_info SET barangay_name=?, sk_chairperson=?, contact=?, address=?, municipality=? WHERE id=?',
        [barangay_name, sk_chairperson, contact, address, municipality, existing[0].id]
      );
    } else {
      await run(
        'INSERT INTO barangay_info (barangay_name, sk_chairperson, contact, address, municipality) VALUES (?,?,?,?,?)',
        [barangay_name, sk_chairperson, contact, address, municipality]
      );
    }
    res.json({ message: 'Barangay information updated' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── HEALTH ─────────────────────────────────────────────────────────────────
app.get('/api/health', (_, res) => res.json({ status: 'OK', time: new Date().toISOString() }));

// ── START ──────────────────────────────────────────────────────────────────
initDatabase()
  .then(async () => {
    await verifyEmailConnection();
    app.listen(PORT, () => {
      console.log(`\n SK System Backend running at http://localhost:${PORT}`);
      console.log(` Database: MySQL (${process.env.DB_NAME || 'sk_system'})`);
      console.log(` Default admin: username=admin password=admin123\n`);
    });
  })
  .catch(err => {
    console.error(' Database connection failed:', err.message);
    process.exit(1);
  });