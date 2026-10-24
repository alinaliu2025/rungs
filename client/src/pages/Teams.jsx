import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useLoad } from '../lib/session.jsx';
import { Loading, MemberList, label } from '../components/ui.jsx';

function Stat({ name, value }) {
  const pct = Math.round(value * 100);
  return (
    <div className="stat">
      <span>{name}</span>
      <span className="meter"><i style={{ width: `${pct}%` }} /></span>
      <span>{pct}%</span>
    </div>
  );
}

// Internal view for the company that posted the challenge.
export default function Teams() {
  const { id } = useParams();
  const state = useLoad(() => api(`/api/challenges/${id}/teams`), [id]);
  if (!state.data) return <Loading state={state} />;
  const { challenge: c, teams } = state.data;

  return (
    <>
      <Link to={`/c/${c.id}`} className="back">‹ Back to challenge</Link>
      <div className="page-head">
        <h1>{c.title}</h1>
        <p>Internal view. Students only see their own team and teammates, never these scores.</p>
      </div>
      {teams.length ? (
        <div className="grid">
          {teams.map((t) => (
            <div className="panel" key={t.id}>
              <h3>{t.name}</h3>
              <div style={{ display: 'grid', gap: '.35rem', marginBottom: '1rem' }}>
                <Stat name="Avg strength" value={t.metrics.avgStrength} />
                <Stat name="Skill coverage" value={t.metrics.coverage} />
                <Stat name="Major mix" value={t.metrics.majorMix} />
              </div>
              <MemberList members={t.members}>
                {(m) => <div className="small muted">{c.skills.map((s) => `${label(s)} ${m.skills[s] || 0}`).join(' · ')}</div>}
              </MemberList>
            </div>
          ))}
        </div>
      ) : <div className="empty">Teams have not been formed yet.</div>}
    </>
  );
}
