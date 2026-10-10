// The town: plaza, fountain, a ring of original restaurant buildings, trees, flowers,
// plus a cozy interior "set" (far away in the same scene) used for review mode.
// Everything is laid out from RESTAURANTS.length, so adding a restaurant is data-only.
import * as THREE from '../vendor/three.module.js';
import { RESTAURANTS } from './data.js';
import { mat, signTexture, starsCanvas, checkerTexture, stripeTexture, clamp, mergeStatic } from './util.js';

export const RING_RADIUS = 39; // room for ~20 buildings (each 8–11 wide)
export const WORLD_RADIUS = 48; // walkable edge; must stay under WORLD_LIMIT (schema.js)
const PLAZA_RADIUS = 16;
/** Angle of ring slot `i` (fractions sit between buildings). Slot 0 is straight ahead of the spawn point. */
const ringAngle = (i) => (i / RESTAURANTS.length) * Math.PI * 2 + Math.PI;
export const INTERIOR_ORIGIN = new THREE.Vector3(0, 0, 400);

// --------------------------------------------------------------------- helpers
function add(parent, geometry, material, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geometry, typeof material === 'string' ? mat(material) : material);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  parent.add(m);
  return m;
}
const box = (w, hgt, d) => new THREE.BoxGeometry(w, hgt, d);
const cyl = (rt, rb, hgt, seg = 16) => new THREE.CylinderGeometry(rt, rb, hgt, seg);
const sphere = (r, w = 12, hs = 8) => new THREE.SphereGeometry(r, w, hs);
const cone = (r, hgt, seg = 12) => new THREE.ConeGeometry(r, hgt, seg);

// --------------------------------------------------------------------- decorations
function tree(parent, x, z, kind = 0, s = 1) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.scale.setScalar(s);
  add(g, cyl(0.25, 0.35, 1.6, 8), '#8d5a3b', 0, 0.8, 0);
  const leaf = ['#5cc96b', '#ff9ecf', '#8bd450', '#ffd166'][kind % 4];
  const leaf2 = ['#4caf5c', '#ffb8dc', '#76c043', '#ffc14d'][kind % 4];
  add(g, new THREE.IcosahedronGeometry(1.3, 1), leaf, 0, 2.3, 0);
  add(g, new THREE.IcosahedronGeometry(0.95, 1), leaf2, 0.45, 3.1, 0.2);
  add(g, new THREE.IcosahedronGeometry(0.8, 1), leaf, -0.5, 2.9, -0.3);
  parent.add(g);
}

function lamp(parent, x, z) {
  add(parent, cyl(0.09, 0.12, 3, 8), '#5b4b8a', x, 1.5, z);
  add(parent, sphere(0.32, 12, 10), mat('#fff3b0', { emissive: '#ffd66b', emissiveIntensity: 0.8 }), x, 3.15, z);
  add(parent, cone(0.34, 0.25, 8), '#5b4b8a', x, 3.5, z);
}

function bench(parent, x, z, ry) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = ry;
  add(g, box(2, 0.12, 0.6), '#ff9f68', 0, 0.55, 0);
  add(g, box(2, 0.5, 0.1), '#ff9f68', 0, 0.9, -0.28);
  for (const sx of [-0.85, 0.85]) add(g, box(0.1, 0.55, 0.5), '#6d4c8d', sx, 0.27, 0);
  parent.add(g);
}

function flowerPatch(scene, count) {
  const g = new THREE.SphereGeometry(0.16, 8, 6);
  const m = new THREE.MeshLambertMaterial();
  const inst = new THREE.InstancedMesh(g, m, count);
  const colors = ['#ff5fa2', '#ffd23f', '#ffffff', '#9b5de5', '#ff9f1c', '#3a86ff'].map((c) => new THREE.Color(c));
  const d = new THREE.Object3D();
  let n = 0;
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  // rejection sampling, with a cap on tries so a crowded town can never hang the page
  for (let tries = 0; n < count && tries < count * 50; tries++) {
    const a = rnd() * Math.PI * 2;
    const r = PLAZA_RADIUS + 0.5 + rnd() * (WORLD_RADIUS - PLAZA_RADIUS - 1);
    const x = Math.sin(a) * r;
    const z = Math.cos(a) * r;
    // keep flowers off building footprints, doorways & the paths leading to them
    const inTheWay = RESTAURANTS.some((_, i) => {
      const ba = ringAngle(i);
      const along = x * Math.sin(ba) + z * Math.cos(ba);
      const across = Math.abs(x * Math.cos(ba) - z * Math.sin(ba));
      return (along > 0 && along < RING_RADIUS && across < 2.2) || Math.hypot(along - RING_RADIUS, across) < 8.5;
    });
    if (inTheWay) continue;
    d.position.set(x, 0.18, z);
    d.scale.set(1, 0.6, 1);
    d.updateMatrix();
    inst.setMatrixAt(n, d.matrix);
    inst.setColorAt(n, colors[n % colors.length]);
    n++;
  }
  inst.count = n;
  scene.add(inst);
}

// --------------------------------------------------------------------- restaurants
// Each builder creates a building in local space: front face at +z, door at (0, 0, D/2).
// They return { w, d, h } for colliders and star placement.

function windowsRow(g, w, y, z, color = '#bfe9ff', count = 2, gap = 2.6) {
  for (let i = 0; i < count; i++) {
    const x = (i - (count - 1) / 2) * gap;
    if (Math.abs(x) < 1.2) continue;
    add(g, box(1.4, 1.2, 0.12), '#ffffff', x, y, z);
    add(g, box(1.2, 1.0, 0.14), mat(color, { emissive: '#5aa9d6', emissiveIntensity: 0.25 }), x, y, z + 0.01);
    add(g, box(1.5, 0.15, 0.4), '#ffffff', x, y - 0.65, z + 0.12);
  }
}

