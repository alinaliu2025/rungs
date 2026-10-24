import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dbPath = process.env.DB_PATH || path.join(root, 'data', 'rungs.db');
if (dbPath !== ':memory:') fs.mkdirSync(path.dirname(dbPath), { recursive: true });

export const db = new DatabaseSync(dbPath);

// Demo-stage migration: if the schema predates a column we rely on, start
// fresh (the local DB only holds seed data). Swap for real migrations later.
const columns = (table) => db.prepare(`SELECT name FROM pragma_table_info('${table}')`).all().map((c) => c.name);
const stale = columns('challenges').length
  && (!columns('challenges').includes('company_name') || !columns('profiles').includes('grad_year'));
if (stale) {
  console.log('Schema changed: resetting the local demo database.');
  db.exec(`DROP TABLE IF EXISTS team_members; DROP TABLE IF EXISTS teams; DROP TABLE IF EXISTS registrations;
           DROP TABLE IF EXISTS challenges; DROP TABLE IF EXISTS sessions; DROP TABLE IF EXISTS profiles;
           DROP TABLE IF EXISTS users;`);
}

db.exec(`
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY,
    email         TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL CHECK (role IN ('student', 'company')),
    name          TEXT NOT NULL,
    created_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token      TEXT PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS profiles (
    user_id        INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    major          TEXT,
    grad_year      INTEGER,          -- expected graduation year, e.g. 2028
    bio            TEXT,
    hours_per_week INTEGER NOT NULL DEFAULT 0,
    preferred_role TEXT,
    skills         TEXT NOT NULL DEFAULT '{}',  -- {"python": 3, "sql": 1}
    interests      TEXT NOT NULL DEFAULT '[]'   -- ["mobility", "ai"]
  );

  CREATE TABLE IF NOT EXISTS challenges (
    id             INTEGER PRIMARY KEY,
    company_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,  -- null when posted without an account
    company_name   TEXT NOT NULL,
    title          TEXT NOT NULL,
    summary        TEXT NOT NULL,
    description    TEXT NOT NULL DEFAULT '',
    format         TEXT NOT NULL CHECK (format IN ('mini', 'project')),
    mode           TEXT NOT NULL CHECK (mode IN ('individual', 'team')),
    team_size      INTEGER NOT NULL DEFAULT 1,
    duration_label TEXT NOT NULL,
    hours_per_week INTEGER NOT NULL,
    signup_deadline  TEXT NOT NULL,  -- UTC ISO; sign-ups close and teams form here
    starts_at        TEXT NOT NULL,  -- UTC ISO
    ends_at          TEXT NOT NULL,  -- UTC ISO
    timezone         TEXT NOT NULL DEFAULT 'America/New_York',
    max_participants INTEGER,        -- null = no cap
    skills         TEXT NOT NULL DEFAULT '[]',
    tags           TEXT NOT NULL DEFAULT '[]',
    mentor_name    TEXT,
    mentor_title   TEXT,
    deliverable    TEXT,
    -- Posts go live immediately for now; 'pending' is kept for future moderation.
    status         TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('pending', 'published', 'closed')),
    teams_formed   INTEGER NOT NULL DEFAULT 0,
    created_at     TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS registrations (
    challenge_id INTEGER NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
    user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    note         TEXT,
    created_at   TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (challenge_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS teams (
    id           INTEGER PRIMARY KEY,
    challenge_id INTEGER NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
    name         TEXT NOT NULL,
    metrics      TEXT NOT NULL DEFAULT '{}'  -- internal only, never sent to students
  );

  CREATE TABLE IF NOT EXISTS team_members (
    team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (team_id, user_id)
  );
`);

export function parseProfile(row) {
  if (!row) return null;
  return { ...row, skills: JSON.parse(row.skills), interests: JSON.parse(row.interests) };
}

export function parseChallenge(row) {
  if (!row) return null;
  return {
    ...row,
    skills: JSON.parse(row.skills),
    tags: JSON.parse(row.tags),
    teams_formed: Boolean(row.teams_formed),
  };
}
