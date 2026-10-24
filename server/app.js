import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, parseChallenge, parseProfile } from './db.js';
import { hashPassword, verifyPassword, startSession, endSession, loadUser, requireRole } from './auth.js';
import { SKILLS, INTERESTS, ROLES } from './catalog.js';
import { recommend } from './matching.js';
import { formTeams } from './teams.js';

const publicDir = path.join(path.dirname(path.dirname(fileURLToPath(import.meta.url))), 'public');

export const app = express();
app.use(express.json());
app.use(loadUser);
app.use(express.static(publicDir));

const bad = (res, msg, code = 400) => res.status(code).json({ error: msg });
const list = (v) => (Array.isArray(v) ? v : []);

function registrantCounts() {
  const rows = db.prepare('SELECT challenge_id, COUNT(*) AS n FROM registrations GROUP BY challenge_id').all();
  return Object.fromEntries(rows.map((r) => [r.challenge_id, r.n]));
}

function publishedChallenges() {
  return db.prepare(`SELECT c.*, u.name AS company_name FROM challenges c
                     JOIN users u ON u.id = c.company_id
                     WHERE c.status = 'published' ORDER BY c.created_at DESC, c.id DESC`).all().map(parseChallenge);
}

function getChallenge(id) {
  return parseChallenge(db.prepare(`SELECT c.*, u.name AS company_name FROM challenges c
                                    JOIN users u ON u.id = c.company_id WHERE c.id = ?`).get(id));
}

function getProfile(userId) {
  return parseProfile(db.prepare('SELECT * FROM profiles WHERE user_id = ?').get(userId));
}

// Team as a student sees it: names and majors only, no scores.
function studentTeamView(challengeId, userId) {
  const team = db.prepare(`SELECT t.id, t.name FROM teams t JOIN team_members m ON m.team_id = t.id
                           WHERE t.challenge_id = ? AND m.user_id = ?`).get(challengeId, userId);
  if (!team) return null;
  const members = db.prepare(`SELECT u.name, p.major, p.preferred_role FROM team_members m
                              JOIN users u ON u.id = m.user_id LEFT JOIN profiles p ON p.user_id = u.id
                              WHERE m.team_id = ? ORDER BY u.name`).all(team.id);
  return { name: team.name, members };
}

// ---------- meta + auth ----------

app.get('/api/meta', (_req, res) => res.json({ skills: SKILLS, interests: INTERESTS, roles: ROLES }));

app.post('/api/auth/signup', (req, res) => {
  const { email, password, name, role } = req.body || {};
  if (!email || !password || !name) return bad(res, 'Name, email and password are required.');
  if (!['student', 'company'].includes(role)) return bad(res, 'Choose student or company.');
  if (password.length < 8) return bad(res, 'Password must be at least 8 characters.');
  const normalized = String(email).trim().toLowerCase();
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(normalized)) return bad(res, 'That email is already registered.');
  const { lastInsertRowid } = db.prepare('INSERT INTO users (email, password_hash, role, name) VALUES (?, ?, ?, ?)')
    .run(normalized, hashPassword(password), role, String(name).trim());
  startSession(res, Number(lastInsertRowid));
  res.status(201).json({ ok: true });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(String(email || '').trim().toLowerCase());
  if (!user || !verifyPassword(String(password || ''), user.password_hash)) return bad(res, 'Wrong email or password.', 401);
  startSession(res, user.id);
  res.json({ ok: true });
});

app.post('/api/auth/logout', (req, res) => {
  endSession(req, res);
  res.json({ ok: true });
});

app.get('/api/me', (req, res) => {
  if (!req.user) return res.json({ user: null });
  const profile = req.user.role === 'student' ? getProfile(req.user.id) : null;
  res.json({ user: req.user, profile });
});

app.put('/api/profile', requireRole('student'), (req, res) => {
  const b = req.body || {};
  const skills = {};
  for (const [k, v] of Object.entries(b.skills || {})) {
    const level = Number(v);
    if (SKILLS.includes(k) && level >= 1 && level <= 3) skills[k] = level;
  }
  if (!Object.keys(skills).length) return bad(res, 'Add at least one skill.');
  const interests = list(b.interests).filter((i) => INTERESTS.includes(i));
  const hours = Math.max(0, Math.min(40, Number(b.hours_per_week) || 0));
  const role = ROLES.includes(b.preferred_role) ? b.preferred_role : null;
  db.prepare(`INSERT INTO profiles (user_id, major, year, bio, hours_per_week, preferred_role, skills, interests)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(user_id) DO UPDATE SET major = excluded.major, year = excluded.year, bio = excluded.bio,
                hours_per_week = excluded.hours_per_week, preferred_role = excluded.preferred_role,
                skills = excluded.skills, interests = excluded.interests`)
    .run(req.user.id, b.major || null, b.year || null, b.bio || null, hours, role, JSON.stringify(skills), JSON.stringify(interests));
  res.json({ profile: getProfile(req.user.id) });
});