function door(g, z, color = '#7b4a2a', frame = '#ffffff') {
  add(g, box(1.9, 2.6, 0.14), frame, 0, 1.3, z);
  add(g, box(1.6, 2.4, 0.16), color, 0, 1.2, z + 0.01);
  add(g, box(1.2, 0.9, 0.17), mat('#bfe9ff', { emissive: '#5aa9d6', emissiveIntensity: 0.25 }), 0, 1.75, z + 0.015);
  add(g, sphere(0.08, 8, 6), '#ffd23f', 0.55, 1.15, z + 0.12);
}

function awning(g, w, y, z, a, b) {
  const geo = new THREE.PlaneGeometry(w, 1.2);
  const m = new THREE.MeshLambertMaterial({ map: stripeTexture(a, b, 10), side: THREE.DoubleSide });
  const aw = new THREE.Mesh(geo, m);
  aw.position.set(0, y, z + 0.55);
  aw.rotation.x = -Math.PI / 3.2;
  g.add(aw);
}

// Giant rooftop foods. Each is built in its own group with its base at y = 0 and
// returns its height, so any shell can wear any prop (`prop` in data.js).
const ROOF_PROPS = {
  sandwich(s) {
    add(s, box(4.4, 0.6, 2.4), '#f2c27b', 0, 0.3, 0);
    add(s, box(4.6, 0.2, 2.6), '#6cc644', 0, 0.7, 0);
    add(s, box(4.3, 0.35, 2.3), '#f4b7a0', 0, 0.95, 0);
    add(s, box(4.5, 0.12, 2.5), '#ffcf33', 0, 1.18, 0, 0, 0.06, 0);
    add(s, box(4.4, 0.6, 2.4), '#f2c27b', 0, 1.55, 0);
    add(s, cyl(0.05, 0.05, 1.2, 6), '#e9d8a6', 0, 2.2, 0);
    add(s, sphere(0.22, 10, 8), '#d62828', 0, 2.8, 0);
    return 3.0;
  },
  milkshake(c) {
    add(c, cyl(0.9, 0.7, 2.2, 16), '#ffc8dd', 0, 1.1, 0);
    add(c, cyl(0.93, 0.93, 0.35, 16), '#ffffff', 0, 1.6, 0);
    add(c, sphere(0.85, 14, 10), '#fffaf0', 0, 2.35, 0).scale.y = 0.6;
    add(c, sphere(0.55, 14, 10), '#fffaf0', 0, 2.75, 0);
    add(c, sphere(0.28, 10, 8), '#e5383b', 0, 3.35, 0);
    add(c, cyl(0.1, 0.1, 2.2, 8), '#ff5fa2', 0.35, 3.1, -0.2, 0, 0, -0.3);
    return 3.6;
  },
  burger(b) {
    add(b, cyl(1.6, 1.5, 0.5, 20), '#e9a64f', 0, 0.25, 0);
    add(b, cyl(1.7, 1.7, 0.15, 20), '#6cc644', 0, 0.55, 0);
    add(b, cyl(1.65, 1.65, 0.45, 20), '#6b3a1f', 0, 0.8, 0);
    add(b, box(2.9, 0.12, 2.9), '#ffcf33', 0, 1.08, 0, 0, Math.PI / 4, 0);
    add(b, sphere(1.65, 20, 12), '#f0b35f', 0, 1.15, 0).scale.y = 0.6;
    return 2.15;
  },
  burrito(b) {
    add(b, new THREE.CapsuleGeometry(0.9, 3.6, 4, 14), '#f3dca6', 0.6, 0.9, 0, 0, 0, Math.PI / 2);
    add(b, cyl(0.95, 0.95, 2.4, 16), '#c9cfd6', -1.0, 0.9, 0, 0, 0, Math.PI / 2);
    return 1.85;
  },
  taco(t) {
    add(t, new THREE.CylinderGeometry(1.6, 1.6, 3.2, 20, 1, true, Math.PI, Math.PI), mat('#f6c453', { side: THREE.DoubleSide }), 0, 1.6, 0, 0, 0, Math.PI / 2);
    add(t, box(2.8, 0.9, 1.4), '#6cc644', 0, 1.65, 0);
    add(t, box(2.6, 0.5, 1.0), '#ffcf33', 0, 1.95, 0);
    return 2.2;
  },
  // one fat piece of maki tipped toward the plaza, chopsticks resting across it
  maki(p) {
    const m = new THREE.Group();
    m.position.y = 0.6;
    m.rotation.x = 0.8;
    add(m, cyl(1.3, 1.3, 1.15, 20), '#22382c', 0, 0.575, 0);
    add(m, cyl(1.16, 1.16, 0.1, 20), '#fbf6ea', 0, 1.16, 0);
    add(m, cyl(0.36, 0.36, 0.1, 10), '#ff8c69', -0.3, 1.22, 0.02);
    add(m, cyl(0.3, 0.3, 0.1, 10), '#9bd15b', 0.34, 1.22, -0.04);
    add(m, cyl(0.26, 0.26, 0.1, 10), '#ffd23f', 0.02, 1.22, -0.5);
    for (const z of [0.66, 0.92]) add(m, cyl(0.07, 0.05, 3.6, 6), '#c98a3c', 0.15, 1.34, z, 0, 0.12, Math.PI / 2);
    p.add(m);
    return 2.45;
  },
  // a slice balanced on its tip
  pizza(p) {
    const wedge = (r, depth, color, z = 0) => add(p, new THREE.CylinderGeometry(r, r, depth, 8, 1, false, Math.PI - 0.5, 1.0), color, 0, 0.1, z, Math.PI / 2, 0, 0);
    wedge(2.5, 0.3, '#e9a64f');
    wedge(2.2, 0.36, '#ffd95a');
    add(p, new THREE.TorusGeometry(2.5, 0.24, 6, 10, 1.0), '#c98a3c', 0, 0.1, 0, 0, 0, Math.PI / 2 - 0.5);
    for (const [x, y] of [[0, 0.95], [-0.42, 1.65], [0.42, 1.75]]) add(p, cyl(0.26, 0.26, 0.44, 10), '#b02a2a', x, y + 0.1, 0, Math.PI / 2, 0, 0);
    p.rotation.z = 0.12;
    return 2.9;
  },
  // a frosted donut standing on its edge
  donut(d) {
    add(d, new THREE.TorusGeometry(1.25, 0.6, 10, 22), '#e0a458', 0, 1.85, 0);
    add(d, new THREE.TorusGeometry(1.25, 0.52, 8, 22), '#ff8fc7', 0, 1.85, 0.22);
    const cols = ['#ffffff', '#3a86ff', '#ffd23f', '#7ae582', '#9b5de5'];
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const r = 1.1 + (i % 3) * 0.15;
      add(d, box(0.34, 0.1, 0.1), cols[i % cols.length], Math.cos(a) * r, 1.85 + Math.sin(a) * r, 0.74 - Math.abs(r - 1.25) * 0.3, 0, 0, i * 1.3);
    }
    return 3.7;
  },
  // a cup of milk tea with chewy pearls and a fat straw
  boba(c) {
    add(c, cyl(0.95, 0.7, 2.3, 16), '#e2b98a', 0, 1.15, 0);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const y = 0.28 + (i % 3) * 0.26;
      add(c, sphere(0.17, 8, 6), '#2b1a12', Math.cos(a) * (0.69 + y * 0.1), y, Math.sin(a) * (0.69 + y * 0.1));
    }
    add(c, cyl(1.0, 1.0, 0.16, 16), '#ffffff', 0, 2.38, 0);
    add(c, cyl(0.17, 0.17, 2.4, 8), '#ff5fa2', 0.2, 3.0, 0, 0, 0, -0.16);
    return 4.1;
  },
  // three scoops in a glass dish, hot fudge and a cherry
  sundae(u) {
    add(u, cyl(0.2, 0.6, 0.5, 12), '#d7ecff', 0, 0.25, 0);
    add(u, cyl(1.45, 0.5, 0.95, 16), '#d7ecff', 0, 0.97, 0);
    for (const [color, x, z] of [['#fff3d6', -0.6, 0.38], ['#ff9ec4', 0.6, 0.38], ['#7b4a2a', 0, -0.6]]) add(u, sphere(0.72, 12, 8), color, x, 1.65, z);
    add(u, sphere(0.8, 12, 8), '#4a2b1a', 0, 2.05, 0).scale.y = 0.42;
    add(u, sphere(0.45, 10, 8), '#fffaf0', 0, 2.45, 0);
    add(u, sphere(0.24, 10, 8), '#e5383b', 0, 2.98, 0);
    return 3.25;
  },
};

