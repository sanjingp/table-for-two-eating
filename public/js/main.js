// Table for Two Eating — game bootstrap, modes and main loop.
import * as THREE from '../vendor/three.module.js';
import { LINES, isValidRoom, repairAppearance, ROOM_WORDS_A, ROOM_WORDS_B } from './schema.js';
import { RESTAURANT_BY_ID, REVIEW_EMOTES, REVIEW_LINES, PLAZA_EMOTES, PLAZA_LINES, COHOST } from './data.js';
import { $, clamp, damp, lerpAngle, pick, randInt, emojiTexture } from './util.js';
import { Character } from './character.js';
import { buildWorld, RING_RADIUS } from './world.js';
import { createFood } from './food.js';
import { Controls } from './controls.js';
import { Net } from './net.js';
import { sfx, unlockAudio, setMuted, speak } from './audio.js';
import { initConfetti, confetti } from './confetti.js';
import { loadAppearance, saveAppearance, loadReviews, addReview, loadSettings, saveSettings, reviewStats } from './storage.js';
import * as UI from './ui.js';

const WALK_SPEED = 6.5;
const SEND_INTERVAL = 0.1; // 10 Hz
const INTERP_DELAY = 140; // ms of buffering for smooth remote movement
const MAX_REMOTES = 7;

// ---------------------------------------------------------------- room code
function makeRoomCode() {
  return `${pick(ROOM_WORDS_A)}-${pick(ROOM_WORDS_B)}-${1000 + randInt(9000)}`;
}
function resolveRoom() {
  const params = new URLSearchParams(location.search);
  let room = (params.get('room') || '').toLowerCase().trim();
  if (!isValidRoom(room)) {
    let saved = '';
    try {
      saved = localStorage.getItem('t42.room') || '';
    } catch {
      /* ignore */
    }
    room = isValidRoom(saved) ? saved : makeRoomCode();
    params.set('room', room);
    history.replaceState(null, '', `${location.pathname}?${params}${location.hash}`);
  }
  try {
    localStorage.setItem('t42.room', room);
  } catch {
    /* ignore */
  }
  return room;
}

// ---------------------------------------------------------------- renderer / scene
const canvas = $('#game');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
} catch (err) {
  $('#loading .loading-card').innerHTML = '<div class="loading-logo">😢</div><h1>Oops!</h1><p class="sub">This browser can\'t show the 3D town.<br>Try Safari or Chrome.</p>';
  throw err;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(innerWidth, innerHeight);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 220);

const world = buildWorld(scene);
const controls = new Controls({ zone: $('#joystick-zone'), base: $('#joystick-base'), knob: $('#joystick-knob'), canvas });
initConfetti($('#confetti'));

// ---------------------------------------------------------------- state
const room = resolveRoom();
const loaded = loadAppearance();
const S = {
  mode: 'loading',
  app: loaded.app,
  settings: loadSettings(),
  reviews: loadReviews(),
  facing: Math.PI,
  camYaw: 0,
  camPitch: 0.38,
  camDist: 9,
  vel: new THREE.Vector3(),
  near: null,
  restaurant: null,
  item: null,
  plazaPos: new THREE.Vector3(),
  recStart: 0,
  bites: 0,
  food: null,
  cohostFood: null,
  foodPop: 1,
  sendT: 0,
  lastSent: '',
  lastSentAt: 0,
  studio: null,
  spin: 0,
  viewShift: { right: 0, bottom: 0 },
  timers: [],
};
setMuted(S.settings.muted);

const player = new Character(S.app, { label: S.app.name });
player.setLabel(S.app.name, '#ff4fa0');
player.root.position.set(0, 0, 9);
player.root.rotation.y = S.facing;
scene.add(player.root);

const cohost = new Character({ ...S.app, ...COHOST }, { scale: 1.25 });
cohost.root.visible = false;
scene.add(cohost.root);

function later(fn, ms) {
  const id = setTimeout(() => {
    S.timers = S.timers.filter((t) => t !== id);
    fn();
  }, ms);
  S.timers.push(id);
}
function clearLater() {
  S.timers.forEach(clearTimeout);
  S.timers = [];
}

