// Single-page app with hash routing. No build step.
const app = document.getElementById('app');
const nav = document.getElementById('nav');
const state = { user: null, profile: null, meta: null, format: 'all' };

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const label = (s) => esc(String(s).replace(/-/g, ' '));
const initials = (name) => esc(String(name).split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase());
const LEVELS = { 1: 'Learning', 2: 'Comfortable', 3: 'Strong' };
const RUNGS = '<div class="rungs" aria-hidden="true"><i></i><i></i><i></i></div>';

async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

function toast(msg, isError = false) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `toast${isError ? ' err' : ''}`;
  el.hidden = false;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => (el.hidden = true), 3200);
}

const go = (hash) => { location.hash = hash; };

// ---------- time formatting ----------
// Times arrive as UTC ISO strings; each challenge carries the time zone it runs in.

const viewerTz = Intl.DateTimeFormat().resolvedOptions().timeZone;

function fmt(iso, tz, opts) {
  return new Intl.DateTimeFormat('en-US', { timeZone: tz, ...opts }).format(new Date(iso));
}
const fmtDay = (iso, tz) => fmt(iso, tz, { weekday: 'short', month: 'short', day: 'numeric' });
const fmtTime = (iso, tz, zone = true) => fmt(iso, tz, { hour: 'numeric', minute: '2-digit', ...(zone ? { timeZoneName: 'short' } : {}) });
const fmtFull = (iso, tz) => `${fmtDay(iso, tz)} · ${fmtTime(iso, tz)}`;

function fmtWhen(c) {
  const tz = c.timezone;
  if (fmtDay(c.starts_at, tz) === fmtDay(c.ends_at, tz)) {
    return `${fmtDay(c.starts_at, tz)} · ${fmtTime(c.starts_at, tz, false)}–${fmtTime(c.ends_at, tz)}`;
  }
  return `${fmt(c.starts_at, tz, { month: 'short', day: 'numeric' })} – ${fmt(c.ends_at, tz, { month: 'short', day: 'numeric' })}`;
}

function rel(iso) {
  const ms = Date.parse(iso) - Date.now();
  const m = Math.max(1, Math.round(ms / 6e4));
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h`;
  return `${Math.round(h / 24)}d`;
}

function statusChip(c) {
  switch (c.phase) {
    case 'pending': return '<span class="chip pending">Pending review</span>';
    case 'open': return c.full ? '<span class="chip">Full</span>' : `<span class="chip">Sign-ups close in ${rel(c.signup_deadline)}</span>`;
    case 'locked': return `<span class="chip">Starts in ${rel(c.starts_at)}</span>`;
    case 'live': return '<span class="chip live">Live now</span>';
    default: return '<span class="chip">Ended</span>';
  }
}

// ---------- nav ----------

async function refreshMe() {
  const { user, profile } = await api('/api/me');
  state.user = user;
  state.profile = profile;
  renderNav();
}

function renderNav() {
  const u = state.user;
  const links = [['#/', 'Discover']];
  if (u?.role === 'student') links.push(['#/my', 'My challenges'], ['#/profile', 'Profile']);
  if (u?.role === 'company') links.push(['#/company', 'Post a challenge']);
  if (u?.role === 'admin') links.push(['#/admin', 'Admin']);
  const here = `#/${location.hash.slice(2).split(/[/?]/)[0]}`;
  let html = links.map(([href, text]) => `<a href="${href}" class="${here === href ? 'active' : ''}">${text}</a>`).join('');
  html += u
    ? `<span class="who">${esc(u.name)}</span><button id="logout">Log out</button>`
    : '<a href="#/login">Log in</a><a href="#/signup" class="cta">Join</a>';
  nav.innerHTML = html;
  document.getElementById('logout')?.addEventListener('click', async () => {
    await api('/api/auth/logout', { method: 'POST' });
    await refreshMe();
    go('#/');
  });
}

// ---------- shared pieces ----------

