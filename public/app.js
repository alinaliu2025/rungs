// Single-page app with hash routing. No build step.
const app = document.getElementById('app');
const nav = document.getElementById('nav');
const state = { user: null, profile: null, meta: null, format: 'all' };

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const label = (s) => esc(String(s).replace(/-/g, ' '));
const LEVELS = { 1: 'Learning', 2: 'Comfortable', 3: 'Strong' };

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
  toast.t = setTimeout(() => (el.hidden = true), 2800);
}

const go = (hash) => { location.hash = hash; };

async function refreshMe() {
  const { user, profile } = await api('/api/me');
  state.user = user;
  state.profile = profile;
  renderNav();
}

function renderNav() {
  const u = state.user;
  const links = ['<a href="#/">Challenges</a>'];
  if (!u) links.push('<a href="#/login">Log in</a>', '<a href="#/signup" class="btn">Join</a>');
  else {
    if (u.role === 'student') links.push('<a href="#/my">My challenges</a>', '<a href="#/profile">Profile</a>');
    if (u.role === 'company') links.push('<a href="#/company">Post a challenge</a>');
    if (u.role === 'admin') links.push('<a href="#/admin">Admin</a>');
    links.push(`<span class="who">${esc(u.name)}</span>`, '<button id="logout">Log out</button>');
  }
  nav.innerHTML = links.join('');
  document.getElementById('logout')?.addEventListener('click', async () => {
    await api('/api/auth/logout', { method: 'POST' });
    await refreshMe();
    go('#/');
  });
}

// ---------- shared pieces ----------

function formatPill(c) {
  return c.format === 'mini'
    ? `<span class="pill mini">Mini · ${esc(c.duration_label)}</span>`
    : `<span class="pill project">Project · ${esc(c.duration_label)}</span>`;
}

function modePill(c) {
  return c.mode === 'team' ? `<span class="pill">Team of ${c.team_size}</span>` : '<span class="pill">Solo</span>';
}

function card(c) {
  const why = c.match?.reasons?.length ? `<div class="why">${c.match.reasons.map(esc).join(' · ')}</div>` : '';
  const score = c.match ? `<span class="score">${Math.round(c.match.score * 100)}% match</span>` : '';
  return `<article class="card">
    <div class="pills">${formatPill(c)}${modePill(c)}${c.teams_formed ? '<span class="pill ok">Teams set</span>' : ''}</div>
    <h3><a href="#/c/${c.id}">${esc(c.title)}</a></h3>
    <div class="muted small">${esc(c.company_name)} · ~${c.hours_per_week} hrs/week</div>
    <p>${esc(c.summary)}</p>
    ${why}
    <div class="pills">${c.skills.map((s) => `<span class="pill">${label(s)}</span>`).join('')}</div>
    <div class="foot"><span class="muted small">${c.registrants} joined</span>${score}</div>
  </article>`;
}

function formatToggle(onChange) {
  const opts = [['all', 'Any amount'], ['mini', 'A few hours (mini)'], ['project', '4–6 weeks (project)']];
  const html = `<div class="toggle" role="tablist">${opts.map(([v, t]) =>
    `<button data-f="${v}" class="${state.format === v ? 'on' : ''}">${t}</button>`).join('')}</div>`;
  queueMicrotask(() => document.querySelectorAll('.toggle button').forEach((b) =>
    b.addEventListener('click', () => { state.format = b.dataset.f; onChange(); })));
  return html;
}

// ---------- pages ----------

async function homePage() {
  const q = state.format === 'all' ? '' : `?format=${state.format}`;
  const isStudent = state.user?.role === 'student';
  const [all, rec] = await Promise.all([
    api(`/api/challenges${q}`),
    isStudent && state.profile ? api(`/api/challenges/recommended${q}`) : null,
  ]);
  const rung = (n, t, d, here) => `<div class="rung${here ? ' here' : ''}"><b>${n}. ${t}</b><span class="muted small">${d}</span></div>`;

  let forYou = '';
  if (isStudent && !state.profile) {
    forYou = `<div class="panel"><h3>Set up your profile to get matched</h3>
      <p class="muted">Takes two minutes: skills, interests and how much time you have.</p>
      <a class="btn" href="#/profile">Set up profile</a></div>`;
  } else if (rec) {
    forYou = `<h2>Picked for you</h2>
      ${rec.challenges.length ? `<div class="grid">${rec.challenges.slice(0, 3).map(card).join('')}</div>`
        : '<div class="empty">You have joined everything that fits. Nice.</div>'}`;
  }

  app.innerHTML = `
    <section class="hero">
      <h1>Real challenges from real companies. Sized to your week.</h1>
      <p>Start with a mini challenge you can finish tonight, or join a 4–6 week team project with an industry mentor. We build the teams so you meet people outside your major.</p>
      ${state.user ? '' : '<a class="btn" href="#/signup">Join as a student</a> <a class="btn ghost" href="#/signup?role=company">Post a challenge</a>'}
    </section>
    <div class="ladder">
      ${rung(1, 'Look around', 'Browse challenges')}
      ${rung(2, 'Show up', 'Make a profile')}
      ${rung(3, 'Try something small', 'Mini challenges', true)}
      ${rung(4, 'Join a project', '4–6 week teams', true)}
      ${rung(5, 'Give back', 'Mentor the next cohort')}
    </div>
    <h2>How much time do you have?</h2>
    ${formatToggle(homePage)}
    ${forYou}
    <h2>All open challenges</h2>
    ${all.challenges.length ? `<div class="grid">${all.challenges.map(card).join('')}</div>` : '<div class="empty">No challenges in this size yet.</div>'}
  `;
}