// ---------- challenges (public + student) ----------

app.get('/api/challenges', (req, res) => {
  const counts = registrantCounts();
  let rows = publishedChallenges();
  if (['mini', 'project'].includes(req.query.format)) rows = rows.filter((c) => c.format === req.query.format);
  res.json({ challenges: rows.map((c) => ({ ...c, registrants: counts[c.id] || 0 })) });
});

app.get('/api/challenges/recommended', requireRole('student'), (req, res) => {
  const profile = getProfile(req.user.id);
  if (!profile) return res.json({ challenges: [], needsProfile: true });
  const counts = registrantCounts();
  const joined = new Set(db.prepare('SELECT challenge_id FROM registrations WHERE user_id = ?').all(req.user.id).map((r) => r.challenge_id));
  let rows = publishedChallenges().filter((c) => !joined.has(c.id) && !c.teams_formed);
  if (['mini', 'project'].includes(req.query.format)) rows = rows.filter((c) => c.format === req.query.format);
  res.json({ challenges: recommend(profile, rows, counts).map((c) => ({ ...c, registrants: counts[c.id] || 0 })) });
});

app.get('/api/challenges/:id', (req, res) => {
  const c = getChallenge(Number(req.params.id));
  const owner = req.user && (req.user.role === 'admin' || req.user.id === c?.company_id);
  if (!c || (c.status !== 'published' && !owner)) return bad(res, 'Challenge not found.', 404);
  const counts = registrantCounts();
  const out = { ...c, registrants: counts[c.id] || 0 };
  if (req.user?.role === 'student') {
    out.joined = Boolean(db.prepare('SELECT 1 FROM registrations WHERE challenge_id = ? AND user_id = ?').get(c.id, req.user.id));
    out.myTeam = studentTeamView(c.id, req.user.id);
  }
  res.json({ challenge: out });
});

app.post('/api/challenges/:id/join', requireRole('student'), (req, res) => {
  const c = getChallenge(Number(req.params.id));
  if (!c || c.status !== 'published') return bad(res, 'Challenge not found.', 404);
  if (c.teams_formed) return bad(res, 'Teams for this challenge are already set.');
  if (!getProfile(req.user.id)) return bad(res, 'Finish your profile first.');
  db.prepare('INSERT OR IGNORE INTO registrations (challenge_id, user_id, note) VALUES (?, ?, ?)')
    .run(c.id, req.user.id, String(req.body?.note || '').slice(0, 280) || null);
  res.json({ ok: true });
});

app.delete('/api/challenges/:id/join', requireRole('student'), (req, res) => {
  const c = getChallenge(Number(req.params.id));
  if (!c) return bad(res, 'Challenge not found.', 404);
  if (c.teams_formed) return bad(res, 'Teams are set; message your team instead of leaving.');
  db.prepare('DELETE FROM registrations WHERE challenge_id = ? AND user_id = ?').run(c.id, req.user.id);
  res.json({ ok: true });
});

app.get('/api/my/challenges', requireRole('student'), (req, res) => {
  const rows = db.prepare(`SELECT c.*, u.name AS company_name FROM registrations r
                           JOIN challenges c ON c.id = r.challenge_id JOIN users u ON u.id = c.company_id
                           WHERE r.user_id = ? ORDER BY r.created_at DESC`).all(req.user.id).map(parseChallenge);
  res.json({ challenges: rows.map((c) => ({ ...c, myTeam: studentTeamView(c.id, req.user.id) })) });
});

// ---------- company survey ----------

