import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useLoad, useSession } from '../lib/session.jsx';
import { Icon, MemberList, PageHead, Segmented, label } from '../components/ui.jsx';

function Meter({ value, max = 1 }) {
  return <span className="meter"><i style={{ width: `${Math.min(100, (value / max) * 100)}%` }} /></span>;
}

// Compare our sorting against random assignment on the same pool.
function Compare({ sorted, random }) {
  const rows = [
    ['Skill coverage', 'coverage', 'Higher is better: every team has someone strong in each needed skill'],
    ['Strength spread', 'strengthSpread', 'Lower is better: no stacked or stranded teams'],
    ['Major mix', 'majorMix', 'Higher is better: people meet outside their major'],
    ['Role mix', 'roleMix', 'Higher is better: builders, designers, organizers together'],
  ];
  const pct = (v) => `${Math.round(v * 100)}%`;
  return (
    <div className="rows">
      {rows.map(([name, key, hint]) => {
        const lowerBetter = key === 'strengthSpread';
        const win = lowerBetter ? sorted[key] < random[key] : sorted[key] > random[key];
        const max = lowerBetter ? Math.max(sorted[key], random[key], 0.01) : 1;
        return (
          <div className="list-row" key={key} style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.2fr)' }}>
            <div>
              <h3 style={{ fontSize: 15 }}>{name} {win && <span className="tag" style={{ marginLeft: 6 }}>Rungs wins</span>}</h3>
              <div className="small muted">{hint}</div>
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              <div className="stat"><span>Rungs sorting</span><Meter value={sorted[key]} max={max} /><span>{pct(sorted[key])}</span></div>
              <div className="stat"><span>Random</span><Meter value={random[key]} max={max} /><span>{pct(random[key])}</span></div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function Simulator() {
  const { user, meta, notify } = useSession();
  const challenges = useLoad(() => api('/api/challenges').then((r) => r.challenges.filter((c) => c.mode === 'team')), []);
  const [source, setSource] = useState('challenge');
  const [challengeId, setChallengeId] = useState('');
  const [skills, setSkills] = useState(['python', 'ui-design', 'presentation']);
  const [teamSize, setTeamSize] = useState(4);
  const [students, setStudents] = useState(16);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!challengeId && challenges.data?.length) setChallengeId(String(challenges.data[0].id));
  }, [challenges.data, challengeId]);

  if (!['company', 'reviewer'].includes(user?.role)) return <Navigate to="/login" replace />;

  async function run(seed) {
    setBusy(true);
    try {
      const body = source === 'challenge'
        ? { challenge_id: Number(challengeId), students, seed }
        : { skills, team_size: teamSize, students, seed };
      setResult(await api('/api/simulate', { method: 'POST', body }));
    } catch (err) {
      notify(err.message, true);
    } finally {
      setBusy(false);
    }
  }

  const toggleSkill = (s) => setSkills((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));

  return (
    <>
      <PageHead kicker="Team sorting · internal" title="Team simulator">
        Generate a pool of sample students, sort them the way Rungs does at a sign-up deadline, and compare against random teams.
        Nothing here is saved, and students never see this.
      </PageHead>

      <div className="stack">
        <div className="group">
          <h3>Challenge</h3>
          <div className="fields">
            <Segmented options={[['challenge', 'Use a live challenge'], ['custom', 'Custom']]} value={source} onChange={setSource} />
            {source === 'challenge' ? (
              <label>Team challenge
                <select value={challengeId} onChange={(e) => setChallengeId(e.target.value)}>
                  {(challenges.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.title} · teams of {c.team_size}</option>)}
                </select>
              </label>
            ) : (
              <>
                <div className="pick">
                  {meta.skills.map((s) => (
                    <label key={s}><input type="checkbox" checked={skills.includes(s)} onChange={() => toggleSkill(s)} /><span>{label(s)}</span></label>
                  ))}
                </div>
                <label style={{ maxWidth: 200 }}>Team size<input type="number" min="2" max="8" value={teamSize} onChange={(e) => setTeamSize(Number(e.target.value))} /></label>
              </>
            )}
          </div>
        </div>
        <div className="group">
          <h3>Pool</h3>
          <div className="fields">
            <label>Students signing up: {students}
              <input type="range" min="4" max="60" value={students} onChange={(e) => setStudents(Number(e.target.value))} style={{ border: 0, padding: 0 }} />
            </label>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button className="btn" disabled={busy} onClick={() => run(result?.seed)}>Run simulation <Icon name="arrow" /></button>
              {result && <button className="btn secondary" disabled={busy} onClick={() => run(undefined)}>New random pool</button>}
            </div>
          </div>
        </div>
      </div>

      {result && (
        <>
          <section className="section" style={{ paddingBottom: 40, marginTop: 40 }}>
            <div className="section-heading" style={{ marginBottom: 32 }}>
              <div>
                <span className="kicker">Pool #{result.seed} · {result.pool} students · teams of {result.teamSize}</span>
                <h2>Rungs vs random</h2>
              </div>
              <p className="section-intro">Needs: {result.skills.map(label).join(', ')}. Same students both times; only the sorting changes.</p>
            </div>
            <Compare sorted={result.sorted} random={result.random} />
          </section>

          <section style={{ paddingBottom: 40 }}>
            <span className="kicker">{result.teams.length} teams formed</span>
            <div className="grid">
              {result.teams.map((t) => (
                <div className="panel" key={t.name}>
                  <h3>{t.name}</h3>
                  <div style={{ display: 'grid', gap: 8, marginBottom: 20 }}>
                    <div className="stat"><span>Avg strength</span><Meter value={t.metrics.avgStrength} /><span>{Math.round(t.metrics.avgStrength * 100)}%</span></div>
                    <div className="stat"><span>Coverage</span><Meter value={t.metrics.coverage} /><span>{Math.round(t.metrics.coverage * 100)}%</span></div>
                  </div>
                  <MemberList members={t.members}>
                    {(m) => <div className="small muted">{result.skills.map((s) => `${label(s)} ${m.skills[s] || 0}`).join(' · ')}</div>}
                  </MemberList>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </>
  );
}
