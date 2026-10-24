import { db, parseChallenge } from './db.js';
import { requireRole } from './auth.js';
import { phase } from './time.js';

// Submissions, grading and winners.
//
//   live:   students (or their team) submit a link to their work: GitHub repo
//           required, demo/slides optional. They can update it until the end.
//   ended:  the posting company (or a reviewer) scores each submission 1-5 on
//           impact, execution and presentation, and leaves feedback.
//   then:   they pick up to three winners and publish results. Winners show
//           on the public challenge page; every student sees their feedback.

const bad = (res, msg, code = 400) => res.status(code).json({ error: msg });
const getChallenge = (id) => parseChallenge(db.prepare('SELECT * FROM challenges WHERE id = ?').get(id));
export const canJudge = (user, c) => user?.role === 'reviewer' || (user?.role === 'company' && c?.company_id === user.id);
export const total = (s) => (s.graded_at ? s.score_impact + s.score_execution + s.score_presentation : null);

function cleanUrl(value, required) {
  const v = String(value ?? '').trim();
  if (!v) return required ? { error: 'Add a link to your work (GitHub repo or similar).' } : { url: null };
  try {
    const u = new URL(v);
    if (!['http:', 'https:'].includes(u.protocol)) throw new Error();
    return { url: u.toString() };
  } catch {
    return { error: `"${v}" isn't a valid http(s) link.` };
  }
}

// Which team/student a submission belongs to for this user, or an error.
export function ownerFor(c, userId) {
  if (!db.prepare('SELECT 1 FROM registrations WHERE challenge_id = ? AND user_id = ?').get(c.id, userId)) {
    return { error: "You're not signed up for this challenge." };
  }
  if (c.mode === 'individual') return { key: `u:${userId}`, teamId: null };
  const team = db.prepare(`SELECT t.id FROM teams t JOIN team_members m ON m.team_id = t.id
                           WHERE t.challenge_id = ? AND m.user_id = ?`).get(c.id, userId);
  if (!team) return { error: "You're not on a team for this challenge." };
  return { key: `t:${team.id}`, teamId: team.id };
}

function membersOf(s) {
  if (s.team_id) {
    return db.prepare(`SELECT u.name FROM team_members m JOIN users u ON u.id = m.user_id
                       WHERE m.team_id = ? ORDER BY u.name`).all(s.team_id).map((m) => m.name);
  }
  return [db.prepare('SELECT name FROM users WHERE id = ?').get(s.user_id)?.name].filter(Boolean);
}
const teamName = (s) => (s.team_id ? db.prepare('SELECT name FROM teams WHERE id = ?').get(s.team_id)?.name : null);

// What a student sees of their own submission. Scores and feedback appear
// only once results are published.
export function studentSubmissionView(c, userId) {
  const owner = ownerFor(c, userId);
  if (owner.error) return null;
  const s = db.prepare('SELECT * FROM submissions WHERE challenge_id = ? AND owner_key = ?').get(c.id, owner.key);
  if (!s) return null;
  const published = Boolean(c.results_published_at);
  return {
    id: s.id, title: s.title, summary: s.summary, repo_url: s.repo_url, demo_url: s.demo_url, submitted_at: s.submitted_at,
    ...(published && {
      scores: s.graded_at ? { impact: s.score_impact, execution: s.score_execution, presentation: s.score_presentation, total: total(s) } : null,
      feedback: s.feedback, place: s.place,
    }),
  };
}

// Public winners list, once published.
export function publicResults(c) {
  if (!c.results_published_at) return null;
  const winners = db.prepare('SELECT * FROM submissions WHERE challenge_id = ? AND place IS NOT NULL ORDER BY place').all(c.id);
  const count = db.prepare('SELECT COUNT(*) AS n FROM submissions WHERE challenge_id = ?').get(c.id).n;
  return {
    published_at: c.results_published_at,
    submissions: count,
    winners: winners.map((s) => ({
      place: s.place, title: s.title, summary: s.summary, repo_url: s.repo_url, demo_url: s.demo_url,
      team_name: teamName(s), members: membersOf(s), total: total(s),
    })),
  };
}

