import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useLoad, useSession } from '../lib/session.jsx';
import { Icon, Loading, PageHead, StatusTag } from '../components/ui.jsx';
import { Links } from '../components/pipeline.jsx';

const CATEGORIES = [['impact', 'Impact'], ['execution', 'Execution'], ['presentation', 'Presentation']];

// Judging: score every submission 1-5 in three categories, then pick winners.
export default function Judge() {
  const { id } = useParams();
  const { notify } = useSession();
  const state = useLoad(() => api(`/api/challenges/${id}/submissions`), [id]);
  const [places, setPlaces] = useState({});
  const [busy, setBusy] = useState(false);
  if (!state.data) return <Loading state={state} />;

  const { challenge: c, submissions, expected } = state.data;
  const published = Boolean(c.results_published_at);
  const canGrade = c.phase === 'ended' && !published;
  const allGraded = submissions.length > 0 && submissions.every((s) => s.graded_at);
  const ranked = [...submissions].sort((a, b) => (b.total ?? -1) - (a.total ?? -1));

  function suggest() {
    setPlaces(Object.fromEntries(ranked.slice(0, 3).map((s, i) => [s.id, i + 1])));
  }

  async function publish() {
    const winners = Object.entries(places).filter(([, p]) => p).sort((a, b) => a[1] - b[1]).map(([sid]) => Number(sid));
    setBusy(true);
    try {
      await api(`/api/challenges/${c.id}/results`, { method: 'POST', body: { winners } });
      notify('Winners announced!');
      state.reload();
    } catch (err) {
      notify(err.message, true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Link to={`/c/${c.id}`} className="back">‹ Back to challenge</Link>
      <PageHead kicker={`Judging · ${submissions.length} of ${expected} submitted`} title={c.title}>
        {published ? 'Results are published. Winners are on the challenge page and every team can see its feedback.'
          : canGrade ? 'Score each submission from 1 to 5, add a line of feedback, then pick up to three winners.'
            : 'Submissions are still coming in. Grading opens when the challenge ends.'}
      </PageHead>

      <div className="rows">
        {ranked.map((s) => (
          <GradeRow key={s.id} s={s} canGrade={canGrade} published={published} onSaved={state.reload}
            place={places[s.id] ?? s.place ?? ''} setPlace={(p) => setPlaces({ ...places, [s.id]: p })} />
        ))}
        {!submissions.length && <div className="empty">No submissions yet.</div>}
      </div>

      {canGrade && submissions.length > 0 && (
        <div className="form-actions" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginTop: 24 }}>
          <button className="btn secondary" disabled={!allGraded} onClick={suggest}>Suggest top 3 by score</button>
          <button className="btn" disabled={busy || !allGraded || !Object.values(places).some(Boolean)} onClick={publish}>
            Announce winners <Icon name="arrow" />
          </button>
          {!allGraded && <span className="hint">Grade every submission to pick winners.</span>}
        </div>
      )}
      <p style={{ marginTop: 24 }}><StatusTag c={c} /></p>
    </>
  );
}

function GradeRow({ s, canGrade, published, onSaved, place, setPlace }) {
  const { notify } = useSession();
  const [scores, setScores] = useState({ impact: s.score_impact ?? '', execution: s.score_execution ?? '', presentation: s.score_presentation ?? '' });
  const [feedback, setFeedback] = useState(s.feedback ?? '');
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      await api(`/api/submissions/${s.id}/grade`, { method: 'PUT', body: { ...scores, feedback } });
      notify(`Saved grade for ${s.team_name ?? s.members[0]}.`);
      onSaved();
    } catch (err) {
      notify(err.message, true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="list-row" style={{ alignItems: 'start' }}>
      <div>
        <span className="row-category">{[s.team_name, s.members.join(', ')].filter(Boolean).join(' · ')}</span>
        <h3 style={{ margin: '6px 0 4px' }}>{s.title}</h3>
        {s.summary && <p className="small muted">{s.summary}</p>}
        <Links s={s} />
        {canGrade && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(90px, 140px)) 1fr', gap: 14, marginTop: 16, alignItems: 'end' }}>
            {CATEGORIES.map(([k, name]) => (
              <label key={k}>{name}
                <select value={scores[k]} onChange={(e) => setScores({ ...scores, [k]: e.target.value })} aria-label={`${name} score`}>
                  <option value="">–</option>
                  {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
            ))}
            <label>Feedback<input value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="One line the team will see" /></label>
          </div>
        )}
        {!canGrade && s.feedback && <p className="small" style={{ marginTop: 10 }}>“{s.feedback}”</p>}
      </div>
      <div className="actions" style={{ flexDirection: 'column', alignItems: 'flex-end' }}>
        {s.total != null ? <span className="tag">{s.total}/15</span> : <span className="tag muted">Not graded</span>}
        {canGrade && <button className="btn small" disabled={busy} onClick={save}>Save grade</button>}
        {canGrade && s.graded_at && (
          <select value={place} onChange={(e) => setPlace(Number(e.target.value) || '')} aria-label="Place" style={{ width: 110 }}>
            <option value="">No place</option>
            <option value="1">1st place</option>
            <option value="2">2nd place</option>
            <option value="3">3rd place</option>
          </select>
        )}
        {published && s.place && <span className="tag live">{['', '1st', '2nd', '3rd'][s.place]} place</span>}
      </div>
    </div>
  );
}
