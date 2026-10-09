// Game content. Restaurant names appear as plain text only — every building,
// color scheme and food model here is original (no logos or trademark art).

export const RESTAURANTS = [
  {
    id: 'china', name: 'China Garden', style: 'pagoda',
    wall: '#e63946', roof: '#2a9d8f', trim: '#ffd166', inside: '#ffe1d6',
    sign: { bg: '#fff6dc', fg: '#c1121f', border: '#ffd166' }, accent: '#c1121f',
    menu: [
      { id: 'dumplings', name: 'Dumplings', emoji: '🥟', blurb: 'Squishy little pockets!' },
      { id: 'orangechicken', name: 'Orange Chicken', emoji: '🍊', blurb: 'Sweet & tangy bites' },
      { id: 'noodles', name: 'Lo Mein Noodles', emoji: '🍜', blurb: 'Slurpy noodles!' },
      { id: 'friedrice', name: 'Fried Rice', emoji: '🍚', blurb: 'With peas & carrots' },
    ],
  },
  {
    id: 'jj', name: "Jimmy John's", style: 'deli',
    wall: '#fdfdfd', roof: '#d62828', trim: '#222222', inside: '#f1f1f1',
    sign: { bg: '#ffffff', fg: '#d62828', border: '#222222' }, accent: '#d62828',
    menu: [
      { id: 'sandwich', name: 'Turkey Sandwich', emoji: '🥪', blurb: 'Stacked up tall!' },
      { id: 'hamsub', name: 'Ham & Cheese Sub', emoji: '🥖', blurb: 'A long, long sandwich' },
      { id: 'cookie', name: 'Giant Cookie', emoji: '🍪', blurb: 'Chocolate chips!' },
      { id: 'chips', name: 'Potato Chips', emoji: '🥔', blurb: 'Crunch crunch!' },
    ],
  },
  {
    id: 'cfa', name: 'Chick-fil-A', style: 'cottage',
    wall: '#fff3e6', roof: '#e5383b', trim: '#ffffff', inside: '#fff0f0',
    sign: { bg: '#ffffff', fg: '#e5383b', border: '#e5383b' }, accent: '#e5383b',
    menu: [
      { id: 'nuggets', name: 'Chicken Nuggets', emoji: '🍗', blurb: 'Golden & crispy' },
      { id: 'wafflefries', name: 'Waffle Fries', emoji: '🍟', blurb: 'Criss-cross potatoes' },
      { id: 'mac', name: 'Mac & Cheese', emoji: '🧀', blurb: 'Super cheesy!' },
      { id: 'shake', name: 'Milkshake', emoji: '🥤', blurb: 'With a cherry on top' },
    ],
  },
  {
    id: 'mcd', name: "McDonald's", style: 'diner',
    wall: '#ef3b36', roof: '#ffc72c', trim: '#ffffff', inside: '#fff5d1',
    sign: { bg: '#fff8e1', fg: '#d62828', border: '#ffc72c' }, accent: '#d62828',
    menu: [
      { id: 'burger', name: 'Cheeseburger', emoji: '🍔', blurb: 'Cheesy & yummy' },
      { id: 'fries', name: 'French Fries', emoji: '🍟', blurb: 'Hot & salty' },
      { id: 'apples', name: 'Apple Slices', emoji: '🍎', blurb: 'Fresh & crunchy' },
      { id: 'icecream', name: 'Ice Cream Cone', emoji: '🍦', blurb: 'Swirly & cold!' },
    ],
  },
  {
    id: 'chipotle', name: 'Chipotle', style: 'adobe',
    wall: '#b5652f', roof: '#7a2e1b', trim: '#f2cc8f', inside: '#fbe4cf',
    sign: { bg: '#fdf0e1', fg: '#7a2e1b', border: '#7a2e1b' }, accent: '#7a2e1b',
    menu: [
      { id: 'burrito', name: 'Burrito', emoji: '🌯', blurb: 'All wrapped up!' },
      { id: 'bowl', name: 'Burrito Bowl', emoji: '🥗', blurb: 'Rice, beans & more' },
      { id: 'guac', name: 'Chips & Guac', emoji: '🥑', blurb: 'Dip dip dip!' },
      { id: 'quesadilla', name: 'Quesadilla', emoji: '🧀', blurb: 'Melty cheese inside' },
    ],
  },
  {
    id: 'subway', name: 'Subway', style: 'train',
    wall: '#1f8a4c', roof: '#ffd23f', trim: '#ffffff', inside: '#e7f7dc',
    sign: { bg: '#ffffff', fg: '#1f8a4c', border: '#ffd23f' }, accent: '#1f8a4c',
    menu: [
      { id: 'veggiesub', name: 'Veggie Sub', emoji: '🥖', blurb: 'Lots of crunchy veggies' },
      { id: 'turkeysub', name: 'Turkey Sub', emoji: '🥪', blurb: 'A classic!' },
      { id: 'cookie', name: 'Cookie', emoji: '🍪', blurb: 'Warm & gooey' },
      { id: 'juice', name: 'Apple Juice', emoji: '🧃', blurb: 'Sip sip!' },
    ],
  },
  {
    id: 'tacobell', name: 'Taco Bell', style: 'mission',
    wall: '#8e5cf7', roof: '#ff7eb6', trim: '#ffe066', inside: '#efe4ff',
    sign: { bg: '#ffffff', fg: '#6a2ee8', border: '#ff7eb6' }, accent: '#6a2ee8',
    menu: [
      { id: 'taco', name: 'Crunchy Taco', emoji: '🌮', blurb: 'Crunch!' },
      { id: 'quesadilla', name: 'Cheesy Quesadilla', emoji: '🧀', blurb: 'Gooey cheese triangles' },
      { id: 'nachos', name: 'Nachos', emoji: '🧀', blurb: 'Chips with cheese' },
      { id: 'twists', name: 'Cinnamon Twists', emoji: '🥨', blurb: 'Sweet & twisty' },
    ],
  },
];
export const RESTAURANT_BY_ID = Object.fromEntries(RESTAURANTS.map((r) => [r.id, r]));

