// Records an end-to-end demo video of one mini team challenge:
//   company posts -> reviewer approves -> students sign up -> teams form ->
//   team submits a GitHub link -> company grades -> winners announced.
//
// Run with `npm run demo:video` (builds the client first). Uses your installed
// Google Chrome through playwright-core and a throwaway database, so your
// local data is untouched. Chrome streams screen frames while the script
// runs; scripts/frames-to-mp4.swift (AVFoundation, built into macOS) turns
// them into media/rungs-end-to-end.mp4. No ffmpeg or browser download needed.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PORT = 4321;
const BASE = `http://localhost:${PORT}`;
const SIZE = { width: 1280, height: 800 };
const TITLE = 'Map EV chargers near campus';
const outDir = path.join(root, 'media');
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'rungs-demo-'));
const dbPath = path.join(work, 'demo.db');
const framesDir = path.join(work, 'frames');
fs.mkdirSync(framesDir);
fs.mkdirSync(outDir, { recursive: true });

// ---------- server ----------
const server = spawn(process.execPath, ['server/index.js'], {
  cwd: root,
  env: { ...process.env, PORT: String(PORT), DB_PATH: dbPath, RUNGS_DEMO: '1' },
  stdio: ['ignore', 'pipe', 'inherit'],
});
await new Promise((resolve, reject) => {
  server.stdout.on('data', (d) => d.toString().includes('running at') && resolve());
  server.on('exit', (code) => reject(new Error(`server exited (${code})`)));
});

// ---------- browser ----------
let browser;
try {
  browser = await chromium.launch({ channel: 'chrome', headless: true });
} catch (e) {
  server.kill();
  throw e;
}
const context = await browser.newContext({ viewport: SIZE });
const page = await context.newPage();
page.setDefaultTimeout(15000); // fail fast instead of hanging if the UI changes
const pause = (ms = 1200) => page.waitForTimeout(ms);

// Screen frames from Chrome's screencast, saved with their timestamps.
const frames = [];
const cdp = await context.newCDPSession(page);
cdp.on('Page.screencastFrame', ({ data, metadata, sessionId }) => {
  const file = path.join(framesDir, `${String(frames.length).padStart(6, '0')}.jpg`);
  fs.writeFileSync(file, Buffer.from(data, 'base64'));
  frames.push(`${file}\t${metadata.timestamp}`);
  cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
});
await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 85, maxWidth: SIZE.width, maxHeight: SIZE.height });
console.log('Recording…');

// Caption bar drawn on top of the app so the video explains itself.
async function caption(step, text) {
  console.log(`  ${step}: ${text}`);
  await page.evaluate(([step, text]) => {
    let el = document.getElementById('demo-caption');
    if (!el) {
      el = document.createElement('div');
      el.id = 'demo-caption';
      el.style.cssText = 'position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:9999;pointer-events:none;'
        + 'background:#171714;color:#fff;padding:12px 18px;max-width:880px;width:max-content;font:600 15px/1.4 Manrope,sans-serif;'
        + 'box-shadow:0 10px 30px rgba(0,0,0,.25);border-left:4px solid #bb0000';
      document.body.appendChild(el);
    }
    el.innerHTML = `<div style="font:500 10px DM Mono,monospace;letter-spacing:.14em;color:#ff8a8a;margin-bottom:4px">${step}</div>${text}`;
  }, [step, text]);
}

async function card(kicker, title, sub, ms = 3200) {
  await page.evaluate(([kicker, title, sub]) => {
    const el = document.createElement('div');
    el.id = 'demo-card';
    el.style.cssText = 'position:fixed;inset:0;z-index:10000;background:#292929;color:#fff;display:grid;place-content:center;padding:64px;';
    el.innerHTML = `<div style="font:500 12px DM Mono,monospace;letter-spacing:.14em;color:#ff8a8a;text-transform:uppercase">${kicker}</div>
      <div style="font:600 64px/1 Manrope,sans-serif;letter-spacing:-.05em;margin:18px 0;max-width:900px">${title}</div>
      <div style="font:400 18px/1.6 Manrope,sans-serif;color:#c9cad2;max-width:720px">${sub}</div>`;
    document.body.appendChild(el);
  }, [kicker, title, sub]);
  await pause(ms);
  await page.evaluate(() => document.getElementById('demo-card')?.remove());
}