// ---------------------------------------------------------------- stars above restaurants
function refreshStars() {
  const stats = reviewStats(S.reviews);
  for (const r of world.restaurants) r.setStars(stats[r.id].avg, stats[r.id].count);
}
refreshStars();

// ---------------------------------------------------------------- remote players
const remotes = new Map(); // id -> { char, buf, an, name }

function addRemote(p) {
  removeRemote(p.id);
  if (remotes.size >= MAX_REMOTES) return;
  const char = new Character(p.app, { label: p.app.name });
  const e = { char, buf: [], an: 'idle', name: p.app.name };
  if (p.st) {
    char.root.position.set(p.st.x, 0, p.st.z);
    char.root.rotation.y = p.st.ry;
    pushState(e, p.st);
  } else char.root.position.set(0, 0, 9);
  scene.add(char.root);
  remotes.set(p.id, e);
}
function removeRemote(id) {
  const e = remotes.get(id);
  if (!e) return;
  scene.remove(e.char.root);
  remotes.delete(id);
}
function pushState(e, st) {
  e.buf.push({ t: performance.now(), x: st.x, z: st.z, ry: st.ry });
  if (e.buf.length > 30) e.buf.shift();
  if (st.an !== e.an) {
    e.an = st.an;
    e.char.holdCamera(st.an === 'review');
    if (st.an === 'review') e.char.showBubble(emojiTexture('🎬'), 0.7, 3600);
    else e.char.clearBubble();
  }
}
const tmpV = new THREE.Vector3();
function updateRemotes(dt, nowMs) {
  const renderT = nowMs - INTERP_DELAY;
  for (const e of remotes.values()) {
    const b = e.buf;
    const root = e.char.root;
    if (b.length) {
      let tx = b[b.length - 1].x;
      let tz = b[b.length - 1].z;
      let ry = b[b.length - 1].ry;
      for (let i = b.length - 2; i >= 0; i--) {
        if (b[i].t <= renderT) {
          const a = b[i];
          const c = b[i + 1];
          const f = clamp((renderT - a.t) / Math.max(1, c.t - a.t), 0, 1);
          tx = a.x + (c.x - a.x) * f;
          tz = a.z + (c.z - a.z) * f;
          ry = lerpAngle(a.ry, c.ry, f);
          break;
        }
      }
      tmpV.set(tx, 0, tz);
      const before = root.position.clone();
      if (root.position.distanceTo(tmpV) > 12) root.position.copy(tmpV);
      else root.position.lerp(tmpV, damp(18, dt));
      root.rotation.y = lerpAngle(root.rotation.y, ry, damp(14, dt));
      const sp = before.distanceTo(root.position) / Math.max(dt, 1e-3) / WALK_SPEED;
      e.char.speed = e.an === 'walk' || sp > 0.15 ? clamp(sp, 0.3, 1) : 0;
    }
    e.char.update(dt);
  }
}

function updateNetChip() {
  const el = $('#net-status');
  const s = net.status;
  if (s === 'online') el.textContent = remotes.size ? `🟢 ${remotes.size + 1} in town` : '🟢 Online — invite a friend!';
  else if (s === 'connecting') el.textContent = '🟡 Connecting…';
  else if (s === 'full') el.textContent = '🔴 Town full — playing solo';
  else el.textContent = '🟡 Playing solo';
}

const net = new Net(room, {
  onStatus: updateNetChip,
  onReset: () => {
    for (const id of [...remotes.keys()]) removeRemote(id);
    updateNetChip();
  },
  onWelcome: (peers) => {
    for (const id of [...remotes.keys()]) removeRemote(id);
    peers.forEach(addRemote);
    updateNetChip();
    sendState(true);
  },
  onJoin: (p) => {
    addRemote(p);
    updateNetChip();
    sfx.join();
    UI.toast(`👋 ${p.app.name} came to town!`);
  },
  onLeave: (id) => {
    const e = remotes.get(id);
    removeRemote(id);
    updateNetChip();
    if (e) UI.toast(`👋 ${e.name} went home`);
  },
  onState: (id, st) => {
    const e = remotes.get(id);
    if (e) pushState(e, st);
  },
  onEmote: (id, em) => remotes.get(id)?.char.playEmote(em),
  onSay: (id, l) => remotes.get(id)?.char.say(LINES[l]),
  onAppearance: (id, app) => {
    const e = remotes.get(id);
    if (!e) return;
    e.char.setAppearance(app);
    if (app.name !== e.name) {
      e.name = app.name;
      e.char.setLabel(app.name);
    }
  },
});

