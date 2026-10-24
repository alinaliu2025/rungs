import { db, parseChallenge } from './db.js';
import { phase } from './time.js';
import { assignTeams } from './lifecycle.js';

// Demo controls: fast-forward one challenge through its whole life so the
// full flow (sign-ups -> teams -> work -> submissions -> judging -> winners)
// can be shown in a few minutes. Only on when the server runs with
// RUNGS_DEMO=1 (npm run dev sets it). Never enable in production.

export const demoEnabled = () => process.env.RUNGS_DEMO === '1';
const bad = (res, msg, code = 400) => res.status(code).json({ error: msg });
const getChallenge = (id) => parseChallenge(db.prepare('SELECT * FROM challenges WHERE id = ?').get(id));
const now = () => new Date().toISOString();

const IDEAS = [
  ['Signal', 'Turns the raw data into a three-screen story with one clear recommendation.'],
  ['Northstar', 'A lightweight prototype plus a short write-up of what we tested and learned.'],
  ['Relay', 'Interactive map, cleaned dataset and a five-slide pitch.'],
  ['Groundwork', 'Focused on the riskiest assumption first; includes user quotes.'],
  ['Brightline', 'Working demo with a README that explains how to run it.'],
  ['Keystone', 'Simple, well-documented baseline we would ship first.'],
];
const FEEDBACK = [
  'Clear problem framing and a demo that works. Push further on the "so what".',
  'Strong execution. The write-up could explain trade-offs more.',
  'Great presentation. The prototype needs more testing with real users.',
  'Solid start; the scope was a bit too broad for the time.',
];

export function registerDemoRoutes(app) {
  app.use('/api/demo', (req, res, next) => (demoEnabled() ? next() : bad(res, 'Not found.', 404)));

  // Sign up seeded students who have a profile and aren't in yet.
  app.post('/api/demo/challenges/:id/fill', (req, res) => {
    const c = getChallenge(Number(req.params.id));
    if (!c || phase(c) !== 'open') return bad(res, 'Only open challenges can take sign-ups.');
    const taken = db.prepare('SELECT COUNT(*) AS n FROM registrations WHERE challenge_id = ?').get(c.id).n;
    const room = c.max_participants ? Math.max(0, c.max_participants - taken) : Infinity;
    const count = Math.min(room, Math.max(1, Math.min(30, Number(req.body?.count) || 8)));
    const ids = db.prepare(`SELECT p.user_id FROM profiles p WHERE p.user_id NOT IN
                              (SELECT user_id FROM registrations WHERE challenge_id = ?)
                            ORDER BY p.user_id LIMIT ?`).all(c.id, count === Infinity ? 30 : count).map((r) => r.user_id);
    const ins = db.prepare('INSERT INTO registrations (challenge_id, user_id, note) VALUES (?, ?, ?)');
    ids.forEach((id) => ins.run(c.id, id, 'Demo sign-up'));
    res.json({ added: ids.length });
  });

  // Move to the next stage by pulling that stage's date to now.
  app.post('/api/demo/challenges/:id/advance', (req, res) => {
    const c = getChallenge(Number(req.params.id));
    if (!c) return bad(res, 'Challenge not found.', 404);
    const p = phase(c);
    if (p === 'pending') {
      db.prepare("UPDATE challenges SET status = 'published', reviewed_at = ?, review_note = 'Approved (demo)' WHERE id = ?").run(now(), c.id);
    } else if (p === 'open') {
      db.prepare('UPDATE challenges SET signup_deadline = ? WHERE id = ?').run(now(), c.id);
      if (c.mode === 'team') assignTeams(c.id);
    } else if (p === 'locked') {
      db.prepare('UPDATE challenges SET starts_at = ? WHERE id = ?').run(now(), c.id);
    } else if (p === 'live') {
      db.prepare('UPDATE challenges SET ends_at = ? WHERE id = ?').run(now(), c.id);
    } else {
      return bad(res, 'Nothing to fast-forward: grade the submissions and publish winners.');
    }
    res.json({ phase: phase(getChallenge(c.id)) });
  });

  // Fill in submissions for every team (or solo student) that hasn't submitted.
  app.post('/api/demo/challenges/:id/sample-submissions', (req, res) => {
    const c = getChallenge(Number(req.params.id));
    if (!c || phase(c) !== 'live') return bad(res, 'Submissions are only open while the challenge is live.');
    const owners = c.mode === 'team'
      ? db.prepare(`SELECT t.id AS team_id, t.name, (SELECT user_id FROM team_members WHERE team_id = t.id LIMIT 1) AS user_id
                    FROM teams t WHERE t.challenge_id = ?`).all(c.id).map((t) => ({ ...t, key: `t:${t.team_id}` }))
      : db.prepare(`SELECT r.user_id, u.name FROM registrations r JOIN users u ON u.id = r.user_id WHERE r.challenge_id = ?`)
        .all(c.id).map((r) => ({ ...r, team_id: null, key: `u:${r.user_id}` }));
    const slug = c.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30);
    const ins = db.prepare(`INSERT OR IGNORE INTO submissions (challenge_id, team_id, user_id, owner_key, title, summary, repo_url, demo_url)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
    let added = 0;
    owners.forEach((o, i) => {
      const [name, summary] = IDEAS[i % IDEAS.length];
      const handle = o.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      added += ins.run(c.id, o.team_id, o.user_id, o.key, name, summary,
        `https://github.com/rungs-demo/${slug}-${handle}`, i % 2 ? null : `https://rungs-demo.example/${slug}/${handle}`).changes;
    });
    res.json({ added });
  });

  // Score anything not yet graded, so judging can be shown quickly.
  app.post('/api/demo/challenges/:id/sample-grades', (req, res) => {
    const c = getChallenge(Number(req.params.id));
    if (!c || phase(c) !== 'ended' || c.results_published_at) return bad(res, 'Grading is only open after the challenge ends.');
    const subs = db.prepare('SELECT id FROM submissions WHERE challenge_id = ? AND graded_at IS NULL ORDER BY id').all(c.id);
    const upd = db.prepare(`UPDATE submissions SET score_impact = ?, score_execution = ?, score_presentation = ?, feedback = ?, graded_at = ?
                            WHERE id = ?`);
    subs.forEach((s, i) => upd.run(2 + ((i + 1) % 3), 2 + ((i + 2) % 4), 3 + (i % 3), FEEDBACK[i % FEEDBACK.length], now(), s.id));
    res.json({ graded: subs.length });
  });
}
