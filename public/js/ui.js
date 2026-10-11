// DOM builders for the menu screens. All text shown comes from preset lists — never from other players.
import { h, $, pick } from './util.js';
import { HAIR_STYLES, HATS, PETS, NAME_ADJ, NAME_NOUN, SKIN_STOPS, LINES, RACE_LINE, RESTAURANT_IDS } from './schema.js';
import {
  HAIR_STYLE_INFO, HAIR_COLORS, EYE_COLORS, CLOTH_COLORS, CLOTHES, EMOTE_INFO, MOODS, RESTAURANT_BY_ID, FOOD_REACTIONS, HAT_INFO, BADGES,
  PET_INFO, INGREDIENTS, HUNT_PLACES, VF_FRAMES, VF_TITLES, BUILDS,
} from './data.js';
import { buildParts } from './build.js';
import { sfx } from './audio.js';

let toastTimer = 0;
export function toast(text, ms = 2600) {
  const el = $('#toast');
  el.textContent = text;
  el.classList.remove('hidden');
  el.style.animation = 'none';
  void el.offsetWidth;
  el.style.animation = '';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), ms);
}

export function show(el, on = true) {
  (typeof el === 'string' ? $(el) : el).classList.toggle('hidden', !on);
}

// ------------------------------------------------------------------ color controls
function colorRow(colors, current, onPick, { labels = false } = {}) {
  const wrap = h('div.swatches');
  const buttons = [];
  const mark = (val) => {
    let matched = false;
    for (const b of buttons) {
      const on = b.dataset.color === val;
      b.classList.toggle('on', on);
      matched ||= on;
    }
    picker.classList.toggle('on', !matched);
  };
  for (const [name, hex] of colors) {
    const b = h('button.swatch', {
      style: { background: hex }, 'aria-label': name, dataset: { color: hex },
      onclick: () => {
        sfx.tap();
        onPick(hex);
        input.value = hex;
        mark(hex);
      },
    });
    buttons.push(b);
    wrap.append(labels ? h('div.swatch-wrap', {}, b, h('div.swatch-label', {}, name)) : b);
  }
  const input = h('input', { type: 'color', value: current, 'aria-label': 'Pick any color' });
  input.addEventListener('input', () => {
    onPick(input.value.toLowerCase());
    mark(input.value.toLowerCase());
  });
  const picker = h('label.picker', { title: 'Any color!' }, input);
  wrap.append(labels ? h('div.swatch-wrap', {}, picker, h('div.swatch-label', {}, 'Any!')) : picker);
  mark(current);
  return wrap;
}

function optionGrid(options, current, onPick) {
  const grid = h('div.opt-grid');
  const btns = [];
  for (const [value, label, icon] of options) {
    const b = h('button.opt', {
      dataset: { value },
      onclick: () => {
        sfx.pop();
        onPick(value);
        btns.forEach((x) => x.classList.toggle('on', x === b));
      },
    }, h('span.oi', {}, icon), label);
    if (value === current) b.classList.add('on');
    btns.push(b);
    grid.append(b);
  }
  return grid;
}

// ------------------------------------------------------------------ studio (creator + closet)
/**
 * ctx = { getApp(), update(patch), hats() } — hats() lists the hat ids unlocked so far.
 * Returns tab definitions for the given studio kind.
 */
export function studioTabs(kind, ctx) {
  if (kind === 'me') {
    return [
      { id: 'name', icon: '😀', label: 'Name', build: () => buildName(ctx) },
      { id: 'face', icon: '🎨', label: 'Skin & Eyes', build: () => buildFace(ctx) },
      { id: 'hair', icon: '💇', label: 'Hair', build: () => buildHair(ctx) },
    ];
  }
  return [
    ...Object.entries(CLOTHES).map(([slot, def]) => ({
      id: slot, icon: def.icon, label: def.title, build: () => buildClothes(slot, def, ctx),
    })),
    { id: 'hat', icon: '👑', label: 'Hats', build: () => buildHats(ctx) },
    { id: 'pet', icon: '🐶', label: 'Pets', build: () => buildPets(ctx) },
  ];
}

