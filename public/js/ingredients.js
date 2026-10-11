// The giant ingredients of the hidden ingredient hunt: original low-poly models, each baked
// into one mesh, bobbing and spinning where hunt.js hides them. Walk into one to collect it.
import * as THREE from '../vendor/three.module.js';
import { bakeColored, bakedMaterial, mat } from './util.js';

const sphere = (r, w = 12, hs = 8) => new THREE.SphereGeometry(r, w, hs);
const dot = (r) => new THREE.SphereGeometry(r, 8, 6);
const cyl = (rt, rb, hgt, seg = 10) => new THREE.CylinderGeometry(rt, rb, hgt, seg);
const cone = (r, hgt, seg = 10) => new THREE.ConeGeometry(r, hgt, seg);

function part(g, geometry, color, pos, rot = [0, 0, 0], scl = [1, 1, 1]) {
  const m = new THREE.Mesh(geometry, mat(color));
  m.position.set(...pos);
  m.rotation.set(...rot);
  m.scale.set(...scl);
  g.add(m);
}
/** `n` things in a ring: fn(angle, i). */
const around = (n, fn) => {
  for (let i = 0; i < n; i++) fn((i / n) * Math.PI * 2, i);
};
const LEAF = '#3fa34d';

// Each builder fills `g` with an ingredient about 1.8 tall, standing on y = 0.
const BUILDERS = {
  tomato(g) {
    part(g, sphere(0.8, 14, 10), '#e63946', [0, 0.72, 0], [0, 0, 0], [1, 0.88, 1]);
    around(5, (a) => part(g, cone(0.13, 0.5, 4), LEAF, [Math.cos(a) * 0.2, 1.4, Math.sin(a) * 0.2], [Math.sin(a) * 1.2, 0, -Math.cos(a) * 1.2]));
    part(g, cyl(0.06, 0.08, 0.3, 6), LEAF, [0, 1.52, 0]);
  },
  cheese(g) {
    const w = new THREE.Group();
    w.position.y = 0.72;
    w.rotation.set(0.25, 0.5, 0.2);
    part(w, new THREE.CylinderGeometry(1.0, 1.0, 0.8, 3), '#ffd23f', [0, 0, 0]);
    for (const [x, z, r] of [[0.1, 0.25, 0.17], [-0.25, -0.2, 0.12], [0.35, -0.3, 0.1]]) part(w, cyl(r, r, 0.03), '#e0a800', [x, 0.4, z]);
    for (const [x, y, r] of [[-0.3, 0.1, 0.14], [0.25, -0.12, 0.11]]) part(w, cyl(r, r, 0.03), '#e0a800', [x * 0.5 + 0.25, y, x * 0.87 + 0.44], [Math.PI / 2, 0, Math.PI / 6]);
    g.add(w);
  },
  carrot(g) {
    part(g, cone(0.42, 1.5, 12), '#ff922b', [0, 0.78, 0], [Math.PI, 0, 0]);
    for (const [y, r] of [[1.2, 0.33], [0.9, 0.245], [0.6, 0.16]]) part(g, new THREE.TorusGeometry(r, 0.03, 5, 14), '#e8590c', [0, y, 0], [Math.PI / 2, 0, 0]);
    around(4, (a, i) => part(g, cone(0.13, 0.6 + (i % 2) * 0.2, 5), LEAF, [Math.cos(a) * 0.14, 1.8, Math.sin(a) * 0.14], [Math.sin(a) * 0.45, 0, -Math.cos(a) * 0.45]));
  },
  mushroom(g) {
    part(g, cyl(0.26, 0.36, 0.85, 12), '#fff3dc', [0, 0.42, 0]);
    part(g, new THREE.SphereGeometry(0.85, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), '#e63946', [0, 0.8, 0], [0, 0, 0], [1, 0.9, 1]);
    part(g, cyl(0.85, 0.8, 0.08, 16), '#fff3dc', [0, 0.78, 0]);
    part(g, dot(0.16), '#ffffff', [0, 1.52, 0], [0, 0, 0], [1, 0.4, 1]);
    around(5, (a) => part(g, dot(0.15), '#ffffff', [Math.cos(a) * 0.55, 1.33, Math.sin(a) * 0.55], [0, 0, 0], [1, 0.6, 1]));
  },
  egg(g) {
    part(g, cyl(0.5, 0.34, 0.5, 14), '#74c0fc', [0, 0.25, 0]);
    part(g, cyl(0.54, 0.54, 0.08, 14), '#ffffff', [0, 0.5, 0]);
    part(g, sphere(0.56, 14, 10), '#fff8ee', [0, 1.02, 0], [0, 0, 0], [1, 1.3, 1]);
    for (const [a, y] of [[0.4, 1.2], [2.3, 0.95], [4.1, 1.3], [5.4, 0.9]]) part(g, dot(0.07), '#e9c79a', [Math.cos(a) * 0.52, y, Math.sin(a) * 0.52], [0, 0, 0], [1, 1, 1]);
  },
  banana(g) {
    const arc = 2.0;
    part(g, new THREE.TorusGeometry(0.75, 0.22, 6, 12, arc), '#ffd23f', [0, 1.02, 0], [0, 0, -Math.PI / 2 - arc / 2]);
    for (const s of [-1, 1]) part(g, cyl(0.07, 0.1, 0.22, 6), '#7b4a2a', [s * 0.66, 0.66, 0], [0, 0, -s * 0.65]);
  },
  strawberry(g) {
    part(g, cone(0.62, 1.15, 12), '#ff4d6d', [0, 0.6, 0], [Math.PI, 0, 0]);
    part(g, sphere(0.62, 12, 8), '#ff4d6d', [0, 1.17, 0], [0, 0, 0], [1, 0.5, 1]);
    around(6, (a) => part(g, cone(0.16, 0.42, 4), LEAF, [Math.cos(a) * 0.24, 1.46, Math.sin(a) * 0.24], [Math.sin(a) * 1.25, 0, -Math.cos(a) * 1.25]));
    part(g, cyl(0.05, 0.06, 0.26, 6), LEAF, [0, 1.6, 0]);
    for (let i = 0; i < 12; i++) {
      const a = i * 2.4;
      const y = 0.45 + (i % 4) * 0.2;
      const r = 0.62 * (y / 1.17) + 0.02;
      part(g, dot(0.045), '#ffe066', [Math.cos(a) * r, y, Math.sin(a) * r]);
    }
  },
  broccoli(g) {
    part(g, cyl(0.2, 0.3, 0.85, 8), '#8bd450', [0, 0.42, 0]);
    around(4, (a) => {
      part(g, cyl(0.1, 0.12, 0.4, 6), '#8bd450', [Math.cos(a) * 0.25, 0.9, Math.sin(a) * 0.25], [Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6]);
      part(g, new THREE.IcosahedronGeometry(0.48, 1), '#2f9e44', [Math.cos(a) * 0.45, 1.2, Math.sin(a) * 0.45]);
    });
    part(g, new THREE.IcosahedronGeometry(0.55, 1), '#37b24d', [0, 1.5, 0]);
  },
};
export const hasIngredientModel = (id) => Object.prototype.hasOwnProperty.call(BUILDERS, id);