function sendState(force = false) {
  const inside = S.restaurant !== null;
  const pos = inside ? S.plazaPos : player.root.position;
  const ry = inside ? S.facing : player.root.rotation.y;
  const an = inside ? 'review' : player.speed > 0.1 ? 'walk' : 'idle';
  const key = `${pos.x.toFixed(2)},${pos.z.toFixed(2)},${ry.toFixed(2)},${an}`;
  const now = performance.now();
  if (!force && key === S.lastSent && now - S.lastSentAt < 1000) return;
  S.lastSent = key;
  S.lastSentAt = now;
  net.sendState(pos.x, pos.z, Math.atan2(Math.sin(ry), Math.cos(ry)), an);
}

let appSendTimer = 0;
function updateAppearance(patch) {
  const prevName = S.app.name;
  S.app = repairAppearance({ ...S.app, ...patch });
  player.setAppearance(S.app);
  if (S.app.name !== prevName) player.setLabel(S.app.name, '#ff4fa0');
  saveAppearance(S.app);
  clearTimeout(appSendTimer);
  appSendTimer = setTimeout(() => net.sendAppearance(S.app), 400);
}

// ---------------------------------------------------------------- view helpers
function fade(fn) {
  return new Promise((resolve) => {
    const f = $('#fade');
    f.classList.add('on');
    setTimeout(() => {
      fn();
      requestAnimationFrame(() => {
        f.classList.remove('on');
        resolve();
      });
    }, 360);
  });
}

function setViewShift(right, bottom) {
  S.viewShift = { right, bottom };
  applyViewShift();
}
function applyViewShift() {
  const W = innerWidth;
  const H = innerHeight;
  const { right, bottom } = S.viewShift;
  camera.aspect = W / H;
  if (right || bottom) camera.setViewOffset(W + right, H + bottom, right, bottom, W, H);
  else camera.clearViewOffset();
  camera.updateProjectionMatrix();
}

function onResize() {
  renderer.setSize(innerWidth, innerHeight);
  if (S.mode === 'studio') studioViewShift();
  else if (S.mode === 'review') setViewShift(0, reviewPanelHeight());
  else applyViewShift();
}
addEventListener('resize', onResize);
addEventListener('orientationchange', () => setTimeout(onResize, 300));

function showHud(on) {
  UI.show('#hud', on);
  if (!on) UI.show('#emote-panel', false);
}

// ---------------------------------------------------------------- plaza
const fwd = new THREE.Vector3();
const right = new THREE.Vector3();
const move = new THREE.Vector3();
const camGoal = new THREE.Vector3();
const lookGoal = new THREE.Vector3();

function updatePlaza(dt) {
  const look = controls.takeLook();
  S.camYaw -= look.x * 0.006;
  S.camPitch = clamp(S.camPitch + look.y * 0.003, 0.15, 0.95);

  const inp = controls.move2;
  fwd.set(-Math.sin(S.camYaw), 0, -Math.cos(S.camYaw));
  right.set(Math.cos(S.camYaw), 0, -Math.sin(S.camYaw));
  move.copy(right).multiplyScalar(inp.x).addScaledVector(fwd, inp.y);
  const mag = Math.min(1, move.length());
  S.vel.lerp(move.multiplyScalar(WALK_SPEED), damp(12, dt));
  const pos = player.root.position;
  pos.addScaledVector(S.vel, dt);
  world.resolve(pos);
  if (mag > 0.05) S.facing = lerpAngle(S.facing, Math.atan2(S.vel.x, S.vel.z), damp(12, dt));
  player.root.rotation.y = S.facing;
  player.speed = Math.min(1, S.vel.length() / WALK_SPEED);

  // Near a door?
  let near = null;
  for (const r of world.restaurants) if (Math.hypot(pos.x - r.door.x, pos.z - r.door.z) < 2.6) near = r;
  if (near !== S.near) {
    S.near = near;
    UI.show('#btn-go-in', !!near);
    $('#action-label').textContent = near ? 'Go in!' : 'Jump';
    $('#btn-action').firstChild.textContent = near ? '🚪' : '⭐';
    if (near) {
      $('#go-in-name').textContent = near.name;
      sfx.sparkle();
    }
  }
  followCamera(dt);
}

