import { fileURLToPath } from 'node:url';
import { db } from './db.js';
import { hashPassword } from './auth.js';
import { zonedToUtc, durationLabel, DEFAULT_TZ } from './time.js';

// Every demo account uses this password. Sample data only, all names invented.
export const DEMO_PASSWORD = 'demo1234';

const companies = [
  { email: 'northline@demo.rungs', name: 'Northline Mobility' },
  { email: 'scioto@demo.rungs', name: 'Scioto Health Labs' },
  { email: 'lakefront@demo.rungs', name: 'Lakefront Energy' },
];

// [name, major, expected graduation year, hours/week, role, skills, interests]
const students = [
  ['Maya Chen', 'Computer Science', 2028, 8, 'builder', { python: 3, 'machine-learning': 2, sql: 2 }, ['ai', 'mobility']],
  ['Jordan Reyes', 'Industrial Design', 2027, 6, 'designer', { 'ui-design': 3, 'ux-research': 2, cad: 2 }, ['mobility', 'healthcare']],
  ['Priya Patel', 'Data Analytics', 2029, 5, 'analyst', { python: 2, sql: 3, 'data-analysis': 3 }, ['energy', 'sustainability']],
  ['Sam Okafor', 'Electrical Engineering', 2027, 10, 'builder', { embedded: 3, hardware: 3, python: 1 }, ['robotics', 'manufacturing']],
  ['Lena Novak', 'Marketing', 2028, 4, 'communicator', { writing: 3, presentation: 3, 'ux-research': 1 }, ['social-impact', 'sustainability']],
  ['Diego Alvarez', 'Computer Science', 2030, 6, 'builder', { javascript: 2, react: 1, node: 1 }, ['education', 'ai']],
  ['Aisha Rahman', 'Biomedical Engineering', 2028, 7, 'analyst', { python: 2, 'data-analysis': 2, hardware: 1 }, ['healthcare', 'ai']],
  ['Ethan Brooks', 'Mechanical Engineering', 2027, 8, 'organizer', { cad: 3, 'project-management': 2, hardware: 2 }, ['manufacturing', 'mobility']],
  ['Grace Kim', 'Computer Science', 2027, 9, 'builder', { react: 3, javascript: 3, node: 2, cloud: 2 }, ['fintech', 'education']],
  ['Noah Williams', 'Economics', 2029, 5, 'analyst', { 'data-analysis': 2, sql: 1, writing: 2 }, ['fintech', 'energy']],
  ['Zara Ahmed', 'Design', 2028, 6, 'designer', { 'ui-design': 3, 'ux-research': 3, presentation: 2 }, ['healthcare', 'social-impact']],
  ['Luis Martinez', 'Computer Engineering', 2028, 8, 'builder', { embedded: 2, python: 2, cloud: 1 }, ['robotics', 'ai']],
  ['Hannah Lee', 'Public Health', 2027, 4, 'organizer', { 'project-management': 3, writing: 2, presentation: 2 }, ['healthcare', 'social-impact']],
  ['Omar Haddad', 'Statistics', 2028, 7, 'analyst', { python: 3, 'machine-learning': 3, 'data-analysis': 2 }, ['ai', 'manufacturing']],
];

