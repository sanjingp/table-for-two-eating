// Game content. Restaurant names appear as plain text only — every building,
// color scheme and food model here is original (no logos or trademark art).
// Pure data with no imports: schema.js (and so the Node server) loads this file too.

// Order = position around the town ring, starting straight ahead of the spawn point.
// Buildings that share a shell (`style`) sit far apart; `prop` picks the giant rooftop food.
// Menu and sticker emoji stay old (Unicode 11 or earlier) for older iPads.
// `react` tags a food with a bite reaction (see FOOD_REACTIONS); `sticker` is the passport
// sticker earned by the first review there; `belt` gives the restaurant a sushi conveyor belt;
// `build` gives it a build-your-own kitchen (see BUILDS).
export const RESTAURANTS = [
  {
    id: 'sakura', name: 'Sakura Sushi', style: 'pagoda', prop: 'maki', sticker: '🍣', belt: true,
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
    id: 'jj', name: "Jimmy John's", style: 'deli', prop: 'sandwich', sticker: '🥪',
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
    id: 'fish', name: 'Fish & Ships', style: 'boat', prop: 'fish', sticker: '🐟',
    wall: '#1c7ed6', roof: '#e03131', trim: '#ffffff', inside: '#e7f5ff',
    sign: { bg: '#ffffff', fg: '#1864ab', border: '#e03131' }, accent: '#1864ab',
    menu: [
      { id: 'fishchips', name: 'Fish & Chips', emoji: '🐟', blurb: 'Crispy fish, chunky chips' },
      { id: 'popcornshrimp', name: 'Popcorn Shrimp', emoji: '🍤', blurb: 'Pop them in one bite!' },
      { id: 'corncob', name: 'Corn on the Cob', emoji: '🌽', blurb: 'Buttery & sweet' },
    ],
  },
  {
    id: 'slice', name: 'Slice Squad', style: 'cottage', prop: 'pizza', sticker: '🍕', build: 'pizza',
    wall: '#fff1d6', roof: '#2f9e44', trim: '#ffffff', inside: '#fff4e0',
    sign: { bg: '#fffbe6', fg: '#e8590c', border: '#2f9e44' }, accent: '#e8590c',
    menu: [
      { id: 'cheesepizza', name: 'Cheese Pizza', emoji: '🧀', blurb: 'Stretchy cheese pull!' },
      { id: 'pepperonipizza', name: 'Pepperoni Pizza', emoji: '🍕', blurb: 'Loaded with pepperoni' },
      { id: 'garlicknots', name: 'Garlic Knots', emoji: '🥨', blurb: 'Buttery twisty bread' },
    ],
  },
  {
    id: 'mcd', name: "McDonald's", style: 'diner', prop: 'burger', sticker: '🍔',
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
    id: 'curry', name: 'Curry Castle', style: 'castle', prop: 'curry', sticker: '🍛',
    wall: '#ffb347', roof: '#c2185b', trim: '#fff3c4', inside: '#fff3e0',
    sign: { bg: '#fff8e1', fg: '#c2185b', border: '#ff9800' }, accent: '#c2185b',
    menu: [
      { id: 'butterchicken', name: 'Butter Chicken', emoji: '🍛', blurb: 'Creamy & mild with rice' },
      { id: 'naan', name: 'Naan', emoji: '🍞', blurb: 'Warm, puffy bread' },
      { id: 'samosa', name: 'Samosa', emoji: '🥟', blurb: 'Crispy triangle pockets' },
      { id: 'lassi', name: 'Mango Lassi', emoji: '🥭', blurb: 'A cold mango shake', react: 'cold' },
    ],
  },
  {
    id: 'boba', name: 'Bubble Tea Bay', style: 'train', prop: 'boba', sticker: '🥤',
    wall: '#74c0fc', roof: '#e7f5ff', trim: '#ffffff', inside: '#e7f5ff',
    sign: { bg: '#ffffff', fg: '#1971c2', border: '#74c0fc' }, accent: '#1971c2',
    menu: [
      { id: 'bobatea', name: 'Boba Milk Tea', emoji: '🥤', blurb: 'Chewy bubbles!' },
      { id: 'smoothie', name: 'Fruit Smoothie', emoji: '🍹', blurb: 'Icy & fruity', react: 'cold' },
      { id: 'eggwaffle', name: 'Egg Waffle', emoji: '🥞', blurb: 'Bubbly & crispy' },
    ],
  },
  {
    id: 'noodle', name: 'Noodle Ninja', style: 'pagoda', prop: 'ramen', sticker: '🍜',
    wall: '#3d405b', roof: '#e63946', trim: '#ffd166', inside: '#f4f1de',
    sign: { bg: '#ffffff', fg: '#3d405b', border: '#e63946' }, accent: '#3d405b',
    menu: [
      { id: 'ramen', name: 'Chicken Ramen', emoji: '🍜', blurb: 'Slurp the noodles!' },
      { id: 'gyoza', name: 'Gyoza', emoji: '🥟', blurb: 'Crispy on the bottom' },
      { id: 'riceball', name: 'Rice Ball', emoji: '🍙', blurb: 'A triangle of rice' },
    ],
  },
  {
    id: 'chipotle', name: 'Chipotle', style: 'adobe', prop: 'burrito', sticker: '🌯',
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
    id: 'seoul', name: 'Seoul Bites', style: 'deli', prop: 'corndog', sticker: '🌭',
    wall: '#ffffff', roof: '#4d6cfa', trim: '#ff5d8f', inside: '#fff0f5',
    sign: { bg: '#ffffff', fg: '#4d6cfa', border: '#ff5d8f' }, accent: '#4d6cfa',
    menu: [
      { id: 'corndog', name: 'Korean Corn Dog', emoji: '🌭', blurb: 'Crunchy on a stick' },
      { id: 'kimbap', name: 'Kimbap', emoji: '🍱', blurb: 'Rainbow rice rolls' },
      { id: 'mandu', name: 'Mandu', emoji: '🥟', blurb: 'Steamy little dumplings' },
      { id: 'shavedice', name: 'Shaved Ice', emoji: '🍧', blurb: 'A snowy fruit mountain', react: 'cold' },
    ],
  },
  {
    id: 'pasta', name: 'Pasta Porch', style: 'cottage', prop: 'meatballs', sticker: '🍝',
    wall: '#fff8e7', roof: '#b23a48', trim: '#ffffff', inside: '#fdf0d5',
    sign: { bg: '#fffdf5', fg: '#2d6a4f', border: '#b23a48' }, accent: '#2d6a4f',
    menu: [
      { id: 'spaghetti', name: 'Spaghetti & Meatballs', emoji: '🍝', blurb: 'Twirl it on your fork' },
      { id: 'ravioli', name: 'Ravioli', emoji: '🧀', blurb: 'Cheesy pasta pillows' },
      { id: 'garlicbread', name: 'Garlic Bread', emoji: '🥖', blurb: 'Toasty & buttery' },
    ],
  },
  {
    id: 'sunny', name: 'Sunny Breakfast Cafe', style: 'diner', prop: 'pancakes', sticker: '🥞',
    wall: '#ffe066', roof: '#ff922b', trim: '#ffffff', inside: '#fff9db',
    sign: { bg: '#ffffff', fg: '#f76707', border: '#ffd43b' }, accent: '#f76707',
    menu: [
      { id: 'pancakes', name: 'Pancakes', emoji: '🥞', blurb: 'A tall syrupy stack' },
      { id: 'waffles', name: 'Waffles', emoji: '🍯', blurb: 'Crispy squares & syrup' },
      { id: 'eggsbacon', name: 'Eggs & Bacon', emoji: '🍳', blurb: 'A smiley breakfast!' },
      { id: 'oj', name: 'Orange Juice', emoji: '🍊', blurb: 'Fresh & zingy', react: 'sour' },
    ],
  },
  {
    id: 'pita', name: 'Pita Picnic', style: 'dome', prop: 'pita', sticker: '🥙',
    wall: '#ffffff', roof: '#0fa3b1', trim: '#0fa3b1', inside: '#e6fafc',
    sign: { bg: '#ffffff', fg: '#0b7a85', border: '#ffd54f' }, accent: '#0b7a85',
    menu: [
      { id: 'chickenpita', name: 'Chicken Pita', emoji: '🥙', blurb: 'A pocket full of yum' },
      { id: 'falafel', name: 'Falafel Bites', emoji: '🌰', blurb: 'Crunchy outside, soft inside' },
      { id: 'hummus', name: 'Hummus', emoji: '🥣', blurb: 'Scoop it with pita chips' },
    ],
  },
  {
    id: 'china', name: 'China Garden', style: 'pagoda', sticker: '🥡',
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
    id: 'donut', name: 'Donut Workshop', style: 'deli', prop: 'donut', sticker: '🍩',
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
    id: 'bbq', name: 'Cozy BBQ', style: 'barn', sticker: '🔥',
    wall: '#c0392b', roof: '#5c3d2e', trim: '#ffffff', inside: '#fff1e0',
    sign: { bg: '#fff8ee', fg: '#8d2b1f', border: '#5c3d2e' }, accent: '#8d2b1f',
    menu: [
      { id: 'slider', name: 'Chicken Sliders', emoji: '🍔', blurb: 'Two tiny sandwiches' },
      { id: 'cornbread', name: 'Cornbread', emoji: '🌽', blurb: 'Sweet golden squares' },
      { id: 'bbqmac', name: 'Skillet Mac & Cheese', emoji: '🧀', blurb: 'Bubbly from the oven' },
    ],
  },
  {
    id: 'cfa', name: 'Chick-fil-A', style: 'cottage', prop: 'milkshake', sticker: '🍗',
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
    id: 'sundae', name: 'Sundae Funday', style: 'diner', prop: 'sundae', sticker: '🍨', build: 'sundae',
    wall: '#96f2d7', roof: '#ffa8c5', trim: '#ffffff', inside: '#f0fff7',
    sign: { bg: '#ffffff', fg: '#e64980', border: '#63e6be' }, accent: '#e64980',
    menu: [
      { id: 'sundae', name: 'Sundae', emoji: '🍨', blurb: 'Hot fudge & a cherry', react: 'cold' },
      { id: 'bananasplit', name: 'Banana Split', emoji: '🍌', blurb: 'Three scoops!', react: 'cold' },
      { id: 'strawberrycone', name: 'Strawberry Cone', emoji: '🍓', blurb: 'Pink & sweet', react: 'cold' },
    ],
  },
  {
    id: 'subway', name: 'Subway', style: 'train', sticker: '🚂',
    wall: '#2bb39b', roof: '#b8f2e6', trim: '#ffffff', inside: '#e3f8f3',
    sign: { bg: '#ffffff', fg: '#1d8f7c', border: '#2bb39b' }, accent: '#1d8f7c',
    menu: [
      { id: 'veggiesub', name: 'Veggie Sub', emoji: '🥖', blurb: 'Lots of crunchy veggies' },
      { id: 'turkeysub', name: 'Turkey Sub', emoji: '🥪', blurb: 'A classic!' },
      { id: 'cookie', name: 'Cookie', emoji: '🍪', blurb: 'Warm & gooey' },
      { id: 'juice', name: 'Apple Juice', emoji: '🍏', blurb: 'Sip sip!' },
    ],
  },
  {
    id: 'tacobell', name: 'Taco Bell', style: 'mission', prop: 'taco', sticker: '🌮',
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

// Hats come from passport badges, never from the closet alone (ids in schema.js HATS).
export const HAT_INFO = {
  none: { label: 'No hat', icon: '🚫' },
  chef: { label: 'Chef Hat', icon: '👨‍🍳' },
  crown: { label: 'Crown', icon: '👑' },
  shades: { label: 'Sunglasses', icon: '🕶️' },
};

// Pet sidekicks (ids in schema.js PETS). Free to pick in the closet; models in pet.js.
export const PET_INFO = {
  none: { label: 'No pet', icon: '🚫' },
  puppy: { label: 'Puppy', icon: '🐶' },
  kitten: { label: 'Kitten', icon: '🐱' },
  dino: { label: 'Dino', icon: '🦖' },
  dragon: { label: 'Dragon', icon: '🐉' },
};

// Sticker passport badges. `kind` says what is counted (see passport.js):
// 'stickers' = different restaurants reviewed, 'menu' = every food tried at one restaurant.
export const BADGES = [
  { id: 'taster', name: 'Taste Tester', emoji: '🍴', goal: 'Collect 3 stickers', kind: 'stickers', need: 3, hat: 'chef' },
  { id: 'menu', name: 'Menu Master', emoji: '📋', goal: 'Try every food at one restaurant', kind: 'menu', hat: 'shades' },
  { id: 'tour', name: 'Town Tour', emoji: '🚩', goal: 'Collect 10 stickers', kind: 'stickers', need: 10, hat: 'crown' },
];

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
  hat: 'none', pet: 'none',
};

// ---------------------------------------------------------------- Phase 3: missions, hunt, camera, dance
// Which foods count as what for reviewer missions and comic words (ids from the menus above).
export const FOOD_TAGS = {
  crunchy: ['chips', 'taco', 'nachos', 'nuggets', 'wafflefries', 'fries', 'apples', 'cucumberroll', 'samosa', 'falafel',
    'popcornshrimp', 'fishchips', 'corndog', 'twists', 'guac', 'garlicbread', 'eggwaffle', 'gyoza'],
  sweet: ['cookie', 'icecream', 'mochi', 'sprinkledonut', 'donutholes', 'cinnamonroll', 'cocoa', 'sundae', 'bananasplit',
    'strawberrycone', 'shavedice', 'pancakes', 'waffles', 'twists', 'shake', 'lassi', 'cornbread', 'smoothie', 'mysundae'],
  drink: ['bobatea', 'smoothie', 'cocoa', 'oj', 'lassi', 'shake', 'juice'],
  cheesy: ['burger', 'cheesepizza', 'pepperonipizza', 'quesadilla', 'nachos', 'mac', 'bbqmac', 'ravioli', 'hamsub', 'mypizza'],
  noodles: ['ramen', 'noodles', 'spaghetti'],
  build: ['mypizza', 'mysundae'], // made in a build-your-own kitchen (BUILDS below)
};

// Reviewer missions: picture cards in the scrapbook, three at a time (rules in missions.js).
// `kind` says what a review must be to count: 'tag' (FOOD_TAGS), 'react' (a bite reaction),
// 'mystery' (a Mystery Plate), 'new' (a food never reviewed before), 'stars' (5 stars) or 'any'.
// `need` is how many; `each` makes them count once per restaurant ('rid') or per food ('fid').
export const MISSIONS = [
  { id: 'crunchy', pics: '🔍🥨', title: 'Find something crunchy', kind: 'tag', tag: 'crunchy', need: 1 },
  { id: 'three', pics: '🏠🏠🏠', title: 'Review at 3 different restaurants', kind: 'any', each: 'rid', need: 3 },
  { id: 'cold', pics: '🥶', title: 'Get a brain freeze', kind: 'react', react: 'cold', need: 1 },
  { id: 'sweet', pics: '🍩🍦🍪', title: 'Review 3 sweet treats', kind: 'tag', tag: 'sweet', each: 'fid', need: 3 },
  { id: 'mystery', pics: '🎲', title: 'Taste a Mystery Plate', kind: 'mystery', need: 1 },
  { id: 'new', pics: '❓🍴', title: 'Review 2 foods you never tried', kind: 'new', need: 2 },
  { id: 'spicy', pics: '🌶️🔥', title: 'Try something spicy', kind: 'react', react: 'spicy', need: 1 },
  { id: 'drink', pics: '🥤🥤', title: 'Sip 2 different drinks', kind: 'tag', tag: 'drink', each: 'fid', need: 2 },
  { id: 'stars', pics: '⭐⭐⭐⭐⭐', title: 'Give a 5 star review', kind: 'stars', need: 1 },
  { id: 'cheesy', pics: '🧀🧀', title: 'Find 2 cheesy foods', kind: 'tag', tag: 'cheesy', each: 'fid', need: 2 },
  { id: 'noodles', pics: '🍜', title: 'Slurp some noodles', kind: 'tag', tag: 'noodles', need: 1 },
  { id: 'sour', pics: '🍋😖', title: 'Pucker up for something sour', kind: 'react', react: 'sour', need: 1 },
  { id: 'chef', pics: '🍕🍨', title: 'Build your own pizza or sundae', kind: 'tag', tag: 'build', need: 1 },
];
export const MISSION_SLOTS = 3;

// Finished missions add up to a reviewer rank (shown on the missions page).
export const RANKS = [
  { at: 0, name: 'Rookie Reviewer', emoji: '🌱' },
  { at: 2, name: 'Snack Scout', emoji: '🔍' },
  { at: 5, name: 'Taste Buddy', emoji: '😋' },
  { at: 9, name: 'Food Critic', emoji: '🎩' },
  { at: 14, name: 'Star Reviewer', emoji: '🌟' },
  { at: 20, name: 'Yummy Town Legend', emoji: '🏆' },
];

// Hidden ingredient hunt: giant ingredients to find around town (models in ingredients.js).
// Each hunt hides six of them; finding all six cooks a silly recipe sticker named from the words below.
export const INGREDIENTS = [
  { id: 'tomato', name: 'Tomato', emoji: '🍅' },
  { id: 'cheese', name: 'Cheese', emoji: '🧀' },
  { id: 'carrot', name: 'Carrot', emoji: '🥕' },
  { id: 'mushroom', name: 'Mushroom', emoji: '🍄' },
  { id: 'egg', name: 'Egg', emoji: '🥚' },
  { id: 'banana', name: 'Banana', emoji: '🍌' },
  { id: 'strawberry', name: 'Strawberry', emoji: '🍓' },
  { id: 'broccoli', name: 'Broccoli', emoji: '🥦' },
];
export const RECIPE_WORDS = ['Wobbly', 'Giant', 'Jiggly', 'Upside-Down', 'Sparkly', 'Triple', 'Mega', 'Squishy', 'Bouncy', 'Rainbow'];
export const RECIPE_DISHES = [
  { name: 'Stew', emoji: '🍲' }, { name: 'Pie', emoji: '🥧' }, { name: 'Pizza', emoji: '🍕' }, { name: 'Sundae', emoji: '🍨' },
  { name: 'Tacos', emoji: '🌮' }, { name: 'Pancakes', emoji: '🥞' }, { name: 'Smoothie', emoji: '🍹' }, { name: 'Sandwich', emoji: '🥪' },
];
// Picture hints for where an ingredient hides.
export const HUNT_PLACES = {
  grass: { icon: '🌼', label: 'Out in the grass' },
  gap: { icon: '🏠🏠', label: 'Between two restaurants' },
  back: { icon: '🏠👀', label: 'Behind a restaurant' },
};

// Comic camera: preset frames and episode titles for the review viewfinder (saved with each review),
// and the comic words that pop up while filming. Local to the device, never sent to friends.
export const VF_FRAMES = [
  { id: 'classic', label: 'Classic', icon: '📷' },
  { id: 'rainbow', label: 'Rainbow', icon: '🌈' },
  { id: 'stars', label: 'Stars', icon: '⭐' },
  { id: 'hearts', label: 'Hearts', icon: '💖' },
  { id: 'comic', label: 'Comic', icon: '💥' },
  { id: 'movie', label: 'Movie', icon: '🎞️' },
];
export const VF_TITLES = ['Table for Two', 'Snack Attack!', 'Yum or Yuck?', 'The Big Bite', 'Taste Test Time', 'Five Star Feast', 'Munch Madness'];
// Keyed by FOOD_TAGS tag (a bite of that kind of food), bite reaction or review emote.
export const COMIC_WORDS = {
  bite: ['CHOMP!', 'MUNCH!', 'NOM NOM!'],
  crunchy: ['CRUNCH!'], drink: ['SLURP!'], noodles: ['SLURP!'],
  spicy: ['HOT HOT!'], sour: ['ZING!'], cold: ['BRRR!'], yuck: ['EWW!'],
  yum: ['YUM!'], wow: ['WOW!'], thumbs: ['NICE!'], silly: ['BOING!'], kiss: ['MWAH!'], heart: ['LOVE IT!'],
};

// Plaza dance party: the moves are ordinary emotes, so friends see them (rules in dance.js).
export const DANCE_MOVES = ['dance', 'jump', 'heart'];

// ---------------------------------------------------------------- Phase 4: build your own, friend as co-host
// A restaurant with `build: kind` has a kitchen: pick one base and up to `max` toppings from these
// preset chips and the 3D food shows them (models in food.js, names in build.js, checks in schema.js).
// `fid` is the food id a creation is saved under; `word` is what a choice adds to the food's name
// ("My Pepperoni & Olive Pizza"); `react` gives a bite reaction. Emoji stay old, like the menus.
export const BUILDS = {
  pizza: {
    fid: 'mypizza', emoji: '🍕', dish: 'Pizza', title: 'Build Your Own Pizza', blurb: 'You pick the toppings!', max: 4,
    baseLabel: 'Sauce',
    bases: [
      { id: 'tomato', label: 'Tomato', word: '', emoji: '🍅' },
      { id: 'pesto', label: 'Pesto', word: 'Pesto', emoji: '🌿' },
      { id: 'white', label: 'Creamy', word: 'Creamy', emoji: '🥛' },
    ],
    toppings: [
      { id: 'pepperoni', label: 'Pepperoni', word: 'Pepperoni', emoji: '🔴' },
      { id: 'mushroom', label: 'Mushrooms', word: 'Mushroom', emoji: '🍄' },
      { id: 'olive', label: 'Olives', word: 'Olive', emoji: '⚫' },
      { id: 'pineapple', label: 'Pineapple', word: 'Pineapple', emoji: '🍍' },
      { id: 'corn', label: 'Corn', word: 'Corn', emoji: '🌽' },
      { id: 'chili', label: 'Hot Peppers', word: 'Chili', emoji: '🌶️', react: 'spicy' },
      { id: 'basil', label: 'Basil', word: 'Basil', emoji: '🍃' },
      { id: 'cheese', label: 'Extra Cheese', word: 'Cheesy', emoji: '🧀' },
    ],
  },
  sundae: {
    fid: 'mysundae', emoji: '🍨', dish: 'Sundae', title: 'Build Your Own Sundae', blurb: 'Scoops and toppings!', max: 4, react: 'cold',
    baseLabel: 'Ice cream',
    bases: [
      { id: 'vanilla', label: 'Vanilla', word: 'Vanilla', emoji: '🍦' },
      { id: 'chocolate', label: 'Chocolate', word: 'Chocolate', emoji: '🍫' },
      { id: 'strawberry', label: 'Strawberry', word: 'Strawberry', emoji: '🍓' },
      { id: 'mint', label: 'Mint Chip', word: 'Mint', emoji: '🌱' },
    ],
    toppings: [
      { id: 'fudge', label: 'Hot Fudge', word: 'Fudge', emoji: '🍫' },
      { id: 'caramel', label: 'Caramel', word: 'Caramel', emoji: '🍯' },
      { id: 'sprinkles', label: 'Sprinkles', word: 'Sprinkle', emoji: '🌈' },
      { id: 'cream', label: 'Whipped Cream', word: 'Cream', emoji: '☁️' },
      { id: 'cherry', label: 'Cherry', word: 'Cherry', emoji: '🍒' },
      { id: 'banana', label: 'Banana', word: 'Banana', emoji: '🍌' },
      { id: 'cookie', label: 'Cookies', word: 'Cookie', emoji: '🍪' },
      { id: 'gummy', label: 'Gummy Bears', word: 'Gummy', emoji: '🐻' },
      { id: 'berry', label: 'Berries', word: 'Berry', emoji: '🍓' },
    ],
  },
};
// What three or four toppings are called (one or two are named: "My Olive & Corn Pizza").
export const BUILD_LOADED = { 3: 'Triple Topping', 4: 'Mega Topping' };

// Friend as co-host: what a friend can do while the host is still choosing the food (emotes only).
export const WAIT_EMOTES = ['wave', 'yum', 'wow', 'thumbs', 'heart'];