function authPage(mode) {
  const params = new URLSearchParams(location.hash.split('?')[1]);
  const role = params.get('role') === 'company' ? 'company' : 'student';
  const signup = mode === 'signup';
  app.innerHTML = `<div class="panel" style="max-width:460px;margin:2rem auto">
    <h1>${signup ? 'Create your account' : 'Welcome back'}</h1>
    <form class="stack" id="f">
      ${signup ? `<label>I am a
        <select name="role"><option value="student" ${role === 'student' ? 'selected' : ''}>Student</option>
        <option value="company" ${role === 'company' ? 'selected' : ''}>Company / mentor</option></select></label>
        <label>Name (or company name)<input name="name" required></label>` : ''}
      <label>Email<input name="email" type="email" required autocomplete="email"></label>
      <label>Password<input name="password" type="password" required minlength="8" autocomplete="${signup ? 'new-password' : 'current-password'}"></label>
      <button class="btn">${signup ? 'Sign up' : 'Log in'}</button>
      <p class="small muted">${signup ? 'Already have an account? <a href="#/login">Log in</a>' : 'New here? <a href="#/signup">Create an account</a>'}</p>
    </form>
    ${signup ? '' : `<div class="demo">Demo accounts (password <code>demo1234</code>):<br>
      student <code>maya@demo.rungs</code> · company <code>lakefront@demo.rungs</code> · admin <code>admin@demo.rungs</code></div>`}
  </div>`;
  document.getElementById('f').addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.target));
    try {
      await api(`/api/auth/${mode}`, { method: 'POST', body });
      await refreshMe();
      const r = state.user.role;
      go(r === 'student' ? (state.profile ? '#/' : '#/profile') : r === 'company' ? '#/company' : '#/admin');
    } catch (err) { toast(err.message, true); }
  });
}