function buildName(ctx) {
  const app = ctx.getApp();
  let [adj, noun] = app.name.split(' ');
  const nameEl = h('span', {}, app.name);
  const setName = () => {
    nameEl.textContent = `${adj} ${noun}`;
    ctx.update({ name: `${adj} ${noun}` });
    refresh();
  };
  const adjChips = NAME_ADJ.map((w) => h('button.chip-btn', { onclick: () => { sfx.tap(); adj = w; setName(); } }, w));
  const nounChips = NAME_NOUN.map((w) => h('button.chip-btn', { onclick: () => { sfx.tap(); noun = w; setName(); } }, w));
  const refresh = () => {
    adjChips.forEach((c) => c.classList.toggle('on', c.textContent === adj));
    nounChips.forEach((c) => c.classList.toggle('on', c.textContent === noun));
  };
  refresh();
  return h('div', {},
    h('div.section-title', {}, '✨ Your fun name'),
    h('div.name-show', {}, nameEl, h('button.btn.yellow', {
      'aria-label': 'Random name',
      onclick: () => {
        sfx.boing();
        adj = pick(NAME_ADJ);
        noun = pick(NAME_NOUN);
        setName();
      },
    }, '🎲')),
    h('div.section-title', {}, 'Pick a first word'),
    h('div.chips', {}, adjChips),
    h('div.section-title', {}, 'Pick a second word'),
    h('div.chips', {}, nounChips),
  );
}

function buildFace(ctx) {
  const app = ctx.getApp();
  const slider = h('input.skin-slider', { type: 'range', min: '0', max: '1000', step: '1', value: String(Math.round(app.skin * 1000)), 'aria-label': 'Skin tone' });
  slider.style.background = `linear-gradient(90deg, ${SKIN_STOPS.join(', ')})`;
  slider.addEventListener('input', () => ctx.update({ skin: Number(slider.value) / 1000 }));
  return h('div', {},
    h('div.section-title', {}, '🖐️ Skin tone'),
    slider,
    h('div.section-title', {}, '👀 Eye color'),
    colorRow(EYE_COLORS, app.eyes, (c) => ctx.update({ eyes: c }), { labels: true }),
  );
}

function buildHair(ctx) {
  const app = ctx.getApp();
  return h('div', {},
    h('div.section-title', {}, '💇 Hair style'),
    optionGrid(HAIR_STYLES.map((s) => [s, HAIR_STYLE_INFO[s].label, HAIR_STYLE_INFO[s].icon]), app.hairStyle, (v) => ctx.update({ hairStyle: v })),
    h('div.section-title', {}, '🎨 Hair color'),
    colorRow(HAIR_COLORS, app.hair, (c) => ctx.update({ hair: c }), { labels: true }),
  );
}

function buildClothes(slot, def, ctx) {
  const app = ctx.getApp();
  const colorSection = h('div', {},
    h('div.section-title', {}, '🎨 Color'),
    colorRow(CLOTH_COLORS, app[def.colorKey], (c) => ctx.update({ [def.colorKey]: c })));
  const syncColor = (v) => colorSection.classList.toggle('hidden', slot === 'jacket' && v === 'none');
  syncColor(app[slot]);
  return h('div', {},
    h('div.section-title', {}, `${def.icon} ${def.title}`),
    optionGrid(Object.entries(def.options).map(([v, [label, icon]]) => [v, label, icon]), app[slot], (v) => {
      ctx.update({ [slot]: v });
      syncColor(v);
    }),
    colorSection,
  );
}

