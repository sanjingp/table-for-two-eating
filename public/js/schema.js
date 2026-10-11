// Shared between the browser client and the Node server (server imports this file).
// Single source of truth for every enum / preset that crosses the network.
import { RESTAURANTS, BUILDS, MYSTERY_TWISTS } from './data.js';

export const HAIR_STYLES = ['short', 'long', 'ponytail', 'pigtails', 'curly', 'afropuff', 'bun'];
export const TOPS = ['tshirt', 'hoodie', 'dress'];
export const JACKETS = ['none', 'jean', 'puffer', 'raincoat'];
export const BOTTOMS = ['pants', 'shorts', 'skirt', 'leggings'];
export const SHOES = ['sneakers', 'boots', 'sandals', 'lightup'];
// Hats are unlocked by passport badges (see BADGES in data.js); 'none' is always allowed.
export const HATS = ['none', 'chef', 'crown', 'shades'];
// Pet sidekicks are free to pick in the closet. Only the id crosses the network.
export const PETS = ['none', 'puppy', 'kitten', 'dino', 'dragon'];

export const EMOTES = ['wave', 'yum', 'wow', 'thumbs', 'silly', 'kiss', 'dance', 'heart', 'jump',
  'spicy', 'sour', 'cold', 'yuck']; // the last four are food reactions
// air = bounce pad, slide = riding the slide, scoot = on the scooter
export const ANIMS = ['idle', 'walk', 'review', 'air', 'slide', 'scoot'];

// Preset speech lines. Only the index is sent over the network — never free text.
export const LINES = [
  'Welcome to Table for Two!',
  "Let's take a bite!",
  'Mmm, so good!',
  'This is AMAZING!',
  'Crunchy crunchy!',
  'Yummy in my tummy!',
  'Five stars from me!',
  'See you next time!',
  'Hi friend!',
  'Follow me!',
  "Let's go eat!",
  'Wanna race?',
];
export const RACE_LINE = LINES.indexOf('Wanna race?'); // saying it in the plaza starts a race

// Fun names are built from two preset word lists (no typing, ever).
export const NAME_ADJ = ['Sparkly', 'Happy', 'Silly', 'Speedy', 'Cozy', 'Super', 'Giggly', 'Sunny',
  'Bouncy', 'Jolly', 'Crunchy', 'Sweet', 'Cheesy', 'Zippy', 'Fluffy', 'Brave'];
export const NAME_NOUN = ['Taco', 'Noodle', 'Dumpling', 'Cupcake', 'Pickle', 'Waffle', 'Nugget', 'Muffin',
  'Burrito', 'Cookie', 'Pancake', 'Mango', 'Donut', 'Pretzel', 'Sprinkle', 'Meatball'];

export const RESTAURANT_IDS = RESTAURANTS.map((r) => r.id);

export const WORLD_LIMIT = 60;
export const HEIGHT_LIMIT = 12; // highest a player can be off the ground (bounce pads, the slide)

// The town ring: restaurant i stands RING_RADIUS from the fountain at ringAngle(i) (world.js builds it).
export const RING_RADIUS = 42; // room for 20 buildings (each 8–11 wide)
/** Angle of ring slot `i` (fractions sit between buildings). Slot 0 is straight ahead of the spawn point. */
export const ringAngle = (i) => (i / RESTAURANTS.length) * Math.PI * 2 + Math.PI;

// Emotes and preset lines share one token bucket per player on the server.
// The dance party spaces its moves to stay inside it (dance.js).
export const EMOTE_LIMIT = Object.freeze({ burst: 4, perSecond: 1.5 });

// Race to a restaurant. A player only ever sends { t: 'race' }: the server picks the door, starts
// the countdown for everyone and names the winner from the positions it already relays.
export const RACE = Object.freeze({
  countdown: 3, // seconds of "3, 2, 1" before GO
  timeout: 60, // seconds after GO before the race is called off
  cooldown: 10, // seconds before the same player may start another race
  rest: 6, // seconds the whole town rests after a race before the next can start
  doorDist: 37.45, // every door is this far from the fountain, give or take 0.3
  reach: 3.1, // this close to the door means you have arrived
  headStart: 18, // the door is at least this far from every racer
  topSpeed: 12.5, // nobody gets to the door faster than this (the scooter does 11.5)
});

