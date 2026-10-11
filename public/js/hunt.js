// Hidden ingredient hunt: where the giant ingredients hide and what they cook up.
// Pure data in, data out (no DOM, no 3D), so the game and the tests agree. Everything
// follows from the hunt number alone, so a reload hides the same things in the same places.
// The hunt is personal: nothing here is ever sent to friends.
import { INGREDIENTS, RECIPE_WORDS, RECIPE_DISHES, RESTAURANTS } from './data.js';
import { RING_RADIUS, ringAngle } from './schema.js';

export const HUNT_SIZE = 6;
const INGREDIENT_IDS = INGREDIENTS.map((i) => i.id);

/** Small seeded random number generator (mulberry32): the same seed always gives the same numbers. */
function seeded(seed) {
  let a = (seed + 1) * 0x9e3779b1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffled(list, rnd) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const at = (slot, dist) => ({ x: Math.sin(ringAngle(slot)) * dist, z: Math.cos(ringAngle(slot)) * dist });
// Grass gaps the playground already uses (bounce pads, and the slide in the last gap).
const BUSY_GAPS = [3, 6, 9, 13, 16];

/** Every hiding place of one kind: out in the grass, in the gap between two buildings, or behind one. */
function places(where, rnd) {
  const n = RESTAURANTS.length;
  const list = [];
  for (let i = 0; i < n; i++) {
    if (where === 'grass' && (BUSY_GAPS.includes(i) || i === n - 1)) continue;
    if (where === 'grass') list.push(at(i + 0.5, 19.5 + rnd() * 12));
    else if (where === 'gap') list.push(at(i + 0.5, RING_RADIUS + 1.5));
    else list.push(at(i, RING_RADIUS + 6.4));
  }
  return list;
}

/**
 * Hunt number `n` → six { id, x, z, where }: two easy ones in the grass, two between buildings
 * and two behind them. `isFree(x, z)` lets the game veto a spot that is inside something.
 */
export function huntLayout(n, isFree = () => true) {
  const rnd = seeded(n);
  const ids = shuffled(INGREDIENT_IDS, rnd).slice(0, HUNT_SIZE);
  const spots = [];
  for (const where of ['grass', 'gap', 'back']) {
    const free = shuffled(places(where, rnd), rnd).filter((p) => isFree(p.x, p.z));
    // the very first ingredient waits in plain sight, beside the path straight ahead of the spawn point
    if (n === 0 && where === 'grass') {
      const first = at(0.5, 20);
      free.splice(0, free.length, first, ...free.filter((p) => Math.hypot(p.x - first.x, p.z - first.z) > 6));
    }
    for (const p of free.slice(0, HUNT_SIZE / 3)) spots.push({ ...p, where });
  }
  return spots.map((p, i) => ({ id: ids[i], x: p.x, z: p.z, where: p.where }));
}

/** The silly dish cooked from hunt n's ingredients: a name made of preset words, and a sticker emoji. */
export function recipeFor(n) {
  const rnd = seeded(n * 7919 + 101);
  const [a, b] = shuffled(huntLayout(n).map((it) => it.id), rnd).map((id) => INGREDIENTS.find((i) => i.id === id));
  const word = RECIPE_WORDS[Math.floor(rnd() * RECIPE_WORDS.length)];
  const dish = RECIPE_DISHES[Math.floor(rnd() * RECIPE_DISHES.length)];
  return { n, name: `${word} ${a.name} & ${b.name} ${dish.name}`, emoji: dish.emoji, made: `${a.emoji}${b.emoji}` };
}

export const newHunt = () => ({ n: 0, found: [] });

/** Clean up saved hunt progress: n = hunts finished, found = ingredient ids found in the current one. */
export function repairHunt(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const n = Number.isInteger(src.n) && src.n >= 0 && src.n < 100000 ? src.n : 0;
  const hidden = huntLayout(n).map((it) => it.id);
  const found = Array.isArray(src.found) ? hidden.filter((id) => src.found.includes(id)) : [];
  // six found means the recipe was cooked but the next hunt never got saved: start it now
  return found.length >= HUNT_SIZE ? { n: n + 1, found: [] } : { n, found };
}
