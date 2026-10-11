// Table for Two Eating — tiny static file server + WebSocket room relay.
// No express: plain node:http + ws. Every client message is validated and
// rebuilt from whitelisted fields before it is relayed to anyone else.
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';
import {
  ANIMS, EMOTES, LINES, WORLD_LIMIT, HEIGHT_LIMIT, EMOTE_LIMIT, RACE, sanitizeAppearance, isValidRoom,
  raceDoorSpot, pickRaceTarget,
} from '../public/js/schema.js';

const ROOT = path.resolve(fileURLToPath(new URL('../public', import.meta.url)));
const PORT = process.env.PORT !== undefined && process.env.PORT !== '' ? Number(process.env.PORT) : 8080;
const HOST = process.env.HOST || '0.0.0.0';
const TRUST_PROXY = process.env.TRUST_PROXY === '1' || !!process.env.RENDER || !!process.env.FLY_APP_NAME;
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);

export const LIMITS = {
  maxPerRoom: 8,
  maxPayload: 4096,
  maxRooms: 300,
  maxConnections: 600,
  maxConnectionsPerIp: 16,
  connectsPerIpPerMinute: 30,
  helloTimeoutMs: 10_000,
  pingIntervalMs: 20_000,
  maxBufferedBytes: 256 * 1024,
};

// ---------------------------------------------------------------- static files
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};
const COMPRESSIBLE = new Set(['.html', '.js', '.mjs', '.css', '.json', '.svg', '.webmanifest']);
const gzipCache = new Map(); // filePath -> { key, buf }

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "connect-src 'self' ws: wss:",
    "object-src 'none'",
    "base-uri 'none'",
    "frame-ancestors 'none'",
  ].join('; '),
};

function send(res, code, body, headers = {}) {
  res.writeHead(code, { 'Content-Type': 'text/plain; charset=utf-8', ...SECURITY_HEADERS, ...headers });
  res.end(body);
}

async function serveStatic(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed', { Allow: 'GET, HEAD' });
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    return send(res, 400, 'Bad request');
  }
  if (pathname === '/healthz') return send(res, 200, 'ok', { 'Cache-Control': 'no-store' });
  if (pathname === '/favicon.ico') return send(res, 204, '');
  if (pathname.includes('\0')) return send(res, 400, 'Bad request');
  if (pathname.endsWith('/')) pathname += 'index.html';

  const filePath = path.join(ROOT, path.normalize(pathname));
  if (filePath !== ROOT && !filePath.startsWith(ROOT + path.sep)) return send(res, 403, 'Forbidden');
  if (path.basename(filePath).startsWith('.')) return send(res, 404, 'Not found');

  let st;
  try {
    st = await stat(filePath);
  } catch {
    return send(res, 404, 'Not found');
  }
  if (!st.isFile()) return send(res, 404, 'Not found');

  const ext = path.extname(filePath).toLowerCase();
  const etag = `W/"${st.size.toString(16)}-${Math.floor(st.mtimeMs).toString(16)}"`;
  const headers = {
    ...SECURITY_HEADERS,
    'Content-Type': MIME[ext] || 'application/octet-stream',
    // Vendored three.js changes rarely; everything else revalidates so updates show up right away.
    'Cache-Control': filePath.includes(`${path.sep}vendor${path.sep}`) ? 'public, max-age=86400' : 'no-cache',
    ETag: etag,
    Vary: 'Accept-Encoding',
  };
  if (req.headers['if-none-match'] === etag) {
    res.writeHead(304, headers);
    return res.end();
  }

  const wantsGzip = /\bgzip\b/.test(req.headers['accept-encoding'] || '');
  if (wantsGzip && COMPRESSIBLE.has(ext)) {
    let cached = gzipCache.get(filePath);
    if (!cached || cached.key !== etag) {
      cached = { key: etag, buf: zlib.gzipSync(await readFile(filePath), { level: 6 }) };
      gzipCache.set(filePath, cached);
    }
    res.writeHead(200, { ...headers, 'Content-Encoding': 'gzip', 'Content-Length': cached.buf.length });
    return res.end(req.method === 'HEAD' ? undefined : cached.buf);
  }
  res.writeHead(200, { ...headers, 'Content-Length': st.size });
  if (req.method === 'HEAD') return res.end();
  createReadStream(filePath).on('error', () => res.destroy()).pipe(res);
}

