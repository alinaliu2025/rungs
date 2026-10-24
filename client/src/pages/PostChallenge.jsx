import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useSession } from '../lib/session.jsx';
import { localInput, viewerTz } from '../lib/time.js';
import { Icon, PageHead, Segmented, label } from '../components/ui.jsx';
import ImportChallenges from './ImportChallenges.jsx';

// Anyone can submit (no account needed); everything goes to the review queue
// first. If a company account is logged in, it owns the post.
export default function PostChallenge() {
  const { user, meta, notify } = useSession();
  const navigate = useNavigate();
  const [tab, setTab] = useState('form');
  const [mode, setMode] = useState('individual');
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(null);
  const company = user?.role === 'company' ? user : null;
  const defaultTz = meta.timezones.includes(viewerTz) ? viewerTz : meta.timezones[0];

  async function submit(e) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const body = Object.fromEntries(fd);
    body.skills = fd.getAll('skills');
    body.tags = fd.getAll('tags');
    setBusy(true);
    try {
      const { challenge } = await api('/api/challenges', { method: 'POST', body });
      done('Sent for review. It goes live once a reviewer approves it.', `/c/${challenge.id}`);
    } catch (err) {
      notify(err.message, true);
      setBusy(false);
    }
  }

  // Company accounts can follow their posts; anonymous posters get a receipt.
  function done(message, companyPath = '/company') {
    if (company) {
      notify(message);
      navigate(companyPath);
    } else {
      setBusy(false);
      setSubmitted(message);
      window.scrollTo(0, 0);
    }
  }

  const pick = (name, items) => (
    <div className="pick">
      {items.map((i) => <label key={i}><input type="checkbox" name={name} value={i} /><span>{label(i)}</span></label>)}
    </div>
  );

  return (
    <>
      <PageHead kicker="For companies" title="Post a challenge">
        Answer a few questions, or import several at once. A reviewer checks each one before it goes live; then we handle sign-ups and team building.
      </PageHead>

      {submitted ? (
        <div className="panel action" style={{ maxWidth: 640 }}>
          <span className="kicker">Submitted</span>
          <p className="lead" style={{ margin: 0 }}>{submitted}</p>
          <p className="muted">Want to track it and see the teams that form? <Link className="ink" to="/signup?role=company">Create a company account</Link> next time.</p>
          <button className="btn" onClick={() => setSubmitted(null)}>Post another <Icon name="arrow" /></button>
        </div>
      ) : (
      <>
      <div style={{ marginBottom: 40 }}>
        <Segmented options={[['form', 'Fill in the survey'], ['import', 'Import CSV']]} value={tab} onChange={setTab} />
      </div>
      {tab === 'import' ? <ImportChallenges onDone={(msg) => done(msg)} /> : (
      <form className="stack" onSubmit={submit}>
        <div className="group">
          <h3>Who's posting</h3>
          <div className="fields">
          {company
            ? <p>Posting as <b>{company.name}</b>. You'll be able to see the teams.</p>
            : <>
                <label>Company name<input name="company_name" required placeholder="e.g. Lakefront Energy" /></label>
                <p className="hint">No account needed. Create a company account if you want to see the teams that form.</p>
              </>}
          </div>
        </div>

        <div className="group">
          <h3>The problem</h3>
          <div className="fields">
          <label>What should students work on?<input name="title" required placeholder="e.g. Map EV charging gaps in Columbus" /></label>
          <label>One-line pitch<input name="summary" required maxLength={160} /></label>
          <label>Details: data, context, what good looks like<textarea name="description" /></label>
          <div className="row">
            <label>Deliverable<input name="deliverable" placeholder="e.g. demo + 5 slides" /></label>
            <label>Mentor name<input name="mentor_name" /></label>
            <label>Mentor title<input name="mentor_title" /></label>
          </div>
          </div>
        </div>

        <div className="group">
          <h3>Format</h3>
          <div className="row">
            <label>Size
              <select name="format">
                <option value="mini">Mini challenge (hours to a few days)</option>
                <option value="project">Project (4–6 weeks)</option>
              </select>
            </label>
            <label>Individual or team?
              <select name="mode" value={mode} onChange={(e) => setMode(e.target.value)}>
                <option value="individual">Individual</option>
                <option value="team">Team</option>
              </select>
            </label>
            <label>Team size<input name="team_size" type="number" min="2" max="8" defaultValue="4" disabled={mode !== 'team'} /></label>
            <label>Expected hours / week<input name="hours_per_week" type="number" min="1" max="40" defaultValue="4" /></label>
          </div>
        </div>

        <div className="group">
          <h3>Schedule</h3>
          <div className="fields">
          <p className="hint">Students sign up ahead of time. When sign-ups close, we lock the list and form teams automatically.</p>
          <div className="row">
            <label>Time zone
              <select name="timezone" defaultValue={defaultTz}>
                {meta.timezones.map((t) => <option key={t}>{t}</option>)}
              </select>
            </label>
            <label>Sign-ups close<input name="signup_deadline" type="datetime-local" required defaultValue={localInput(7, 23, 59)} /></label>
            <label>Starts<input name="starts_at" type="datetime-local" required defaultValue={localInput(10, 17)} /></label>
            <label>Ends<input name="ends_at" type="datetime-local" required defaultValue={localInput(10, 18)} /></label>
            <label>Max participants <span className="muted">(optional)</span>
              <input name="max_participants" type="number" min="1" placeholder="No limit" />
            </label>
          </div>
          </div>
        </div>

        <div className="group"><h3>Skills this needs</h3>{pick('skills', meta.skills)}</div>
        <div className="group"><h3>Topics</h3>{pick('tags', meta.interests)}</div>
        <div className="form-actions"><button className="btn" disabled={busy}>Submit for review <Icon name="arrow" /></button></div>
      </form>
      )}
      </>
      )}
    </>
  );
}
