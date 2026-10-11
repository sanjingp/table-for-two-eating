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

// Mystery Plate re-tint and build-your-own choices: set only while one model is being built (see createFood).
let recipe = null;
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

// ---------------------------------------------------------------- build your own (toppings from BUILDS in data.js)
const SAUCES = { tomato: '#d6402b', pesto: '#6fae3a', white: '#fff1cf' };
/** A little group lying on the food at (x, y, z), turned by `ry`, for a topping made of a few parts. */
function piece(parent, x, y, z, ry = 0) {
  const p = new THREE.Group();
  p.position.set(x, y, z);
  p.rotation.y = ry;
  parent.add(p);
  return p;
}
// One piece of each pizza topping, lying on the cheese. `n` counts the pieces, so they do not all face the same way.
const PIZZA_TOPS = {
  pepperoni: (s, x, y, z) => add(s, cyl(0.028, 0.028, 0.006, 8), C.pepperoni, [x, y, z]),
  mushroom(s, x, y, z, n) {
    const p = piece(s, x, y, z, n * 1.9);
    add(p, cyl(0.026, 0.026, 0.008, 8, 0, Math.PI), '#e9dcc3'); // a sliced cap…
    add(p, box(0.02, 0.008, 0.012), '#f7efdf', [-0.009, 0, 0]); // …and its stem
  },
  olive: (s, x, y, z) => add(s, torus(0.014, 0.007, 5, 10), '#2b2b33', [x, y + 0.004, z], [Math.PI / 2, 0, 0]),
  pineapple: (s, x, y, z, n) => add(s, cyl(0.03, 0.03, 0.02, 3), '#fff29a', [x, y + 0.006, z], [0.12, n * 1.3, 0]),
  corn(s, x, y, z, n) {
    const p = piece(s, x, y, z, n * 2.1);
    for (const [dx, dz] of [[-0.012, 0], [0.01, 0.008], [0.004, -0.013]]) add(p, sphere(0.009, 5, 4), '#ffe066', [dx, 0.004, dz]);
  },
  chili(s, x, y, z, n) {
    const p = piece(s, x, y, z, n * 2.4);
    add(p, cone(0.009, 0.052, 6), '#e03131', [0, 0.006, 0], [Math.PI / 2, 0, 0]);
    add(p, cyl(0.004, 0.004, 0.014, 5), '#3fa34d', [0, 0.006, -0.03], [Math.PI / 2, 0, 0]);
  },
  basil: (s, x, y, z, n) => add(s, sphere(0.028, 8, 5), '#3fa34d', [x, y + 0.002, z], [0, n * 1.7, 0], [1, 0.1, 0.55]),
  cheese: (s, x, y, z) => add(s, sphere(0.032, 8, 5), '#fff6d8', [x, y, z], [0, 0, 0], [1, 0.22, 1]),
};

/** A pie like pizza() with a ring of sauce showing, and the chosen toppings dealt around the slices. */
function myPizza(g, { b: sauce, t: tops }) {
  const N = 6;
  const arc = (Math.PI * 2) / N;
  let n = 0;
  for (let i = 0; i < N; i++) {
    const s = new THREE.Group();
    s.rotation.y = (i - 0.5) * arc;
    if (i === 0) {
      s.position.set(0, 0.012, 0.06);
      s.rotation.x = -0.22;
    }
    add(s, cyl(0.27, 0.27, 0.022, 4, 0.03, arc - 0.06), C.crust, [0, 0.011, 0]);
    add(s, cyl(0.25, 0.25, 0.006, 4, 0.045, arc - 0.09), SAUCES[sauce] || SAUCES.tomato, [0, 0.0245, 0]);
    add(s, cyl(0.226, 0.226, 0.008, 4, 0.07, arc - 0.14), C.mozz, [0, 0.028, 0]);
    for (const [rr, f] of [[0.085, 0.5], [0.15, 0.27], [0.15, 0.73], [0.2, 0.5]]) {
      const x = Math.sin(arc * f) * rr;
      const z = Math.cos(arc * f) * rr;
      if (tops.length) PIZZA_TOPS[tops[n % tops.length]](s, x, 0.034, z, n);
      else add(s, cyl(0.016, 0.016, 0.004, 6), '#ffeeb0', [x, 0.033, z]); // plain: just bubbly cheese
      n++;
    }
    g.add(s);
  }
}

const SCOOPS = { vanilla: C.vanilla, chocolate: '#7b4a2a', strawberry: C.strawberry, mint: '#a9e8c4' };
const GUMMY_COLORS = ['#ff4d6d', '#57cc2e', '#ffd23f'];