/** Roughly where restaurant `rid`'s door is ({ x, z }), or null for an unknown id. */
export function raceDoorSpot(rid) {
  const i = RESTAURANT_IDS.indexOf(rid);
  if (i < 0) return null;
  const a = ringAngle(i);
  return { x: Math.sin(a) * RACE.doorDist, z: Math.cos(a) * RACE.doorDist };
}

/** Pick a door to race to that is a fair run from every racer. positions: [{ x, z }]. */
export function pickRaceTarget(positions, rand = Math.random) {
  const far = RESTAURANT_IDS.map((rid) => {
    const spot = raceDoorSpot(rid);
    return { rid, nearest: Math.min(Infinity, ...positions.map((p) => Math.hypot(p.x - spot.x, p.z - spot.z))) };
  });
  let fair = far.filter((d) => d.nearest >= RACE.headStart);
  if (!fair.length) fair = [far.reduce((a, b) => (b.nearest > a.nearest ? b : a))]; // crowded town: the farthest door
  return fair[Math.min(fair.length - 1, Math.floor(rand() * fair.length))].rid;
}

// ---------------------------------------------------------------- Phase 4: build your own, table for two
/** Ids the server hands out (players, table sessions). */
export const isId = (v) => typeof v === 'string' && /^[A-Za-z0-9_-]{1,16}$/.test(v);
const isPlainObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const own = (obj, key) => typeof key === 'string' && Object.prototype.hasOwnProperty.call(obj, key);

/**
 * A build-your-own creation: { k: kind, b: base id, t: [topping ids] }, every part picked from BUILDS.
 * Strict: returns a clean copy (toppings in menu order) or null if anything is not a preset.
 */
export function sanitizeBuild(input) {
  if (!isPlainObject(input) || !own(BUILDS, input.k)) return null;
  const def = BUILDS[input.k];
  if (!def.bases.some((b) => b.id === input.b)) return null;
  if (!Array.isArray(input.t) || input.t.length > def.max) return null;
  const ids = def.toppings.map((t) => t.id);
  if (!input.t.every((t) => ids.includes(t)) || new Set(input.t).size !== input.t.length) return null;
  return { k: input.k, b: input.b, t: ids.filter((id) => input.t.includes(id)) };
}

/**
 * What a table for two is eating, as its host sends it: { f: menu id } for a food from restaurant
 * `rid`'s menu, with { my: true, tw: twist id } for a Mystery Plate, or { b: build } for a creation
 * from that restaurant's own kitchen. Returns a clean copy or null.
 */
export function sanitizeTableFood(rid, input) {
  const r = RESTAURANTS.find((x) => x.id === rid);
  if (!r || !isPlainObject(input)) return null;
  if (input.b !== undefined) {
    const b = sanitizeBuild(input.b);
    return b && b.k === r.build ? { b } : null;
  }
  if (!r.menu.some((m) => m.id === input.f)) return null;
  const out = { f: input.f };
  if (input.my !== undefined) {
    if (input.my !== true) return null;
    out.my = true;
  }
  if (input.tw !== undefined) {
    if (!out.my || !MYSTERY_TWISTS.some((t) => t.id === input.tw)) return null; // only a Mystery Plate has a twist
    out.tw = input.tw;
  }
  return out;
}

// Table for two: a friend from the same town takes the co-host seat. Players only ever send ids and
// presets; the server makes the session id, decides who sits where and ends the table when one leaves.
export const TABLE = Object.freeze({
  inviteTtl: 20, // seconds an invite waits for an answer
  seatTtl: 10, // seconds a friend who said yes has to walk in and sit down
  inviteEvery: 4, // seconds between invites from one player (after a burst of two)
  cardEvery: 30, // seconds between invite cards any one player can be shown (after a burst of three), whoever asks
  rest: 30, // seconds before the same player can ask a friend again after a no, an invite taken back, or no answer
  restMax: 240, // every further "no" from that friend doubles their rest, up to this
  doorReach: 6, // the host must be filming this close to the restaurant's door
});
export const TABLE_ANSWERS = ['yes', 'no', 'busy']; // busy: the friend's game answered for them (in the closet, filming…)
// Why an invite did not work out: they said no, are busy, never answered, left town, or it is too soon to ask.
export const TABLE_WHY = ['no', 'busy', 'timeout', 'gone', 'wait'];

const HEX_RE = /^#[0-9a-f]{6}$/i;
export const isHex = (v) => typeof v === 'string' && HEX_RE.test(v);
const oneOf = (list) => (v) => typeof v === 'string' && list.includes(v);

