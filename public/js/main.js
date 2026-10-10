// Table for Two Eating — game bootstrap, modes and main loop.
import * as THREE from '../vendor/three.module.js';
import { LINES, isValidRoom, repairAppearance, ROOM_WORDS_A, ROOM_WORDS_B } from './schema.js';
import { REVIEW_EMOTES, REVIEW_LINES, PLAZA_EMOTES, PLAZA_LINES, COHOST, FOOD_REACTIONS, MYSTERY_TWISTS } from './data.js';
import { $, clamp, damp, lerpAngle, pick, randInt, emojiTexture, smooth01 } from './util.js';
import { Character } from './character.js';
import { buildWorld, RING_RADIUS, WORLD_RADIUS, INTERIOR_ORIGIN } from './world.js';
import { createFood } from './food.js';
import { SushiBelt } from './belt.js';
import { passportProgress } from './passport.js';
import { Controls } from './controls.js';
import { Net } from './net.js';
import { sfx, unlockAudio, setMuted, speak } from './audio.js';
import { initConfetti, confetti } from './confetti.js';
import { loadAppearance, saveAppearance, loadReviews, addReview, loadSettings, saveSettings, reviewStats } from './storage.js';
import * as UI from './ui.js';

const WALK_SPEED = 7;
const GRAVITY = 24;
const BOUNCE_SPEED = 13.5; // straight up off a bounce pad: about two reviewers high
const SEND_INTERVAL = 0.1; // 10 Hz
const INTERP_DELAY = 140; // ms of buffering for smooth remote movement
const MAX_REMOTES = 7;

// ---------------------------------------------------------------- room code
const CODE_CHARS = 'abcdefghjkmnpqrstuvwxyz23456789';
function makeRoomCode() {
  let tail = '';
  for (let i = 0; i < 6; i++) tail += CODE_CHARS[randInt(CODE_CHARS.length)];
  return `${pick(ROOM_WORDS_A)}-${pick(ROOM_WORDS_B)}-${tail}`;
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
  renderer = new THREE.WebGLRenderer({ canvas, antialias: (window.devicePixelRatio || 1) < 2, powerPreference: 'high-performance' });
} catch (err) {
  $('#loading .loading-card').innerHTML = '<div class="loading-logo">😢</div><h1>Oops!</h1><p class="sub">This browser can\'t show the 3D town.<br>Try Safari or Chrome.</p>';
  throw err;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(innerWidth, innerHeight);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 220);

const world = buildWorld(scene);
const belt = new SushiBelt(world.interior.group);
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
  y: 0, // height off the ground (bounce pads, the slide)
  vy: 0,
  bounces: 0,
  slides: 0,
  ride: null, // { s, v, sliding } while on the slide
  near: null,
  nearSlide: false,
  grab: null, // a conveyor-belt plate flying to the table
  progress: null, // sticker passport: stickers, badges and unlocked hats
  newSticker: null,
  rewards: [], // badges waiting to be celebrated in the plaza
  restaurant: null,
  item: null,
  plazaPos: new THREE.Vector3(),
  rolling: false,
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
S.progress = passportProgress(S.reviews);
if (!S.progress.hats.includes(S.app.hat)) S.app.hat = 'none'; // hats have to be earned

