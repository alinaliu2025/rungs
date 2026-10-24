import { Link, NavLink, useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useSession } from '../lib/session.jsx';
import { Icon, initials } from './ui.jsx';

export default function Nav() {
  const { user, refresh } = useSession();
  const navigate = useNavigate();

  const links = [['/', 'Challenges'], ['/post', 'Post a challenge']];
  if (user?.role === 'student') links.push(['/my', 'My challenges']);
  if (user?.role === 'company') links.push(['/company', 'Your challenges']);
  if (user?.role === 'reviewer') links.push(['/review', 'Review queue']);
  if (user?.role === 'company' || user?.role === 'reviewer') links.push(['/simulate', 'Team simulator']);

  async function logout() {
    await api('/api/auth/logout', { method: 'POST' });
    await refresh();
    navigate('/');
  }

  function search() {
    navigate('/');
    setTimeout(() => document.getElementById('challenge-search')?.focus(), 50);
  }

  return (
    <nav className="nav">
      <Link className="brand" to="/" aria-label="Rungs home">
        <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
        <span>RUNGS</span>
      </Link>
      <div className="nav-links">
        {links.map(([to, text]) => (
          <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => (isActive ? 'active' : '')}>{text}</NavLink>
        ))}
      </div>
      <div className="nav-actions">
        <button type="button" className="icon-button" aria-label="Search challenges" onClick={search}><Icon name="search" /></button>
        {user ? (
          <>
            <button type="button" className="text-link" onClick={logout}>Log out</button>
            <Link className="avatar-button" to={{ student: '/profile', company: '/company', reviewer: '/review' }[user.role]} aria-label="Your profile" title={user.name}>
              {initials(user.name)}
            </Link>
          </>
        ) : (
          <>
            <Link className="text-link" to="/login">Log in</Link>
            <Link className="btn small" to="/signup">Join</Link>
          </>
        )}
      </div>
    </nav>
  );
}