/** Put restaurant r's rooftop prop on shell g at (x, y, z). Returns its top height (0 if it has none). */
function roofProp(g, r, x, y, z) {
  if (!r.prop) return 0;
  const p = new THREE.Group();
  p.position.set(x, y, z);
  const height = ROOF_PROPS[r.prop](p);
  g.add(p);
  return y + height;
}

const BUILDERS = {
  pagoda(g, r) {
    const W = 9;
    const D = 7;
    add(g, box(W + 0.6, 0.4, D + 0.6), '#f4e1c1', 0, 0.2, 0);
    add(g, box(W, 3.6, D), r.wall, 0, 2.2, 0);
    // two tiers of upturned roofs
    const roof1 = add(g, cone(7.6, 1.8, 4), r.roof, 0, 4.9, 0, 0, Math.PI / 4, 0);
    roof1.scale.set(1, 1, D / W + 0.1);
    add(g, box(5.6, 2.2, 4.4), r.wall, 0, 6.3, 0);
    const roof2 = add(g, cone(5.2, 1.6, 4), r.roof, 0, 8.1, 0, 0, Math.PI / 4, 0);
    roof2.scale.set(1, 1, 0.85);
    const top = roofProp(g, r, 0, 8.7, 0);
    if (!top) {
      add(g, sphere(0.45, 12, 10), r.trim, 0, 9.1, 0);
      add(g, cyl(0.12, 0.12, 0.8, 8), r.trim, 0, 9.6, 0);
    }
    for (const [x, z] of [[-5.2, 4], [5.2, 4], [-5.2, -4], [5.2, -4]]) add(g, cone(0.35, 0.8, 6), r.trim, x, 4.15, z, 0, 0, 0);
    // gold pillars + round "moon" door frame
    for (const x of [-3.6, 3.6]) add(g, cyl(0.28, 0.28, 3.6, 10), r.trim, x, 2.2, D / 2 + 0.2);
    const ring = add(g, new THREE.TorusGeometry(1.25, 0.18, 8, 24), r.trim, 0, 1.6, D / 2 + 0.12);
    ring.scale.y = 1.15;
    door(g, D / 2, '#7a1c1c', r.trim);
    windowsRow(g, W, 2.4, D / 2, '#ffe8a3', 2, 5.4);
    // hanging lanterns
    for (const x of [-2.4, 2.4]) {
      add(g, cyl(0.02, 0.02, 0.5, 4), '#333333', x, 3.95, D / 2 + 1.0);
      add(g, sphere(0.36, 12, 10), mat('#ff3b30', { emissive: '#ff3b30', emissiveIntensity: 0.4 }), x, 3.45, D / 2 + 1.0).scale.y = 1.2;
      add(g, cyl(0.2, 0.2, 0.1, 10), r.trim, x, 2.98, D / 2 + 1.0);
    }
    return { w: W, d: D, h: Math.max(9.5, top), signY: 6.35, signZ: 2.25 };
  },

  deli(g, r) {
    const W = 8;
    const D = 7;
    add(g, box(W, 4.6, D), r.wall, 0, 2.3, 0);
    add(g, box(W + 0.3, 0.5, D + 0.3), r.roof, 0, 4.85, 0);
    // checker trim band
    const band = new THREE.Mesh(new THREE.PlaneGeometry(W, 0.5), new THREE.MeshLambertMaterial({ map: checkerTexture(r.trim, '#ffffff', 2) }));
    band.material.map = band.material.map.clone();
    band.material.map.wrapS = THREE.RepeatWrapping;
    band.material.map.repeat.set(16, 1);
    band.material.map.needsUpdate = true;
    band.position.set(0, 0.35, D / 2 + 0.01);
    g.add(band);
    door(g, D / 2, r.accent);
    windowsRow(g, W, 1.8, D / 2, '#bfe9ff', 2, 5);
    awning(g, W - 0.4, 3.2, D / 2, r.accent, '#ffffff');
    const top = roofProp(g, r, 0, 5.1, -0.5);
    return { w: W, d: D, h: Math.max(6.2, top) + 0.4, signY: 4.0, signZ: D / 2 + 0.25 };
  },

  cottage(g, r) {
    const W = 8.5;
    const D = 7;
    add(g, box(W, 3.8, D), r.wall, 0, 1.9, 0);
    // gabled roof: a triangular prism running front-to-back, apex up
    const roof = add(g, cyl(3.4, 3.4, D + 1.2, 3), r.roof, 0, 3.8 + 1.7 * 0.75, 0, -Math.PI / 2, 0, 0);
    roof.scale.set(1.6, 1, 0.75);
    add(g, box(0.9, 2.2, 0.9), '#b5523b', 2.6, 6.2, -1.2);
    add(g, new THREE.CircleGeometry(0.6, 16), mat('#bfe9ff', { emissive: '#5aa9d6', emissiveIntensity: 0.25 }), 0, 5.0, (D + 1.2) / 2 + 0.02);
    door(g, D / 2, r.accent);
    windowsRow(g, W, 2.1, D / 2, '#bfe9ff', 2, 5.2);
    awning(g, 3, 2.9, D / 2, r.accent, '#ffffff');
    // picket fence
    for (const side of [-1, 1]) {
      for (let i = 0; i < 4; i++) add(g, box(0.18, 0.9, 0.08), '#ffffff', side * (1.7 + i * 0.6), 0.45, D / 2 + 1.6);
      add(g, box(2.2, 0.12, 0.06), '#ffffff', side * 2.6, 0.65, D / 2 + 1.6);
    }
    const top = roofProp(g, r, -2.2, 5.6, 0.4); // sits on the roof slope
    return { w: W, d: D, h: Math.max(8.2, top) + 0.4, signY: 3.2, signZ: D / 2 + 1.0 };
  },

  diner(g, r) {
    const W = 9;
    const D = 7;
    add(g, box(W - 2, 4, D), r.wall, 0, 2, 0);
    for (const x of [-(W / 2 - 1), W / 2 - 1]) add(g, cyl(1, 1, 4, 20), r.wall, x, 2, 0).scale.z = D / 2;
    add(g, box(W + 0.4, 0.8, D + 0.4), r.roof, 0, 4.4, 0);
    add(g, box(W + 0.4, 0.25, D + 0.4), '#ffffff', 0, 4.9, 0);
    door(g, D / 2, '#ffe066');
    windowsRow(g, W, 2.0, D / 2, '#bfe9ff', 2, 5.2);
    const top = roofProp(g, r, 0, 5.03, -0.6);
    // little side slide
    const s = new THREE.Group();
    s.position.set(W / 2 + 1.8, 0, 1);
    add(s, box(1.2, 2.2, 1.2), '#3a86ff', 0, 1.1, -1.2);
    add(s, box(1, 0.15, 3), '#ffd23f', 0, 1.1, 0.6, -0.6, 0, 0);
    g.add(s);
    return { w: W + 2, d: D, h: Math.max(6.2, top) + 0.7, signY: 3.6, signZ: D / 2 + 0.25 };
  },

  adobe(g, r) {
    const W = 9;
    const D = 7;
    add(g, box(W, 3.8, D), r.wall, 0, 1.9, 0);
    add(g, box(W + 0.4, 0.6, D + 0.4), r.roof, 0, 4.0, 0);
    for (let i = 0; i < 6; i++) if (i !== 2 && i !== 3) add(g, cyl(0.16, 0.16, 1.0, 8), '#7b4a2a', -3.6 + i * 1.45, 3.45, D / 2 + 0.3, Math.PI / 2, 0, 0);
    door(g, D / 2, r.accent, r.trim);
    windowsRow(g, W, 1.9, D / 2, '#bfe9ff', 2, 5.4);
    // cactus pots
    for (const x of [-3.2, 3.2]) {
      add(g, cyl(0.45, 0.35, 0.6, 10), '#c96d3b', x, 0.3, D / 2 + 1.1);
      add(g, cyl(0.28, 0.28, 1.4, 8), '#3a9a4a', x, 1.3, D / 2 + 1.1);
      add(g, sphere(0.28, 8, 6), '#3a9a4a', x, 2.0, D / 2 + 1.1);
      add(g, cyl(0.15, 0.15, 0.6, 8), '#3a9a4a', x + 0.4, 1.4, D / 2 + 1.1, 0, 0, 0.9);
      add(g, sphere(0.12, 8, 6), '#ff7eb6', x, 2.3, D / 2 + 1.1);
    }
    const top = roofProp(g, r, 0, 4.3, -0.5);
    return { w: W, d: D, h: Math.max(5.6, top) + 0.8, signY: 3.25, signZ: D / 2 + 0.15 };
  },

  train(g, r) {
    const W = 10;
    const D = 6;
    add(g, box(W, 3, D), r.wall, 0, 2.0, 0);
    add(g, new THREE.CylinderGeometry(D / 2, D / 2, W, 20, 1, false, 0, Math.PI), r.wall, 0, 3.5, 0, 0, 0, Math.PI / 2);
    add(g, box(W + 0.05, 0.5, D + 0.05), r.roof, 0, 1.0, 0);
    add(g, box(W + 0.05, 0.25, D + 0.05), '#ffffff', 0, 3.4, 0);
    // round porthole windows
    for (const x of [-3.6, -2.2, 2.2, 3.6]) {
      add(g, new THREE.CircleGeometry(0.62, 18), '#ffffff', x, 2.5, D / 2 + 0.02);
      add(g, new THREE.CircleGeometry(0.5, 18), mat('#bfe9ff', { emissive: '#5aa9d6', emissiveIntensity: 0.25 }), x, 2.5, D / 2 + 0.03);
    }
    door(g, D / 2, '#ffd23f');
    // wheels
    for (const x of [-3.5, -1.8, 1.8, 3.5]) {
      for (const z of [-D / 2 - 0.05, D / 2 + 0.05]) add(g, cyl(0.6, 0.6, 0.3, 16), '#3b3355', x, 0.6, z, Math.PI / 2, 0, 0);
    }
    add(g, cyl(0.25, 0.3, 1.2, 10), '#3b3355', 3.8, 6.8, 0);
    add(g, cyl(0.4, 0.25, 0.3, 10), '#3b3355', 3.8, 7.5, 0);
    const top = roofProp(g, r, -0.4, 6.35, 0);
    return { w: W, d: D, h: Math.max(8.3, top) + 0.7, signY: 4.7, signZ: D / 2 - 0.1 };
  },

  mission(g, r) {
    const W = 9;
    const D = 7;
    add(g, box(W, 4, D), r.wall, 0, 2, 0);
    // stepped parapet
    add(g, box(W, 0.8, 0.5), r.wall, 0, 4.4, D / 2 - 0.25);
    add(g, box(5, 0.8, 0.5), r.wall, 0, 5.2, D / 2 - 0.25);
    add(g, box(2.4, 0.8, 0.5), r.wall, 0, 6.0, D / 2 - 0.25);
    add(g, box(W + 0.3, 0.3, D + 0.3), r.roof, 0, 4.1, 0);
    // arched doorway
    add(g, new THREE.TorusGeometry(1.1, 0.22, 8, 20, Math.PI), r.trim, 0, 2.5, D / 2 + 0.1);
    for (const x of [-1.1, 1.1]) add(g, box(0.44, 2.5, 0.44), r.trim, x, 1.25, D / 2 + 0.1);
    door(g, D / 2, '#5a2ea6', r.trim);
    windowsRow(g, W, 2.0, D / 2, '#bfe9ff', 2, 5.4);
    const top = roofProp(g, r, 0, 4.25, -1);
    // mini palms
    for (const x of [-5.6, 5.6]) {
      add(g, cyl(0.18, 0.25, 3.2, 8), '#a0703c', x, 1.6, D / 2 - 1);
      for (let i = 0; i < 5; i++) {
        const leaf = add(g, box(1.8, 0.1, 0.5), '#3fb950', x, 3.2, D / 2 - 1, 0, (i / 5) * Math.PI * 2, -0.35);
        leaf.translateX(0.8);
      }
    }
    return { w: W + 2.4, d: D, h: Math.max(6.4, top) + 0.8, signY: 4.4, signZ: D / 2 + 0.35 };
  },
};

