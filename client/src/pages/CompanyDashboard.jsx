import { Link, Navigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useLoad, useSession } from '../lib/session.jsx';
import { fmtWhen } from '../lib/time.js';
import { Icon, Loading, PageHead, StatusTag } from '../components/ui.jsx';

export default function CompanyDashboard() {
  const { user } = useSession();
  const state = useLoad(() => api('/api/company/challenges').then((r) => r.challenges), []);
  if (user?.role !== 'company') return <Navigate to="/login" replace />;
  if (!state.data) return <Loading state={state} />;

  return (
    <>
      <PageHead kicker="Company" title="Your challenges">
        New posts wait for a reviewer before going live. Teams form on their own when sign-ups close; you can close sign-ups early from a challenge's page.
      </PageHead>
      <p style={{ marginBottom: 32, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <Link className="btn" to="/post">Post a challenge <Icon name="arrow" /></Link>
        <Link className="btn secondary" to="/simulate">Try the team simulator</Link>
      </p>
      {state.data.length ? (
        <div className="rows">
          {state.data.map((c) => (
            <div className="list-row" key={c.id}>
              <div>
                <h3><Link to={`/c/${c.id}`}>{c.title}</Link></h3>
                <div className="small muted">
                  {fmtWhen(c)} · {c.registrants} joined{c.max_participants ? ` / ${c.max_participants}` : ''}
                </div>
                {c.review_note && <div className="small" style={{ color: 'var(--scarlet)', marginTop: 4 }}>Reviewer: “{c.review_note}”</div>}
              </div>
              <div className="actions">
                <StatusTag c={c} />
                {c.teams_formed && <Link className="btn small secondary" to={`/teams/${c.id}`}>Teams</Link>}
              </div>
            </div>
          ))}
        </div>
      ) : <div className="empty boxed">No challenges yet.</div>}
    </>
  );
}
