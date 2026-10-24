import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useSession } from '../lib/session.jsx';
import { Icon, Segmented } from '../components/ui.jsx';

export default function Auth({ mode }) {
  const signup = mode === 'signup';
  const { refresh, notify } = useSession();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const role = params.get('role') === 'company' ? 'company' : 'student';
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.currentTarget));
    if (signup) body.role = role;
    setBusy(true);
    try {
      await api(`/api/auth/${mode}`, { method: 'POST', body });
      const { user, profile } = await refresh();
      navigate(user.role === 'student' ? (profile ? '/' : '/profile') : '/company');
    } catch (err) {
      notify(err.message, true);
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <span className="kicker">{signup ? 'Join Rungs' : 'Log in'}</span>
      <h1>{signup ? 'Create your account' : 'Welcome back'}</h1>
      <form className="stack" onSubmit={submit}>
        <div style={{ display: 'grid', gap: 22 }}>
          {signup && (
            <>
              <Segmented options={[['student', 'Student'], ['company', 'Company / mentor']]} value={role}
                onChange={(v) => setParams({ role: v })} />
              <label>{role === 'company' ? 'Company name' : 'Your name'}<input name="name" required /></label>
            </>
          )}
          <label>Email<input name="email" type="email" required autoComplete="email" /></label>
          <label>Password
            <input name="password" type="password" required minLength={8} autoComplete={signup ? 'new-password' : 'current-password'} />
          </label>
        </div>
        <button className="btn" disabled={busy}>{signup ? 'Create account' : 'Log in'} <Icon name="arrow" /></button>
        <p className="switch">
          {signup ? <>Already have an account? <Link className="ink" to="/login">Log in</Link></>
            : <>New here? <Link className="ink" to="/signup">Create an account</Link></>}
        </p>
      </form>
      {!signup && (
        <div className="demo">
          Demo accounts, password <code>demo1234</code><br />
          Student <code>maya@demo.rungs</code><br />
          Company <code>lakefront@demo.rungs</code>
        </div>
      )}
    </div>
  );
}