// --------------------------------------------------------------------- world
export function buildWorld(scene) {
  const staticRoot = new THREE.Group();
  scene.add(staticRoot);
  const colliders = [];
  const animated = [];

  // sky dome with vertex-color gradient
  const skyGeo = new THREE.SphereGeometry(170, 24, 12);
  const top = new THREE.Color('#6ec3ff');
  const bottom = new THREE.Color('#ffe1f0');
  const cols = [];
  const p = skyGeo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const t = clamp(p.getY(i) / 120, 0, 1);
    const c = bottom.clone().lerp(top, Math.pow(t, 0.6));
    cols.push(c.r, c.g, c.b);
  }
  skyGeo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  const sky = new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
  sky.renderOrder = -1;
  scene.add(sky);
  scene.fog = new THREE.Fog('#ffe9f4', 65, 165);

  scene.add(new THREE.HemisphereLight('#ffffff', '#9fd68a', 1.9));
  const sun = new THREE.DirectionalLight('#fff2dc', 1.6);
  sun.position.set(25, 40, 15);
  scene.add(sun);

  // ground + plaza
  add(staticRoot, new THREE.CircleGeometry(150, 48), '#8fd16a', 0, 0, 0, -Math.PI / 2);
  add(staticRoot, new THREE.CircleGeometry(PLAZA_RADIUS, 48), '#ffe7b8', 0, 0.02, 0, -Math.PI / 2);
  add(staticRoot, new THREE.RingGeometry(PLAZA_RADIUS, PLAZA_RADIUS + 0.9, 48), '#f6b98b', 0, 0.025, 0, -Math.PI / 2);
  add(staticRoot, new THREE.RingGeometry(6, 6.6, 40), '#ffb3d9', 0, 0.03, 0, -Math.PI / 2);
  add(staticRoot, new THREE.RingGeometry(10.5, 11, 48), '#c8b6ff', 0, 0.03, 0, -Math.PI / 2);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    add(staticRoot, new THREE.CircleGeometry(0.45, 12), ['#ffd23f', '#7ae582', '#5ec8ff', '#ff8fc7'][i % 4], Math.sin(a) * 8.5, 0.03, Math.cos(a) * 8.5, -Math.PI / 2);
  }

  // fountain
  add(staticRoot, cyl(3.2, 3.4, 0.7, 28), '#d7ecff', 0, 0.35, 0);
  add(staticRoot, new THREE.TorusGeometry(3.2, 0.22, 8, 32), '#ffffff', 0, 0.72, 0, Math.PI / 2);
  const water = add(scene, new THREE.CircleGeometry(3.05, 28), mat('#6fd0ff', { emissive: '#2a8fd6', emissiveIntensity: 0.25 }), 0, 0.66, 0, -Math.PI / 2);
  water.userData.dynamic = true;
  add(staticRoot, cyl(0.45, 0.6, 2.2, 12), '#ffffff', 0, 1.4, 0);
  add(staticRoot, cyl(1.3, 0.5, 0.35, 20), '#d7ecff', 0, 2.5, 0);
  const DROPS = 10;
  const jets = new THREE.InstancedMesh(sphere(0.16, 8, 6), new THREE.MeshLambertMaterial({ color: '#a7e3ff', emissive: '#4fb8ff', emissiveIntensity: 0.3 }), DROPS);
  jets.frustumCulled = false;
  scene.add(jets);
  const drop = new THREE.Object3D();
  animated.push((t) => {
    for (let i = 0; i < DROPS; i++) {
      const f = (t * 0.6 + i / DROPS) % 1;
      const r = 0.3 + f * 1.9;
      const a = (i / DROPS) * Math.PI * 2;
      drop.position.set(Math.cos(a) * r, 2.7 + Math.sin(f * Math.PI) * 1.4 - f * 1.6, Math.sin(a) * r);
      drop.updateMatrix();
      jets.setMatrixAt(i, drop.matrix);
    }
    jets.instanceMatrix.needsUpdate = true;
    water.position.y = 0.66 + Math.sin(t * 2) * 0.02;
  });
  colliders.push({ type: 'circle', x: 0, z: 0, r: 3.6 });

  // welcome arch: a gateway over the path on the far side of the fountain from slot 0
  const N = RESTAURANTS.length;
  const archA = ringAngle(Math.round(N / 2));
  const arch = new THREE.Group();
  arch.position.set(Math.sin(archA) * 20.5, 0, Math.cos(archA) * 20.5);
  arch.rotation.y = archA + Math.PI;
  for (const x of [-3.2, 3.2]) {
    add(arch, cyl(0.3, 0.35, 4.6, 10), '#ff8fc7', x, 2.3, 0);
    add(arch, sphere(0.5, 12, 10), '#ffd23f', x, 4.8, 0);
    colliders.push({ type: 'circle', x: arch.position.x + x * Math.cos(arch.rotation.y), z: arch.position.z - x * Math.sin(arch.rotation.y), r: 0.5 });
  }
  add(arch, box(7.2, 1.2, 0.3), '#9b5de5', 0, 4.3, 0);
  const welcome = new THREE.Mesh(new THREE.PlaneGeometry(6.8, 1.7), new THREE.MeshBasicMaterial({
    map: signTexture('Yummy Town', { bg: '#fff6fb', fg: '#ff4fa0', border: '#9b5de5' }), transparent: true,
  }));
  welcome.position.set(0, 4.3, 0.17);
  arch.add(welcome);
  const welcomeBack = welcome.clone();
  welcomeBack.rotation.y = Math.PI;
  welcomeBack.position.z = -0.17;
  arch.add(welcomeBack);
  staticRoot.add(arch);

  // lamps + benches around the plaza, between the paths (every other gap once the town is crowded)
  for (let i = 0; i < N; i += Math.ceil(N / 12)) {
    const a = ringAngle(i + 0.5);
    lamp(staticRoot, Math.sin(a) * 14.6, Math.cos(a) * 14.6);
    colliders.push({ type: 'circle', x: Math.sin(a) * 14.6, z: Math.cos(a) * 14.6, r: 0.35 });
    bench(staticRoot, Math.sin(a) * 13.2, Math.cos(a) * 13.2, a + Math.PI);
  }

  // restaurants
  const restaurants = [];
  RESTAURANTS.forEach((r, i) => {
    const a = ringAngle(i);
    const cx = Math.sin(a) * RING_RADIUS;
    const cz = Math.cos(a) * RING_RADIUS;
    const rot = Math.atan2(-cx, -cz); // face the fountain
    const g = new THREE.Group();
    g.position.set(cx, 0, cz);
    g.rotation.y = rot;
    const dims = BUILDERS[r.style](g, r);
    staticRoot.add(g);

    // sign (canvas text only)
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 1.3), new THREE.MeshBasicMaterial({ map: signTexture(r.name, r.sign), transparent: true }));
    sign.position.set(0, dims.signY, dims.signZ + 0.05);
    g.add(sign);

    // path from plaza to the door
    const pathLen = RING_RADIUS - dims.d / 2 - PLAZA_RADIUS;
    const path = add(staticRoot, new THREE.PlaneGeometry(3, pathLen + 1), '#ffe7b8', 0, 0, 0, -Math.PI / 2);
    const mid = PLAZA_RADIUS + pathLen / 2 - 0.5;
    path.position.set(Math.sin(a) * mid, 0.015, Math.cos(a) * mid);
    path.rotation.set(-Math.PI / 2, 0, a);

    // glowing welcome mat at the door
    const doorDist = dims.d / 2 + 1.3;
    const doorPos = new THREE.Vector3(cx - Math.sin(a) * doorDist, 0, cz - Math.cos(a) * doorDist);
    const matMesh = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.25, 28), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.6, depthWrite: false }));
    matMesh.rotation.x = -Math.PI / 2;
    matMesh.position.set(doorPos.x, 0.05, doorPos.z);
    scene.add(matMesh);

    // floating star rating badge
    const starCanvas = starsCanvas(0, 0);
    const starTex = new THREE.CanvasTexture(starCanvas);
    starTex.colorSpace = THREE.SRGBColorSpace;
    const star = new THREE.Sprite(new THREE.SpriteMaterial({ map: starTex, transparent: true, depthWrite: false }));
    star.scale.set(6.4, 2.0, 1);
    star.position.set(cx, dims.h + 2.2, cz);
    star.renderOrder = 5;
    scene.add(star);

    colliders.push({ type: 'box', x: cx, z: cz, rot, hw: dims.w / 2 + 0.2, hd: dims.d / 2 + 0.2 });
    restaurants.push({
      ...r, index: i, angle: a, center: new THREE.Vector3(cx, 0, cz), door: doorPos, rot, dims, mat: matMesh, star,
      setStars(avg, count) {
        starsCanvas(avg, count, starCanvas);
        starTex.needsUpdate = true;
      },
    });
  });
  const MAT_ON = new THREE.Color('#ffe066');
  const MAT_OFF = new THREE.Color('#ffffff');
  animated.push((t, near) => {
    for (const r of restaurants) {
      const on = near === r;
      r.mat.material.opacity = on ? 0.75 + Math.sin(t * 8) * 0.25 : 0.45;
      r.mat.material.color.copy(on ? MAT_ON : MAT_OFF);
      r.mat.scale.setScalar(on ? 1.15 + Math.sin(t * 8) * 0.08 : 1);
      r.star.position.y = r.dims.h + 2.2 + Math.sin(t * 1.8 + r.index) * 0.18;
    }
  });

  // trees between restaurants and around the edge
  let k = 0;
  for (let i = 0; i < N; i++) {
    const a = ringAngle(i + 0.5);
    const sideW = (restaurants[i].dims.w + restaurants[(i + 1) % N].dims.w) / 2;
    for (const [rr, off] of [[RING_RADIUS - 2, 0], [RING_RADIUS + 4, 0.04], [RING_RADIUS + 7.5, -0.045]]) {
      // beside the buildings a tree needs elbow room; behind them there is always space
      if (rr < RING_RADIUS + 6 && ((Math.PI * 2) / N) * rr - sideW < 5) continue;
      const x = Math.sin(a + off) * rr;
      const z = Math.cos(a + off) * rr;
      tree(staticRoot, x, z, k++, 0.9 + (k % 3) * 0.15);
      colliders.push({ type: 'circle', x, z, r: 0.6 });
    }
  }
  const HEDGE_RADIUS = WORLD_RADIUS + 2;
  for (let i = 0; i < 32; i++) {
    const a = (i / 32) * Math.PI * 2;
    const rr = HEDGE_RADIUS + 3 + (i % 3) * 3;
    tree(staticRoot, Math.sin(a) * rr, Math.cos(a) * rr, i, 1.1 + (i % 2) * 0.3);
  }
  // hedge ring = soft world edge
  const hedges = Math.round((Math.PI * 2 * HEDGE_RADIUS) / 4.2);
  for (let i = 0; i < hedges; i++) {
    const a = (i / hedges) * Math.PI * 2;
    add(staticRoot, new THREE.IcosahedronGeometry(1.3, 1), i % 2 ? '#56b85f' : '#62c46b', Math.sin(a) * HEDGE_RADIUS, 0.8, Math.cos(a) * HEDGE_RADIUS).scale.y = 0.75;
  }
  flowerPatch(scene, 200);

  // clouds
  const clouds = new THREE.Group();
  for (let i = 0; i < 9; i++) {
    const c = new THREE.Group();
    const a = (i / 9) * Math.PI * 2;
    c.position.set(Math.sin(a) * 60, 26 + (i % 3) * 4, Math.cos(a) * 60);
    for (let j = 0; j < 4; j++) add(c, sphere(2.4 + (j % 2), 10, 8), mat('#ffffff', { emissive: '#ffffff', emissiveIntensity: 0.35 }), j * 2.2 - 3.3, (j % 2) * 0.8, 0);
    clouds.add(c);
  }
  scene.add(clouds);
  animated.push((t) => {
    clouds.rotation.y = t * 0.01;
  });

  mergeStatic(staticRoot);

  const interior = buildInterior(scene);

  return {
    restaurants,
    colliders,
    interior,
    update(t, nearRestaurant) {
      for (const fn of animated) fn(t, nearRestaurant);
    },
    /** Push a circle of radius `rad` at pos (Vector3, mutated) out of colliders. */
    resolve(pos, rad = 0.45) {
      for (const c of colliders) {
        if (c.type === 'circle') {
          const dx = pos.x - c.x;
          const dz = pos.z - c.z;
          const d = Math.hypot(dx, dz);
          const min = c.r + rad;
          if (d < min && d > 1e-6) {
            pos.x = c.x + (dx / d) * min;
            pos.z = c.z + (dz / d) * min;
          }
        } else {
          const cs = Math.cos(c.rot);
          const sn = Math.sin(c.rot);
          const dx = pos.x - c.x;
          const dz = pos.z - c.z;
          let lx = cs * dx - sn * dz;
          let lz = sn * dx + cs * dz;
          const qx = clamp(lx, -c.hw, c.hw);
          const qz = clamp(lz, -c.hd, c.hd);
          let ox = lx - qx;
          let oz = lz - qz;
          const d = Math.hypot(ox, oz);
          if (d >= rad) continue;
          if (d > 1e-6) {
            lx = qx + (ox / d) * rad;
            lz = qz + (oz / d) * rad;
          } else {
            // inside: push out along the shallowest axis
            const px = c.hw - Math.abs(lx);
            const pz = c.hd - Math.abs(lz);
            if (px < pz) lx = Math.sign(lx || 1) * (c.hw + rad);
            else lz = Math.sign(lz || 1) * (c.hd + rad);
          }
          pos.x = c.x + cs * lx + sn * lz;
          pos.z = c.z - sn * lx + cs * lz;
        }
      }
      const r = Math.hypot(pos.x, pos.z);
      if (r > WORLD_RADIUS) {
        pos.x *= WORLD_RADIUS / r;
        pos.z *= WORLD_RADIUS / r;
      }
      return pos;
    },
    /** True if point is inside a building (used to keep the camera out of walls). */
    blocked(x, z, pad = 0.3) {
      for (const c of colliders) {
        if (c.type !== 'box') continue;
        const cs = Math.cos(c.rot);
        const sn = Math.sin(c.rot);
        const dx = x - c.x;
        const dz = z - c.z;
        if (Math.abs(cs * dx - sn * dz) < c.hw + pad && Math.abs(sn * dx + cs * dz) < c.hd + pad) return true;
      }
      return false;
    },
  };
}

