import { SKILLS, ROLES, MAX_LEVEL } from './catalog.js';
import { formTeams, teamMetrics, strength, mulberry32 } from './teams.js';

// Team simulator: invents a pool of students, sorts them with the real
// algorithm, and compares against dealing the same pool out at random.
// Nothing is saved.

const FIRST = ['Ava', 'Ben', 'Chloe', 'Dev', 'Elena', 'Femi', 'Grace', 'Hiro', 'Isla', 'Jamal', 'Kira', 'Leo', 'Mina', 'Nico',
  'Omar', 'Priya', 'Quinn', 'Rosa', 'Sam', 'Tara', 'Uma', 'Victor', 'Wren', 'Xavi', 'Yara', 'Zane', 'Ari', 'Bea', 'Cole', 'Dina'];
const LAST = ['Adams', 'Bose', 'Chen', 'Diaz', 'Evans', 'Fofana', 'Garcia', 'Hughes', 'Ito', 'Jones', 'Khan', 'Lopez', 'Moreau',
  'Nguyen', 'Okoro', 'Park', 'Reyes', 'Shah', 'Tran', 'Usman', 'Vance', 'Wu', 'Young', 'Zhou'];
const MAJORS = ['Computer Science', 'Industrial Design', 'Data Analytics', 'Electrical Engineering', 'Marketing',
  'Mechanical Engineering', 'Statistics', 'Public Health', 'Economics', 'Biomedical Engineering'];

export function simulatePool(n, required, seed) {
  const rand = mulberry32(seed);
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const year = new Date().getFullYear();
  return Array.from({ length: n }, (_, i) => {
    const skills = {};
    // Most people know some of what the challenge needs, at mixed levels.
    for (const s of required) if (rand() < 0.55) skills[s] = 1 + Math.floor(rand() * MAX_LEVEL);
    for (let k = 0; k < 2; k++) skills[pick(SKILLS)] ??= 1 + Math.floor(rand() * MAX_LEVEL);
    return {
      id: i + 1,
      name: `${FIRST[i % FIRST.length]} ${pick(LAST)}`,
      major: pick(MAJORS),
      grad_year: year + 1 + Math.floor(rand() * 4),
      preferred_role: pick(ROLES),
      skills,
    };
  });
}

function summarize(groups, required) {
  const per = groups.map((members) => teamMetrics(members, required));
  const avg = (key) => per.reduce((s, m) => s + m[key], 0) / per.length;
  const mean = avg('avgStrength');
  const spread = Math.sqrt(per.reduce((s, m) => s + (m.avgStrength - mean) ** 2, 0) / per.length);
  const round = (v) => Math.round(v * 100) / 100;
  return {
    coverage: round(avg('coverage')),
    majorMix: round(avg('majorMix')),
    roleMix: round(avg('roleMix')),
    strengthSpread: round(spread),
    perTeam: per.map((m) => Object.fromEntries(Object.entries(m).map(([k, v]) => [k, round(v)]))),
  };
}

export function simulate({ n, teamSize, skills, seed }) {
  const challenge = { id: seed, team_size: teamSize, skills };
  const pool = simulatePool(n, skills, seed).map((s) => ({ ...s, _strength: strength(s, skills) }));
  const byId = new Map(pool.map((s) => [s.id, s]));

  const sorted = formTeams(pool, challenge).teams.map((t) => t.memberIds.map((id) => byId.get(id)));

  // Baseline: shuffle the same pool and deal it into the same team sizes.
  const rand = mulberry32(seed + 1);
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  let at = 0;
  const random = sorted.map((team) => shuffled.slice(at, (at += team.length)));

  const strip = ({ _strength, ...s }) => s;
  const algo = summarize(sorted, skills);
  return {
    pool: pool.length,
    teams: sorted.map((members, i) => ({ name: `Team ${i + 1}`, members: members.map(strip), metrics: algo.perTeam[i] })),
    sorted: { ...algo, perTeam: undefined },
    random: { ...summarize(random, skills), perTeam: undefined },
  };
}
