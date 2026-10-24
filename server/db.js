import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dbPath = process.env.DB_PATH || path.join(root, 'data', 'rungs.db');
if (dbPath !== ':memory:') fs.mkdirSync(path.dirname(dbPath), { recursive: true });

export const db = new DatabaseSync(dbPath);

db.exec(`
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY,
    email         TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL CHECK (role IN ('student', 'company', 'admin')),
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
    year           TEXT,
    bio            TEXT,
    hours_per_week INTEGER NOT NULL DEFAULT 0,
    preferred_role TEXT,
    skills         TEXT NOT NULL DEFAULT '{}',  -- {"python": 3, "sql": 1}
    interests      TEXT NOT NULL DEFAULT '[]'   -- ["mobility", "ai"]
  );

  CREATE TABLE IF NOT EXISTS challenges (
    id             INTEGER PRIMARY KEY,
    company_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title          TEXT NOT NULL,
    summary        TEXT NOT NULL,
    description    TEXT NOT NULL DEFAULT '',
    format         TEXT NOT NULL CHECK (format IN ('mini', 'project')),
    mode           TEXT NOT NULL CHECK (mode IN ('individual', 'team')),
    team_size      INTEGER NOT NULL DEFAULT 1,
    duration_label TEXT NOT NULL,
    hours_per_week INTEGER NOT NULL,
    skills         TEXT NOT NULL DEFAULT '[]',
    tags           TEXT NOT NULL DEFAULT '[]',
    mentor_name    TEXT,
    mentor_title   TEXT,
    deliverable    TEXT,
    status         TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'published', 'closed')),
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
