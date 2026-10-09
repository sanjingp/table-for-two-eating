// End-to-end test: starts the real server on a free port, opens two iPad-like
// touch pages in the same room and checks loading, multiplayer and the joystick.
import { spawn, execSync } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocket } from 'ws';

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

    console.log('\n🍔 Restaurant visit');
    const door = await A.evaluate(() => window.__t42.restaurants()[0].door);
    // hop to the plaza edge in front of it, then walk there with the keyboard (desktop controls)
    await A.evaluate((d) => window.__t42.teleport(d.x * 0.7, d.z * 0.7), door);
    await A.keyboard.down('w');
    const reached = await waitFor(A, (d) => {
      const p = window.__t42.playerPosition();
      return Math.hypot(p.x - d.x, p.z - d.z) < 2.4;
    }, door, 15000);
    await A.keyboard.up('w');
    check(reached, 'walked to the first restaurant door with W key');
    check(await A.locator('#btn-go-in').isVisible(), '"Go in!" button appears near the door');
    await A.locator('#btn-go-in').tap({ force: true });
    check(await waitFor(A, () => window.__t42.mode() === 'order'), 'order screen opens');
    await A.locator('.menu-item').first().tap();
    check(await waitFor(A, () => window.__t42.mode() === 'review'), 'review mode with viewfinder');
    check(await A.locator('.rec-dot').isVisible(), 'REC dot visible');
    await A.locator('.rv-emote.bite').tap();
    await A.locator('.rv-line').first().tap();
    await sleep(1200);
    await A.locator('#btn-review-done').tap();
    await A.locator('.star-btn').nth(4).tap();
    await A.locator('#rate-save').tap();
    const saved = await A.evaluate(() => JSON.parse(localStorage.getItem('t42.reviews') || '[]'));
    check(saved.length === 1 && saved[0].stars === 5, 'review saved to localStorage');
    check(await waitFor(A, () => window.__t42.mode() === 'plaza', null, 8000), 'back in the plaza after rating');
    await A.locator('#btn-reviews').tap();
    check(await A.locator('.book-page li').count() === 1, 'scrapbook lists the review');
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
