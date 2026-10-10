// localStorage helpers. Everything is wrapped so private-mode Safari can't crash the game.
import { repairAppearance, RESTAURANT_IDS, DEFAULT_APPEARANCE } from './schema.js';
import { RESTAURANT_BY_ID } from './data.js';

const KEYS = { app: 't42.appearance', reviews: 't42.reviews', settings: 't42.settings' };
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

export function loadReviews() {
  const raw = read(KEYS.reviews);
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((r) => r && RESTAURANT_IDS.includes(r.rid) && Number.isInteger(r.stars) && r.stars >= 1 && r.stars <= 5)
    .map((r) => ({
      rid: r.rid,
      fid: foodId(r),
      food: String(r.food || '').slice(0, 40),
      emoji: String(r.emoji || '').slice(0, 8),
      mood: String(r.mood || '').slice(0, 8),
      stars: r.stars,
      ts: Number(r.ts) || Date.now(),
    }))
    .slice(-MAX_REVIEWS);
}
export function addReview(review) {
  const all = loadReviews();
  all.push(review);
  write(KEYS.reviews, all.slice(-MAX_REVIEWS));
  return all;
}

export function loadSettings() {
  const s = read(KEYS.settings) || {};
  return { muted: !!s.muted, speak: s.speak !== false, beltFast: !!s.beltFast };
}
export const saveSettings = (s) => write(KEYS.settings, { muted: !!s.muted, speak: !!s.speak, beltFast: !!s.beltFast });

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