// ---------------------------------------------------------------- rate limiting
class TokenBucket {
  constructor(capacity, perSecond) {
    this.capacity = capacity;
    this.rate = perSecond;
    this.tokens = capacity;
    this.last = Date.now();
  }
  take(n = 1) {
    const now = Date.now();
    this.tokens = Math.min(this.capacity, this.tokens + ((now - this.last) / 1000) * this.rate);
    this.last = now;
    if (this.tokens < n) return false;
    this.tokens -= n;
    return true;
  }
}

// ---------------------------------------------------------------- message validation
const clampNum = (v, lim) => Math.max(-lim, Math.min(lim, v));
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const round2 = (v) => Math.round(v * 100) / 100;

/** Returns a rebuilt, safe message or null. Unknown fields are dropped. */
export function validateClientMessage(msg) {
  if (!msg || typeof msg !== 'object' || Array.isArray(msg)) return null;
  switch (msg.t) {
    case 'hello':
    case 'app': {
      const app = sanitizeAppearance(msg.app);
      return app ? { t: msg.t, app } : null;
    }
    case 'st': {
      if (!isNum(msg.x) || !isNum(msg.z) || !isNum(msg.ry)) return null;
      if (typeof msg.an !== 'string' || !ANIMS.includes(msg.an)) return null;
      // height off the ground (bounce pads, the slide): optional, never below the ground or sky-high
      const y = msg.y === undefined ? 0 : msg.y;
      if (!isNum(y)) return null;
      let ry = msg.ry % (Math.PI * 2);
      if (ry > Math.PI) ry -= Math.PI * 2;
      if (ry < -Math.PI) ry += Math.PI * 2;
      return {
        t: 'st', x: round2(clampNum(msg.x, WORLD_LIMIT)), z: round2(clampNum(msg.z, WORLD_LIMIT)), ry: round2(ry), an: msg.an,
        y: round2(Math.max(0, Math.min(HEIGHT_LIMIT, y))),
      };
    }
    case 'emo':
      return typeof msg.e === 'string' && EMOTES.includes(msg.e) ? { t: 'emo', e: msg.e } : null;
    case 'say':
      return Number.isInteger(msg.l) && msg.l >= 0 && msg.l < LINES.length ? { t: 'say', l: msg.l } : null;
    case 'race':
      return { t: 'race' }; // "start a race": nothing else is read from the client
    default:
      return null;
  }
}

// ---------------------------------------------------------------- rooms
const rooms = new Map(); // code -> Set<client>
const ipConnections = new Map(); // ip -> count
const ipConnectRate = new Map(); // ip -> TokenBucket
let connectionCount = 0;

const newId = () => crypto.randomBytes(6).toString('base64url');

// ---------------------------------------------------------------- races
// One race per room at a time. The server picks the door and judges the finish from the
// (already clamped) positions players send, so a client can neither choose the door nor
// simply claim a win: it has to report being there, after GO, and no sooner than a run takes.
const races = new Map(); // room code -> { r, spot, goAt, from, timer }
const raceRests = new Map(); // room code -> when the next race may start (a short rest after each one)
const SPAWN = { x: 0, z: 7 };
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

function startRace(room, starter) {
  const set = rooms.get(room);
  if (!set || races.has(room)) return;
  const racers = [...set].filter((c) => c.app);
  const r = pickRaceTarget(racers.map((c) => c.st || SPAWN));
  const spot = raceDoorSpot(r);
  // `from`: how far each racer has to run, so nobody can win faster than that takes
  const race = { r, spot, goAt: Date.now() + RACE.countdown * 1000, from: new Map(racers.map((c) => [c, distance(c.st || SPAWN, spot)])) };
  race.timer = setTimeout(() => endRace(room, null), (RACE.countdown + RACE.timeout) * 1000);
  race.timer.unref();
  races.set(room, race);
  broadcast(room, { t: 'race', id: starter.id, r });
}

/** winner: the client who got there first, or null when time ran out. */
function endRace(room, winner) {
  const race = races.get(room);
  if (!race) return;
  clearTimeout(race.timer);
  races.delete(room);
  raceRests.set(room, Date.now() + RACE.rest * 1000);
  broadcast(room, winner ? { t: 'win', id: winner.id } : { t: 'win' });
}