function followCamera(dt, snap = false) {
  const p = player.root.position;
  lookGoal.set(p.x, 1.3, p.z);
  // Pull the camera in if a building is in the way.
  let dist = S.camDist;
  const cp = Math.cos(S.camPitch);
  for (let d = 1.5; d <= S.camDist; d += 0.5) {
    if (world.blocked(p.x + Math.sin(S.camYaw) * cp * d, p.z + Math.cos(S.camYaw) * cp * d)) {
      dist = Math.max(2.5, d - 0.6);
      break;
    }
  }
  camGoal.set(p.x + Math.sin(S.camYaw) * cp * dist, 1.3 + Math.sin(S.camPitch) * dist, p.z + Math.cos(S.camYaw) * cp * dist);
  if (snap) camera.position.copy(camGoal);
  else camera.position.lerp(camGoal, damp(8, dt));
  camera.lookAt(lookGoal);
}

// ---------------------------------------------------------------- emotes (plaza)
function doEmote(e) {
  unlockAudio();
  player.playEmote(e);
  net.sendEmote(e);
  if (e === 'jump') sfx.boing();
  else sfx.emote();
}
function doSay(i) {
  player.say(LINES[i]);
  net.sendSay(i);
  sfx.pop();
  if (S.settings.speak) speak(LINES[i]);
}
UI.buildEmotePanel(PLAZA_EMOTES, PLAZA_LINES, (e) => {
  UI.show('#emote-panel', false);
  doEmote(e);
}, (i) => {
  UI.show('#emote-panel', false);
  doSay(i);
});

// HUD buttons. Action/Emote use pointerdown so they work while a thumb is on the joystick.
function onPress(el, fn) {
  el.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    el.classList.add('pressed');
    fn();
  });
  const up = () => el.classList.remove('pressed');
  el.addEventListener('pointerup', up);
  el.addEventListener('pointerleave', up);
  el.addEventListener('pointercancel', up);
}
onPress($('#btn-action'), () => {
  if (S.mode !== 'plaza') return;
  if (S.near) enterRestaurant(S.near);
  else doEmote('jump');
});
onPress($('#btn-emote'), () => {
  sfx.tap();
  const p = $('#emote-panel');
  UI.show(p, p.classList.contains('hidden'));
});
$('#btn-go-in').addEventListener('click', () => S.near && enterRestaurant(S.near));
$('#btn-me').addEventListener('click', () => openStudio('me'));
$('#btn-closet').addEventListener('click', () => openStudio('closet'));
$('#btn-reviews').addEventListener('click', openBook);
$('#btn-invite').addEventListener('click', openInvite);
$('#btn-sound').addEventListener('click', () => {
  S.settings.muted = !S.settings.muted;
  setMuted(S.settings.muted);
  saveSettings(S.settings);
  $('#btn-sound').textContent = S.settings.muted ? '🔇' : '🔊';
  if (S.settings.muted) speechSynthesis?.cancel?.();
  else sfx.pop();
});
$('#btn-sound').textContent = S.settings.muted ? '🔇' : '🔊';

// ---------------------------------------------------------------- studio (creator + closet)
function studioViewShift() {
  const portrait = innerHeight > innerWidth;
  const panel = $('.studio-panel');
  if (portrait) setViewShift(0, panel.offsetHeight || innerHeight * 0.54);
  else setViewShift(panel.offsetWidth || Math.min(460, innerWidth * 0.48), 0);
}