// --------------------------------------------------------------------- interior set
function buildInterior(scene) {
  const g = new THREE.Group();
  g.position.copy(INTERIOR_ORIGIN);
  scene.add(g);

  const floorMat = new THREE.MeshLambertMaterial({ map: checkerTexture('#ffffff', '#ffd6e8', 8) });
  const floor = add(g, new THREE.PlaneGeometry(14, 10), floorMat, 0, 0, 0, -Math.PI / 2);
  floor.material.map.wrapS = floor.material.map.wrapT = THREE.RepeatWrapping;
  floor.material.map.repeat.set(3, 2);

  const wallMat = new THREE.MeshLambertMaterial({ color: '#ffe1d6' });
  add(g, new THREE.PlaneGeometry(14, 6), wallMat, 0, 3, -3);
  add(g, new THREE.PlaneGeometry(10, 6), wallMat, -7, 3, 2, 0, Math.PI / 2, 0);
  add(g, new THREE.PlaneGeometry(10, 6), wallMat, 7, 3, 2, 0, -Math.PI / 2, 0);
  const trimMat = new THREE.MeshLambertMaterial({ color: '#e63946' });
  add(g, box(14, 0.4, 0.1), trimMat, 0, 0.2, -2.95);
  add(g, box(14, 0.25, 0.1), trimMat, 0, 4.6, -2.95);

  // sign on the back wall
  const signMat = new THREE.MeshBasicMaterial({ transparent: true });
  const sign = add(g, new THREE.PlaneGeometry(4.6, 1.15), signMat, 0, 3.55, -2.9);

  // windows
  for (const x of [-4.6, 4.6]) {
    add(g, box(2.2, 1.8, 0.1), '#ffffff', x, 2.6, -2.95);
    add(g, box(1.9, 1.5, 0.12), mat('#9fdcff', { emissive: '#6ec3ff', emissiveIntensity: 0.4 }), x, 2.6, -2.93);
    add(g, box(0.1, 1.5, 0.14), '#ffffff', x, 2.6, -2.9);
    for (const s of [-1, 1]) add(g, box(0.5, 2.0, 0.06), trimMat, x + s * 1.25, 2.6, -2.85);
  }
  // hanging lamps
  for (const x of [-1.6, 1.6]) {
    add(g, cyl(0.02, 0.02, 1.2, 4), '#555555', x, 5.4, 0);
    add(g, cone(0.45, 0.4, 14), trimMat, x, 4.7, 0);
    add(g, sphere(0.16, 10, 8), mat('#fff3b0', { emissive: '#ffd66b', emissiveIntensity: 1 }), x, 4.48, 0);
  }
  // plant + counter in the back
  add(g, cyl(0.35, 0.28, 0.6, 10), '#c96d3b', -5.6, 0.3, -2.2);
  add(g, new THREE.IcosahedronGeometry(0.6, 1), '#4caf5c', -5.6, 1.0, -2.2);
  add(g, new THREE.IcosahedronGeometry(0.45, 1), '#5cc96b', -5.4, 1.5, -2.0);
  add(g, box(3.2, 1.1, 0.8), trimMat, 4.9, 0.55, -2.4);
  add(g, box(3.3, 0.1, 0.9), '#ffffff', 4.9, 1.12, -2.4);

  // the table for two
  const clothMat = new THREE.MeshLambertMaterial({ map: checkerTexture('#e63946', '#ffffff', 6) });
  add(g, box(2.8, 0.08, 1.3), clothMat, 0, 0.78, 0);
  add(g, box(2.82, 0.3, 1.32), clothMat, 0, 0.62, 0);
  for (const x of [-1.2, 1.2]) for (const z of [-0.5, 0.5]) add(g, cyl(0.06, 0.06, 0.5, 8), '#7b4a2a', x, 0.25, z);

  // two chairs behind the table (characters face the camera at +z)
  const seats = [new THREE.Vector3(-0.68, 0, -0.72), new THREE.Vector3(0.72, 0, -0.78)];
  for (const s of seats) {
    add(g, box(0.9, 0.1, 0.8), '#ffb703', s.x, 0.46, s.z - 0.05);
    add(g, box(0.9, 1.1, 0.12), '#ffb703', s.x, 0.95, s.z - 0.48);
    for (const dx of [-0.38, 0.38]) for (const dz of [-0.4, 0.3]) add(g, cyl(0.04, 0.04, 0.46, 6), '#7b4a2a', s.x + dx, 0.23, s.z + dz);
  }
  // plates
  const plates = [new THREE.Vector3(-0.66, 0.83, 0.12), new THREE.Vector3(0.74, 0.83, 0.12)];
  for (const p of plates) {
    add(g, cyl(0.36, 0.3, 0.04, 24), '#ffffff', p.x, p.y, p.z);
    add(g, cyl(0.28, 0.28, 0.045, 24), '#f3f0ff', p.x, p.y + 0.003, p.z);
  }
  // napkin, cups, ketchup-y sauce bottle
  add(g, box(0.2, 0.02, 0.3), '#8fd3ff', -1.15, 0.83, 0.25);
  add(g, cyl(0.08, 0.06, 0.22, 12), '#ffffff', 1.22, 0.93, -0.1);
  add(g, cyl(0.07, 0.07, 0.25, 10), trimMat, 0.05, 0.95, -0.3);

  return {
    group: g,
    seats: seats.map((s) => s.clone().add(INTERIOR_ORIGIN)),
    plates: plates.map((p) => p.clone().add(INTERIOR_ORIGIN)),
    camTarget: new THREE.Vector3(0, 1.55, -0.5).add(INTERIOR_ORIGIN),
    camPos: new THREE.Vector3(0, 2.15, 5.3).add(INTERIOR_ORIGIN),
    setRestaurant(r) {
      wallMat.color.set(r.inside);
      trimMat.color.set(r.accent);
      signMat.map = signTexture(r.name, r.sign);
      signMat.needsUpdate = true;
      clothMat.map = checkerTexture(r.accent, '#ffffff', 6);
      clothMat.needsUpdate = true;
    },
  };
}