function card(c) {
  const kind = c.format === 'mini' ? 'Mini' : 'Project';
  const mode = c.mode === 'team' ? `Team of ${c.team_size}` : 'Solo';
  const why = c.match?.reasons?.length ? `<div class="why">${c.match.reasons.slice(0, 3).map((r) => `<span>${esc(r)}</span>`).join('')}</div>` : '';
  const right = c.match ? `<span class="match">${Math.round(c.match.score * 100)}% match</span>` : `<span>${c.registrants} joined</span>`;
  return `<article class="card">
    <div class="cover ${c.format}">
      ${RUNGS}
      ${statusChip(c)}
      <div class="kind">${kind}<small>${esc(c.duration_label)} · ${mode}</small></div>
      <span class="go" aria-hidden="true">→</span>
    </div>
    <div class="card-body">
      <h3><a href="#/c/${c.id}">${esc(c.title)}</a></h3>
      <div class="meta">${esc(c.company_name)} · ${esc(fmtWhen(c))}</div>
      <p class="summary">${esc(c.summary)}</p>
      ${why}
      <div class="card-foot"><span>~${c.hours_per_week} hrs/week</span>${right}</div>
    </div>
  </article>`;
}

function shelf(title, items, note = '') {
  if (!items.length) return '';
  return `<section class="shelf">
    <div class="shelf-head"><h2>${title}</h2><span>${note || `${items.length}`}</span></div>
    <div class="track">${items.map(card).join('')}</div>
  </section>`;
}

function segmented(opts, current, onPick) {
  queueMicrotask(() => document.querySelectorAll('.segmented button').forEach((b) =>
    b.addEventListener('click', () => onPick(b.dataset.v))));
  return `<div class="segmented" role="tablist">${opts.map(([v, t]) =>
    `<button type="button" role="tab" data-v="${v}" aria-selected="${current === v}" class="${current === v ? 'on' : ''}">${t}</button>`).join('')}</div>`;
}

// ---------- pages ----------

async function homePage() {
  const q = state.format === 'all' ? '' : `?format=${state.format}`;
  const isStudent = state.user?.role === 'student';
  const [all, rec] = await Promise.all([
    api(`/api/challenges${q}`),
    isStudent && state.profile ? api(`/api/challenges/recommended${q}`) : null,
  ]);
  const list = all.challenges;
  const open = list.filter((c) => c.phase === 'open');
  const soon = open.filter((c) => Date.parse(c.signup_deadline) - Date.now() < 3 * 864e5)
    .sort((a, b) => Date.parse(a.signup_deadline) - Date.parse(b.signup_deadline));
  const upcoming = list.filter((c) => c.phase === 'locked' || c.phase === 'live');
  const ended = list.filter((c) => c.phase === 'ended').reverse();

  let setup = '';
  if (isStudent && !state.profile) {
    setup = `<div class="panel" style="margin-top:2rem"><h3>Get matched in two minutes</h3>
      <p class="muted">Tell us your skills, interests and how much time you have. We'll line up challenges that fit.</p>
      <a class="btn" href="#/profile">Set up profile</a></div>`;
  }

  app.innerHTML = `
    <section class="hero">
      <div class="eyebrow">Columbus · student × industry</div>
      <h1>Real problems from real companies. Sized to your week.</h1>
      <p>Show up for a one-hour mini challenge, or join a 4–6 week team project with an industry mentor. Sign up ahead, we build the team, you show up and ship.</p>
      ${state.user ? '' : '<div class="actions"><a class="btn" href="#/signup">Join as a student</a><a class="btn secondary" href="#/signup?role=company">Post a challenge</a></div>'}
    </section>
    <div class="toolbar">
      <h2>How much time do you have?</h2>
      ${segmented([['all', 'Any'], ['mini', 'A few hours'], ['project', '4–6 weeks']], state.format, (v) => { state.format = v; homePage(); })}
    </div>
    ${setup}
    ${rec ? shelf('Picked for you', rec.challenges.slice(0, 8), 'Based on your profile') : ''}
    ${shelf('Closing soon', soon, 'Sign up before it locks')}
    ${shelf('Mini challenges', open.filter((c) => c.format === 'mini'), 'Hours, not weeks')}
    ${shelf('4–6 week projects', open.filter((c) => c.format === 'project'), 'With a company mentor')}
    ${shelf('Coming up & live', upcoming, 'Teams are set')}
    ${shelf('Recently wrapped', ended)}
    ${list.length ? '' : '<div class="empty" style="margin-top:2rem">Nothing here yet in this size.</div>'}
  `;
}