export const HAIR_STYLE_INFO = {
  short: { label: 'Short', icon: '💇' },
  long: { label: 'Long', icon: '👱‍♀️' },
  ponytail: { label: 'Ponytail', icon: '🎀' },
  pigtails: { label: 'Pigtails', icon: '👧' },
  curly: { label: 'Curly', icon: '🌀' },
  afropuff: { label: 'Afro Puff', icon: '☁️' },
  bun: { label: 'Bun', icon: '🍩' },
};

export const HAIR_COLORS = [
  ['Black', '#1c1714'], ['Dark Brown', '#3b2417'], ['Brown', '#6b4226'], ['Auburn', '#8c3b1e'],
  ['Ginger', '#c4602b'], ['Blonde', '#e3bf63'], ['Platinum', '#f1e5c4'], ['Gray', '#9a9a9a'],
  ['Pink', '#ff7eb6'], ['Purple', '#9b5de5'], ['Blue', '#3a86ff'], ['Teal', '#2ec4b6'],
];

export const EYE_COLORS = [
  ['Brown', '#6b4423'], ['Hazel', '#8e7a3a'], ['Blue', '#3a7bd5'],
  ['Green', '#3f9a4a'], ['Gray', '#8a96a3'], ['Amber', '#c88a1e'],
];

export const CLOTH_COLORS = [
  ['Pink', '#ff8fc7'], ['White', '#ffffff'], ['Purple', '#9b5de5'], ['Blue', '#3a86ff'],
  ['Yellow', '#ffd23f'], ['Red', '#e63946'], ['Orange', '#ff9f1c'], ['Green', '#2ec45b'],
  ['Black', '#2b2b2b'], ['Brown', '#7b4a2a'], ['Teal', '#1fb5ad'], ['Lavender', '#c8b6ff'],
  ['Mint', '#98f5c8'], ['Denim', '#5b8bd6'], ['Navy', '#22356e'],
];

export const CLOTHES = {
  top: { title: 'Tops', icon: '👕', colorKey: 'topColor', options: { tshirt: ['T-shirt', '👕'], hoodie: ['Hoodie', '🧥'], dress: ['Dress', '👗'] } },
  jacket: { title: 'Jackets', icon: '🧥', colorKey: 'jacketColor', options: { none: ['No jacket', '🚫'], jean: ['Jean jacket', '🧥'], puffer: ['Puffer', '☁️'], raincoat: ['Raincoat', '☔'] } },
  bottom: { title: 'Bottoms', icon: '👖', colorKey: 'bottomColor', options: { pants: ['Pants', '👖'], shorts: ['Shorts', '🩳'], skirt: ['Skirt', '💃'], leggings: ['Leggings', '🧘'] } },
  shoes: { title: 'Shoes', icon: '👟', colorKey: 'shoesColor', options: { sneakers: ['Sneakers', '👟'], boots: ['Boots', '🥾'], sandals: ['Sandals', '🩴'], lightup: ['Light-up!', '✨'] } },
};

export const EMOTE_INFO = {
  wave: { emoji: '👋', label: 'Wave' },
  yum: { emoji: '😋', label: 'Yum' },
  wow: { emoji: '🤩', label: 'Wow' },
  thumbs: { emoji: '👍', label: 'Thumbs up' },
  silly: { emoji: '🤪', label: 'Silly face' },
  kiss: { emoji: '🤌', label: "Chef's kiss" },
  dance: { emoji: '💃', label: 'Dance' },
  heart: { emoji: '💖', label: 'Love it' },
  jump: { emoji: '⭐', label: 'Jump' },
};

export const REVIEW_EMOTES = ['yum', 'wow', 'thumbs', 'silly', 'kiss', 'heart'];
export const PLAZA_EMOTES = ['wave', 'yum', 'wow', 'thumbs', 'silly', 'kiss', 'dance', 'heart'];
// Indexes into LINES (schema.js)
export const REVIEW_LINES = [0, 1, 2, 3, 4, 5, 6, 7];
export const PLAZA_LINES = [8, 9, 10, 11, 0, 2];

export const MOODS = ['😍', '🤩', '😋', '🙂', '😐', '🤢'];

// Grown-up co-host who sits across the table in review mode.
export const COHOST = {
  hair: '#3b2417', hairStyle: 'short', eyes: '#6b4423', top: 'tshirt', topColor: '#3a86ff',
  jacket: 'none', jacketColor: '#5b8bd6', bottom: 'pants', bottomColor: '#33415c', shoes: 'sneakers', shoesColor: '#ffffff',
};
