// End-to-end test: starts the real server on a free port, opens two iPad-like
// touch pages in the same room and checks loading, multiplayer, the joystick,
// the town layout, the playground (bounce pads + slide), restaurant visits, food
// reactions, the sushi conveyor belt, the Mystery Plate and the sticker passport with its hats.
import { spawn, execSync } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocket } from 'ws';
import { RESTAURANT_IDS, WORLD_LIMIT, HEIGHT_LIMIT, EMOTES, HATS } from '../public/js/schema.js';
import { RESTAURANTS, MYSTERY_TWISTS, FOOD_REACTIONS, BADGES, HAT_INFO } from '../public/js/data.js';
import { passportProgress } from '../public/js/passport.js';

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
  check(join && join.app.name === 'Silly Pickle' && !('evil' in join.app) && join.app.hat === 'none', 'unknown fields are dropped on relay');
  b.send(JSON.stringify({ t: 'app', app: { ...app, name: 'Silly Pickle', hat: 'wizard' } }));
  b.send(JSON.stringify({ t: 'app', app: { ...app, name: 'Silly Pickle', hat: 'crown', text: 'hi' } }));
  await sleep(300);
  const apps = a.msgs.filter((m) => m.t === 'app');
  check(apps.length === 1 && apps[0].app.hat === 'crown' && !('text' in apps[0].app), 'hats sync as a preset enum; unknown hats are not relayed');
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
  await sleep(300);
  const sts = a.msgs.filter((m) => m.t === 'st');
  check(sts.some((m) => m.an === 'air' && m.y === HEIGHT_LIMIT) && sts.some((m) => m.an === 'slide' && m.y === 0) && !sts.some((m) => m.x === 3 || m.x === 4),
    `bounce / slide heights are clamped to 0–${HEIGHT_LIMIT}; bad heights and unknown moves are not relayed`);
  b.send(JSON.stringify({ t: 'emo', e: 'spicy', text: 'free text' }));
  await sleep(300);
  const emo = a.msgs.find((m) => m.t === 'emo');
  check(emo && emo.e === 'spicy' && !('text' in emo), 'food reaction emote is relayed as a bare enum');
  b.send('x'.repeat(5000));
  await sleep(300);
  check(b.readyState !== WebSocket.OPEN, 'oversized (>4KB) message closes the socket');
  a.close();

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
    check(perf.calls < 160 && perf.triangles < 110000, `town stays light for iPad (${perf.calls} draw calls, ${perf.triangles} triangles)`);

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
    const beltPerf = await A.evaluate(() => window.__t42.renderInfo());
    check(beltPerf.calls < 160, `the belt stays light for iPad (${beltPerf.calls} draw calls)`);
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