function checkFinish(client) {
  const race = races.get(client.room);
  if (!race || client.st.an === 'review') return; // no race on, or inside a restaurant
  const sinceGo = (Date.now() - race.goAt) / 1000;
  if (sinceGo < 0 || distance(client.st, race.spot) >= RACE.reach) return; // a false start, or not there yet
  // someone who joined after the start set off from the spawn point
  const run = (race.from.get(client) ?? distance(SPAWN, race.spot)) - RACE.reach;
  if (sinceGo * RACE.topSpeed + 1 < run) return; // there sooner than anyone could run it: not a real finish
  endRace(client.room, client);
}

function sendJson(ws, obj) {
  if (ws.readyState === WebSocket.OPEN && ws.bufferedAmount < LIMITS.maxBufferedBytes) ws.send(JSON.stringify(obj));
}

function broadcast(room, obj, exceptClient) {
  const set = rooms.get(room);
  if (!set) return;
  const data = JSON.stringify(obj);
  for (const c of set) {
    if (c === exceptClient || !c.app) continue;
    if (c.ws.readyState === WebSocket.OPEN && c.ws.bufferedAmount < LIMITS.maxBufferedBytes) c.ws.send(data);
  }
}

function clientIp(req) {
  if (TRUST_PROXY) {
    const xff = String(req.headers['x-forwarded-for'] || '').split(',').map((s) => s.trim()).filter(Boolean);
    if (xff.length) return xff[xff.length - 1];
  }
  return req.socket.remoteAddress || 'unknown';
}

