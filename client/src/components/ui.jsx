import { Link } from 'react-router-dom';
import { fmtFull, fmtWhen, rel, viewerTz } from '../lib/time.js';

export const label = (s) => String(s).replace(/-/g, ' ');
export const initials = (name) => String(name).split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();

export function Rungs() {
  return <div className="rungs" aria-hidden="true"><i /><i /><i /></div>;
}

export function StatusChip({ c }) {
  switch (c.phase) {
    case 'pending': return <span className="chip pending">Pending review</span>;
    case 'open': return c.full ? <span className="chip">Full</span> : <span className="chip">Sign-ups close in {rel(c.signup_deadline)}</span>;
    case 'locked': return <span className="chip">Starts in {rel(c.starts_at)}</span>;
    case 'live': return <span className="chip live">Live now</span>;
    default: return <span className="chip">Ended</span>;
  }
}

export function Segmented({ options, value, onChange }) {
  return (
    <div className="segmented" role="tablist">
      {options.map(([v, text]) => (
        <button key={v} type="button" role="tab" aria-selected={value === v}
          className={value === v ? 'on' : ''} onClick={() => onChange(v)}>{text}</button>
      ))}
    </div>
  );
}

export function ChallengeCard({ c }) {
  const reasons = c.match?.reasons?.slice(0, 3) ?? [];
  return (
    <article className="card">
      <div className={`cover ${c.format}`}>
        <Rungs />
        <StatusChip c={c} />
        <div className="kind">
          {c.format === 'mini' ? 'Mini' : 'Project'}
          <small>{c.duration_label} · {c.mode === 'team' ? `Team of ${c.team_size}` : 'Solo'}</small>
        </div>
        <span className="go" aria-hidden="true">→</span>
      </div>
      <div className="card-body">
        <h3><Link to={`/c/${c.id}`}>{c.title}</Link></h3>
        <div className="meta">{c.company_name} · {fmtWhen(c)}</div>
        <p className="summary">{c.summary}</p>
        {reasons.length > 0 && <div className="why">{reasons.map((r) => <span key={r}>{r}</span>)}</div>}
        <div className="card-foot">
          <span>~{c.hours_per_week} hrs/week</span>
          {c.match ? <span className="match">{Math.round(c.match.score * 100)}% match</span> : <span>{c.registrants} joined</span>}
        </div>
      </div>
    </article>
  );
}

export function Shelf({ title, note, items }) {
  if (!items.length) return null;
  return (
    <section className="shelf">
      <div className="shelf-head"><h2>{title}</h2><span>{note ?? items.length}</span></div>
      <div className="track">{items.map((c) => <ChallengeCard key={c.id} c={c} />)}</div>
    </section>
  );
}

export function Timeline({ c }) {
  const steps = [
    ['Sign-ups close', c.signup_deadline, c.mode === 'team' ? 'Teams are formed automatically' : ''],
    ['Starts', c.starts_at, ''],
    ['Ends', c.ends_at, ''],
  ];
  const current = { pending: 0, open: 0, locked: 1, live: 2, ended: 3 }[c.phase];
  return (
    <ol className="timeline">
      {steps.map(([name, iso, note], i) => (
        <li key={name} className={i < current ? 'done' : i === current ? 'now' : ''}>
          <b>{name}</b>
          <span>{fmtFull(iso, c.timezone)}</span>
          {viewerTz !== c.timezone && <span className="local">{fmtFull(iso, viewerTz)} your time</span>}
          {note && <span className="local">{note}</span>}
        </li>
      ))}
    </ol>
  );
}

export function MemberList({ members, children }) {
  return (
    <ul className="team-list">
      {members.map((m) => (
        <li key={m.name}>
          <span className="avatar">{initials(m.name)}</span>
          <div>
            <b>{m.name}</b>
            <div className="small muted">
              {[m.major, m.grad_year && `Class of ${m.grad_year}`, m.preferred_role && label(m.preferred_role)].filter(Boolean).join(' · ')}
            </div>
            {children?.(m)}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function Loading({ state }) {
  if (state.error) return <div className="empty">{state.error.message}</div>;
  return <div className="empty">Loading…</div>;
}
