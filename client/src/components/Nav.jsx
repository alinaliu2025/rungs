import { Link, NavLink, useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useSession } from '../lib/session.jsx';

export default function Nav() {
  const { user, refresh } = useSession();
  const navigate = useNavigate();

  const links = [['/', 'Discover'], ['/post', 'Post a challenge']];
  if (user?.role === 'student') links.push(['/my', 'My challenges'], ['/profile', 'Profile']);
  if (user?.role === 'company') links.push(['/company', 'Your challenges']);

  async function logout() {
    await api('/api/auth/logout', { method: 'POST' });
    await refresh();
    navigate('/');
  }

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Link to="/" className="brand"><span className="logo" aria-hidden="true"><i /><i /><i /></span>Rungs</Link>
        <nav id="nav">
          {links.map(([to, text]) => (
            <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => (isActive ? 'active' : '')}>{text}</NavLink>
          ))}
          {user ? (
            <>
              <span className="who">{user.name}</span>
              <button type="button" onClick={logout}>Log out</button>
            </>
          ) : (
            <>
              <NavLink to="/login">Log in</NavLink>
              <Link to="/signup" className="cta">Join</Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