function authPage(mode) {
  const params = new URLSearchParams(location.hash.split('?')[1]);
  const role = params.get('role') === 'company' ? 'company' : 'student';
  const signup = mode === 'signup';
  app.innerHTML = `<div class="auth">
    <h1>${signup ? 'Create your account' : 'Welcome back'}</h1>
    <form class="stack" id="f">
      <div class="group">
        ${signup ? `${segmentedRole(role)}
          <label>${role === 'company' ? 'Company name' : 'Your name'}<input name="name" required></label>` : ''}
        <label>Email<input name="email" type="email" required autocomplete="email"></label>
        <label>Password<input name="password" type="password" required minlength="8" autocomplete="${signup ? 'new-password' : 'current-password'}"></label>
      </div>
      <button class="btn">${signup ? 'Create account' : 'Log in'}</button>
      <p class="small muted" style="text-align:center">${signup ? 'Already have an account? <a class="ink" href="#/login">Log in</a>' : 'New here? <a class="ink" href="#/signup">Create an account</a>'}</p>
    </form>
    ${signup ? '' : `<div class="demo">Demo accounts, password <code>demo1234</code><br>
      Student <code>maya@demo.rungs</code><br>Company <code>lakefront@demo.rungs</code><br>Admin <code>admin@demo.rungs</code></div>`}
  </div>`;
  document.getElementById('f').addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.target));
    if (signup) body.role = role;
    try {
      await api(`/api/auth/${mode}`, { method: 'POST', body });
      await refreshMe();
      const r = state.user.role;
      go(r === 'student' ? (state.profile ? '#/' : '#/profile') : r === 'company' ? '#/company' : '#/admin');
    } catch (err) { toast(err.message, true); }
  });
}

function segmentedRole(role) {
  return segmented([['student', 'Student'], ['company', 'Company / mentor']], role, (v) => go(`#/signup?role=${v}`));
}

function profilePage() {
  if (state.user?.role !== 'student') return go('#/login');
  const { skills, interests, roles } = state.meta;
  const p = state.profile || { skills: {}, interests: [], hours_per_week: 5 };
  app.innerHTML = `<div class="page-head"><h1>${state.profile ? 'Your profile' : 'Set up your profile'}</h1>
    <p>We use this to suggest challenges and build balanced teams. "Learning" is a great answer.</p></div>
    <form class="stack" id="f">
      <div class="group"><h3>About you</h3><div class="row">
        <label>Major<input name="major" value="${esc(p.major)}" placeholder="e.g. Computer Science"></label>
        <label>Year<select name="year">${['Freshman', 'Sophomore', 'Junior', 'Senior', 'Grad'].map((y) =>
          `<option ${p.year === y ? 'selected' : ''}>${y}</option>`).join('')}</select></label>
        <label>Hours per week you can give<input name="hours_per_week" type="number" min="0" max="40" value="${p.hours_per_week}"></label>
        <label>Role you enjoy on a team<select name="preferred_role"><option value="">No preference</option>${roles.map((r) =>
          `<option value="${r}" ${p.preferred_role === r ? 'selected' : ''}>${label(r)}</option>`).join('')}</select></label>
      </div></div>
      <div class="group"><h3>Skills</h3><div class="skills-grid">${skills.map((s) => `<div class="skill-row"><span>${label(s)}</span>
        <select name="skill:${s}" aria-label="${label(s)} level"><option value="">—</option>${[1, 2, 3].map((l) =>
          `<option value="${l}" ${p.skills[s] === l ? 'selected' : ''}>${LEVELS[l]}</option>`).join('')}</select></div>`).join('')}</div></div>
      <div class="group"><h3>Interests</h3><div class="pick">${interests.map((i) =>
        `<label><input type="checkbox" name="interest" value="${i}" ${p.interests.includes(i) ? 'checked' : ''}><span>${label(i)}</span></label>`).join('')}</div></div>
      <div class="group"><h3>One line about you</h3><textarea name="bio" maxlength="280" aria-label="Bio">${esc(p.bio)}</textarea></div>
      <div><button class="btn">Save profile</button></div>
    </form>`;
  document.getElementById('f').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const body = { skills: {}, interests: fd.getAll('interest') };
    for (const [k, v] of fd) {
      if (k.startsWith('skill:') && v) body.skills[k.slice(6)] = Number(v);
      else if (!k.startsWith('skill:') && k !== 'interest') body[k] = v;
    }
    try {
      await api('/api/profile', { method: 'PUT', body });
      await refreshMe();
      toast('Profile saved');
      go('#/');
    } catch (err) { toast(err.message, true); }
  });
}

