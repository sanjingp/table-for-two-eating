// Simple, chunky 3D food models built from primitives. Each fits on a plate ~0.32 radius.
import * as THREE from '../vendor/three.module.js';
import { mat, mergeStatic } from './util.js';

const C = {
  bun: '#e9a64f', bunTop: '#f0b35f', patty: '#6b3a1f', cheese: '#ffcf33', lettuce: '#6cc644', tomato: '#e63946',
  bread: '#f2c27b', crust: '#c98a3c', turkey: '#f4b7a0', ham: '#f49ac1', golden: '#e8a83e', fry: '#ffd166',
  rice: '#fbf6ea', bowl: '#ffffff', noodle: '#f6d66b', orange: '#f77f00', pea: '#57cc2e', carrot: '#ff8c32',
  dough: '#fff4e0', choc: '#4a2b1a', cookie: '#d99a4e', tortilla: '#f3dca6', foil: '#c9cfd6', bean: '#5a3220',
  guac: '#8ac926', chip: '#ffd36e', red: '#e63946', cream: '#fffaf0', pink: '#ffb3d1', apple: '#ff4d4d',
  appleIn: '#fff3c4', cone: '#d9a05b', juice: '#7bd389', straw: '#ff5fa2', shake: '#ffc8dd', cinnamon: '#c47c3c',
  nori: '#22382c', salmon: '#ff8c69', avocado: '#9bd15b', cucumber: '#57b33a', wasabi: '#8ac926', ginger: '#ffb3c7',
  shrimp: '#ff9e7a', pod: '#6cc644', pepperoni: '#b02a2a', mozz: '#ffd95a', donut: '#e0a458', icing: '#ff8fc7',
  glaze: '#fff1d0', cocoa: '#6b3a1f', tea: '#e2b98a', pearl: '#2b1a12', berry: '#ff7aa8', mango: '#ffb347',
  waffle: '#f2b84b', glass: '#d7ecff', vanilla: '#fff3d6', strawberry: '#ff9ec4', fudge: '#4a2b1a', banana: '#ffe066',
};

// Mystery Plate re-tint: set only while one model is being built (see createFood).
let tint = null;
let tintN = 0;
const tintColor = new THREE.Color();
const tmpColor = new THREE.Color();
const RAINBOW = ['#ff5f6d', '#ff9f1c', '#ffd23f', '#5bd35f', '#3a86ff', '#b05cf0'];

/** Shared material for a food color, pulled toward the active Mystery Plate tint if there is one. */
function paint(color, opts) {
  if (!tint) return mat(color, opts);
  if (tint === 'rainbow') return mat(RAINBOW[tintN++ % RAINBOW.length], opts);
  tmpColor.set(color).lerp(tintColor, 0.68);
  return mat(`#${tmpColor.getHexString()}`, opts);
}

function add(g, geometry, color, pos = [0, 0, 0], rot = [0, 0, 0], scl = [1, 1, 1]) {
  const m = new THREE.Mesh(geometry, typeof color === 'string' ? paint(color) : color);
  m.position.set(...pos);
  m.rotation.set(...rot);
  m.scale.set(...scl);
  g.add(m);
  return m;
}
const sphere = (r, w = 12, hs = 8) => new THREE.SphereGeometry(r, w, hs);
const cyl = (rt, rb, hgt, seg = 16, ts = 0, tl = Math.PI * 2) => new THREE.CylinderGeometry(rt, rb, hgt, seg, 1, false, ts, tl);
const box = (w, hgt, d) => new THREE.BoxGeometry(w, hgt, d);
const torus = (r, tube, rs = 8, ts = 18, arc = Math.PI * 2) => new THREE.TorusGeometry(r, tube, rs, ts, arc);
const cone = (r, hgt, seg = 10) => new THREE.ConeGeometry(r, hgt, seg);

function bowl(g, color = C.bowl, r = 0.2) {
  const b = new THREE.SphereGeometry(r, 18, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
  add(g, b, paint(color, { side: THREE.DoubleSide }), [0, r, 0]);
  add(g, cyl(r * 0.5, r * 0.5, 0.02, 14), color, [0, 0.01, 0]);
  return r;
}
function scatter(g, n, geom, colors, radius, y, seed = 1) {
  let s = seed;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < n; i++) {
    const a = rnd() * Math.PI * 2;
    const r = Math.sqrt(rnd()) * radius;
    add(g, geom, colors[i % colors.length], [Math.cos(a) * r, y + rnd() * 0.03, Math.sin(a) * r], [rnd() * 3, rnd() * 3, rnd() * 3]);
  }
}

