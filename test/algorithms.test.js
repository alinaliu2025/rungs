import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreChallenge, recommend } from '../server/matching.js';
import { formTeams } from '../server/teams.js';

const challenge = { id: 1, mode: 'team', team_size: 3, hours_per_week: 5, skills: ['python', 'ui-design'], tags: ['ai'] };

test('a student with matching skills and interests outranks one without', () => {
  const fit = scoreChallenge({ skills: { python: 3, 'ui-design': 2 }, interests: ['ai'], hours_per_week: 6 }, challenge);
  const poor = scoreChallenge({ skills: { writing: 3 }, interests: ['fintech'], hours_per_week: 1 }, challenge);
  assert.ok(fit.score > poor.score);
  assert.ok(fit.reasons.some((r) => r.includes('python')));
});

test('recommend sorts by score', () => {
  const profile = { skills: { writing: 3 }, interests: ['education'], hours_per_week: 4 };
  const writing = { ...challenge, id: 2, skills: ['writing'], tags: ['education'] };
  const out = recommend(profile, [challenge, writing], {});
  assert.equal(out[0].id, 2);
});

test('formTeams puts everyone on exactly one team with near-equal sizes', () => {
  const students = Array.from({ length: 10 }, (_, i) => ({
    id: i + 1, major: i % 2 ? 'CS' : 'Design', preferred_role: 'builder',
    skills: i < 3 ? { python: 3, 'ui-design': 1 } : { 'ui-design': (i % 3) + 1 },
  }));
  const { teams } = formTeams(students, challenge);
  const ids = teams.flatMap((t) => t.memberIds).sort((a, b) => a - b);
  assert.deepEqual(ids, students.map((s) => s.id));
  const sizes = teams.map((t) => t.memberIds.length);
  assert.ok(Math.max(...sizes) - Math.min(...sizes) <= 1);
  // The three strong python students should be spread across the three teams.
  for (const t of teams) assert.ok(t.memberIds.some((id) => id <= 3));
});
