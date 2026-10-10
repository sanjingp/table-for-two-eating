// Shared between the browser client and the Node server (server imports this file).
// Single source of truth for every enum / preset that crosses the network.
import { RESTAURANTS } from './data.js';

export const HAIR_STYLES = ['short', 'long', 'ponytail', 'pigtails', 'curly', 'afropuff', 'bun'];
export const TOPS = ['tshirt', 'hoodie', 'dress'];
export const JACKETS = ['none', 'jean', 'puffer', 'raincoat'];
export const BOTTOMS = ['pants', 'shorts', 'skirt', 'leggings'];
export const SHOES = ['sneakers', 'boots', 'sandals', 'lightup'];

export const EMOTES = ['wave', 'yum', 'wow', 'thumbs', 'silly', 'kiss', 'dance', 'heart', 'jump',
  'spicy', 'sour', 'cold', 'yuck']; // the last four are food reactions
export const ANIMS = ['idle', 'walk', 'review'];

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

// Fun names are built from two preset word lists (no typing, ever).
export const NAME_ADJ = ['Sparkly', 'Happy', 'Silly', 'Speedy', 'Cozy', 'Super', 'Giggly', 'Sunny',
  'Bouncy', 'Jolly', 'Crunchy', 'Sweet', 'Cheesy', 'Zippy', 'Fluffy', 'Brave'];
export const NAME_NOUN = ['Taco', 'Noodle', 'Dumpling', 'Cupcake', 'Pickle', 'Waffle', 'Nugget', 'Muffin',
  'Burrito', 'Cookie', 'Pancake', 'Mango', 'Donut', 'Pretzel', 'Sprinkle', 'Meatball'];

export const RESTAURANT_IDS = RESTAURANTS.map((r) => r.id);

export const WORLD_LIMIT = 60;

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
};

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
    const v = input[k];
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
