// Game content. Restaurant names appear as plain text only — every building,
// color scheme and food model here is original (no logos or trademark art).
// Pure data with no imports: schema.js (and so the Node server) loads this file too.

// Order = position around the town ring, starting straight ahead of the spawn point.
// Buildings that share a shell (`style`) sit on opposite sides of town; `prop` picks
// the giant rooftop food. Menu emoji stay old (Unicode 11 or earlier) for older iPads.
// `react` tags a food with a bite reaction (see FOOD_REACTIONS).
export const RESTAURANTS = [
  {
    id: 'sakura', name: 'Sakura Sushi', style: 'pagoda', prop: 'maki',
    wall: '#ff9fc6', roof: '#3b5bdb', trim: '#fff3bf', inside: '#fff0f6',
    sign: { bg: '#fff0f6', fg: '#3b5bdb', border: '#ff8fb8' }, accent: '#3b5bdb',
    menu: [
      { id: 'californiaroll', name: 'California Roll', emoji: '🍣', blurb: 'Watch out for wasabi!', react: 'spicy' },
      { id: 'cucumberroll', name: 'Cucumber Roll', emoji: '🥒', blurb: 'Cool & crunchy' },
      { id: 'shrimproll', name: 'Shrimp Roll', emoji: '🍤', blurb: 'Cooked shrimp on top' },
      { id: 'edamame', name: 'Edamame', emoji: '🌱', blurb: 'Pop the beans out!' },
      { id: 'mochi', name: 'Mochi', emoji: '🍡', blurb: 'Soft & squishy sweet' },
    ],
  },
  {
    id: 'jj', name: "Jimmy John's", style: 'deli', prop: 'sandwich',
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
    id: 'slice', name: 'Slice Squad', style: 'cottage', prop: 'pizza',
    wall: '#fff1d6', roof: '#2f9e44', trim: '#ffffff', inside: '#fff4e0',
    sign: { bg: '#fffbe6', fg: '#e8590c', border: '#2f9e44' }, accent: '#e8590c',
    menu: [
      { id: 'cheesepizza', name: 'Cheese Pizza', emoji: '🧀', blurb: 'Stretchy cheese pull!' },
      { id: 'pepperonipizza', name: 'Pepperoni Pizza', emoji: '🍕', blurb: 'Loaded with pepperoni' },
      { id: 'garlicknots', name: 'Garlic Knots', emoji: '🥨', blurb: 'Buttery twisty bread' },
    ],
  },
  {
    id: 'mcd', name: "McDonald's", style: 'diner', prop: 'burger',
    wall: '#ff6b5e', roof: '#ffe066', trim: '#ffffff', inside: '#fff5d1',
    sign: { bg: '#fff8e1', fg: '#e8453c', border: '#ffe066' }, accent: '#e8453c',
    menu: [
      { id: 'burger', name: 'Cheeseburger', emoji: '🍔', blurb: 'Cheesy & yummy' },
      { id: 'fries', name: 'French Fries', emoji: '🍟', blurb: 'Hot & salty' },
      { id: 'apples', name: 'Apple Slices', emoji: '🍎', blurb: 'Fresh & crunchy' },
      { id: 'icecream', name: 'Ice Cream Cone', emoji: '🍦', blurb: 'Swirly & cold!', react: 'cold' },
    ],
  },
  {
    id: 'boba', name: 'Bubble Tea Bay', style: 'train', prop: 'boba',
    wall: '#74c0fc', roof: '#e7f5ff', trim: '#ffffff', inside: '#e7f5ff',
    sign: { bg: '#ffffff', fg: '#1971c2', border: '#74c0fc' }, accent: '#1971c2',
    menu: [
      { id: 'bobatea', name: 'Boba Milk Tea', emoji: '🥤', blurb: 'Chewy bubbles!' },
      { id: 'smoothie', name: 'Fruit Smoothie', emoji: '🍹', blurb: 'Icy & fruity', react: 'cold' },
      { id: 'eggwaffle', name: 'Egg Waffle', emoji: '🥞', blurb: 'Bubbly & crispy' },
    ],
  },
  {
    id: 'chipotle', name: 'Chipotle', style: 'adobe', prop: 'burrito',
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
    id: 'china', name: 'China Garden', style: 'pagoda',
    wall: '#e63946', roof: '#2a9d8f', trim: '#ffd166', inside: '#ffe1d6',
    sign: { bg: '#fff6dc', fg: '#c1121f', border: '#ffd166' }, accent: '#c1121f',
    menu: [
      { id: 'dumplings', name: 'Dumplings', emoji: '🥟', blurb: 'Squishy little pockets!' },
      { id: 'orangechicken', name: 'Orange Chicken', emoji: '🍊', blurb: 'Sweet & tangy bites', react: 'sour' },
      { id: 'noodles', name: 'Lo Mein Noodles', emoji: '🍜', blurb: 'Slurpy noodles!' },
      { id: 'friedrice', name: 'Fried Rice', emoji: '🍚', blurb: 'With peas & carrots' },
    ],
  },
  {
    id: 'donut', name: 'Donut Workshop', style: 'deli', prop: 'donut',
    wall: '#fff0c9', roof: '#ff8fc7', trim: '#7b4a2a', inside: '#fff0f6',
    sign: { bg: '#ffffff', fg: '#8a4b2a', border: '#ff8fc7' }, accent: '#8a4b2a',
    menu: [
      { id: 'sprinkledonut', name: 'Sprinkle Donut', emoji: '🍩', blurb: 'Rainbow sprinkles!' },
      { id: 'donutholes', name: 'Donut Holes', emoji: '🍯', blurb: 'Little glazed bites' },
      { id: 'cinnamonroll', name: 'Cinnamon Roll', emoji: '🌀', blurb: 'Swirly & sticky' },
      { id: 'cocoa', name: 'Hot Cocoa', emoji: '☕', blurb: 'With marshmallows' },
    ],
  },
  {
    id: 'cfa', name: 'Chick-fil-A', style: 'cottage', prop: 'milkshake',
    wall: '#fff3e6', roof: '#e5383b', trim: '#ffffff', inside: '#fff0f0',
    sign: { bg: '#ffffff', fg: '#e5383b', border: '#e5383b' }, accent: '#e5383b',
    menu: [
      { id: 'nuggets', name: 'Chicken Nuggets', emoji: '🍗', blurb: 'Golden & crispy' },
      { id: 'wafflefries', name: 'Waffle Fries', emoji: '🍟', blurb: 'Criss-cross potatoes' },
      { id: 'mac', name: 'Mac & Cheese', emoji: '🧀', blurb: 'Super cheesy!' },
      { id: 'shake', name: 'Milkshake', emoji: '🥤', blurb: 'With a cherry on top', react: 'cold' },
    ],
  },
  {
    id: 'sundae', name: 'Sundae Funday', style: 'diner', prop: 'sundae',
    wall: '#96f2d7', roof: '#ffa8c5', trim: '#ffffff', inside: '#f0fff7',
    sign: { bg: '#ffffff', fg: '#e64980', border: '#63e6be' }, accent: '#e64980',
    menu: [
      { id: 'sundae', name: 'Sundae', emoji: '🍨', blurb: 'Hot fudge & a cherry', react: 'cold' },
      { id: 'bananasplit', name: 'Banana Split', emoji: '🍌', blurb: 'Three scoops!', react: 'cold' },
      { id: 'strawberrycone', name: 'Strawberry Cone', emoji: '🍓', blurb: 'Pink & sweet', react: 'cold' },
    ],
  },
  {
    id: 'subway', name: 'Subway', style: 'train',
    wall: '#2bb39b', roof: '#b8f2e6', trim: '#ffffff', inside: '#e3f8f3',
    sign: { bg: '#ffffff', fg: '#1d8f7c', border: '#2bb39b' }, accent: '#1d8f7c',
    menu: [
      { id: 'veggiesub', name: 'Veggie Sub', emoji: '🥖', blurb: 'Lots of crunchy veggies' },
      { id: 'turkeysub', name: 'Turkey Sub', emoji: '🥪', blurb: 'A classic!' },
      { id: 'cookie', name: 'Cookie', emoji: '🍪', blurb: 'Warm & gooey' },
      { id: 'juice', name: 'Apple Juice', emoji: '🧃', blurb: 'Sip sip!' },
    ],
  },
  {
    id: 'tacobell', name: 'Taco Bell', style: 'mission', prop: 'taco',
    wall: '#8e5cf7', roof: '#ff7eb6', trim: '#ffe066', inside: '#efe4ff',
    sign: { bg: '#ffffff', fg: '#6a2ee8', border: '#ff7eb6' }, accent: '#6a2ee8',
    menu: [
      { id: 'taco', name: 'Crunchy Taco', emoji: '🌮', blurb: 'Crunch!' },
      { id: 'quesadilla', name: 'Cheesy Quesadilla', emoji: '🧀', blurb: 'Gooey cheese triangles' },
      { id: 'nachos', name: 'Nachos', emoji: '🧀', blurb: 'Chips with cheese', react: 'spicy' },
      { id: 'twists', name: 'Cinnamon Twists', emoji: '🥨', blurb: 'Sweet & twisty' },
    ],
  },
];
export const RESTAURANT_BY_ID = Object.fromEntries(RESTAURANTS.map((r) => [r.id, r]));

