// Build-your-own pizza and sundae, and the food a table for two shares: turning preset choices
// into a food item. Pure data in, data out (no DOM), so the game, the scrapbook and the tests agree.
import { BUILDS, BUILD_LOADED, MYSTERY_TWISTS } from './data.js';
import { sanitizeBuild, sanitizeTableFood } from './schema.js';

/** The kitchen's starting point: the first base and no toppings. */
export const defaultBuild = (kind) => ({ k: kind, b: BUILDS[kind].bases[0].id, t: [] });

/** The preset choices behind a build: { def, base, toppings }. */
export function buildParts(build) {
  const def = BUILDS[build.k];
  return { def, base: def.bases.find((b) => b.id === build.b), toppings: def.toppings.filter((t) => build.t.includes(t.id)) };
}

/** A name made of preset words only: "My Plain Pizza", "My Pesto Olive & Corn Pizza", "My Mega Topping Mint Sundae". */
export function buildName(build) {
  const { def, base, toppings } = buildParts(build);
  const words = toppings.map((t) => t.word);
  const tops = BUILD_LOADED[words.length] || words.join(' & ');
  const loaded = words.length in BUILD_LOADED;
  const parts = loaded ? [tops, base.word] : [base.word, tops];
  if (!base.word && !tops) parts.push('Plain');
  return ['My', ...parts.filter(Boolean), def.dish].join(' ');
}

/** The food item for a creation (the same shape as a menu item, plus `build`). */
export function buildItem(build) {
  const { def, toppings } = buildParts(build);
  return {
    id: def.fid, name: buildName(build), emoji: def.emoji, blurb: def.blurb,
    react: toppings.find((t) => t.react)?.react || def.react || undefined, build,
  };
}

/** Tap a topping chip: on if it was off (and there is room), off if it was on. Returns { build, full }. */
export function toggleTopping(build, id) {
  const def = BUILDS[build.k];
  if (build.t.includes(id)) return { build: { ...build, t: build.t.filter((t) => t !== id) }, full: false };
  if (build.t.length >= def.max) return { build, full: true };
  return { build: sanitizeBuild({ ...build, t: [...build.t, id] }) || build, full: false };
}

/** "Mix it up!": a random base and two to `max` random toppings. rand() is in [0, 1). */
export function randomBuild(kind, rand = Math.random) {
  const def = BUILDS[kind];
  const left = def.toppings.map((t) => t.id);
  const t = [];
  for (let n = 2 + Math.floor(rand() * (def.max - 1)); n > 0 && left.length; n--) t.push(left.splice(Math.floor(rand() * left.length), 1)[0]);
  return sanitizeBuild({ k: kind, b: def.bases[Math.floor(rand() * def.bases.length)].id, t });
}

/** A Mystery Plate: menu item `base`, with a silly twist from MYSTERY_TWISTS (or none). */
export function mysteryItem(base, twist = null) {
  const item = { ...base, mystery: true };
  if (!twist) return item;
  return { ...item, name: `${twist.word} ${base.name}`, emoji: twist.emoji, react: twist.react, tint: twist.tint, twist: twist.id };
}

/** What the host of a table sends so the co-host gets the same food: see sanitizeTableFood. */
export function tableFood(item) {
  if (item.build) return { b: item.build };
  return { f: item.id, ...(item.mystery && { my: true }), ...(item.twist && { tw: item.twist }) };
}

/** The other way round: the food item restaurant `r` serves for a (checked) table food, or null. */
export function tableItem(r, input) {
  const food = sanitizeTableFood(r.id, input);
  if (!food) return null;
  if (food.b) return buildItem(food.b);
  const base = r.menu.find((m) => m.id === food.f);
  return food.my ? mysteryItem(base, MYSTERY_TWISTS.find((t) => t.id === food.tw) || null) : base;
}