function timeline(c) {
  const steps = [
    ['Sign-ups close', c.signup_deadline, c.mode === 'team' ? 'Teams are formed automatically' : ''],
    ['Starts', c.starts_at, ''],
    ['Ends', c.ends_at, ''],
  ];
  const order = { pending: 0, open: 0, locked: 1, live: 2, ended: 3 }[c.phase];
  const showLocal = viewerTz !== c.timezone;
  return `<ol class="timeline">${steps.map(([name, iso, note], i) => `<li class="${i < order ? 'done' : i === order ? 'now' : ''}">
    <b>${name}</b><span>${esc(fmtFull(iso, c.timezone))}</span>
    ${showLocal ? `<span class="local">${esc(fmtFull(iso, viewerTz))} your time</span>` : ''}
    ${note ? `<span class="local">${note}</span>` : ''}</li>`).join('')}</ol>`;
}

function teamPanel(team, c) {
  return `<div class="panel"><h3>Your team · ${esc(team.name)}</h3>
    <ul class="team-list">${team.members.map((m) => `<li><span class="avatar">${initials(m.name)}</span>
      <div><b>${esc(m.name)}</b><div class="small muted">${esc(m.major)}${m.preferred_role ? ` · ${label(m.preferred_role)}` : ''}</div></div></li>`).join('')}</ul>
    <p class="small muted" style="margin:.9rem 0 0">Kickoff ${esc(fmtFull(c.starts_at, c.timezone))} with ${esc(c.mentor_name || 'your mentor')}.</p></div>`;
}