// Bite reactions. Each key is also an emote name (schema.js EMOTES), so friends see it too.
// `tag` is the little badge on the menu tile; `toast` pops up on the first bite.
export const FOOD_REACTIONS = {
  spicy: { tag: '🌶️', label: 'Spicy', toast: 'Hot hot hot! 🔥' },
  sour: { tag: '🍋', label: 'Sour', toast: 'Sooo sour! 🍋' },
  cold: { tag: '❄️', label: 'Cold', toast: 'Brain freeze! ❄️' },
  yuck: { tag: '🤢', label: 'Yucky', toast: 'Eww, yucky! 🤢' },
  wow: { tag: '🌈', label: 'Lucky', toast: 'Wow, so pretty! 🌈' },
};

// Mystery Plate: "Surprise me!" serves a random menu item, usually with one of these
// silly twists — the same 3D model re-tinted, with a new name made from preset words.
export const MYSTERY_TWISTS = [
  { id: 'pickle', word: 'Pickle', emoji: '🥒', tint: '#7fb23a', react: 'yuck' },
  { id: 'bubblegum', word: 'Bubblegum', emoji: '🍬', tint: '#ff7ac8', react: 'yuck' },
  { id: 'broccoli', word: 'Broccoli', emoji: '🥦', tint: '#2f8f3a', react: 'yuck' },
  { id: 'ketchup', word: 'Ketchup', emoji: '🍅', tint: '#c81e1e', react: 'yuck' },
  { id: 'mustard', word: 'Mustard', emoji: '🌭', tint: '#e0b400', react: 'yuck' },
  { id: 'fishy', word: 'Fishy', emoji: '🐟', tint: '#5c8fa8', react: 'yuck' },
  { id: 'fiery', word: 'Fiery', emoji: '🌶️', tint: '#ff6a1f', react: 'spicy' },
  { id: 'frozen', word: 'Frozen', emoji: '❄️', tint: '#9bdcff', react: 'cold' },
  { id: 'sour', word: 'Super Sour', emoji: '🍋', tint: '#d9ec3c', react: 'sour' },
  { id: 'rainbow', word: 'Rainbow', emoji: '🌈', tint: 'rainbow', react: 'wow' },
];

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
  // food reactions (played after a bite, never shown as buttons)
  spicy: { emoji: '🥵', label: 'Spicy!' },
  sour: { emoji: '😖', label: 'Sour!' },
  cold: { emoji: '🥶', label: 'Brain freeze!' },
  yuck: { emoji: '🤢', label: 'Yuck!' },
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
