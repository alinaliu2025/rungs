import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, parseChallenge, parseProfile } from './db.js';
import { hashPassword, verifyPassword, startSession, endSession, loadUser, requireRole } from './auth.js';
import { SKILLS, INTERESTS, ROLES } from './catalog.js';
import { recommend } from './matching.js';
import { assignTeams } from './lifecycle.js';
import { phase, overlaps, zonedToUtc, durationLabel, isValidTimeZone, TIME_ZONES, DEFAULT_TZ } from './time.js';

// The React client is built into dist/ by `npm run build` (Vite).
const distDir = path.join(path.dirname(path.dirname(fileURLToPath(import.meta.url))), 'dist');

export const app = express();
app.use(express.json());
app.use(loadUser);
app.use(express.static(distDir));

const bad = (res, msg, code = 400) => res.status(code).json({ error: msg });
const list = (v) => (Array.isArray(v) ? v : []);

function registrantCounts() {
  const rows = db.prepare('SELECT challenge_id, COUNT(*) AS n FROM registrations GROUP BY challenge_id').all();
  return Object.fromEntries(rows.map((r) => [r.challenge_id, r.n]));
}

// Adds derived fields every challenge response carries.
function decorate(c, counts) {
  const registrants = counts[c.id] || 0;
  return {
    ...c,
    registrants,
    phase: phase(c),
    full: c.max_participants != null && registrants >= c.max_participants,
  };
}

function publishedChallenges() {
  return db.prepare("SELECT * FROM challenges WHERE status = 'published' ORDER BY starts_at").all().map(parseChallenge);
}

function getChallenge(id) {
  return parseChallenge(db.prepare('SELECT * FROM challenges WHERE id = ?').get(id));
}

function getProfile(userId) {
  return parseProfile(db.prepare('SELECT * FROM profiles WHERE user_id = ?').get(userId));
}

const isOwner = (user, c) => user?.role === 'company' && c?.company_id === user.id;

// Team as a student sees it: names and majors only, no scores.
function studentTeamView(challengeId, userId) {
  const team = db.prepare(`SELECT t.id, t.name FROM teams t JOIN team_members m ON m.team_id = t.id
                           WHERE t.challenge_id = ? AND m.user_id = ?`).get(challengeId, userId);
  if (!team) return null;
  const members = db.prepare(`SELECT u.name, p.major, p.grad_year, p.preferred_role FROM team_members m
                              JOIN users u ON u.id = m.user_id LEFT JOIN profiles p ON p.user_id = u.id
                              WHERE m.team_id = ? ORDER BY u.name`).all(team.id);
  return { name: team.name, members };
}

// ---------- meta + auth ----------

app.get('/api/meta', (_req, res) => res.json({ skills: SKILLS, interests: INTERESTS, roles: ROLES, timezones: TIME_ZONES }));

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
  const thisYear = new Date().getFullYear();
  const gradYear = Number(b.grad_year);
  if (b.grad_year && !(Number.isInteger(gradYear) && gradYear >= thisYear && gradYear <= thisYear + 8)) {
    return bad(res, `Graduation year should be between ${thisYear} and ${thisYear + 8}.`);
  }
  db.prepare(`INSERT INTO profiles (user_id, major, grad_year, bio, hours_per_week, preferred_role, skills, interests)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(user_id) DO UPDATE SET major = excluded.major, grad_year = excluded.grad_year, bio = excluded.bio,
                hours_per_week = excluded.hours_per_week, preferred_role = excluded.preferred_role,
                skills = excluded.skills, interests = excluded.interests`)
    .run(req.user.id, b.major || null, b.grad_year ? gradYear : null, b.bio || null, hours, role, JSON.stringify(skills), JSON.stringify(interests));
  res.json({ profile: getProfile(req.user.id) });
});

// ---------- challenges (public + student) ----------

app.get('/api/challenges', (req, res) => {
  const counts = registrantCounts();
  let rows = publishedChallenges();
  if (['mini', 'project'].includes(req.query.format)) rows = rows.filter((c) => c.format === req.query.format);
  res.json({ challenges: rows.map((c) => decorate(c, counts)) });
});

