// Pet sidekicks: a puppy, kitten, dino or dragon that trots along behind its reviewer.
// Original low-poly models, each baked into one mesh (a draw call, plus a blob shadow).
// Only the pet's id is shared with friends (it is part of the appearance); every device
// works out where the pet walks on its own.
import * as THREE from '../vendor/three.module.js';
import { bakeColored, bakedMaterial, blobShadowTexture, damp, lerpAngle, mat, smooth01 } from './util.js';

const sphere = (r, w = 10, hs = 8) => new THREE.SphereGeometry(r, w, hs);
const dot = (r) => new THREE.SphereGeometry(r, 8, 6);
const cyl = (rt, rb, hgt, seg = 8) => new THREE.CylinderGeometry(rt, rb, hgt, seg);
const cone = (r, hgt, seg = 6) => new THREE.ConeGeometry(r, hgt, seg);
const box = (w, hgt, d) => new THREE.BoxGeometry(w, hgt, d);

function part(g, geometry, color, pos, rot = [0, 0, 0], scl = [1, 1, 1]) {
  const m = new THREE.Mesh(geometry, mat(color));
  m.position.set(...pos);
  m.rotation.set(...rot);
  m.scale.set(...scl);
  g.add(m);
}
const DARK = '#2a1a2e';

// Each builder fills `g` with a pet facing +z, feet on y = 0. The dragon also fills `wings`.
const BUILDERS = {
  puppy(g) {
    const fur = '#d99a4e';
    const cream = '#fff3dc';
    part(g, sphere(0.22), fur, [0, 0.27, -0.02], [0, 0, 0], [1, 0.9, 1.35]);
    part(g, sphere(0.13), cream, [0, 0.24, 0.2], [0, 0, 0], [1, 1, 0.6]);
    part(g, sphere(0.2), fur, [0, 0.52, 0.2]);
    part(g, dot(0.1), cream, [0, 0.47, 0.37], [0, 0, 0], [1, 0.8, 1]);
    part(g, dot(0.036), DARK, [0, 0.5, 0.465]);
    for (const s of [-1, 1]) {
      part(g, dot(0.032), DARK, [s * 0.08, 0.575, 0.37]);
      part(g, dot(0.1), '#8a5a2b', [s * 0.19, 0.5, 0.17], [0, 0, s * 0.25], [0.45, 1.2, 0.8]); // floppy ears
      part(g, cyl(0.05, 0.05, 0.16), fur, [s * 0.11, 0.08, 0.14]);
      part(g, cyl(0.05, 0.05, 0.16), fur, [s * 0.11, 0.08, -0.18]);
    }
    part(g, cone(0.045, 0.24), fur, [0, 0.42, -0.31], [-0.7, 0, 0]);
    part(g, new THREE.TorusGeometry(0.15, 0.026, 6, 12), '#e63946', [0, 0.4, 0.13], [1.15, 0, 0]);
    part(g, dot(0.04), '#ffd23f', [0, 0.33, 0.27]);
    return { hop: 0.2, pace: 13 };
  },

  kitten(g) {
    const fur = '#9aa5b8';
    const white = '#ffffff';
    const pink = '#ff8fab';
    part(g, sphere(0.19), fur, [0, 0.24, -0.02], [0, 0, 0], [1, 0.9, 1.3]);
    part(g, sphere(0.19), fur, [0, 0.47, 0.17]);
    part(g, dot(0.075), white, [0, 0.42, 0.33], [0, 0, 0], [1.2, 0.7, 0.8]);
    part(g, dot(0.026), pink, [0, 0.45, 0.388]);
    for (const s of [-1, 1]) {
      part(g, cone(0.075, 0.14, 4), fur, [s * 0.1, 0.665, 0.15], [0, 0, -s * 0.2]);
      part(g, cone(0.04, 0.09, 4), pink, [s * 0.1, 0.655, 0.175], [0, 0, -s * 0.2]);
      part(g, dot(0.038), '#7ae582', [s * 0.075, 0.51, 0.325]);
      part(g, dot(0.02), DARK, [s * 0.077, 0.51, 0.352], [0, 0, 0], [0.6, 1.2, 0.6]);
      part(g, cyl(0.04, 0.04, 0.14), fur, [s * 0.09, 0.07, 0.12]);
      part(g, cyl(0.04, 0.04, 0.14), fur, [s * 0.09, 0.07, -0.16]);
      part(g, dot(0.045), white, [s * 0.09, 0.02, 0.13], [0, 0, 0], [1, 0.5, 1.2]);
    }
    for (const z of [-0.12, 0, 0.12]) part(g, box(0.2, 0.02, 0.035), '#6c7689', [0, 0.412 - Math.abs(z) * 0.12, z - 0.03]); // tabby stripes
    part(g, cyl(0.035, 0.04, 0.22, 6), fur, [0, 0.37, -0.29], [-0.6, 0, 0]);
    part(g, cyl(0.03, 0.035, 0.2, 6), fur, [0, 0.54, -0.37], [0.15, 0, 0]);
    part(g, dot(0.04), white, [0, 0.65, -0.355]);
    return { hop: 0.13, pace: 16 };
  },

  dino(g) {
    const green = '#57c765';
    const deep = '#3fa650';
    part(g, sphere(0.24), green, [0, 0.34, -0.02], [0, 0, 0], [0.95, 1.15, 1]);
    part(g, sphere(0.18), '#fff2a8', [0, 0.3, 0.14], [0, 0, 0], [0.8, 1, 0.6]);
    part(g, sphere(0.21), green, [0, 0.69, 0.14], [0, 0, 0], [1, 0.9, 1.2]);
    part(g, box(0.25, 0.12, 0.22), green, [0, 0.62, 0.32]);
    for (const x of [-0.08, -0.027, 0.027, 0.08]) part(g, cone(0.022, 0.05, 4), '#ffffff', [x, 0.545, 0.4], [Math.PI, 0, 0]);
    for (const s of [-1, 1]) {
      part(g, dot(0.052), '#ffffff', [s * 0.11, 0.77, 0.24]);
      part(g, dot(0.027), DARK, [s * 0.115, 0.775, 0.278]);
      part(g, cyl(0.03, 0.026, 0.13, 6), green, [s * 0.19, 0.42, 0.15], [-1.0, 0, 0]);
      part(g, cyl(0.085, 0.085, 0.17), deep, [s * 0.12, 0.085, 0]);
      part(g, box(0.15, 0.06, 0.22), deep, [s * 0.12, 0.03, 0.05]);
    }
    part(g, cone(0.14, 0.46, 8), green, [0, 0.24, -0.39], [-1.75, 0, 0]);
    for (const [y, z] of [[0.89, 0.04], [0.74, -0.17], [0.56, -0.25], [0.38, -0.33]]) part(g, cone(0.055, 0.12, 4), '#ff922b', [0, y, z], [-0.5, 0, 0]);
    return { hop: 0.24, pace: 9 };
  },

  dragon(g, wings) {
    const scale = '#9b5de5';
    part(g, sphere(0.2), scale, [0, 0.25, 0], [0, 0, 0], [0.95, 1, 1.3]);
    part(g, sphere(0.15), '#ffd6a5', [0, 0.2, 0.05], [0, 0, 0], [0.8, 0.8, 1.1]);
    part(g, sphere(0.18), scale, [0, 0.5, 0.22]);
    part(g, box(0.17, 0.1, 0.17), scale, [0, 0.46, 0.38]);
    for (const s of [-1, 1]) {
      part(g, cone(0.036, 0.15, 5), '#ffd23f', [s * 0.09, 0.69, 0.13], [-0.4, 0, -s * 0.25]);
      part(g, dot(0.047), '#ffffff', [s * 0.09, 0.56, 0.35]);
      part(g, dot(0.025), DARK, [s * 0.093, 0.563, 0.385]);
      part(g, dot(0.02), DARK, [s * 0.04, 0.49, 0.467]); // nostrils
      for (const z of [-0.13, 0.13]) part(g, dot(0.065), scale, [s * 0.12, 0.07, z]);
      // wings fold out from the shoulders; the whole pair is squashed and stretched to flap
      part(wings, box(0.42, 0.03, 0.3), '#ff8fc7', [s * 0.29, 0.14, -0.04], [-0.45, 0, s * 0.6]);
      part(wings, cyl(0.024, 0.024, 0.46, 5), scale, [s * 0.29, 0.2, 0.09], [-0.45, 0, s * 0.6 + Math.PI / 2]);
    }
    for (const [y, z] of [[0.69, 0.02], [0.47, -0.14], [0.33, -0.27]]) part(g, cone(0.05, 0.11, 4), '#ff5fa2', [0, y, z], [-0.5, 0, 0]);
    part(g, cone(0.095, 0.42, 7), scale, [0, 0.22, -0.41], [-1.55, 0, 0]);
    part(g, cone(0.07, 0.12, 4), '#ff5fa2', [0, 0.215, -0.66], [-1.55, 0, 0]);
    return { hop: 0, pace: 6, fly: 0.95 };
  },
};
export const hasPetModel = (kind) => Object.prototype.hasOwnProperty.call(BUILDERS, kind);

