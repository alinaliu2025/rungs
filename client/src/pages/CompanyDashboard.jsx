import { Link, Navigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useLoad, useSession } from '../lib/session.jsx';
import { fmtWhen } from '../lib/time.js';
import { Loading, StatusChip } from '../components/ui.jsx';

export default function CompanyDashboard() {
  const { user } = useSession();
  const state = useLoad(() => api('/api/company/challenges').then((r) => r.challenges), []);
  if (user?.role !== 'company') return <Navigate to="/login" replace />;
  if (!state.data) return <Loading state={state} />;

  return (
    <>
      <div className="page-head">
        <h1>Your challenges</h1>
        <p>Teams form on their own when sign-ups close. You can close sign-ups early from a challenge's page.</p>
      </div>
      <p><Link className="btn" to="/post">Post a challenge</Link></p>
      {state.data.length ? (
        <div className="rows">
          {state.data.map((c) => (
            <div className="list-row" key={c.id}>
              <div>
                <h3><Link to={`/c/${c.id}`}>{c.title}</Link></h3>
                <div className="small muted">
                  {fmtWhen(c)} · {c.registrants} joined{c.max_participants ? ` / ${c.max_participants}` : ''}
                </div>
              </div>
              <div className="actions">
                <StatusChip c={c} />
                {c.teams_formed && <Link className="btn small secondary" to={`/teams/${c.id}`}>Teams</Link>}
              </div>
            </div>
          ))}
        </div>
      ) : <div className="empty">No challenges yet.</div>}
    </>
  );
}