/** Three scoops in a glass like the menu's sundae, in the chosen flavor, with the chosen toppings piled on. */
function mySundae(g, { b: flavor, t: tops }) {
  const has = (id) => tops.includes(id);
  add(g, cyl(0.06, 0.075, 0.012, 14), C.glass, [0, 0.006, 0]);
  add(g, cyl(0.018, 0.018, 0.05, 8), C.glass, [0, 0.035, 0]);
  add(g, cyl(0.135, 0.04, 0.09, 16), C.glass, [0, 0.105, 0]);
  const R = 0.062;
  const scoops = [[-0.055, 0.035], [0.055, 0.035], [0, -0.055]];
  const out = scoops.map(([x, z]) => Math.atan2(z, x)); // the way each scoop faces, away from the middle
  /** A spot on scoop i: `th` around it, `ph` down from its top. */
  const on = (i, th, ph, r = R) => [scoops[i][0] + Math.sin(ph) * Math.cos(th) * r, 0.165 + Math.cos(ph) * r, scoops[i][1] + Math.sin(ph) * Math.sin(th) * r];
  const ice = SCOOPS[flavor] || SCOOPS.vanilla;
  scoops.forEach(([x, z]) => add(g, sphere(R, 12, 8), ice, [x, 0.165, z]));
  add(g, sphere(0.05, 10, 8), ice, [0, 0.182, 0]); // fills the dip in the middle
  if (flavor === 'mint') {
    scoops.forEach((_, i) => {
      for (let k = 0; k < 5; k++) add(g, sphere(0.008, 5, 4), C.choc, on(i, out[i] + (k - 2) * 0.75, 0.55 + (k % 2) * 0.45, R + 0.001));
    });
  }

  // sauces pool on top and run down the scoops
  let top = 0.226;
  const sauce = (color, r) => {
    add(g, sphere(r, 12, 8), color, [0, top - 0.008, 0], [0, 0, 0], [1, 0.42, 1]);
    scoops.forEach((_, i) => add(g, sphere(0.02, 8, 6), color, on(i, out[i] + (r > 0.06 ? 0.5 : -0.5), 0.72, R - 0.004), [0, 0, 0], [0.8, 1.5, 0.8]));
    top += r * 0.3;
  };
  if (has('fudge')) sauce(C.fudge, 0.072);
  if (has('caramel')) sauce('#e0a030', 0.056);
  if (has('sprinkles')) {
    const cols = ['#ff5fa2', '#3a86ff', '#ffd23f', '#7ae582', '#ffffff'];
    scoops.forEach((_, i) => {
      for (let k = 0; k < 7; k++) add(g, box(0.017, 0.006, 0.006), cols[(i + k) % cols.length], on(i, out[i] + (k - 3) * 0.62, 0.42 + (k % 3) * 0.26, R + 0.003), [k, k * 1.7 + i, 0]);
    });
  }
  if (has('banana')) {
    scoops.forEach((_, i) => {
      const a = out[i] - 0.95;
      add(g, cyl(0.032, 0.032, 0.012, 10), '#fff0a8', on(i, a, 1.05, R + 0.004), [0, -a, -1.05]); // coins leaning on the scoops
    });
  }
  if (has('cookie')) {
    scoops.forEach((_, i) => {
      const a = out[i] + 0.95;
      const c = piece(g, ...on(i, a, 1.0, R + 0.006), -a);
      c.rotation.z = -1.0;
      add(c, cyl(0.03, 0.03, 0.012, 10), C.cookie);
      for (const [dx, dz] of [[0.012, 0.006], [-0.01, -0.012], [-0.004, 0.014]]) add(c, sphere(0.006, 5, 4), C.choc, [dx, 0.007, dz]);
    });
  }
  if (has('berry')) {
    for (let i = 0; i < 3; i++) {
      const a = (out[i] + out[(i + 1) % 3]) / 2 + (i === 2 ? Math.PI : 0); // in the gaps between the scoops
      strawberry(g, Math.cos(a) * 0.098, 0.2, Math.sin(a) * 0.098, 1.05);
    }
  }
  if (has('gummy')) {
    scoops.forEach((_, i) => {
      const bear = piece(g, ...on(i, out[i], 0.38, R + 0.012), -out[i] + Math.PI / 2);
      const col = GUMMY_COLORS[i % GUMMY_COLORS.length];
      add(bear, sphere(0.016, 8, 6), col, [0, 0, 0], [0, 0, 0], [1, 1.2, 0.85]);
      add(bear, sphere(0.012, 8, 6), col, [0, 0.024, 0]);
      for (const s of [-1, 1]) {
        add(bear, sphere(0.005, 5, 4), col, [s * 0.009, 0.035, 0]); // ears
        add(bear, sphere(0.006, 5, 4), col, [s * 0.015, 0.004, 0.006]); // paws
      }
    });
  }
  if (has('cream')) {
    add(g, sphere(0.04, 10, 8), C.cream, [0, top + 0.012, 0]);
    add(g, cone(0.03, 0.04, 8), C.cream, [0, top + 0.052, 0]);
    top += 0.066;
  }
  if (has('cherry')) {
    add(g, sphere(0.022, 8, 6), C.red, [0, top + 0.014, 0]);
    add(g, cyl(0.003, 0.003, 0.034, 4), '#5c3d2e', [0.006, top + 0.046, 0], [0, 0, -0.35]);
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
  mypizza(g) {
    myPizza(g, recipe && recipe.k === 'pizza' ? recipe : { b: 'tomato', t: [] });
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
  mysundae(g) {
    mySundae(g, recipe && recipe.k === 'sundae' ? recipe : { b: 'vanilla', t: [] });
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

  // ---------------------------------------------------------------- Noodle Ninja
  ramen(g) {
    const r = bowl(g, '#2b2d42', 0.21);
    add(g, cyl(r * 0.95, r * 0.95, 0.012, 18), '#e9b872', [0, r * 0.86, 0]); // broth
    scatter(g, 12, torus(0.04, 0.009, 5, 12), [C.noodle, '#ffe08a'], 0.1, r * 0.87, 53);
    // half an egg, a pink-dot fish cake, a sheet of seaweed and green onion
    add(g, sphere(0.05, 10, 8), '#ffffff', [-0.09, r * 0.91, 0.07], [0, 0, 0], [1, 0.5, 1.25]);
    add(g, sphere(0.026, 8, 6), '#ffb703', [-0.09, r * 0.91 + 0.018, 0.07], [0, 0, 0], [1, 0.5, 1]);
    add(g, cyl(0.045, 0.045, 0.012, 10), '#ffffff', [0.09, r * 0.92, 0.08], [0.2, 0, 0]);
    add(g, cyl(0.018, 0.018, 0.014, 8), '#ff7aa8', [0.09, r * 0.92 + 0.002, 0.08], [0.2, 0, 0]);
    add(g, box(0.11, 0.13, 0.008), C.nori, [0.02, r * 0.9 + 0.05, -0.13], [-0.25, 0.2, 0]);
    scatter(g, 6, cyl(0.012, 0.012, 0.008, 6), ['#57cc2e'], 0.08, r * 0.9, 59);
    add(g, cyl(0.008, 0.008, 0.45, 5), '#a0522d', [0.1, 0.3, -0.04], [0, 0, -0.9]);
    add(g, cyl(0.008, 0.008, 0.45, 5), '#a0522d', [0.1, 0.3, 0], [0, 0, -0.95]);
  },
  gyoza(g) {
    add(g, box(0.52, 0.014, 0.2), '#3d405b', [0, 0.007, 0.03]); // slate plate
    for (let i = 0; i < 5; i++) {
      const d = new THREE.Group();
      d.position.set((i - 2) * 0.098, 0.014, 0.03);
      d.rotation.y = 0.25;
      add(d, sphere(0.06, 10, 8), C.dough, [0, 0.03, 0], [0, 0, 0], [0.62, 0.62, 1.35]); // crescent
      add(d, sphere(0.056, 10, 6), C.golden, [0, 0.011, 0], [0, 0, 0], [0.64, 0.3, 1.32]); // pan-fried bottom
      for (let k = -2; k <= 2; k++) add(d, sphere(0.014, 6, 4), C.dough, [0, 0.066 - Math.abs(k) * 0.008, k * 0.026]); // pleats
      g.add(d);
    }
    add(g, cyl(0.05, 0.04, 0.03, 12), '#ffffff', [0, 0.015, -0.16]); // dipping sauce
    add(g, cyl(0.042, 0.042, 0.005, 12), '#3d2b1f', [0, 0.031, -0.16]);
  },
  riceball(g) {
    [[-0.1, 0.03, 0.15, true], [0.11, -0.02, -0.35, false]].forEach(([x, z, ry, plum]) => {
      const b = new THREE.Group();
      b.position.set(x, 0, z);
      b.rotation.y = ry;
      add(b, cyl(0.125, 0.125, 0.08, 3), C.rice, [0, 0.068, 0], [Math.PI / 2, Math.PI, 0]); // triangle, point up
      add(b, sphere(0.08, 10, 8), C.rice, [0, 0.07, 0], [0, 0, 0], [1, 0.9, 0.62]); // puffed middle
      add(b, box(0.075, 0.075, 0.086), C.nori, [0, 0.04, 0]); // seaweed strip to hold it by
      if (plum) add(b, sphere(0.02, 8, 6), '#e0577a', [0, 0.115, 0.04]);
      g.add(b);
    });
    for (let i = 0; i < 3; i++) add(g, cyl(0.032, 0.032, 0.008, 10), '#ffd23f', [0.02 + i * 0.022, 0.006 + i * 0.006, 0.17], [0.15 * i, 0, 0.1]); // pickles
  },

  // ---------------------------------------------------------------- Seoul Bites
  corndog(g) {
    [[-0.01, 0.075, 0.2], [0.03, -0.075, -0.15]].forEach(([x, z, ry], n) => {
      const d = new THREE.Group();
      d.position.set(x, 0.06, z);
      d.rotation.y = ry;
      add(d, new THREE.CapsuleGeometry(0.055, 0.2, 4, 10), C.golden, [0.06, 0, 0], [0, 0, Math.PI / 2]);
      for (let i = 0; i < 12; i++) add(d, sphere(0.015, 5, 4), '#f4c56a', [-0.07 + i * 0.024, Math.sin(i * 2.1 + n) * 0.048, Math.cos(i * 2.1 + n) * 0.052]); // crunchy bits
      add(d, cyl(0.011, 0.011, 0.2, 6), '#e9d8a6', [-0.17, 0, 0], [0, 0, Math.PI / 2]); // stick
      for (let i = 0; i < 6; i++) add(d, box(0.05, 0.008, 0.012), i % 2 ? '#ffd23f' : C.red, [-0.05 + i * 0.044, 0.056, 0], [0, i % 2 ? 0.9 : -0.9, 0]); // zigzag sauce
      g.add(d);
    });
  },
  kimbap(g) {
    const piece = { wrap: C.nori, top: C.rice, topR: 0.05, fill: ['#ffd23f', C.carrot, '#3fa34d'], r: 0.06 };
    for (let i = 0; i < 5; i++) makiPiece(g, (i - 2) * 0.112, 0.06 - Math.abs(i - 2) * 0.014, piece);
    for (const x of [-0.058, 0.058]) makiPiece(g, x, -0.07, piece);
    scatter(g, 8, sphere(0.006, 4, 3), ['#fff3c4'], 0.2, 0.08, 107); // sesame seeds
    for (let i = 0; i < 3; i++) add(g, cyl(0.035, 0.035, 0.008, 10, 0, Math.PI), '#ffd23f', [-0.03 + i * 0.03, 0.006 + i * 0.005, -0.19], [0, 0.3 * i, 0]); // pickled radish
  },
  mandu(g) {
    // bamboo steamer basket
    add(g, new THREE.CylinderGeometry(0.21, 0.21, 0.1, 18, 1, true), paint('#d9a05b', { side: THREE.DoubleSide }), [0, 0.05, 0]);
    add(g, cyl(0.205, 0.205, 0.02, 18), '#f3dca6', [0, 0.02, 0]);
    for (const y of [0.03, 0.1]) add(g, torus(0.212, 0.012, 6, 20), '#b07a3c', [0, y, 0], [Math.PI / 2, 0, 0]);
    const spots = [[0, 0]];
    for (let i = 0; i < 4; i++) spots.push([Math.cos(i * 1.57 + 0.5) * 0.115, Math.sin(i * 1.57 + 0.5) * 0.115]);
    for (const [x, z] of spots) {
      add(g, sphere(0.06, 12, 8), C.dough, [x, 0.08, z], [0, 0, 0], [1, 0.85, 1]);
      add(g, cone(0.024, 0.04, 6), C.dough, [x, 0.143, z]); // twisted top
      add(g, sphere(0.014, 6, 4), C.dough, [x, 0.165, z]);
    }
  },
  shavedice(g) {
    add(g, cyl(0.06, 0.085, 0.014, 14), C.glass, [0, 0.007, 0]);
    add(g, cyl(0.16, 0.07, 0.09, 16), C.glass, [0, 0.059, 0]);
    add(g, sphere(0.15, 14, 10), '#ffffff', [0, 0.13, 0], [0, 0, 0], [1, 0.75, 1]); // snowy mountain
    add(g, cone(0.1, 0.13, 12), '#f4fbff', [0, 0.26, 0]);
    add(g, sphere(0.085, 10, 6), '#ff7aa8', [-0.04, 0.235, 0.035], [0, 0, 0], [1, 0.5, 1]); // strawberry syrup
    add(g, sphere(0.07, 10, 6), C.mango, [0.055, 0.21, -0.03], [0, 0, 0], [1, 0.5, 1]); // mango syrup
    strawberry(g, 0, 0.345, 0, 1.1);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const at = [Math.cos(a) * 0.125, 0.125, Math.sin(a) * 0.125];
      if (i % 3 === 0) add(g, box(0.036, 0.036, 0.036), C.mango, at, [0.4, a, 0.3]);
      else if (i % 3 === 1) add(g, sphere(0.022, 8, 6), C.cream, at); // chewy rice cake
      else add(g, cyl(0.026, 0.026, 0.012, 10), '#8ac926', at, [0.9, a, 0]); // kiwi
    }
  },

  // ---------------------------------------------------------------- Curry Castle
  butterchicken(g) {
    const b = new THREE.Group();
    b.position.set(-0.08, 0, 0);
    const r = bowl(b, '#d98a3d', 0.16); // copper bowl
    add(b, sphere(r * 0.93, 16, 8), '#f08a24', [0, r * 0.78, 0], [0, 0, 0], [1, 0.36, 1]); // creamy sauce
    scatter(b, 7, new THREE.IcosahedronGeometry(0.034, 0), ['#f3b56b', '#e89b4c'], 0.09, r * 0.98, 61);
    add(b, torus(0.04, 0.008, 5, 14, 4.6), C.cream, [0.01, r * 1.13, 0.02], [Math.PI / 2, 0, 0]); // swirl of cream
    scatter(b, 5, box(0.02, 0.004, 0.014), ['#3fa34d'], 0.09, r * 1.12, 67);
    g.add(b);
    const rice = new THREE.Group(); // rice on the side
    rice.position.set(0.19, 0, 0.02);
    add(rice, sphere(0.095, 12, 8), C.rice, [0, 0.03, 0], [0, 0, 0], [1, 0.75, 1]);
    scatter(rice, 4, box(0.014, 0.014, 0.014), [C.pea], 0.04, 0.095, 113);
    g.add(rice);
  },
  naan(g) {
    for (let i = 0; i < 3; i++) {
      const n = new THREE.Group();
      n.position.set((i - 1) * 0.035, 0.018 + i * 0.026, (i - 1) * -0.03);
      n.rotation.set(0.05 * (i - 1), i * 0.9, 0);
      add(n, sphere(0.2, 14, 8), '#f3d9a4', [0, 0, 0], [0, 0, 0], [1, 0.085, 0.72]); // teardrop flatbread
      add(n, sphere(0.09, 10, 6), '#f3d9a4', [0.17, 0, 0], [0, 0, 0], [1, 0.19, 0.9]);
      for (let k = 0; k < 5; k++) add(n, sphere(0.026, 6, 4), '#b9773a', [Math.cos(k * 2.3 + i) * 0.1, 0.012, Math.sin(k * 2.3 + i) * 0.07], [0, 0, 0], [1.3, 0.25, 1]); // toasty bubbles
      g.add(n);
    }
    add(g, sphere(0.05, 8, 6), '#ffe27a', [0.02, 0.088, -0.02], [0, 0, 0], [1.2, 0.15, 1]); // melted butter
    scatter(g, 6, box(0.016, 0.004, 0.01), ['#3fa34d'], 0.1, 0.09, 71);
  },
  samosa(g) {
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.3;
      const x = Math.cos(a) * 0.135;
      const z = Math.sin(a) * 0.135;
      add(g, cone(0.105, 0.15, 3), C.golden, [x, 0.075, z], [0, a * 1.7, 0], [1, 1, 0.8]);
      add(g, cone(0.11, 0.03, 3), '#c98a3c', [x, 0.015, z], [0, a * 1.7, 0], [1, 1, 0.8]); // crimped edge
    }
    add(g, cyl(0.055, 0.045, 0.04, 12), '#ffffff', [0, 0.02, 0]); // mint chutney
    add(g, cyl(0.047, 0.047, 0.006, 12), '#5aa02c', [0, 0.041, 0]);
  },
  lassi(g) {
    add(g, cyl(0.062, 0.075, 0.012, 14), '#c2185b', [0, 0.006, 0]); // coaster
    add(g, cyl(0.08, 0.06, 0.25, 16), '#ffb52e', [0, 0.137, 0]);
    add(g, cyl(0.083, 0.083, 0.03, 16), C.cream, [0, 0.274, 0]); // frothy top
    scatter(g, 6, box(0.012, 0.006, 0.012), ['#7fb23a'], 0.05, 0.288, 73); // pistachio
    add(g, cyl(0.05, 0.05, 0.014, 10, 0, Math.PI), C.mango, [0.075, 0.285, 0], [0, Math.PI / 2, Math.PI / 2]); // mango slice
    add(g, cyl(0.012, 0.012, 0.3, 6), '#2ec4b6', [-0.02, 0.33, -0.02], [0, 0, 0.2]);
  },

  // ---------------------------------------------------------------- Pasta Porch
  spaghetti(g) {
    add(g, cyl(0.25, 0.17, 0.035, 20), '#fdf6ec', [0, 0.0175, 0]); // pasta dish
    add(g, sphere(0.18, 16, 8), C.noodle, [0, 0.05, 0], [0, 0, 0], [1, 0.42, 1]);
    scatter(g, 16, torus(0.045, 0.009, 5, 12), [C.noodle, '#ffe08a'], 0.13, 0.095, 127);
    add(g, sphere(0.1, 12, 6), '#d6402b', [0, 0.118, 0], [0, 0, 0], [1, 0.4, 1]); // tomato sauce
    for (let i = 0; i < 3; i++) add(g, sphere(0.042, 10, 8), '#7a4526', [Math.cos(i * 2.1) * 0.06, 0.158, Math.sin(i * 2.1) * 0.06]); // meatballs
    add(g, sphere(0.03, 8, 6), '#3fa34d', [0, 0.2, 0], [0.3, 0, 0], [1, 0.15, 0.6]); // basil leaf
    scatter(g, 8, box(0.01, 0.006, 0.01), ['#fff8dc'], 0.1, 0.165, 131); // parmesan
  },
  ravioli(g) {
    add(g, cyl(0.24, 0.24, 0.012, 18), '#d6402b', [0, 0.006, 0]); // pool of tomato sauce
    const pillow = (x, y, z, ry) => {
      const p = new THREE.Group();
      p.position.set(x, y, z);
      p.rotation.set(0.1, ry, 0);
      add(p, box(0.12, 0.016, 0.12), '#ffe9a8'); // crimped square edge
      add(p, sphere(0.045, 8, 6), '#fff2c4', [0, 0.01, 0], [0, 0, 0], [1, 0.5, 1]); // puffy cheese middle
      g.add(p);
    };
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      pillow(Math.cos(a) * 0.14, 0.022 + (i % 2) * 0.008, Math.sin(a) * 0.14, 0.4 - a);
    }
    pillow(0, 0.045, 0, 0.6);
    for (const [x, z] of [[0.05, 0.06], [-0.07, -0.02]]) add(g, sphere(0.028, 8, 6), '#3fa34d', [x, 0.062, z], [0.2, x * 9, 0], [1, 0.15, 0.6]); // basil
    scatter(g, 10, box(0.01, 0.006, 0.01), ['#fffdf0'], 0.17, 0.05, 137);
  },
  garlicbread(g) {
    for (let i = 0; i < 4; i++) {
      const s = new THREE.Group();
      s.position.set(-0.18 + i * 0.12, 0.088, 0.02 - i * 0.012);
      s.rotation.set(0, -0.7, -0.5); // leaning like dominoes, buttery side to the camera
      s.scale.setScalar(1.25);
      add(s, cyl(0.085, 0.085, 0.04, 14), C.crust, [0, 0, 0], [0, 0, Math.PI / 2], [1, 1, 0.75]);
      add(s, cyl(0.07, 0.07, 0.006, 14), '#ffe9a8', [0.021, 0, 0], [0, 0, Math.PI / 2], [1, 1, 0.75]); // garlic butter
      for (let k = 0; k < 4; k++) add(s, box(0.004, 0.012, 0.012), '#3fa34d', [0.026, Math.cos(k * 1.9) * 0.035, Math.sin(k * 1.9) * 0.028]); // parsley
      g.add(s);
    }
  },

  // ---------------------------------------------------------------- Sunny Breakfast Cafe
  pancakes(g) {
    for (let i = 0; i < 4; i++) {
      const x = Math.sin(i * 2.2) * 0.012;
      const z = Math.cos(i * 1.7) * 0.012;
      add(g, cyl(0.17 - i * 0.006, 0.175 - i * 0.006, 0.03, 18), '#f0b860', [x, 0.016 + i * 0.032, z]);
      add(g, cyl(0.155 - i * 0.006, 0.155 - i * 0.006, 0.004, 18), '#c98a3c', [x, 0.032 + i * 0.032, z]); // browned top
    }
    add(g, sphere(0.11, 12, 6), '#8a4b14', [0, 0.131, 0], [0, 0, 0], [1, 0.1, 1]); // maple syrup
    for (const a of [0.4, 2.2, 4.1]) add(g, new THREE.CapsuleGeometry(0.014, 0.05, 3, 6), '#8a4b14', [Math.cos(a) * 0.163, 0.095, Math.sin(a) * 0.163]); // drips
    add(g, box(0.05, 0.02, 0.05), '#ffe27a', [0.01, 0.148, 0], [0, 0.5, 0]); // butter
    for (const [x, z] of [[-0.07, 0.05], [0.06, 0.07], [-0.02, -0.08]]) add(g, sphere(0.018, 8, 6), '#3f51b5', [x, 0.15, z]); // blueberries
  },
  waffles(g) {
    const waffle = (x, y, z, rot) => {
      const w = new THREE.Group();
      w.position.set(x, y, z);
      w.rotation.set(...rot);
      add(w, box(0.26, 0.03, 0.26), '#d9952f');
      for (let i = 0; i < 5; i++) {
        const o = -0.12 + i * 0.06;
        add(w, box(0.26, 0.022, 0.018), '#f6c65b', [0, 0.022, o]);
        add(w, box(0.018, 0.022, 0.26), '#f6c65b', [o, 0.022, 0]);
      }
      g.add(w);
    };
    waffle(-0.03, 0.016, 0.02, [0, 0.2, 0]);
    waffle(0.06, 0.085, -0.03, [0, -0.5, 0.3]); // the second one leans on the first
    add(g, sphere(0.045, 10, 8), C.cream, [-0.07, 0.075, 0.06], [0, 0, 0], [1, 0.7, 1]);
    add(g, cone(0.025, 0.035, 8), C.cream, [-0.07, 0.115, 0.06]);
    strawberry(g, -0.07, 0.155, 0.06);
    add(g, sphere(0.06, 10, 6), '#8a4b14', [-0.1, 0.05, -0.06], [0, 0, 0], [1, 0.12, 1]); // syrup puddle
  },
  eggsbacon(g) {
    // a smiley face: two sunny-side-up eyes and a wavy bacon smile
    for (const s of [-1, 1]) {
      add(g, sphere(0.085, 12, 6), '#ffffff', [s * 0.1, 0.012, -0.08], [0, 0, 0], [1.1, 0.14, 1]);
      add(g, sphere(0.05, 8, 6), '#ffffff', [s * 0.155, 0.012, -0.04], [0, 0, 0], [1, 0.14, 1]);
      add(g, sphere(0.036, 10, 8), '#ffb703', [s * 0.1, 0.026, -0.08], [0, 0, 0], [1, 0.6, 1]);
    }
    for (let i = 0; i < 7; i++) {
      const a = (i - 3) * 0.36;
      add(g, box(0.075, 0.012, 0.05), i % 2 ? '#b5432e' : '#d9694c', [Math.sin(a) * 0.19, 0.014 + (i % 2) * 0.012, Math.cos(a) * 0.19 - 0.06], [0, a, (i % 2 ? 1 : -1) * 0.25]);
    }
  },
  oj(g) {
    add(g, cyl(0.075, 0.06, 0.2, 16), '#ff9f1c', [-0.07, 0.1, 0]);
    add(g, cyl(0.078, 0.076, 0.03, 16), C.glass, [-0.07, 0.212, 0]);
    add(g, cyl(0.045, 0.045, 0.012, 12, 0, Math.PI), C.orange, [0.002, 0.215, 0.01], [0, Math.PI / 2, Math.PI / 2]);
    add(g, cyl(0.011, 0.011, 0.27, 6), '#3a86ff', [-0.085, 0.27, -0.02], [0, 0, 0.2]);
    // a juicy half orange and a whole one beside the glass
    add(g, new THREE.SphereGeometry(0.075, 14, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), C.orange, [0.13, 0.075, 0.06]);
    add(g, cyl(0.068, 0.068, 0.006, 14), '#ffc266', [0.13, 0.076, 0.06]);
    for (let i = 0; i < 3; i++) add(g, box(0.125, 0.004, 0.006), '#ffe8bf', [0.13, 0.08, 0.06], [0, (i / 3) * Math.PI, 0]);
    add(g, sphere(0.07, 12, 8), C.orange, [0.1, 0.07, -0.1]);
    add(g, sphere(0.025, 6, 4), '#3fa34d', [0.1, 0.142, -0.1], [0, 0.5, 0.3], [1, 0.2, 0.55]);
  },

  // ---------------------------------------------------------------- Fish & Ships
  fishchips(g) {
    add(g, box(0.42, 0.04, 0.27), '#e7f5ff', [0, 0.02, 0]); // paper tray
    for (const z of [-0.135, 0.135]) add(g, box(0.42, 0.07, 0.012), '#1c7ed6', [0, 0.035, z]);
    for (let i = 0; i < 10; i++) {
      add(g, box(0.03, 0.03, 0.15), C.fry, [-0.17 + (i % 5) * 0.042, 0.056 + (i > 4 ? 0.028 : 0), -0.01 + Math.sin(i * 1.3) * 0.03], [0, 0.35 * Math.sin(i * 1.9), 0.1]);
    }
    for (const [x, z, ry] of [[0.09, 0.045, 0.3], [0.11, -0.06, -0.2]]) {
      add(g, new THREE.CapsuleGeometry(0.045, 0.13, 4, 10), C.golden, [x, 0.085, z], [0, ry, Math.PI / 2], [0.6, 1, 1.1]); // battered fish
    }
    add(g, cyl(0.045, 0.045, 0.03, 8, 0, Math.PI), '#ffe14d', [-0.1, 0.1, 0.06], [0.3, 0.6, 0]); // lemon wedge
    add(g, cyl(0.04, 0.033, 0.035, 10), '#ffffff', [0.0, 0.085, 0.09]); // tartar sauce
    add(g, cyl(0.034, 0.034, 0.005, 10), '#f1f3d0', [0.0, 0.104, 0.09]);
  },
  popcornshrimp(g) {
    add(g, cyl(0.15, 0.11, 0.17, 16), '#ffffff', [0, 0.085, 0]); // paper tub
    add(g, cyl(0.153, 0.146, 0.03, 16), C.red, [0, 0.152, 0]);
    add(g, cyl(0.125, 0.118, 0.03, 16), C.red, [0, 0.04, 0]);
    add(g, sphere(0.14, 12, 6), C.golden, [0, 0.165, 0], [0, 0, 0], [1, 0.3, 1]);
    const curl = torus(0.022, 0.013, 5, 8, 4.2);
    scatter(g, 14, curl, [C.golden, '#f0b860'], 0.11, 0.185, 79);
    scatter(g, 6, curl, ['#f0b860', C.golden], 0.06, 0.22, 83);
    scatter(g, 6, cone(0.012, 0.03, 5), ['#ff8a70'], 0.1, 0.21, 89); // little pink tails
    add(g, cyl(0.045, 0.038, 0.035, 10), '#ffffff', [0.2, 0.0175, 0.1]); // dipping sauce
    add(g, cyl(0.038, 0.038, 0.005, 10), '#ff7a59', [0.2, 0.036, 0.1]);
  },
  corncob(g) {
    for (const [z, ry] of [[0.075, 0.12], [-0.08, -0.18]]) {
      const c = new THREE.Group();
      c.position.set(0, 0.062, z);
      c.rotation.y = ry;
      add(c, new THREE.CapsuleGeometry(0.05, 0.22, 4, 12), '#ffd23f', [0, 0, 0], [0, 0, Math.PI / 2]);
      for (let row = 0; row < 7; row++) {
        const a = (row / 7) * Math.PI * 2;
        for (let k = 0; k < 8; k++) add(c, sphere(0.018, 5, 4), row % 2 ? '#ffe066' : '#ffc81f', [-0.119 + k * 0.034, Math.cos(a) * 0.048, Math.sin(a) * 0.048]); // kernels
      }
      for (const s of [-1, 1]) add(c, cyl(0.018, 0.012, 0.07, 6), '#2f9e44', [s * 0.195, 0, 0], [0, 0, s * -Math.PI / 2]); // holders
      g.add(c);
    }
    add(g, box(0.05, 0.018, 0.05), '#fff3b0', [0.02, 0.123, 0.075], [0, 0.4, 0]); // melting butter
  },

  // ---------------------------------------------------------------- Pita Picnic
  chickenpita(g) {
    // a half-moon pocket standing in a paper wrap, stuffed to the top
    add(g, cyl(0.17, 0.17, 0.085, 16, -Math.PI / 2, Math.PI), '#f0cf96', [0, 0.2, 0], [Math.PI / 2, 0, 0]);
    add(g, cyl(0.11, 0.03, 0.13, 10), '#ffd54f', [0, 0.085, 0], [0, 0, 0], [1, 1, 0.6]);
    for (const x of [-0.1, 0, 0.1]) add(g, sphere(0.05, 8, 6), C.lettuce, [x, 0.205, -0.008], [0, 0, 0], [1.2, 0.5, 0.75]);
    for (let i = 0; i < 4; i++) add(g, new THREE.IcosahedronGeometry(0.03, 0), '#e8b06a', [-0.105 + i * 0.07, 0.228, 0.008], [i, i * 2, 0]); // chicken
    for (const x of [-0.07, 0.07]) add(g, cyl(0.03, 0.03, 0.012, 10), C.tomato, [x, 0.222, -0.02], [1.1, 0, 0.3]);
    for (let i = 0; i < 5; i++) add(g, sphere(0.014, 6, 4), '#ffffff', [-0.09 + i * 0.045, 0.245, 0.012 * (i % 2 ? 1 : -1)], [0, 0, 0], [1.4, 0.6, 1]); // garlic sauce
    for (const [x, z] of [[0.2, 0.08], [0.24, 0.02]]) add(g, sphere(0.028, 8, 6), C.tomato, [x, 0.028, z]); // cherry tomatoes
  },
  falafel(g) {
    add(g, cyl(0.2, 0.15, 0.04, 16), '#0fa3b1', [0, 0.02, 0]);
    const spots = [[0, 0.135, 0]];
    for (let i = 0; i < 5; i++) spots.push([Math.cos(i * 1.257) * 0.105, 0.085, Math.sin(i * 1.257) * 0.105]);
    spots.forEach(([x, y, z], i) => add(g, new THREE.IcosahedronGeometry(0.054, 1), i % 2 ? '#a8672a' : '#b9773a', [x, y, z], [i, i * 1.7, 0]));
    add(g, sphere(0.03, 8, 6), C.cream, [0, 0.185, 0], [0, 0, 0], [1.3, 0.3, 1.3]); // tahini drizzle
    scatter(g, 8, box(0.014, 0.004, 0.01), ['#3fa34d'], 0.13, 0.14, 139);
    add(g, cyl(0.045, 0.045, 0.03, 8, 0, Math.PI), '#ffe14d', [0.2, 0.03, 0.09], [0.3, 0.6, 0]); // lemon
  },
  hummus(g) {
    add(g, cyl(0.19, 0.13, 0.055, 18), '#ffffff', [0, 0.0275, 0]);
    add(g, torus(0.19, 0.01, 6, 20), '#0fa3b1', [0, 0.055, 0], [Math.PI / 2, 0, 0]);
    add(g, sphere(0.175, 16, 8), '#e8cf9a', [0, 0.055, 0], [0, 0, 0], [1, 0.22, 1]);
    add(g, torus(0.09, 0.013, 5, 18), '#d9bb80', [0, 0.086, 0], [Math.PI / 2, 0, 0]); // swirl
    add(g, cyl(0.05, 0.05, 0.004, 12), '#d9a400', [0, 0.094, 0]); // olive oil
    for (let i = 0; i < 3; i++) add(g, sphere(0.015, 6, 4), '#e3c078', [Math.cos(i * 2.1) * 0.02, 0.102, Math.sin(i * 2.1) * 0.02]); // chickpeas
    scatter(g, 8, box(0.008, 0.004, 0.008), ['#c81e1e'], 0.12, 0.09, 149); // paprika
    for (let i = 0; i < 5; i++) {
      const a = Math.PI + (i - 2) * 0.5;
      add(g, cyl(0.075, 0.075, 0.012, 3), '#f0cf96', [Math.sin(a) * 0.2, 0.085, Math.cos(a) * 0.2], [0.9, a, 0]); // pita chips to scoop with
    }
    for (let i = 0; i < 2; i++) add(g, box(0.02, 0.02, 0.13), i ? C.carrot : C.cucumber, [0.2 + i * 0.03, 0.02, 0.1 - i * 0.04], [0, 0.5 + i * 0.3, 0]);
  },

  // ---------------------------------------------------------------- Cozy BBQ
  slider(g) {
    for (const s of [-1, 1]) {
      const x = s * 0.115;
      add(g, cyl(0.095, 0.088, 0.035, 14), C.bun, [x, 0.0175, 0]);
      add(g, sphere(0.1, 10, 6), '#c9682c', [x, 0.05, 0], [0, 0, 0], [1, 0.3, 1]); // saucy pulled chicken
      for (let i = 0; i < 6; i++) add(g, box(0.05, 0.012, 0.014), '#e08a45', [x + Math.cos(i * 1.05) * 0.075, 0.052, Math.sin(i * 1.05) * 0.075], [0.3, i * 1.05, 0.2]); // shreds
      add(g, sphere(0.095, 10, 6), '#e9f5db', [x, 0.076, 0], [0, 0, 0], [1, 0.2, 1]); // coleslaw
      add(g, sphere(0.097, 14, 8), C.bunTop, [x, 0.09, 0], [0, 0, 0], [1, 0.6, 1]);
      add(g, cyl(0.035, 0.035, 0.008, 10), '#7fb23a', [x, 0.152, 0]); // pickle chip
      add(g, cyl(0.004, 0.004, 0.13, 4), '#e9d8a6', [x, 0.2, 0]); // toothpick
      add(g, box(0.05, 0.03, 0.003), s < 0 ? C.red : '#3a86ff', [x + 0.025, 0.25, 0]); // little flag
    }
  },
  cornbread(g) {
    add(g, cyl(0.2, 0.17, 0.045, 18), '#2b2b2b', [0, 0.0225, 0]); // mini cast-iron skillet
    add(g, box(0.16, 0.022, 0.045), '#2b2b2b', [0.26, 0.03, 0]);
    for (const [x, y, z, ry] of [[-0.065, 0.083, 0.04, 0.2], [0.07, 0.083, -0.035, -0.3], [0, 0.164, 0, 0.6]]) {
      add(g, box(0.125, 0.075, 0.125), '#ffc93c', [x, y, z], [0, ry, 0]);
      add(g, box(0.127, 0.012, 0.127), '#d9952f', [x, y + 0.04, z], [0, ry, 0]); // golden crust
    }
    add(g, box(0.045, 0.018, 0.045), '#fff3b0', [0, 0.218, 0], [0, 0.2, 0]); // butter
    add(g, sphere(0.05, 8, 6), '#f0a500', [0.01, 0.211, 0.01], [0, 0, 0], [1.2, 0.12, 1]); // honey
  },
  bbqmac(g) {
    add(g, cyl(0.2, 0.17, 0.06, 18), '#2b2b2b', [0, 0.03, 0]); // skillet, straight from the oven
    add(g, box(0.16, 0.022, 0.045), '#2b2b2b', [-0.26, 0.045, 0]);
    add(g, sphere(0.185, 16, 8), '#ffb703', [0, 0.06, 0], [0, 0, 0], [1, 0.3, 1]);
    scatter(g, 18, torus(0.022, 0.009, 5, 8, Math.PI), ['#ffc93c', '#ffd766'], 0.14, 0.1, 97);
    scatter(g, 12, box(0.016, 0.01, 0.016), ['#b9773a', '#d9952f'], 0.13, 0.115, 101); // toasty crumbs
    scatter(g, 5, box(0.014, 0.004, 0.01), ['#3fa34d'], 0.1, 0.122, 103);
  },
};

export const hasFoodModel = (id) => Object.prototype.hasOwnProperty.call(BUILDERS, id);

/** Does build-your-own topping `id` of kitchen `kind` have a 3D piece? (the sundae's are all inside mySundae) */
export const hasToppingModel = (kind, id) => (kind === 'pizza' ? Object.prototype.hasOwnProperty.call(PIZZA_TOPS, id) : kind === 'sundae');

/**
 * Build a food model by menu item id. `twistTint` (a hex color or 'rainbow') re-tints it
 * for a Mystery Plate; `build` ({ k, b, t }, already checked) is what goes on a build-your-own food.
 * Meshes are merged (colors baked into the vertices) to keep draw calls low on iPad.
 */
export function createFood(id, accent, twistTint = null, build = null) {
  const g = new THREE.Group();
  tint = twistTint;
  tintN = 0;
  recipe = build;
  if (tint && tint !== 'rainbow') tintColor.set(tint);
  try {
    (hasFoodModel(id) ? BUILDERS[id] : BUILDERS.cookie)(g, accent);
  } finally {
    tint = null;
    recipe = null;
  }
  mergeStatic(g, { bake: true }); // plain colors become one mesh: a draw call or two per food
  return g;
}