async function challengePage(id) {
  const { challenge: c } = await api(`/api/challenges/${id}`);
  const u = state.user;
  let action = '';
  if (!u) action = '<a class="btn" href="#/signup">Sign up to join</a>';
  else if (u.role === 'student') {
    if (c.myTeam) action = `<p style="margin:0"><b>You're on ${esc(c.myTeam.name)}.</b></p>`;
    else if (c.joined && c.phase === 'open') {
      action = `<p style="margin:0"><b>You're in.</b> ${c.mode === 'team' ? `Teams are announced when sign-ups close in ${rel(c.signup_deadline)}.` : `See you ${esc(fmtDay(c.starts_at, c.timezone))}.`}</p>
        <button class="btn ghost" id="leave">Leave</button>`;
    } else if (c.joined) action = c.mode === 'team' ? '<p class="muted" style="margin:0">Not enough people signed up to form a team. The company will follow up.</p>' : "<p style=\"margin:0\"><b>You're in.</b></p>";
    else if (c.phase !== 'open') action = '<p class="muted" style="margin:0">Sign-ups are closed.</p>';
    else if (c.full) action = '<p class="muted" style="margin:0">This challenge is full.</p>';
    else {
      action = `<label>Anything the mentor should know? <span class="muted">(optional)</span><textarea id="note" maxlength="280"></textarea></label>
        <button class="btn" id="join">${c.mode === 'team' ? 'Join the team pool' : 'Save my spot'}</button>
        <p class="small muted" style="margin:0">Sign-ups close ${esc(fmtFull(c.signup_deadline, c.timezone))}.</p>`;
    }
  } else if (c.mode === 'team' && c.teams_formed) action = `<a class="btn secondary" href="#/teams/${c.id}">View teams</a>`;

  const spots = c.max_participants ? ` · ${Math.max(0, c.max_participants - c.registrants)} spots left` : '';
  app.innerHTML = `<a href="#/" class="back">‹ Discover</a>
    <section class="detail-hero ${c.format}">
      ${RUNGS}
      <div class="chips">${statusChip(c)}<span class="chip">${c.format === 'mini' ? 'Mini' : 'Project'} · ${esc(c.duration_label)}</span>
        <span class="chip">${c.mode === 'team' ? `Team of ${c.team_size}` : 'Solo'}</span></div>
      <h1>${esc(c.title)}</h1>
      <p>${esc(c.company_name)} · ${esc(fmtWhen(c))} · ${c.registrants} joined${spots}</p>
    </section>
    <div class="detail-grid">
      <div>
        <div class="panel"><p style="font-size:1.15rem;font-weight:600">${esc(c.summary)}</p><p class="muted">${esc(c.description)}</p>
          ${c.deliverable ? `<p><b>You'll ship:</b> ${esc(c.deliverable)}</p>` : ''}
          ${c.mentor_name ? `<p><b>Mentor:</b> ${esc(c.mentor_name)}, ${esc(c.mentor_title)}</p>` : ''}
          <p><b>Time:</b> ~${c.hours_per_week} hrs/week</p>
          <div class="chips">${c.skills.map((s) => `<span class="chip">${label(s)}</span>`).join('')}${c.tags.map((t) => `<span class="chip">#${label(t)}</span>`).join('')}</div>
        </div>
        ${c.myTeam ? teamPanel(c.myTeam, c) : ''}
      </div>
      <aside>
        <div class="panel"><h3>Schedule</h3>${timeline(c)}</div>
        ${action ? `<div class="panel" style="display:grid;gap:.8rem">${action}</div>` : ''}
      </aside>
    </div>`;

  document.getElementById('join')?.addEventListener('click', async () => {
    if (!state.profile) return go('#/profile');
    try {
      await api(`/api/challenges/${c.id}/join`, { method: 'POST', body: { note: document.getElementById('note').value } });
      toast(c.mode === 'team' ? "You're in the pool. We'll match you to a team." : "Spot saved. See you there!");
      challengePage(id);
    } catch (err) { toast(err.message, true); }
  });
  document.getElementById('leave')?.addEventListener('click', async () => {
    try { await api(`/api/challenges/${c.id}/join`, { method: 'DELETE' }); challengePage(id); } catch (err) { toast(err.message, true); }
  });
}

async function myPage() {
  if (state.user?.role !== 'student') return go('#/login');
  const { challenges } = await api('/api/my/challenges');
  const active = challenges.filter((c) => c.phase !== 'ended');
  const done = challenges.filter((c) => c.phase === 'ended');
  const row = (c) => `<a class="list-row" href="#/c/${c.id}">
    <div><h3>${esc(c.title)}</h3><div class="small muted">${esc(c.company_name)} · ${esc(fmtWhen(c))}</div>
      ${c.mode === 'team' ? `<div class="small" style="margin-top:.3rem">${c.myTeam ? `<b>${esc(c.myTeam.name)}</b>: ${c.myTeam.members.map((m) => esc(m.name)).join(', ')}` : '<span class="muted">Team announced when sign-ups close</span>'}</div>` : ''}</div>
    <div class="actions">${statusChip(c)}</div></a>`;
  app.innerHTML = `<div class="page-head"><h1>My challenges</h1></div>
    ${active.length ? `<div class="rows">${active.map(row).join('')}</div>` : '<div class="empty">Nothing yet. <a class="ink" href="#/">Find a challenge</a>.</div>'}
    ${done.length ? `<section class="shelf"><div class="shelf-head"><h2>Finished</h2></div><div class="rows">${done.map(row).join('')}</div></section>` : ''}`;
}

// datetime-local value for `days` from now at a given hour, in the viewer's zone.
function localInput(days, hour) {
  const d = new Date(Date.now() + days * 864e5);
  d.setHours(hour, 0, 0, 0);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(hour)}:00`;
}