/** One upright piece of a sushi roll: `wrap` outside, `top` disc, little `fill` dots in the middle. */
function makiPiece(g, x, z, { wrap, top, topR = 0.047, fill, r = 0.058 }) {
  add(g, cyl(r, r, 0.07, 12), wrap, [x, 0.035, z]);
  add(g, cyl(topR, topR, 0.008, 12), top, [x, 0.072, z]);
  fill.forEach((c, i) => add(g, cyl(0.017, 0.017, 0.008, 8), c, [x + (i - (fill.length - 1) / 2) * 0.03, 0.078, z]));
}

/** A six-slice pie with one slice being pulled away by the crust. */
function pizza(g, pepperoni) {
  const N = 6;
  const arc = (Math.PI * 2) / N;
  for (let i = 0; i < N; i++) {
    const s = new THREE.Group();
    s.rotation.y = (i - 0.5) * arc;
    if (i === 0) {
      s.position.set(0, 0.012, 0.06);
      s.rotation.x = -0.22;
    }
    add(s, cyl(0.27, 0.27, 0.022, 4, 0.03, arc - 0.06), C.crust, [0, 0.011, 0]);
    add(s, cyl(0.235, 0.235, 0.008, 4, 0.06, arc - 0.12), C.mozz, [0, 0.026, 0]);
    for (const [rr, a] of [[0.11, arc * 0.5], [0.19, arc * 0.3], [0.185, arc * 0.72]]) {
      const spot = [Math.sin(a) * rr, 0.032, Math.cos(a) * rr];
      if (pepperoni) add(s, cyl(0.028, 0.028, 0.006, 8), C.pepperoni, spot);
      else add(s, cyl(0.016, 0.016, 0.004, 6), '#ffeeb0', spot);
    }
    g.add(s);
  }
}

/** A red strawberry with a leafy top, tip pointing down. */
function strawberry(g, x, y, z, s = 1) {
  add(g, cone(0.026 * s, 0.05 * s, 8), C.red, [x, y, z], [Math.PI, 0, 0]);
  add(g, cyl(0.02 * s, 0.02 * s, 0.006 * s, 5), '#3fa34d', [x, y + 0.027 * s, z]);
}

