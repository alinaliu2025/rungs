import crypto from 'node:crypto';
import { db } from './db.js';

const COOKIE = 'rungs_session';

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  const candidate = crypto.scryptSync(password, salt, 64);
  return crypto.timingSafeEqual(candidate, Buffer.from(hash, 'hex'));
}

export function startSession(res, userId) {
  const token = crypto.randomBytes(32).toString('hex');
  db.prepare('INSERT INTO sessions (token, user_id) VALUES (?, ?)').run(token, userId);
  res.cookie(COOKIE, token, { httpOnly: true, sameSite: 'lax', maxAge: 1000 * 60 * 60 * 24 * 14 });
}

export function endSession(req, res) {
  const token = readToken(req);
  if (token) db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  res.clearCookie(COOKIE);
}

function readToken(req) {
  const header = req.headers.cookie || '';
  for (const part of header.split(';')) {
    const [k, v] = part.trim().split('=');
    if (k === COOKIE) return v;
  }
  return null;
}

// Attaches req.user (or null) on every request.
export function loadUser(req, _res, next) {
  const token = readToken(req);
  req.user = token
    ? db.prepare(`SELECT u.id, u.email, u.role, u.name FROM sessions s
                  JOIN users u ON u.id = s.user_id WHERE s.token = ?`).get(token) ?? null
    : null;
  next();
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Please log in.' });
    if (roles.length && !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Not allowed for your account type.' });
    }
    next();
  };
}