const models = new Map(); // ingredient id -> baked geometry
function model(id) {
  let geo = models.get(id);
  if (!geo) {
    const g = new THREE.Group();
    BUILDERS[id](g);
    geo = bakeColored(g);
    models.set(id, geo);
  }
  return geo;
}

const REACH = 1.7; // walk this close to pick one up

export class HuntField {
  constructor(scene) {
    this.group = new THREE.Group();
    scene.add(this.group);
    this.items = [];
  }

  /** Show these { id, x, z } ingredients (the ones still to be found). One that is busy vanishing finishes first. */
  load(items) {
    const leaving = this.items.filter((it) => it.gone);
    for (const it of this.items) if (!it.gone) this.group.remove(it.mesh);
    this.items = [...leaving, ...items.map((it, i) => {
      const mesh = new THREE.Mesh(model(it.id), bakedMaterial());
      mesh.position.set(it.x, 0, it.z);
      this.group.add(mesh);
      return { ...it, mesh, phase: i * 1.3, gone: 0 };
    })];
  }

  /** Bob and spin; an ingredient that was just picked up shrinks away. */
  update(dt, t) {
    for (const it of this.items) {
      const m = it.mesh;
      if (it.gone) {
        it.gone += dt / 0.45;
        if (it.gone >= 2) {
          this.group.remove(m);
          continue;
        }
        const k = Math.max(0, 2 - it.gone);
        m.scale.setScalar(k * (1.4 - 0.4 * k));
        m.position.y += dt * 4;
        m.rotation.y += dt * 14;
      } else {
        m.position.y = 0.35 + Math.sin(t * 2 + it.phase) * 0.18;
        m.rotation.y = t * 1.1 + it.phase;
      }
    }
    if (this.items.some((it) => it.gone >= 2)) this.items = this.items.filter((it) => it.gone < 2);
  }

  /** The ingredient at `pos` (if the player walked into one): it starts to vanish and is returned once. */
  collect(pos) {
    for (const it of this.items) {
      if (!it.gone && Math.hypot(pos.x - it.x, pos.z - it.z) < REACH) {
        it.gone = 1;
        return it;
      }
    }
    return null;
  }

  /** Distance from `pos` to the nearest ingredient still waiting, and which one. */
  nearest(pos) {
    let best = null;
    let dist = Infinity;
    for (const it of this.items) {
      const d = it.gone ? Infinity : Math.hypot(pos.x - it.x, pos.z - it.z);
      if (d < dist) {
        dist = d;
        best = it;
      }
    }
    return { item: best, dist };
  }
}
