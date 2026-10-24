import test from 'node:test';
import assert from 'node:assert/strict';

process.env.DB_PATH = ':memory:';
const { app } = await import('../server/app.js');
const { seedIfEmpty } = await import('../server/seed.js');
const { simulate } = await import('../server/simulate.js');
seedIfEmpty();

const server = app.listen(0);
const base = `http://localhost:${server.address().port}`;
test.after(() => server.close());

// Tiny cookie-keeping client.
function client() {
  let cookie = '';
  return async (path, { method = 'GET', body } = {}) => {
    const res = await fetch(base + path, {
      method,
      headers: { 'Content-Type': 'application/json', cookie },
      body: body ? JSON.stringify(body) : undefined,
    });
    cookie = res.headers.get('set-cookie')?.split(';')[0] || cookie;
    return { status: res.status, data: await res.json() };
  };
}

const future = (days, hour) => {
  const d = new Date(Date.now() + days * 864e5);
  return `${d.toISOString().slice(0, 10)}T${String(hour).padStart(2, '0')}:00`;
};
const row = (over = {}) => ({
  company_name: 'Test Co', title: 'Test challenge', summary: 'Do a thing', format: 'mini', mode: 'team',
  team_size: 3, skills: 'python; sql', tags: 'ai', timezone: 'America/New_York',
  signup_deadline: future(5, 12), starts_at: future(7, 17), ends_at: future(7, 18), ...over,
});

test('import dry run reports per-row problems without saving anything', async () => {
  const api = client();
  const before = (await api('/api/challenges')).data.challenges.length;
  const { data } = await api('/api/challenges/import', {
    method: 'POST',
    body: { dry_run: true, rows: [row(), row({ skills: 'python; rust' }), row({ starts_at: future(1, 9) })] },
  });
  assert.equal(data.created, 0);
  assert.equal(data.results[0].error, null);
  assert.match(data.results[1].error, /Unknown skill "rust"/);
  assert.match(data.results[2].error, /start after sign-ups close/);
  assert.equal((await api('/api/challenges')).data.challenges.length, before);
});

test('imported and posted challenges wait for review before going live', async () => {
  const anon = client();
  const { data } = await anon('/api/challenges/import', { method: 'POST', body: { rows: [row({ title: 'Imported one' }), row({ format: 'huge' })] } });
  assert.equal(data.created, 1);
  const posted = await anon('/api/challenges', { method: 'POST', body: row({ title: 'Posted one' }) });
  assert.equal(posted.data.challenge.phase, 'pending');

  const titles = (await anon('/api/challenges')).data.challenges.map((c) => c.title);
  assert.ok(!titles.includes('Imported one') && !titles.includes('Posted one'));
  assert.equal((await anon(`/api/challenges/${posted.data.challenge.id}`)).status, 404);

  const reviewer = client();
  await reviewer('/api/auth/login', { method: 'POST', body: { email: 'reviewer@demo.rungs', password: 'demo1234' } });
  const queue = (await reviewer('/api/review/challenges')).data.pending;
  const imported = queue.find((c) => c.title === 'Imported one');
  assert.equal(imported.source, 'import');

  // Rejecting needs a note; approving publishes it.
  assert.equal((await reviewer(`/api/review/challenges/${posted.data.challenge.id}`, { method: 'POST', body: { decision: 'reject' } })).status, 400);
  await reviewer(`/api/review/challenges/${posted.data.challenge.id}`, { method: 'POST', body: { decision: 'reject', note: 'Add a mentor.' } });
  await reviewer(`/api/review/challenges/${imported.id}`, { method: 'POST', body: { decision: 'approve' } });

  const live = (await anon('/api/challenges')).data.challenges.map((c) => c.title);
  assert.ok(live.includes('Imported one'));
  assert.ok(!live.includes('Posted one'));

  const student = client();
  await student('/api/auth/login', { method: 'POST', body: { email: 'maya@demo.rungs', password: 'demo1234' } });
  assert.equal((await student('/api/review/challenges')).status, 403);
});

test('simulator places every student once and beats random on balance', () => {
  const skills = ['python', 'ui-design', 'writing'];
  const r = simulate({ n: 20, teamSize: 4, skills, seed: 42 });
  const ids = r.teams.flatMap((t) => t.members.map((m) => m.id)).sort((a, b) => a - b);
  assert.deepEqual(ids, Array.from({ length: 20 }, (_, i) => i + 1));
  assert.ok(r.sorted.strengthSpread <= r.random.strengthSpread);
  assert.ok(r.sorted.coverage >= r.random.coverage);
});

test('simulator is for companies and reviewers, not students', async () => {
  const student = client();
  await student('/api/auth/login', { method: 'POST', body: { email: 'maya@demo.rungs', password: 'demo1234' } });
  assert.equal((await student('/api/simulate', { method: 'POST', body: { skills: ['python'] } })).status, 403);

  const company = client();
  await company('/api/auth/login', { method: 'POST', body: { email: 'lakefront@demo.rungs', password: 'demo1234' } });
  const { status, data } = await company('/api/simulate', { method: 'POST', body: { skills: ['python', 'sql'], team_size: 3, students: 12, seed: 7 } });
  assert.equal(status, 200);
  assert.equal(data.teams.length, 4);
});
