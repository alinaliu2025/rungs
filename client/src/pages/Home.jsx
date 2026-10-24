import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useLoad, useSession } from '../lib/session.jsx';
import { ChallengeRow, FeatureCarousel, Icon, Loading, Tabs } from '../components/ui.jsx';

const TABS = [
  ['open', 'All open'],
  ['mini', 'A few hours'],
  ['project', '4–6 weeks'],
  ['upcoming', 'Coming up & live'],
  ['ended', 'Wrapped'],
];

export default function Home() {
  const { user, profile } = useSession();
  const wantsRecs = user?.role === 'student' && Boolean(profile);
  const [tab, setTab] = useState('open');
  const [query, setQuery] = useState('');

  const state = useLoad(async () => {
    const [all, rec] = await Promise.all([
      api('/api/challenges'),
      wantsRecs ? api('/api/challenges/recommended') : null,
    ]);
    // Attach match scores so open challenges can be ranked for this student.
    const matches = new Map((rec?.challenges ?? []).map((c) => [c.id, c.match]));
    return { list: all.challenges.map((c) => ({ ...c, match: matches.get(c.id) })), recs: rec?.challenges ?? null };
  }, [wantsRecs]);

  const shown = useMemo(() => {
    if (!state.data) return [];
    const q = query.trim().toLowerCase();
    const byTab = {
      open: (c) => c.phase === 'open',
      mini: (c) => c.phase === 'open' && c.format === 'mini',
      project: (c) => c.phase === 'open' && c.format === 'project',
      upcoming: (c) => c.phase === 'locked' || c.phase === 'live',
      ended: (c) => c.phase === 'ended',
    }[tab];
    return state.data.list
      .filter(byTab)
      .filter((c) => !q || [c.title, c.summary, c.company_name, ...c.skills, ...c.tags].join(' ').toLowerCase().includes(q))
      .sort((a, b) => (b.match?.score ?? -1) - (a.match?.score ?? -1));
  }, [state.data, tab, query]);

  if (!state.data) return <Loading state={state} />;
  const { list, recs } = state.data;
  const featured = recs?.length
    ? recs.slice(0, 3)
    : list.filter((c) => c.phase === 'open').sort((a, b) => Date.parse(a.signup_deadline) - Date.parse(b.signup_deadline)).slice(0, 3);

  return (
    <>
      <FeatureCarousel items={featured} eyebrow={recs?.length ? 'Picked for you' : 'Closing soon'} />

      {user?.role === 'student' && !profile && (
        <div className="panel action" style={{ marginBottom: 56 }}>
          <span className="kicker">Get matched</span>
          <p>Tell us your skills, interests and how much time you have, and we'll line up challenges that fit.</p>
          <Link className="btn" to="/profile">Set up profile <Icon name="arrow" /></Link>
        </div>
      )}

      <section className="section" id="challenges">
        <div className="section-heading">
          <div>
            <span className="kicker">Built in Columbus</span>
            <h2>Explore challenges</h2>
          </div>
          <p className="section-intro">
            Show up for a one-hour mini challenge, or join a 4–6 week team project with an industry mentor.
            Sign up ahead, we build the team, you show up and ship.
          </p>
        </div>

        <div className="filters">
          <Tabs options={TABS} value={tab} onChange={setTab} />
          <label className="search-field">
            <Icon name="search" size={17} />
            <input id="challenge-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search challenges" aria-label="Search challenges" />
          </label>
        </div>

        <div className="challenge-list">
          {shown.map((c, i) => <ChallengeRow key={c.id} c={c} n={i + 1} />)}
          {!shown.length && <p className="empty">No challenges found. Try another filter or search.</p>}
        </div>
      </section>
    </>
  );
}