export function isValidName(n) {
  if (typeof n !== 'string' || n.length > 40) return false;
  const parts = n.split(' ');
  return parts.length === 2 && NAME_ADJ.includes(parts[0]) && NAME_NOUN.includes(parts[1]);
}

export const DEFAULT_APPEARANCE = Object.freeze({
  name: 'Sparkly Taco',
  skin: 0.3,
  hair: '#3b2417',
  hairStyle: 'pigtails',
  eyes: '#6b4423',
  top: 'tshirt',
  topColor: '#ff8fc7',
  jacket: 'none',
  jacketColor: '#5b8bd6',
  bottom: 'skirt',
  bottomColor: '#9b5de5',
  shoes: 'lightup',
  shoesColor: '#ffffff',
  hat: 'none',
  pet: 'none',
});

const APPEARANCE_SCHEMA = {
  name: isValidName,
  skin: (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1,
  hair: isHex,
  hairStyle: oneOf(HAIR_STYLES),
  eyes: isHex,
  top: oneOf(TOPS),
  topColor: isHex,
  jacket: oneOf(JACKETS),
  jacketColor: isHex,
  bottom: oneOf(BOTTOMS),
  bottomColor: isHex,
  shoes: oneOf(SHOES),
  shoesColor: isHex,
  hat: oneOf(HATS),
  pet: oneOf(PETS),
};

// Fields added after launch. A page left open from before the update doesn't send them,
// so a missing one takes this value instead of failing the whole appearance.
const LATER_FIELDS = { hat: 'none', pet: 'none' };

function normalize(k, v) {
  if (k === 'skin') return Math.round(v * 1000) / 1000;
  if (APPEARANCE_SCHEMA[k] === isHex) return v.toLowerCase();
  return v;
}

/** Strict: returns a clean copy (unknown keys dropped) or null if any field is invalid. */
export function sanitizeAppearance(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const out = {};
  for (const [k, check] of Object.entries(APPEARANCE_SCHEMA)) {
    const v = input[k] === undefined && k in LATER_FIELDS ? LATER_FIELDS[k] : input[k];
    if (!check(v)) return null;
    out[k] = normalize(k, v);
  }
  return out;
}

/** Lenient: fixes each bad field with the default (used for localStorage data). */
export function repairAppearance(input) {
  const src = input && typeof input === 'object' ? input : {};
  const out = {};
  for (const [k, check] of Object.entries(APPEARANCE_SCHEMA)) {
    out[k] = check(src[k]) ? normalize(k, src[k]) : DEFAULT_APPEARANCE[k];
  }
  return out;
}

// Realistic skin tone gradient, light -> deep. Slider value t in [0, 1].
export const SKIN_STOPS = ['#ffe6d5', '#f6d0b1', '#eab995', '#d9a077', '#c4875a', '#a66d43', '#87522f', '#683d22', '#4a2a17'];

export function skinColor(t) {
  const x = Math.min(1, Math.max(0, Number(t) || 0)) * (SKIN_STOPS.length - 1);
  const i = Math.min(SKIN_STOPS.length - 2, Math.floor(x));
  const f = x - i;
  const a = parseInt(SKIN_STOPS[i].slice(1), 16);
  const b = parseInt(SKIN_STOPS[i + 1].slice(1), 16);
  const mix = (sh) => Math.round(((a >> sh) & 255) * (1 - f) + ((b >> sh) & 255) * f);
  return '#' + ((1 << 24) | (mix(16) << 16) | (mix(8) << 8) | mix(0)).toString(16).slice(1);
}

// Room codes look like "pink-taco-k7q2m9".
export const ROOM_RE = /^[a-z0-9]+(?:-[a-z0-9]+){0,4}$/;
export const isValidRoom = (r) => typeof r === 'string' && r.length >= 3 && r.length <= 40 && ROOM_RE.test(r);

export const ROOM_WORDS_A = ['pink', 'blue', 'green', 'purple', 'yellow', 'orange', 'red', 'teal',
  'gold', 'silver', 'rainbow', 'sunny', 'happy', 'sparkly', 'comfy', 'zippy'];
export const ROOM_WORDS_B = ['taco', 'noodle', 'dumpling', 'burger', 'fries', 'cookie', 'burrito', 'nugget',
  'waffle', 'pickle', 'muffin', 'donut', 'pancake', 'mango', 'pretzel', 'cupcake'];
