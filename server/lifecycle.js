import { db, parseChallenge } from './db.js';
import { formTeams } from './teams.js';

const TEAM_NAMES = ['Arc', 'Beacon', 'Circuit', 'Delta', 'Ember', 'Flux', 'Grid', 'Harbor', 'Ion', 'Juniper', 'Kite', 'Lumen'];

// Runs team sorting for one challenge and stores the result.
// Returns null when there are too few registrants to form a team.
export function assignTeams(challengeId) {
  const c = parseChallenge(db.prepare('SELECT * FROM challenges WHERE id = ?').get(challengeId));
  if (!c || c.mode !== 'team') throw new Error('Only team challenges can be sorted.');
  const students = db.prepare(`SELECT u.id, u.name, p.major, p.preferred_role, p.skills FROM registrations r
                               JOIN users u ON u.id = r.user_id JOIN profiles p ON p.user_id = u.id
                               WHERE r.challenge_id = ?`).all(c.id).map((s) => ({ ...s, skills: JSON.parse(s.skills) }));
  if (students.length < 2) return null;
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
  return result;
}

// Sign-ups close on their own at the deadline: every published team challenge
// whose deadline has passed gets its teams formed. Safe to call repeatedly.
export function runDueJobs(now = new Date()) {
  const due = db.prepare(`SELECT id, title FROM challenges
                          WHERE status = 'published' AND mode = 'team' AND teams_formed = 0
                            AND signup_deadline <= ?`).all(now.toISOString());
  const formed = [];
  for (const c of due) {
    if (assignTeams(c.id)) formed.push(c.id);
  }
  if (formed.length) console.log(`Auto-formed teams for challenge(s) ${formed.join(', ')}`);
  return formed;
}

export function startScheduler(intervalMs = 60_000) {
  runDueJobs();
  return setInterval(() => runDueJobs(), intervalMs).unref();
}