function openStudio(kind, first = false) {
  if (S.mode !== 'plaza' && S.mode !== 'studio' && S.mode !== 'loading') return;
  sfx.whoosh();
  S.mode = 'studio';
  S.studio = { kind, first };
  S.spin = 0;
  S.studioYaw = S.camYaw;
  player.speed = 0;
  S.vel.set(0, 0, 0);
  showHud(false);
  UI.show('#screen-studio', true);
  $('#studio-title').textContent = kind === 'me' ? (first ? 'Make your reviewer!' : 'Change me!') : 'My Closet 👗';
  $('#studio-done').textContent = first && kind === 'me' ? 'Next ➜' : 'Done ✓';
  const ctx = { getApp: () => S.app, update: updateAppearance };
  const tabs = UI.studioTabs(kind, ctx);
  const tabBar = $('#studio-tabs');
  const body = $('#studio-body');
  const select = (t) => {
    tabBar.querySelectorAll('.tab').forEach((b) => b.classList.toggle('on', b.dataset.id === t.id));
    body.replaceChildren(t.build());
    body.scrollTop = 0;
  };
  tabBar.replaceChildren(...tabs.map((t) => {
    const b = document.createElement('button');
    b.className = 'tab';
    b.dataset.id = t.id;
    b.innerHTML = `<span class="ti"></span><span></span>`;
    b.children[0].textContent = t.icon;
    b.children[1].textContent = t.label;
    b.addEventListener('click', () => {
      sfx.tap();
      select(t);
    });
    return b;
  }));
  select(tabs[0]);
  requestAnimationFrame(studioViewShift);
}

$('#studio-done').addEventListener('click', () => {
  if (!S.studio) return;
  sfx.pop();
  if (S.studio.first && S.studio.kind === 'me') {
    openStudio('closet', true);
    return;
  }
  const first = S.studio.first;
  closeStudio();
  if (first) {
    UI.toast('Walk to a restaurant and tap “Go in!” 🍔', 4200);
    player.playEmote('wave');
  } else {
    player.playEmote('dance');
  }
});

function closeStudio() {
  S.studio = null;
  UI.show('#screen-studio', false);
  setViewShift(0, 0);
  S.mode = 'plaza';
  showHud(true);
  player.root.rotation.y = S.facing;
}

function updateStudio(dt) {
  const look = controls.takeLook();
  S.spin += look.x * 0.012;
  if (Math.abs(look.x) < 0.01) S.spin += dt * 0.25;
  const p = player.root.position;
  const portrait = innerHeight > innerWidth;
  const dist = portrait ? 5.4 : 3.6;
  player.root.rotation.y = S.studioYaw + S.spin;
  player.speed = 0;
  camGoal.set(p.x + Math.sin(S.studioYaw) * dist, 1.3, p.z + Math.cos(S.studioYaw) * dist);
  camera.position.lerp(camGoal, damp(6, dt));
  lookGoal.set(p.x, 1.0, p.z);
  camera.lookAt(lookGoal);
}

// ---------------------------------------------------------------- restaurant visit
function seat(char, i) {
  const s = world.interior.seats[i];
  char.root.position.copy(s);
  char.root.rotation.y = 0;
  char.pose = 'sit';
  char.speed = 0;
}

function disposeFood(f) {
  if (!f) return;
  f.parent?.remove(f);
  f.traverse((o) => o.geometry?.dispose());
}

function enterRestaurant(r) {
  if (S.mode !== 'plaza') return;
  unlockAudio();
  S.mode = 'transition';
  sfx.door();
  showHud(false);
  fade(() => {
    S.plazaPos.copy(player.root.position);
    S.restaurant = r;
    S.near = null;
    UI.show('#btn-go-in', false);
    player.speed = 0;
    S.vel.set(0, 0, 0);
    world.interior.setRestaurant(r);
    seat(player, 0);
    cohost.setAppearance({ ...S.app, ...COHOST });
    cohost.root.visible = true;
    seat(cohost, 1);
    camera.position.copy(world.interior.camPos).add(new THREE.Vector3(0, 0.8, 1.5));
    camera.lookAt(world.interior.camTarget);
    UI.buildOrder(r, orderFood);
    UI.show('#screen-order', true);
    S.mode = 'order';
    sendState(true);
  });
}