function profilePage() {
  if (state.user?.role !== 'student') return go('#/login');
  const { skills, interests, roles } = state.meta;
  const p = state.profile || { skills: {}, interests: [], hours_per_week: 5 };
  app.innerHTML = `<h1>${state.profile ? 'Your profile' : 'Set up your profile'}</h1>
    <p class="muted">We use this to suggest challenges and to build balanced teams. Be honest: "learning" is a great answer.</p>
    <form class="stack panel" id="f" style="max-width:none">
      <div class="row">
        <label>Major<input name="major" value="${esc(p.major)}" placeholder="e.g. Computer Science"></label>
        <label>Year<select name="year">${['Freshman', 'Sophomore', 'Junior', 'Senior', 'Grad'].map((y) =>
          `<option ${p.year === y ? 'selected' : ''}>${y}</option>`).join('')}</select></label>
        <label>Hours per week you can give<input name="hours_per_week" type="number" min="0" max="40" value="${p.hours_per_week}"></label>
        <label>Role you enjoy on a team<select name="preferred_role"><option value="">No preference</option>${roles.map((r) =>
          `<option value="${r}" ${p.preferred_role === r ? 'selected' : ''}>${label(r)}</option>`).join('')}</select></label>
      </div>
      <fieldset><legend>Skills</legend><div class="skills-grid">${skills.map((s) => `<div class="skill-row"><span>${label(s)}</span>
        <select name="skill:${s}"><option value="">—</option>${[1, 2, 3].map((l) =>
          `<option value="${l}" ${p.skills[s] === l ? 'selected' : ''}>${LEVELS[l]}</option>`).join('')}</select></div>`).join('')}</div></fieldset>
      <fieldset><legend>Interests</legend><div class="chips">${interests.map((i) =>
        `<label class="chip"><input type="checkbox" name="interest" value="${i}" ${p.interests.includes(i) ? 'checked' : ''}>${label(i)}</label>`).join('')}</div></fieldset>
      <label>One line about you<textarea name="bio" maxlength="280">${esc(p.bio)}</textarea></label>
      <button class="btn" style="justify-self:start">Save profile</button>
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

async function challengePage(id) {
  const { challenge: c } = await api(`/api/challenges/${id}`);
  const u = state.user;
  let action = '';
  if (!u) action = '<a class="btn" href="#/signup">Sign up to join</a>';
  else if (u.role === 'student') {
    if (c.myTeam) action = '';
    else if (c.joined) action = `<p class="pill ok">You're in.</p> ${c.mode === 'team' ? '<p class="muted">Teams are announced when sign-ups close.</p>' : ''}
      <button class="btn ghost" id="leave">Leave</button>`;
    else if (c.teams_formed) action = '<p class="muted">Sign-ups are closed.</p>';
    else action = `<label>Anything the mentor should know? (optional)<textarea id="note" maxlength="280"></textarea></label>
      <button class="btn" id="join">${c.mode === 'team' ? 'Join the team pool' : 'Start this challenge'}</button>`;
  } else if (c.mode === 'team') action = `<a class="btn ghost" href="#/teams/${c.id}">View teams</a>`;

  const team = c.myTeam ? `<div class="panel"><h3>Your team: ${esc(c.myTeam.name)}</h3>
    <ul>${c.myTeam.members.map((m) => `<li><b>${esc(m.name)}</b> <span class="muted">· ${esc(m.major)}${m.preferred_role ? ` · ${label(m.preferred_role)}` : ''}</span></li>`).join('')}</ul>
    <p class="small muted">Say hi to your team and book your first check-in with ${esc(c.mentor_name || 'your mentor')}.</p></div>` : '';

  app.innerHTML = `<a href="#/" class="small">← All challenges</a>
    <div class="pills" style="margin-top:1rem">${formatPill(c)}${modePill(c)}${c.status === 'pending' ? '<span class="pill pending">Pending review</span>' : ''}</div>
    <h1 style="margin-top:.5rem">${esc(c.title)}</h1>
    <p class="muted">${esc(c.company_name)} · ~${c.hours_per_week} hrs/week · ${c.registrants} joined</p>
    <div class="row" style="align-items:start">
      <div>
        <div class="panel"><p><b>${esc(c.summary)}</b></p><p>${esc(c.description)}</p>
          ${c.deliverable ? `<p><b>You'll ship:</b> ${esc(c.deliverable)}</p>` : ''}
          ${c.mentor_name ? `<p><b>Mentor:</b> ${esc(c.mentor_name)}, ${esc(c.mentor_title)}</p>` : ''}
          <div class="pills">${c.skills.map((s) => `<span class="pill">${label(s)}</span>`).join('')}${c.tags.map((t) => `<span class="pill">#${label(t)}</span>`).join('')}</div>
        </div>
        ${team}
      </div>
      <div class="panel stack" style="display:grid;gap:.75rem">${action || '<span class="muted">—</span>'}</div>
    </div>`;

  document.getElementById('join')?.addEventListener('click', async () => {
    if (!state.profile) return go('#/profile');
    try {
      await api(`/api/challenges/${c.id}/join`, { method: 'POST', body: { note: document.getElementById('note').value } });
      toast(c.mode === 'team' ? "You're in the pool. We'll match you to a team." : "You're in. Good luck!");
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
  app.innerHTML = `<h1>My challenges</h1>
    ${challenges.length ? `<div class="grid">${challenges.map((c) => `<article class="card">
      <div class="pills">${formatPill(c)}${modePill(c)}</div>
      <h3><a href="#/c/${c.id}">${esc(c.title)}</a></h3>
      <div class="muted small">${esc(c.company_name)}</div>
      ${c.mode === 'team' ? (c.myTeam ? `<p><b>${esc(c.myTeam.name)}</b>: ${c.myTeam.members.map((m) => esc(m.name)).join(', ')}</p>`
        : '<p class="muted">Waiting for team assignment…</p>') : '<p class="muted">Solo challenge</p>'}
    </article>`).join('')}</div>` : '<div class="empty">Nothing yet. <a href="#/">Find a challenge</a>.</div>'}`;
}

async function companyPage() {
  if (state.user?.role !== 'company') return go('#/login');
  const { skills, interests } = state.meta;
  const { challenges } = await api('/api/company/challenges');
  const chips = (name, items) => `<div class="chips">${items.map((i) =>
    `<label class="chip"><input type="checkbox" name="${name}" value="${i}">${label(i)}</label>`).join('')}</div>`;
  app.innerHTML = `<h1>Post a challenge</h1>
    <p class="muted">Answer a few questions and we'll turn it into a challenge on the front page after a quick review.</p>
    <form class="stack panel" id="f" style="max-width:none">
      <label>What should students work on?<input name="title" required placeholder="e.g. Map EV charging gaps in Columbus"></label>
      <label>One-line pitch<input name="summary" required maxlength="160"></label>
      <label>Details: data, context, what good looks like<textarea name="description"></textarea></label>
      <div class="row">
        <label>Size<select name="format"><option value="mini">Mini challenge (hours to a few days)</option><option value="project">Project (4–6 weeks)</option></select></label>
        <label>Individual or team?<select name="mode" id="mode"><option value="individual">Individual</option><option value="team">Team</option></select></label>
        <label>Team size<input name="team_size" type="number" min="2" max="8" value="4" id="ts" disabled></label>
      </div>
      <div class="row">
        <label>Duration<input name="duration_label" placeholder="e.g. 1 day, 6 weeks"></label>
        <label>Expected hours / week<input name="hours_per_week" type="number" min="1" max="40" value="4"></label>
        <label>Deliverable<input name="deliverable" placeholder="e.g. demo + 5 slides"></label>
      </div>
      <div class="row">
        <label>Mentor name<input name="mentor_name"></label>
        <label>Mentor title<input name="mentor_title"></label>
      </div>
      <fieldset><legend>Skills this needs</legend>${chips('skills', skills)}</fieldset>
      <fieldset><legend>Topics</legend>${chips('tags', interests)}</fieldset>
      <button class="btn" style="justify-self:start">Submit for review</button>
    </form>
    <h2>Your challenges</h2>
    ${challenges.length ? `<div class="table-wrap"><table><tr><th>Challenge</th><th>Size</th><th>Status</th><th>Joined</th><th></th></tr>
      ${challenges.map((c) => `<tr><td><a href="#/c/${c.id}">${esc(c.title)}</a></td><td>${formatPill(c)} ${modePill(c)}</td>
        <td>${c.status === 'pending' ? '<span class="pill pending">Pending</span>' : `<span class="pill ok">${c.status}</span>`}</td>
        <td>${c.registrants}</td><td>${c.teams_formed ? `<a href="#/teams/${c.id}">Teams</a>` : ''}</td></tr>`).join('')}
    </table></div>` : '<div class="empty">No challenges yet.</div>'}`;
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
  app.innerHTML = `<h1>Admin</h1>
    <p class="muted">Review company submissions, publish them to the front page, and run team sorting when sign-ups close.</p>
    <div class="table-wrap"><table><tr><th>Challenge</th><th>Company</th><th>Size</th><th>Joined</th><th>Actions</th></tr>
    ${challenges.map((c) => `<tr>
      <td><a href="#/c/${c.id}">${esc(c.title)}</a></td><td>${esc(c.company_name)}</td>
      <td>${formatPill(c)} ${modePill(c)}</td><td>${c.registrants}</td>
      <td>${c.status === 'pending' ? `<button class="btn" data-publish="${c.id}">Publish</button>` : ''}
        ${c.mode === 'team' && c.status === 'published' ? `<button class="btn ghost" data-form="${c.id}" ${c.registrants < 2 ? 'disabled' : ''}>${c.teams_formed ? 'Re-sort teams' : 'Form teams'}</button>` : ''}
        ${c.teams_formed ? `<a href="#/teams/${c.id}">View</a>` : ''}</td></tr>`).join('')}
    </table></div>`;
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
  const meter = (v) => `<span class="meter"><i style="width:${Math.round(v * 100)}%"></i></span> ${Math.round(v * 100)}%`;
  app.innerHTML = `<a href="#/${state.user.role}" class="small">← Back</a>
    <h1 style="margin-top:.5rem">Teams: ${esc(c.title)}</h1>
    <p class="muted">Internal view. Students only see their own team and teammates, never these scores.</p>
    ${teams.length ? `<div class="grid">${teams.map((t) => `<div class="card">
      <h3>${esc(t.name)}</h3>
      <div class="small">Avg strength ${meter(t.metrics.avgStrength)}</div>
      <div class="small">Skill coverage ${meter(t.metrics.coverage)}</div>
      <div class="small">Major mix ${meter(t.metrics.majorMix)}</div>
      <ul>${t.members.map((m) => `<li><b>${esc(m.name)}</b> <span class="muted small">${esc(m.major)} · ${label(m.preferred_role || 'any')}</span><br>
        <span class="small muted">${c.skills.map((s) => `${label(s)} ${m.skills[s] || 0}`).join(' · ')}</span></li>`).join('')}</ul>
    </div>`).join('')}</div>` : '<div class="empty">Teams have not been formed yet.</div>'}`;
}

// ---------- router ----------

async function route() {
  const [path] = location.hash.slice(1).split('?');
  const parts = (path || '/').split('/').filter(Boolean);
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
