import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET || 'sk-secret-2026';

export function authenticate(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

/** Admin only — for destructive/sensitive actions */
export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin')
    return res.status(403).json({ error: 'Admin only' });
  next();
}

/** Staff OR admin — for day-to-day operations */
export function requireStaff(req, res, next) {
  if (req.user?.role !== 'admin' && req.user?.role !== 'staff')
    return res.status(403).json({ error: 'Staff or admin access required' });
  next();
}

export function signToken(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: '8h' });
}