const models = new Map(); // kind -> { body, wings, ...style } (geometry shared by every pet of that kind)
function petModel(kind) {
  let m = models.get(kind);
  if (!m) {
    const g = new THREE.Group();
    const wings = new THREE.Group();
    const style = BUILDERS[kind](g, wings);
    m = { ...style, body: bakeColored(g), wings: wings.children.length ? bakeColored(wings) : null };
    models.set(kind, m);
  }
  return m;
}

let shadowMat = null;
const shadowGeo = new THREE.CircleGeometry(0.34, 16);

export class Pet {
  constructor(kind) {
    this.kind = kind;
    const model = petModel(kind);
    this.style = model;
    this.group = new THREE.Group(); // lives under the owner's root, but is steered in world space
    this.model = new THREE.Group(); // hops, wiggles and spins
    this.model.add(new THREE.Mesh(model.body, bakedMaterial()));
    if (model.wings) {
      this.wings = new THREE.Mesh(model.wings, bakedMaterial());
      this.wings.position.y = 0.3;
      this.model.add(this.wings);
    }
    shadowMat ||= new THREE.MeshBasicMaterial({ map: blobShadowTexture(), transparent: true, depthWrite: false });
    this.shadow = new THREE.Mesh(shadowGeo, shadowMat);
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.y = 0.025;
    this.shadow.renderOrder = 1;
    this.group.add(this.model, this.shadow);

    this.pos = new THREE.Vector3(); // world position on the ground
    this.yaw = 0;
    this.placed = false;
    this.time = Math.random() * 10;
    this.phase = 0;
    this.moveAmt = 0;
    this.cheerT = 0;
  }

