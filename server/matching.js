import { MAX_LEVEL } from './catalog.js';

// Weights for the challenge feed. Kept in one place so they are easy to tune.
export const FEED_WEIGHTS = {
  skill: 0.4,     // how well the student's skills cover what the challenge needs
  interest: 0.25, // overlap between challenge tags and student interests
  time: 0.2,      // can they realistically give the hours?
  stretch: 0.1,   // a couple of new skills to learn is a feature, not a bug
  early: 0.05,    // "empty room" boost: challenges that still need people
};

// Scores one challenge for one student. Returns a 0..1 score plus
// human-readable reasons that we show on the card ("why you're seeing this").
export function scoreChallenge(profile, challenge, registrantCount = 0) {
  const reasons = [];
  const required = challenge.skills;
  const levels = profile.skills || {};

  const skill = required.length
    ? required.reduce((sum, s) => sum + Math.min(levels[s] || 0, MAX_LEVEL) / MAX_LEVEL, 0) / required.length
    : 0.5;
  const have = required.filter((s) => levels[s]);
  const missing = required.filter((s) => !levels[s]);
  if (have.length) reasons.push(`Uses your ${have.slice(0, 3).join(', ')}`);

  // One or two unfamiliar skills is a good stretch; all-new is a wall.
  const stretch = missing.length > 0 && have.length >= missing.length ? 1 : 0;
  if (stretch) reasons.push(`Chance to learn ${missing.slice(0, 2).join(', ')}`);

  const sharedTags = challenge.tags.filter((t) => (profile.interests || []).includes(t));
  const interest = challenge.tags.length ? sharedTags.length / challenge.tags.length : 0;
  if (sharedTags.length) reasons.push(`You're into ${sharedTags.slice(0, 2).join(' & ')}`);

  const hours = profile.hours_per_week || 0;
  const time = challenge.hours_per_week > 0 ? Math.min(1, hours / challenge.hours_per_week) : 1;
  if (time >= 1) reasons.push(`Fits your ${hours} hrs/week`);

  const seats = challenge.mode === 'team' ? challenge.team_size * 2 : 5;
  const early = registrantCount < seats ? 1 : 0;
  if (early) reasons.push('Early spot: be one of the first in');

  const w = FEED_WEIGHTS;
  const score = w.skill * skill + w.interest * interest + w.time * time + w.stretch * stretch + w.early * early;
  return { score: Math.round(score * 100) / 100, reasons };
}

export function recommend(profile, challenges, counts) {
  return challenges
    .map((c) => ({ ...c, match: scoreChallenge(profile, c, counts[c.id] || 0) }))
    .sort((a, b) => b.match.score - a.match.score);
}
