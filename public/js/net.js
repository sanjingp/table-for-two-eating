// WebSocket client. Optional: if the server can't be reached the game keeps working solo.
import { sanitizeAppearance, ANIMS, EMOTES, LINES, RACE, RESTAURANT_IDS, isValidRoom, WORLD_LIMIT, HEIGHT_LIMIT } from './schema.js';

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isId = (v) => typeof v === 'string' && /^[A-Za-z0-9_-]{1,16}$/.test(v);

function wsUrl(room) {
  const override = typeof window.T42_WS_URL === 'string' && window.T42_WS_URL.trim();
  let base;
  if (override) base = override;
  else base = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;
  const u = new URL(base, location.href);
  if (u.protocol === 'http:') u.protocol = 'ws:';
  if (u.protocol === 'https:') u.protocol = 'wss:';
  u.searchParams.set('room', room);
  return u.toString();
}

export class Net {
  constructor(room, handlers) {
    this.room = isValidRoom(room) ? room : null;
    this.h = handlers; // { onStatus, onWelcome, onJoin, onLeave, onState, onEmote, onSay, onAppearance, onRace, onWin }
    this.ws = null;
    this.status = 'offline';
    this.id = null;
    this.retries = 0;
    this.app = null;
    this.stopped = false;
  }

  setStatus(s) {
    if (this.status === s) return;
    this.status = s;
    this.h.onStatus?.(s);
  }

  connect(app) {
    this.app = app;
    if (!this.room || typeof WebSocket === 'undefined') return this.setStatus('offline');
    this.open();
  }

  open() {
    if (this.stopped) return;
    let ws;
    try {
      ws = new WebSocket(wsUrl(this.room));
    } catch {
      this.setStatus('offline');
      return;
    }
    this.ws = ws;
    this.setStatus('connecting');
    ws.onopen = () => {
      this.retries = 0;
      this.send({ t: 'hello', app: this.app });
    };
    ws.onmessage = (ev) => {
      if (typeof ev.data !== 'string' || ev.data.length > 16384) return;
      let m;
      try {
        m = JSON.parse(ev.data);
      } catch {
        return;
      }
      this.handle(m);
    };
    ws.onclose = () => {
      if (this.ws !== ws) return;
      this.ws = null;
      this.h.onReset?.();
      if (this.status === 'full') return;
      this.setStatus('offline');
      // Gentle retry: 2s, 4s, 8s ... up to 30s.
      const delay = Math.min(30000, 2000 * Math.pow(2, this.retries++));
      clearTimeout(this.retryTimer);
      this.retryTimer = setTimeout(() => this.open(), delay);
    };
    ws.onerror = () => {};
  }

  handle(m) {
    if (!m || typeof m !== 'object') return;
    // Validate everything coming in, too.
    switch (m.t) {
      case 'welcome':
        if (!isId(m.id) || !Array.isArray(m.peers)) return;
        this.id = m.id;
        this.setStatus('online');
        this.h.onWelcome?.(m.peers.slice(0, 16).map((p) => this.cleanPeer(p)).filter(Boolean), this.cleanRace(m.race));
        break;
      case 'join': {
        const p = this.cleanPeer(m);
        if (p) this.h.onJoin?.(p);
        break;
      }
      case 'leave':
        if (isId(m.id)) this.h.onLeave?.(m.id);
        break;
      case 'st': {
        const st = this.cleanState(m);
        if (isId(m.id) && st) this.h.onState?.(m.id, st);
        break;
      }
      case 'emo':
        if (isId(m.id) && EMOTES.includes(m.e)) this.h.onEmote?.(m.id, m.e);
        break;
      case 'say':
        if (isId(m.id) && Number.isInteger(m.l) && LINES[m.l]) this.h.onSay?.(m.id, m.l);
        break;
      case 'app': {
        const app = sanitizeAppearance(m.app);
        if (isId(m.id) && app) this.h.onAppearance?.(m.id, app);
        break;
      }
      case 'race': // someone started a race to restaurant m.r
        if (isId(m.id) && RESTAURANT_IDS.includes(m.r)) this.h.onRace?.(m.id, m.r);
        break;
      case 'win': // the race is over; no id means time ran out
        if (m.id === undefined || isId(m.id)) this.h.onWin?.(m.id ?? null);
        break;
      case 'full':
        this.setStatus('full');
        break;
    }
  }

  cleanPeer(p) {
    if (!p || !isId(p.id)) return null;
    const app = sanitizeAppearance(p.app);
    if (!app) return null;
    return { id: p.id, app, st: p.st ? this.cleanState(p.st) : null };
  }

  cleanState(s) {
    if (!s || !isNum(s.x) || !isNum(s.z) || !isNum(s.ry) || typeof s.an !== 'string') return null;
    const lim = (v) => Math.max(-WORLD_LIMIT, Math.min(WORLD_LIMIT, v));
    const y = isNum(s.y) ? Math.max(0, Math.min(HEIGHT_LIMIT, s.y)) : 0; // height off the ground (bounce pads, slide)
    // a move this page does not know (a friend on a newer version of the game) is shown as walking
    return { x: lim(s.x), z: lim(s.z), ry: lim(s.ry), an: ANIMS.includes(s.an) ? s.an : 'walk', y };
  }

  /** A race that was already on when we joined: { r: restaurant id, ms: milliseconds until GO (negative once it has started) }. */
  cleanRace(race) {
    if (!race || !RESTAURANT_IDS.includes(race.r) || !isNum(race.ms)) return null;
    return { r: race.r, ms: Math.max(-RACE.timeout * 1000, Math.min(RACE.countdown * 1000, race.ms)) };
  }

  send(obj) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(obj));
  }
  sendState(x, z, ry, an, y = 0) {
    const r2 = (v) => Math.round(v * 100) / 100;
    if (this.status === 'online') this.send({ t: 'st', x: r2(x), z: r2(z), ry: r2(ry), an, y: r2(y) });
  }
  sendEmote(e) {
    if (this.status === 'online') this.send({ t: 'emo', e });
  }
  sendSay(l) {
    if (this.status === 'online') this.send({ t: 'say', l });
  }
  /** Ask the server to start a race. Returns false when playing solo (the game then races the clock). */
  sendRace() {
    if (this.status !== 'online') return false;
    this.send({ t: 'race' });
    return true;
  }
  sendAppearance(app) {
    this.app = app;
    if (this.status === 'online') this.send({ t: 'app', app });
  }
}