app.get('/api/challenges/recommended', requireRole('student'), (req, res) => {
  const profile = getProfile(req.user.id);
  if (!profile) return res.json({ challenges: [], needsProfile: true });
  const counts = registrantCounts();
  const joined = new Set(db.prepare('SELECT challenge_id FROM registrations WHERE user_id = ?').all(req.user.id).map((r) => r.challenge_id));
  let rows = publishedChallenges().map((c) => decorate(c, counts))
    .filter((c) => !joined.has(c.id) && c.phase === 'open' && !c.full);
  if (['mini', 'project'].includes(req.query.format)) rows = rows.filter((c) => c.format === req.query.format);
  res.json({ challenges: recommend(profile, rows, counts) });
});

app.get('/api/challenges/:id', (req, res) => {
  const c = getChallenge(Number(req.params.id));
  if (!c || (c.status !== 'published' && !isOwner(req.user, c))) return bad(res, 'Challenge not found.', 404);
  const out = { ...decorate(c, registrantCounts()), isOwner: isOwner(req.user, c) };
  if (req.user?.role === 'student') {
    out.joined = Boolean(db.prepare('SELECT 1 FROM registrations WHERE challenge_id = ? AND user_id = ?').get(c.id, req.user.id));
    out.myTeam = studentTeamView(c.id, req.user.id);
  }
  res.json({ challenge: out });
});

app.post('/api/challenges/:id/join', requireRole('student'), (req, res) => {
  const c = getChallenge(Number(req.params.id));
  if (!c || c.status !== 'published') return bad(res, 'Challenge not found.', 404);
  if (phase(c) !== 'open' || c.teams_formed) return bad(res, 'Sign-ups for this challenge are closed.');
  if (!getProfile(req.user.id)) return bad(res, 'Finish your profile first.');
  if (decorate(c, registrantCounts()).full) return bad(res, 'This challenge is full.');
  // Mini challenges are live events, so two can't overlap in time.
  if (c.format === 'mini') {
    const mine = db.prepare(`SELECT c.* FROM registrations r JOIN challenges c ON c.id = r.challenge_id
                             WHERE r.user_id = ? AND c.format = 'mini' AND c.id != ?`).all(req.user.id, c.id);
    const clash = mine.find((other) => overlaps(other, c));
    if (clash) return bad(res, `This overlaps with "${clash.title}", which you already joined.`);
  }
  db.prepare('INSERT OR IGNORE INTO registrations (challenge_id, user_id, note) VALUES (?, ?, ?)')
    .run(c.id, req.user.id, String(req.body?.note || '').slice(0, 280) || null);
  res.json({ ok: true });
});

app.delete('/api/challenges/:id/join', requireRole('student'), (req, res) => {
  const c = getChallenge(Number(req.params.id));
  if (!c) return bad(res, 'Challenge not found.', 404);
  if (c.teams_formed || phase(c) !== 'open') return bad(res, 'Sign-ups are closed; message your team instead of leaving.');
  db.prepare('DELETE FROM registrations WHERE challenge_id = ? AND user_id = ?').run(c.id, req.user.id);
  res.json({ ok: true });
});

app.get('/api/my/challenges', requireRole('student'), (req, res) => {
  const rows = db.prepare(`SELECT c.* FROM registrations r JOIN challenges c ON c.id = r.challenge_id
                           WHERE r.user_id = ? ORDER BY r.created_at DESC`).all(req.user.id).map(parseChallenge);
  const counts = registrantCounts();
  res.json({ challenges: rows.map((c) => ({ ...decorate(c, counts), myTeam: studentTeamView(c.id, req.user.id) })) });
});

// ---------- company survey ----------