/** Hats are passport prizes: locked ones show how to earn them instead of being worn. */
function buildHats(ctx) {
  const unlocked = ctx.hats();
  const btns = [];
  const grid = h('div.opt-grid', {}, HATS.map((hat) => {
    const info = HAT_INFO[hat];
    const open = unlocked.includes(hat);
    const badge = BADGES.find((b) => b.hat === hat);
    const b = h(`button.opt${open ? '' : '.locked'}`, {
      dataset: { value: hat },
      'aria-label': open ? info.label : `${info.label} (locked)`,
      onclick: () => {
        if (!open) {
          sfx.tap();
          toast(`🔒 ${badge.goal} to get the ${info.label}!`, 3400);
          return;
        }
        sfx.pop();
        ctx.update({ hat });
        btns.forEach((x) => x.classList.toggle('on', x === b));
      },
    }, h('span.oi', {}, open ? info.icon : '🔒'), info.label, !open && h('small', {}, badge.goal));
    if (hat === ctx.getApp().hat) b.classList.add('on');
    btns.push(b);
    return b;
  }));
  return h('div', {},
    h('div.section-title', {}, '👑 Hats'),
    grid,
    h('p.hint', {}, 'Win badges in your Sticker Passport (📖 My Reviews) to unlock more hats!'));
}

/** A sidekick that follows you around town. Friends see it too (it is part of the appearance). */
function buildPets(ctx) {
  return h('div', {},
    h('div.section-title', {}, '🐾 Pet sidekick'),
    optionGrid(PETS.map((p) => [p, PET_INFO[p].label, PET_INFO[p].icon]), ctx.getApp().pet, (pet) => ctx.update({ pet })),
    h('p.hint', {}, 'Your pet follows you around town and sits with you while you film!'));
}

// ------------------------------------------------------------------ plaza emote panel
export function buildEmotePanel(emotes, lines, onEmote, onSay) {
  const grid = $('#emote-grid');
  const list = $('#say-list');
  grid.replaceChildren(...emotes.map((e) => h('button.emote-btn', { onclick: () => onEmote(e), 'aria-label': EMOTE_INFO[e].label },
    EMOTE_INFO[e].emoji, h('small', {}, EMOTE_INFO[e].label))));
  // "Wanna race?" is more than a line: it starts a race to a restaurant
  list.replaceChildren(...lines.map((i) => h('button.say-btn', { dataset: { line: String(i) }, onclick: () => onSay(i) },
    `${i === RACE_LINE ? '🏁' : '💬'} ${LINES[i]}`)));
}

// ------------------------------------------------------------------ order
/**
 * isGoal(item) marks the foods that would move one of the reviewer's missions along.
 * A restaurant with a kitchen (r.build) gets one more, golden tile: onBuild opens the build-your-own screen.
 */
export function buildOrder(r, onPick, isGoal = () => false, onBuild = null) {
  $('#order-rest').textContent = r.name;
  const tile = (item, cls, onclick) => h(`button.menu-item${cls}`, { dataset: { id: item.id }, onclick },
    isGoal(item) && h('span.mi-goal', { 'aria-label': 'Counts for a mission' }, '🎯'),
    item.react && h('span.mi-tag', { 'aria-label': FOOD_REACTIONS[item.react].label }, FOOD_REACTIONS[item.react].tag),
    h('span.mi-emoji', {}, item.emoji),
    h('span.mi-name', {}, item.name),
    h('span.mi-blurb', {}, item.blurb));
  const kitchen = r.build && onBuild ? BUILDS[r.build] : null;
  const tiles = r.menu.map((item) => tile(item, '', () => onPick(item)));
  if (kitchen) tiles.push(tile({ id: kitchen.fid, name: kitchen.title, emoji: kitchen.emoji, blurb: kitchen.blurb, react: kitchen.react }, '.build', onBuild));
  $('#order-menu').replaceChildren(...tiles);
}