  /** A happy spin and hop (the owner danced, jumped or found something). */
  cheer() {
    this.cheerT = 1;
  }

  /** How far the pet is from its owner (for tests). */
  distanceTo(owner) {
    return Math.hypot(this.pos.x - owner.root.position.x, this.pos.z - owner.root.position.z);
  }

  /** owner: the Character it belongs to. owner.petSpot = { x, z, yaw } makes it sit there instead of following. */
  update(dt, owner) {
    this.time += dt;
    const root = owner.root;
    const ry = root.rotation.y;
    const c = Math.cos(ry);
    const s = Math.sin(ry);
    const spot = owner.petSpot;
    // heel: a step behind the owner and off to one side
    const tx = spot ? spot.x : root.position.x + 0.8 * c - 0.95 * s;
    const tz = spot ? spot.z : root.position.z - 0.8 * s - 0.95 * c;
    let dx = tx - this.pos.x;
    let dz = tz - this.pos.z;
    const d = Math.hypot(dx, dz);
    let moving = false;
    if (!this.placed || d > 14) {
      // first frame, or the owner went through a door: just be there
      this.pos.set(tx, 0, tz);
      this.yaw = spot ? spot.yaw : ry;
      this.placed = true;
    } else if (d > 0.3) {
      const step = Math.min(d, Math.min(18, Math.max(1.6, d * 4.5)) * dt);
      this.pos.x += (dx / d) * step;
      this.pos.z += (dz / d) * step;
      this.yaw = lerpAngle(this.yaw, Math.atan2(dx, dz), damp(12, dt));
      moving = true;
    } else {
      // arrived: look the same way as the owner (or the way the spot says)
      this.yaw = lerpAngle(this.yaw, spot ? spot.yaw : ry, damp(5, dt));
    }
    this.moveAmt += ((moving ? 1 : 0) - this.moveAmt) * damp(10, dt);
    this.phase += dt * this.style.pace * (0.4 + 0.6 * this.moveAmt);

    // into the owner's local space (the root only ever moves and turns around y)
    dx = this.pos.x - root.position.x;
    dz = this.pos.z - root.position.z;
    this.group.position.set(dx * c - dz * s, -root.position.y, dx * s + dz * c);
    this.group.rotation.y = this.yaw - ry;

    const m = this.model;
    const w = this.moveAmt;
    let y = Math.abs(Math.sin(this.phase)) * this.style.hop * w;
    let spin = 0;
    if (this.cheerT > 0) {
      this.cheerT = Math.max(0, this.cheerT - dt / 0.9);
      const k = 1 - this.cheerT;
      y += Math.sin(k * Math.PI) * 0.45;
      spin = smooth01(k) * Math.PI * 2;
    }
    if (this.style.fly) {
      y += this.style.fly + Math.sin(this.time * 3.2) * 0.1;
      this.wings.scale.y = 0.65 + Math.sin(this.time * (14 + 8 * w)) * 0.6;
      m.rotation.x = 0.12 + w * 0.25;
    } else {
      m.rotation.x = -Math.cos(this.phase) * 0.14 * w; // rock forward and back with each hop
      // sitting still: a happy little wiggle now and then
      m.rotation.z = (1 - w) * Math.sin(this.time * 9) * 0.05 * Math.max(0, Math.sin(this.time * 0.9));
    }
    m.position.y = y;
    m.rotation.y = spin;
    const squash = 1 + Math.sin(this.time * 2.4) * 0.02 * (1 - w);
    m.scale.set(1, squash, 1);
    this.shadow.scale.setScalar(1 / (1 + y * 0.5));
  }

  dispose() {
    this.group.removeFromParent(); // geometry and materials are shared, nothing else to free
  }
}
