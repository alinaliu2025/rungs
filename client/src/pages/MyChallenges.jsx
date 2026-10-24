import { Link, Navigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useLoad, useSession } from '../lib/session.jsx';
import { fmtWhen } from '../lib/time.js';
import { Loading, PageHead, StatusTag } from '../components/ui.jsx';

export default function MyChallenges() {
  const { user } = useSession();
  const state = useLoad(() => api('/api/my/challenges').then((r) => r.challenges), []);
  if (user?.role !== 'student') return <Navigate to="/login" replace />;
  if (!state.data) return <Loading state={state} />;

  const active = state.data.filter((c) => c.phase !== 'ended');
  const done = state.data.filter((c) => c.phase === 'ended');

  return (
    <>
      <PageHead kicker="Student" title="My challenges">Everything you've signed up for, with your team once it's set.</PageHead>
      {active.length
        ? <div className="rows">{active.map((c) => <Row key={c.id} c={c} />)}</div>
        : <div className="empty boxed">Nothing yet. <Link className="ink" to="/">Find a challenge</Link>.</div>}
      {done.length > 0 && (
        <section style={{ marginTop: 56 }}>
          <span className="kicker">Finished</span>
          <div className="rows">{done.map((c) => <Row key={c.id} c={c} />)}</div>
        </section>
      )}
    </>
  );
}

function Row({ c }) {
  return (
    <Link className="list-row" to={`/c/${c.id}`}>
      <div>
        <h3>{c.title}</h3>
        <div className="small muted">{c.company_name} · {fmtWhen(c)}</div>
        {c.mode === 'team' && (
          <div className="small" style={{ marginTop: '.3rem' }}>
            {c.myTeam
              ? <><b>{c.myTeam.name}</b>: {c.myTeam.members.map((m) => m.name).join(', ')}</>
              : <span className="muted">Team announced when sign-ups close</span>}
          </div>
        )}
      </div>
      <div className="actions"><StatusTag c={c} /></div>
    </Link>
  );
}
