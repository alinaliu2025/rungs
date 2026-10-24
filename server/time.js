// Time helpers. All times are stored as UTC ISO strings; each challenge also
// keeps the IANA time zone it was posted in so we can show "5:00 PM ET".

export const DEFAULT_TZ = 'America/New_York';

export const TIME_ZONES = [
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'UTC',
];

export function isValidTimeZone(tz) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

// Offset (ms) of `tz` from UTC at the given instant.
function tzOffset(utcMs, tz) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).formatToParts(new Date(utcMs)).map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return asUtc - Math.floor(utcMs / 1000) * 1000;
}

// "2026-11-20T17:00" wall-clock time in `tz` -> UTC ISO string.
export function zonedToUtc(local, tz = DEFAULT_TZ) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(String(local || ''));
  if (!m) return null;
  const wall = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  // Two passes so times right after a DST switch land on the right offset.
  let utc = wall - tzOffset(wall, tz);
  utc = wall - tzOffset(utc, tz);
  return new Date(utc).toISOString();
}

// Where a challenge is in its life, derived from its dates.
//   pending (in review) -> open (sign-ups) -> locked (teams set, waiting to start) -> live -> ended
//   pending -> rejected
export function phase(challenge, now = Date.now()) {
  if (challenge.status === 'pending') return 'pending';
  if (challenge.status === 'rejected') return 'rejected';
  if (now < Date.parse(challenge.signup_deadline)) return 'open';
  if (now < Date.parse(challenge.starts_at)) return 'locked';
  if (now < Date.parse(challenge.ends_at)) return 'live';
  return 'ended';
}

export function overlaps(a, b) {
  return Date.parse(a.starts_at) < Date.parse(b.ends_at) && Date.parse(b.starts_at) < Date.parse(a.ends_at);
}

export function durationLabel(startIso, endIso) {
  const hours = (Date.parse(endIso) - Date.parse(startIso)) / 36e5;
  if (hours < 24) return `${Math.round(hours * 10) / 10} hr${hours === 1 ? '' : 's'}`;
  if (hours < 24 * 14) return `${Math.round(hours / 24)} days`;
  return `${Math.round(hours / (24 * 7))} weeks`;
}
