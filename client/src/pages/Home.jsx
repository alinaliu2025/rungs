import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useLoad, useSession } from '../lib/session.jsx';
import { Loading, Segmented, Shelf } from '../components/ui.jsx';

const SIZES = [['all', 'Any'], ['mini', 'A few hours'], ['project', '4–6 weeks']];

export default function Home() {
  const { user, profile } = useSession();
  const [format, setFormat] = useState('all');
  const wantsRecs = user?.role === 'student' && profile;

  const state = useLoad(async () => {
    const q = format === 'all' ? '' : `?format=${format}`;
    const [all, rec] = await Promise.all([
      api(`/api/challenges${q}`),
      wantsRecs ? api(`/api/challenges/recommended${q}`) : null,
    ]);
    return { list: all.challenges, recs: rec?.challenges ?? null };
  }, [format, wantsRecs]);

  return (
    <>
      <section className="hero">
        <div className="eyebrow">Columbus · student × industry</div>
        <h1>Real problems from real companies. Sized to your week.</h1>
        <p>Show up for a one-hour mini challenge, or join a 4–6 week team project with an industry mentor. Sign up ahead, we build the team, you show up and ship.</p>
        {!user && (
          <div className="actions">
            <Link className="btn" to="/signup">Join as a student</Link>
            <Link className="btn secondary" to="/post">Post a challenge</Link>
          </div>
        )}
      </section>

      <div className="toolbar">
        <h2>How much time do you have?</h2>
        <Segmented options={SIZES} value={format} onChange={setFormat} />
      </div>

      {user?.role === 'student' && !profile && (
        <div className="panel" style={{ marginTop: '2rem' }}>
          <h3>Get matched in two minutes</h3>
          <p className="muted">Tell us your skills, interests and how much time you have. We'll line up challenges that fit.</p>
          <Link className="btn" to="/profile">Set up profile</Link>
        </div>
      )}

      {state.data ? <Shelves {...state.data} /> : <Loading state={state} />}
    </>
  );
}

function Shelves({ list, recs }) {
  const open = list.filter((c) => c.phase === 'open');
  const soon = open
    .filter((c) => Date.parse(c.signup_deadline) - Date.now() < 3 * 864e5)
    .sort((a, b) => Date.parse(a.signup_deadline) - Date.parse(b.signup_deadline));

  return (
    <>
      {recs && <Shelf title="Picked for you" note="Based on your profile" items={recs.slice(0, 8)} />}
      <Shelf title="Closing soon" note="Sign up before it locks" items={soon} />
      <Shelf title="Mini challenges" note="Hours, not weeks" items={open.filter((c) => c.format === 'mini')} />
      <Shelf title="4–6 week projects" note="With a company mentor" items={open.filter((c) => c.format === 'project')} />
      <Shelf title="Coming up & live" note="Teams are set" items={list.filter((c) => c.phase === 'locked' || c.phase === 'live')} />
      <Shelf title="Recently wrapped" items={list.filter((c) => c.phase === 'ended').reverse()} />
      {!list.length && <div className="empty" style={{ marginTop: '2rem' }}>Nothing here yet in this size.</div>}
    </>
  );
}
