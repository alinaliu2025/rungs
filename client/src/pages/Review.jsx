import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useLoad, useSession } from '../lib/session.jsx';
import { fmtFull, fmtWhen } from '../lib/time.js';
import { Icon, Loading, PageHead, label } from '../components/ui.jsx';

// What a reviewer checks before a challenge goes live.
const CHECKLIST = [
  'Real company and a reachable mentor',
  'Clear, doable scope for the time asked',
  'Community, not recruiting: no unpaid work dressed up as a project',
  'Dates make sense and sign-ups are still open',
];

export default function Review() {
  const { user } = useSession();
  const state = useLoad(() => api('/api/review/challenges'), []);
  if (user?.role !== 'reviewer') return <Navigate to="/login" replace />;
  if (!state.data) return <Loading state={state} />;
  const { pending, recent } = state.data;

  return (
    <>
      <PageHead kicker="Reviewer" title="Review queue">
        Every posted or imported challenge waits here. Approve to publish it on the front page, or reject with a note so the company knows what to fix.
      </PageHead>

      <div className="detail-grid">
        <div>
          {pending.length
            ? pending.map((c) => <ReviewItem key={c.id} c={c} onDone={state.reload} />)
            : <div className="empty boxed">The queue is empty. Nice.</div>}

          {recent.length > 0 && (
            <section style={{ marginTop: 56 }}>
              <span className="kicker">Recently reviewed</span>
              <div className="rows">
                {recent.map((c) => (
                  <div className="list-row" key={c.id}>
                    <div>
                      <h3 style={{ fontSize: 15 }}>{c.status === 'published' ? <Link to={`/c/${c.id}`}>{c.title}</Link> : c.title}</h3>
                      <div className="small muted">{c.company_name}{c.review_note && ` · “${c.review_note}”`}</div>
                    </div>
                    <div className="actions"><span className={`tag${c.status === 'rejected' ? '' : ' muted'}`}>{c.status === 'published' ? 'Approved' : 'Rejected'}</span></div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
        <aside>
          <div className="panel">
            <h3>Checklist</h3>
            <ul className="team-list">{CHECKLIST.map((item) => <li key={item} className="small"><Icon name="spark" size={14} />{item}</li>)}</ul>
          </div>
          <div className="panel">
            <h3>Queue</h3>
            <p className="lead" style={{ margin: 0 }}>{pending.length} waiting</p>
            <p className="small muted">{pending.filter((c) => c.source === 'import').length} from CSV imports</p>
          </div>
        </aside>
      </div>
    </>
  );
}

function ReviewItem({ c, onDone }) {
  const { notify } = useSession();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const expired = Date.parse(c.signup_deadline) <= Date.now();

  async function decide(decision) {
    setBusy(true);
    try {
      await api(`/api/review/challenges/${c.id}`, { method: 'POST', body: { decision, note } });
      notify(decision === 'approve' ? `Published “${c.title}”.` : `Rejected “${c.title}”.`);
      onDone();
    } catch (err) {
      notify(err.message, true);
      setBusy(false);
    }
  }

  return (
    <article className="block" style={{ borderTop: '1px solid var(--line)', paddingTop: 28 }}>
      <span className="row-category">
        {[c.source === 'import' ? 'CSV import' : 'Survey', c.company_id ? 'Company account' : 'No account',
          c.format === 'mini' ? 'Mini' : 'Project', c.mode === 'team' ? `Team of ${c.team_size}` : 'Solo'].join(' · ')}
      </span>
      <h3 style={{ fontSize: 22, letterSpacing: '-.025em', margin: '8px 0 6px' }}>{c.title}</h3>
      <p className="muted" style={{ marginBottom: 8 }}>{c.company_name} · {c.summary}</p>
      {c.description && <p className="small muted">{c.description}</p>}
      <div className="facts">
        <div><span>When</span><span>{fmtWhen(c)}</span></div>
        <div><span>Sign-ups close</span><span style={expired ? { color: 'var(--scarlet)' } : undefined}>{fmtFull(c.signup_deadline, c.timezone)}</span></div>
        <div><span>Mentor</span><span>{c.mentor_name ? `${c.mentor_name}${c.mentor_title ? `, ${c.mentor_title}` : ''}` : 'None listed'}</span></div>
        <div><span>Time ask</span><span>~{c.hours_per_week} hrs/week{c.max_participants ? ` · cap ${c.max_participants}` : ''}</span></div>
      </div>
      {c.skills.length > 0 && <div className="pills">{c.skills.map((s) => <span className="pill" key={s}>{label(s)}</span>)}</div>}
      <div style={{ display: 'grid', gap: 12, marginTop: 20 }}>
        <label>Note to the company <span className="muted">(required to reject)</span>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Please add a mentor and shorten the scope." />
        </label>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn" disabled={busy || expired} onClick={() => decide('approve')}>Approve & publish <Icon name="arrow" /></button>
          <button className="btn secondary" disabled={busy} onClick={() => decide('reject')}>Reject</button>
        </div>
        {expired && <p className="small" style={{ color: 'var(--scarlet)' }}>Sign-ups would already be closed. Reject so it can be resubmitted with new dates.</p>}
      </div>
    </article>
  );
}