// Open pipeline for now: anyone can post, no login or admin review, and the
// challenge goes live right away. A logged-in company account owns its posts
// (can see teams); otherwise we only keep the company name.
app.post('/api/challenges', (req, res) => {
  const b = req.body || {};
  const company = req.user?.role === 'company' ? req.user : null;
  const companyName = company ? company.name : String(b.company_name || '').trim();
  if (!companyName) return bad(res, 'Company name is required.');
  if (!b.title || !b.summary) return bad(res, 'Title and a one-line summary are required.');
  if (!['mini', 'project'].includes(b.format)) return bad(res, 'Pick mini challenge or project.');
  if (!['individual', 'team'].includes(b.mode)) return bad(res, 'Pick individual or team.');
  const skills = list(b.skills).filter((s) => SKILLS.includes(s));
  const tags = list(b.tags).filter((t) => INTERESTS.includes(t));
  const teamSize = b.mode === 'team' ? Math.max(2, Math.min(8, Number(b.team_size) || 4)) : 1;

  const tz = isValidTimeZone(b.timezone) ? b.timezone : DEFAULT_TZ;
  const deadline = zonedToUtc(b.signup_deadline, tz);
  const starts = zonedToUtc(b.starts_at, tz);
  const ends = zonedToUtc(b.ends_at, tz);
  if (!deadline || !starts || !ends) return bad(res, 'Sign-up deadline, start and end times are all required.');
  if (Date.parse(deadline) <= Date.now()) return bad(res, 'The sign-up deadline must be in the future.');
  if (Date.parse(starts) < Date.parse(deadline)) return bad(res, 'The challenge must start after sign-ups close.');
  if (Date.parse(ends) <= Date.parse(starts)) return bad(res, 'The end time must be after the start time.');
  const cap = Number(b.max_participants) > 0 ? Math.floor(Number(b.max_participants)) : null;

  const { lastInsertRowid } = db.prepare(`INSERT INTO challenges
      (company_id, company_name, title, summary, description, format, mode, team_size, duration_label, hours_per_week,
       skills, tags, mentor_name, mentor_title, deliverable, signup_deadline, starts_at, ends_at, timezone, max_participants)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(company?.id ?? null, companyName.slice(0, 120), b.title, b.summary, b.description || '', b.format, b.mode, teamSize,
      durationLabel(starts, ends), Math.max(1, Number(b.hours_per_week) || 3),
      JSON.stringify(skills), JSON.stringify(tags), b.mentor_name || null, b.mentor_title || null, b.deliverable || null,
      deadline, starts, ends, tz, cap);
  res.status(201).json({ challenge: decorate(getChallenge(Number(lastInsertRowid)), {}) });
});

app.get('/api/company/challenges', requireRole('company'), (req, res) => {
  const counts = registrantCounts();
  const rows = db.prepare('SELECT * FROM challenges WHERE company_id = ? ORDER BY id DESC').all(req.user.id).map(parseChallenge);
  res.json({ challenges: rows.map((c) => decorate(c, counts)) });
});

// Teams normally form on their own at the sign-up deadline (see lifecycle.js).
// The posting company can close sign-ups early, or re-sort after dropouts.
app.post('/api/company/challenges/:id/form-teams', requireRole('company'), (req, res) => {
  const c = getChallenge(Number(req.params.id));
  if (!c || !isOwner(req.user, c)) return bad(res, 'Challenge not found.', 404);
  if (c.mode !== 'team') return bad(res, 'Only team challenges can be sorted.');
  if (!['open', 'locked'].includes(phase(c))) return bad(res, 'This challenge has already started.');
  if ((registrantCounts()[c.id] || 0) < 2) return bad(res, 'Need at least 2 registrants to form teams.');
  if (phase(c) === 'open') {
    db.prepare('UPDATE challenges SET signup_deadline = ? WHERE id = ?').run(new Date().toISOString(), c.id);
  }
  const result = assignTeams(c.id);
  res.json({ ok: true, cost: result.cost, teams: result.teams.length });
});

// Full team view with metrics: only the company account that posted the challenge.
app.get('/api/challenges/:id/teams', requireRole('company'), (req, res) => {
  const c = getChallenge(Number(req.params.id));
  if (!c || !isOwner(req.user, c)) return bad(res, 'Challenge not found.', 404);
  const teams = db.prepare('SELECT * FROM teams WHERE challenge_id = ? ORDER BY id').all(c.id).map((t) => ({
    id: t.id,
    name: t.name,
    metrics: JSON.parse(t.metrics),
    members: db.prepare(`SELECT u.name, p.major, p.grad_year, p.preferred_role, p.skills FROM team_members m
                         JOIN users u ON u.id = m.user_id LEFT JOIN profiles p ON p.user_id = u.id
                         WHERE m.team_id = ? ORDER BY u.name`).all(t.id).map((m) => ({ ...m, skills: JSON.parse(m.skills || '{}') })),
  }));
  res.json({ challenge: c, teams });
});

app.use('/api', (_req, res) => bad(res, 'Not found.', 404));
app.use((req, res, next) => {
  if (req.method !== 'GET') return next();
  res.sendFile(path.join(distDir, 'index.html'), (err) => {
    if (err) res.status(503).send('Client not built yet. Run `npm run build` (or `npm run dev` for development).');
  });
});
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong.' });
});