// Wall-clock time in Eastern, `days` from today. Keeps the demo dates fresh.
function et(days, hour, minute = 0) {
  const d = new Intl.DateTimeFormat('en-CA', { timeZone: DEFAULT_TZ, year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(new Date(Date.now() + days * 864e5));
  return zonedToUtc(`${d}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`, DEFAULT_TZ);
}
const hoursAgo = (h) => new Date(Date.now() - h * 36e5).toISOString();

const challenges = [
  {
    company: 0, status: 'published', format: 'mini', mode: 'individual', team_size: 1,
    title: 'Map the EV charging gaps in Columbus',
    signup_deadline: et(2, 23, 59), starts_at: et(4, 10), ends_at: et(4, 13), max_participants: 40,
    summary: 'Use open data to find the neighborhoods furthest from a public charger.',
    description: 'We share a CSV of chargers and census tracts. Produce one map and three sentences on what you would build first.',
    hours_per_week: 3, skills: ['python', 'data-analysis'], tags: ['mobility', 'sustainability'],
    mentor_name: 'Rae Thompson', mentor_title: 'Data Scientist', deliverable: 'A map + 3-sentence takeaway',
  },
  {
    company: 0, status: 'published', format: 'mini', mode: 'team', team_size: 3,
    title: '48-hour UX teardown of a transit app',
    // Deadline already passed: teams form automatically on first start.
    signup_deadline: hoursAgo(1), starts_at: et(1, 18), ends_at: et(3, 18),
    summary: 'Pick a real transit app, find its three worst moments, and redesign one.',
    description: 'Teams of three. One researcher, one designer, one storyteller works well, but we will sort you.',
    hours_per_week: 5, skills: ['ux-research', 'ui-design', 'presentation'], tags: ['mobility', 'social-impact'],
    mentor_name: 'Chris Abara', mentor_title: 'Product Designer', deliverable: '5-slide redesign pitch',
  },
  {
    company: 2, status: 'published', format: 'project', mode: 'team', team_size: 4,
    title: 'Predictive maintenance dashboard for factory sensors',
    signup_deadline: et(5, 23, 59), starts_at: et(9, 9), ends_at: et(51, 17),
    summary: 'Turn six months of vibration data into an early-warning dashboard.',
    description: 'Six weeks with a Lakefront reliability engineer. Weekly 30-minute check-ins. Real (anonymized) plant data.',
    hours_per_week: 6, skills: ['python', 'machine-learning', 'react', 'data-analysis'], tags: ['manufacturing', 'ai', 'energy'],
    mentor_name: 'Dana Weiss', mentor_title: 'Reliability Engineer', deliverable: 'Working dashboard + demo day talk',
  },
  {
    company: 1, status: 'published', format: 'project', mode: 'team', team_size: 4,
    title: 'Patient check-in kiosk prototype',
    signup_deadline: et(12, 23, 59), starts_at: et(16, 9), ends_at: et(51, 17), max_participants: 16,
    summary: 'Design and prototype a check-in flow that works for patients with low vision.',
    description: 'Five weeks. You will run two short sessions with clinic staff and ship a clickable prototype plus a hardware mockup.',
    hours_per_week: 5, skills: ['ux-research', 'ui-design', 'hardware', 'javascript'], tags: ['healthcare', 'social-impact'],
    mentor_name: 'Imani Scott', mentor_title: 'Clinical Innovation Lead', deliverable: 'Clickable prototype + test notes',
  },
  {
    company: 2, status: 'published', format: 'mini', mode: 'individual', team_size: 1,
    title: 'Explain battery recycling in one page',
    // A one-hour live session: sign up days ahead, show up Sunday 5-6pm.
    signup_deadline: et(1, 23, 59), starts_at: et(3, 17), ends_at: et(3, 18),
    summary: 'Write a one-page explainer a high schooler would actually read.',
    description: 'Mentor gives written feedback within a week. Best three get shared on our community page.',
    hours_per_week: 3, skills: ['writing'], tags: ['sustainability', 'energy', 'education'],
    mentor_name: 'Paul Grant', mentor_title: 'Sustainability Manager', deliverable: 'One-page explainer',
  },
  {
    company: 2, status: 'published', format: 'project', mode: 'team', team_size: 3,
    title: 'Solar site scouting with satellite data',
    signup_deadline: et(10, 23, 59), starts_at: et(14, 9), ends_at: et(42, 17),
    summary: 'Rank rooftops in Franklin County by solar potential.',
    description: 'Four weeks with Lakefront\'s sustainability team, using public satellite imagery and tax parcel data.',
    hours_per_week: 5, skills: ['python', 'machine-learning', 'data-analysis'], tags: ['energy', 'sustainability'],
    mentor_name: 'Paul Grant', mentor_title: 'Sustainability Manager', deliverable: 'Ranked map + method write-up',
  },
  {
    company: 1, status: 'published', format: 'mini', mode: 'individual', team_size: 1,
    title: 'Accessibility audit sprint',
    signup_deadline: et(-10, 23, 59), starts_at: et(-7, 17), ends_at: et(-7, 19),
    summary: 'Find the five biggest accessibility problems on a patient portal.',
    description: 'Already wrapped up. Shown so the "ended" state is visible in the demo.',
    hours_per_week: 2, skills: ['ux-research'], tags: ['healthcare', 'social-impact'],
    mentor_name: 'Imani Scott', mentor_title: 'Clinical Innovation Lead', deliverable: 'Top-5 issues list',
  },
];

// Challenge index -> student indexes already registered, so team sorting can be demoed.
const registrations = { 2: [0, 2, 3, 5, 6, 7, 8, 9, 11, 13], 1: [1, 4, 10, 12, 6, 5] };

function seed() {
  const hash = hashPassword(DEMO_PASSWORD);
  const insUser = db.prepare('INSERT INTO users (email, password_hash, role, name) VALUES (?, ?, ?, ?)');
  const companyIds = companies.map((c) => Number(insUser.run(c.email, hash, 'company', c.name).lastInsertRowid));

  const insProfile = db.prepare(`INSERT INTO profiles (user_id, major, grad_year, bio, hours_per_week, preferred_role, skills, interests)
                                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
  const studentIds = students.map(([name, major, gradYear, hours, role, skills, interests]) => {
    const email = `${name.split(' ')[0].toLowerCase()}@demo.rungs`;
    const id = Number(insUser.run(email, hash, 'student', name).lastInsertRowid);
    insProfile.run(id, major, gradYear, `${major}, class of ${gradYear}.`, hours, role, JSON.stringify(skills), JSON.stringify(interests));
    return id;
  });

  const insChallenge = db.prepare(`INSERT INTO challenges (company_id, company_name, title, summary, description, format, mode, team_size,
      duration_label, hours_per_week, skills, tags, mentor_name, mentor_title, deliverable, status,
      signup_deadline, starts_at, ends_at, timezone, max_participants)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const challengeIds = challenges.map((c) => Number(insChallenge.run(companyIds[c.company], companies[c.company].name, c.title, c.summary, c.description,
    c.format, c.mode, c.team_size, durationLabel(c.starts_at, c.ends_at), c.hours_per_week, JSON.stringify(c.skills), JSON.stringify(c.tags),
    c.mentor_name, c.mentor_title, c.deliverable, c.status,
    c.signup_deadline, c.starts_at, c.ends_at, DEFAULT_TZ, c.max_participants ?? null).lastInsertRowid));

  const insReg = db.prepare('INSERT INTO registrations (challenge_id, user_id) VALUES (?, ?)');
  for (const [ci, sis] of Object.entries(registrations)) sis.forEach((si) => insReg.run(challengeIds[ci], studentIds[si]));
}

export function seedIfEmpty() {
  if (db.prepare('SELECT COUNT(*) AS n FROM users').get().n === 0) {
    seed();
    console.log(`Seeded demo data (password for every account: ${DEMO_PASSWORD})`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--reset')) {
    db.exec('DELETE FROM team_members; DELETE FROM teams; DELETE FROM registrations; DELETE FROM challenges; DELETE FROM sessions; DELETE FROM profiles; DELETE FROM users;');
  }
  seedIfEmpty();
}