const player = new Character(S.app, { label: S.app.name });
player.setLabel(S.app.name, '#ff4fa0');
player.root.position.set(0, 0, 7);
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
  if (remotes.size >= MAX_REMOTES) return false;
  const char = new Character(p.app, { label: p.app.name });
  const e = { char, buf: [], an: 'idle', name: p.app.name, lastY: 0, rising: false };
  if (p.st) {
    char.root.position.set(p.st.x, p.st.y, p.st.z);
    char.root.rotation.y = p.st.ry;
    pushState(e, p.st);
  } else char.root.position.set(0, 0, 9);
  scene.add(char.root);
  remotes.set(p.id, e);
  return true;
}
function removeRemote(id) {
  const e = remotes.get(id);
  if (!e) return;
  e.char.dispose();
  remotes.delete(id);
}
function pushState(e, st) {
  e.buf.push({ t: performance.now(), x: st.x, z: st.z, ry: st.ry, y: st.y });
  if (e.buf.length > 30) e.buf.shift();
  // a friend starting to go up again is a bounce: squash the pad they are on
  const rising = st.y > e.lastY + 0.01;
  if (st.an === 'air' && rising && !e.rising) {
    const pad = world.padAt(st.x, st.z, 1.2);
    if (pad) world.bouncePad(pad);
  }
  e.rising = rising;
  e.lastY = st.y;
  if (st.an !== e.an) {
    e.an = st.an;
    e.char.action = st.an === 'air' || st.an === 'slide' ? st.an : null;
    e.char.holdCamera(st.an === 'review');
    if (st.an === 'review') e.char.showBubble(emojiTexture('🎬'), 0.7, 3600);
    else e.char.clearBubble();
  }
}
const tmpV = new THREE.Vector3();
const tmpBefore = new THREE.Vector3();
const ORDER_CAM_OFFSET = new THREE.Vector3(0, 0.8, 1.5);
const FOOD_LIFT = new THREE.Vector3(0, 0.03, 0);
function updateRemotes(dt, nowMs) {
  const renderT = nowMs - INTERP_DELAY;
  for (const e of remotes.values()) {
    const b = e.buf;
    const root = e.char.root;
    if (b.length) {
      let tx = b[b.length - 1].x;
      let ty = b[b.length - 1].y;
      let tz = b[b.length - 1].z;
      let ry = b[b.length - 1].ry;
      for (let i = b.length - 2; i >= 0; i--) {
        if (b[i].t <= renderT) {
          const a = b[i];
          const c = b[i + 1];
          const f = clamp((renderT - a.t) / Math.max(1, c.t - a.t), 0, 1);
          tx = a.x + (c.x - a.x) * f;
          ty = a.y + (c.y - a.y) * f;
          tz = a.z + (c.z - a.z) * f;
          ry = lerpAngle(a.ry, c.ry, f);
          break;
        }
      }
      tmpV.set(tx, ty, tz);
      const before = tmpBefore.copy(root.position);
      if (root.position.distanceTo(tmpV) > 12) root.position.copy(tmpV);
      else root.position.lerp(tmpV, damp(18, dt));
      root.rotation.y = lerpAngle(root.rotation.y, ry, damp(14, dt));
      const sp = Math.hypot(before.x - root.position.x, before.z - root.position.z) / Math.max(dt, 1e-3) / WALK_SPEED;
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
    if (!addRemote(p)) return;
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
  const y = inside ? 0 : S.y;
  const ry = inside ? S.facing : player.root.rotation.y;
  let an = player.speed > 0.1 ? 'walk' : 'idle';
  if (inside) an = 'review';
  else if (S.ride) an = S.ride.sliding ? 'slide' : 'walk';
  else if (y > 0.05) an = 'air';
  const key = `${pos.x.toFixed(2)},${pos.z.toFixed(2)},${y.toFixed(2)},${ry.toFixed(2)},${an}`;
  const now = performance.now();
  if (!force && key === S.lastSent && now - S.lastSentAt < 1000) return;
  S.lastSent = key;
  S.lastSentAt = now;
  net.sendState(pos.x, pos.z, Math.atan2(Math.sin(ry), Math.cos(ry)), an, y);
}

let appSendTimer = 0;
function updateAppearance(patch) {
  const prevName = S.app.name;
  S.app = repairAppearance({ ...S.app, ...patch });
  if (!S.progress.hats.includes(S.app.hat)) S.app.hat = 'none';
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
  // Pure shift (no zoom): centre the scene in the area not covered by a panel.
  if (right || bottom) camera.setViewOffset(W, H, right / 2, bottom / 2, W, H);
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
  updateHeight(dt, true);

  // Near a door, or at the foot of the slide?
  let near = null;
  for (const r of world.restaurants) if (Math.hypot(pos.x - r.door.x, pos.z - r.door.z) < 2.6) near = r;
  const foot = world.slide.foot;
  const nearSlide = !near && S.y === 0 && Math.hypot(pos.x - foot.x, pos.z - foot.z) < 1.7;
  if (near !== S.near || nearSlide !== S.nearSlide) {
    setNear(near, nearSlide);
    if (near || nearSlide) sfx.sparkle();
  }
  followCamera(dt);
}

/** Gravity, landing and bounce pads. `pads` is off while a menu is open: you just float back down. */
function updateHeight(dt, pads) {
  const pos = player.root.position;
  if (S.y > 0 || S.vy > 0) {
    S.vy -= GRAVITY * dt;
    S.y = Math.max(0, S.y + S.vy * dt);
    if (S.y === 0) S.vy = 0;
  }
  const pad = pads && S.y === 0 ? world.padAt(pos.x, pos.z) : null;
  if (pad) {
    S.vy = BOUNCE_SPEED;
    S.y = 0.01;
    world.bouncePad(pad);
    sfx.boing();
    if (++S.bounces === 1) UI.toast('Boing! Bounce pads make you fly! ⭐');
  }
  pos.y = S.y;
  player.action = S.y > 0.05 ? 'air' : null;
}

function setNear(near, nearSlide = false) {
  S.near = near;
  S.nearSlide = nearSlide;
  UI.show('#btn-go-in', !!near || nearSlide);
  $('#action-label').textContent = near ? 'Go in!' : nearSlide ? 'Slide!' : 'Jump';
  $('#btn-action').firstChild.textContent = near ? '🚪' : nearSlide ? '🎢' : '⭐';
  $('#go-in-text').textContent = nearSlide ? '🎢 Slide!' : '🚪 Go in!';
  $('#btn-go-in').setAttribute('aria-label', nearSlide ? 'Ride the slide' : 'Go in');
  $('#go-in-name').textContent = near ? near.name : nearSlide ? 'Wheee!' : '';
}

// ---------------------------------------------------------------- slide
// A short ride on rails: up the stairs, then down the chute. `s` is the distance along the slide.
function startSlide() {
  if (S.mode !== 'plaza' || S.y > 0) return;
  unlockAudio();
  S.mode = 'ride';
  S.ride = { s: world.slide.enter, v: 0, sliding: false };
  S.vel.set(0, 0, 0);
  setNear(null);
  UI.show('#emote-panel', false);
  sfx.pop();
}

function updateRide(dt) {
  const look = controls.takeLook();
  S.camYaw -= look.x * 0.006;
  S.camPitch = clamp(S.camPitch + look.y * 0.003, 0.15, 0.95);
  const sl = world.slide;
  const ride = S.ride;
  if (!ride.sliding) {
    ride.s += 4.2 * dt;
    if (ride.s >= sl.top) {
      ride.s = sl.top;
      ride.sliding = true;
      ride.v = 1.5;
      sfx.whee();
      UI.toast('Wheee! 🎢', 1600);
    }
  } else {
    ride.v = Math.min(9.5, ride.v + 7 * dt);
    ride.s += ride.v * dt;
  }
  const pos = sl.pointAt(ride.s, player.root.position);
  const floor = sl.heightAt(ride.s);
  // feet climb the steps smoothly; on the chute you are glued to it
  S.y = ride.sliding ? floor : S.y + (floor - S.y) * damp(16, dt);
  pos.y = S.y;
  S.facing = sl.yaw;
  player.root.rotation.y = S.facing;
  player.speed = ride.sliding ? 0 : 1;
  player.action = ride.sliding && ride.s < sl.exit - 1.2 ? 'slide' : null;
  if (ride.s >= sl.exit) {
    S.ride = null;
    S.mode = 'plaza';
    S.y = S.vy = pos.y = 0;
    S.vel.copy(sl.dir).multiplyScalar(4); // a few running steps off the end
    S.slides++;
  }
  followCamera(dt);
}

function followCamera(dt, snap = false) {
  const p = player.root.position;
  const lift = p.y * 0.6; // rise with the player on bounce pads and the slide
  lookGoal.set(p.x, 2.0 + lift, p.z);
  // Pull the camera in if a building is in the way.
  let dist = S.camDist;
  const cp = Math.cos(S.camPitch);
  for (let d = 1.5; d <= S.camDist; d += 0.5) {
    if (world.blocked(p.x + Math.sin(S.camYaw) * cp * d, p.z + Math.cos(S.camYaw) * cp * d)) {
      dist = Math.max(2.5, d - 0.6);
      break;
    }
  }
  camGoal.set(p.x + Math.sin(S.camYaw) * cp * dist, 1.3 + lift + Math.sin(S.camPitch) * dist, p.z + Math.cos(S.camYaw) * cp * dist);
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
/** The big yellow button: go in at a door, ride the slide at its stairs, otherwise jump. */
function doAction(jump = true) {
  if (S.mode !== 'plaza') return;
  if (S.near) enterRestaurant(S.near);
  else if (S.nearSlide) startSlide();
  else if (jump && S.y === 0) doEmote('jump');
}
onPress($('#btn-action'), () => doAction());
onPress($('#btn-emote'), () => {
  sfx.tap();
  const p = $('#emote-panel');
  UI.show(p, p.classList.contains('hidden'));
});
$('#btn-go-in').addEventListener('click', () => doAction(false));
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
  S.studioYaw = clearYaw(player.root.position, innerHeight > innerWidth ? 6.1 : 4.3);
  player.speed = 0;
  S.vel.set(0, 0, 0);
  showHud(false);
  UI.show('#screen-studio', true);
  $('#studio-title').textContent = kind === 'me' ? (first ? 'Make your reviewer!' : 'Change me!') : 'My Closet 👗';
  $('#studio-done').textContent = first && kind === 'me' ? 'Next ➜' : 'Done ✓';
  const ctx = { getApp: () => S.app, update: updateAppearance, hats: () => S.progress.hats };
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

/** Find a camera direction around `p` with nothing in the way for `dist` units. */
function clearYaw(p, dist) {
  const toCenter = Math.atan2(-p.x, -p.z);
  const candidates = [S.camYaw, toCenter, S.camYaw + Math.PI, S.camYaw + Math.PI / 2, S.camYaw - Math.PI / 2];
  for (const yaw of candidates) {
    let clear = true;
    for (let d = 0.8; d <= dist && clear; d += 0.4) {
      const x = p.x + Math.sin(yaw) * d;
      const z = p.z + Math.cos(yaw) * d;
      if (world.blocked(x, z, 0.5) || Math.hypot(x, z) < 3.8) clear = false;
    }
    if (clear) return yaw;
  }
  return toCenter;
}

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
  const dist = portrait ? 5.6 : 3.8;
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
    S.plazaPos.copy(player.root.position).setY(0);
    S.restaurant = r;
    setNear(null);
    player.speed = 0;
    player.action = null;
    S.vel.set(0, 0, 0);
    S.y = S.vy = 0;
    world.interior.setRestaurant(r);
    seat(player, 0);
    player.labelSprite.visible = false;
    cohost.setAppearance({ ...S.app, ...COHOST });
    cohost.root.visible = true;
    seat(cohost, 1);
    setRolling(false);
    if (r.belt) {
      belt.load(r);
      belt.setFast(S.settings.beltFast);
      openBelt();
    } else openOrder();
    camera.position.copy(r.belt ? BELT_CAM : world.interior.camPos);
    if (!r.belt) camera.position.add(ORDER_CAM_OFFSET);
    interiorLook.copy(r.belt ? BELT_LOOK : world.interior.camTarget);
    camera.lookAt(interiorLook);
    sendState(true);
  });
}

