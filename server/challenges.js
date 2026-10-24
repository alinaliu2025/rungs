import { db } from './db.js';
import { SKILLS, INTERESTS } from './catalog.js';
import { zonedToUtc, durationLabel, isValidTimeZone, DEFAULT_TZ } from './time.js';

export const IMPORT_LIMIT = 100;

// Accepts ["a", "b"] or "a; b" / "a, b" (CSV cells).
function toList(v) {
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
  return String(v ?? '').split(/[;,]/).map((x) => x.trim().toLowerCase()).filter(Boolean);
}

// Validates one challenge from the survey form or an import row.
// Returns { error } or { values } ready for insertChallenge.
export function validateChallenge(b, company) {
  const companyName = company ? company.name : String(b.company_name ?? '').trim();
  const title = String(b.title ?? '').trim();
  const summary = String(b.summary ?? '').trim();
  const format = String(b.format ?? '').trim().toLowerCase();
  const mode = String(b.mode ?? '').trim().toLowerCase();
  if (!companyName) return { error: 'Company name is required.' };
  if (!title || !summary) return { error: 'Title and a one-line summary are required.' };
  if (!['mini', 'project'].includes(format)) return { error: 'Format must be "mini" or "project".' };
  if (!['individual', 'team'].includes(mode)) return { error: 'Mode must be "individual" or "team".' };

  const skills = toList(b.skills);
  const tags = toList(b.tags);
  const badSkill = skills.find((s) => !SKILLS.includes(s));
  if (badSkill) return { error: `Unknown skill "${badSkill}".` };
  const badTag = tags.find((t) => !INTERESTS.includes(t));
  if (badTag) return { error: `Unknown topic "${badTag}".` };

  const tz = String(b.timezone ?? '').trim() || DEFAULT_TZ;
  if (!isValidTimeZone(tz)) return { error: `Unknown time zone "${tz}".` };
  const deadline = zonedToUtc(b.signup_deadline, tz);
  const starts = zonedToUtc(b.starts_at, tz);
  const ends = zonedToUtc(b.ends_at, tz);
  if (!deadline || !starts || !ends) return { error: 'Sign-up deadline, start and end are required (YYYY-MM-DDTHH:MM).' };
  if (Date.parse(deadline) <= Date.now()) return { error: 'The sign-up deadline must be in the future.' };
  if (Date.parse(starts) < Date.parse(deadline)) return { error: 'The challenge must start after sign-ups close.' };
  if (Date.parse(ends) <= Date.parse(starts)) return { error: 'The end time must be after the start time.' };

  const cap = Number(b.max_participants) > 0 ? Math.floor(Number(b.max_participants)) : null;
  return {
    values: {
      company_id: company?.id ?? null,
      company_name: companyName.slice(0, 120),
      title: title.slice(0, 160),
      summary: summary.slice(0, 280),
      description: String(b.description ?? ''),
      format,
      mode,
      team_size: mode === 'team' ? Math.max(2, Math.min(8, Number(b.team_size) || 4)) : 1,
      duration_label: durationLabel(starts, ends),
      hours_per_week: Math.max(1, Math.min(40, Number(b.hours_per_week) || 3)),
      skills: JSON.stringify(skills),
      tags: JSON.stringify(tags),
      mentor_name: String(b.mentor_name ?? '').trim() || null,
      mentor_title: String(b.mentor_title ?? '').trim() || null,
      deliverable: String(b.deliverable ?? '').trim() || null,
      signup_deadline: deadline,
      starts_at: starts,
      ends_at: ends,
      timezone: tz,
      max_participants: cap,
    },
  };
}

// New challenges always start in review.
export function insertChallenge(values, source = 'form') {
  const cols = [...Object.keys(values), 'status', 'source'];
  const { lastInsertRowid } = db.prepare(
    `INSERT INTO challenges (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
  ).run(...Object.values(values), 'pending', source);
  return Number(lastInsertRowid);
}
