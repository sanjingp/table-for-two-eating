import * as THREE from '../vendor/three.module.js';

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
/** Frame-rate independent smoothing factor. */
export const damp = (lambda, dt) => 1 - Math.exp(-lambda * dt);
export const smooth01 = (t) => t * t * (3 - 2 * t);

export function lerpAngle(a, b, t) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

export function randInt(n) {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0] % n;
}
export const pick = (arr) => arr[randInt(arr.length)];

/** Create a DOM element: h('button.btn.big', { onclick }, 'text', child) */
export function h(tag, props = {}, ...children) {
  const [name, ...classes] = tag.split('.');
  const el = document.createElement(name || 'div');
  if (classes.length) el.className = classes.join(' ');
  for (const [k, v] of Object.entries(props || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k in el && typeof v !== 'string') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

// ------------------------------------------------------------------ canvas textures
export const FONT = '"Arial Rounded MT Bold", "SF Pro Rounded", "Nunito", "Trebuchet MS", "Helvetica Neue", Arial, sans-serif';
const EMOJI_FONT = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';

function toTexture(canvas) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 2;
  return tex;
}

export function roundRect(ctx, x, y, w, hgt, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + hgt, r);
  ctx.arcTo(x + w, y + hgt, x, y + hgt, r);
  ctx.arcTo(x, y + hgt, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

const texCache = new Map();
function cached(key, make) {
  let t = texCache.get(key);
  if (!t) {
    t = make();
    texCache.set(key, t);
  }
  return t;
}

/** Name tag above a player's head. Returns { texture, aspect }. */
export function labelTexture(text, color = '#7b2cbf') {
  return cached(`label:${text}:${color}`, () => {
    const c = document.createElement('canvas');
    const ctx = c.getContext('2d');
    const font = `bold 44px ${FONT}`;
    ctx.font = font;
    const w = Math.ceil(ctx.measureText(text).width) + 48;
    c.width = w;
    c.height = 72;
    ctx.font = font;
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    roundRect(ctx, 3, 3, w - 6, 66, 33);
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.strokeStyle = color;
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, w / 2, 38);
    return { texture: toTexture(c), aspect: w / 72 };
  });
}

/** Round bubble with a big emoji in it. */
export function emojiTexture(emoji) {
  return cached(`emoji:${emoji}`, () => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d');
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.beginPath();
    ctx.arc(64, 64, 58, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#ff7eb6';
    ctx.stroke();
    ctx.font = `76px ${EMOJI_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emoji, 64, 70);
    return { texture: toTexture(c), aspect: 1 };
  });
}

/** Comic speech bubble for preset lines. */
export function speechTexture(text) {
  return cached(`say:${text}`, () => {
    const c = document.createElement('canvas');
    const ctx = c.getContext('2d');
    const font = `bold 40px ${FONT}`;
    ctx.font = font;
    const maxW = 440;
    const words = text.split(' ');
    const lines = [];
    let line = '';
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (ctx.measureText(test).width > maxW && line) {
        lines.push(line);
        line = w;
      } else line = test;
    }
    lines.push(line);
    const textW = Math.max(...lines.map((l) => ctx.measureText(l).width));
    const w = Math.ceil(textW) + 60;
    const bodyH = lines.length * 48 + 34;
    const hgt = bodyH + 30;
    c.width = w;
    c.height = hgt;
    ctx.font = font;
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#8b5cf6';
    ctx.lineWidth = 6;
    roundRect(ctx, 4, 4, w - 8, bodyH - 8, 30);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(w / 2 - 18, bodyH - 7);
    ctx.lineTo(w / 2, hgt - 4);
    ctx.lineTo(w / 2 + 18, bodyH - 7);
    ctx.fill();
    ctx.stroke();
    ctx.fillRect(w / 2 - 15, bodyH - 12, 30, 8);
    ctx.fillStyle = '#4a1d7a';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    lines.forEach((l, i) => ctx.fillText(l, w / 2, 4 + 17 + 24 + i * 48));
    return { texture: toTexture(c), aspect: w / hgt };
  });
}

/** Restaurant sign: name as text only, on an original board design. */
export function signTexture(name, { bg, fg, border }) {
  return cached(`sign:${name}`, () => {
    const c = document.createElement('canvas');
    c.width = 1024;
    c.height = 256;
    const ctx = c.getContext('2d');
    ctx.fillStyle = border;
    roundRect(ctx, 0, 0, 1024, 256, 60);
    ctx.fill();
    ctx.fillStyle = bg;
    roundRect(ctx, 18, 18, 988, 220, 46);
    ctx.fill();
    // little decorative dots
    ctx.fillStyle = border;
    for (const x of [60, 964]) {
      ctx.beginPath();
      ctx.arc(x, 128, 16, 0, Math.PI * 2);
      ctx.fill();
    }
    let size = 150;
    ctx.font = `bold ${size}px ${FONT}`;
    while (ctx.measureText(name).width > 820 && size > 40) {
      size -= 6;
      ctx.font = `bold ${size}px ${FONT}`;
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 14;
    ctx.strokeStyle = '#ffffff';
    ctx.lineJoin = 'round';
    ctx.strokeText(name, 512, 136);
    ctx.fillStyle = fg;
    ctx.fillText(name, 512, 136);
    return toTexture(c);
  });
}

/** Star rating badge floating above restaurants. Not cached (changes). */
export function starsCanvas(avg, count, canvas) {
  const c = canvas || document.createElement('canvas');
  c.width = 512;
  c.height = 160;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 512, 160);
  ctx.fillStyle = 'rgba(255,255,255,0.93)';
  roundRect(ctx, 6, 6, 500, 148, 60);
  ctx.fill();
  ctx.lineWidth = 8;
  ctx.strokeStyle = count ? '#ffb703' : '#d0c4e8';
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (!count) {
    ctx.fillStyle = '#9d8cc4';
    ctx.font = `bold 58px ${FONT}`;
    ctx.fillText('✨ Try me! ✨', 256, 84);
  } else {
    const full = Math.round(avg);
    ctx.font = `bold 78px ${FONT}`;
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = i < full ? '#ffb703' : '#e3dcef';
      ctx.fillText('★', 66 + i * 80, 82);
    }
    ctx.fillStyle = '#7b2cbf';
    ctx.font = `bold 34px ${FONT}`;
    ctx.fillText(`${count} review${count === 1 ? '' : 's'}`, 256, 138);
  }
  return c;
}

export function makeSprite({ texture, aspect }, height) {
  const mat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
  const s = new THREE.Sprite(mat);
  s.scale.set(height * aspect, height, 1);
  s.renderOrder = 10;
  return s;
}

// Soft round blob shadow under characters (no real-time shadows on iPad).
let shadowTex = null;
export function blobShadowTexture() {
  if (shadowTex) return shadowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 31);
  g.addColorStop(0, 'rgba(40,20,60,0.45)');
  g.addColorStop(1, 'rgba(40,20,60,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  shadowTex = toTexture(c);
  return shadowTex;
}

export function checkerTexture(a, b, n = 8) {
  return cached(`check:${a}:${b}:${n}`, () => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d');
    const s = 128 / n;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      ctx.fillStyle = (x + y) % 2 ? a : b;
      ctx.fillRect(x * s, y * s, s, s);
    }
    const t = toTexture(c);
    t.magFilter = THREE.NearestFilter;
    return t;
  });
}

export function stripeTexture(a, b, n = 6) {
  return cached(`stripe:${a}:${b}:${n}`, () => {
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 16;
    const ctx = c.getContext('2d');
    const s = 128 / n;
    for (let x = 0; x < n; x++) {
      ctx.fillStyle = x % 2 ? a : b;
      ctx.fillRect(x * s, 0, s, 16);
    }
    return toTexture(c);
  });
}

/**
 * Merge static, untextured meshes under `root` into one mesh per material.
 * Turns hundreds of draw calls into a few dozen — important for iPad.
 * shallow: only direct children (so animated sub-groups keep moving).
 * dispose: free the source geometries (off for shared/cached geometry).
 */
export function mergeStatic(root, { shallow = false, dispose = true } = {}) {
  root.updateMatrixWorld(true);
  const buckets = new Map();
  const victims = [];
  const consider = (o) => {
    if (!o.isMesh || o.userData.dynamic || o.material.map || o.material.transparent) return;
    let p = o.parent;
    while (p && p !== root) {
      if (p.userData.dynamic) return;
      p = p.parent;
    }
    let list = buckets.get(o.material);
    if (!list) buckets.set(o.material, (list = []));
    list.push(o);
    victims.push(o);
  };
  if (shallow) root.children.forEach(consider);
  else root.traverse(consider);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const tmp = new THREE.Matrix4();
  for (const [material, meshes] of buckets) {
    let vCount = 0;
    let iCount = 0;
    for (const m of meshes) {
      vCount += m.geometry.attributes.position.count;
      iCount += m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count;
    }
    const pos = new Float32Array(vCount * 3);
    const nor = new Float32Array(vCount * 3);
    const idx = vCount > 65535 ? new Uint32Array(iCount) : new Uint16Array(iCount);
    let vo = 0;
    let io = 0;
    const v = new THREE.Vector3();
    const nm = new THREE.Matrix3();
    for (const m of meshes) {
      const g = m.geometry;
      tmp.multiplyMatrices(inv, m.matrixWorld);
      nm.getNormalMatrix(tmp);
      const P = g.attributes.position;
      const N = g.attributes.normal;
      for (let i = 0; i < P.count; i++) {
        v.fromBufferAttribute(P, i).applyMatrix4(tmp);
        pos.set([v.x, v.y, v.z], (vo + i) * 3);
        v.fromBufferAttribute(N, i).applyMatrix3(nm).normalize();
        nor.set([v.x, v.y, v.z], (vo + i) * 3);
      }
      if (g.index) for (let i = 0; i < g.index.count; i++) idx[io++] = g.index.getX(i) + vo;
      else for (let i = 0; i < P.count; i++) idx[io++] = i + vo;
      vo += P.count;
    }
    const merged = new THREE.BufferGeometry();
    merged.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    merged.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    merged.setIndex(new THREE.BufferAttribute(idx, 1));
    merged.computeBoundingSphere();
    const mesh = new THREE.Mesh(merged, material);
    mesh.matrixAutoUpdate = false;
    mesh.userData.merged = true;
    root.add(mesh);
  }
  for (const m of victims) {
    m.parent.remove(m);
    if (dispose) m.geometry.dispose();
  }
}

// ------------------------------------------------------------------ materials
const matCache = new Map();
/** Shared Lambert material per color — cheap on iPad and lets us merge static meshes. */
export function mat(color, opts) {
  const key = opts ? `${color}:${JSON.stringify(opts)}` : color;
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshLambertMaterial({ color, ...opts });
    matCache.set(key, m);
  }
  return m;
}