/** The menu card. */
function openOrder() {
  const r = S.restaurant;
  UI.buildOrder(r, (item) => !S.rolling && orderFood(item));
  UI.show('#order-belt', !!r.belt);
  UI.show('#screen-belt', false);
  UI.show('#screen-order', true);
  S.mode = 'order';
}

// ---------------------------------------------------------------- sushi conveyor belt
const BELT_CAM = new THREE.Vector3(0, 3.5, 6.9).add(INTERIOR_ORIGIN);
const BELT_LOOK = new THREE.Vector3(0, 1.0, 2.2).add(INTERIOR_ORIGIN);
const interiorLook = new THREE.Vector3();
const raycaster = new THREE.Raycaster();
const tapPoint = new THREE.Vector2();

function syncBeltSpeed() {
  for (const [id, on] of [['#belt-slow', !S.settings.beltFast], ['#belt-fast', S.settings.beltFast]]) {
    $(id).classList.toggle('on', on);
    $(id).setAttribute('aria-pressed', String(on));
  }
}
function setBeltFast(fast) {
  S.settings.beltFast = fast;
  saveSettings(S.settings);
  belt.setFast(fast);
  syncBeltSpeed();
  sfx.tap();
}

function openBelt() {
  S.grab = null;
  syncBeltSpeed();
  UI.show('#screen-order', false);
  UI.show('#screen-belt', true);
  S.mode = 'belt';
}

