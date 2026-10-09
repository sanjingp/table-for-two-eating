// DOM builders for the menu screens. All text shown comes from preset lists — never from other players.
import { h, $, pick } from './util.js';
import { HAIR_STYLES, NAME_ADJ, NAME_NOUN, SKIN_STOPS, LINES, RESTAURANT_IDS } from './schema.js';
import { HAIR_STYLE_INFO, HAIR_COLORS, EYE_COLORS, CLOTH_COLORS, CLOTHES, EMOTE_INFO, MOODS, RESTAURANT_BY_ID } from './data.js';
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
 * ctx = { getApp(), update(patch) }
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
  return Object.entries(CLOTHES).map(([slot, def]) => ({
    id: slot, icon: def.icon, label: def.title, build: () => buildClothes(slot, def, ctx),
  }));
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

// ------------------------------------------------------------------ plaza emote panel
export function buildEmotePanel(emotes, lines, onEmote, onSay) {
  const grid = $('#emote-grid');
  const list = $('#say-list');
  grid.replaceChildren(...emotes.map((e) => h('button.emote-btn', { onclick: () => onEmote(e), 'aria-label': EMOTE_INFO[e].label },
    EMOTE_INFO[e].emoji, h('small', {}, EMOTE_INFO[e].label))));
  list.replaceChildren(...lines.map((i) => h('button.say-btn', { onclick: () => onSay(i) }, `💬 ${LINES[i]}`)));
}

// ------------------------------------------------------------------ order
export function buildOrder(r, onPick) {
  $('#order-rest').textContent = r.name;
  $('#order-menu').replaceChildren(...r.menu.map((item) => h('button.menu-item', { onclick: () => onPick(item) },
    h('span.mi-emoji', {}, item.emoji),
    h('span.mi-name', {}, item.name),
    h('span.mi-blurb', {}, item.blurb))));
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
  let mood = '😋';
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
  moodBtns[2].classList.add('on');
  $('#rate-moods').replaceChildren(...moodBtns);
  save.onclick = () => {
    if (!stars) return;
    save.disabled = true;
    onDone(stars, mood);
  };
}

// ------------------------------------------------------------------ scrapbook
export function buildBook(stats) {
  const total = Object.values(stats).reduce((a, s) => a + s.count, 0);
  const visited = Object.values(stats).filter((s) => s.count).length;
  $('#book-summary').textContent = total
    ? `You've filmed ${total} review${total === 1 ? '' : 's'} at ${visited} of 7 restaurants! ${visited === 7 ? '🏆 Super Reviewer!' : '🎬'}`
    : 'No reviews yet — go film your first one! 🎬';
  const tilts = ['-1.2deg', '0.8deg', '-0.5deg', '1.1deg', '-0.9deg', '0.4deg', '-0.3deg'];
  $('#book-grid').replaceChildren(...RESTAURANT_IDS.map((id, i) => {
    const r = RESTAURANT_BY_ID[id];
    const s = stats[id];
    const starStr = (n) => '★'.repeat(n) + '☆'.repeat(5 - n);
    const header = h('header', { style: { background: r.wall === '#fdfdfd' ? '#d62828' : r.wall } },
      h('span', {}, r.name), h('span.avg', {}, s.count ? starStr(Math.round(s.avg)) : ''));
    const body = s.count
      ? h('ul', {}, s.list.slice(-6).reverse().map((rv) => h('li', {},
        h('span.fe', {}, rv.emoji), h('span.fn', {}, rv.food), h('span.st', {}, starStr(rv.stars)), h('span', {}, rv.mood))))
      : h('div.empty', {}, 'Not visited yet! 🚪');
    const page = h('div.book-page', {}, header, body);
    page.style.setProperty('--tilt', tilts[i]); // custom properties need setProperty
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
