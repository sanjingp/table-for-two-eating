// End-to-end test: starts the real server on a free port, opens two iPad-like
// touch pages in the same room and checks loading, multiplayer, the joystick,
// the town layout, a restaurant visit, food reactions and the Mystery Plate.
import { spawn, execSync } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocket } from 'ws';
import { RESTAURANT_IDS, WORLD_LIMIT, EMOTES } from '../public/js/schema.js';
import { RESTAURANTS, MYSTERY_TWISTS, FOOD_REACTIONS } from '../public/js/data.js';

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
  check(a.msgs.some((m) => m.t === 'welcome'), 'valid hello gets welcome');
  check(!b.msgs.some((m) => m.t === 'welcome'), 'hello with non-preset name is rejected');
  b.send(JSON.stringify({ t: 'hello', app: { ...app, name: 'Silly Pickle', evil: '<script>' } }));
  await sleep(300);
  const join = a.msgs.find((m) => m.t === 'join');
  check(join && join.app.name === 'Silly Pickle' && !('evil' in join.app), 'unknown fields are dropped on relay');
  b.send(JSON.stringify({ t: 'chat', text: 'hello' }));
  b.send(JSON.stringify({ t: 'say', l: 999 }));
  b.send(JSON.stringify({ t: 'emo', e: 'rude' }));
  b.send(JSON.stringify({ t: 'st', x: 1e9, z: -5, ry: 1, an: 'walk', extra: 1 }));
  await sleep(300);
  check(!a.msgs.some((m) => m.t === 'chat' || m.t === 'say' || (m.t === 'emo' && m.e === 'rude')), 'chat / bad lines / bad emotes are not relayed');
  const st = a.msgs.find((m) => m.t === 'st');
  check(st && st.x === 60 && !('extra' in st), 'positions are clamped and extra fields dropped');
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

    console.log('\n🏘️  Bigger town');
    const town = await A.evaluate(() => ({ list: window.__t42.restaurants(), ring: window.__t42.ringRadius, edge: window.__t42.worldRadius }));
    const NEW = { sakura: 'Sakura Sushi', slice: 'Slice Squad', donut: 'Donut Workshop', boba: 'Bubble Tea Bay', sundae: 'Sundae Funday' };
    check(RESTAURANTS.length >= 12 && Object.entries(NEW).every(([id, name]) => RESTAURANTS.find((r) => r.id === id)?.name === name),
      `the 5 new restaurants are in the data (${RESTAURANTS.length} total)`);
    check(RESTAURANT_IDS.join() === RESTAURANTS.map((r) => r.id).join() && town.list.map((r) => r.id).join() === RESTAURANT_IDS.join(),
      'schema RESTAURANT_IDS and the 3D town both come from the restaurant data');
    check(town.ring > 35 && town.edge > town.ring + 5 && town.edge < WORLD_LIMIT, `ring ${town.ring} / walkable edge ${town.edge} fit under server limit ${WORLD_LIMIT}`);
    let closest = Infinity;
    for (const a of town.list) for (const b of town.list) if (a !== b) closest = Math.min(closest, Math.hypot(a.door.x - b.door.x, a.door.z - b.door.z));
    check(closest > 11.5 && town.list.every((r) => Math.hypot(r.door.x, r.door.z) < town.ring), `every door is on the ring with room between buildings (closest ${closest.toFixed(1)})`);
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
    check(foods.missing.length === 0, `all ${foods.count} foods have their own 3D model${foods.missing.length ? ` (missing: ${foods.missing})` : ''}`);
    check(foods.mostMeshes <= 16 && foods.untinted.length === 0, `food models are merged (≤${foods.mostMeshes} draw calls each) and every Mystery twist builds`);
    const perf = await A.evaluate(() => window.__t42.renderInfo());
    check(perf.calls < 160 && perf.triangles < 110000, `town stays light for iPad (${perf.calls} draw calls, ${perf.triangles} triangles)`);

    /** Walk the last few steps to restaurant `id` with the W key (desktop controls) and go in. */
    const goIn = async (id) => {
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
      check(await A.locator('#btn-go-in').isVisible(), '"Go in!" button appears near the door');
      await A.locator('#btn-go-in').tap({ force: true });
      check(await waitFor(A, () => window.__t42.mode() === 'order'), 'order screen opens');
    };
    const rateAndLeave = async (stars) => {
      await A.locator('#btn-review-done').tap();
      const mood = await A.locator('.mood-btn.on').textContent();
      await A.locator('.star-btn').nth(stars - 1).tap();
      await A.locator('#rate-save').tap();
      check(await waitFor(A, () => window.__t42.mode() === 'plaza', null, 8000), 'back in the plaza after rating');
      return mood;
    };

    console.log('\n🍣 Restaurant visit + food reaction');
    const sushi = RESTAURANTS[0];
    await goIn(sushi.id);
    check(sushi.id === 'sakura' && (await A.locator('#order-rest').textContent()) === 'Sakura Sushi', 'Sakura Sushi is the first restaurant, straight ahead of the spawn');
    check(await A.locator('.menu-item').count() === sushi.menu.length, `menu shows all ${sushi.menu.length} sushi items`);
    check(sushi.menu[0].react === 'spicy' && (await A.locator('.menu-item').first().locator('.mi-tag').textContent()) === FOOD_REACTIONS.spicy.tag, 'spicy food is tagged on its menu tile');
    await A.locator('.menu-item').first().tap();
    check(await waitFor(A, () => window.__t42.mode() === 'review'), 'review mode with viewfinder');
    check(await A.locator('.rec-dot').isVisible(), 'REC dot visible');
    await A.locator('.rv-emote.bite').tap();
    check(await waitFor(A, () => window.__t42.playerEmote() === 'spicy', null, 4000), 'a bite of wasabi roll makes the reviewer go 🥵 spicy');
    check(await waitFor(B, () => window.__t42.remoteEmotes().includes('spicy'), null, 4000), 'the friend sees the spicy reaction too');
    await A.locator('.rv-line').first().tap();
    await sleep(1200);
    await rateAndLeave(5);
    const saved = await A.evaluate(() => JSON.parse(localStorage.getItem('t42.reviews') || '[]'));
    check(saved.length === 1 && saved[0].stars === 5 && saved[0].rid === 'sakura', 'review saved to localStorage');

    console.log('\n🎲 Mystery Plate');
    const diner = RESTAURANTS.find((r) => r.id === 'sundae');
    await goIn(diner.id);
    // layout size, not boundingBox: the card is still scaling in with its pop animation
    const surprise = await A.locator('#order-surprise').evaluate((b) => ({ w: b.offsetWidth, h: b.offsetHeight }));
    check(surprise.h >= 56 && surprise.w >= 56, `"Surprise me!" button is a big touch target (${surprise.h}px tall)`);
    // make the dice land on: first menu item + first twist
    await A.evaluate(() => {
      crypto.getRandomValues = (a) => a.fill(0);
    });
    await A.locator('#order-surprise').tap();
    check(await waitFor(A, () => window.__t42.mode() === 'review', null, 5000), 'the Mystery Plate is served after the drum roll');
    await A.evaluate(() => delete crypto.getRandomValues);
    const plate = await A.evaluate(() => window.__t42.item());
    const twist = MYSTERY_TWISTS[0];
    check(plate.id === diner.menu[0].id && plate.twist === twist.id && plate.name === `${twist.word} ${diner.menu[0].name}`, `silly combo from preset words only: "${plate.name}"`);
    check(EMOTES.includes(plate.react) && plate.react === twist.react, `it comes with a "${plate.react}" reaction`);
    await A.locator('.rv-emote.bite').tap();
    check(await waitFor(A, (r) => window.__t42.playerEmote() === r, plate.react, 4000), 'tasting it makes the reviewer go 🤢');
    const mood = await rateAndLeave(2);
    check(mood === '🤢', 'rating starts on the queasy face for a yucky plate');
    await A.locator('#btn-reviews').tap();
    check(await A.locator('.book-page').count() === RESTAURANT_IDS.length, `scrapbook has a page for all ${RESTAURANT_IDS.length} restaurants`);
    check(await A.locator('.book-page li').count() === 2, 'scrapbook lists both reviews');
    check((await A.locator('.book-page li .fn').allTextContents()).includes(plate.name), 'the Mystery Plate is in the scrapbook by name');
    check((await A.locator('#book-summary').textContent()).includes(`2 of ${RESTAURANT_IDS.length} restaurants`), 'scrapbook counts restaurants from the data (no hard-coded 7)');
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