/** A finger went down on the 3D view: grab the plate under it. */
function tapBelt(clientX, clientY) {
  if (S.mode !== 'belt' || S.grab) return;
  tapPoint.set((clientX / innerWidth) * 2 - 1, 1 - (clientY / innerHeight) * 2);
  camera.updateMatrixWorld();
  raycaster.setFromCamera(tapPoint, camera);
  const plate = belt.pick(raycaster.ray);
  if (!plate) return;
  unlockAudio();
  plate.taken = true;
  const item = plate.mystery ? rollMystery(S.restaurant) : plate.item;
  const to = belt.group.worldToLocal(world.interior.plates[0].clone());
  S.grab = { plate, item, from: plate.group.position.clone(), to, t: 0 };
  if (plate.mystery) sfx.drumroll();
  else sfx.grab();
}

/** The grabbed plate hops off the belt onto the table, then the review starts. */
function updateGrab(dt) {
  const grab = S.grab;
  if (!grab || S.mode !== 'belt') return;
  grab.t = Math.min(1, grab.t + dt / 0.6);
  const k = smooth01(grab.t);
  grab.plate.group.position.lerpVectors(grab.from, grab.to, k);
  grab.plate.group.position.y += Math.sin(k * Math.PI) * 0.9;
  if (grab.t < 1) return;
  S.grab = null;
  grab.plate.group.visible = false;
  const { item } = grab;
  orderFood(item);
  UI.toast(grab.plate.mystery ? `🎲 Surprise! ${item.emoji} ${item.name}!` : `You grabbed ${item.emoji} ${item.name}!`, 3000);
}