app.post('/api/company/challenges', requireRole('company'), (req, res) => {
  const b = req.body || {};
  if (!b.title || !b.summary) return bad(res, 'Title and a one-line summary are required.');
  if (!['mini', 'project'].includes(b.format)) return bad(res, 'Pick mini challenge or project.');
  if (!['individual', 'team'].includes(b.mode)) return bad(res, 'Pick individual or team.');
  const skills = list(b.skills).filter((s) => SKILLS.includes(s));
  const tags = list(b.tags).filter((t) => INTERESTS.includes(t));
  const teamSize = b.mode === 'team' ? Math.max(2, Math.min(8, Number(b.team_size) || 4)) : 1;
  const { lastInsertRowid } = db.prepare(`INSERT INTO challenges
      (company_id, title, summary, description, format, mode, team_size, duration_label, hours_per_week,
       skills, tags, mentor_name, mentor_title, deliverable)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(req.user.id, b.title, b.summary, b.description || '', b.format, b.mode, teamSize,
      b.duration_label || (b.format === 'mini' ? '1 day' : '6 weeks'), Math.max(1, Number(b.hours_per_week) || 3),
      JSON.stringify(skills), JSON.stringify(tags), b.mentor_name || null, b.mentor_title || null, b.deliverable || null);
  res.status(201).json({ challenge: getChallenge(Number(lastInsertRowid)) });
});

app.get('/api/company/challenges', requireRole('company'), (req, res) => {
  const counts = registrantCounts();
  const rows = db.prepare('SELECT * FROM challenges WHERE company_id = ? ORDER BY id DESC').all(req.user.id).map(parseChallenge);
  res.json({ challenges: rows.map((c) => ({ ...c, registrants: counts[c.id] || 0 })) });
});

// ---------- admin: publish + team sorting ----------

app.get('/api/admin/challenges', requireRole('admin'), (_req, res) => {
  const counts = registrantCounts();
  const rows = db.prepare(`SELECT c.*, u.name AS company_name FROM challenges c JOIN users u ON u.id = c.company_id
                           ORDER BY c.status = 'pending' DESC, c.id DESC`).all().map(parseChallenge);
  res.json({ challenges: rows.map((c) => ({ ...c, registrants: counts[c.id] || 0 })) });
});

app.post('/api/admin/challenges/:id/publish', requireRole('admin'), (req, res) => {
  const r = db.prepare("UPDATE challenges SET status = 'published' WHERE id = ? AND status = 'pending'").run(Number(req.params.id));
  if (!r.changes) return bad(res, 'Nothing to publish.');
  res.json({ ok: true });
});

const TEAM_NAMES = ['Arc', 'Beacon', 'Circuit', 'Delta', 'Ember', 'Flux', 'Grid', 'Harbor', 'Ion', 'Juniper', 'Kite', 'Lumen'];

app.post('/api/admin/challenges/:id/form-teams', requireRole('admin'), (req, res) => {
  const c = getChallenge(Number(req.params.id));
  if (!c || c.mode !== 'team') return bad(res, 'Only team challenges can be sorted.');
  const students = db.prepare(`SELECT u.id, u.name, p.major, p.preferred_role, p.skills FROM registrations r
                               JOIN users u ON u.id = r.user_id JOIN profiles p ON p.user_id = u.id
                               WHERE r.challenge_id = ?`).all(c.id).map((s) => ({ ...s, skills: JSON.parse(s.skills) }));
  if (students.length < 2) return bad(res, 'Need at least 2 registrants to form teams.');
  const result = formTeams(students, c);

  db.exec('BEGIN');
  try {
    db.prepare('DELETE FROM teams WHERE challenge_id = ?').run(c.id);
    const insTeam = db.prepare('INSERT INTO teams (challenge_id, name, metrics) VALUES (?, ?, ?)');
    const insMember = db.prepare('INSERT INTO team_members (team_id, user_id) VALUES (?, ?)');
    result.teams.forEach((t, i) => {
      const { lastInsertRowid } = insTeam.run(c.id, `Team ${TEAM_NAMES[i % TEAM_NAMES.length]}`, JSON.stringify(t.metrics));
      t.memberIds.forEach((uid) => insMember.run(Number(lastInsertRowid), uid));
    });
    db.prepare('UPDATE challenges SET teams_formed = 1 WHERE id = ?').run(c.id);
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  res.json({ ok: true, cost: result.cost, teams: result.teams.length });
});

// Full team view with metrics: admin, or the company that posted the challenge.
app.get('/api/challenges/:id/teams', requireRole('admin', 'company'), (req, res) => {
  const c = getChallenge(Number(req.params.id));
  if (!c || (req.user.role === 'company' && c.company_id !== req.user.id)) return bad(res, 'Challenge not found.', 404);
  const teams = db.prepare('SELECT * FROM teams WHERE challenge_id = ? ORDER BY id').all(c.id).map((t) => ({
    id: t.id,
    name: t.name,
    metrics: JSON.parse(t.metrics),
    members: db.prepare(`SELECT u.name, p.major, p.preferred_role, p.skills FROM team_members m
                         JOIN users u ON u.id = m.user_id LEFT JOIN profiles p ON p.user_id = u.id
                         WHERE m.team_id = ? ORDER BY u.name`).all(t.id).map((m) => ({ ...m, skills: JSON.parse(m.skills || '{}') })),
  }));
  res.json({ challenge: c, teams });
});

app.use('/api', (_req, res) => bad(res, 'Not found.', 404));
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong.' });
});
