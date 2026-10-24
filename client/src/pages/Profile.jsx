import { Navigate, useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useSession } from '../lib/session.jsx';
import { label } from '../components/ui.jsx';

const LEVELS = { 1: 'Learning', 2: 'Comfortable', 3: 'Strong' };
const thisYear = new Date().getFullYear();
const GRAD_YEARS = Array.from({ length: 9 }, (_, i) => thisYear + i);

export default function Profile() {
  const { user, profile, meta, refresh, notify } = useSession();
  const navigate = useNavigate();
  if (user?.role !== 'student') return <Navigate to="/login" replace />;

  const p = profile ?? { skills: {}, interests: [], hours_per_week: 5 };

  async function submit(e) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const body = { skills: {}, interests: fd.getAll('interest') };
    for (const [k, v] of fd) {
      if (k.startsWith('skill:')) { if (v) body.skills[k.slice(6)] = Number(v); }
      else if (k !== 'interest') body[k] = v;
    }
    try {
      await api('/api/profile', { method: 'PUT', body });
      await refresh();
      notify('Profile saved');
      navigate('/');
    } catch (err) {
      notify(err.message, true);
    }
  }

  return (
    <>
      <div className="page-head">
        <h1>{profile ? 'Your profile' : 'Set up your profile'}</h1>
        <p>We use this to suggest challenges and build balanced teams. "Learning" is a great answer.</p>
      </div>
      <form className="stack" onSubmit={submit}>
        <div className="group">
          <h3>About you</h3>
          <div className="row">
            <label>Major<input name="major" defaultValue={p.major ?? ''} placeholder="e.g. Computer Science" /></label>
            <label>Expected graduation
              <select name="grad_year" defaultValue={p.grad_year ?? thisYear + 2}>
                {GRAD_YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </label>
            <label>Hours per week you can give
              <input name="hours_per_week" type="number" min="0" max="40" defaultValue={p.hours_per_week} />
            </label>
            <label>Role you enjoy on a team
              <select name="preferred_role" defaultValue={p.preferred_role ?? ''}>
                <option value="">No preference</option>
                {meta.roles.map((r) => <option key={r} value={r}>{label(r)}</option>)}
              </select>
            </label>
          </div>
        </div>

        <div className="group">
          <h3>Skills</h3>
          <div className="skills-grid">
            {meta.skills.map((s) => (
              <div className="skill-row" key={s}>
                <span>{label(s)}</span>
                <select name={`skill:${s}`} aria-label={`${label(s)} level`} defaultValue={p.skills[s] ?? ''}>
                  <option value="">—</option>
                  {[1, 2, 3].map((l) => <option key={l} value={l}>{LEVELS[l]}</option>)}
                </select>
              </div>
            ))}
          </div>
        </div>

        <div className="group">
          <h3>Interests</h3>
          <div className="pick">
            {meta.interests.map((i) => (
              <label key={i}><input type="checkbox" name="interest" value={i} defaultChecked={p.interests.includes(i)} /><span>{label(i)}</span></label>
            ))}
          </div>
        </div>

        <div className="group">
          <h3>One line about you</h3>
          <textarea name="bio" maxLength={280} aria-label="Bio" defaultValue={p.bio ?? ''} />
        </div>
        <div><button className="btn">Save profile</button></div>
      </form>
    </>
  );
}
