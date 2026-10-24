import test from 'node:test';
import assert from 'node:assert/strict';
import { zonedToUtc, phase, overlaps } from '../server/time.js';

process.env.DB_PATH = ':memory:';
const { db } = await import('../server/db.js');
const { seedIfEmpty } = await import('../server/seed.js');
const { runDueJobs } = await import('../server/lifecycle.js');

test('zonedToUtc handles Eastern standard and daylight time', () => {
  assert.equal(zonedToUtc('2026-11-22T17:00', 'America/New_York'), '2026-11-22T22:00:00.000Z'); // EST
  assert.equal(zonedToUtc('2026-07-12T17:00', 'America/New_York'), '2026-07-12T21:00:00.000Z'); // EDT
  assert.equal(zonedToUtc('nonsense', 'America/New_York'), null);
});

test('phase moves open -> locked -> live -> ended', () => {
  const c = { status: 'published', signup_deadline: '2026-01-01T00:00:00Z', starts_at: '2026-01-03T00:00:00Z', ends_at: '2026-01-04T00:00:00Z' };
  assert.equal(phase(c, Date.parse('2025-12-31T00:00:00Z')), 'open');
  assert.equal(phase(c, Date.parse('2026-01-02T00:00:00Z')), 'locked');
  assert.equal(phase(c, Date.parse('2026-01-03T12:00:00Z')), 'live');
  assert.equal(phase(c, Date.parse('2026-01-05T00:00:00Z')), 'ended');
  assert.equal(phase({ ...c, status: 'pending' }), 'pending');
});

test('overlaps detects clashing events but not back-to-back ones', () => {
  const a = { starts_at: '2026-01-01T17:00:00Z', ends_at: '2026-01-01T18:00:00Z' };
  assert.ok(overlaps(a, { starts_at: '2026-01-01T17:30:00Z', ends_at: '2026-01-01T19:00:00Z' }));
  assert.ok(!overlaps(a, { starts_at: '2026-01-01T18:00:00Z', ends_at: '2026-01-01T19:00:00Z' }));
});

test('teams form automatically once the sign-up deadline passes', () => {
  seedIfEmpty();
  const due = db.prepare("SELECT id FROM challenges WHERE title LIKE '48-hour%'").get();
  const later = db.prepare("SELECT id FROM challenges WHERE title LIKE 'Predictive%'").get();

  assert.deepEqual(runDueJobs(), [due.id]);
  assert.ok(db.prepare('SELECT COUNT(*) AS n FROM teams WHERE challenge_id = ?').get(due.id).n > 0);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM teams WHERE challenge_id = ?').get(later.id).n, 0);

  // Running again is a no-op; jumping past the next deadline forms those teams too.
  assert.deepEqual(runDueJobs(), []);
  assert.deepEqual(runDueJobs(new Date(Date.now() + 7 * 864e5)), [later.id]);
});
