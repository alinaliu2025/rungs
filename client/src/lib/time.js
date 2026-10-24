// Times arrive as UTC ISO strings; each challenge carries the time zone it runs in.

export const viewerTz = Intl.DateTimeFormat().resolvedOptions().timeZone;

const fmt = (iso, tz, opts) => new Intl.DateTimeFormat('en-US', { timeZone: tz, ...opts }).format(new Date(iso));

export const fmtDay = (iso, tz) => fmt(iso, tz, { weekday: 'short', month: 'short', day: 'numeric' });
export const fmtTime = (iso, tz, zone = true) =>
  fmt(iso, tz, { hour: 'numeric', minute: '2-digit', ...(zone ? { timeZoneName: 'short' } : {}) });
export const fmtFull = (iso, tz) => `${fmtDay(iso, tz)} · ${fmtTime(iso, tz)}`;

export function fmtWhen(c) {
  const tz = c.timezone;
  if (fmtDay(c.starts_at, tz) === fmtDay(c.ends_at, tz)) {
    return `${fmtDay(c.starts_at, tz)} · ${fmtTime(c.starts_at, tz, false)}–${fmtTime(c.ends_at, tz)}`;
  }
  const md = { month: 'short', day: 'numeric' };
  return `${fmt(c.starts_at, tz, md)} – ${fmt(c.ends_at, tz, md)}`;
}

// "36h", "3d", "12m" until the given time.
export function rel(iso) {
  const m = Math.max(1, Math.round((Date.parse(iso) - Date.now()) / 6e4));
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h`;
  return `${Math.round(h / 24)}d`;
}

// datetime-local value `days` from now at `hour`, in the viewer's zone.
export function localInput(days, hour, minute = 0) {
  const d = new Date(Date.now() + days * 864e5);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(hour)}:${pad(minute)}`;
}