async function go(hash) {
  await page.evaluate((h) => { location.hash = h; }, hash);
  await pause(900);
}

async function login(email) {
  if (await page.getByRole('button', { name: 'Log out' }).isVisible()) {
    await page.getByRole('button', { name: 'Log out' }).click();
    await pause(600);
  }
  await go('#/login');
  await page.getByLabel('Email').pressSequentially(email, { delay: 30 });
  await page.getByLabel('Password').fill('demo1234');
  await pause(300);
  await page.getByRole('button', { name: /^Log in/ }).click();
  await pause(1200);
}

let challengeHash = null; // set once the company has posted it

// Click it from the front-page list while it's open; jump straight to it after.
async function openChallenge() {
  await go('#/');
  const row = page.locator('.challenge-row', { hasText: TITLE }).first();
  if (await row.isVisible()) await row.locator('h3 a').click();
  else await go(challengeHash);
  await pause(1200);
}

const demo = (name) => page.getByRole('button', { name }).click().then(() => pause(1500));

try {
  await page.goto(BASE);
  await pause(1500);
  await card('Rungs · end-to-end demo', 'One mini challenge, start to finish.',
    'A company posts a problem, a reviewer approves it, students sign up and get sorted into teams, they ship a GitHub link, the company judges, and winners are announced.');

  // 1. Company posts
  await caption('1 · COMPANY', 'Lakefront Energy logs in to post a short team challenge.');
  await login('lakefront@demo.rungs');
  await go('#/post');
  await caption('1 · COMPANY', 'The survey: what to work on, size, team format, schedule and skills.');
  await page.getByLabel('What should students work on?').pressSequentially(TITLE, { delay: 25 });
  await page.getByLabel('One-line pitch').pressSequentially('Find the blocks around campus furthest from a public charger.', { delay: 12 });
  await page.getByLabel('Individual or team?').selectOption('team');
  await page.getByLabel('Team size').fill('3');
  await page.getByLabel('Mentor name').fill('Paul Grant');
  await page.getByLabel('Deliverable').fill('Map + 3 recommendations');
  await page.locator('.pick label', { hasText: /^python$/ }).click();
  await page.locator('.pick label', { hasText: /^data analysis$/ }).click();
  await page.locator('.pick label', { hasText: /^mobility$/ }).click();
  await pause(800);
  await page.getByRole('button', { name: /Submit for review/ }).click();
  await page.waitForURL(/#\/c\/\d+/);
  challengeHash = new URL(page.url()).hash;
  await caption('1 · COMPANY', 'Submitted. It waits in review: only the company and reviewers can see it.');
  await pause(2500);

  // 2. Reviewer approves
  await caption('2 · REVIEW', 'A reviewer checks every post before it goes live.');
  await login('reviewer@demo.rungs');
  await pause(800);
  const item = page.locator('article.block', { hasText: TITLE });
  await item.scrollIntoViewIfNeeded();
  await pause(1500);
  await item.getByRole('button', { name: /Approve/ }).click();
  await caption('2 · REVIEW', 'Approved. It is now on the front page for students.');
  await pause(2000);

  // 3. Student joins
  await caption('3 · STUDENT', 'Maya, a CS student, logs in and finds it.');
  await login('maya@demo.rungs');
  await page.locator('#challenges').scrollIntoViewIfNeeded();
  await pause(1500);
  await openChallenge();
  await caption('3 · STUDENT', 'She signs up ahead of time by joining the team pool.');
  await page.getByRole('button', { name: /Join the team pool/ }).click();
  await pause(1800);
  await caption('DEMO CONTROLS', 'To fit this in a few minutes, we add sample sign-ups and fast-forward the clock.');
  await demo(/Add 8 sample sign-ups/);

  // 4. Teams form
  await caption('4 · TEAMS', 'At the sign-up deadline, Rungs sorts everyone into balanced, cross-major teams.');
  await demo(/Fast-forward: Close sign-ups/);
  await page.locator('h3', { hasText: 'Your team' }).scrollIntoViewIfNeeded();
  await caption('4 · TEAMS', 'Maya sees her team. The sorting itself stays hidden from students.');
  await pause(2800);

  // 5. Work + submit
  await demo(/Fast-forward: Start the challenge/);
  await caption('5 · SUBMIT', 'The challenge is live. The team submits a link to their work: a GitHub repo, plus an optional demo.');
  await page.getByLabel('Project name').scrollIntoViewIfNeeded();
  await page.getByLabel('Project name').pressSequentially('ChargeGap', { delay: 40 });
  await page.getByLabel('GitHub repo or project link').pressSequentially('https://github.com/chargegap/columbus-ev-gaps', { delay: 15 });
  await page.getByLabel(/Demo, slides or video/).pressSequentially('https://chargegap.example/demo', { delay: 15 });
  await page.getByLabel('What you built').pressSequentially('Interactive map of charger deserts within 2 miles of campus, ranked by student renters.', { delay: 8 });
  await page.getByRole('button', { name: /Submit project/ }).click();
  await pause(1800);
  await caption('DEMO CONTROLS', 'Other teams submit too, then the challenge ends.');
  await demo(/Add sample submissions/);
  await demo(/Fast-forward: End the challenge/);

  // 6. Company judges
  await caption('6 · JUDGING', 'Back as Lakefront Energy: score each submission 1–5 and leave feedback.');
  await login('lakefront@demo.rungs');
  await openChallenge();
  await page.getByRole('link', { name: /Judge submissions/ }).click();
  await pause(1500);
  const row = page.locator('.list-row', { hasText: 'ChargeGap' });
  await row.scrollIntoViewIfNeeded();
  await row.getByLabel('Impact score').selectOption('5');
  await row.getByLabel('Execution score').selectOption('5');
  await row.getByLabel('Presentation score').selectOption('4');
  await row.getByPlaceholder('One line the team will see').pressSequentially('Clear map, real data, and a recommendation we can act on.', { delay: 12 });
  await row.getByRole('button', { name: 'Save grade' }).click();
  await pause(1500);
  await caption('DEMO CONTROLS', 'The other submissions get sample grades.');
  await page.getByRole('link', { name: /Back to challenge/ }).click();
  await pause(900);
  await demo(/Auto-grade the rest/);
  await page.getByRole('link', { name: /Judge submissions/ }).click();
  await pause(1200);

  // 7. Winners
  await caption('7 · WINNERS', 'Rungs suggests the top three by score; the company confirms and announces winners.');
  await page.getByRole('button', { name: /Suggest top 3/ }).click();
  await pause(1500);
  await page.getByRole('button', { name: /Announce winners/ }).click();
  await pause(1800);
  await page.getByRole('link', { name: /Back to challenge/ }).click();
  await pause(1200);
  await caption('7 · WINNERS', 'Winners and their links are now public on the challenge page.');
  await pause(3000);

  // 8. Student sees result
  await caption('8 · FEEDBACK', 'Maya sees her place, her scores and the company’s feedback: a record of real work.');
  await login('maya@demo.rungs');
  await openChallenge();
  await page.locator('.kicker', { hasText: /Your submission/ }).scrollIntoViewIfNeeded();
  await pause(3500);

  await card('That’s the loop', 'Sign up → team → ship → feedback.',
    'Every finished challenge leaves a public result and private feedback, and moves students to the next rung.', 3500);
} finally {
  await cdp.send('Page.stopScreencast').catch(() => {});
  frames.push(`END\t${Date.now() / 1000}`);
  await browser.close();
  server.kill();
}

const list = path.join(work, 'frames.tsv');
fs.writeFileSync(list, frames.join('\n'));
const target = path.join(outDir, 'rungs-end-to-end.mp4');
console.log(`Encoding ${frames.length - 1} frames…`);
await new Promise((resolve, reject) => {
  const swift = spawn('swift', [path.join(root, 'scripts/frames-to-mp4.swift'), list, target], { stdio: 'inherit' });
  swift.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`frames-to-mp4 exited (${code})`))));
});
fs.rmSync(work, { recursive: true, force: true });
console.log(`Saved ${path.relative(root, target)}`);