// ------------------------------------------------------------------ build your own
const chip = (c, onTap) => {
  const b = h('button.top-chip', { dataset: { id: c.id }, 'aria-label': c.label, 'aria-pressed': 'false' }, h('span.tc-emoji', {}, c.emoji), c.label);
  b.addEventListener('click', () => onTap(c.id, b));
  return b;
};
/** The kitchen's chips for build kind `kind`: one base to pick, toppings to switch on and off. */
export function buildKitchen(kind, { onBase, onTopping }) {
  const def = BUILDS[kind];
  $('#build-title').textContent = `${def.emoji} ${def.title}!`;
  $('#build-base-label').textContent = def.baseLabel;
  $('#build-bases').replaceChildren(...def.bases.map((b) => chip(b, onBase)));
  $('#build-toppings').replaceChildren(...def.toppings.map((t) => chip(t, onTopping)));
}
/** Light up the chips that are part of `build`, and count the toppings. */
export function syncKitchen(build) {
  const { def } = buildParts(build);
  for (const b of $('#build-bases').children) {
    b.classList.toggle('on', b.dataset.id === build.b);
    b.setAttribute('aria-pressed', String(b.dataset.id === build.b));
  }
  for (const b of $('#build-toppings').children) {
    b.classList.toggle('on', build.t.includes(b.dataset.id));
    b.setAttribute('aria-pressed', String(build.t.includes(b.dataset.id)));
  }
  const label = $('#build-count');
  label.textContent = `Toppings ${build.t.length} of ${def.max}`;
  label.classList.toggle('full', build.t.length >= def.max);
}
/** A little shake for a chip that cannot be switched on (the plate is full). */
export function nope(el) {
  el.classList.remove('nope');
  void el.offsetWidth;
  el.classList.add('nope');
}

// ------------------------------------------------------------------ friend as co-host
/** friends = [{ id, name, color }]: everyone else in town, by their preset fun name. */
export function buildFriendPicker(friends, onPick) {
  $('#cohost-sub').textContent = friends.length ? 'Who should sit at your table?' : 'Nobody else is in town right now.';
  $('#cohost-friends').replaceChildren(...friends.map((f) => h('button.btn.white.friend-btn', { dataset: { id: f.id }, onclick: () => onPick(f.id) },
    h('span.fb-dot', { style: { background: f.color } }), f.name)));
  show('#cohost-friends', true);
  show('#cohost-waiting', false);
  $('#cohost-close').textContent = 'Close';
}
/** The picker after a friend was asked: nothing to tap but "never mind". */
export function friendPickerWaiting(name) {
  $('#cohost-sub').textContent = 'They can say yes or no.';
  $('#cohost-waiting-text').textContent = `Asking ${name}…`;
  show('#cohost-friends', false);
  show('#cohost-waiting', true);
  $('#cohost-close').textContent = 'Never mind';
}
export function buildWaitEmotes(emotes, onEmote) {
  $('#wait-emotes').replaceChildren(...emotes.map((e) => h('button.wait-emote', { onclick: () => onEmote(e), 'aria-label': EMOTE_INFO[e].label },
    EMOTE_INFO[e].emoji, h('small', {}, EMOTE_INFO[e].label))));
}

// ------------------------------------------------------------------ review controls
export function buildReviewControls(emotes, lines, { onEmote, onBite, onSay }) {
  $('#review-emotes').replaceChildren(
    h('button.rv-emote.bite', { onclick: onBite, 'aria-label': 'Take a bite' }, '🍴', h('small', {}, 'Take a bite')),
    ...emotes.map((e) => h('button.rv-emote', { onclick: () => onEmote(e), 'aria-label': EMOTE_INFO[e].label }, EMOTE_INFO[e].emoji, h('small', {}, EMOTE_INFO[e].label))),
  );
  $('#review-lines').replaceChildren(...lines.map((i) => h('button.rv-line', { onclick: () => onSay(i) }, `💬 ${LINES[i]}`)));
}

// ------------------------------------------------------------------ rating
export function buildRate(item, onDone) {
  let stars = 0;
  let mood = item.react === 'yuck' ? '🤢' : '😋'; // a yucky Mystery Plate starts on the queasy face
  $('#rate-food').replaceChildren(item.emoji, h('small', {}, item.name));
  const save = $('#rate-save');
  save.disabled = true;
  const starBtns = [1, 2, 3, 4, 5].map((n) => h('button.star-btn', {
    'aria-label': `${n} star${n > 1 ? 's' : ''}`,
    onclick: () => {
      stars = n;
      starBtns.forEach((b, i) => b.classList.toggle('on', i < n));
      for (let i = 0; i < n; i++) setTimeout(() => sfx.star(i), i * 70);
      save.disabled = false;
    },
  }, '★'));
  $('#rate-stars').replaceChildren(...starBtns);
  const moodBtns = MOODS.map((m) => h('button.mood-btn', {
    'aria-label': m,
    onclick: () => {
      mood = m;
      sfx.pop();
      moodBtns.forEach((b) => b.classList.toggle('on', b.textContent === m));
    },
  }, m));
  moodBtns[MOODS.indexOf(mood)].classList.add('on');
  $('#rate-moods').replaceChildren(...moodBtns);
  save.onclick = () => {
    if (!stars) return;
    save.disabled = true;
    onDone(stars, mood);
  };
}