const BUILDERS = {
  burger(g) {
    add(g, cyl(0.15, 0.14, 0.05), C.bun, [0, 0.025, 0]);
    add(g, cyl(0.155, 0.155, 0.012), C.lettuce, [0, 0.056, 0]);
    add(g, cyl(0.155, 0.155, 0.045), C.patty, [0, 0.083, 0]);
    add(g, box(0.27, 0.012, 0.27), C.cheese, [0, 0.11, 0], [0, Math.PI / 4, 0]);
    add(g, cyl(0.13, 0.13, 0.015), C.tomato, [0, 0.122, 0]);
    add(g, sphere(0.155, 16, 10), C.bunTop, [0, 0.13, 0], [0, 0, 0], [1, 0.62, 1]);
    for (let i = 0; i < 9; i++) {
      const a = i * 2.4;
      add(g, sphere(0.012, 6, 4), C.cream, [Math.cos(a) * 0.08 * (i % 3 + 1) / 2, 0.215 - (i % 3) * 0.008, Math.sin(a) * 0.08 * (i % 3 + 1) / 2], [0, 0, 0], [1.6, 0.6, 1]);
    }
  },
  fries(g, accent = '#e63946') {
    add(g, cyl(0.1, 0.075, 0.18, 14), accent, [0, 0.09, 0]);
    add(g, box(0.06, 0.06, 0.005), '#ffffff', [0, 0.1, 0.092], [-0.12, 0, 0]);
    for (let i = 0; i < 14; i++) {
      const a = i * 2.39;
      const r = 0.02 + (i % 4) * 0.018;
      add(g, box(0.022, 0.2, 0.022), C.fry, [Math.cos(a) * r, 0.2 + (i % 3) * 0.02, Math.sin(a) * r], [Math.sin(i) * 0.25, 0, Math.cos(i) * 0.25]);
    }
  },
  wafflefries(g) {
    add(g, box(0.32, 0.06, 0.2), '#e5383b', [0, 0.03, 0]);
    for (let i = 0; i < 9; i++) {
      add(g, cyl(0.05, 0.05, 0.018, 8), C.golden, [-0.1 + (i % 3) * 0.1, 0.075 + Math.floor(i / 3) * 0.012, -0.05 + Math.floor(i / 3) * 0.05], [0.4 + i * 0.1, 0, 0.2]);
    }
  },
  nuggets(g) {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      add(g, sphere(0.06, 10, 8), C.golden, [Math.cos(a) * 0.14, 0.035, Math.sin(a) * 0.14], [0, a, 0.2], [1.25, 0.6, 1]);
    }
    add(g, cyl(0.05, 0.04, 0.05, 12), '#ffffff', [0, 0.025, 0]);
    add(g, cyl(0.045, 0.045, 0.01, 12), '#ff9f1c', [0, 0.05, 0]);
  },
  mac(g) {
    const r = bowl(g, '#ffd23f', 0.17);
    add(g, sphere(r * 0.92, 16, 8), '#ffc300', [0, r * 0.82, 0], [0, 0, 0], [1, 0.35, 1]);
    scatter(g, 16, new THREE.TorusGeometry(0.022, 0.009, 5, 8, Math.PI), ['#ffb703', '#ffd166'], 0.12, r * 0.95, 3);
  },
  shake(g) {
    add(g, cyl(0.085, 0.065, 0.24, 16), C.shake, [0, 0.12, 0]);
    add(g, cyl(0.088, 0.088, 0.04, 16), '#ffffff', [0, 0.17, 0]);
    add(g, sphere(0.08, 12, 8), C.cream, [0, 0.25, 0], [0, 0, 0], [1, 0.7, 1]);
    add(g, sphere(0.055, 12, 8), C.cream, [0, 0.3, 0]);
    add(g, sphere(0.028, 10, 8), C.red, [0, 0.36, 0]);
    add(g, cyl(0.012, 0.012, 0.3, 6), C.straw, [0.04, 0.33, -0.02], [0, 0, -0.25]);
  },
  dumplings(g) {
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const d = new THREE.Group();
      d.position.set(Math.cos(a) * 0.14, 0, Math.sin(a) * 0.14);
      d.rotation.y = -a;
      add(d, sphere(0.07, 12, 8), C.dough, [0, 0.04, 0], [0, 0, 0], [1.3, 0.75, 1]);
      add(d, new THREE.ConeGeometry(0.03, 0.05, 6), C.dough, [0, 0.1, 0]);
      g.add(d);
    }
    add(g, cyl(0.045, 0.04, 0.03, 12), '#3d2b1f', [0, 0.015, 0]);
  },
  orangechicken(g) {
    const r = bowl(g);
    add(g, sphere(r * 0.9, 16, 8), C.rice, [0, r * 0.75, 0], [0, 0, 0], [1, 0.4, 1]);
    scatter(g, 9, new THREE.IcosahedronGeometry(0.04, 0), [C.orange, '#e85d04'], 0.11, r * 0.95, 7);
    scatter(g, 5, box(0.02, 0.02, 0.02), [C.pea], 0.12, r * 1.0, 11);
  },
  noodles(g) {
    const r = bowl(g, '#e63946');
    add(g, sphere(r * 0.9, 16, 8), C.noodle, [0, r * 0.75, 0], [0, 0, 0], [1, 0.35, 1]);
    scatter(g, 14, new THREE.TorusGeometry(0.04, 0.009, 5, 12), [C.noodle, '#ffe08a'], 0.12, r * 0.95, 5);
    scatter(g, 4, box(0.03, 0.01, 0.02), [C.carrot, C.pea], 0.1, r * 1.0, 9);
    add(g, cyl(0.008, 0.008, 0.45, 5), '#a0522d', [0.06, 0.3, 0], [0, 0, -0.9]);
    add(g, cyl(0.008, 0.008, 0.45, 5), '#a0522d', [0.06, 0.3, 0.04], [0, 0, -0.95]);
  },
  friedrice(g) {
    const r = bowl(g);
    add(g, sphere(r * 0.95, 16, 10), '#f6e2a8', [0, r * 0.8, 0], [0, 0, 0], [1, 0.55, 1]);
    scatter(g, 16, box(0.022, 0.022, 0.022), [C.pea, C.carrot, '#ffd23f'], 0.13, r * 1.0, 13);
  },
  sandwich(g, accent, filling = C.turkey) {
    add(g, box(0.3, 0.05, 0.22), C.bread, [0, 0.025, 0]);
    add(g, box(0.32, 0.015, 0.24), C.lettuce, [0, 0.057, 0]);
    add(g, box(0.29, 0.03, 0.21), filling, [0, 0.08, 0]);
    add(g, box(0.31, 0.01, 0.23), C.cheese, [0, 0.1, 0], [0, 0.05, 0]);
    add(g, box(0.3, 0.05, 0.22), C.bread, [0, 0.13, 0]);
    add(g, cyl(0.004, 0.004, 0.16, 4), '#e9d8a6', [0, 0.19, 0]);
    add(g, sphere(0.022, 8, 6), C.red, [0, 0.27, 0]);
  },
  hamsub(g) {
    BUILDERS.sub(g, null, C.ham);
  },
  turkeysub(g) {
    BUILDERS.sub(g, null, C.turkey);
  },
  veggiesub(g) {
    BUILDERS.sub(g, null, C.lettuce, true);
  },
  sub(g, accent, filling, veggie = false) {
    add(g, new THREE.CapsuleGeometry(0.065, 0.28, 4, 10), C.bread, [0, 0.045, 0], [0, 0, Math.PI / 2], [1, 1, 0.7]);
    add(g, box(0.36, 0.03, 0.11), filling, [0, 0.085, 0]);
    add(g, box(0.36, 0.012, 0.12), C.lettuce, [0, 0.105, 0]);
    for (let i = 0; i < 4; i++) add(g, cyl(0.03, 0.03, 0.01, 10), veggie ? (i % 2 ? '#ff9f1c' : C.tomato) : C.tomato, [-0.13 + i * 0.085, 0.114, 0.035]);
    add(g, new THREE.CapsuleGeometry(0.06, 0.27, 4, 10), C.bread, [0, 0.135, 0], [0, 0, Math.PI / 2], [1, 0.8, 0.7]);
  },
  cookie(g) {
    add(g, cyl(0.16, 0.16, 0.035, 18), C.cookie, [0, 0.018, 0]);
    scatter(g, 11, sphere(0.018, 6, 4), [C.choc], 0.13, 0.038, 17);
  },
  chips(g) {
    const r = bowl(g, '#ffd23f', 0.17);
    scatter(g, 14, new THREE.CircleGeometry(0.045, 8), [C.chip, '#f4c24a'], 0.12, r * 0.8, 19);
    g.children.forEach((c) => {
      if (c.geometry.type === 'CircleGeometry') c.material = paint(C.chip, { side: THREE.DoubleSide });
    });
  },
  apples(g) {
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const w = new THREE.Group();
      w.position.set(Math.cos(a) * 0.12, 0.025, Math.sin(a) * 0.12);
      w.rotation.set(Math.PI / 2, 0, a);
      add(w, cyl(0.1, 0.1, 0.045, 6, 0, 0.8), C.appleIn);
      add(w, cyl(0.106, 0.106, 0.04, 6, 0, 0.8), i % 2 ? C.apple : '#7ac943');
      g.add(w);
    }
  },
  icecream(g) {
    add(g, new THREE.ConeGeometry(0.065, 0.2, 12), C.cone, [0, 0.12, 0], [Math.PI, 0, 0]);
    add(g, sphere(0.075, 14, 10), C.cream, [0, 0.24, 0]);
    add(g, new THREE.ConeGeometry(0.06, 0.1, 12), C.cream, [0, 0.33, 0]);
    scatter(g, 8, box(0.015, 0.005, 0.005), ['#ff5fa2', '#3a86ff', '#ffd23f', '#7ae582'], 0.05, 0.28, 23);
  },
  burrito(g) {
    add(g, new THREE.CapsuleGeometry(0.08, 0.22, 4, 12), C.tortilla, [0.05, 0.08, 0], [0, 0, Math.PI / 2]);
    add(g, cyl(0.086, 0.086, 0.16, 14), C.foil, [-0.06, 0.08, 0], [0, 0, Math.PI / 2]);
    add(g, cyl(0.06, 0.06, 0.01, 14), '#7ac943', [0.205, 0.08, 0], [0, 0, Math.PI / 2]);
  },
  bowl(g) {
    const r = bowl(g, '#c9a27a', 0.2);
    const parts = [[C.rice, 0, 0], [C.bean, 0.07, 0.05], [C.guac, -0.07, 0.05], ['#ffd23f', 0.07, -0.06], [C.tomato, -0.07, -0.06]];
    for (const [c, x, z] of parts) add(g, sphere(0.07, 12, 8), c, [x, r * 0.85, z], [0, 0, 0], [1, 0.5, 1]);
  },
  guac(g) {
    add(g, cyl(0.08, 0.06, 0.06, 14), '#fcd5b5', [0, 0.03, 0]);
    add(g, sphere(0.07, 12, 8), C.guac, [0, 0.06, 0], [0, 0, 0], [1, 0.5, 1]);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      add(g, cyl(0.06, 0.06, 0.012, 3), C.chip, [Math.cos(a) * 0.17, 0.03, Math.sin(a) * 0.17], [0.4, a, 0.3]);
    }
  },
  quesadilla(g) {
    for (let i = 0; i < 3; i++) {
      const w = new THREE.Group();
      w.rotation.y = i * 2.1;
      w.position.set(Math.cos(i * 2.1) * 0.02, 0.02 + i * 0.006, -Math.sin(i * 2.1) * 0.02);
      add(w, cyl(0.17, 0.17, 0.035, 10, 0, 1.2), '#f0c987');
      add(w, cyl(0.17, 0.17, 0.006, 10, 0, 1.2), '#ffcf33', [0, 0.021, 0], [0, 0, 0], [0.92, 1, 0.92]);
      g.add(w);
    }
  },
  taco(g) {
    const t = new THREE.Group();
    t.position.y = 0.11;
    t.rotation.z = Math.PI / 2;
    add(t, new THREE.CylinderGeometry(0.11, 0.11, 0.26, 16, 1, true, Math.PI, Math.PI), paint('#f6c453', { side: THREE.DoubleSide }), [0, 0, 0], [Math.PI / 2, 0, 0]);
    g.add(t);
    add(g, box(0.06, 0.06, 0.22), C.patty, [0, 0.08, 0]);
    scatter(g, 10, box(0.04, 0.012, 0.012), [C.lettuce], 0.07, 0.13, 29);
    scatter(g, 6, box(0.02, 0.02, 0.02), [C.tomato, C.cheese], 0.06, 0.15, 31);
  },
  nachos(g) {
    for (let i = 0; i < 14; i++) {
      const a = i * 2.39;
      const r = 0.03 + (i % 5) * 0.035;
      add(g, cyl(0.06, 0.06, 0.012, 3), C.chip, [Math.cos(a) * r, 0.02 + (i % 3) * 0.02, Math.sin(a) * r], [0.3 * Math.sin(i), a, 0.3 * Math.cos(i)]);
    }
    scatter(g, 7, sphere(0.03, 8, 6), ['#ffb703'], 0.1, 0.07, 37);
  },
  twists(g) {
    for (let i = 0; i < 7; i++) {
      const tw = new THREE.TorusKnotGeometry(0.035, 0.012, 24, 5, 2, 3);
      add(g, tw, C.cinnamon, [Math.cos(i) * 0.12, 0.04 + (i % 2) * 0.03, Math.sin(i * 1.3) * 0.12], [i, i * 2, 0], [1.4, 0.7, 0.7]);
    }
  },
  juice(g) {
    add(g, box(0.12, 0.18, 0.08), C.juice, [0, 0.09, 0]);
    add(g, box(0.122, 0.06, 0.082), '#ffffff', [0, 0.1, 0]);
    add(g, sphere(0.022, 8, 6), C.apple, [0, 0.1, 0.042]);
    add(g, cyl(0.007, 0.007, 0.14, 5), C.straw, [0.03, 0.23, 0], [0, 0, -0.3]);
  },

  // ---------------------------------------------------------------- Sakura Sushi
  californiaroll(g) {
    // inside-out roll: rice outside, a ring of seaweed, crab + avocado in the middle
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      makiPiece(g, Math.cos(a) * 0.15, Math.sin(a) * 0.15, { wrap: C.rice, top: C.nori, topR: 0.04, fill: [C.salmon, C.avocado] });
    }
    add(g, sphere(0.04, 10, 8), C.wasabi, [-0.035, 0.022, 0.02], [0, 0, 0], [1, 0.75, 1]); // wasabi!
    for (let i = 0; i < 3; i++) add(g, cyl(0.034, 0.034, 0.006, 10), C.ginger, [0.04 + i * 0.012, 0.006 + i * 0.007, -0.02 + i * 0.012], [0.12 * i, 0, 0.1]);
  },
  cucumberroll(g) {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      makiPiece(g, Math.cos(a) * 0.15, Math.sin(a) * 0.15, { wrap: C.nori, top: C.rice, fill: [C.cucumber] });
    }
    add(g, cyl(0.055, 0.04, 0.03, 12), '#ffffff', [0, 0.015, 0]); // soy sauce dish
    add(g, cyl(0.046, 0.046, 0.005, 12), '#3d2b1f', [0, 0.031, 0]);
  },
  shrimproll(g) {
    for (let i = 0; i < 4; i++) {
      const x = (i - 1.5) * 0.112;
      const z = Math.abs(i - 1.5) * 0.025 - 0.02;
      makiPiece(g, x, z, { wrap: C.rice, top: C.nori, topR: 0.038, fill: [C.avocado], r: 0.052 });
      add(g, sphere(0.042, 10, 8), C.shrimp, [x, 0.092, z], [0, 0, 0], [1.2, 0.42, 0.9]);
      for (const dx of [-0.018, 0.018]) add(g, box(0.008, 0.006, 0.06), '#ffffff', [x + dx, 0.107, z]);
    }
    for (const s of [-1, 1]) add(g, cone(0.028, 0.055, 6), '#ff6b4a', [s * 0.235, 0.085, 0.02], [0, 0, s * (Math.PI / 2)], [1, 1, 0.4]);
  },
  edamame(g) {
    const r = bowl(g, '#3d5a80', 0.18);
    add(g, sphere(r * 0.9, 14, 8), C.cucumber, [0, r * 0.72, 0], [0, 0, 0], [1, 0.4, 1]);
    scatter(g, 12, new THREE.CapsuleGeometry(0.022, 0.085, 3, 8), [C.pod, '#7fd65a'], 0.11, r * 0.92, 41);
  },
  mochi(g) {
    ['#ffb3d1', '#c5e8a5', C.cream].forEach((c, i) => {
      const a = (i / 3) * Math.PI * 2 + 0.5;
      const x = Math.cos(a) * 0.12;
      const z = Math.sin(a) * 0.12;
      add(g, cyl(0.1, 0.1, 0.006, 14), '#ffe8a3', [x, 0.003, z]); // paper cup
      add(g, sphere(0.085, 14, 10), c, [x, 0.062, z], [0, 0, 0], [1, 0.7, 1]);
    });
  },

  // ---------------------------------------------------------------- Slice Squad
  cheesepizza(g) {
    pizza(g, false);
  },
  pepperonipizza(g) {
    pizza(g, true);
  },
  garlicknots(g) {
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.4;
      add(g, new THREE.TorusKnotGeometry(0.045, 0.021, 28, 6, 2, 3), '#f0c987', [Math.cos(a) * 0.15, 0.04, Math.sin(a) * 0.15], [Math.PI / 2, 0, a], [1, 1, 0.75]);
      add(g, box(0.014, 0.004, 0.014), '#3fa34d', [Math.cos(a) * 0.15, 0.078, Math.sin(a) * 0.15], [0, a, 0]); // parsley
    }
    add(g, cyl(0.06, 0.048, 0.045, 12), '#ffffff', [0, 0.0225, 0]); // marinara for dipping
    add(g, cyl(0.052, 0.052, 0.006, 12), C.red, [0, 0.046, 0]);
  },

  // ---------------------------------------------------------------- Donut Workshop
  sprinkledonut(g) {
    add(g, torus(0.12, 0.06, 10, 20), C.donut, [0, 0.06, 0], [Math.PI / 2, 0, 0]);
    add(g, torus(0.12, 0.055, 8, 20), C.icing, [0, 0.08, 0], [Math.PI / 2, 0, 0], [1, 1, 0.8]);
    const cols = ['#ffffff', '#3a86ff', '#ffd23f', '#7ae582', '#9b5de5'];
    for (let i = 0; i < 12; i++) {
      const a = i * 2.4;
      const r = 0.1 + (i % 3) * 0.02;
      add(g, box(0.03, 0.008, 0.008), cols[i % cols.length], [Math.cos(a) * r, 0.124 - Math.abs(r - 0.12) * 0.15, Math.sin(a) * r], [0, i * 1.3, 0]);
    }
  },
  donutholes(g) {
    const spots = [[0, 0.055, 0], [0, 0.14, 0]];
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      spots.push([Math.cos(a) * 0.115, 0.055, Math.sin(a) * 0.115]);
    }
    for (const [x, y, z] of spots) {
      add(g, sphere(0.055, 12, 8), C.donut, [x, y, z]);
      add(g, sphere(0.056, 10, 6), C.glaze, [x, y + 0.032, z], [0, 0, 0], [0.9, 0.5, 0.9]);
    }
  },
  cinnamonroll(g) {
    add(g, cyl(0.15, 0.16, 0.08, 18), C.donut, [0, 0.04, 0]);
    add(g, cyl(0.145, 0.145, 0.006, 18), '#a8642a', [0, 0.082, 0]);
    const pts = [];
    for (let i = 0; i <= 40; i++) {
      const a = i * 0.42;
      const r = 0.012 + i * 0.0032;
      pts.push(new THREE.Vector3(Math.cos(a) * r, 0.088, Math.sin(a) * r));
    }
    add(g, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, 0.017, 5), '#edb96a');
    add(g, sphere(0.06, 12, 8), C.cream, [0, 0.1, 0], [0, 0, 0], [1.2, 0.3, 1.2]); // icing
    for (let i = 0; i < 4; i++) add(g, sphere(0.03, 8, 6), C.cream, [Math.cos(i * 1.7) * 0.1, 0.1, Math.sin(i * 1.7) * 0.1], [0, 0, 0], [1.3, 0.3, 0.8]);
  },
  cocoa(g) {
    add(g, cyl(0.1, 0.085, 0.16, 16), C.cream, [0, 0.08, 0]);
    add(g, cyl(0.102, 0.098, 0.035, 16), C.icing, [0, 0.07, 0]);
    add(g, torus(0.045, 0.014, 6, 12), C.cream, [0.115, 0.085, 0]);
    add(g, cyl(0.088, 0.088, 0.01, 16), C.cocoa, [0, 0.158, 0]);
    for (let i = 0; i < 3; i++) add(g, cyl(0.02, 0.02, 0.022, 8), '#ffffff', [Math.cos(i * 2.1) * 0.035, 0.17, Math.sin(i * 2.1) * 0.035], [0.3 * i, 0, 0.25]);
  },

  // ---------------------------------------------------------------- Bubble Tea Bay
  bobatea(g) {
    add(g, cyl(0.085, 0.065, 0.24, 16), C.tea, [0, 0.12, 0]);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const y = 0.025 + (i % 3) * 0.024;
      const r = 0.061 + (y / 0.24) * 0.02; // sits in the cup wall so the pearls show
      add(g, sphere(0.017, 8, 6), C.pearl, [Math.cos(a) * r, y, Math.sin(a) * r]);
    }
    add(g, cyl(0.09, 0.09, 0.014, 16), '#ffffff', [0, 0.247, 0]);
    add(g, cyl(0.018, 0.018, 0.3, 8), C.straw, [0.02, 0.3, 0], [0, 0, -0.18]);
  },
  smoothie(g) {
    add(g, cyl(0.075, 0.058, 0.17, 16), C.berry, [0, 0.085, 0]);
    add(g, cyl(0.083, 0.075, 0.07, 16), C.mango, [0, 0.205, 0]);
    add(g, cyl(0.078, 0.078, 0.008, 16), '#ffe9a8', [0, 0.243, 0]);
    add(g, cyl(0.045, 0.045, 0.012, 12, 0, Math.PI), C.orange, [0.07, 0.235, 0.01], [0, Math.PI / 2, Math.PI / 2]); // orange slice
    strawberry(g, -0.06, 0.265, 0.02);
    add(g, cyl(0.012, 0.012, 0.28, 6), '#3a86ff', [0.01, 0.31, -0.02], [0, 0, 0.22]);
  },
  eggwaffle(g) {
    add(g, cyl(0.2, 0.2, 0.014, 6), C.golden, [0, 0.012, 0]);
    for (let j = -2; j <= 2; j++) {
      for (let i = -3; i <= 3; i++) {
        const x = (i + (j % 2 ? 0.5 : 0)) * 0.075;
        const z = j * 0.065;
        if (Math.hypot(x, z) > 0.165) continue;
        add(g, sphere(0.033, 8, 6), C.waffle, [x, 0.022, z], [0, 0, 0], [1, 0.8, 1]);
      }
    }
    add(g, sphere(0.05, 10, 8), C.cream, [0, 0.07, 0], [0, 0, 0], [1, 0.7, 1]);
    strawberry(g, 0, 0.125, 0);
  },

  // ---------------------------------------------------------------- Sundae Funday
  sundae(g) {
    add(g, cyl(0.06, 0.075, 0.012, 14), C.glass, [0, 0.006, 0]);
    add(g, cyl(0.018, 0.018, 0.05, 8), C.glass, [0, 0.035, 0]);
    add(g, cyl(0.135, 0.04, 0.09, 16), C.glass, [0, 0.105, 0]);
    for (const [c, x, z] of [[C.vanilla, -0.055, 0.035], [C.strawberry, 0.055, 0.035], ['#7b4a2a', 0, -0.055]]) add(g, sphere(0.062, 12, 8), c, [x, 0.165, z]);
    add(g, sphere(0.07, 12, 8), C.fudge, [0, 0.2, 0], [0, 0, 0], [1, 0.42, 1]); // hot fudge
    add(g, sphere(0.04, 10, 8), C.cream, [0, 0.235, 0]);
    add(g, cone(0.03, 0.04, 8), C.cream, [0, 0.275, 0]);
    add(g, sphere(0.022, 8, 6), C.red, [0, 0.305, 0]);
    scatter(g, 8, box(0.015, 0.005, 0.005), ['#ff5fa2', '#3a86ff', '#ffd23f', '#7ae582'], 0.06, 0.212, 47);
  },
  bananasplit(g) {
    add(g, cyl(0.12, 0.08, 0.05, 16), C.glass, [0, 0.025, 0], [0, 0, 0], [1.9, 1, 0.95]);
    for (const s of [-1, 1]) add(g, new THREE.CapsuleGeometry(0.03, 0.3, 4, 8), C.banana, [0, 0.07, s * 0.08], [0, s * 0.1, Math.PI / 2]);
    const scoops = [['#7b4a2a', '#ff5fa2'], [C.vanilla, C.fudge], [C.strawberry, '#e0a030']];
    scoops.forEach(([scoop, sauce], i) => {
      const x = (i - 1) * 0.12;
      add(g, sphere(0.062, 12, 8), scoop, [x, 0.105, 0]);
      add(g, sphere(0.05, 10, 6), sauce, [x, 0.148, 0], [0, 0, 0], [1, 0.4, 1]);
      add(g, sphere(0.026, 8, 6), C.cream, [x, 0.175, 0]);
    });
    add(g, sphere(0.02, 8, 6), C.red, [0, 0.205, 0]);
  },
  strawberrycone(g) {
    add(g, cone(0.065, 0.2, 12), C.cone, [0, 0.12, 0], [Math.PI, 0, 0]);
    add(g, cyl(0.072, 0.066, 0.022, 12), C.cone, [0, 0.226, 0]);
    add(g, sphere(0.078, 14, 10), C.strawberry, [0, 0.275, 0]);
    add(g, sphere(0.062, 14, 10), '#ffc2d9', [0, 0.365, 0]);
    strawberry(g, 0, 0.44, 0, 1.1);
  },
};

export const hasFoodModel = (id) => Object.prototype.hasOwnProperty.call(BUILDERS, id);

/**
 * Build a food model by menu item id. `twistTint` (a hex color or 'rainbow') re-tints it
 * for a Mystery Plate. Meshes are merged per material to keep draw calls low on iPad.
 */
export function createFood(id, accent, twistTint = null) {
  const g = new THREE.Group();
  tint = twistTint;
  tintN = 0;
  if (tint && tint !== 'rainbow') tintColor.set(tint);
  try {
    (hasFoodModel(id) ? BUILDERS[id] : BUILDERS.cookie)(g, accent);
  } finally {
    tint = null;
  }
  mergeStatic(g);
  return g;
}