$('#belt-slow').addEventListener('click', () => setBeltFast(false));
$('#belt-fast').addEventListener('click', () => setBeltFast(true));
$('#belt-skip').addEventListener('click', () => {
  if (S.mode !== 'belt' || S.grab) return;
  sfx.tap();
  openOrder();
});
$('#belt-leave').addEventListener('click', () => {
  if (S.mode !== 'belt') return;
  sfx.tap();
  leaveRestaurant();
});
$('#order-belt').addEventListener('click', () => {
  if (S.mode !== 'order' || S.rolling) return;
  sfx.tap();
  openBelt();
});

function orderFood(item) {
  if (S.mode !== 'order' && S.mode !== 'belt') return;
  sfx.ding();
  S.item = item;
  const r = S.restaurant;
  disposeFood(S.food);
  disposeFood(S.cohostFood);
  S.food = createFood(item.id, r.accent, item.tint);
  S.food.position.copy(world.interior.plates[0]).add(FOOD_LIFT);
  scene.add(S.food);
  S.cohostFood = createFood(item.id, r.accent, item.tint);
  S.cohostFood.position.copy(world.interior.plates[1]).add(FOOD_LIFT);
  S.cohostFood.rotation.y = 0.6;
  scene.add(S.cohostFood);
  S.foodPop = 0;
  S.bites = 0;
  UI.show('#screen-order', false);
  UI.show('#screen-belt', false);
  startReview();
}

// Mystery Plate: a random item from this menu, usually with a silly twist (2 times in 3).
function rollMystery(r) {
  const base = pick(r.menu);
  if (randInt(3) === 2) return base;
  const twist = pick(MYSTERY_TWISTS);
  return { ...base, name: `${twist.word} ${base.name}`, emoji: twist.emoji, react: twist.react, tint: twist.tint, twist: twist.id };
}

function setRolling(on) {
  S.rolling = on;
  $('#order-surprise').classList.toggle('rolling', on);
}

