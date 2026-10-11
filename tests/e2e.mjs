// End-to-end test: starts the real server on a free port, opens two iPad-like
// touch pages in the same room and checks loading, multiplayer, the joystick,
// the town layout, the playground (bounce pads + slide), restaurant visits, food
// reactions, the sushi conveyor belt, the Mystery Plate, the sticker passport with its hats,
// Phase 3: scooter, pets, races, the ingredient hunt, missions, the comic camera and the dance party,
// and Phase 4: build-your-own pizza and sundae, and a friend as co-host (a table for two).
import { spawn, execSync } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocket } from 'ws';
import {
  RESTAURANT_IDS, WORLD_LIMIT, HEIGHT_LIMIT, EMOTES, HATS, PETS, LINES, RACE, RACE_LINE, EMOTE_LIMIT, TABLE, raceDoorSpot, pickRaceTarget,
  sanitizeBuild, sanitizeTableFood,
} from '../public/js/schema.js';
import {
  RESTAURANTS, MYSTERY_TWISTS, FOOD_REACTIONS, BADGES, HAT_INFO, PET_INFO, MISSIONS, FOOD_TAGS, INGREDIENTS, RECIPE_WORDS, RECIPE_DISHES,
  VF_FRAMES, VF_TITLES, COMIC_WORDS, DANCE_MOVES, BUILDS, BUILD_LOADED, WAIT_EMOTES,
} from '../public/js/data.js';
import { buildItem, buildName, defaultBuild, toggleTopping, randomBuild, tableFood, tableItem, mysteryItem } from '../public/js/build.js';
import { passportProgress } from '../public/js/passport.js';
import { huntLayout, recipeFor, repairHunt, HUNT_SIZE } from '../public/js/hunt.js';
import { newMissions, applyReview, menuGoal, repairMissions } from '../public/js/missions.js';
import { DanceRound, DANCE, DANCE_GAP } from '../public/js/dance.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROOM = `test-room-${Math.floor(1000 + Math.random() * 9000)}`;
let failures = 0;
const ok = (msg) => console.log(`  ✅ ${msg}`);
const bad = (msg) => {
  failures++;
  console.log(`  ❌ ${msg}`);
};
const check = (cond, msg) => (cond ? ok(msg) : bad(msg));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function loadPlaywright() {
  try {
    return await import('playwright');
  } catch {
    console.log('Installing playwright…');
    execSync('npm install --no-save playwright', { cwd: ROOT, stdio: 'inherit' });
    return await import('playwright');
  }
}

