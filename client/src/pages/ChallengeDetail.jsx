import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useLoad, useSession } from '../lib/session.jsx';
import { fmtDay, fmtFull, rel } from '../lib/time.js';
import { FeatureCard, Icon, Loading, MemberList, Timeline, label } from '../components/ui.jsx';

export default function ChallengeDetail() {
  const { id } = useParams();
  const state = useLoad(() => api(`/api/challenges/${id}`).then((r) => r.challenge), [id]);
  if (!state.data) return <Loading state={state} />;
  const c = state.data;
  const spots = c.max_participants ? `${Math.max(0, c.max_participants - c.registrants)} of ${c.max_participants} left` : 'No limit';

  return (
    <>
      <Link to="/" className="back">‹ All challenges</Link>
      <section className="detail-hero"><FeatureCard c={c} compact action={false} /></section>

      <div className="detail-grid">
        <div>
          <div className="block">
            <span className="kicker">The challenge</span>
            <p className="lead">{c.summary}</p>
            {c.description && <p className="muted">{c.description}</p>}
            <div className="facts">
              {c.deliverable && <div><span>You'll ship</span><span>{c.deliverable}</span></div>}
              {c.mentor_name && <div><span>Mentor</span><span>{c.mentor_name}{c.mentor_title && `, ${c.mentor_title}`}</span></div>}
              <div><span>Time</span><span>~{c.hours_per_week} hrs/week</span></div>
              <div><span>Spots</span><span>{spots}</span></div>
            </div>
          </div>
          {(c.skills.length > 0 || c.tags.length > 0) && (
            <div className="block">
              <h3>Skills & topics</h3>
              <div className="pills" style={{ marginTop: 0 }}>
                {c.skills.map((s) => <span className="pill" key={s}>{label(s)}</span>)}
                {c.tags.map((t) => <span className="pill" key={t}>#{label(t)}</span>)}
              </div>
            </div>
          )}
          {c.myTeam && (
            <div className="block">
              <h3>Your team · {c.myTeam.name}</h3>
              <MemberList members={c.myTeam.members} />
              <p className="small muted" style={{ marginTop: 16 }}>
                Kickoff {fmtFull(c.starts_at, c.timezone)} with {c.mentor_name || 'your mentor'}.
              </p>
            </div>
          )}
        </div>
        <aside>
          <div className="panel"><h3>Schedule</h3><Timeline c={c} /></div>
          <Action c={c} reload={state.reload} />
        </aside>
      </div>
    </>
  );
}

function Action({ c, reload }) {
  const { user, profile, notify } = useSession();
  const navigate = useNavigate();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  async function run(fn, success) {
    setBusy(true);
    try {
      await fn();
      if (success) notify(success);
      reload();
    } catch (err) {
      notify(err.message, true);
    } finally {
      setBusy(false);
    }
  }

  const join = () => {
    if (!profile) return navigate('/profile');
    run(() => api(`/api/challenges/${c.id}/join`, { method: 'POST', body: { note } }),
      c.mode === 'team' ? "You're in the pool. We'll match you to a team." : 'Spot saved. See you there!');
  };
  const leave = () => run(() => api(`/api/challenges/${c.id}/join`, { method: 'DELETE' }));
  const formNow = () => run(() => api(`/api/company/challenges/${c.id}/form-teams`, { method: 'POST' }), 'Teams formed');

  let body = null;
  if (!user) {
    body = <Link className="btn" to="/signup">Sign up to join <Icon name="arrow" /></Link>;
  } else if (user.role === 'company') {
    if (c.isOwner && c.mode === 'team') {
      body = (
        <>
          {['open', 'locked'].includes(c.phase) && (
            <button className="btn secondary" disabled={busy || c.registrants < 2} onClick={formNow}>
              {c.phase === 'open' ? 'Close sign-ups & form teams' : 'Re-sort teams'}
            </button>
          )}
          {c.teams_formed && <Link className="btn ghost" to={`/teams/${c.id}`}>View teams</Link>}
        </>
      );
    }
  } else if (c.myTeam) {
    body = <p><b>You're on {c.myTeam.name}.</b></p>;
  } else if (c.joined && c.phase === 'open') {
    body = (
      <>
        <p>
          <b>You're in.</b>{' '}
          {c.mode === 'team'
            ? `Teams are announced when sign-ups close in ${rel(c.signup_deadline)}.`
            : `See you ${fmtDay(c.starts_at, c.timezone)}.`}
        </p>
        <button className="btn ghost" disabled={busy} onClick={leave}>Leave</button>
      </>
    );
  } else if (c.joined) {
    body = c.mode === 'team'
      ? <p className="muted">Not enough people signed up to form a team. The company will follow up.</p>
      : <p><b>You're in.</b></p>;
  } else if (c.phase !== 'open') {
    body = <p className="muted">Sign-ups are closed.</p>;
  } else if (c.full) {
    body = <p className="muted">This challenge is full.</p>;
  } else {
    body = (
      <>
        <label>Anything the mentor should know? <span className="muted">(optional)</span>
          <textarea maxLength={280} value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        <button className="btn" disabled={busy} onClick={join}>{c.mode === 'team' ? 'Join the team pool' : 'Save my spot'} <Icon name="arrow" /></button>
        <p className="small muted">Sign-ups close {fmtFull(c.signup_deadline, c.timezone)}.</p>
      </>
    );
  }

  if (!body) return null;
  return <div className="panel action">{body}</div>;
}
