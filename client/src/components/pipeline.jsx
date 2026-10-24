import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useSession } from '../lib/session.jsx';
import { Icon } from './ui.jsx';

const PLACE = { 1: '1st place', 2: '2nd place', 3: '3rd place' };
const host = (url) => { try { return new URL(url).host.replace(/^www\./, ''); } catch { return url; } };

export function Links({ s }) {
  return (
    <div className="pills" style={{ marginTop: 10 }}>
      <a className="pill" href={s.repo_url} target="_blank" rel="noreferrer">{host(s.repo_url)} ↗</a>
      {s.demo_url && <a className="pill" href={s.demo_url} target="_blank" rel="noreferrer">Demo ↗</a>}
    </div>
  );
}

// Public winners list.
export function Results({ results }) {
  return (
    <div className="block">
      <span className="kicker">Results · {results.submissions} submissions</span>
      <h3 style={{ fontSize: 22, letterSpacing: '-.025em' }}>Winners</h3>
      <div className="rows" style={{ marginTop: 12 }}>
        {results.winners.map((w) => (
          <div className="list-row" key={w.place}>
            <div>
              <span className="row-category">{PLACE[w.place]}{w.total != null && ` · ${w.total}/15`}</span>
              <h3 style={{ margin: '6px 0 4px' }}>{w.title}</h3>
              <div className="small muted">{[w.team_name, w.members.join(', ')].filter(Boolean).join(' · ')}</div>
              {w.summary && <p className="small muted" style={{ marginTop: 6 }}>{w.summary}</p>}
              <Links s={w} />
            </div>
            <div className="actions"><span className={`tag${w.place === 1 ? ' live' : ''}`}>{PLACE[w.place]}</span></div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Student's submission: form while live, read-only after, plus feedback once published.
export function SubmissionPanel({ c, reload }) {
  const { notify } = useSession();
  const s = c.mySubmission;
  const [form, setForm] = useState({ title: s?.title ?? '', summary: s?.summary ?? '', repo_url: s?.repo_url ?? '', demo_url: s?.demo_url ?? '' });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const who = c.mode === 'team' ? `for ${c.myTeam?.name ?? 'your team'}` : '';

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await api(`/api/challenges/${c.id}/submission`, { method: 'PUT', body: form });
      notify(s ? 'Submission updated.' : 'Submitted! You can update it until the challenge ends.');
      reload();
    } catch (err) {
      notify(err.message, true);
    } finally {
      setBusy(false);
    }
  }

  if (c.phase === 'live') {
    return (
      <div className="block">
        <span className="kicker">Your submission {who}</span>
        <form className="stack" style={{ gap: 16 }} onSubmit={save}>
          <label>Project name<input value={form.title} onChange={set('title')} required placeholder="e.g. Signal" /></label>
          <label>GitHub repo or project link<input value={form.repo_url} onChange={set('repo_url')} required type="url" placeholder="https://github.com/your-team/project" /></label>
          <label>Demo, slides or video <span className="muted">(optional)</span><input value={form.demo_url} onChange={set('demo_url')} type="url" placeholder="https://…" /></label>
          <label>What you built<textarea value={form.summary} onChange={set('summary')} maxLength={600} placeholder="Two or three sentences for the judges." /></label>
          <div>
            <button className="btn" disabled={busy}>{s ? 'Update submission' : 'Submit project'} <Icon name="arrow" /></button>
            {c.mode === 'team' && <p className="hint" style={{ marginTop: 10 }}>One submission per team; any teammate can update it until the end.</p>}
          </div>
        </form>
      </div>
    );
  }
  if (!s) {
    return c.phase === 'ended' ? <div className="block"><span className="kicker">Your submission</span><p className="muted">No submission was made.</p></div> : null;
  }
  return (
    <div className="block">
      <span className="kicker">Your submission {who}</span>
      <h3 style={{ fontSize: 20, margin: '4px 0' }}>{s.title} {s.place && <span className="tag live" style={{ marginLeft: 8 }}>{PLACE[s.place]}</span>}</h3>
      {s.summary && <p className="small muted">{s.summary}</p>}
      <Links s={s} />
      {c.results_published_at ? (
        s.scores && (
          <div className="panel" style={{ marginTop: 18 }}>
            <h3>Feedback from {c.company_name}</h3>
            <div className="facts" style={{ marginTop: 0 }}>
              <div><span>Impact</span><span>{s.scores.impact}/5</span></div>
              <div><span>Execution</span><span>{s.scores.execution}/5</span></div>
              <div><span>Presentation</span><span>{s.scores.presentation}/5</span></div>
              <div><span>Total</span><span>{s.scores.total}/15</span></div>
            </div>
            {s.feedback && <p style={{ marginTop: 16 }}>“{s.feedback}”</p>}
          </div>
        )
      ) : <p className="hint" style={{ marginTop: 12 }}>Judging in progress. Scores and feedback appear when winners are announced.</p>}
    </div>
  );
}

// Fast-forward controls, only when the server runs in demo mode.
export function DemoControls({ c, reload }) {
  const { meta, notify } = useSession();
  const [busy, setBusy] = useState(false);
  if (!meta.demo) return null;

  async function run(path, message) {
    setBusy(true);
    try {
      const r = await api(`/api/demo/challenges/${c.id}/${path}`, { method: 'POST', body: { count: 8 } });
      notify(typeof message === 'function' ? message(r) : message);
      reload();
    } catch (err) {
      notify(err.message, true);
    } finally {
      setBusy(false);
    }
  }

  const next = {
    pending: 'Approve (skip review)',
    open: c.mode === 'team' ? 'Close sign-ups & form teams' : 'Close sign-ups',
    locked: 'Start the challenge',
    live: 'End the challenge',
  }[c.phase];
  const extra = ['open', 'live'].includes(c.phase) || (c.phase === 'ended' && !c.results_published_at);
  if (!next && !extra) return null;

  return (
    <div className="panel action" style={{ borderStyle: 'dashed' }}>
      <span className="kicker">Demo controls</span>
      <p className="small muted">Fast-forward this challenge so the whole flow fits in a few minutes. Dev mode only.</p>
      {c.phase === 'open' && <button className="btn secondary small" disabled={busy} onClick={() => run('fill', (r) => `${r.added} sample students signed up.`)}>Add 8 sample sign-ups</button>}
      {c.phase === 'live' && <button className="btn secondary small" disabled={busy} onClick={() => run('sample-submissions', (r) => `${r.added} sample submissions added.`)}>Add sample submissions</button>}
      {c.phase === 'ended' && !c.results_published_at && <button className="btn secondary small" disabled={busy} onClick={() => run('sample-grades', (r) => `${r.graded} submissions auto-graded.`)}>Auto-grade the rest</button>}
      {next && <button className="btn small" disabled={busy} onClick={() => run('advance', `Moved on: ${next.toLowerCase()}.`)}>Fast-forward: {next} <Icon name="arrow" /></button>}
      {c.canJudge && ['live', 'ended'].includes(c.phase) && <Link className="btn ghost small" to={`/judge/${c.id}`}>Open judging →</Link>}
    </div>
  );
}
