import { MAX_LEVEL } from './catalog.js';

// Team sorting for team challenges.
//
// Students never see any of this: they only learn which team they landed on
// and who their teammates are. That keeps people from gaming their profile to
// get onto a particular team. Admins and the posting company can see the
// metrics so they can trust the result.
//
// Approach:
//   1. Rank students by strength on the challenge's required skills.
//   2. Snake-draft them into teams (1,2,3,3,2,1,...) so strength is spread out.
//   3. Hill-climb with random swaps to minimize a cost that rewards
//      balanced strength, full skill coverage, mixed majors and mixed roles.

export const TEAM_WEIGHTS = {
  balance: 2.0,   // std-dev of average team strength
  coverage: 1.0,  // required skills nobody on the team is strong in
  diversity: 0.4, // teams made of one major
  roles: 0.2,     // duplicate preferred roles
};

function mulberry32(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function strength(student, required) {
  const keys = required.length ? required : Object.keys(student.skills);
  if (!keys.length) return 0;
  return keys.reduce((s, k) => s + (student.skills[k] || 0) / MAX_LEVEL, 0) / keys.length;
}

export function teamMetrics(members, required) {
  const avgStrength = members.reduce((s, m) => s + m._strength, 0) / members.length;
  const coverage = required.length
    ? required.reduce((s, k) => s + Math.max(...members.map((m) => m.skills[k] || 0)) / MAX_LEVEL, 0) / required.length
    : 1;
  const majors = new Set(members.map((m) => m.major || '?')).size;
  const roles = new Set(members.map((m) => m.preferred_role || '?')).size;
  return {
    avgStrength,
    coverage,
    majorMix: members.length > 1 ? (majors - 1) / (members.length - 1) : 1,
    roleMix: members.length > 1 ? (roles - 1) / (members.length - 1) : 1,
  };
}

function cost(teams, required) {
  const w = TEAM_WEIGHTS;
  const m = teams.map((t) => teamMetrics(t, required));
  const mean = m.reduce((s, x) => s + x.avgStrength, 0) / m.length;
  const sd = Math.sqrt(m.reduce((s, x) => s + (x.avgStrength - mean) ** 2, 0) / m.length);
  const avg = (key) => m.reduce((s, x) => s + x[key], 0) / m.length;
  return w.balance * sd + w.coverage * (1 - avg('coverage')) + w.diversity * (1 - avg('majorMix')) + w.roles * (1 - avg('roleMix'));
}

export function formTeams(students, challenge, { iterations = 3000 } = {}) {
  if (!students.length) return { teams: [], cost: 0 };
  const required = challenge.skills;
  const pool = students.map((s) => ({ ...s, _strength: strength(s, required) }));
  pool.sort((a, b) => b._strength - a._strength || a.id - b.id);

  // Aim for the requested size, but never let a team grow past size + 1
  // (e.g. 7 people for teams of 4 -> 4 + 3, not one team of 7).
  const size = challenge.team_size;
  const teamCount = Math.max(1, Math.round(pool.length / size), Math.ceil(pool.length / (size + 1)));
  const teams = Array.from({ length: teamCount }, () => []);
  pool.forEach((s, i) => {
    const round = Math.floor(i / teamCount);
    const slot = i % teamCount;
    teams[round % 2 === 0 ? slot : teamCount - 1 - slot].push(s);
  });

  const rand = mulberry32(challenge.id * 7919 + pool.length);
  let best = cost(teams, required);
  if (teamCount > 1) {
    for (let i = 0; i < iterations; i++) {
      const a = Math.floor(rand() * teamCount);
      let b = Math.floor(rand() * (teamCount - 1));
      if (b >= a) b++;
      const ia = Math.floor(rand() * teams[a].length);
      const ib = Math.floor(rand() * teams[b].length);
      [teams[a][ia], teams[b][ib]] = [teams[b][ib], teams[a][ia]];
      const next = cost(teams, required);
      if (next <= best) best = next;
      else [teams[a][ia], teams[b][ib]] = [teams[b][ib], teams[a][ia]];
    }
  }

  return {
    cost: Math.round(best * 1000) / 1000,
    teams: teams.map((members) => ({
      memberIds: members.map((m) => m.id),
      metrics: Object.fromEntries(
        Object.entries(teamMetrics(members, required)).map(([k, v]) => [k, Math.round(v * 100) / 100]),
      ),
    })),
  };
}