function orderFood(item) {
  if (S.mode !== 'order') return;
  sfx.ding();
  S.item = item;
  const r = S.restaurant;
  disposeFood(S.food);
  disposeFood(S.cohostFood);
  S.food = createFood(item.id, r.wall === '#fdfdfd' ? r.roof : r.wall);
  S.food.position.copy(world.interior.plates[0]).add(new THREE.Vector3(0, 0.03, 0));
  scene.add(S.food);
  S.cohostFood = createFood(item.id, r.wall === '#fdfdfd' ? r.roof : r.wall);
  S.cohostFood.position.copy(world.interior.plates[1]).add(new THREE.Vector3(0, 0.03, 0));
  S.cohostFood.rotation.y = 0.6;
  scene.add(S.cohostFood);
  S.foodPop = 0;
  S.bites = 0;
  UI.show('#screen-order', false);
  startReview();
}

function reviewPanelHeight() {
  const el = $('.review-controls');
  return Math.min(innerHeight * 0.45, (el && el.offsetHeight) || 220);
}

function startReview() {
  S.mode = 'review';
  S.recStart = performance.now();
  player.holdCamera(true);
  $('#vf-rest').textContent = S.restaurant.name;
  $('#btn-talk').textContent = `🗣️ Talk out loud: ${S.settings.speak ? 'ON' : 'OFF'}`;
  UI.buildReviewControls(REVIEW_EMOTES, REVIEW_LINES, { onEmote: reviewEmote, onBite: () => bite(player), onSay: reviewSay });
  UI.show('#screen-review', true);
  requestAnimationFrame(() => setViewShift(0, reviewPanelHeight()));
  sfx.rec();
  later(() => cohost.playEmote('wave'), 600);
}

function cohostReact() {
  later(() => {
    if (S.mode === 'review') cohost.playEmote(pick(['thumbs', 'yum', 'wow', 'heart']));
  }, 700);
}

function reviewEmote(e) {
  player.playEmote(e);
  net.sendEmote(e);
  sfx.emote();
  cohostReact();
}

function reviewSay(i) {
  player.say(LINES[i]);
  net.sendSay(i);
  sfx.pop();
  if (S.settings.speak) speak(LINES[i]);
  if (i === 1) {
    later(() => S.mode === 'review' && bite(player), 900);
    later(() => S.mode === 'review' && bite(cohost), 1300);
  } else cohostReact();
}

function bite(who) {
  if (S.mode !== 'review' || !S.item) return;
  const isPlayer = who === player;
  const food = isPlayer ? S.food : S.cohostFood;
  if (!food || !food.visible) {
    if (isPlayer) UI.toast('All gone! Time to rate it ⭐');
    return;
  }
  if (who.emote === 'bite') return;
  who.playEmote('bite');
  const mini = createFood(S.item.id);
  mini.scale.setScalar(0.45);
  mini.rotation.set(Math.PI / 2, 0, 0);
  who.setHeldItem(mini);
  later(() => {
    sfx.chomp();
    food.scale.multiplyScalar(0.78);
    if (isPlayer) {
      S.bites++;
      if (S.bites >= 3) {
        food.visible = false;
        sfx.sparkle();
        UI.toast('All gone! 😋 Tap “Rate it!”');
      }
    }
  }, 420);
  later(() => {
    who.setHeldItem(null);
    disposeFood(mini);
  }, 950);
}

$('#btn-talk').addEventListener('click', () => {
  S.settings.speak = !S.settings.speak;
  saveSettings(S.settings);
  $('#btn-talk').textContent = `🗣️ Talk out loud: ${S.settings.speak ? 'ON' : 'OFF'}`;
  sfx.tap();
});

$('#btn-review-done').addEventListener('click', () => {
  if (S.mode !== 'review') return;
  sfx.pop();
  S.mode = 'rate';
  UI.show('#screen-review', false);
  setViewShift(0, 0);
  player.holdCamera(false);
  UI.buildRate(S.item, saveRating);
  UI.show('#screen-rate', true);
});