async function companyPage() {
  if (state.user?.role !== 'company') return go('#/login');
  const { skills, interests, timezones } = state.meta;
  const { challenges } = await api('/api/company/challenges');
  const pick = (name, items) => `<div class="pick">${items.map((i) =>
    `<label><input type="checkbox" name="${name}" value="${i}"><span>${label(i)}</span></label>`).join('')}</div>`;
  const defaultTz = timezones.includes(viewerTz) ? viewerTz : timezones[0];
  app.innerHTML = `<div class="page-head"><h1>Post a challenge</h1>
    <p>Answer a few questions. After a quick review it goes live on the front page, and we handle sign-ups and team building.</p></div>
    <form class="stack" id="f">
      <div class="group"><h3>The problem</h3>
        <label>What should students work on?<input name="title" required placeholder="e.g. Map EV charging gaps in Columbus"></label>
        <label>One-line pitch<input name="summary" required maxlength="160"></label>
        <label>Details: data, context, what good looks like<textarea name="description"></textarea></label>
        <div class="row">
          <label>Deliverable<input name="deliverable" placeholder="e.g. demo + 5 slides"></label>
          <label>Mentor name<input name="mentor_name"></label>
          <label>Mentor title<input name="mentor_title"></label>
        </div>
      </div>
      <div class="group"><h3>Format</h3><div class="row">
        <label>Size<select name="format"><option value="mini">Mini challenge (hours to a few days)</option><option value="project">Project (4–6 weeks)</option></select></label>
        <label>Individual or team?<select name="mode" id="mode"><option value="individual">Individual</option><option value="team">Team</option></select></label>
        <label>Team size<input name="team_size" type="number" min="2" max="8" value="4" id="ts" disabled></label>
        <label>Expected hours / week<input name="hours_per_week" type="number" min="1" max="40" value="4"></label>
      </div></div>
      <div class="group"><h3>Schedule</h3>
        <p class="hint">Students sign up ahead of time. When sign-ups close, we lock the list and form teams automatically.</p>
        <div class="row">
          <label>Time zone<select name="timezone">${timezones.map((t) => `<option ${t === defaultTz ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
          <label>Sign-ups close<input name="signup_deadline" type="datetime-local" required value="${localInput(7, 23).replace('T23:00', 'T23:59')}"></label>
          <label>Starts<input name="starts_at" type="datetime-local" required value="${localInput(10, 17)}"></label>
          <label>Ends<input name="ends_at" type="datetime-local" required value="${localInput(10, 18)}"></label>
          <label>Max participants <span class="muted">(optional)</span><input name="max_participants" type="number" min="1" placeholder="No limit"></label>
        </div>
      </div>
      <div class="group"><h3>Skills this needs</h3>${pick('skills', skills)}</div>
      <div class="group"><h3>Topics</h3>${pick('tags', interests)}</div>
      <div><button class="btn">Submit for review</button></div>
    </form>
    <section class="shelf"><div class="shelf-head"><h2>Your challenges</h2></div>
    ${challenges.length ? `<div class="rows">${challenges.map((c) => `<div class="list-row">
      <div><h3><a href="#/c/${c.id}">${esc(c.title)}</a></h3>
        <div class="small muted">${esc(fmtWhen(c))} · ${c.registrants} joined${c.max_participants ? ` / ${c.max_participants}` : ''}</div></div>
      <div class="actions">${statusChip(c)}${c.teams_formed ? `<a class="btn small secondary" href="#/teams/${c.id}">Teams</a>` : ''}</div>
    </div>`).join('')}</div>` : '<div class="empty">No challenges yet.</div>'}</section>`;
  const mode = document.getElementById('mode');
  mode.addEventListener('change', () => { document.getElementById('ts').disabled = mode.value !== 'team'; });
  document.getElementById('f').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const body = Object.fromEntries(fd);
    body.skills = fd.getAll('skills');
    body.tags = fd.getAll('tags');
    try {
      await api('/api/company/challenges', { method: 'POST', body });
      toast('Submitted! An admin will publish it shortly.');
      companyPage();
    } catch (err) { toast(err.message, true); }
  });
}

async function adminPage() {
  if (state.user?.role !== 'admin') return go('#/login');
  const { challenges } = await api('/api/admin/challenges');
  app.innerHTML = `<div class="page-head"><h1>Admin</h1>
    <p>Publish company submissions. Teams form on their own at each sign-up deadline; you can close sign-ups early or re-sort.</p></div>
    <div class="rows">${challenges.map((c) => {
      const actions = [];
      if (c.status === 'pending') actions.push(`<button class="btn small" data-publish="${c.id}">Publish</button>`);
      if (c.mode === 'team' && c.status === 'published' && c.phase !== 'ended') {
        if (c.phase === 'open') actions.push(`<button class="btn small secondary" data-form="${c.id}" ${c.registrants < 2 ? 'disabled' : ''}>Close sign-ups & form teams</button>`);
        else if (c.phase === 'locked') actions.push(`<button class="btn small secondary" data-form="${c.id}" ${c.registrants < 2 ? 'disabled' : ''}>Re-sort teams</button>`);
      }
      if (c.teams_formed) actions.push(`<a class="btn small ghost" href="#/teams/${c.id}">View teams</a>`);
      return `<div class="list-row">
        <div><h3><a href="#/c/${c.id}">${esc(c.title)}</a></h3>
          <div class="small muted">${esc(c.company_name)} · ${c.format === 'mini' ? 'Mini' : 'Project'} · ${c.mode === 'team' ? `teams of ${c.team_size}` : 'solo'} · ${c.registrants} joined</div>
          <div class="small muted">Sign-ups close ${esc(fmtFull(c.signup_deadline, c.timezone))}</div></div>
        <div class="actions">${statusChip(c)}${actions.join('')}</div>
      </div>`;
    }).join('')}</div>`;
  app.querySelectorAll('[data-publish]').forEach((b) => b.addEventListener('click', async () => {
    try { await api(`/api/admin/challenges/${b.dataset.publish}/publish`, { method: 'POST' }); toast('Published to the front page'); adminPage(); }
    catch (err) { toast(err.message, true); }
  }));
  app.querySelectorAll('[data-form]').forEach((b) => b.addEventListener('click', async () => {
    try { const r = await api(`/api/admin/challenges/${b.dataset.form}/form-teams`, { method: 'POST' }); toast(`Formed ${r.teams} teams`); go(`#/teams/${b.dataset.form}`); }
    catch (err) { toast(err.message, true); }
  }));
}