// ------------------------------------------------------------------ comic camera
/** Put the reviewer's chosen frame and show title on the viewfinder. */
export function setViewfinder(frameId, title) {
  const frame = VF_FRAMES.find((f) => f.id === frameId) || VF_FRAMES[0];
  $('#viewfinder').dataset.frame = frame.id;
  $('#frame-name').textContent = `${frame.label} ${frame.icon}`;
  $('#vf-show').textContent = VF_TITLES[title] || VF_TITLES[0];
}

let comicTimer = 0;
let comicN = 0;
const COMIC_SPOTS = [['64%', '15%', '-8deg'], ['8%', '20%', '7deg'], ['58%', '30%', '5deg'], ['14%', '12%', '-6deg']];
/** Burst a comic word onto the viewfinder: CRUNCH! */
export function comicPop(word) {
  const el = $('#comic-pop');
  const [x, y, tilt] = COMIC_SPOTS[comicN++ % COMIC_SPOTS.length];
  el.textContent = word;
  el.style.setProperty('--x', x);
  el.style.setProperty('--y', y);
  el.style.setProperty('--tilt', tilt);
  el.classList.remove('hidden');
  el.style.animation = 'none';
  void el.offsetWidth;
  el.style.animation = '';
  clearTimeout(comicTimer);
  comicTimer = setTimeout(() => el.classList.add('hidden'), 950);
}

// ------------------------------------------------------------------ dance party
export function buildDanceButtons(moves, onTap) {
  $('#dance-buttons').replaceChildren(...moves.map((m) => {
    const b = h('button.btn.dance-btn', { dataset: { move: m }, 'aria-label': EMOTE_INFO[m].label }, EMOTE_INFO[m].emoji, h('small', {}, EMOTE_INFO[m].label));
    // pointerdown, not click: the tap has to land on the beat
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      onTap(m);
    });
    return b;
  }));
}

// ------------------------------------------------------------------ prize card
/** card = { sub, emoji, name, prize, primary, secondary }: secondary is optional (a second, quieter button). */
export function buildReward(card) {
  $('#reward-sub').textContent = card.sub;
  $('#reward-emoji').textContent = card.emoji;
  $('#reward-name').textContent = card.name;
  $('#reward-prize').textContent = card.prize;
  $('#reward-wear').textContent = card.primary;
  $('#reward-later').textContent = card.secondary || '';
  show('#reward-later', !!card.secondary);
}
export const badgeCard = (badge) => ({
  sub: '🎉 You earned a badge!', emoji: badge.emoji, name: badge.name,
  prize: `You unlocked the ${HAT_INFO[badge.hat].label}! ${HAT_INFO[badge.hat].icon}`, primary: 'Wear it!', secondary: 'Keep playing',
});

// ------------------------------------------------------------------ scrapbook + sticker passport
const BOOK_TABS = { passport: '#book-passport', reviews: '#book-grid', missions: '#book-missions', hunt: '#book-hunt' };
export function showBookTab(which) {
  for (const [id, sel] of Object.entries(BOOK_TABS)) {
    show(sel, id === which);
    $(`#book-tab-${id}`).classList.toggle('on', id === which);
  }
}

