import { useEffect } from 'react';
import { HashRouter, Route, Routes, useLocation } from 'react-router-dom';
import { SessionProvider } from './lib/session.jsx';
import Nav from './components/Nav.jsx';
import Home from './pages/Home.jsx';
import Auth from './pages/Auth.jsx';
import Profile from './pages/Profile.jsx';
import ChallengeDetail from './pages/ChallengeDetail.jsx';
import MyChallenges from './pages/MyChallenges.jsx';
import PostChallenge from './pages/PostChallenge.jsx';
import CompanyDashboard from './pages/CompanyDashboard.jsx';
import Teams from './pages/Teams.jsx';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

export default function App() {
  return (
    <SessionProvider>
      <HashRouter>
        <ScrollToTop />
        <Nav />
        <main className="container">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Auth mode="login" />} />
            <Route path="/signup" element={<Auth mode="signup" />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/c/:id" element={<ChallengeDetail />} />
            <Route path="/my" element={<MyChallenges />} />
            <Route path="/post" element={<PostChallenge />} />
            <Route path="/company" element={<CompanyDashboard />} />
            <Route path="/teams/:id" element={<Teams />} />
            <Route path="*" element={<div className="empty">Page not found.</div>} />
          </Routes>
        </main>
        <footer className="site-footer">
          <span>Real challenges from Columbus companies</span>
          <span>Sign up ahead · we build the team · you ship</span>
        </footer>
      </HashRouter>
    </SessionProvider>
  );
}
