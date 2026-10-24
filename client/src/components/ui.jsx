import { useState } from 'react';
import { Link } from 'react-router-dom';
import { fmtFull, fmtWhen, rel, viewerTz } from '../lib/time.js';

export const label = (s) => String(s).replace(/-/g, ' ');
export const initials = (name) => String(name).split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
const pad = (n) => String(n).padStart(2, '0');

const ICONS = {
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  briefcase: <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18M10 12v2h4v-2" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></>,
  chevron: <path d="m9 18 6-6-6-6" />,
  code: <path d="m8 9-4 3 4 3M16 9l4 3-4 3M14 5l-4 14" />,
  leaf: <><path d="M19 3C11 3 5 7.5 5 14c0 2.7 1.8 5 4.5 5 6.5 0 9.5-8 9.5-16Z" /><path d="M4 21c2.5-5 6-8 11-11" /></>,
  route: <><circle cx="6" cy="18" r="2" /><circle cx="18" cy="6" r="2" /><path d="M8 18h7a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h7" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
  spark: <path d="m12 3 1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6L12 3Z" />,
  users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
};

export function Icon({ name, size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICONS[name]}</svg>
  );
}

// Pick an icon from the challenge's first topic.
const TOPIC_ICONS = {
  sustainability: 'leaf', energy: 'leaf', ai: 'code', robotics: 'code', fintech: 'briefcase',
  manufacturing: 'briefcase', healthcare: 'users', 'social-impact': 'users', education: 'users', mobility: 'route',
};
export const topicIcon = (c) => TOPIC_ICONS[c.tags[0]] ?? 'spark';

const PHOTOS = [
  'https://images.unsplash.com/photo-1522071820081-009f0129c71c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1400',
  'https://images.unsplash.com/photo-1603201667141-5a2d4c673378?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1400',
  'https://images.unsplash.com/photo-1603201667230-bd139210db18?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1400',
];

export function statusText(c) {
  switch (c.phase) {
    case 'pending': return 'Pending review';
    case 'open': return c.full ? 'Full' : `Sign-ups close in ${rel(c.signup_deadline)}`;
    case 'locked': return `Starts in ${rel(c.starts_at)}`;
    case 'live': return 'Live now';
    default: return 'Ended';
  }
}

export function StatusTag({ c }) {
  return <span className={`tag${c.phase === 'live' ? ' live' : c.phase === 'ended' ? ' muted' : ''}`}>{statusText(c)}</span>;
}

const sizeLabel = (c) => `${c.format === 'mini' ? 'Mini' : 'Project'} · ${c.duration_label}`;
const modeLabel = (c) => (c.mode === 'team' ? `Team of ${c.team_size}` : 'Solo');

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

export function Tabs({ options, value, onChange }) {
  return (
    <div className="tabs" role="tablist">
      {options.map(([v, text]) => (
        <button key={v} type="button" role="tab" aria-selected={value === v}
          className={value === v ? 'on' : ''} onClick={() => onChange(v)}>{text}</button>
      ))}
    </div>
  );
}

// Dark feature card: copy on the left, photo on the right.
export function FeatureCard({ c, eyebrow, compact = false, action = true }) {
  return (
    <div className={`hero-card${compact ? ' compact' : ''}`}>
      <div className="hero-copy">
        <div>
          <span className={`eyebrow${eyebrow ? '' : ' quiet'}`}>{eyebrow ?? statusText(c)} <span aria-hidden="true">↗</span></span>
          <p className="category-label">{[c.company_name, sizeLabel(c), modeLabel(c)].join(' · ')}</p>
          <h1>{c.title}</h1>
          <p className="hero-description">{c.summary}</p>
        </div>
        <div>
          <div className="hero-meta">
            <span><Icon name="users" size={17} />{c.registrants} joined</span>
            <span><Icon name="calendar" size={17} />{fmtWhen(c)}</span>
            {eyebrow && <span><Icon name="clock" size={17} />{statusText(c)}</span>}
          </div>
          {action && <Link className="btn light" to={`/c/${c.id}`}>View challenge <Icon name="arrow" /></Link>}
        </div>
      </div>
      <div className="hero-visual">
        <img src={PHOTOS[c.id % PHOTOS.length]} alt="" />
        <div className="image-wash" />
        <span className="floating-note">{c.format === 'mini' ? `Mini ${c.duration_label}` : `${c.duration_label} project`}</span>
        <span className="shape shape-one" />
        <span className="shape shape-two" />
      </div>
    </div>
  );
}

export function FeatureCarousel({ items, eyebrow }) {
  const [i, setI] = useState(0);
  if (!items.length) return null;
  const at = i % items.length;
  const move = (d) => setI((at + d + items.length) % items.length);
  return (
    <section className="hero" aria-label="Featured challenges">
      <FeatureCard c={items[at]} eyebrow={eyebrow} />
      {items.length > 1 && (
        <div className="carousel-controls">
          <div className="dots">
            {items.map((c, n) => (
              <button key={c.id} className={n === at ? 'dot active' : 'dot'} onClick={() => setI(n)} aria-label={`Show ${c.title}`} />
            ))}
          </div>
          <div className="arrow-controls">
            <button onClick={() => move(-1)} aria-label="Previous challenge"><Icon name="chevron" /></button>
            <button onClick={() => move(1)} aria-label="Next challenge"><Icon name="chevron" /></button>
          </div>
        </div>
      )}
    </section>
  );
}

export function ChallengeRow({ c, n }) {
  const reasons = c.match?.reasons?.slice(0, 3) ?? [];
  return (
    <article className="challenge-row">
      <span className="row-number">{pad(n)}</span>
      <div className={`category-icon t${c.id % 4}`}><Icon name={topicIcon(c)} size={25} /></div>
      <div className="row-copy">
        <span className="row-category">{[sizeLabel(c), modeLabel(c), ...c.tags.slice(0, 2).map(label)].join(' · ')}</span>
        <h3><Link to={`/c/${c.id}`}>{c.title}</Link></h3>
        <p>{c.summary}</p>
        {reasons.length > 0
          ? <div className="why">{reasons.map((r) => <span key={r}>{r}</span>)}</div>
          : c.skills.length > 0 && (
            <div className="pills"><span>Skills:</span>{c.skills.slice(0, 4).map((s) => <span className="pill" key={s}>{label(s)}</span>)}</div>
          )}
      </div>
      <div className="row-meta">
        <div className="host">
          <div className="mini-avatar">{initials(c.company_name)}</div>
          <span><strong>{c.company_name}</strong>{c.mentor_name ? `Mentor: ${c.mentor_name}` : 'Company challenge'}</span>
        </div>
        <span><Icon name="users" size={16} /> {c.registrants} joined{c.max_participants ? ` / ${c.max_participants}` : ''}</span>
        <span><Icon name="calendar" size={16} /> {fmtWhen(c)}</span>
        {c.match ? <span className="tag">{Math.round(c.match.score * 100)}% match</span> : <StatusTag c={c} />}
      </div>
      <span className="round-arrow" aria-hidden="true"><Icon name="arrow" /></span>
    </article>
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
          <span className="mini-avatar">{initials(m.name)}</span>
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

export function PageHead({ kicker, title, children }) {
  return (
    <div className="page-head">
      <div>{kicker && <span className="kicker">{kicker}</span>}<h1>{title}</h1></div>
      {children && <p>{children}</p>}
    </div>
  );
}

export function Loading({ state }) {
  if (state.error) return <div className="empty">{state.error.message}</div>;
  return <div className="empty">Loading…</div>;
}