/** cards = missionCards(state), rank = missionRank(done): three picture challenges and the reviewer's rank. */
function buildMissions(cards, rank, done) {
  $('#book-missions').replaceChildren(
    h('div.rank-card', {},
      h('div.rk-emoji', {}, rank.emoji),
      h('div', {},
        h('div.rk-name', {}, rank.name),
        h('div.rk-next', {}, rank.next
          ? `${done} mission${done === 1 ? '' : 's'} done. ${rank.toGo} more to become a ${rank.next.name} ${rank.next.emoji}`
          : `${done} missions done. You are a legend! 🎉`))),
    h('div.section-title', {}, '🎯 My missions: film a review that fits!'),
    h('div.mission-grid', {}, cards.map((c) => h('div.mission-card', { dataset: { id: c.id } },
      h('div.ms-pics', {}, c.pics),
      h('div.ms-title', {}, c.title),
      h('div.ms-pips', { 'aria-label': `${c.have} of ${c.need}` }, Array.from({ length: c.need }, (_, i) => h(i < c.have ? 'i.on' : 'i'))),
      c.hints.length > 0 && h('div.ms-hints', {}, c.hints.join(' '), h('small', {}, 'Look for these on the menus'))))),
    h('p.hint', {}, 'Foods with a 🎯 on the menu count for a mission.'));
}

/** hunt = { items: [{ id, where, found }], recipes: [{ name, emoji, made }] } */
function buildHunt(hunt) {
  const found = hunt.items.filter((it) => it.found).length;
  const tilts = ['-2deg', '1.5deg', '-1deg', '2deg'];
  $('#book-hunt').replaceChildren(
    h('div.section-title', {}, `🔍 Giant ingredients: ${found} of ${hunt.items.length} found`),
    h('div.hunt-grid', {}, hunt.items.map((it) => {
      const info = INGREDIENTS.find((i) => i.id === it.id);
      const place = HUNT_PLACES[it.where];
      return h(`div.hunt-item${it.found ? '.got' : ''}`, { dataset: { id: it.id } },
        h('div.hi-emoji', {}, info.emoji),
        it.found ? `${info.name} ✅` : info.name,
        !it.found && h('div.hi-where', {}, place.icon),
        !it.found && h('small', {}, place.label));
    })),
    h('p.hint', {}, 'Walk into a giant ingredient to pick it up. Find all 6 to cook a silly recipe!'),
    h('div.section-title', {}, `🍳 My silly recipes: ${hunt.total}`),
    hunt.recipes.length
      ? h('div.recipe-grid', {}, hunt.recipes.map((r, i) => {
        const card = h('div.recipe', {}, h('div.rc-emoji', {}, r.emoji), r.name, h('small', {}, r.made));
        card.style.setProperty('--tilt', tilts[i % tilts.length]);
        return card;
      }))
      : h('p.hint', {}, 'No recipes yet. The first ingredient is waiting by the path to Sakura Sushi!'));
}

/** progress = passportProgress(reviews): the stickers and badges earned so far. */
function buildPassport(progress) {
  const got = new Set(progress.stickers);
  const tilts = ['-8deg', '5deg', '-3deg', '9deg', '-6deg', '4deg'];
  const stickers = RESTAURANT_IDS.map((id, i) => {
    const r = RESTAURANT_BY_ID[id];
    const b = h(`button.sticker${got.has(id) ? '.got' : ''}`, {
      dataset: { id },
      'aria-label': `${r.name} sticker${got.has(id) ? '' : ' (not earned yet)'}`,
      onclick: () => {
        sfx.tap();
        toast(got.has(id) ? `${r.sticker} You reviewed ${r.name}!` : `Film a review at ${r.name} to earn this sticker!`);
      },
    }, h('span.st-emoji', {}, r.sticker), h('span.st-name', {}, r.name));
    b.style.setProperty('--c', r.accent);
    b.style.setProperty('--tilt', tilts[i % tilts.length]);
    return b;
  });
  const badges = progress.badges.map((b) => {
    const hat = HAT_INFO[b.hat];
    return h(`div.badge-card${b.earned ? '.earned' : ''}`, { dataset: { id: b.id } },
      h('div.bd-emoji', {}, b.emoji),
      h('div.bd-name', {}, b.name),
      h('div.bd-goal', {}, b.goal),
      h('div.bd-bar', {}, h('i', { style: { width: `${Math.round((b.have / b.need) * 100)}%` } })),
      h('div.bd-count', {}, b.earned ? 'Done! 🎉' : `${b.have} of ${b.need}${b.where ? ` at ${b.where}` : ''}`),
      h('div.bd-prize', {}, `${b.earned ? '✅' : '🔒'} ${hat.label} ${hat.icon}`));
  });
  $('#book-passport').replaceChildren(
    h('div.section-title', {}, `🎫 My stickers: ${got.size} of ${RESTAURANT_IDS.length}`),
    h('div.sticker-grid', {}, stickers),
    h('div.section-title', {}, '🏅 Badges unlock hats'),
    h('div.badge-row', {}, badges),
  );
}