function orderSurprise() {
  if (S.mode !== 'order' || S.rolling) return;
  setRolling(true);
  sfx.drumroll();
  const item = rollMystery(S.restaurant);
  later(() => {
    setRolling(false);
    if (S.mode !== 'order') return;
    orderFood(item);
    UI.toast(`🎲 Surprise! ${item.emoji} ${item.name}!`, 3200);
  }, 700);
}
$('#order-surprise').addEventListener('click', orderSurprise);

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
  // Emotes can replace the bite pose before its held food and timers finish.
  if (who.heldItem || who.emote === 'bite') return;
  who.playEmote('bite');
  const mini = createFood(S.item.id, undefined, S.item.tint);
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
    foodReaction(who);
  }, 950);
}

/** Spicy, sour, cold or a Mystery Plate twist: whoever took the bite reacts to it. */
function foodReaction(who) {
  const kind = S.item?.react;
  if (!kind || S.mode !== 'review') return;
  who.playEmote(kind);
  if (who !== player) return;
  net.sendEmote(kind);
  (sfx[kind] || sfx.sparkle)();
  if (S.bites === 1) UI.toast(FOOD_REACTIONS[kind].toast);
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
  const before = S.progress;
  S.reviews = addReview(S.reviews, { rid: r.id, fid: S.item.id, food: S.item.name, emoji: S.item.emoji, mood, stars, ts: Date.now() });
  S.progress = passportProgress(S.reviews);
  // passport prizes are handed out once we are back in the plaza
  if (!before.stickers.includes(r.id) && S.progress.stickers.includes(r.id)) S.newSticker = r;
  S.rewards.push(...S.progress.badges.filter((b) => b.earned && !before.badges.find((x) => x.id === b.id).earned));
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
  setRolling(false);
  fade(() => {
    const r = S.restaurant;
    disposeFood(S.food);
    disposeFood(S.cohostFood);
    S.food = S.cohostFood = null;
    S.grab = null;
    belt.unload();
    UI.show('#screen-belt', false);
    cohost.root.visible = false;
    player.pose = 'stand';
    player.labelSprite.visible = true;
    player.holdCamera(false);
    player.setHeldItem(null);
    // step out of the door toward the plaza
    const out = r.door.clone().multiplyScalar((r.door.length() - 4.5) / r.door.length());
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
  }).then(celebrate);
}

// ---------------------------------------------------------------- passport prizes
/** Back in the plaza: show off a new sticker, then any new badges (each unlocks a hat). */
function celebrate() {
  if (S.mode !== 'plaza') return;
  const r = S.newSticker;
  S.newSticker = null;
  if (r) {
    sfx.sparkle();
    UI.toast(`🎫 New sticker: ${r.sticker} ${r.name}!`, 3000);
  }
  if (S.rewards.length) later(showReward, r ? 1500 : 400);
}

function showReward() {
  if (!S.rewards.length) return;
  if (S.mode !== 'plaza') {
    // busy in the closet, the scrapbook or on the slide: try again in a moment
    // (inside a restaurant there is no need, leaving it calls celebrate again)
    if (!S.restaurant) later(showReward, 1200);
    return;
  }
  S.mode = 'reward';
  player.speed = 0;
  S.vel.set(0, 0, 0);
  showHud(false);
  UI.buildReward(S.rewards[0]);
  UI.show('#screen-reward', true);
  sfx.badge();
  confetti(200);
  player.playEmote('wow');
}

function closeReward(wear) {
  if (S.mode !== 'reward') return;
  const badge = S.rewards.shift();
  UI.show('#screen-reward', false);
  S.mode = 'plaza';
  showHud(true);
  sfx.pop();
  if (wear) {
    updateAppearance({ hat: badge.hat });
    player.playEmote('dance');
  }
  if (S.rewards.length) later(showReward, 600);
}
$('#reward-wear').addEventListener('click', () => closeReward(true));
$('#reward-later').addEventListener('click', () => closeReward(false));

