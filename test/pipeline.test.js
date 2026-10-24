import test from 'node:test';
import assert from 'node:assert/strict';

// Full mini-challenge flow over HTTP:
// post -> review -> sign-ups -> teams -> submit -> grade -> winners.
process.env.DB_PATH = ':memory:';
process.env.RUNGS_DEMO = '1';
const { app } = await import('../server/app.js');
const { seedIfEmpty } = await import('../server/seed.js');
seedIfEmpty();

const server = app.listen(0);
const base = `http://localhost:${server.address().port}`;
test.after(() => server.close());

function client() {
  let cookie = '';
  const call = async (path, { method = 'GET', body } = {}) => {
    const res = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', cookie }, body: body ? JSON.stringify(body) : undefined });
    cookie = res.headers.get('set-cookie')?.split(';')[0] || cookie;
    return { status: res.status, data: await res.json() };
  };
  call.login = (email) => call('/api/auth/login', { method: 'POST', body: { email, password: 'demo1234' } });
  return call;
}
const at = (days, hour) => `${new Date(Date.now() + days * 864e5).toISOString().slice(0, 10)}T${String(hour).padStart(2, '0')}:00`;

test('a mini team challenge runs from posting to winners', async () => {
  const company = client(); await company.login('lakefront@demo.rungs');
  const reviewer = client(); await reviewer.login('reviewer@demo.rungs');
  const maya = client(); await maya.login('maya@demo.rungs');

  const { data: posted } = await company('/api/challenges', {
    method: 'POST',
    body: { title: 'Pipeline test', summary: 'End to end', format: 'mini', mode: 'team', team_size: 3, skills: ['python'],
      tags: ['ai'], timezone: 'America/New_York', signup_deadline: at(3, 12), starts_at: at(5, 17), ends_at: at(5, 19) },
  });
  const id = posted.challenge.id;
  await reviewer(`/api/review/challenges/${id}`, { method: 'POST', body: { decision: 'approve' } });

  // Sign-ups: Maya joins, demo fills the rest; then sign-ups close and teams form.
  assert.equal((await maya(`/api/challenges/${id}/join`, { method: 'POST', body: {} })).status, 200);
  assert.equal((await company(`/api/demo/challenges/${id}/fill`, { method: 'POST', body: { count: 8 } })).data.added, 8);
  assert.equal((await company(`/api/demo/challenges/${id}/advance`, { method: 'POST' })).data.phase, 'locked');
  const team = (await maya(`/api/challenges/${id}`)).data.challenge.myTeam;
  assert.ok(team.members.length >= 3);

  // Submitting only works while live.
  const submission = { title: 'Our project', summary: 'What we built', repo_url: 'https://github.com/example/project' };
  assert.equal((await maya(`/api/challenges/${id}/submission`, { method: 'PUT', body: submission })).status, 400);
  assert.equal((await company(`/api/demo/challenges/${id}/advance`, { method: 'POST' })).data.phase, 'live');
  assert.equal((await maya(`/api/challenges/${id}/submission`, { method: 'PUT', body: { ...submission, repo_url: 'not a link' } })).status, 400);
  assert.equal((await maya(`/api/challenges/${id}/submission`, { method: 'PUT', body: submission })).status, 200);
  await company(`/api/demo/challenges/${id}/sample-submissions`, { method: 'POST' });

  // Judging opens after the end; grades must be 1-5 and complete before publishing.
  const early = (await company('/api/challenges/' + id + '/submissions')).data.submissions;
  assert.equal((await company(`/api/submissions/${early[0].id}/grade`, { method: 'PUT', body: { impact: 5, execution: 5, presentation: 5 } })).status, 400);
  assert.equal((await company(`/api/demo/challenges/${id}/advance`, { method: 'POST' })).data.phase, 'ended');

  const { data } = await company(`/api/challenges/${id}/submissions`);
  assert.equal(data.submissions.length, data.expected);
  const mine = data.submissions.find((s) => s.title === 'Our project');
  assert.equal((await company(`/api/submissions/${mine.id}/grade`, { method: 'PUT', body: { impact: 9, execution: 5, presentation: 5 } })).status, 400);
  await company(`/api/submissions/${mine.id}/grade`, { method: 'PUT', body: { impact: 5, execution: 5, presentation: 4, feedback: 'Excellent.' } });
  assert.equal((await company(`/api/challenges/${id}/results`, { method: 'POST', body: { winners: [mine.id] } })).status, 400);
  await company(`/api/demo/challenges/${id}/sample-grades`, { method: 'POST' });

  // Students can't judge.
  assert.equal((await maya(`/api/submissions/${mine.id}/grade`, { method: 'PUT', body: { impact: 5, execution: 5, presentation: 5 } })).status, 403);

  const others = data.submissions.filter((s) => s.id !== mine.id).map((s) => s.id);
  const { data: published } = await company(`/api/challenges/${id}/results`, { method: 'POST', body: { winners: [mine.id, others[0]] } });
  assert.equal(published.results.winners[0].title, 'Our project');

  // Public page shows winners; Maya sees her place and feedback.
  const anon = client();
  assert.equal((await anon(`/api/challenges/${id}`)).data.challenge.results.winners.length, 2);
  const view = (await maya(`/api/challenges/${id}`)).data.challenge.mySubmission;
  assert.equal(view.place, 1);
  assert.equal(view.feedback, 'Excellent.');
  assert.equal(view.scores.total, 14);
});

test('demo routes are off unless RUNGS_DEMO=1', async () => {
  process.env.RUNGS_DEMO = '0';
  const anon = client();
  assert.equal((await anon('/api/demo/challenges/1/advance', { method: 'POST' })).status, 404);
  process.env.RUNGS_DEMO = '1';
});