export function registerSubmissionRoutes(app) {
  app.put('/api/challenges/:id/submission', requireRole('student'), (req, res) => {
    const c = getChallenge(Number(req.params.id));
    if (!c || c.status !== 'published') return bad(res, 'Challenge not found.', 404);
    if (phase(c) !== 'live') return bad(res, phase(c) === 'ended' ? 'Submissions are closed.' : 'Submissions open when the challenge starts.');
    const owner = ownerFor(c, req.user.id);
    if (owner.error) return bad(res, owner.error);
    const b = req.body || {};
    const title = String(b.title ?? '').trim().slice(0, 120);
    if (!title) return bad(res, 'Give your project a name.');
    const repo = cleanUrl(b.repo_url, true);
    if (repo.error) return bad(res, repo.error);
    const demo = cleanUrl(b.demo_url, false);
    if (demo.error) return bad(res, demo.error);
    db.prepare(`INSERT INTO submissions (challenge_id, team_id, user_id, owner_key, title, summary, repo_url, demo_url, submitted_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(challenge_id, owner_key) DO UPDATE SET user_id = excluded.user_id, title = excluded.title,
                  summary = excluded.summary, repo_url = excluded.repo_url, demo_url = excluded.demo_url,
                  submitted_at = excluded.submitted_at`)
      .run(c.id, owner.teamId, req.user.id, owner.key, title, String(b.summary ?? '').trim().slice(0, 600),
        repo.url, demo.url, new Date().toISOString());
    res.json({ submission: studentSubmissionView(c, req.user.id) });
  });

  // Everything a judge needs: every submission with team, members and scores.
  app.get('/api/challenges/:id/submissions', requireRole('company', 'reviewer'), (req, res) => {
    const c = getChallenge(Number(req.params.id));
    if (!c || !canJudge(req.user, c)) return bad(res, 'Challenge not found.', 404);
    const rows = db.prepare('SELECT * FROM submissions WHERE challenge_id = ? ORDER BY submitted_at').all(c.id);
    const expected = c.mode === 'team'
      ? db.prepare('SELECT COUNT(*) AS n FROM teams WHERE challenge_id = ?').get(c.id).n
      : db.prepare('SELECT COUNT(*) AS n FROM registrations WHERE challenge_id = ?').get(c.id).n;
    res.json({
      challenge: { ...c, phase: phase(c) },
      expected,
      submissions: rows.map((s) => ({ ...s, team_name: teamName(s), members: membersOf(s), total: total(s) })),
    });
  });

  app.put('/api/submissions/:id/grade', requireRole('company', 'reviewer'), (req, res) => {
    const s = db.prepare('SELECT * FROM submissions WHERE id = ?').get(Number(req.params.id));
    const c = s && getChallenge(s.challenge_id);
    if (!c || !canJudge(req.user, c)) return bad(res, 'Submission not found.', 404);
    if (phase(c) !== 'ended') return bad(res, 'Grading opens when the challenge ends.');
    if (c.results_published_at) return bad(res, 'Results are already published.');
    const scores = ['impact', 'execution', 'presentation'].map((k) => Number(req.body?.[k]));
    if (!scores.every((v) => Number.isInteger(v) && v >= 1 && v <= 5)) return bad(res, 'Score each category from 1 to 5.');
    db.prepare(`UPDATE submissions SET score_impact = ?, score_execution = ?, score_presentation = ?, feedback = ?, graded_at = ?
                WHERE id = ?`).run(...scores, String(req.body?.feedback ?? '').trim().slice(0, 1000) || null, new Date().toISOString(), s.id);
    res.json({ ok: true });
  });

  // Pick winners (ordered list of submission ids, up to 3) and publish.
  app.post('/api/challenges/:id/results', requireRole('company', 'reviewer'), (req, res) => {
    const c = getChallenge(Number(req.params.id));
    if (!c || !canJudge(req.user, c)) return bad(res, 'Challenge not found.', 404);
    if (phase(c) !== 'ended') return bad(res, 'Pick winners after the challenge ends.');
    if (c.results_published_at) return bad(res, 'Results are already published.');
    const subs = db.prepare('SELECT * FROM submissions WHERE challenge_id = ?').all(c.id);
    if (!subs.length) return bad(res, 'There are no submissions to judge.');
    if (subs.some((s) => !s.graded_at)) return bad(res, 'Grade every submission before publishing results.');
    const winners = (Array.isArray(req.body?.winners) ? req.body.winners : []).map(Number);
    if (!winners.length || winners.length > 3 || new Set(winners).size !== winners.length) return bad(res, 'Pick one to three different winners.');
    if (!winners.every((id) => subs.some((s) => s.id === id))) return bad(res, 'Winners must be submissions to this challenge.');

    db.exec('BEGIN');
    try {
      db.prepare('UPDATE submissions SET place = NULL WHERE challenge_id = ?').run(c.id);
      winners.forEach((id, i) => db.prepare('UPDATE submissions SET place = ? WHERE id = ?').run(i + 1, id));
      db.prepare('UPDATE challenges SET results_published_at = ? WHERE id = ?').run(new Date().toISOString(), c.id);
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
    res.json({ results: publicResults(getChallenge(c.id)) });
  });
}
