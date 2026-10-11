// End-to-end test: starts the real server on a free port, opens two iPad-like
// touch pages in the same room and checks loading, multiplayer, the joystick,
// the town layout, the playground (bounce pads + slide), restaurant visits, food
// reactions, the sushi conveyor belt, the Mystery Plate, the sticker passport with its hats,
// and Phase 3: scooter, pets, races, the ingredient hunt, missions, the comic camera and the dance party.
import { spawn, execSync } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocket } from 'ws';
import {
  RESTAURANT_IDS, WORLD_LIMIT, HEIGHT_LIMIT, EMOTES, HATS, PETS, LINES, RACE, RACE_LINE, EMOTE_LIMIT, raceDoorSpot, pickRaceTarget,
} from '../public/js/schema.js';
import {
  RESTAURANTS, MYSTERY_TWISTS, FOOD_REACTIONS, BADGES, HAT_INFO, PET_INFO, MISSIONS, FOOD_TAGS, INGREDIENTS, RECIPE_WORDS, RECIPE_DISHES,
  VF_FRAMES, VF_TITLES, COMIC_WORDS, DANCE_MOVES,
} from '../public/js/data.js';
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
    const goIn = async (id, opensOn = 'order') => {
      const door = town.list.find((r) => r.id === id).door;
      const len = Math.hypot(door.x, door.z);
      // hop onto its path, facing the door, then walk
      await A.evaluate(([x, z, yaw]) => window.__t42.teleport(x, z, yaw), [(door.x * (len - 8)) / len, (door.z * (len - 8)) / len, Math.atan2(-door.x, -door.z)]);
      await A.keyboard.down('w');
      const reached = await waitFor(A, (d) => {
        const p = window.__t42.playerPosition();
        return Math.hypot(p.x - d.x, p.z - d.z) < 2.4;
      }, door, 15000);
      await A.keyboard.up('w');
      check(reached, `walked to the ${id} door with W key`);
      check(await A.locator('#btn-go-in').isVisible() && (await A.locator('#go-in-text').textContent()).includes('Go in'), '"Go in!" button appears near the door');
      await A.locator('#btn-go-in').tap({ force: true });
      check(await waitFor(A, (m) => window.__t42.mode() === m, opensOn), `${opensOn === 'belt' ? 'conveyor belt' : 'order screen'} opens`);
    };
    const rateAndLeave = async (stars) => {
      await A.locator('#btn-review-done').tap();
      const mood = await A.locator('.mood-btn.on').textContent();
      await A.locator('.star-btn').nth(stars - 1).tap();
      await A.locator('#rate-save').tap();
      check(await waitFor(A, () => window.__t42.mode() === 'plaza', null, 8000), 'back in the plaza after rating');
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
    await A.locator('#btn-emote').tap();
    const raceBtn = A.locator(`.say-btn[data-line="${RACE_LINE}"]`);
    check(LINES[RACE_LINE] === 'Wanna race?' && (await raceBtn.textContent()).includes('Wanna race?') && await raceBtn.evaluate((b) => b.offsetHeight) >= 56, 'the "Wanna race?" preset is in the emote panel');
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
    const line = await A.evaluate(() => window.__t42.playerPosition());
    await A.keyboard.down('w');
    await sleep(500);
    const jumped = await A.evaluate(() => window.__t42.playerPosition());
    check((await A.evaluate(() => window.__t42.race()?.state)) === 'count' && Math.hypot(jumped.x - line.x, jumped.z - line.z) < 0.2, 'nobody can run before GO');
    check(await waitFor(A, () => window.__t42.race()?.state === 'go', null, 8000), 'GO!');
    check(await waitFor(A, (p) => Math.hypot(window.__t42.playerPosition().x - p.x, window.__t42.playerPosition().z - p.z) > 1, line, 10000), 'after GO the reviewer is off');
    await A.keyboard.up('w');
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
    const foodIds = new Set(RESTAURANTS.flatMap((r) => r.menu.map((m) => m.id)));
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