async function launch(chromium) {
  const args = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
  try {
    return await chromium.launch({ args });
  } catch (err) {
    if (!/Executable doesn't exist|browserType.launch/i.test(String(err))) throw err;
    console.log('Installing Chromium for Playwright…');
    try {
      execSync('npx playwright install chromium', { cwd: ROOT, stdio: 'inherit' });
      return await chromium.launch({ args });
    } catch {
      console.log('Falling back to system Chrome…');
      return await chromium.launch({ args, channel: 'chrome' });
    }
  }
}

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

async function startServer(port) {
  const child = spawn(process.execPath, ['server/server.js'], {
    cwd: ROOT, env: { ...process.env, PORT: String(port), HOST: '127.0.0.1' }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', (d) => (output += d));
  child.stderr.on('data', (d) => (output += d));
  for (let i = 0; i < 100; i++) {
    if (output.includes('LISTENING')) return child;
    if (child.exitCode !== null) break;
    await sleep(100);
  }
  child.kill();
  throw new Error(`server failed to start:\n${output}`);
}

async function waitFor(page, fn, arg, timeout = 15000) {
  try {
    await page.waitForFunction(fn, arg, { timeout, polling: 100 });
    return true;
  } catch {
    return false;
  }
}

/** Raw WebSocket checks of the server's validation rules. */
async function serverChecks(port) {
  console.log('\n🛡️  Server validation');
  const url = (room) => `ws://127.0.0.1:${port}/ws?room=${room}`;
  const open = (room) => new Promise((resolve, reject) => {
    const ws = new WebSocket(url(room));
    ws.msgs = [];
    ws.on('message', (d) => ws.msgs.push(JSON.parse(String(d))));
    ws.on('open', () => resolve(ws));
    ws.on('error', reject);
    ws.on('unexpected-response', (_req, res) => reject(new Error(`HTTP ${res.statusCode}`)));
  });
  const app = { name: 'Happy Taco', skin: 0.5, hair: '#112233', hairStyle: 'bun', eyes: '#3a7bd5', top: 'hoodie', topColor: '#ff8fc7', jacket: 'none', jacketColor: '#5b8bd6', bottom: 'pants', bottomColor: '#222222', shoes: 'boots', shoesColor: '#7b4a2a' };
  const say = (ws, obj) => ws.send(JSON.stringify(obj));
  const idOf = (ws) => ws.msgs.find((m) => m.t === 'welcome').id;
  /** Everything about tables for two that socket `ws` was sent. */
  const co = (ws, t) => ws.msgs.filter((m) => (t ? m.t === t : /^co/.test(m.t)));
  const keys = (m) => Object.keys(m || {}).sort().join();
  const inside = (ws, rid) => say(ws, { t: 'st', ...raceDoorSpot(rid), ry: 0, an: 'review' }); // filming at that restaurant's door

  // an invite nobody answers (checked at the end: it takes a while to time out)
  const lonely = await open('table-check-2');
  const shy = await open('table-check-2');
  say(lonely, { t: 'hello', app });
  say(shy, { t: 'hello', app: { ...app, name: 'Cozy Muffin' } });
  await sleep(300);
  inside(lonely, 'pasta');
  say(lonely, { t: 'coinv', to: idOf(shy), r: 'pasta' });
  const askedAt = Date.now();

  // bad room code is rejected at upgrade time
  try {
    await open('BAD ROOM!!');
    bad('invalid room code rejected');
  } catch {
    ok('invalid room code rejected');
  }

  const a = await open('valid-check-1');
  const b = await open('valid-check-1');
  a.send(JSON.stringify({ t: 'hello', app }));
  b.send(JSON.stringify({ t: 'hello', app: { ...app, name: 'Free Text Name' } })); // invalid name -> ignored
  await sleep(300);
  check(a.msgs.some((m) => m.t === 'welcome'), 'valid hello gets welcome (a page from before hats existed still connects)');
  check(!b.msgs.some((m) => m.t === 'welcome'), 'hello with non-preset name is rejected');
  b.send(JSON.stringify({ t: 'hello', app: { ...app, name: 'Silly Pickle', evil: '<script>' } }));
  await sleep(300);
  const join = a.msgs.find((m) => m.t === 'join');
  check(join && join.app.name === 'Silly Pickle' && !('evil' in join.app) && join.app.hat === 'none' && join.app.pet === 'none', 'unknown fields are dropped on relay');
  b.send(JSON.stringify({ t: 'app', app: { ...app, name: 'Silly Pickle', hat: 'wizard' } }));
  b.send(JSON.stringify({ t: 'app', app: { ...app, name: 'Silly Pickle', hat: 'crown', text: 'hi' } }));
  await sleep(300);
  const apps = a.msgs.filter((m) => m.t === 'app');
  check(apps.length === 1 && apps[0].app.hat === 'crown' && !('text' in apps[0].app), 'hats sync as a preset enum; unknown hats are not relayed');
  b.send(JSON.stringify({ t: 'app', app: { ...app, name: 'Silly Pickle', pet: 'unicorn' } }));
  b.send(JSON.stringify({ t: 'app', app: { ...app, name: 'Silly Pickle', pet: 'dragon', petName: 'Bitey' } }));
  await sleep(300);
  const pets = a.msgs.filter((m) => m.t === 'app').slice(1);
  check(pets.length === 1 && pets[0].app.pet === 'dragon' && !('petName' in pets[0].app), 'pets sync as a preset enum too (no pet names); unknown pets are not relayed');
  b.send(JSON.stringify({ t: 'chat', text: 'hello' }));
  b.send(JSON.stringify({ t: 'say', l: 999 }));
  b.send(JSON.stringify({ t: 'emo', e: 'rude' }));
  b.send(JSON.stringify({ t: 'st', x: 1e9, z: -5, ry: 1, an: 'walk', extra: 1 }));
  await sleep(300);
  check(!a.msgs.some((m) => m.t === 'chat' || m.t === 'say' || (m.t === 'emo' && m.e === 'rude')), 'chat / bad lines / bad emotes are not relayed');
  const st = a.msgs.find((m) => m.t === 'st');
  check(st && st.x === 60 && st.y === 0 && !('extra' in st), 'positions are clamped and extra fields dropped');
  b.send(JSON.stringify({ t: 'st', x: 1, z: 1, ry: 0, an: 'air', y: 999 }));
  b.send(JSON.stringify({ t: 'st', x: 2, z: 1, ry: 0, an: 'slide', y: -4 }));
  b.send(JSON.stringify({ t: 'st', x: 3, z: 1, ry: 0, an: 'air', y: 'high' }));
  b.send(JSON.stringify({ t: 'st', x: 4, z: 1, ry: 0, an: 'fly', y: 1 }));
  b.send(JSON.stringify({ t: 'st', x: 5, z: 1, ry: 0, an: 'scoot', y: 0 }));
  await sleep(300);
  const sts = a.msgs.filter((m) => m.t === 'st');
  check(sts.some((m) => m.an === 'air' && m.y === HEIGHT_LIMIT) && sts.some((m) => m.an === 'slide' && m.y === 0) && !sts.some((m) => m.x === 3 || m.x === 4),
    `bounce / slide heights are clamped to 0–${HEIGHT_LIMIT}; bad heights and unknown moves are not relayed`);
  check(sts.some((m) => m.x === 5 && m.an === 'scoot'), 'riding the scooter is one of the moves the server knows');
  b.send(JSON.stringify({ t: 'emo', e: 'spicy', text: 'free text' }));
  await sleep(300);
  const emo = a.msgs.find((m) => m.t === 'emo');
  check(emo && emo.e === 'spicy' && !('text' in emo), 'food reaction emote is relayed as a bare enum');
  b.send('x'.repeat(5000));
  await sleep(300);
  check(b.readyState !== WebSocket.OPEN, 'oversized (>4KB) message closes the socket');
  a.close();

  // races: the server picks the door, runs the countdown and names the winner
  const c = await open('race-check-1');
  const d = await open('race-check-1');
  c.send(JSON.stringify({ t: 'hello', app }));
  d.send(JSON.stringify({ t: 'hello', app: { ...app, name: 'Silly Pickle' } }));
  await sleep(300);
  const dId = d.msgs.find((m) => m.t === 'welcome').id;
  const at = (ws, x, z, an = 'walk') => ws.send(JSON.stringify({ t: 'st', x, z, ry: 0, an }));
  at(c, 0, 9);
  at(d, 0, 7);
  const go = Date.now() + RACE.countdown * 1000; // when the countdown ends, give or take a few ms
  const until = (ms) => sleep(Math.max(0, go + ms - Date.now()));
  c.send(JSON.stringify({ t: 'race', r: 'mcd', text: 'meet me there', x: 1 }));
  c.send(JSON.stringify({ t: 'race' }));
  d.send(JSON.stringify({ t: 'race' }));
  await sleep(400);
  const starts = d.msgs.filter((m) => m.t === 'race');
  const start = starts[0] || {};
  check(starts.length === 1 && c.msgs.filter((m) => m.t === 'race').length === 1, 'starting a race tells everyone in the room, and there is only one race at a time');
  check(RESTAURANT_IDS.includes(start.r) && Object.keys(start).sort().join() === 'id,r,t', 'a race start carries nothing a player typed or chose: the server picks the door');
  const spot = raceDoorSpot(start.r) || { x: 0, z: 0 };
  check(Math.hypot(spot.x, spot.z - 9) >= RACE.headStart && Math.hypot(spot.x, spot.z - 7) >= RACE.headStart, `the door is a fair run (at least ${RACE.headStart}) from every racer`);
  at(d, spot.x, spot.z);
  await sleep(300);
  check(!c.msgs.some((m) => m.t === 'win'), 'standing at the door before GO does not win (no false starts)');
  at(d, 0, 7);
  await until(200);
  at(c, 1e9, 1e9); // off the map is clamped, not at the door
  at(d, spot.x, spot.z, 'review'); // inside a restaurant: not racing
  at(d, spot.x + 1, spot.z - 1); // at the door 0.2 s after GO: nobody runs that fast
  await sleep(300);
  check(!c.msgs.some((m) => m.t === 'win'), 'being off the map, inside a restaurant, or at the door sooner than anyone could run there does not win');
  const run = Math.hypot(spot.x, spot.z - 7) - RACE.reach; // how far d (who set off from 0, 7) has to go
  await until((run / RACE.topSpeed) * 1000 + 150);
  const newcomer = await open('race-check-1');
  newcomer.send(JSON.stringify({ t: 'hello', app }));
  await sleep(100);
  at(newcomer, spot.x, spot.z);
  await sleep(200);
  check(!c.msgs.some((m) => m.t === 'win'), 'joining after GO cannot use earlier race time to claim an immediate win');
  newcomer.close();
  at(d, spot.x + 1, spot.z - 1);
  await sleep(300);
  const win = c.msgs.find((m) => m.t === 'win');
  check(win && win.id === dId && Object.keys(win).sort().join() === 'id,t' && d.msgs.some((m) => m.t === 'win' && m.id === dId),
    `after a run that could be real (${(run / RACE.topSpeed).toFixed(1)} s for ${run.toFixed(0)} units), the first player at the door wins and everyone is told who`);
  c.send(JSON.stringify({ t: 'race' }));
  d.send(JSON.stringify({ t: 'race' }));
  await sleep(300);
  check(c.msgs.filter((m) => m.t === 'race').length === 1, `the town rests for ${RACE.rest} s after a race, and a player can only start one every ${RACE.cooldown} s`);
  await sleep(RACE.rest * 1000);
  d.send(JSON.stringify({ t: 'race' }));
  await sleep(300);
  const second = c.msgs.filter((m) => m.t === 'race')[1];
  check(second && second.id === dId, 'after the rest another player can start the next race');
  const late = await open('race-check-1');
  late.send(JSON.stringify({ t: 'hello', app: { ...app, name: 'Jolly Waffle' } }));
  await sleep(300);
  const joined = late.msgs.find((m) => m.t === 'welcome')?.race;
  check(joined && second && joined.r === second.r && joined.ms <= RACE.countdown * 1000 && Object.keys(joined).sort().join() === 'ms,r', 'someone who joins mid-race is told about it (door and time to GO, nothing else)');
  c.close();
  d.close();
  late.close();

  // ---- tables for two (friend as co-host): the server runs the session
  console.log('\n👯 Server rules for a table for two');
  const [h, g, x] = [await open('table-check-1'), await open('table-check-1'), await open('table-check-1')];
  say(h, { t: 'hello', app });
  say(g, { t: 'hello', app: { ...app, name: 'Silly Pickle' } });
  say(x, { t: 'hello', app: { ...app, name: 'Jolly Waffle' } });
  await sleep(300);
  const [hId, gId, xId] = [idOf(h), idOf(g), idOf(x)];
  inside(h, 'slice');
  say(g, { t: 'st', x: 0, z: 7, ry: 0, an: 'idle' });
  say(x, { t: 'st', x: 0, z: 9, ry: 0, an: 'walk' });
  say(h, { t: 'coinv', to: gId, r: 'nowhere' }); // not a restaurant
  say(h, { t: 'coinv', to: '<script>', r: 'slice' }); // not an id
  say(h, { t: 'coinv', to: hId, r: 'slice' }); // yourself
  say(h, { t: 'coinv', to: 'AAAAAAAA', r: 'slice' }); // nobody
  say(h, { t: 'coinv', to: gId, r: 'jj' }); // a restaurant the host is not in
  say(x, { t: 'coinv', to: gId, r: 'slice' }); // from someone out in the plaza
  await sleep(300);
  check(co(g).length === 0 && co(h, 'cono').map((m) => m.why).join() === 'gone,gone,wait' && co(x, 'cono').map((m) => m.why).join() === 'wait',
    'an invite must name a real friend and the restaurant the host is filming in: anything else reaches nobody');
  say(h, { t: 'coinv', to: gId, r: 'slice', text: 'come here', s: 'mine' });
  await sleep(300);
  const invite = co(g, 'coinv')[0];
  const sid = invite?.s;
  check(invite && invite.id === hId && invite.r === 'slice' && keys(invite) === 'id,r,s,t' && /^[A-Za-z0-9_-]{6,16}$/.test(sid) && sid !== 'mine',
    'a good invite reaches the friend with a session id the server made, the host and the restaurant (nothing typed)');
  check(keys(co(h, 'coinv')[0]) === 's,t,to' && co(h, 'coinv')[0].s === sid && co(x).length === 1, 'the host is told the session id; nobody else in the room hears about it');
  inside(x, 'jj');
  await sleep(100);
  say(x, { t: 'coinv', to: gId, r: 'jj' }); // g already has an invite to answer
  say(h, { t: 'coinv', to: xId, r: 'slice' }); // h is already waiting for g
  say(x, { t: 'coans', s: sid, a: 'yes' }); // not x's invite
  say(g, { t: 'coans', s: 'nope1234', a: 'yes' }); // not this invite
  say(g, { t: 'coans', s: sid, a: 'maybe' }); // not an answer
  await sleep(300);
  check(co(x, 'cono').pop().why === 'busy' && co(h, 'cono').pop().why === 'wait' && co(h, 'cojoin').length === 0 && co(g).length === 1,
    'one invite at a time: a friend who is being asked is busy, and only that friend can answer, with the right id');
  say(g, { t: 'coans', s: sid, a: 'no', why: 'go away' });
  await sleep(300);
  const no = co(h, 'cono').pop();
  check(no.why === 'no' && no.id === gId && no.s === sid && keys(no) === 'id,s,t,why', 'saying no tells the host so, and nothing more');
  say(h, { t: 'coinv', to: gId, r: 'slice' });
  await sleep(300);
  check(co(h, 'cono').pop().why === 'no' && co(g, 'coinv').length === 1, `no means no: the same friend cannot be asked again for ${TABLE.rest} s`);
  say(x, { t: 'st', x: 0, z: 9, ry: 0, an: 'idle' }); // x walks back out of Jimmy John's
  await sleep(100);
  say(h, { t: 'coinv', to: xId, r: 'slice' });
  await sleep(300);
  const sid2 = co(x, 'coinv')[0]?.s;
  say(x, { t: 'coans', s: sid2, a: 'yes' });
  await sleep(300);
  const seated = co(x, 'cojoin')[0];
  check(seated && sid2 !== sid && seated.s === sid2 && seated.r === 'slice' && seated.seats.join() === `${hId},${xId}` && keys(seated) === 'r,s,seats,t'
    && JSON.stringify(co(h, 'cojoin')[0]) === JSON.stringify(seated) && co(g, 'cojoin').length === 0,
    'saying yes seats the two of them (host first, friend in the co-host chair) under a new session id');
  // the food: only the host chooses, once, from that restaurant's menu or kitchen
  say(x, { t: 'cofood', s: sid2, f: 'cheesepizza' }); // the co-host does not choose
  say(g, { t: 'cofood', s: sid2, f: 'cheesepizza' }); // nor does somebody else
  say(h, { t: 'cofood', s: sid, f: 'cheesepizza' }); // an old session id
  say(h, { t: 'cofood', s: sid2, f: 'sundae' }); // not on this menu
  say(h, { t: 'cofood', s: sid2, f: 'cheesepizza', tw: 'pickle' }); // a twist without a Mystery Plate
  say(h, { t: 'cofood', s: sid2, f: 'cheesepizza', my: true, tw: 'glitter' }); // not a twist
  say(h, { t: 'cofood', s: sid2, b: { k: 'sundae', b: 'mint', t: [] } }); // another restaurant's kitchen
  say(h, { t: 'cofood', s: sid2, b: { k: 'pizza', b: 'tomato', t: ['olive', 'glitter'] } }); // not a topping
  say(h, { t: 'cofood', s: sid2, b: { k: 'pizza', b: 'tomato', t: ['olive', 'corn', 'basil', 'cheese', 'chili'] } }); // too many
  say(h, { t: 'cobite', s: sid2 }); // nothing to bite yet
  say(h, { t: 'codone', s: sid2, n: 5 }); // nothing to rate yet
  await sleep(300);
  check(co(x, 'cofood').length === 0 && co(x, 'cobite').length === 0 && co(h, 'codone').length === 0 && co(g).length === 1, 'food that is not on that restaurant\'s menu, a made-up twist or topping, or a choice by the wrong player is never passed on');
  say(h, { t: 'cofood', s: sid2, b: { k: 'pizza', b: 'pesto', t: ['olive', 'pepperoni'], note: 'x' }, text: 'yum' });
  await sleep(200);
  say(h, { t: 'cofood', s: sid2, f: 'cheesepizza' }); // the choice is made once
  await sleep(300);
  const served = co(x, 'cofood');
  check(served.length === 1 && keys(served[0]) === 'b,s,t' && JSON.stringify(served[0].b) === JSON.stringify({ k: 'pizza', b: 'pesto', t: ['pepperoni', 'olive'] }) && co(g).length === 1,
    'the host\'s choice (here a build-your-own pizza) reaches the co-host once, rebuilt from presets only');
  say(h, { t: 'cobite', s: sid2, text: 'chomp' });
  say(g, { t: 'cobite', s: sid2 });
  say(x, { t: 'codone', s: sid2, n: 9 });
  say(x, { t: 'codone', s: sid2, n: 4, text: 'so good' });
  say(x, { t: 'codone', s: sid2, n: 5 });
  await sleep(300);
  const stars = co(h, 'codone');
  check(keys(co(x, 'cobite')[0]) === 'id,s,t' && co(x, 'cobite').length === 1 && co(x, 'cobite')[0].id === hId && stars.length === 1 && stars[0].n === 4 && stars[0].id === xId
    && keys(stars[0]) === 'id,n,s,t' && co(g).length === 1,
    'bites and star ratings (1 to 5, once each) go to the other player at the table, and to nobody else');
  inside(x, 'slice'); // the co-host has walked in…
  say(x, { t: 'st', x: 0, z: 9, ry: 0, an: 'walk' }); // …and out again
  await sleep(300);
  const over = co(h, 'coend')[0];
  check(over && over.s === sid2 && over.id === xId && keys(over) === 'id,s,t', 'walking out of the restaurant ends the table, and the friend left behind is told');
  say(h, { t: 'cobite', s: sid2 });
  await sleep(200);
  check(co(x, 'cobite').length === 1, 'after that the old session id does nothing');
  // disconnects: x hosts g, then goes away
  inside(x, 'jj');
  await sleep(100);
  say(x, { t: 'coinv', to: gId, r: 'jj' });
  await sleep(300);
  const sid3 = co(g, 'coinv').pop().s;
  say(g, { t: 'coans', s: sid3, a: 'yes' });
  await sleep(300);
  x.close();
  await sleep(300);
  const dropped = co(g, 'coend').pop();
  check(co(g, 'cojoin').length === 1 && dropped && dropped.s === sid3 && dropped.id === xId, 'if one of the two disconnects, the other is told the table is over');
  // an invite that was taken back, and one whose friend went away
  say(g, { t: 'st', x: 0, z: 7, ry: 0, an: 'idle' });
  await sleep(2500); // h has asked twice: after that one more ask is allowed every few seconds
  say(h, { t: 'coinv', to: gId, r: 'slice' });
  await sleep(300);
  check(co(h, 'cono').pop().why === 'no' && co(g, 'coinv').length === 2, 'the friend who said no is still left alone');
  const y = await open('table-check-1');
  say(y, { t: 'hello', app: { ...app, name: 'Brave Mango' } });
  await sleep(300);
  say(h, { t: 'coinv', to: idOf(y), r: 'slice' });
  await sleep(300);
  const sid4 = co(y, 'coinv')[0]?.s;
  say(h, { t: 'coleave', s: sid4 });
  await sleep(300);
  check(sid4 && co(y, 'coend').length === 1 && co(y, 'coend')[0].s === sid4, 'the host can take an invite back: the friend\'s invite goes away');
  say(y, { t: 'coans', s: sid4, a: 'yes' });
  await sleep(300);
  check(co(h, 'cojoin').length === 1 && co(y, 'cojoin').length === 0, 'answering an invite that is gone does nothing');
  say(h, { t: 'coinv', to: idOf(y), r: 'slice' });
  await sleep(300);
  check(co(h, 'cono').pop().why === 'wait' && co(y, 'coinv').length === 1, 'asking, taking it back and asking again does not flash card after card: that friend gets a rest too');
  h.close();
  g.close();
  y.close();
  // however many players ask, one player is only shown so many cards
  const shown = await open('table-check-4');
  say(shown, { t: 'hello', app });
  const askers = [];
  for (let i = 0; i < 4; i++) {
    const ws = await open('table-check-4');
    say(ws, { t: 'hello', app: { ...app, name: 'Brave Mango' } });
    askers.push(ws);
  }
  await sleep(300);
  inside(askers[0], 'jj');
  say(askers[0], { t: 'coinv', to: idOf(shown), r: 'jj' });
  await sleep(150);
  say(shown, { t: 'coans', s: co(shown, 'coinv')[0]?.s, a: 'busy' }); // the friend's game answers for them: no card was shown
  await sleep(150);
  for (const ws of askers) {
    inside(ws, 'jj');
    say(ws, { t: 'coinv', to: idOf(shown), r: 'jj' });
    await sleep(150);
    say(ws, { t: 'coleave', s: co(ws, 'coinv').pop()?.s }); // each asker takes the invite straight back
    await sleep(150);
  }
  check(co(shown, 'coinv').length === 4 && new Set(co(shown, 'coinv').map((m) => m.s)).size === 4 && co(askers[3], 'cono').pop()?.why === 'busy' && co(askers[3], 'coinv').length === 0,
    `one player is shown at most 3 invite cards in a row (then one every ${TABLE.cardEvery} s), whoever asks; invites their game answered "busy" do not count`);
  shown.close();
  askers.forEach((ws) => ws.close());

  // a friend who says yes but never walks in does not keep the chair
  const [w1, w2] = [await open('table-check-3'), await open('table-check-3')];
  say(w1, { t: 'hello', app });
  say(w2, { t: 'hello', app: { ...app, name: 'Zippy Mango' } });
  await sleep(300);
  inside(w1, 'curry');
  say(w1, { t: 'coinv', to: idOf(w2), r: 'curry' });
  await sleep(300);
  say(w2, { t: 'coans', s: co(w2, 'coinv')[0]?.s, a: 'yes' });
  const yesAt = Date.now();

  await sleep(Math.max(0, askedAt + TABLE.inviteTtl * 1000 + 700 - Date.now()));
  const timedOut = co(lonely, 'cono')[0];
  say(shy, { t: 'coans', s: co(shy, 'coinv')[0]?.s, a: 'yes' });
  await sleep(300);
  check(timedOut && timedOut.why === 'timeout' && co(shy, 'coend').length === 1 && co(lonely, 'cojoin').length === 0,
    `an invite nobody answers is over after ${TABLE.inviteTtl} s, for both of them`);
  lonely.close();
  shy.close();
  await sleep(Math.max(0, yesAt + TABLE.seatTtl * 1000 + 700 - Date.now()));
  check(co(w1, 'cojoin').length === 1 && co(w1, 'coend').length === 1 && co(w2, 'coend').length === 1 && co(w2, 'coend')[0].s === co(w1, 'cojoin')[0].s,
    `a friend who says yes but never sits down gives the chair back after ${TABLE.seatTtl} s`);
  // Reporting "review" elsewhere must not keep a chair at this restaurant.
  say(w1, { t: 'coinv', to: idOf(w2), r: 'curry' });
  await sleep(150);
  const wrongSeat = co(w2, 'coinv').pop()?.s;
  say(w2, { t: 'coans', s: wrongSeat, a: 'yes' });
  inside(w2, 'jj');
  await sleep(150);
  check(wrongSeat !== co(w1, 'cojoin')[0].s && co(w1, 'coend').some((m) => m.s === wrongSeat), 'a co-host filming at another restaurant cannot occupy the invited table');
  say(w2, { t: 'st', x: 0, z: 7, ry: 0, an: 'idle' });
  await sleep(100);
  say(w1, { t: 'coinv', to: idOf(w2), r: 'curry' });
  await sleep(150);
  const movedHost = co(w2, 'coinv').pop()?.s;
  say(w2, { t: 'coans', s: movedHost, a: 'yes' });
  inside(w2, 'curry');
  await sleep(100);
  inside(w1, 'jj');
  await sleep(150);
  check(movedHost !== wrongSeat && co(w2, 'coend').some((m) => m.s === movedHost), 'moving away ends a host\'s table even if they keep reporting "review"');
  w1.close();
  w2.close();

  // max 8 per room
  const crowd = [];
  for (let i = 0; i < 9; i++) {
    const ws = await open('crowd-room');
    ws.send(JSON.stringify({ t: 'hello', app }));
    crowd.push(ws);
    await sleep(30);
  }
  await sleep(300);
  check(crowd[8].msgs.some((m) => m.t === 'full'), '9th player gets "room full"');
  crowd.forEach((w) => w.close());
}

async function main() {
  const { chromium, devices } = await loadPlaywright();
  const port = await freePort();
  const server = await startServer(port);
  console.log(`Server on :${port}, room ${ROOM}`);
  let browser;
  try {
    browser = await launch(chromium);
    const ipad = devices['iPad (gen 7) landscape'] || { viewport: { width: 1080, height: 810 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 };
    const ctxOpts = { ...ipad, deviceScaleFactor: 1, hasTouch: true };
    const pages = [];
    const errors = [];
    for (let i = 0; i < 2; i++) {
      const ctx = await browser.newContext(ctxOpts);
      const page = await ctx.newPage();
      page.on('console', (m) => {
        if (m.type() === 'error') errors.push(`[page${i}] console.error: ${m.text()}`);
      });
      page.on('pageerror', (e) => errors.push(`[page${i}] pageerror: ${e.message}`));
      page.on('requestfailed', (r) => errors.push(`[page${i}] request failed: ${r.url()}`));
      await page.goto(`http://127.0.0.1:${port}/?room=${ROOM}`);
      pages.push(page);
    }

    console.log('\n🎮 Loading');
    for (const [i, page] of pages.entries()) {
      check(await waitFor(page, () => window.__t42 && window.__t42.ready), `page${i} game booted`);
      // First launch shows the character creator: Next -> Closet -> Done
      for (let k = 0; k < 3; k++) {
        if (await page.locator('#screen-studio').isHidden()) break;
        await page.locator('#studio-done').tap();
        await sleep(150);
      }
      check(await page.locator('#hud').isVisible(), `page${i} creator closed and HUD visible`);
    }

    console.log('\n👯 Multiplayer');
    for (const [i, page] of pages.entries()) {
      check(await waitFor(page, () => window.__t42.netStatus() === 'online'), `page${i} connected`);
      check(await waitFor(page, () => window.__t42.remotePlayerCount() === 1), `page${i} sees 1 remote player`);
    }

    console.log('\n🕹️  Touch joystick');
    const [A, B] = pages;
    const before = await A.evaluate(() => window.__t42.playerPosition());
    const box = await A.locator('#joystick-base').boundingBox();
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    const cdp = await A.context().newCDPSession(A);
    const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
    await touch('touchStart', cx, cy);
    for (let i = 1; i <= 30; i++) {
      await touch('touchMove', cx, cy - Math.min(70, i * 6));
      await sleep(40);
    }
    await touch('touchEnd');
    await sleep(200);
    const after = await A.evaluate(() => window.__t42.playerPosition());
    const moved = Math.hypot(after.x - before.x, after.z - before.z);
    check(moved > 1, `player moved with touch joystick (${moved.toFixed(2)} units)`);
    check(after.z < before.z, 'pushing up walks forward (away from camera)');
    const seen = await waitFor(B, (target) => {
      const r = window.__t42.remotePositions()[0];
      return r && Math.hypot(r.x - target.x, r.z - target.z) < 0.5;
    }, after, 5000);
    check(seen, 'other player sees the movement (synced + interpolated)');

    console.log('\n🏘️  Town of 20');
    const town = await A.evaluate(() => ({ list: window.__t42.restaurants(), ring: window.__t42.ringRadius, edge: window.__t42.worldRadius }));
    const MADE_UP = {
      sakura: 'Sakura Sushi', slice: 'Slice Squad', donut: 'Donut Workshop', boba: 'Bubble Tea Bay', sundae: 'Sundae Funday',
      noodle: 'Noodle Ninja', seoul: 'Seoul Bites', curry: 'Curry Castle', pasta: 'Pasta Porch', sunny: 'Sunny Breakfast Cafe',
      fish: 'Fish & Ships', pita: 'Pita Picnic', bbq: 'Cozy BBQ',
    };
    check(RESTAURANTS.length === 20 && Object.entries(MADE_UP).every(([id, name]) => RESTAURANTS.find((r) => r.id === id)?.name === name),
      `the 13 made-up restaurants are in the data (${RESTAURANTS.length} total)`);
    check(RESTAURANT_IDS.join() === RESTAURANTS.map((r) => r.id).join() && town.list.map((r) => r.id).join() === RESTAURANT_IDS.join(),
      'schema RESTAURANT_IDS and the 3D town both come from the restaurant data');
    check(town.ring > 35 && town.edge > town.ring + 5 && town.edge < WORLD_LIMIT, `ring ${town.ring} / walkable edge ${town.edge} fit under server limit ${WORLD_LIMIT}`);
    let closest = Infinity;
    for (const a of town.list) for (const b of town.list) if (a !== b) closest = Math.min(closest, Math.hypot(a.door.x - b.door.x, a.door.z - b.door.z));
    check(closest > 11.5 && town.list.every((r) => Math.hypot(r.door.x, r.door.z) < town.ring), `every door is on the ring with room between buildings (closest ${closest.toFixed(1)})`);
    // neighbours must not touch: separating-axis test on the building footprints
    const axes = (b) => [[Math.cos(b.rot), -Math.sin(b.rot)], [Math.sin(b.rot), Math.cos(b.rot)]];
    const reach = (b, [ax, az]) => {
      const [u, v] = axes(b);
      return (b.w / 2) * Math.abs(ax * u[0] + az * u[1]) + (b.d / 2) * Math.abs(ax * v[0] + az * v[1]);
    };
    const apart = (a, b) => [...axes(a), ...axes(b)].some((ax) => Math.abs((b.center.x - a.center.x) * ax[0] + (b.center.z - a.center.z) * ax[1]) > reach(a, ax) + reach(b, ax));
    const touching = town.list.filter((r, i) => !apart(r, town.list[(i + 1) % town.list.length])).map((r) => r.id);
    check(touching.length === 0, `no two neighbouring buildings overlap${touching.length ? ` (${touching})` : ''}`);
    const clamped = await A.evaluate(() => {
      const here = window.__t42.playerPosition();
      window.__t42.teleport(500, -500);
      const far = window.__t42.playerPosition();
      window.__t42.teleport(here.x, here.z);
      return Math.hypot(far.x, far.z);
    });
    check(clamped <= town.edge + 0.01, `walking off the map stops at the edge (${clamped.toFixed(1)})`);
    const foods = await A.evaluate(async () => {
      const { RESTAURANTS: list, MYSTERY_TWISTS: twists } = await import('/js/data.js');
      const { hasFoodModel, createFood } = await import('/js/food.js');
      const ids = [...new Set(list.flatMap((r) => r.menu.map((m) => m.id)))];
      const meshes = (g) => {
        let n = 0;
        g.traverse((o) => (n += o.isMesh ? 1 : 0));
        return n;
      };
      return {
        count: ids.length,
        missing: ids.filter((id) => !hasFoodModel(id) || !meshes(createFood(id))),
        mostMeshes: Math.max(...ids.map((id) => meshes(createFood(id)))),
        untinted: twists.filter((t) => !meshes(createFood(ids[0], undefined, t.tint))).map((t) => t.id),
      };
    });
    check(foods.count >= 71 && foods.missing.length === 0, `all ${foods.count} foods have their own 3D model${foods.missing.length ? ` (missing: ${foods.missing})` : ''}`);
    check(foods.mostMeshes <= 16 && foods.untinted.length === 0, `food models are merged (≤${foods.mostMeshes} draw calls each) and every Mystery twist builds`);
    const perf = await A.evaluate(() => window.__t42.renderInfo());
    check(perf.calls < 120 && perf.triangles < 110000, `town stays light for iPad (${perf.calls} draw calls, ${perf.triangles} triangles)`);

    console.log('\n🎪 Playground: bounce pads + slide');
    const play = await A.evaluate(() => ({ pads: window.__t42.pads(), slide: window.__t42.slide() }));
    check(play.pads.length >= 5 && play.pads.every((pad) => Math.hypot(pad.x, pad.z) < town.ring - 6), `${play.pads.length} bounce pads in the plaza and the grass`);
    // (generous timeouts: software rendering can run the game several times slower than an iPad does)
    const sawBounce = waitFor(B, () => window.__t42.remoteAnims().includes('air') && Math.max(...window.__t42.remoteHeights()) > 1.5, null, 30000);
    await A.evaluate(([x, z]) => window.__t42.teleport(x, z), [play.pads[0].x, play.pads[0].z]);
    check(await waitFor(A, () => window.__t42.height() > 2.5, null, 20000), 'stepping on a bounce pad launches the player');
    check(await sawBounce, 'the friend sees the bounce (height is synced)');
    check(await waitFor(A, () => window.__t42.bounces() >= 2, null, 30000), 'staying on the pad keeps bouncing');
    await A.evaluate(([x, z, yaw]) => window.__t42.teleport(x, z, yaw), [play.slide.foot.x, play.slide.foot.z, play.slide.yaw + Math.PI]);
    check(await waitFor(B, () => Math.max(...window.__t42.remoteHeights()) < 0.05, null, 15000), 'off the pad, the friend sees the player back on the ground');
    check(await waitFor(A, () => document.querySelector('#go-in-text').textContent.includes('Slide') && !document.querySelector('#btn-go-in').classList.contains('hidden'), null, 4000),
      'a "Slide!" button appears at the foot of the slide');
    const slideBtn = await A.locator('#btn-go-in').evaluate((b) => ({ w: b.offsetWidth, h: b.offsetHeight }));
    check(slideBtn.h >= 56 && slideBtn.w >= 56 && (await A.locator('#action-label').textContent()) === 'Slide!', `it is a big touch target (${slideBtn.h}px tall) and the action button says "Slide!" too`);
    const sawSlide = waitFor(B, () => window.__t42.remoteAnims().includes('slide') && Math.max(...window.__t42.remoteHeights()) > 1, null, 60000);
    await A.locator('#btn-go-in').tap({ force: true });
    check(await waitFor(A, () => window.__t42.mode() === 'ride' && window.__t42.height() > 3, null, 30000), 'the player climbs the stairs to the top');
    check(await sawSlide, 'the friend watches the ride down the chute');
    check(await waitFor(A, () => window.__t42.mode() === 'plaza' && window.__t42.slides() === 1 && window.__t42.height() === 0, null, 30000), 'whee! the ride ends back on the ground');
    const landed = await A.evaluate(() => window.__t42.playerPosition());
    const rode = Math.hypot(landed.x - play.slide.foot.x, landed.z - play.slide.foot.z);
    check(rode > 10 && Math.hypot(landed.x, landed.z) < town.ring - 5, `the slide carried the player ${rode.toFixed(1)} units, landing clear of the buildings`);

    /** Walk the last few steps to restaurant `id` with the W key (desktop controls) and go in. */
    const goIn = async (id, opensOn = 'order', page = A) => {
      const door = town.list.find((r) => r.id === id).door;
      const len = Math.hypot(door.x, door.z);
      // hop onto its path, facing the door, then walk
      await page.evaluate(([x, z, yaw]) => window.__t42.teleport(x, z, yaw), [(door.x * (len - 8)) / len, (door.z * (len - 8)) / len, Math.atan2(-door.x, -door.z)]);
      await page.keyboard.down('w');
      const reached = await waitFor(page, (d) => {
        const p = window.__t42.playerPosition();
        return Math.hypot(p.x - d.x, p.z - d.z) < 2.4;
      }, door, 15000);
      await page.keyboard.up('w');
      check(reached, `walked to the ${id} door with W key`);
      check(await page.locator('#btn-go-in').isVisible() && (await page.locator('#go-in-text').textContent()).includes('Go in'), '"Go in!" button appears near the door');
      await page.locator('#btn-go-in').tap({ force: true });
      check(await waitFor(page, (m) => window.__t42.mode() === m, opensOn), `${opensOn === 'belt' ? 'conveyor belt' : 'order screen'} opens`);
    };
    const rateAndLeave = async (stars, page = A) => {
      await page.locator('#btn-review-done').tap();
      const mood = await page.locator('.mood-btn.on').textContent();
      await page.locator('.star-btn').nth(stars - 1).tap();
      await page.locator('#rate-save').tap();
      check(await waitFor(page, () => window.__t42.mode() === 'plaza', null, 8000), 'back in the plaza after rating');
      return mood;
    };
    /** Wait for a plate to glide into the middle of the screen, then tap it on the 3D canvas. */
    const tapPlate = async (want) => {
      const { width } = A.viewportSize();
      const inReach = ([w, lo, hi]) => window.__t42.belt().plates.some((p) => (p.id === 'mystery') === w && p.x > lo && p.x < hi);
      const arrived = await waitFor(A, inReach, [want === 'mystery', width * 0.3, width * 0.7], 60000);
      const plate = await A.evaluate(([w, lo, hi]) => window.__t42.belt().plates.find((p) => (p.id === 'mystery') === w && p.x > lo && p.x < hi), [want === 'mystery', width * 0.3, width * 0.7]);
      if (arrived && plate) await A.touchscreen.tap(plate.x, plate.y);
      return plate;
    };

    console.log('\n🍣 Sakura Sushi: conveyor belt, then the menu');
    const sushi = RESTAURANTS[0];
    await goIn(sushi.id, 'belt');
    check(sushi.id === 'sakura' && sushi.belt && await A.locator('#screen-belt').isVisible(), 'Sakura Sushi (first restaurant, straight ahead of the spawn) opens on its conveyor belt');
    const beltUi = await A.evaluate(() => ['#belt-slow', '#belt-fast', '#belt-skip', '#belt-leave'].map((sel) => document.querySelector(sel).offsetHeight));
    check(beltUi.every((px) => px >= 56), `relaxed / fast / skip / leave are big touch targets (${Math.min(...beltUi)}px tall)`);
    const riding = await A.evaluate(() => window.__t42.belt());
    check(riding.active && riding.plates.length === 8 && sushi.menu.every((m) => riding.plates.some((p) => p.id === m.id)) && riding.plates.filter((p) => p.id === 'mystery').length === 1,
      'every sushi item rides the belt, plus one Mystery Plate dome');
    await sleep(600); // let a frame of the belt be drawn (the first reading can still be the plaza's)
    const beltPerf = await A.evaluate(() => window.__t42.renderInfo());
    check(beltPerf.calls < 120 && beltPerf.triangles > 20000, `the belt stays light for iPad (${beltPerf.calls} draw calls)`);
    await A.locator('#belt-fast').tap();
    const fast = await A.evaluate(() => ({ speed: window.__t42.belt().speed, on: document.querySelector('#belt-fast').classList.contains('on') }));
    await A.locator('#belt-slow').tap();
    const slow = await A.evaluate(() => ({ speed: window.__t42.belt().speed, on: document.querySelector('#belt-slow').classList.contains('on') }));
    check(fast.on && slow.on && fast.speed > slow.speed * 2 && slow.speed === riding.speed, `relaxed and fast belt speeds (${slow.speed} / ${fast.speed})`);
    const x0 = (await A.evaluate(() => window.__t42.belt().plates[0])).x;
    await sleep(500);
    const x1 = (await A.evaluate(() => window.__t42.belt().plates[0])).x;
    check(x1 !== x0, 'the plates glide along the belt');
    await A.locator('#belt-skip').tap();
    check(await waitFor(A, () => window.__t42.mode() === 'order') && await A.locator('#screen-belt').isHidden(), 'the skip button opens the ordinary menu instead');
    check((await A.locator('#order-rest').textContent()) === 'Sakura Sushi' && await A.locator('#order-belt').isVisible(), 'the menu has a way back to the belt');
    check(await A.locator('.menu-item').count() === sushi.menu.length, `menu shows all ${sushi.menu.length} sushi items`);
    check(sushi.menu[0].react === 'spicy' && (await A.locator('.menu-item').first().locator('.mi-tag').textContent()) === FOOD_REACTIONS.spicy.tag, 'spicy food is tagged on its menu tile');
    await A.locator('.menu-item').first().tap();
    check(await waitFor(A, () => window.__t42.mode() === 'review'), 'review mode with viewfinder');
    check(await A.locator('.rec-dot').isVisible(), 'REC dot visible');
    await A.evaluate(async () => {
      const { Character } = await import('/js/character.js');
      const setHeldItem = Character.prototype.setHeldItem;
      const trace = { holds: 0, releases: 0 };
      window.__biteTrace = trace;
      window.__restoreHeldItem = () => { Character.prototype.setHeldItem = setHeldItem; };
      Character.prototype.setHeldItem = function (item) {
        trace[item ? 'holds' : 'releases']++;
        return setHeldItem.call(this, item);
      };
      document.querySelector('.rv-emote.bite').click();
      // An emote can replace the bite pose while its food and timers are still active.
      setTimeout(() => {
        document.querySelector('.rv-emote:not(.bite)').click();
        document.querySelector('.rv-emote.bite').click();
      }, 550);
    });
    check(await waitFor(A, () => window.__t42.playerEmote() === 'spicy', null, 4000), 'a bite of wasabi roll makes the reviewer go 🥵 spicy');
    check(await waitFor(B, () => window.__t42.remoteEmotes().includes('spicy'), null, 4000), 'the friend sees the spicy reaction too');
    const biteTrace = await A.evaluate(() => {
      window.__restoreHeldItem();
      delete window.__restoreHeldItem;
      const trace = window.__biteTrace;
      delete window.__biteTrace;
      return trace;
    });
    check(biteTrace.holds === 1 && biteTrace.releases === 1, 'tapping an emote and bite during a bite serves and clears only one held food');
    await A.locator('.rv-line').first().tap();
    await sleep(1200);
    await rateAndLeave(5);
    const saved = await A.evaluate(() => JSON.parse(localStorage.getItem('t42.reviews') || '[]'));
    check(saved.length === 1 && saved[0].stars === 5 && saved[0].rid === 'sakura' && saved[0].fid === sushi.menu[0].id, 'review saved to localStorage (with which food it was)');
    check((await A.evaluate(() => window.__t42.passport().stickers)).join() === 'sakura', 'the first review at a restaurant earns its passport sticker');

    console.log('\n🍱 Grabbing plates off the belt');
    await goIn(sushi.id, 'belt');
    await A.touchscreen.tap(A.viewportSize().width / 2, 200); // the back of the room, not a plate
    await sleep(400);
    check((await A.evaluate(() => window.__t42.mode())) === 'belt', 'tapping away from the plates grabs nothing');
    const plate = await tapPlate('food');
    check(await waitFor(A, () => window.__t42.mode() === 'review', null, 15000), 'tapping a plate on the 3D belt starts the review');
    const grabbed = await A.evaluate(() => window.__t42.item());
    check(plate && grabbed.id === plate.id && sushi.menu.some((m) => m.id === grabbed.id), `the plate that was tapped is the one served: ${grabbed.name}`);
    await rateAndLeave(4);
    await goIn(sushi.id, 'belt');
    await A.evaluate(() => {
      crypto.getRandomValues = (a) => a.fill(0); // the dice land on: first menu item + first twist
    });
    await tapPlate('mystery');
    check(await waitFor(A, () => window.__t42.mode() === 'review', null, 15000), 'the silver dome on the belt is a Mystery Plate');
    await A.evaluate(() => delete crypto.getRandomValues);
    const domed = await A.evaluate(() => window.__t42.item());
    check(domed.id === sushi.menu[0].id && domed.twist === MYSTERY_TWISTS[0].id, `under the dome: "${domed.name}"`);
    await rateAndLeave(3);

    console.log('\n🎲 Mystery Plate');
    const diner = RESTAURANTS.find((r) => r.id === 'sundae');
    await goIn(diner.id);
    // layout size, not boundingBox: the card is still scaling in with its pop animation
    const surprise = await A.locator('#order-surprise').evaluate((b) => ({ w: b.offsetWidth, h: b.offsetHeight }));
    check(surprise.h >= 56 && surprise.w >= 56, `"Surprise me!" button is a big touch target (${surprise.h}px tall)`);
    check(await A.locator('#order-belt').isHidden(), 'only the sushi restaurant offers a conveyor belt');
    // make the dice land on: first menu item + first twist
    await A.evaluate(() => {
      crypto.getRandomValues = (a) => a.fill(0);
    });
    await A.locator('#order-surprise').tap();
    check(await waitFor(A, () => window.__t42.mode() === 'review', null, 5000), 'the Mystery Plate is served after the drum roll');
    await A.evaluate(() => delete crypto.getRandomValues);
    const mystery = await A.evaluate(() => window.__t42.item());
    const twist = MYSTERY_TWISTS[0];
    check(mystery.id === diner.menu[0].id && mystery.twist === twist.id && mystery.name === `${twist.word} ${diner.menu[0].name}`, `silly combo from preset words only: "${mystery.name}"`);
    check(EMOTES.includes(mystery.react) && mystery.react === twist.react, `it comes with a "${mystery.react}" reaction`);
    await A.locator('.rv-emote.bite').tap();
    check(await waitFor(A, (r) => window.__t42.playerEmote() === r, mystery.react, 4000), 'tasting it makes the reviewer go 🤢');
    const mood = await rateAndLeave(2);
    check(mood === '🤢', 'rating starts on the queasy face for a yucky plate');

    console.log('\n🎫 Sticker passport, badges and hats');
    const everyFoodAt = (id) => RESTAURANTS.find((r) => r.id === id).menu.map((m) => ({ rid: id, fid: m.id }));
    const menuMaster = passportProgress(everyFoodAt('slice'));
    const townTour = passportProgress(RESTAURANTS.slice(0, 10).map((r) => ({ rid: r.id, fid: r.menu[0].id })));
    check(passportProgress([]).hats.join() === 'none' && menuMaster.hats.join() === 'none,shades' && townTour.hats.join() === 'none,chef,crown',
      'badge rules: 3 stickers → chef hat, a whole menu → sunglasses, 10 stickers → crown');
    check(BADGES.every((b) => HATS.includes(b.hat) && HAT_INFO[b.hat]) && new Set(BADGES.map((b) => b.hat)).size === HATS.length - 1, 'every hat is the prize of exactly one badge');
    // page B never reviews anything, so its storage is free to experiment on
    const cap = await B.evaluate(async () => {
      const { loadReviews, addReview } = await import('/js/storage.js');
      const mk = (rid, food) => ({ rid, food, emoji: '🍕', mood: '😋', stars: 4, ts: 1 });
      // the very first review is the only one at Jimmy John's; then 320 pizzas
      localStorage.setItem('t42.reviews', JSON.stringify([mk('jj', 'Giant Cookie'), ...Array.from({ length: 320 }, () => mk('slice', 'Cheese Pizza'))]));
      const kept = loadReviews();
      localStorage.removeItem('t42.reviews');
      // storage that refuses to save must not lose this session's reviews
      const setItem = Storage.prototype.setItem;
      Storage.prototype.setItem = () => {
        throw new Error('storage is full');
      };
      const session = addReview(addReview([], mk('jj', 'Giant Cookie')), mk('slice', 'Cheese Pizza'));
      Storage.prototype.setItem = setItem;
      localStorage.removeItem('t42.reviews');
      return { kept: kept.length, jj: kept.filter((r) => r.rid === 'jj').map((r) => r.fid).join(), session: session.length };
    });
    check(cap.kept === 300 && cap.jj === 'cookie', `the review cap (${cap.kept}) drops old repeats, never the only review that earned a sticker`);
    check(cap.session === 2, 'if the device cannot save, reviews still count for this session');
    const sharedStorage = await B.evaluate(async () => {
      const { loadReviews, addReview } = await import('/js/storage.js');
      const { passportProgress } = await import('/js/passport.js');
      const { RESTAURANT_BY_ID } = await import('/js/data.js');
      const mk = (rid, index, ts) => {
        const item = RESTAURANT_BY_ID[rid].menu[index];
        return { rid, fid: item.id, food: item.name, emoji: item.emoji, mood: '😋', stars: 4, ts };
      };
      const setItem = Storage.prototype.setItem;
      try {
        const tabA = loadReviews();
        const tabB = loadReviews();
        const first = addReview(tabA, mk('jj', 2, 1));
        addReview(tabB, mk('slice', 0, 3));
        const twoTabs = loadReviews().length;
        // A failed save in the stale tab must survive another tab's next save.
        Storage.prototype.setItem = () => { throw new Error('storage is full'); };
        const unsaved = addReview(first, mk('sakura', 0, 2));
        Storage.prototype.setItem = setItem;
        addReview(loadReviews(), mk('curry', 0, 4));
        const recovered = addReview(unsaved, mk('slice', 1, 5));
        const progress = passportProgress(recovered);
        const persisted = loadReviews();
        // Identical reviews are separate ratings; merging must retain their count.
        localStorage.removeItem('t42.reviews');
        const repeat = mk('jj', 2, 1);
        const twice = addReview(addReview([], repeat), { ...repeat });
        const repeats = addReview(twice, mk('slice', 0, 2)).length;
        return { twoTabs, recovered: recovered.length, persisted: persisted.length,
          order: recovered.map((r) => r.ts).join(), stickers: progress.stickers.length, repeats };
      } finally {
        Storage.prototype.setItem = setItem;
        localStorage.removeItem('t42.reviews');
      }
    });
    check(sharedStorage.twoTabs === 2, 'a stale tab keeps reviews saved by another tab');
    check(sharedStorage.recovered === 5 && sharedStorage.persisted === 5 && sharedStorage.order === '1,2,3,4,5' && sharedStorage.stickers === 4,
      'merging tabs preserves unsaved reviews, chronological history and earned stickers without duplicating shared reviews');
    check(sharedStorage.repeats === 3, 'merging shared history preserves separate identical ratings');
    await A.locator('#btn-closet').tap();
    await A.locator('#studio-tabs .tab[data-id="hat"]').tap();
    check(await A.locator('.opt[data-value]').count() === HATS.length && await A.locator('.opt.locked').count() === HATS.length - 1, 'the closet shows every hat, locked until its badge is earned');
    const lockedPx = await A.locator('.opt[data-value="chef"]').evaluate((b) => b.offsetHeight);
    await A.locator('.opt[data-value="chef"]').tap();
    check(lockedPx >= 56 && (await A.evaluate(() => window.__t42.hat())) === 'none', 'tapping a locked hat explains how to earn it instead of wearing it');
    await A.locator('#studio-done').tap();
    // a third restaurant: one of the new buildings, and a new food with a reaction
    const castle = RESTAURANTS.find((r) => r.id === 'curry');
    await goIn(castle.id);
    check((await A.locator('#order-rest').textContent()) === 'Curry Castle' && await A.locator('.menu-item').count() === castle.menu.length, `Curry Castle serves its ${castle.menu.length} foods`);
    await A.locator('.menu-item').nth(castle.menu.findIndex((m) => m.id === 'lassi')).tap();
    check(await waitFor(A, () => window.__t42.mode() === 'review'), 'ordered a mango lassi');
    await A.locator('.rv-emote.bite').tap();
    check(await waitFor(A, () => window.__t42.playerEmote() === 'cold', null, 10000), 'the new foods have reactions too: brain freeze 🥶');
    await rateAndLeave(5);
    check(await waitFor(A, () => window.__t42.mode() === 'reward', null, 20000), 'the third sticker earns a badge');
    check((await A.locator('#reward-name').textContent()) === BADGES[0].name && (await A.locator('#reward-prize').textContent()).includes(HAT_INFO.chef.label), `"${BADGES[0].name}" unlocks the ${HAT_INFO.chef.label}`);
    const rewardPx = await A.evaluate(() => ['#reward-wear', '#reward-later'].map((sel) => document.querySelector(sel).offsetHeight));
    check(rewardPx.every((px) => px >= 56), `the badge buttons are big touch targets (${Math.min(...rewardPx)}px tall)`);
    await A.locator('#reward-wear').tap();
    check(await waitFor(A, () => window.__t42.mode() === 'plaza' && window.__t42.hat() === 'chef'), '"Wear it!" puts the chef hat on');
    check(await waitFor(B, () => window.__t42.remoteHats().includes('chef'), null, 10000), 'the friend sees the hat (synced with the appearance)');
    check((await A.evaluate(() => JSON.parse(localStorage.getItem('t42.appearance')).hat)) === 'chef', 'the hat is saved for next time');
    await A.locator('#btn-closet').tap();
    await A.locator('#studio-tabs .tab[data-id="hat"]').tap();
    check(await A.locator('.opt.locked').count() === HATS.length - 2 && await A.locator('.opt.on[data-value="chef"]').count() === 1, 'the chef hat is now unlocked in the closet');
    await A.locator('.opt[data-value="none"]').tap();
    const hatOff = await A.evaluate(() => window.__t42.hat());
    await A.locator('.opt[data-value="chef"]').tap();
    check(hatOff === 'none' && (await A.evaluate(() => window.__t42.hat())) === 'chef', 'hats can be taken off and put back on');
    await A.locator('#studio-done').tap();

    await A.locator('#btn-reviews').tap();
    check(await A.locator('.sticker').count() === RESTAURANT_IDS.length && await A.locator('.sticker.got').count() === 3, `passport shows 3 of ${RESTAURANT_IDS.length} stickers`);
    const stickerPx = await A.locator('.sticker').first().evaluate((b) => ({ w: b.offsetWidth, h: b.offsetHeight }));
    check(stickerPx.w >= 56 && stickerPx.h >= 56, `stickers are big touch targets (${stickerPx.w}×${stickerPx.h}px)`);
    check(await A.locator('.badge-card').count() === BADGES.length && (await A.locator('.badge-card.earned').getAttribute('data-id')) === BADGES[0].id, 'one badge earned, the others show their progress');
    await A.locator('#book-tab-reviews').tap();
    check(await A.locator('.book-page').count() === RESTAURANT_IDS.length, `scrapbook has a page for all ${RESTAURANT_IDS.length} restaurants`);
    check(await A.locator('.book-page li').count() === 5, 'scrapbook lists all five reviews');
    check((await A.locator('.book-page li .fn').allTextContents()).includes(mystery.name), 'the Mystery Plate is in the scrapbook by name');
    check((await A.locator('#book-summary').textContent()).includes(`3 of ${RESTAURANT_IDS.length} restaurants`), 'scrapbook counts restaurants from the data (no hard-coded 7)');
    await A.locator('#book-close').tap();

    const teleport = (page, x, z, yaw) => page.evaluate(([px, pz, pyaw]) => window.__t42.teleport(px, pz, pyaw), [x, z, yaw]);
    const size = (page, sel) => page.locator(sel).evaluate((b) => Math.min(b.offsetWidth, b.offsetHeight));
    const nameA = await A.evaluate(() => JSON.parse(localStorage.getItem('t42.appearance')).name);

    console.log('\n🛴 Scooter');
    // a clear run: from the fountain, under the welcome arch and down the path beyond it
    await teleport(A, 0, 10, Math.PI);
    await A.keyboard.down('w');
    check(await waitFor(A, () => window.__t42.speed() > 6.5, null, 15000), 'walking gets up to walking speed');
    await sleep(300);
    const walkSpeed = await A.evaluate(() => window.__t42.speed());
    await A.keyboard.up('w');
    await teleport(A, 0, 10, Math.PI);
    check(await size(A, '#btn-scooter') >= 56, `the scooter button is a big touch target (${await size(A, '#btn-scooter')}px)`);
    await A.locator('#btn-scooter').tap();
    check(await A.evaluate(() => window.__t42.scooter() && document.querySelector('#btn-scooter').getAttribute('aria-pressed') === 'true'), 'tapping 🛴 hops on the scooter');
    await A.keyboard.down('w');
    const zoomed = await waitFor(A, (walk) => window.__t42.speed() > walk * 1.4, walkSpeed, 15000);
    const scootSpeed = await A.evaluate(() => window.__t42.speed());
    check(zoomed && walkSpeed < 7.6, `the scooter is faster than walking (${scootSpeed.toFixed(1)} vs ${walkSpeed.toFixed(1)})`);
    check(await waitFor(B, () => window.__t42.remoteAnims().includes('scoot'), null, 5000), 'the friend sees the ride (a new "scoot" move, synced like walking)');
    await A.keyboard.up('w');
    await A.locator('#btn-scooter').tap();
    check(await A.evaluate(() => !window.__t42.scooter()) && await waitFor(B, () => !window.__t42.remoteAnims().includes('scoot'), null, 5000), 'tapping it again hops off, for the friend too');

    console.log('\n🐶 Pet sidekick');
    const petModels = await A.evaluate(async () => {
      const { hasPetModel } = await import('/js/pet.js');
      const { PETS: ids } = await import('/js/schema.js');
      return ids.filter((p) => p !== 'none' && !hasPetModel(p));
    });
    check(PETS.join() === 'none,puppy,kitten,dino,dragon' && PETS.every((p) => PET_INFO[p]) && petModels.length === 0, 'puppy, kitten, dino and dragon each have their own model');
    await teleport(A, 0, 12, 0);
    await A.locator('#btn-closet').tap();
    await A.locator('#studio-tabs .tab[data-id="pet"]').tap();
    check(await A.locator('.opt[data-value]').count() === PETS.length && await A.locator('.opt.on[data-value="none"]').count() === 1, 'the closet has a Pets tab; you start with no pet');
    await A.locator('.opt[data-value="dragon"]').tap();
    check((await A.evaluate(() => window.__t42.pet())) === 'dragon', 'picking the dragon gives you a dragon');
    check(await waitFor(B, () => window.__t42.remotePets().includes('dragon'), null, 10000), 'the friend sees the pet (it is part of the appearance)');
    await A.locator('.opt[data-value="puppy"]').tap();
    await A.locator('#studio-done').tap();
    check((await A.evaluate(() => JSON.parse(localStorage.getItem('t42.appearance')).pet)) === 'puppy', 'the pet is saved for next time');
    check(await waitFor(B, () => window.__t42.remotePets().includes('puppy'), null, 10000), 'swapping pets is synced too');
    await teleport(A, -12, 22, 0);
    check(await waitFor(A, () => window.__t42.petDistance() >= 0 && window.__t42.petDistance() < 3, null, 15000), 'the pet keeps up with its reviewer');

    console.log('\n🏁 Race to a restaurant');
    const doorError = Math.max(...town.list.map((r) => Math.hypot(raceDoorSpot(r.id).x - r.door.x, raceDoorSpot(r.id).z - r.door.z)));
    check(doorError < 0.6 && RACE.reach > doorError + 2.6 - 0.3, `the server knows where every door is without loading the 3D town (off by at most ${doorError.toFixed(2)})`);
    const racers = [{ x: 0, z: 7 }, town.list[0].door, town.list[7].door];
    const picks = Array.from({ length: 200 }, (_, i) => pickRaceTarget(racers, () => i / 200));
    check(new Set(picks).size > 5 && picks.every((rid) => racers.every((p) => Math.hypot(p.x - raceDoorSpot(rid).x, p.z - raceDoorSpot(rid).z) >= RACE.headStart)),
      `a race picks one of ${new Set(picks).size} doors, never one a racer is already close to`);
    await teleport(A, 0, 12, 0);
    await A.locator('#btn-scooter').tap();
    await A.locator('#btn-emote').tap();
    const raceBtn = A.locator(`.say-btn[data-line="${RACE_LINE}"]`);
    check(LINES[RACE_LINE] === 'Wanna race?' && (await raceBtn.textContent()).includes('Wanna race?') && await raceBtn.evaluate((b) => b.offsetHeight) >= 56, 'the "Wanna race?" preset is in the emote panel');
    await A.keyboard.down('d');
    check(await waitFor(A, () => window.__t42.speed() > 10), 'the race starts while the scooter is already moving');
    await A.evaluate(() => {
      window.__raceStart = null;
      const until = performance.now() + 10000;
      const watch = () => {
        if (window.__t42.race()?.state === 'count') window.__raceStart = window.__t42.playerPosition();
        else if (performance.now() < until) requestAnimationFrame(watch);
      };
      requestAnimationFrame(watch);
    });
    await raceBtn.tap();
    check(await waitFor(A, () => window.__t42.race()?.state === 'count', null, 5000), 'saying "Wanna race?" starts a countdown');
    check(await waitFor(B, () => window.__t42.race() !== null, null, 5000), 'the friend is in the race too');
    const [raceA, raceB] = [await A.evaluate(() => window.__t42.race()), await B.evaluate(() => window.__t42.race())];
    check(raceA && raceB && raceA.rid === raceB.rid && !raceA.solo && RESTAURANT_IDS.includes(raceA.rid), `everyone races to the same door: ${RESTAURANTS.find((r) => r.id === raceA?.rid)?.name}`);
    await waitFor(A, () => !document.querySelector('#race-count').classList.contains('hidden'), null, 3000);
    const countUi = await A.evaluate(() => ({
      count: document.querySelector('#race-count').textContent, countShown: !document.querySelector('#race-count').classList.contains('hidden'),
      banner: document.querySelector('#race-text').textContent, bannerShown: !document.querySelector('#race-banner').classList.contains('hidden'),
    }));
    check(countUi.countShown && ['3', '2', '1'].includes(countUi.count) && countUi.bannerShown && countUi.banner.includes(RESTAURANTS.find((r) => r.id === raceA.rid).name),
      `a big "${countUi.count}" counts down under a banner that names the restaurant`);
    const line = await A.evaluate(() => window.__raceStart || window.__t42.playerPosition());
    await A.keyboard.down('w');
    await sleep(500);
    const jumped = await A.evaluate(() => window.__t42.playerPosition());
    check((await A.evaluate(() => window.__t42.race()?.state)) === 'count' && Math.hypot(jumped.x - line.x, jumped.z - line.z) < 0.2, 'the countdown stops existing scooter momentum and held movement');
    await A.keyboard.up('d');
    check(await waitFor(A, () => window.__t42.race()?.state === 'go', null, 8000), 'GO!');
    check(await waitFor(A, (p) => Math.hypot(window.__t42.playerPosition().x - p.x, window.__t42.playerPosition().z - p.z) > 1, line, 10000), 'after GO the reviewer is off');
    await A.keyboard.up('w');
    await A.locator('#btn-scooter').tap();
    const finish = town.list.find((r) => r.id === raceA.rid).door;
    await teleport(A, finish.x, finish.z);
    check(await waitFor(A, () => window.__t42.race() === null && window.__t42.lastRace()?.winner === 'me', null, 12000), 'first to the door wins the race (the server says so) 🏆');
    check(await waitFor(B, (name) => window.__t42.race() === null && window.__t42.lastRace()?.winner === name, nameA, 8000), `the friend is told that ${nameA} won`);
    check(await A.locator('#race-banner').isHidden() && await B.locator('#race-banner').isHidden(), 'the race banner goes away for everyone');
    await teleport(A, 0, 12, 0);
    await A.locator('#btn-emote').tap();
    await raceBtn.tap();
    await sleep(800);
    check((await A.evaluate(() => window.__t42.race())) === null && (await B.evaluate(() => window.__t42.race())) === null, 'a player has to catch their breath before starting another race');

    console.log('\n🔍 Hidden ingredient hunt');
    const hunt0 = huntLayout(0);
    check(hunt0.length === HUNT_SIZE && new Set(hunt0.map((it) => it.id)).size === HUNT_SIZE && hunt0.every((it) => INGREDIENTS.some((i) => i.id === it.id))
      && JSON.stringify(hunt0) === JSON.stringify(huntLayout(0)) && JSON.stringify(huntLayout(1)) !== JSON.stringify(hunt0),
      'every hunt hides six different ingredients, in the same places after a reload, and in new places next time');
    const presetWords = new Set([...RECIPE_WORDS, ...RECIPE_DISHES.map((dsh) => dsh.name), ...INGREDIENTS.map((i) => i.name), '&']);
    const recipes = Array.from({ length: 30 }, (_, n) => recipeFor(n));
    check(recipes.every((r) => r.name.split(' ').every((w) => presetWords.has(w)) && RECIPE_DISHES.some((dsh) => dsh.emoji === r.emoji)), `silly recipes are made of preset words only: "${recipes[0].name}"`);
    check(repairHunt({ n: 2, found: ['<b>', huntLayout(2)[0].id, 7] }).found.join() === huntLayout(2)[0].id && repairHunt('junk').n === 0 && repairHunt({ n: -4 }).n === 0, 'saved hunt progress is checked when it is loaded');
    const noModel = await A.evaluate(async () => {
      const { hasIngredientModel } = await import('/js/ingredients.js');
      const { INGREDIENTS: list } = await import('/js/data.js');
      return list.filter((i) => !hasIngredientModel(i.id)).map((i) => i.id);
    });
    check(INGREDIENTS.length >= HUNT_SIZE && noModel.length === 0, `all ${INGREDIENTS.length} giant ingredients have their own 3D model`);
    const hunting = await A.evaluate(() => window.__t42.hunt());
    check(hunting.n === 0 && hunting.items.length === HUNT_SIZE && hunting.showing === HUNT_SIZE && hunting.items.every((it) => Math.hypot(it.x, it.z) < town.edge)
      && ['grass', 'gap', 'back'].every((w) => hunting.items.filter((it) => it.where === w).length === 2),
      'six ingredients are hidden around town: two in the grass, two between buildings, two behind them');
    check((await A.locator('#hunt-count').textContent()) === `0/${HUNT_SIZE}` && await size(A, '#btn-hunt') >= 56 && await size(A, '#btn-missions') >= 56, 'the hunt and missions buttons are big touch targets');
    await teleport(A, hunting.items[0].x, hunting.items[0].z);
    check(await waitFor(A, () => window.__t42.hunt().found.length === 1, null, 8000), 'walking into a giant ingredient picks it up');
    check((await A.locator('#hunt-count').textContent()) === `1/${HUNT_SIZE}` && (await A.evaluate(() => JSON.parse(localStorage.getItem('t42.quests')).hunt.found.join())) === hunting.items[0].id,
      'the find is counted and saved on this device');
    const friendHunt = await B.evaluate(() => window.__t42.hunt());
    check(friendHunt.found.length === 0 && friendHunt.showing === HUNT_SIZE, "the friend's ingredients are untouched (the hunt is personal)");
    for (const [i, it] of hunting.items.entries()) {
      if (i === 0) continue;
      await teleport(A, it.x, it.z);
      await waitFor(A, (n) => { const h = window.__t42.hunt(); return h.n === 1 || h.found.length === n; }, i + 1, 8000);
    }
    check(await waitFor(A, () => window.__t42.mode() === 'reward', null, 10000), 'finding all six cooks a silly recipe');
    check((await A.locator('#reward-name').textContent()) === recipeFor(0).name && await A.locator('#reward-later').isHidden() && await size(A, '#reward-wear') >= 56,
      `the recipe sticker: "${recipeFor(0).name}"`);
    await A.locator('#reward-wear').tap();
    const hunt1 = await A.evaluate(() => window.__t42.hunt());
    check(hunt1.n === 1 && hunt1.found.length === 0 && hunt1.showing === HUNT_SIZE && (await A.locator('#hunt-count').textContent()) === `0/${HUNT_SIZE}`, 'then a fresh hunt begins');
    check(await waitFor(A, () => window.__t42.mode() === 'plaza', null, 5000), 'back in the plaza');
    await A.locator('#btn-hunt').tap();
    check(await A.locator('#book-tab-hunt.on').count() === 1 && await A.locator('.hunt-item').count() === HUNT_SIZE && await A.locator('.hunt-item.got').count() === 0, 'the 🔍 button opens the hunt page, with picture hints for where to look');
    check(await A.locator('.recipe').count() === 1 && (await A.locator('.recipe').textContent()).includes(recipeFor(0).name), 'the recipe sticker is kept in the scrapbook');
    await A.locator('#book-close').tap();

    console.log('\n🎯 Reviewer missions');
    const foodIds = new Set([...RESTAURANTS.flatMap((r) => r.menu.map((m) => m.id)), ...Object.values(BUILDS).map((b) => b.fid)]);
    check(MISSIONS.length >= 10 && MISSIONS.every((m) => m.pics && m.title && m.need >= 1) && Object.values(FOOD_TAGS).flat().every((id) => foodIds.has(id)),
      `${MISSIONS.length} picture missions, and every food tag points at a real food`);
    const fresh = newMissions();
    const taco = { rid: 'tacobell', fid: 'taco', stars: 3, react: null, mystery: false, isNew: true };
    const crunch = applyReview(fresh, taco);
    check(fresh.active.map((m) => m.id).join() === 'crunchy,three,cold' && crunch.completed.map((m) => m.id).join() === 'crunchy' && crunch.state.done === 1
      && crunch.state.active.length === 3 && !crunch.state.active.some((m) => m.id === 'crunchy') && fresh.done === 0,
      'reviewing something crunchy finishes "Find something crunchy", and a new mission takes its place');
    const sameAgain = applyReview(crunch.state, { ...taco, isNew: false });
    const three = (st) => st.active.find((m) => m.id === 'three').have;
    check(three(crunch.state) === 1 && three(sameAgain.state) === 1 && three(applyReview(sameAgain.state, { ...taco, rid: 'jj', fid: 'chips' }).state) === 2,
      '"3 different restaurants" counts each restaurant once');
    check(menuGoal(fresh, { rid: 'sundae', fid: 'sundae', react: 'cold', isNew: true }) && !menuGoal({ ...fresh, active: [{ id: 'stars', have: 0, seen: [] }] }, taco)
      && JSON.stringify(repairMissions('junk')) === JSON.stringify(fresh)
      && repairMissions({ active: [{ id: 'nope' }, { id: 'three', have: 99, seen: ['<script>', 'jj'] }], done: -1 }).active.map((m) => `${m.id}:${m.have}:${m.seen}`)[0] === 'three:1:jj',
      'menu 🎯 tags follow the missions, and saved mission progress is checked when it is loaded');
    const odd = repairMissions({ active: [{ id: 'constructor' }, { id: '__proto__' }, { id: 'toString', have: 1 }], done: 1, next: 0 });
    check(odd.active.length === 3 && odd.active.every((m) => MISSIONS.some((x) => x.id === m.id)), 'odd saved mission ids (even "constructor") are dropped, not trusted');
    const mine = await A.evaluate(() => window.__t42.missions());
    check(mine.done >= 2 && mine.active.length === 3 && !mine.active.some((m) => m.id === 'three' || m.id === 'cold'), `the reviews filmed so far finished ${mine.done} missions (3 restaurants, a brain freeze…)`);
    await A.locator('#btn-missions').tap();
    const cards = await A.locator('.mission-card').evaluateAll((els) => els.map((el) => ({ id: el.dataset.id, pics: el.querySelector('.ms-pics').textContent, pips: el.querySelectorAll('.ms-pips i').length })));
    check(await A.locator('#book-tab-missions.on').count() === 1 && cards.length === 3 && cards.every((cd) => cd.pics === MISSIONS.find((m) => m.id === cd.id).pics && cd.pips === MISSIONS.find((m) => m.id === cd.id).need),
      `the 🎯 button opens three picture missions: ${cards.map((cd) => cd.pics).join('  ')}`);
    check((await A.locator('.rank-card').textContent()).includes(`${mine.done} missions done`), 'finished missions add up to a reviewer rank');
    await A.locator('#book-close').tap();

    console.log('\n💥 Comic camera');
    const tacoBell = RESTAURANTS.find((r) => r.id === 'tacobell');
    await goIn(tacoBell.id);
    const goals = tacoBell.menu.filter((m) => menuGoal(mine, { rid: tacoBell.id, fid: m.id, react: m.react || null, isNew: true })).map((m) => m.id);
    const tagged = await A.locator('.menu-item:has(.mi-goal)').evaluateAll((els) => els.map((el) => el.dataset.id));
    check(goals.length > 0 && tagged.join() === goals.join(), `foods that count for a mission get a 🎯 on the menu (${tagged.join(', ')})`);
    await A.locator('.menu-item[data-id="taco"]').tap();
    check(await waitFor(A, () => window.__t42.mode() === 'review'), 'ordered a crunchy taco');
    const look = () => A.evaluate(() => ({ frame: document.querySelector('#viewfinder').dataset.frame, show: document.querySelector('#vf-show').textContent, label: document.querySelector('#frame-name').textContent }));
    const plain = await look();
    check(plain.frame === VF_FRAMES[0].id && plain.show === VF_TITLES[0], 'the viewfinder starts with the classic frame and show title');
    check(await size(A, '#btn-frame') >= 56 && await size(A, '#btn-title') >= 56, 'the frame and title buttons are big touch targets');
    await A.locator('#btn-frame').tap();
    await A.locator('#btn-frame').tap();
    await A.locator('#btn-title').tap();
    const fancy = await look();
    check(fancy.frame === VF_FRAMES[2].id && fancy.label.includes(VF_FRAMES[2].label) && fancy.show === VF_TITLES[1], `tapping them picks a preset frame and title: ${fancy.label} / "${fancy.show}"`);
    const popped = (words) => waitFor(A, (list) => {
      const el = document.querySelector('#comic-pop');
      return !el.classList.contains('hidden') && list.includes(el.textContent);
    }, words, 6000);
    await A.locator('.rv-emote.bite').tap();
    check(await popped(COMIC_WORDS.crunchy), `a bite of crunchy taco bursts "${COMIC_WORDS.crunchy[0]}" onto the screen`);
    await sleep(1100);
    await A.locator('.rv-emote').nth(1).tap();
    check(await popped(COMIC_WORDS.yum), `emotes get comic words too: "${COMIC_WORDS.yum[0]}"`);
    check(Object.values(COMIC_WORDS).flat().every((w) => /^[A-Z !]+$/.test(w)) && VF_TITLES.length >= 5 && VF_FRAMES.length >= 5, 'comic words, frames and titles are all preset');
    await rateAndLeave(4);
    const filmed = (await A.evaluate(() => JSON.parse(localStorage.getItem('t42.reviews')))).pop();
    check(filmed.rid === 'tacobell' && filmed.frame === VF_FRAMES[2].id && filmed.title === 1, 'the frame and title are saved with the review');
    check((await A.evaluate(() => JSON.parse(localStorage.getItem('t42.settings')).frame)) === VF_FRAMES[2].id, 'and remembered for the next review');
    await A.locator('#btn-reviews').tap();
    await A.locator('#book-tab-reviews').tap();
    check((await A.locator('.book-page li .deco').allTextContents()).some((t) => t.includes(VF_FRAMES[2].icon) && t.includes(VF_TITLES[1])), 'the scrapbook shows how each review was filmed');
    const pageFits = await A.locator('.book-page').first().evaluate((pg) => pg.querySelector('li').getBoundingClientRect().bottom <= pg.getBoundingClientRect().bottom + 1);
    check(pageFits, 'scrapbook pages are tall enough to read their reviews');
    await A.locator('#book-close').tap();
    // A different tab saved a food this session has not seen yet. It is already tried.
    const beforeNew = await A.evaluate(async () => {
      const { loadReviews, addReview } = await import('/js/storage.js');
      const { RESTAURANT_BY_ID } = await import('/js/data.js');
      const item = RESTAURANT_BY_ID.slice.menu[0];
      addReview(loadReviews(), { rid: 'slice', fid: item.id, food: item.name, emoji: item.emoji, mood: '😋', stars: 4, ts: Date.now() });
      return window.__t42.missions().active.find((m) => m.id === 'new')?.have;
    });
    await goIn('slice');
    await A.locator('.menu-item').first().tap();
    await rateAndLeave(4);
    check(beforeNew !== undefined && (await A.evaluate(() => window.__t42.missions().active.find((m) => m.id === 'new')?.have)) === beforeNew,
      'a food reviewed in another tab does not count as new when a stale tab rates it');
    const junk = await B.evaluate(async () => {
      const { loadReviews, loadSettings, loadQuests } = await import('/js/storage.js');
      localStorage.setItem('t42.reviews', JSON.stringify([{ rid: 'jj', food: 'Giant Cookie', stars: 4, ts: 1, frame: '<img>', title: 99 }]));
      localStorage.setItem('t42.settings', JSON.stringify({ frame: 'evil', title: -3 }));
      localStorage.setItem('t42.quests', JSON.stringify({ hunt: { n: 'x', found: ['<b>'] }, missions: { active: [{ id: 'nope' }], done: -1 }, dance: { best: 'lots' } }));
      const out = { review: loadReviews()[0], settings: loadSettings(), quests: loadQuests() };
      for (const key of ['t42.reviews', 't42.settings', 't42.quests']) localStorage.removeItem(key);
      return out;
    });
    check(junk.review.frame === 'classic' && junk.review.title === 0 && junk.settings.frame === 'classic' && junk.settings.title === 0 && junk.quests.hunt.n === 0
      && junk.quests.hunt.found.length === 0 && junk.quests.missions.active.length === 3 && junk.quests.missions.done === 0 && junk.quests.dance.best === 0 && !JSON.stringify(junk).includes('<'),
      'anything odd in saved decorations or quests falls back to the defaults');

    const tabs = await B.evaluate(async () => {
      const { loadQuests, saveQuests, mergeQuests } = await import('/js/storage.js');
      const { huntLayout: layout } = await import('/js/hunt.js');
      const [first, second] = layout(0).map((it) => it.id);
      try {
        // two tabs open: each finds a different ingredient of the same hunt
        const stale = loadQuests();
        saveQuests({ ...loadQuests(), hunt: { n: 0, found: [first] } });
        stale.hunt.found.push(second);
        const pooled = mergeQuests(stale).hunt.found.length;
        // then the other tab finishes the hunt and two missions and dances; the stale tab scores a 4
        saveQuests({ hunt: { n: 1, found: [] }, missions: { ...loadQuests().missions, done: 2 }, dance: { best: 9 } });
        stale.dance.best = 4;
        const merged = mergeQuests(stale);
        return { pooled, n: merged.hunt.n, found: merged.hunt.found.length, done: merged.missions.done, best: merged.dance.best };
      } finally {
        localStorage.removeItem('t42.quests');
      }
    });
    check(tabs.pooled === 2 && tabs.n === 1 && tabs.found === 0 && tabs.done === 2 && tabs.best === 9, 'a tab opened earlier never undoes quest progress saved by another tab');
    const partial = await B.evaluate(async () => {
      const { loadQuests, saveQuests, mergeQuests } = await import('/js/storage.js');
      const { applyReview } = await import('/js/missions.js');
      const event = (rid) => ({ rid, fid: 'edamame', stars: 3 });
      try {
        const stale = loadQuests();
        const latest = loadQuests();
        latest.missions = applyReview(latest.missions, event('sakura')).state;
        saveQuests(latest);
        const kept = mergeQuests(stale).missions.active.find((m) => m.id === 'three').have;
        stale.missions = applyReview(stale.missions, event('jj')).state;
        const pooled = mergeQuests(stale);
        saveQuests(pooled);
        const unique = mergeQuests(pooled).missions.active.find((m) => m.id === 'three');
        const independent = loadQuests();
        independent.missions = applyReview(stale.missions, event('slice')).state;
        const finished = mergeQuests(independent);
        saveQuests(finished);
        const restored = loadQuests().missions;
        return { kept, have: unique.have, seen: unique.seen, done: restored.done, active: restored.active.map((m) => m.id),
          staleHave: stale.missions.active.find((m) => m.id === 'three').have };
      } finally {
        localStorage.removeItem('t42.quests');
      }
    });
    check(partial.kept === 1 && partial.have === 2 && partial.seen.length === 2 && partial.staleHave === 1,
      'quest merges retain partial mission progress, pool distinct restaurants and count shared progress once');
    check(partial.done === 1 && partial.active.length === 3 && !partial.active.includes('three'),
      'pooled mission progress finishes at its goal, deals a replacement and survives a reload');
    const strangeMove = await B.evaluate(async () => {
      const { Net } = await import('/js/net.js');
      const net = new Net('some-room', {});
      return [net.cleanState({ x: 1, z: 2, ry: 0, an: 'moonwalk' })?.an, net.cleanState({ x: 1, z: 2, ry: 0, an: 7 }), net.cleanRace({ r: 'nowhere', ms: 5 }), net.cleanRace({ r: 'sakura', ms: 1e9 })?.ms];
    });
    check(strangeMove[0] === 'walk' && strangeMove[1] === null && strangeMove[2] === null && strangeMove[3] === RACE.countdown * 1000,
      'the page checks what the server sends too: an unknown move is shown as walking, an unknown race door is ignored');

    console.log('\n💃 Plaza dance party');
    check(DANCE_GAP >= 1 / EMOTE_LIMIT.perSecond && DANCE_GAP - 2 * DANCE.good > 0 && DANCE_MOVES.every((m) => EMOTES.includes(m)),
      `dance moves are ordinary emotes, one every ${DANCE_GAP} s: inside the server's limit of ${EMOTE_LIMIT.perSecond} a second`);
    const round = new DanceRound(() => 0);
    const [p1, p2] = round.prompts;
    check(round.tap(p1.move, p1.at - 1) === null && round.tap(p1.move, p1.at + 0.05) === 'perfect' && round.tap('nope', p2.at) === 'miss'
      && round.advance(999) === DANCE.prompts - 2 && round.hits === 1 && round.stars() === 1 && round.done(999),
      'scoring: on the beat is perfect, the wrong move or no tap is a miss, tapping early does nothing');
    const floor = await A.evaluate(() => window.__t42.danceFloor());
    check(Math.hypot(floor.x, floor.z) + floor.r < 16, 'the dance floor is in the plaza');
    await teleport(A, floor.x, floor.z, 0);
    check(await waitFor(A, () => document.querySelector('#go-in-text').textContent.includes('Dance') && !document.querySelector('#btn-go-in').classList.contains('hidden'), null, 4000),
      'a "Dance!" button appears on the dance floor');
    const emotesBefore = await B.evaluate(() => window.__t42.emotesSeen());
    await A.locator('#btn-go-in').tap({ force: true });
    check(await waitFor(A, () => window.__t42.mode() === 'dance'), 'the dance party starts');
    const moveBtns = await A.locator('.dance-btn').evaluateAll((bs) => bs.map((b) => Math.min(b.offsetWidth, b.offsetHeight)));
    check(moveBtns.length === DANCE_MOVES.length && moveBtns.every((px) => px >= 56) && await size(A, '#dance-stop') >= 56, `three big move buttons (${Math.min(...moveBtns)}px)`);
    // play the whole round: tap the pictured move as each prompt reaches its beat
    const played = await A.evaluate(() => new Promise((resolve) => {
      const tapped = new Set();
      const tick = () => {
        const now = window.__t42.dance();
        if (!now) return resolve(window.__t42.lastDance());
        const p = now.prompt;
        if (p && !tapped.has(p.i) && now.t >= p.at - 0.05) {
          tapped.add(p.i);
          document.querySelector(`.dance-btn[data-move="${p.move}"]`).dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
        }
        return setTimeout(tick, 20);
      };
      tick();
    }));
    check(played && played.total === DANCE.prompts && played.hits >= DANCE.prompts - 3, `tapping the pictured move on the beat scores: ${played?.hits} of ${played?.total}`);
    check(await waitFor(A, () => window.__t42.mode() === 'reward', null, 5000) && (await A.locator('#reward-name').textContent()).includes(`${played.hits} of ${played.total}`), 'a score card shows the result');
    await waitFor(B, ([n, hits]) => window.__t42.emotesSeen() - n >= hits, [emotesBefore, played.hits], 5000);
    const relayed = (await B.evaluate(() => window.__t42.emotesSeen())) - emotesBefore;
    check(relayed === played.hits, `the friend saw every move that landed (${relayed}): none were dropped by the emote rate limit`);
    check((await B.evaluate(() => window.__t42.lastDance())) === null && (await A.evaluate(() => JSON.parse(localStorage.getItem('t42.quests')).dance.best)) === played.hits, 'the score is personal: saved on this device, never sent');
    check((await A.locator('#reward-wear').textContent()).includes('Again') && await size(A, '#reward-later') >= 56, 'the card offers another round');
    await A.locator('#reward-later').tap();
    check(await waitFor(A, () => window.__t42.mode() === 'plaza'), 'back in the plaza');

    console.log('\n🍕 Build your own pizza');
    const kitchens = Object.entries(BUILDS);
    const kitchenWords = (def) => new Set(['My', 'Plain', '&', def.dish, ...def.bases.map((b) => b.word), ...def.toppings.map((t) => t.word), ...Object.values(BUILD_LOADED).flatMap((w) => w.split(' '))]);
    const everyName = kitchens.flatMap(([k, def]) => def.bases.flatMap((b) => [[], ...def.toppings.map((t) => [t.id]), ...def.toppings.flatMap((t) => def.toppings.map((u) => [t.id, u.id])),
      def.toppings.slice(0, 3).map((t) => t.id), def.toppings.slice(-4).map((t) => t.id)].map((t) => sanitizeBuild({ k, b: b.id, t })).filter(Boolean).map((b2) => ({ def, name: buildName(b2) }))));
    check(kitchens.length === 2 && kitchens.every(([k, def]) => RESTAURANTS.filter((r) => r.build === k).length === 1 && def.max >= 3 && def.toppings.length >= 6 && def.bases.length >= 3
      && !RESTAURANTS.some((r) => r.menu.some((m) => m.id === def.fid))),
      `two kitchens, pizza at ${RESTAURANTS.find((r) => r.build === 'pizza').name} and sundae at ${RESTAURANTS.find((r) => r.build === 'sundae').name}, each with preset bases and toppings`);
    check(everyName.length > 300 && everyName.every(({ def, name }) => name.length <= 40 && name.split(' ').every((w) => kitchenWords(def).has(w))),
      `a creation's name is made of preset words only (${everyName.length} tried), e.g. "${buildName({ k: 'pizza', b: 'pesto', t: ['olive', 'corn'] })}"`);
    const junkBuilds = [null, 'pizza', [], { k: 'pizza' }, { k: 'constructor', b: 'tomato', t: [] }, { k: 'pizza', b: 'mint', t: [] }, { k: 'pizza', b: 'tomato', t: 'olive' },
      { k: 'pizza', b: 'tomato', t: ['olive', 'olive'] }, { k: 'pizza', b: 'tomato', t: ['<b>'] }, { k: 'sundae', b: 'mint', t: ['fudge', 'caramel', 'cream', 'cherry', 'banana'] }, { k: 'pizza', b: 'tomato', t: [{}] }];
    check(junkBuilds.every((b) => sanitizeBuild(b) === null) && JSON.stringify(sanitizeBuild({ k: 'pizza', b: 'white', t: ['olive', 'pepperoni'], extra: 1 })) === '{"k":"pizza","b":"white","t":["pepperoni","olive"]}',
      'a build is checked strictly: preset kind, base and toppings, no repeats, no more than fit (extra fields dropped)');
    const full = toggleTopping({ k: 'pizza', b: 'tomato', t: ['pepperoni', 'mushroom', 'olive', 'corn'] }, 'basil');
    const lucky = Array.from({ length: 40 }, (_, i) => randomBuild(i % 2 ? 'pizza' : 'sundae', () => (i * 0.37) % 1));
    check(full.full && full.build.t.length === 4 && toggleTopping(full.build, 'olive').build.t.join() === 'pepperoni,mushroom,corn'
      && lucky.every((b) => b && sanitizeBuild(b) && b.t.length >= 2 && b.t.length <= BUILDS[b.k].max),
      'toppings switch on and off up to the limit, and "Mix it up!" always makes a real build');
    check(buildItem({ k: 'pizza', b: 'tomato', t: ['chili'] }).react === 'spicy' && !buildItem(defaultBuild('pizza')).react && buildItem(defaultBuild('sundae')).react === 'cold'
      && applyReview({ active: [{ id: 'chef', have: 0, seen: [] }], done: 0, next: 0 }, { rid: 'sundae', fid: BUILDS.sundae.fid, stars: 3 }).completed[0]?.id === 'chef',
      'hot peppers make a pizza spicy, a sundae is always cold, and building one finishes the "Build your own" mission');
    const models = await A.evaluate(async () => {
      const { BUILDS: defs } = await import('/js/data.js');
      const { createFood, hasToppingModel, hasFoodModel } = await import('/js/food.js');
      // what a model looks like, in one line: how many corners it has and all its colors added up
      const look = (g) => {
        let n = 0;
        let c = 0;
        g.traverse((o) => {
          if (!o.isMesh) return;
          n += o.geometry.attributes.position.count;
          for (const v of o.geometry.attributes.color?.array || []) c += v;
        });
        return `${n}:${c.toFixed(2)}`;
      };
      const out = { same: [], noModel: [], meshes: 0, triangles: 0 };
      for (const [k, def] of Object.entries(defs)) {
        const make = (b, t) => createFood(def.fid, '#e8590c', null, { k, b, t });
        const plain = look(make(def.bases[0].id, []));
        if (!hasFoodModel(def.fid)) out.noModel.push(def.fid);
        for (const t of def.toppings) {
          if (!hasToppingModel(k, t.id)) out.noModel.push(t.id);
          if (look(make(def.bases[0].id, [t.id])) === plain) out.same.push(t.id);
        }
        for (const b of def.bases.slice(1)) if (look(make(b.id, [])) === plain) out.same.push(b.id);
        for (let i = 0; i + def.max <= def.toppings.length; i++) {
          const loaded = make(def.bases[def.bases.length - 1].id, def.toppings.slice(i, i + def.max).map((t) => t.id));
          let meshes = 0;
          let tris = 0;
          loaded.traverse((o) => {
            meshes += o.isMesh ? 1 : 0;
            tris += o.isMesh ? o.geometry.index.count / 3 : 0;
          });
          out.meshes = Math.max(out.meshes, meshes);
          out.triangles = Math.max(out.triangles, tris);
        }
      }
      return out;
    });
    check(models.same.length === 0 && models.noModel.length === 0, `every topping and every base shows on the 3D food${models.same.length ? ` (no change: ${models.same})` : ''}`);
    check(models.meshes <= 3 && models.triangles < 6000, `a fully loaded creation is still light (${models.meshes} draw calls, ${models.triangles} triangles)`);
    const kitchen = () => A.evaluate(() => window.__t42.kitchen());
    const tapChip = (id, row = 'toppings') => A.locator(`#build-${row} .top-chip[data-id="${id}"]`).tap();
    const pizza = BUILDS.pizza;
    await goIn('slice');
    const tile = A.locator('.menu-item.build');
    check(await tile.count() === 1 && (await tile.textContent()).includes(pizza.title) && await size(A, '.menu-item.build') >= 56
      && await A.locator('.menu-item:not(.build)').count() === RESTAURANTS.find((r) => r.id === 'slice').menu.length,
      `the Slice Squad menu has a "${pizza.title}" tile next to its ordinary foods`);
    await tile.tap();
    check(await waitFor(A, () => window.__t42.mode() === 'build') && await A.locator('#screen-build').isVisible() && await A.locator('#screen-order').isHidden(), 'tapping it opens the kitchen');
    const chips = await A.locator('#build-toppings .top-chip').evaluateAll((els) => els.map((el) => ({ id: el.dataset.id, px: Math.min(el.offsetWidth, el.offsetHeight) })));
    const sauces = await A.locator('#build-bases .top-chip').evaluateAll((els) => els.map((el) => ({ id: el.dataset.id, px: Math.min(el.offsetWidth, el.offsetHeight), on: el.classList.contains('on') })));
    check(chips.map((c) => c.id).join() === pizza.toppings.map((t) => t.id).join() && sauces.map((c) => c.id).join() === pizza.bases.map((b) => b.id).join()
      && [...chips, ...sauces].every((c) => c.px >= 56), `${chips.length} topping chips and ${sauces.length} sauce chips, all preset and all big touch targets (${Math.min(...[...chips, ...sauces].map((c) => c.px))}px)`);
    check(await size(A, '#build-done') >= 56 && await size(A, '#build-back') >= 56 && await size(A, '#build-random') >= 56, 'so are "Review it!", "Mix it up!" and "Back to the menu"');
    const plainPizza = await kitchen();
    check(plainPizza.build.t.length === 0 && plainPizza.name === 'My Plain Pizza' && sauces[0].on && plainPizza.triangles > 100, `it starts as a plain pizza on the 3D plate ("${plainPizza.name}")`);
    await tapChip('pepperoni');
    const one = await kitchen();
    await tapChip('chili');
    const two = await kitchen();
    check(one.build.t.join() === 'pepperoni' && one.name === 'My Pepperoni Pizza' && two.name === 'My Pepperoni & Chili Pizza'
      && new Set([plainPizza.look, one.look, two.look]).size === 3 && await A.locator('#build-toppings .top-chip.on').count() === 2,
      `tapping chips puts the toppings on the 3D pizza: "${two.name}" (${plainPizza.triangles} → ${one.triangles} triangles, and its colors change)`);
    await tapChip('mushroom');
    await tapChip('olive');
    await tapChip('corn'); // a fifth: the plate is full
    const loaded = await kitchen();
    check(loaded.build.t.join() === 'pepperoni,mushroom,olive,chili' && loaded.name === 'My Mega Topping Pizza' && (await A.locator('#build-count').textContent()).includes(`${pizza.max} of ${pizza.max}`)
      && await A.locator('#build-toppings .top-chip.on[data-id="corn"]').count() === 0, `no more than ${pizza.max} toppings fit: a fifth chip is not switched on`);
    await tapChip('mushroom');
    await tapChip('olive');
    await tapChip('pesto', 'bases');
    const green = await kitchen();
    check(green.build.b === 'pesto' && green.build.t.join() === 'pepperoni,chili' && green.name === 'My Pesto Pepperoni & Chili Pizza' && green.look !== two.look && await A.locator('#build-bases .top-chip.on').count() === 1,
      `tapping a chip again takes the topping off, and there is one sauce at a time: "${green.name}"`);
    const kitchenPerf = await A.evaluate(() => window.__t42.renderInfo());
    check(kitchenPerf.calls < 120, `the kitchen stays light for iPad (${kitchenPerf.calls} draw calls)`);
    await A.locator('#build-done').tap();
    check(await waitFor(A, () => window.__t42.mode() === 'review') && await A.locator('#screen-build').isHidden(), '"Review it!" starts the review');
    const myPizza = await A.evaluate(() => window.__t42.item());
    check(myPizza.id === pizza.fid && myPizza.name === green.name && myPizza.react === 'spicy' && JSON.stringify(myPizza.build) === JSON.stringify(green.build), `the creation is what gets reviewed: ${myPizza.name}`);
    await A.locator('.rv-emote.bite').tap();
    check(await waitFor(A, () => window.__t42.playerEmote() === 'spicy', null, 6000) && await waitFor(B, () => window.__t42.remoteEmotes().includes('spicy'), null, 4000),
      'a bite of hot-pepper pizza is spicy 🥵, and the friend sees it');
    await rateAndLeave(5);
    const savedPizza = (await A.evaluate(() => JSON.parse(localStorage.getItem('t42.reviews')))).pop();
    check(savedPizza.rid === 'slice' && savedPizza.fid === pizza.fid && savedPizza.food === green.name && savedPizza.stars === 5 && JSON.stringify(savedPizza.build) === JSON.stringify(green.build),
      'the review is saved with what went on the pizza');

    console.log('\n🍨 Build your own sundae');
    const sundae = BUILDS.sundae;
    await goIn('sundae');
    check((await A.locator('.menu-item.build .mi-tag').textContent()) === FOOD_REACTIONS.cold.tag && (await A.locator('.menu-item.build').textContent()).includes(sundae.title), `Sundae Funday has a "${sundae.title}" tile (tagged cold)`);
    await A.locator('.menu-item.build').tap();
    check(await waitFor(A, () => window.__t42.mode() === 'build') && await A.locator('#build-toppings .top-chip').count() === sundae.toppings.length
      && await A.locator('#build-bases .top-chip').count() === sundae.bases.length && (await kitchen()).name === 'My Vanilla Sundae', `its kitchen has ${sundae.bases.length} ice creams and ${sundae.toppings.length} toppings`);
    await A.locator('#build-random').tap();
    const mixed = await kitchen();
    check(mixed.build.t.length >= 2 && mixed.build.t.length <= sundae.max && sanitizeBuild(mixed.build) !== null && await A.locator('#build-toppings .top-chip.on').count() === mixed.build.t.length,
      `"Mix it up!" picks for you: ${mixed.name}`);
    await A.locator('#build-back').tap();
    check(await waitFor(A, () => window.__t42.mode() === 'order') && (await kitchen()) === null && await A.locator('#screen-build').isHidden(), '"Back to the menu" leaves the kitchen');
    await A.locator('.menu-item.build').tap();
    await waitFor(A, () => window.__t42.mode() === 'build');
    check((await kitchen()).name === 'My Vanilla Sundae', 'coming back starts a fresh sundae');
    await tapChip('chocolate', 'bases');
    await tapChip('fudge');
    await tapChip('cherry');
    const fudgy = await kitchen();
    check(fudgy.name === 'My Chocolate Fudge & Cherry Sundae', `chocolate ice cream, hot fudge and a cherry: "${fudgy.name}"`);
    await A.locator('#build-done').tap();
    check(await waitFor(A, () => window.__t42.mode() === 'review') && (await A.evaluate(() => window.__t42.item())).react === 'cold', 'the sundae goes to the table');
    await A.locator('.rv-emote.bite').tap();
    check(await waitFor(A, () => window.__t42.playerEmote() === 'cold', null, 6000), 'brain freeze 🥶');
    await rateAndLeave(4);
    await A.locator('#btn-reviews').tap();
    await A.locator('#book-tab-reviews').tap();
    const madeChips = await A.locator('.book-page li .made').allTextContents();
    check((await A.locator('.book-page li .fn').allTextContents()).filter((n) => n === green.name || n === fudgy.name).length === 2
      && madeChips.length === 2 && madeChips.some((c) => c.includes('🌶️') && c.includes('🌿')) && madeChips.some((c) => c.includes('🍒')),
      `the scrapbook shows both creations and what went on them (${madeChips.join('  ')})`);
    const bookFits = await A.locator('.book-page li .made').first().evaluate((el) => {
      const page = el.closest('.book-page').getBoundingClientRect();
      const row = el.closest('li').getBoundingClientRect();
      const stars = el.closest('li').querySelector('.st').getBoundingClientRect();
      return row.bottom <= page.bottom + 1 && stars.right <= page.right && stars.left >= page.left;
    });
    check(bookFits, 'a creation with its chips still fits on its scrapbook page');
    await A.locator('#book-close').tap();
    const stored = await B.evaluate(async () => {
      const { loadReviews } = await import('/js/storage.js');
      localStorage.setItem('t42.reviews', JSON.stringify([
        { rid: 'slice', fid: 'mypizza', food: '<b>hax</b>', emoji: '💣', stars: 5, ts: 1, build: { k: 'pizza', b: 'tomato', t: ['olive', 'pepperoni'], x: 1 }, co: 'Happy Taco' },
        { rid: 'slice', fid: 'mypizza', food: 'whatever', stars: 4, ts: 2, build: { k: 'sundae', b: 'mint', t: [] }, co: 'Free Text' },
        { rid: 'jj', fid: 'mypizza', food: 'Giant Cookie', stars: 3, ts: 3, build: { k: 'pizza', b: 'tomato', t: [] }, co: '<img>' },
      ]));
      const out = loadReviews();
      localStorage.removeItem('t42.reviews');
      return out;
    });
    check(stored[0].food === 'My Pepperoni & Olive Pizza' && stored[0].emoji === '🍕' && stored[0].co === 'Happy Taco' && JSON.stringify(stored[0].build) === '{"k":"pizza","b":"tomato","t":["pepperoni","olive"]}'
      && stored[1].food === 'My Plain Pizza' && !('co' in stored[1]) && stored[2].fid === 'cookie' && !('build' in stored[2]) && !JSON.stringify(stored).includes('<'),
      'saved creations are rebuilt from their preset choices when loaded: the name, the toppings and the co-host are never trusted');

    console.log('\n👯 Friend as co-host');
    const slice = RESTAURANTS.find((r) => r.id === 'slice');
    const cheese = slice.menu[0];
    check(JSON.stringify(tableFood(cheese)) === `{"f":"${cheese.id}"}` && tableItem(slice, tableFood(cheese)) === cheese
      && JSON.stringify(tableFood(mysteryItem(cheese, MYSTERY_TWISTS[0]))) === `{"f":"${cheese.id}","my":true,"tw":"${MYSTERY_TWISTS[0].id}"}`
      && tableItem(slice, { f: cheese.id, my: true, tw: MYSTERY_TWISTS[0].id }).name === `${MYSTERY_TWISTS[0].word} ${cheese.name}`
      && tableItem(slice, tableFood(buildItem(green.build))).name === green.name,
      'the food a table shares is sent as ids only (menu id, Mystery twist, or a build) and turned back into the same food');
    check(sanitizeTableFood('slice', { f: 'sundae' }) === null && sanitizeTableFood('slice', { f: cheese.id, tw: 'pickle' }) === null && sanitizeTableFood('nowhere', { f: cheese.id }) === null
      && sanitizeTableFood('jj', { b: green.build }) === null && sanitizeTableFood('slice', { b: fudgy.build }) === null && tableItem(slice, { f: '<b>' }) === null
      && sanitizeTableFood('slice', { f: cheese.id, name: 'x' }) && !('name' in sanitizeTableFood('slice', { f: cheese.id, name: 'x' })),
      'and checked on the way in: it has to be on that restaurant\'s menu or from its own kitchen');
    // give the friend a name of their own, so the two reviewers can be told apart
    await B.locator('#btn-me').tap();
    await B.locator('.chip-btn', { hasText: 'Jolly' }).tap();
    await B.locator('.chip-btn', { hasText: 'Waffle' }).tap();
    await B.locator('#studio-done').tap();
    const nameB = 'Jolly Waffle';
    check(nameA !== nameB && await waitFor(A, (n) => window.__t42.remotePositions()[0]?.name === n, nameB, 8000), `the friend is called ${nameB} (a preset fun name); the host is ${nameA}`);
    const table = (page) => page.evaluate(() => window.__t42.table());
    const toastOn = (page) => page.locator('#toast').textContent();
    /** A, inside a restaurant, asks B to co-host. */
    const invite = async (host = A) => {
      await host.locator('#order-cohost').tap();
      await host.locator('.friend-btn').first().tap();
    };

    await goIn('slice');
    const askBtn = A.locator('#order-cohost');
    check(await askBtn.isVisible() && (await askBtn.textContent()).includes('Invite a co-host') && await size(A, '#order-cohost') >= 56, 'with a friend in town, the menu has an "Invite a co-host" button');
    await askBtn.tap();
    const friends = await A.locator('.friend-btn').evaluateAll((els) => els.map((el) => ({ name: el.textContent, px: el.offsetHeight })));
    check(await A.locator('#screen-cohost').isVisible() && friends.length === 1 && friends[0].name === nameB && friends[0].px >= 56 && await size(A, '#cohost-close') >= 56,
      'it lists the friends in town by their preset names, as big buttons');
    await A.locator('.friend-btn').first().tap();
    check(await waitFor(B, (n) => window.__t42.table().invite?.from === n, nameA, 6000) && (await table(A)).asking === nameB, 'tapping a friend sends the invite');
    const card = await B.evaluate(() => ({
      shown: !document.querySelector('#co-invite').classList.contains('hidden'), text: document.querySelector('#co-invite-text').textContent,
      px: ['#co-invite-yes', '#co-invite-no'].map((sel) => document.querySelector(sel).offsetHeight), rid: window.__t42.table().invite.rid,
    }));
    check(card.shown && card.text.includes(nameA) && card.text.includes(slice.name) && card.rid === 'slice' && card.px.every((px) => px >= 56),
      `the friend gets a card with two big buttons: "${card.text}"`);
    check(await A.locator('#cohost-waiting').isVisible() && (await A.locator('#cohost-waiting-text').textContent()).includes(nameB) && await A.locator('.friend-btn').count() === 1 && await A.locator('#cohost-friends').isHidden(),
      'the host waits for the answer (and can only say "Never mind")');
    await B.locator('#co-invite-yes').tap();
    check(await waitFor(B, () => window.__t42.mode() === 'wait', null, 10000), 'saying yes takes the friend into the restaurant');
    check(await waitFor(A, () => window.__t42.table().co !== null, null, 5000), 'the host is told the friend said yes');
    const [seatA, seatB] = [await table(A), await table(B)];
    check(seatA.seat === 0 && seatA.co.name === nameB && seatA.co.host && seatA.co.sitting && seatA.otherChair === 'friend'
      && seatB.seat === 1 && seatB.co.name === nameA && !seatB.co.host && seatB.co.sitting && seatB.otherChair === 'friend',
      'seat assignment: the host keeps the first chair, the friend takes the co-host chair (instead of the grown-up), on both screens');
    check(await A.locator('#screen-cohost').isHidden() && (await A.locator('#order-cohost').textContent()).includes(nameB) && (await A.evaluate(() => window.__t42.mode())) === 'order', 'the host is back at the menu, which now says who is at the table');
    const waitUi = await B.evaluate(() => ({
      text: document.querySelector('#wait-text').textContent, shown: !document.querySelector('#screen-wait').classList.contains('hidden'),
      px: [...document.querySelectorAll('.wait-emote'), document.querySelector('#wait-leave')].map((el) => Math.min(el.offsetWidth, el.offsetHeight)),
      menu: !document.querySelector('#screen-order').classList.contains('hidden'),
    }));
    check(waitUi.shown && waitUi.text.includes(nameA) && !waitUi.menu && waitUi.px.length === WAIT_EMOTES.length + 1 && waitUi.px.every((px) => px >= 56),
      'while the host chooses, the friend waits with emote buttons only (no menu, nothing to type)');
    await B.locator('.wait-emote').first().tap();
    check(await waitFor(A, (e) => window.__t42.table().co?.emote === e, WAIT_EMOTES[0], 5000), `the friend's ${WAIT_EMOTES[0]} is played by the friend sitting at the host's table`);
    // the host builds a pizza for both of them
    await A.locator('.menu-item.build').tap();
    await waitFor(A, () => window.__t42.mode() === 'build');
    await tapChip('pepperoni');
    await tapChip('chili');
    await A.locator('#build-done').tap();
    check(await waitFor(B, () => window.__t42.mode() === 'review', null, 8000) && await waitFor(A, () => window.__t42.mode() === 'review'), 'when the host has chosen, the review starts for both');
    const [itemA, itemB] = [await A.evaluate(() => window.__t42.item()), await B.evaluate(() => window.__t42.item())];
    check(itemA.id === pizza.fid && JSON.stringify(itemA) === JSON.stringify(itemB) && itemB.name === 'My Pepperoni & Chili Pizza', `shared food choice: both plates get the host's ${itemB.name}`);
    check((await B.locator('#vf-cohost').textContent()).includes(nameA) && (await A.locator('#vf-cohost').textContent()).includes(nameB) && await B.locator('#vf-cohost').isVisible(), 'the viewfinder says who the review is filmed with');
    await A.locator('.rv-emote.bite').tap();
    check(await waitFor(B, () => window.__t42.table().theirs < 0.9, null, 6000) && await waitFor(A, () => window.__t42.table().mine < 0.9, null, 6000), "the host's bite is seen on the friend's screen: the host's pizza gets smaller there too");
    check(await waitFor(B, () => window.__t42.table().co?.emote === 'spicy', null, 6000), 'shared reactions: the friend sees the host go 🥵 at the table');
    check((await table(B)).mine === 1 && (await table(A)).theirs === 1, "the friend's own pizza is untouched");
    await B.locator('.rv-emote.bite').tap();
    check(await waitFor(A, () => window.__t42.table().theirs < 0.9, null, 6000), "and the friend's bite is seen by the host");
    await sleep(1200);
    await B.locator('.rv-emote').nth(1).tap();
    check(await waitFor(A, () => window.__t42.table().co?.emote === 'yum', null, 5000), 'emotes are shared across the table as well');
    // each of the two rates for themselves; the first to finish stays to see the other's stars
    await B.locator('#btn-review-done').tap();
    await B.locator('.star-btn').nth(3).tap();
    await B.locator('#rate-save').tap();
    check(await waitFor(A, () => window.__t42.table().co?.stars === 4, null, 6000) && (await A.evaluate(() => window.__t42.mode())) === 'review', `the host, still filming, is told how many stars ${nameB} gave`);
    const reviewB = (await B.evaluate(() => JSON.parse(localStorage.getItem('t42.reviews')))).pop();
    const beforeA = (await A.evaluate(() => JSON.parse(localStorage.getItem('t42.reviews')))).pop();
    check(reviewB.rid === 'slice' && reviewB.fid === pizza.fid && reviewB.stars === 4 && reviewB.co === nameA && beforeA.co === undefined, "the friend's rating is saved on the friend's device only");
    check(await waitFor(B, () => window.__t42.mode() === 'after', null, 6000) && (await B.locator('#wait-text').textContent()).includes(nameA) && await B.locator('#screen-wait').isVisible()
      && (await table(B)).co !== null && await size(B, '#wait-leave') >= 56, `the friend, who rated first, stays at the table to see what ${nameA} gives it (or can go back outside)`);
    await rateAndLeave(5);
    check(await waitFor(B, () => window.__t42.table().last?.stars === 5, null, 6000), `and is told: ${nameA} gave it 5 stars`);
    const reviewA = (await A.evaluate(() => JSON.parse(localStorage.getItem('t42.reviews')))).pop();
    check(reviewA.rid === 'slice' && reviewA.stars === 5 && reviewA.co === nameB && reviewA.food === reviewB.food && (await B.evaluate(() => JSON.parse(localStorage.getItem('t42.reviews')))).length === 1,
      'each saves their own rating: 5 stars from the host, 4 from the friend');
    check(await waitFor(B, () => window.__t42.mode() === 'plaza', null, 10000) && (await table(A)).last.stars === 4, 'then both are back in town');
    const outside = await B.evaluate(() => window.__t42.playerPosition());
    const sliceDoor = town.list.find((r) => r.id === 'slice').door;
    check(Math.hypot(outside.x - sliceDoor.x, outside.z - sliceDoor.z) < 9 && (await B.evaluate(() => window.__t42.table())).seat === 0, 'the friend comes back out by that restaurant\'s door');
    await A.locator('#btn-reviews').tap();
    await A.locator('#book-tab-reviews').tap();
    check((await A.locator('.book-page li .with').allTextContents()).some((t) => t.includes(nameB)), 'the scrapbook remembers who co-hosted');
    await A.locator('#book-close').tap();

    console.log('\n🚪 Leaving, saying no, and going offline');
    await goIn('tacobell');
    await invite();
    await waitFor(B, () => window.__t42.table().invite !== null, null, 6000);
    await B.locator('#co-invite-yes').tap();
    check(await waitFor(B, () => window.__t42.mode() === 'wait', null, 10000) && await waitFor(A, () => window.__t42.table().co !== null, null, 5000), 'a second table, at Taco Bell');
    await A.locator('#order-leave').tap();
    check(await waitFor(B, () => window.__t42.mode() === 'order' && window.__t42.table().co === null, null, 8000), 'if the host leaves before choosing, the friend gets the menu');
    const tookOver = await table(B);
    check(tookOver.seat === 0 && tookOver.otherChair === 'grownup' && (await B.locator('#order-rest').textContent()) === 'Taco Bell' && await B.locator('#screen-wait').isHidden(),
      'and the table: first chair, with the grown-up co-host opposite');
    await waitFor(A, () => window.__t42.mode() === 'plaza', null, 8000);
    await invite(B);
    check(await waitFor(A, (n) => window.__t42.table().invite?.from === n, nameB, 6000), 'now the friend invites the first reviewer');
    await A.locator('#co-invite-no').tap();
    check(await waitFor(B, () => window.__t42.table().asking === null && document.querySelector('#screen-cohost').classList.contains('hidden'), null, 6000)
      && (await toastOn(B)).includes("can't right now") && (await table(A)).invite === null && await A.locator('#co-invite').isHidden(), '"No thanks" closes the card and tells the friend kindly');
    await invite(B);
    await sleep(900);
    check((await table(A)).invite === null && (await table(B)).asking === null && (await B.evaluate(() => window.__t42.mode())) === 'order', 'asking again straight away does not pop up another card: no means no for a while');
    await B.locator('#order-leave').tap();
    await waitFor(B, () => window.__t42.mode() === 'plaza', null, 8000);
    // busy, then a table that ends because the friend's game goes away
    await goIn('pasta');
    await B.locator('#btn-closet').tap();
    await invite();
    check(await waitFor(A, () => window.__t42.table().asking === null && document.querySelector('#toast').textContent.includes('busy'), null, 6000) && await B.locator('#co-invite').isHidden(),
      'a friend who is in the closet is not interrupted: the host is told they are busy');
    await B.locator('#studio-done').tap();
    await invite();
    await waitFor(B, () => window.__t42.table().invite !== null, null, 6000);
    await B.locator('#co-invite-yes').tap();
    await waitFor(B, () => window.__t42.mode() === 'wait', null, 10000);
    await waitFor(A, () => window.__t42.table().co !== null, null, 5000);
    await A.locator('.menu-item').first().tap();
    check(await waitFor(B, () => window.__t42.mode() === 'review', null, 8000) && (await B.evaluate(() => window.__t42.item())).id === RESTAURANTS.find((r) => r.id === 'pasta').menu[0].id,
      'a third table, at Pasta Porch, with a food from the menu');
    const tablePerf = [await A.evaluate(() => window.__t42.renderInfo()), await B.evaluate(() => window.__t42.renderInfo())];
    check(tablePerf.every((p) => p.calls < 120 && p.triangles < 110000), `a table for two stays light for iPad (${tablePerf.map((p) => p.calls).join(' / ')} draw calls)`);
    // a bite from the friend is still on its way when their game goes away: nothing must be left behind
    await B.locator('.rv-emote.bite').tap();
    await sleep(150);
    await B.reload();
    check(await waitFor(A, () => window.__t42.table().co === null && window.__t42.table().otherChair === 'grownup', null, 10000) && (await A.evaluate(() => window.__t42.mode())) === 'review',
      "disconnect handling: when the friend's game goes away, the grown-up co-host takes the chair and the review goes on");
    await sleep(1500);
    check((await table(A)).theirs >= 0.78 && (await A.evaluate(() => window.__t42.remotePlayerCount())) <= 1, "and the friend's last bite does not go on eating the grown-up's food");
    await rateAndLeave(3);
    check((await A.evaluate(() => JSON.parse(localStorage.getItem('t42.reviews')))).pop().co === nameB, 'that review still remembers the friend it was filmed with');
    check(await waitFor(B, () => window.__t42 && window.__t42.ready, null, 20000), 'the friend comes back to town');
    for (let k = 0; k < 3; k++) {
      if (await B.locator('#screen-studio').isHidden()) break;
      await B.locator('#studio-done').tap();
      await sleep(150);
    }
    check(await waitFor(B, () => window.__t42.netStatus() === 'online' && window.__t42.remotePlayerCount() === 1, null, 15000) && await waitFor(A, () => window.__t42.remotePlayerCount() === 1, null, 15000)
      && (await B.evaluate(() => window.__t42.mode())) === 'plaza' && (await table(B)).co === null, 'and everyone sees each other again');

    console.log('\n⏳ Co-host timing regressions');
    await goIn('jj');
    await A.evaluate(async () => {
      const { Net } = await import('/js/net.js');
      const send = Net.prototype.send;
      Net.prototype.send = function (...args) {
        Net.prototype.send = send;
        window.__reviewNet = this;
        this.ws.close();
      };
    });
    check(await waitFor(A, () => window.__t42.netStatus() === 'offline', null, 6000), 'the host loses the connection while the menu is open');
    check(await waitFor(A, () => window.__t42.netStatus() === 'online' && window.__t42.remotePlayerCount() === 1, null, 10000)
      && await A.locator('#order-cohost').isVisible(), 'reconnecting restores the invite button for friends already in town');

    // Delay the first reply past the local timeout, then deliver both replies in server order.
    await A.evaluate(async (timeoutMs) => {
      const { Net } = await import('/js/net.js');
      const handle = Net.prototype.handle;
      const timeout = window.setTimeout;
      window.__coReplies = [];
      Net.prototype.handle = function (m) {
        if (this === window.__reviewNet && ((m.t === 'coinv' && m.to) || (m.t === 'cono' && !m.s))) window.__coReplies.push(m);
        else handle.call(this, m);
      };
      window.setTimeout = (fn, ms, ...args) => {
        if (ms === timeoutMs) window.__expireAsk = () => fn(...args);
        return timeout(fn, ms, ...args);
      };
      window.__flushCoReplies = () => {
        Net.prototype.handle = handle;
        window.setTimeout = timeout;
        window.__coReplies.forEach((m) => handle.call(window.__reviewNet, m));
      };
    }, (TABLE.inviteTtl + 5) * 1000);
    await invite();
    await waitFor(A, () => window.__coReplies.length === 1, null, 6000);
    await A.evaluate(() => window.__expireAsk());
    await invite();
    await waitFor(A, () => window.__coReplies.length === 2, null, 6000);
    await A.evaluate(() => window.__flushCoReplies());
    check(await waitFor(A, () => window.__t42.table().asking === null, null, 6000)
      && await waitFor(B, () => window.__t42.table().invite === null, null, 6000), 'a late invite reply cancels its expired ask without being assigned to the next ask');
    await A.locator('#order-leave').tap();
    await waitFor(A, () => window.__t42.mode() === 'plaza', null, 8000);

    // Hold the guest's entry fade until all three host messages have arrived.
    await goIn('slice', 'order', B);
    await invite(B);
    await waitFor(A, () => window.__t42.table().invite !== null, null, 6000);
    await A.evaluate(async () => {
      const { Net } = await import('/js/net.js');
      const handle = Net.prototype.handle;
      const timeout = window.setTimeout;
      window.__entryEvents = [];
      Net.prototype.handle = function (m) {
        if (this === window.__reviewNet && ['cofood', 'cobite', 'codone'].includes(m.t)) window.__entryEvents.push(m.t);
        handle.call(this, m);
      };
      window.setTimeout = (fn, ms, ...args) => {
        if (ms !== 360) return timeout(fn, ms, ...args);
        window.setTimeout = timeout;
        const timer = timeout(() => {}, 60000);
        window.__finishEntry = () => {
          clearTimeout(timer);
          Net.prototype.handle = handle;
          fn(...args);
        };
        return timer;
      };
    });
    await A.locator('#co-invite-yes').tap();
    await waitFor(B, () => window.__t42.table().co !== null, null, 6000);
    await waitFor(A, () => !!window.__finishEntry, null, 6000);
    await B.evaluate(() => {
      document.querySelector('.menu-item').click();
      document.querySelector('.rv-emote.bite').click();
      document.querySelector('#btn-review-done').click();
      document.querySelectorAll('.star-btn')[4].click();
      document.querySelector('#rate-save').click();
    });
    check(await waitFor(A, () => window.__entryEvents.length === 3 && window.__t42.mode() === 'transition', null, 6000), 'the host serves, bites and rates before the guest finishes entering');
    await A.evaluate(() => window.__finishEntry());
    check(await waitFor(A, () => window.__t42.mode() === 'review' && window.__t42.table().co?.stars === 5, null, 6000), 'the entering guest receives the host\'s earlier rating');
    check(await waitFor(A, () => Math.abs(window.__t42.table().theirs - 0.78) < 0.001 && window.__t42.table().mine === 1, null, 10000), 'the earlier bite empties only the host\'s plate and survives the food arrival animation');
    await rateAndLeave(4);
    await waitFor(B, () => window.__t42.mode() === 'plaza', null, 10000);

    console.log('\n📱 Still light for iPad');
    await A.locator('#btn-scooter').tap();
    await sleep(600);
    const [busyA, busyB] = [await A.evaluate(() => window.__t42.renderInfo()), await B.evaluate(() => window.__t42.renderInfo())];
    check(busyA.calls < 120 && busyB.calls < 120 && busyA.triangles < 110000 && busyB.triangles < 110000,
      `with a pet, a scooter, the dance floor and the hunt in town: ${busyA.calls} / ${busyB.calls} draw calls, ${busyA.triangles} / ${busyB.triangles} triangles`);

    await A.screenshot({ path: path.join(ROOT, 'test-results', 'plaza.png') }).catch(() => {});

    await serverChecks(port);

    console.log('\n🧹 Console');
    if (errors.length) errors.forEach((e) => bad(e));
    else ok('no console errors or page errors');
  } finally {
    await browser?.close();
    server.kill();
  }
  console.log(failures ? `\n💥 ${failures} check(s) failed` : '\n🎉 All checks passed!');
  process.exit(failures ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