function rejectUpgrade(socket, code, text) {
  socket.write(`HTTP/1.1 ${code} ${text}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
  socket.destroy();
}

function onConnection(ws, room, ip) {
  const client = {
    id: newId(),
    ws,
    room,
    ip,
    app: null,
    st: null,
    alive: true,
    msgBucket: new TokenBucket(30, 20), // state @10Hz + extras
    emoteBucket: new TokenBucket(EMOTE_LIMIT.burst, EMOTE_LIMIT.perSecond), // emotes / preset lines
    appBucket: new TokenBucket(4, 0.5), // appearance updates
    raceBucket: new TokenBucket(1, 1 / RACE.cooldown), // starting a race
    strikes: new TokenBucket(30, 1), // misbehaviour budget
  };
  connectionCount++;
  ipConnections.set(ip, (ipConnections.get(ip) || 0) + 1);

  let set = rooms.get(room);
  if (!set) {
    set = new Set();
    rooms.set(room, set);
  }
  if (set.size >= LIMITS.maxPerRoom) {
    sendJson(ws, { t: 'full' });
    ws.close(4001, 'room full');
  } else {
    set.add(client);
  }

  const strike = () => {
    if (!client.strikes.take()) ws.close(1008, 'policy');
  };
  const helloTimer = setTimeout(() => {
    if (!client.app) ws.close(1008, 'no hello');
  }, LIMITS.helloTimeoutMs);

  ws.on('pong', () => {
    client.alive = true;
  });

  ws.on('message', (data, isBinary) => {
    if (!set.has(client)) return;
    if (isBinary || data.length > LIMITS.maxPayload) return strike();
    if (!client.msgBucket.take()) return strike();
    let raw;
    try {
      raw = JSON.parse(data.toString('utf8'));
    } catch {
      return strike();
    }
    const msg = validateClientMessage(raw);
    if (!msg) return strike();

    if (msg.t === 'hello') {
      if (client.app) return strike();
      client.app = msg.app;
      clearTimeout(helloTimer);
      const peers = [...set].filter((c) => c !== client && c.app).map((c) => ({ id: c.id, app: c.app, st: c.st }));
      const race = races.get(room); // a race already under way: the newcomer joins it
      sendJson(ws, { t: 'welcome', id: client.id, peers, max: LIMITS.maxPerRoom, ...(race && { race: { r: race.r, ms: race.goAt - Date.now() } }) });
      broadcast(room, { t: 'join', id: client.id, app: client.app }, client);
      return;
    }
    if (!client.app) return strike(); // must say hello first

    switch (msg.t) {
      case 'st':
        client.st = { x: msg.x, z: msg.z, ry: msg.ry, an: msg.an, y: msg.y };
        broadcast(room, { t: 'st', id: client.id, ...client.st }, client);
        checkFinish(client);
        break;
      case 'emo':
        if (client.emoteBucket.take()) broadcast(room, { t: 'emo', id: client.id, e: msg.e }, client);
        break;
      case 'say':
        if (client.emoteBucket.take()) broadcast(room, { t: 'say', id: client.id, l: msg.l }, client);
        break;
      case 'app':
        if (!client.appBucket.take()) return;
        client.app = msg.app;
        broadcast(room, { t: 'app', id: client.id, app: client.app }, client);
        break;
      case 'race':
        if (!races.has(room) && Date.now() >= (raceRests.get(room) || 0) && client.raceBucket.take()) startRace(room, client);
        break;
    }
  });

  ws.on('close', () => {
    clearTimeout(helloTimer);
    connectionCount--;
    const n = (ipConnections.get(ip) || 1) - 1;
    if (n <= 0) ipConnections.delete(ip);
    else ipConnections.set(ip, n);
    if (set.delete(client) && client.app) broadcast(room, { t: 'leave', id: client.id });
    if (set.size === 0 && rooms.get(room) === set) {
      rooms.delete(room);
      clearTimeout(races.get(room)?.timer);
      races.delete(room);
      raceRests.delete(room);
    }
  });
  ws.on('error', () => {});
  ws.__client = client;
}

// ---------------------------------------------------------------- server
const server = http.createServer((req, res) => {
  serveStatic(req, res).catch(() => {
    if (!res.headersSent) send(res, 500, 'Server error');
    else res.destroy();
  });
});
server.headersTimeout = 15_000;
server.requestTimeout = 30_000;

const wss = new WebSocketServer({ noServer: true, maxPayload: LIMITS.maxPayload, perMessageDeflate: false });

server.on('upgrade', (req, socket, head) => {
  socket.on('error', () => {});
  let url;
  try {
    url = new URL(req.url, 'http://localhost');
  } catch {
    return rejectUpgrade(socket, 400, 'Bad Request');
  }
  if (url.pathname !== '/ws') return rejectUpgrade(socket, 404, 'Not Found');
  const room = String(url.searchParams.get('room') || '').toLowerCase();
  if (!isValidRoom(room)) return rejectUpgrade(socket, 400, 'Bad Request');
  if (ALLOWED_ORIGINS.length && !ALLOWED_ORIGINS.includes(req.headers.origin)) return rejectUpgrade(socket, 403, 'Forbidden');

  const ip = clientIp(req);
  let bucket = ipConnectRate.get(ip);
  if (!bucket) {
    if (ipConnectRate.size >= 20_000) return rejectUpgrade(socket, 503, 'Service Unavailable');
    bucket = new TokenBucket(LIMITS.connectsPerIpPerMinute, LIMITS.connectsPerIpPerMinute / 60);
    ipConnectRate.set(ip, bucket);
  }
  if (!bucket.take()) return rejectUpgrade(socket, 429, 'Too Many Requests');
  if (connectionCount >= LIMITS.maxConnections) return rejectUpgrade(socket, 503, 'Service Unavailable');
  if ((ipConnections.get(ip) || 0) >= LIMITS.maxConnectionsPerIp) return rejectUpgrade(socket, 429, 'Too Many Requests');
  if (!rooms.has(room) && rooms.size >= LIMITS.maxRooms) return rejectUpgrade(socket, 503, 'Service Unavailable');

  wss.handleUpgrade(req, socket, head, (ws) => onConnection(ws, room, ip));
});

const heartbeat = setInterval(() => {
  for (const ws of wss.clients) {
    const c = ws.__client;
    if (!c) continue;
    if (!c.alive) {
      ws.terminate();
      continue;
    }
    c.alive = false;
    try {
      ws.ping();
    } catch {
      /* ignore */
    }
  }
  // Forget idle per-IP connect buckets.
  for (const [ip, b] of ipConnectRate) if (b.take(0) && b.tokens >= b.capacity && !ipConnections.has(ip)) ipConnectRate.delete(ip);
}, LIMITS.pingIntervalMs);

server.listen(PORT, HOST, () => {
  const { port } = server.address();
  console.log(`🍽️  Table for Two Eating is running!`);
  console.log(`   On this computer:  http://localhost:${port}`);
  for (const list of Object.values(os.networkInterfaces())) {
    for (const a of list || []) {
      if (a.family === 'IPv4' && !a.internal) console.log(`   On iPad (same wifi): http://${a.address}:${port}`);
    }
  }
  console.log(`LISTENING ${port}`);
});

function shutdown() {
  clearInterval(heartbeat);
  for (const ws of wss.clients) ws.close(1001, 'server shutting down');
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1500).unref();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
