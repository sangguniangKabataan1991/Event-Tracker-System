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

export function requireAdmin(req, res, next) {
  const role = req.user?.role;
  if (role !== 'admin' && role !== 'staff') {
    return res.status(403).json({ error: 'Access denied. Admin or Staff only.' });
  }
  next();
}

export function requireStrictAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied. Admin only.' });
  }
  next();
}

export function signToken(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: '8h' });
}