function saveRating(stars, mood) {
  const r = S.restaurant;
  S.reviews = addReview({ rid: r.id, food: S.item.name, emoji: S.item.emoji, mood, stars, ts: Date.now() });
  S.reviews = loadReviews();
  refreshStars();
  sfx.fanfare();
  confetti(stars >= 4 ? 220 : 140);
  UI.show('#screen-rate', false);
  player.playEmote(stars >= 3 ? 'wow' : 'thumbs');
  cohost.playEmote('heart');
  UI.toast(`Review saved! ${'⭐'.repeat(stars)}`, 3000);
  later(leaveRestaurant, 1900);
}

$('#order-leave').addEventListener('click', () => {
  sfx.tap();
  UI.show('#screen-order', false);
  leaveRestaurant();
});

function leaveRestaurant() {
  if (!S.restaurant) return;
  S.mode = 'transition';
  clearLater();
  fade(() => {
    const r = S.restaurant;
    disposeFood(S.food);
    disposeFood(S.cohostFood);
    S.food = S.cohostFood = null;
    cohost.root.visible = false;
    player.pose = 'stand';
    player.holdCamera(false);
    player.setHeldItem(null);
    // step out of the door toward the plaza
    const out = r.door.clone().multiplyScalar((r.door.length() - 2.2) / r.door.length());
    player.root.position.set(out.x, 0, out.z);
    S.facing = Math.atan2(-out.x, -out.z);
    player.root.rotation.y = S.facing;
    S.camYaw = Math.atan2(out.x, out.z);
    S.restaurant = null;
    S.item = null;
    UI.show('#screen-review', false);
    UI.show('#screen-rate', false);
    UI.show('#screen-order', false);
    setViewShift(0, 0);
    S.mode = 'plaza';
    showHud(true);
    followCamera(0, true);
    sendState(true);
  });
}