function updateInterior(dt, t) {
  const portrait = innerHeight / innerWidth > 0.9;
  const onBelt = S.mode === 'belt';
  camGoal.copy(onBelt ? BELT_CAM : world.interior.camPos);
  if (portrait) camGoal.z += 2.4;
  if (S.mode === 'order') camGoal.add(ORDER_CAM_OFFSET);
  // a little "hand-held camera" wobble
  camGoal.x += Math.sin(t * 0.7) * 0.04;
  camGoal.y += Math.sin(t * 1.1) * 0.03;
  camera.position.lerp(camGoal, damp(4, dt));
  interiorLook.lerp(onBelt ? BELT_LOOK : world.interior.camTarget, damp(4, dt));
  camera.lookAt(interiorLook);
  belt.raised = onBelt; // it sinks into the floor while you film, so nothing blocks the table
  belt.update(dt);
  updateGrab(dt);
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
  UI.buildBook(reviewStats(S.reviews), S.progress);
  UI.show('#screen-book', true);
}
$('#book-tab-passport').addEventListener('click', () => {
  sfx.tap();
  UI.showBookTab('passport');
});
$('#book-tab-reviews').addEventListener('click', () => {
  sfx.tap();
  UI.showBookTab('reviews');
});
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
    doAction();
  }
  if ((e.key === 'e' || e.key === 'Enter') && !(e.target instanceof HTMLButtonElement)) doAction(false);
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

// Tapping the 3D world closes the emote panel, or grabs a plate off the conveyor belt.
canvas.addEventListener('pointerdown', (e) => {
  UI.show('#emote-panel', false);
  tapBelt(e.clientX, e.clientY);
});

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
  else if (S.mode === 'ride') updateRide(dt);
  else if (S.mode === 'studio') updateStudio(dt);
  else if (['order', 'belt', 'review', 'rate'].includes(S.mode)) updateInterior(dt, time);
  else {
    controls.takeLook();
    player.speed = 0;
    if (!S.restaurant) followCamera(dt);
  }
  // a menu opened in mid-bounce: float back down to the ground
  if (!S.restaurant && S.mode !== 'plaza' && S.mode !== 'ride') updateHeight(dt, false);
  player.update(dt);
  updateRemotes(dt, now);
  world.update(time, S.mode !== 'plaza' ? null : S.near ? S.near.door : S.nearSlide ? world.slide.foot : null);

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
  restaurants: () => world.restaurants.map((r) => ({
    id: r.id, door: { x: r.door.x, z: r.door.z }, center: { x: r.center.x, z: r.center.z }, rot: r.rot, w: r.dims.w, d: r.dims.d,
  })),
  ringRadius: RING_RADIUS,
  worldRadius: WORLD_RADIUS,
  item: () => S.item && { id: S.item.id, name: S.item.name, react: S.item.react || null, twist: S.item.twist || null },
  playerEmote: () => player.emote,
  remoteEmotes: () => [...remotes.values()].map((e) => e.char.emote),
  height: () => S.y,
  bounces: () => S.bounces,
  slides: () => S.slides,
  pads: () => world.pads.map((pad) => ({ x: pad.x, z: pad.z, r: pad.r })),
  slide: () => ({ foot: { x: world.slide.foot.x, z: world.slide.foot.z }, yaw: world.slide.yaw }),
  remoteHeights: () => [...remotes.values()].map((e) => e.char.root.position.y),
  remoteAnims: () => [...remotes.values()].map((e) => e.an),
  remoteHats: () => [...remotes.values()].map((e) => e.char.app.hat),
  hat: () => player.app.hat,
  passport: () => ({ stickers: [...S.progress.stickers], hats: [...S.progress.hats], badges: S.progress.badges.map((b) => ({ id: b.id, have: b.have, need: b.need, earned: b.earned })) }),
  /** The conveyor belt: speed, plus where each plate is on screen (CSS pixels) so a test can tap it. */
  belt: () => ({
    active: belt.active,
    speed: belt.speed,
    plates: belt.plates.filter((p) => !p.taken).map((p) => {
      const v = belt.plateCenter(p, new THREE.Vector3()).project(camera);
      return { id: p.mystery ? 'mystery' : p.item.id, x: ((v.x + 1) / 2) * innerWidth, y: ((1 - v.y) / 2) * innerHeight };
    }),
  }),
  renderInfo: () => ({ calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures }),
  /** Test helper: move the local player (plaza only). */
  teleport: (x, z, yaw) => {
    if (S.mode !== 'plaza') return;
    if (typeof yaw === 'number') S.camYaw = yaw;
    S.y = S.vy = 0;
    S.vel.set(0, 0, 0);
    player.root.position.set(x, 0, z);
    world.resolve(player.root.position);
    followCamera(0, true);
  },
};