/** quests = { cards, rank, done, hunt }: the missions and ingredient hunt pages. */
/** The comic-camera frame and show title a review was filmed with (nothing for the plain classic look). */
function decoChip(rv) {
  const frame = VF_FRAMES.find((f) => f.id === rv.frame);
  const fancy = frame && frame.id !== VF_FRAMES[0].id;
  if (!fancy && !rv.title) return null;
  return h('span.deco', {}, `${fancy ? frame.icon : '🎬'}${rv.title ? ` ${VF_TITLES[rv.title]}` : ''}`);
}

/** What went on a build-your-own food, and the friend who co-hosted the review. */
function madeChip(rv) {
  if (!rv.build) return null;
  const { base, toppings } = buildParts(rv.build);
  return h('span.deco.made', {}, [base, ...toppings].map((c) => c.emoji).join(''));
}
const friendChip = (rv) => (rv.co ? h('span.deco.with', {}, `👯 ${rv.co}`) : null);
/** A second line under a review for its little chips: toppings, co-host, camera look. */
function extras(rv) {
  const chips = [madeChip(rv), friendChip(rv), decoChip(rv)].filter(Boolean);
  return chips.length ? h('div.extras', {}, chips) : null;
}

export function buildBook(stats, progress, quests, tab = 'passport') {
  buildPassport(progress);
  buildMissions(quests.cards, quests.rank, quests.done);
  buildHunt(quests.hunt);
  showBookTab(tab);
  const total = Object.values(stats).reduce((a, s) => a + s.count, 0);
  const visited = Object.values(stats).filter((s) => s.count).length;
  $('#book-summary').textContent = total
    ? `You've filmed ${total} review${total === 1 ? '' : 's'} at ${visited} of ${RESTAURANT_IDS.length} restaurants! ${visited === RESTAURANT_IDS.length ? '🏆 Super Reviewer!' : '🎬'}`
    : 'No reviews yet — go film your first one! 🎬';
  const tilts = ['-1.2deg', '0.8deg', '-0.5deg', '1.1deg', '-0.9deg', '0.4deg', '-0.3deg'];
  $('#book-grid').replaceChildren(...RESTAURANT_IDS.map((id, i) => {
    const r = RESTAURANT_BY_ID[id];
    const s = stats[id];
    const starStr = (n) => '★'.repeat(n) + '☆'.repeat(5 - n);
    const header = h('header', { style: { background: r.accent } },
      h('span', {}, r.name), h('span.avg', {}, s.count ? starStr(Math.round(s.avg)) : ''));
    const body = s.count
      ? h('ul', {}, s.list.slice(-6).reverse().map((rv) => h('li', {},
        h('span.fe', {}, rv.emoji), h('span.fn', {}, rv.food), h('span.st', {}, starStr(rv.stars)), h('span', {}, rv.mood), extras(rv))))
      : h('div.empty', {}, 'Not visited yet! 🚪');
    const page = h('div.book-page', {}, header, body);
    page.style.setProperty('--tilt', tilts[i % tilts.length]); // custom properties need setProperty
    return page;
  }));
}

// ------------------------------------------------------------------ clipboard
export async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through */
  }
  const ta = h('textarea', { readonly: true, style: { position: 'fixed', left: '-9999px', top: '0' } });
  ta.value = text;
  document.body.append(ta);
  ta.select();
  ta.setSelectionRange(0, text.length);
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  ta.remove();
  return ok;
}
