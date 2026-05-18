// db/database.js
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import 'dotenv/config';

// SSL only when explicitly enabled (e.g. production with a real cert)
const sslConfig = process.env.DB_SSL === 'true'
  ? { minVersion: 'TLSv1.2', rejectUnauthorized: true }
  : false;

const pool = mysql.createPool({
  host:               process.env.DB_HOST     || 'localhost',
  port:               parseInt(process.env.DB_PORT || '3306'),
  user:               process.env.DB_USER     || 'root',
  password:           process.env.DB_PASSWORD || '',
  database:           process.env.DB_NAME     || 'sk_system',
  waitForConnections: true,
  connectionLimit:    10,
  queueLimit:         0,
  charset:            'utf8mb4',

  // Keep connections alive — prevents ECONNRESET on idle
  enableKeepAlive:         true,
  keepAliveInitialDelay:   0,

  // Reconnect timeout
  connectTimeout:          10000,

  ssl: sslConfig,
});

// ── Connection error logging ───────────────────────────────────────────────
pool.on('connection', (conn) => {
  conn.on('error', (err) => {
    console.error('[DB] Connection error:', err.code, err.message);
  });
});

// ── Retry helper ───────────────────────────────────────────────────────────
const RETRYABLE = new Set([
  'ECONNRESET',
  'ECONNREFUSED',
  'PROTOCOL_CONNECTION_LOST',
  'ETIMEDOUT',
  'ER_CON_COUNT_ERROR',
]);

async function withRetry(fn, label = 'query', retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const isRetryable = RETRYABLE.has(err.code);
      if (isRetryable && attempt < retries) {
        const delay = 500 * attempt; // 500ms, 1000ms, 1500ms
        console.warn(`[DB] ${label} failed (${err.code}), retrying in ${delay}ms… (${attempt}/${retries})`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw err; // non-retryable OR exhausted retries
    }
  }
}

// ── Public query helpers ───────────────────────────────────────────────────
export async function query(sql, params = []) {
  const [rows] = await withRetry(
    () => pool.execute(sql, params),
    'query'
  );
  return rows;
}

export async function queryOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0] || null;
}

export async function run(sql, params = []) {
  const [result] = await withRetry(
    () => pool.execute(sql, params),
    'run'
  );
  return result;
}

// ── Database initializer ───────────────────────────────────────────────────
export async function initDatabase() {
  console.log('Initializing MySQL database...');

  // ── USERS ────────────────────────────────────────────────────────────────
  await pool.execute(`CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    full_name VARCHAR(200) NOT NULL,
    role ENUM('admin','staff','applicant') NOT NULL DEFAULT 'staff',
    position VARCHAR(100) DEFAULT NULL,
    email VARCHAR(200) UNIQUE,
    contact VARCHAR(50),
    address TEXT,
    barangay VARCHAR(100),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  // ── Safe migrations (idempotent, run every startup) ───────────────────────
  const migrations = [
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS position VARCHAR(100) DEFAULT NULL AFTER role`,
    `ALTER TABLE users MODIFY COLUMN role ENUM('admin','staff','applicant') NOT NULL DEFAULT 'staff'`,
    `ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS barangay VARCHAR(100) DEFAULT NULL`,
    `ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS age INT DEFAULT NULL`,
  ];
  for (const sql of migrations) {
    try { await pool.execute(sql); } catch (_) {}
  }
  try {
    await pool.execute(`ALTER TABLE users ADD UNIQUE INDEX idx_users_email (email)`);
  } catch (_) {}

  // ── PASSWORD RESETS ───────────────────────────────────────────────────────
  await pool.execute(`CREATE TABLE IF NOT EXISTS password_resets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL UNIQUE,
    token VARCHAR(128) NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  // ── CATEGORIES ────────────────────────────────────────────────────────────
  await pool.execute(`CREATE TABLE IF NOT EXISTS program_categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  // ── PROGRAMS ──────────────────────────────────────────────────────────────
  await pool.execute(`CREATE TABLE IF NOT EXISTS programs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100) NOT NULL,
    slots INT NOT NULL DEFAULT 0,
    slots_used INT NOT NULL DEFAULT 0,
    status ENUM('draft','open','closed','completed') NOT NULL DEFAULT 'draft',
    requirements TEXT,
    start_date DATE,
    end_date DATE,
    created_by INT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  // ── APPLICATIONS ──────────────────────────────────────────────────────────
  await pool.execute(`CREATE TABLE IF NOT EXISTS applications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    program_id INT NOT NULL,
    applicant_id INT,
    full_name VARCHAR(200) NOT NULL,
    address TEXT NOT NULL,
    age INT NOT NULL,
    contact VARCHAR(50) NOT NULL,
    barangay VARCHAR(100),
    requirements_submitted TEXT,
    status ENUM('pending','approved','rejected','waitlist') NOT NULL DEFAULT 'pending',
    notes TEXT,
    reviewed_by INT,
    reviewed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (program_id) REFERENCES programs(id) ON DELETE CASCADE,
    FOREIGN KEY (applicant_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  // ── APPLICATION REQUIREMENTS ──────────────────────────────────────────────
  await pool.execute(`CREATE TABLE IF NOT EXISTS application_requirements (
    id INT AUTO_INCREMENT PRIMARY KEY,
    application_id INT NOT NULL,
    file_name VARCHAR(500) NOT NULL,
    file_url TEXT NOT NULL,
    file_type VARCHAR(100) NOT NULL,
    requirement_label VARCHAR(255) DEFAULT NULL,
    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  // ── BENEFICIARIES ─────────────────────────────────────────────────────────
  await pool.execute(`CREATE TABLE IF NOT EXISTS beneficiaries (
    id INT AUTO_INCREMENT PRIMARY KEY,
    application_id INT UNIQUE,
    program_id INT NOT NULL,
    full_name VARCHAR(200) NOT NULL,
    address TEXT NOT NULL,
    age INT DEFAULT NULL,
    contact VARCHAR(50) NOT NULL,
    barangay VARCHAR(100) DEFAULT NULL,
    benefit_received TEXT,
    received_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE SET NULL,
    FOREIGN KEY (program_id) REFERENCES programs(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  // ── BARANGAY INFO ─────────────────────────────────────────────────────────
  await pool.execute(`CREATE TABLE IF NOT EXISTS barangay_info (
    id INT AUTO_INCREMENT PRIMARY KEY,
    barangay_name VARCHAR(200),
    sk_chairperson VARCHAR(200),
    contact VARCHAR(50),
    address TEXT,
    municipality VARCHAR(200),
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  // ── Default admin account ──────────────────────────────────────────────────
  const admin = await queryOne("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
  if (!admin) {
    const hash = await bcrypt.hash('admin123', 10);
    await run(
      'INSERT INTO users (username, password, full_name, role, position) VALUES (?, ?, ?, ?, ?)',
      ['admin', hash, 'SK Admin', 'admin', 'SK Chairperson']
    );
    console.log('Default admin created: admin / admin123');
  }

  // ── Default categories ─────────────────────────────────────────────────────
  const defaultCats = [
    'Educational Assistance', 'Medical Aid', 'Sports Program',
    'Livelihood', 'Relief Goods', 'Scholarship', 'Cultural Program', 'Social Services'
  ];
  for (const name of defaultCats) {
    await pool.execute('INSERT IGNORE INTO program_categories (name) VALUES (?)', [name]);
  }

  console.log('Database initialized successfully!');
}

export default pool;