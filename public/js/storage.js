// localStorage helpers. Everything is wrapped so private-mode Safari can't crash the game.
import { repairAppearance, RESTAURANT_IDS, DEFAULT_APPEARANCE } from './schema.js';
import { RESTAURANT_BY_ID, VF_FRAMES, VF_TITLES } from './data.js';
import { repairHunt } from './hunt.js';
import { repairMissions } from './missions.js';

const KEYS = { app: 't42.appearance', reviews: 't42.reviews', settings: 't42.settings', quests: 't42.quests' };
const MAX_REVIEWS = 300;

function read(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or disabled — game still works for this session */
  }
}

export function loadAppearance() {
  const raw = read(KEYS.app);
  return { app: raw ? repairAppearance(raw) : { ...DEFAULT_APPEARANCE }, isNew: !raw };
}
export const saveAppearance = (app) => write(KEYS.app, app);

/** Which menu item a saved review was about ('' if it can't be told). Older reviews only have the name. */
function foodId(r) {
  const menu = RESTAURANT_BY_ID[r.rid].menu;
  const name = String(r.food || '');
  // a Mystery Plate ("Pickle Sundae") still counts as trying the food underneath
  const item = menu.find((m) => m.id === r.fid) || menu.find((m) => m.name === name) || menu.find((m) => name.endsWith(` ${m.name}`));
  return item ? item.id : '';
}

/**
 * Keep at most MAX_REVIEWS by dropping the oldest repeats. The newest review of every
 * restaurant + food always stays, so the sticker passport can never lose what was earned.
 */
function trimReviews(list) {
  let extra = list.length - MAX_REVIEWS;
  if (extra <= 0) return list;
  const seen = new Set();
  const keep = new Set();
  for (let i = list.length - 1; i >= 0; i--) {
    const key = `${list[i].rid}/${list[i].fid}`;
    if (seen.has(key)) continue;
    seen.add(key);
    keep.add(list[i]);
  }
  return list.filter((r) => keep.has(r) || extra-- <= 0);
}

// Comic camera: the frame and show title a review was filmed with. Anything odd falls back to the classic look.
const frameId = (v) => (VF_FRAMES.some((f) => f.id === v) ? v : VF_FRAMES[0].id);
const titleIndex = (v) => (Number.isInteger(v) && v >= 0 && v < VF_TITLES.length ? v : 0);

export function loadReviews() {
  const raw = read(KEYS.reviews);
  if (!Array.isArray(raw)) return [];
  return trimReviews(raw
    .filter((r) => r && RESTAURANT_IDS.includes(r.rid) && Number.isInteger(r.stars) && r.stars >= 1 && r.stars <= 5)
    .map((r) => ({
      rid: r.rid,
      fid: foodId(r),
      food: String(r.food || '').slice(0, 40),
      emoji: String(r.emoji || '').slice(0, 8),
      mood: String(r.mood || '').slice(0, 8),
      stars: r.stars,
      ts: Number(r.ts) || Date.now(),
      frame: frameId(r.frame),
      title: titleIndex(r.title),
    })));
}
/** Add a review to this session's `list` and save it. Returns the new list even if saving fails. */
export function addReview(list, review) {
  // Another open tab may have saved since this session loaded. Merge that history
  // with ours, including unsaved reviews, without counting shared entries twice.
  const merged = loadReviews();
  const key = (r) => JSON.stringify([r.rid, r.fid, r.food, r.emoji, r.mood, r.stars, r.ts]);
  const savedCounts = new Map();
  for (const r of merged) {
    const k = key(r);
    savedCounts.set(k, (savedCounts.get(k) || 0) + 1);
  }
  for (const r of list) {
    const k = key(r);
    const n = savedCounts.get(k) || 0;
    if (n) savedCounts.set(k, n - 1);
    else merged.push(r);
  }
  merged.sort((a, b) => a.ts - b.ts);
  const all = trimReviews([...merged, review]);
  write(KEYS.reviews, all);
  return all;
}

export function loadSettings() {
  const s = read(KEYS.settings) || {};
  return { muted: !!s.muted, speak: s.speak !== false, beltFast: !!s.beltFast, frame: frameId(s.frame), title: titleIndex(s.title) };
}
export const saveSettings = (s) => write(KEYS.settings, {
  muted: !!s.muted, speak: !!s.speak, beltFast: !!s.beltFast, frame: frameId(s.frame), title: titleIndex(s.title),
});

/**
 * Personal quests, kept on this device only: the ingredient hunt, reviewer missions and the
 * best dance score. Whatever was saved is checked and repaired, never trusted.
 */
export function loadQuests() {
  const q = read(KEYS.quests) || {};
  const best = q.dance && Number.isInteger(q.dance.best) ? Math.max(0, Math.min(999, q.dance.best)) : 0;
  return { hunt: repairHunt(q.hunt), missions: repairMissions(q.missions), dance: { best } };
}
export const saveQuests = (q) => write(KEYS.quests, q);

/**
 * Another open tab may have saved quests since this one loaded. Returns this session's quests
 * with that folded in, so a save never undoes it: the further-along hunt wins (the same hunt pools
 * its finds), as do the missions with more finished and the better dance score.
 */
export function mergeQuests(session) {
  const saved = loadQuests();
  let hunt = saved.hunt.n > session.hunt.n ? saved.hunt : session.hunt;
  if (saved.hunt.n === session.hunt.n) hunt = repairHunt({ n: hunt.n, found: [...saved.hunt.found, ...session.hunt.found] });
  return {
    hunt,
    missions: saved.missions.done > session.missions.done ? saved.missions : session.missions,
    dance: { best: Math.max(saved.dance.best, session.dance.best) },
  };
}

export function reviewStats(reviews) {
  const stats = {};
  for (const id of RESTAURANT_IDS) stats[id] = { count: 0, avg: 0, list: [] };
  for (const r of reviews) {
    const s = stats[r.rid];
    s.list.push(r);
    s.count++;
  }
  for (const s of Object.values(stats)) s.avg = s.count ? s.list.reduce((a, r) => a + r.stars, 0) / s.count : 0;
  return stats;
}