function updateInterior(dt, t) {
  const portrait = innerHeight / innerWidth > 0.9;
  camGoal.copy(world.interior.camPos);
  if (portrait) camGoal.z += 2.4;
  if (S.mode === 'order') camGoal.add(new THREE.Vector3(0, 0.8, 1.5));
  // a little "hand-held camera" wobble
  camGoal.x += Math.sin(t * 0.7) * 0.04;
  camGoal.y += Math.sin(t * 1.1) * 0.03;
  camera.position.lerp(camGoal, damp(4, dt));
  camera.lookAt(world.interior.camTarget);
  if (S.food && S.foodPop < 1) {
    S.foodPop = Math.min(1, S.foodPop + dt * 2.5);
    const k = S.foodPop;
    const s = 1 + Math.sin(k * Math.PI) * 0.35;
    S.food.scale.setScalar(k * s);
    S.cohostFood?.scale.setScalar(k * s);
  }
  if (S.mode === 'review') {
    const secs = Math.floor((performance.now() - S.recStart) / 1000);
    const txt = `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;
    const el = $('#rec-time');
    if (el.textContent !== txt) el.textContent = txt;
  }
  cohost.update(dt);
}

// ---------------------------------------------------------------- scrapbook & invite
function openBook() {
  if (S.mode !== 'plaza') return;
  sfx.whoosh();
  S.mode = 'book';
  player.speed = 0;
  S.vel.set(0, 0, 0);
  showHud(false);
  UI.buildBook(reviewStats(S.reviews));
  UI.show('#screen-book', true);
}
$('#book-close').addEventListener('click', () => {
  sfx.tap();
  UI.show('#screen-book', false);
  S.mode = 'plaza';
  showHud(true);
});

function inviteUrl() {
  const u = new URL(location.href);
  u.search = `?room=${encodeURIComponent(room)}`;
  u.hash = '';
  return u.toString();
}
function openInvite() {
  if (S.mode !== 'plaza') return;
  sfx.whoosh();
  S.mode = 'invite';
  showHud(false);
  $('#invite-link').textContent = inviteUrl();
  $('#invite-copy').textContent = navigator.share ? '📤 Share link' : '📋 Copy link';
  UI.show('#screen-invite', true);
}
$('#invite-copy').addEventListener('click', async () => {
  const url = inviteUrl();
  if (navigator.share) {
    try {
      await navigator.share({ title: 'Table for Two Eating', text: 'Come play in my Yummy Town! 🍔', url });
      return;
    } catch (err) {
      if (err && err.name === 'AbortError') return;
    }
  }
  const ok = await UI.copyText(url);
  UI.toast(ok ? '📋 Link copied! Send it to a friend 💌' : 'Press and hold the link to copy it');
});
$('#invite-new').addEventListener('click', () => {
  const code = makeRoomCode();
  try {
    localStorage.setItem('t42.room', code);
  } catch {
    /* ignore */
  }
  location.search = `?room=${code}`;
});
$('#invite-close').addEventListener('click', () => {
  sfx.tap();
  UI.show('#screen-invite', false);
  S.mode = 'plaza';
  showHud(true);
});

addEventListener('keydown', (e) => {
  if (e.key === 'Escape') UI.show('#emote-panel', false);
  if (e.key === ' ' && S.mode === 'plaza' && !(e.target instanceof HTMLButtonElement)) {
    e.preventDefault();
    if (S.near) enterRestaurant(S.near);
    else doEmote('jump');
  }
  if ((e.key === 'e' || e.key === 'Enter') && S.mode === 'plaza' && S.near) enterRestaurant(S.near);
});

// iOS: block pinch-zoom & double-tap zoom on the game surface; unlock audio on first touch.
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());
const unlockOnce = () => {
  unlockAudio();
  removeEventListener('pointerdown', unlockOnce, true);
  removeEventListener('touchend', unlockOnce, true);
};
addEventListener('pointerdown', unlockOnce, true);
addEventListener('touchend', unlockOnce, true);

// Close the emote panel when tapping the 3D world.
canvas.addEventListener('pointerdown', () => UI.show('#emote-panel', false));

// ---------------------------------------------------------------- main loop
let last = performance.now();
let time = 0;
let frames = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
  last = now;
  time += dt;

  if (S.mode === 'plaza') updatePlaza(dt);
  else if (S.mode === 'studio') updateStudio(dt);
  else if (S.mode === 'order' || S.mode === 'review' || S.mode === 'rate') updateInterior(dt, time);
  else {
    controls.takeLook();
    player.speed = 0;
    if (!S.restaurant) followCamera(dt);
  }
  player.update(dt);
  updateRemotes(dt, now);
  world.update(time, S.mode === 'plaza' ? S.near : null);

  S.sendT += dt;
  if (S.sendT >= SEND_INTERVAL) {
    S.sendT = 0;
    sendState();
  }
  renderer.render(scene, camera);
  if (++frames === 2) {
    $('#loading').classList.add('gone');
    setTimeout(() => $('#loading').remove(), 600);
  }
}

// ---------------------------------------------------------------- start
S.mode = 'plaza';
followCamera(0, true);
showHud(true);
updateNetChip();
net.connect(S.app);
if (loaded.isNew) openStudio('me', true);
requestAnimationFrame(frame);

// Debug hooks for automated tests (read-only views of game state).
window.__t42 = {
  ready: true,
  room,
  remotePlayerCount: () => remotes.size,
  playerPosition: () => ({ x: player.root.position.x, z: player.root.position.z }),
  remotePositions: () => [...remotes.values()].map((e) => ({ x: e.char.root.position.x, z: e.char.root.position.z, name: e.name })),
  mode: () => S.mode,
  netStatus: () => net.status,
  restaurants: () => world.restaurants.map((r) => ({ id: r.id, door: { x: r.door.x, z: r.door.z } })),
  ringRadius: RING_RADIUS,
  /** Test helper: move the local player (plaza only). */
  teleport: (x, z) => {
    if (S.mode !== 'plaza') return;
    player.root.position.set(x, 0, z);
    world.resolve(player.root.position);
    followCamera(0, true);
  },
};