async function teamsPage(id) {
  const { challenge: c, teams } = await api(`/api/challenges/${id}/teams`);
  const stat = (name, v) => `<div class="stat"><span>${name}</span><span class="meter"><i style="width:${Math.round(v * 100)}%"></i></span><span>${Math.round(v * 100)}%</span></div>`;
  app.innerHTML = `<a href="#/${state.user.role}" class="back">‹ Back</a>
    <div class="page-head"><h1>${esc(c.title)}</h1>
    <p>Internal view. Students only see their own team and teammates, never these scores.</p></div>
    ${teams.length ? `<div class="grid">${teams.map((t) => `<div class="panel">
      <h3>${esc(t.name)}</h3>
      <div style="display:grid;gap:.35rem;margin-bottom:1rem">${stat('Avg strength', t.metrics.avgStrength)}${stat('Skill coverage', t.metrics.coverage)}${stat('Major mix', t.metrics.majorMix)}</div>
      <ul class="team-list">${t.members.map((m) => `<li><span class="avatar">${initials(m.name)}</span><div>
        <b>${esc(m.name)}</b><div class="small muted">${esc(m.major)} · ${label(m.preferred_role || 'any role')}</div>
        <div class="small muted">${c.skills.map((s) => `${label(s)} ${m.skills[s] || 0}`).join(' · ')}</div></div></li>`).join('')}</ul>
    </div>`).join('')}</div>` : '<div class="empty">Teams have not been formed yet.</div>'}`;
}

// ---------- router ----------

async function route() {
  const [path] = location.hash.slice(1).split('?');
  const parts = (path || '/').split('/').filter(Boolean);
  renderNav();
  try {
    if (!parts.length) await homePage();
    else if (parts[0] === 'login') authPage('login');
    else if (parts[0] === 'signup') authPage('signup');
    else if (parts[0] === 'profile') profilePage();
    else if (parts[0] === 'c') await challengePage(parts[1]);
    else if (parts[0] === 'my') await myPage();
    else if (parts[0] === 'company') await companyPage();
    else if (parts[0] === 'admin') await adminPage();
    else if (parts[0] === 'teams') await teamsPage(parts[1]);
    else app.innerHTML = '<div class="empty">Page not found.</div>';
  } catch (err) {
    app.innerHTML = `<div class="empty">${esc(err.message)}</div>`;
  }
  window.scrollTo(0, 0);
}

(async () => {
  state.meta = await api('/api/meta');
  await refreshMe();
  addEventListener('hashchange', route);
  route();
})();
