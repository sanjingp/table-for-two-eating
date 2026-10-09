// Low-poly chibi character built from primitives. Materials are owned per character so
// color tweaks (color picker dragging) just update .color without rebuilding meshes.
import * as THREE from '../vendor/three.module.js';
import { skinColor } from './schema.js';
import { EMOTE_INFO } from './data.js';
import { blobShadowTexture, emojiTexture, labelTexture, makeSprite, speechTexture, smooth01, lerp, damp } from './util.js';

const geoCache = new Map();
const geo = (key, make) => {
  let g = geoCache.get(key);
  if (!g) {
    g = make();
    geoCache.set(key, g);
  }
  return g;
};
const G = {
  sphere: (r, w = 16, hs = 12) => geo(`s${r}:${w}:${hs}`, () => new THREE.SphereGeometry(r, w, hs)),
  cap: (r, tl) => geo(`cap${r}:${tl}`, () => new THREE.SphereGeometry(r, 18, 10, 0, Math.PI * 2, 0, tl)),
  cyl: (rt, rb, hgt, seg = 14, open = false, ts = 0, tl = Math.PI * 2) =>
    geo(`c${rt}:${rb}:${hgt}:${seg}:${open}:${ts}:${tl}`, () => new THREE.CylinderGeometry(rt, rb, hgt, seg, 1, open, ts, tl)),
  box: (w, hgt, d) => geo(`b${w}:${hgt}:${d}`, () => new THREE.BoxGeometry(w, hgt, d)),
  capsule: (r, len) => geo(`k${r}:${len}`, () => new THREE.CapsuleGeometry(r, len, 4, 10)),
  torus: (r, t, arc = Math.PI * 2, rs = 8, ts = 18) => geo(`t${r}:${t}:${arc}:${rs}:${ts}`, () => new THREE.TorusGeometry(r, t, rs, ts, arc)),
  ico: (r) => geo(`i${r}`, () => new THREE.IcosahedronGeometry(r, 1)),
  circle: (r) => geo(`ci${r}`, () => new THREE.CircleGeometry(r, 20)),
};

function add(parent, geometry, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}

const WHITE = new THREE.MeshLambertMaterial({ color: '#ffffff' });
const DARK = new THREE.MeshLambertMaterial({ color: '#2a1a2e' });
const CHEEK = new THREE.MeshLambertMaterial({ color: '#ff8fab', transparent: true, opacity: 0.75 });
const MOUTH = new THREE.MeshLambertMaterial({ color: '#7a2848' });
const TONGUE = new THREE.MeshLambertMaterial({ color: '#ff6f91' });
const DENIM_STITCH = new THREE.MeshLambertMaterial({ color: '#f2c14e' });
const TIE = new THREE.MeshLambertMaterial({ color: '#ff5fa2' });
const CAMERA_BODY = new THREE.MeshLambertMaterial({ color: '#ff7eb6' });
const CAMERA_LENS = new THREE.MeshLambertMaterial({ color: '#3a3150' });

const EMOTE_DURATION = { wave: 1.8, yum: 1.8, wow: 1.6, thumbs: 1.6, silly: 1.8, kiss: 1.6, dance: 2.4, heart: 1.8, jump: 0.7, bite: 1.0 };

export class Character {
  constructor(app, { scale = 1, label = null } = {}) {
    this.root = new THREE.Group();
    this.scaleFactor = scale;
    this.mats = {};
    for (const k of ['skin', 'hair', 'iris', 'top', 'jacket', 'bottom', 'shoes']) this.mats[k] = new THREE.MeshLambertMaterial();
    this.mats.jacketDouble = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide });
    this.mats.sole = new THREE.MeshLambertMaterial({ color: '#ffffff', emissive: '#000000' });

    this.body = new THREE.Group();
    this.body.scale.setScalar(scale);
    this.root.add(this.body);

    const shadow = new THREE.Mesh(G.circle(0.5 * scale), new THREE.MeshBasicMaterial({ map: blobShadowTexture(), transparent: true, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.02;
    shadow.renderOrder = 1;
    this.shadow = shadow;
    this.root.add(shadow);

    this.time = Math.random() * 10;
    this.phase = 0;
    this.walkAmt = 0;
    this.speed = 0; // 0..1 set by owner each frame
    this.pose = 'stand'; // 'stand' | 'sit'
    this.holdingCamera = false;
    this.emote = null;
    this.emoteT = 0;
    this.blinkT = 2 + Math.random() * 3;
    this.jumpY = 0;
    this.bubble = null;
    this.bubbleT = 0;
    this.labelSprite = null;
    this.lightHue = 0;

    this.app = null;
    this.setAppearance(app);
    if (label) this.setLabel(label);
  }

  // ------------------------------------------------------------ building
  setAppearance(app) {
    const prev = this.app;
    this.app = { ...app };
    const m = this.mats;
    m.skin.color.set(skinColor(app.skin));
    m.hair.color.set(app.hair);
    m.iris.color.set(app.eyes);
    m.top.color.set(app.topColor);
    m.jacket.color.set(app.jacketColor);
    m.jacketDouble.color.set(app.jacketColor);
    m.bottom.color.set(app.bottomColor);
    m.shoes.color.set(app.shoesColor);
    m.sole.color.set(app.shoes === 'lightup' ? '#ffffff' : app.shoes === 'sandals' ? app.shoesColor : '#ffffff');
    const styleKeys = ['hairStyle', 'top', 'jacket', 'bottom', 'shoes'];
    if (!prev || styleKeys.some((k) => prev[k] !== app[k])) this.rebuild();
  }

  rebuild() {
    const app = this.app;
    const m = this.mats;
    this.body.clear();

    // --- legs (pivot at hips)
    this.hips = new THREE.Group();
    this.hips.position.y = 0.55;
    this.body.add(this.hips);
    const legs = [];
    for (const side of [-1, 1]) {
      const leg = new THREE.Group();
      leg.position.set(side * 0.11, 0, 0);
      this.hips.add(leg);
      add(leg, G.cyl(0.075, 0.07, 0.45, 10), m.skin, 0, -0.22, 0);
      if (app.bottom === 'pants') add(leg, G.cyl(0.1, 0.095, 0.42, 10), m.bottom, 0, -0.2, 0);
      if (app.bottom === 'leggings') add(leg, G.cyl(0.088, 0.08, 0.43, 10), m.bottom, 0, -0.21, 0);
      if (app.bottom === 'shorts') add(leg, G.cyl(0.105, 0.1, 0.18, 10), m.bottom, 0, -0.08, 0);
      this.buildShoe(leg, app.shoes);
      legs.push(leg);
    }
    [this.legL, this.legR] = legs;
    const hipColor = app.bottom === 'skirt' ? null : m.bottom;
    if (hipColor && app.top !== 'dress') add(this.hips, G.cyl(0.235, 0.22, 0.14, 14), hipColor, 0, 0.0, 0);
    if (app.bottom === 'skirt' && app.top !== 'dress') {
      add(this.hips, G.cyl(0.235, 0.36, 0.28, 16), m.bottom, 0, -0.08, 0);
    }

    // --- torso
    this.torso = new THREE.Group();
    this.torso.position.y = 0.55;
    this.body.add(this.torso);
    add(this.torso, G.cyl(0.2, 0.24, 0.5, 16), m.top, 0, 0.25, 0);
    if (app.top === 'dress') add(this.torso, G.cyl(0.24, 0.42, 0.36, 18), m.top, 0, -0.1, 0);
    if (app.top === 'hoodie') {
      const hood = add(this.torso, G.torus(0.17, 0.07, Math.PI * 2, 8, 16), m.top, 0, 0.47, -0.1);
      hood.rotation.x = Math.PI / 2.4;
      add(this.torso, G.box(0.26, 0.11, 0.05), m.top, 0, 0.1, 0.22).rotation.x = -0.12;
      add(this.torso, G.cyl(0.01, 0.01, 0.16, 5), WHITE, -0.05, 0.37, 0.205);
      add(this.torso, G.cyl(0.01, 0.01, 0.16, 5), WHITE, 0.05, 0.37, 0.205);
    }
    if (app.top === 'tshirt' || app.top === 'dress') {
      const collar = add(this.torso, G.torus(0.12, 0.025, Math.PI * 2, 6, 16), WHITE, 0, 0.5, 0);
      collar.rotation.x = Math.PI / 2;
    }
    this.buildJacket(app.jacket);

    // --- arms (pivot at shoulders)
    const arms = [];
    for (const side of [-1, 1]) {
      const arm = new THREE.Group();
      arm.position.set(side * 0.29, 1.0, 0);
      this.body.add(arm);
      add(arm, G.cyl(0.062, 0.058, 0.4, 8), m.skin, 0, -0.2, 0);
      const longSleeve = app.jacket !== 'none' || app.top === 'hoodie';
      if (app.jacket !== 'none') {
        const r = app.jacket === 'puffer' ? 0.1 : 0.085;
        add(arm, G.cyl(r, r - 0.008, 0.38, 10), m.jacket, 0, -0.18, 0);
        if (app.jacket === 'puffer') {
          const ring = add(arm, G.torus(r, 0.03, Math.PI * 2, 6, 12), m.jacket, 0, -0.2, 0);
          ring.rotation.x = Math.PI / 2;
        }
      } else if (longSleeve) add(arm, G.cyl(0.08, 0.075, 0.38, 10), m.top, 0, -0.18, 0);
      else add(arm, G.cyl(0.085, 0.08, 0.15, 10), m.top, 0, -0.06, 0);
      add(arm, G.sphere(0.07, 10, 8), m.skin, 0, -0.43, 0);
      const anchor = new THREE.Group();
      anchor.position.set(0, -0.46, 0.04);
      arm.add(anchor);
      arm.userData.anchor = anchor;
      arms.push(arm);
    }
    [this.armL, this.armR] = arms;
    this.thumb = add(this.armR, G.capsule(0.022, 0.06), m.skin, 0, -0.42, 0.07);
    this.thumb.rotation.x = Math.PI / 2;
    this.thumb.visible = false;
    if (this.heldItem) this.armR.userData.anchor.add(this.heldItem);
    if (this.cameraProp) this.armL.userData.anchor.add(this.cameraProp);

    // --- head
    this.head = new THREE.Group();
    this.head.position.y = 1.05;
    this.body.add(this.head);
    add(this.head, G.sphere(0.36, 22, 16), m.skin, 0, 0.36, 0);
    add(this.head, G.sphere(0.06, 8, 6), m.skin, -0.35, 0.34, 0).scale.set(0.6, 1, 1);
    add(this.head, G.sphere(0.06, 8, 6), m.skin, 0.35, 0.34, 0).scale.set(0.6, 1, 1);
    add(this.head, G.sphere(0.032, 8, 6), m.skin, 0, 0.31, 0.355);
    this.eyes = [];
    for (const side of [-1, 1]) {
      const eye = new THREE.Group();
      eye.position.set(side * 0.13, 0.38, 0.3);
      eye.rotation.y = side * 0.32;
      this.head.add(eye);
      add(eye, G.sphere(0.085, 14, 10), WHITE).scale.set(1, 1.15, 0.45);
      add(eye, G.sphere(0.064, 14, 10), m.iris, 0, -0.005, 0.02).scale.set(1, 1.1, 0.45);
      add(eye, G.sphere(0.034, 10, 8), DARK, 0, -0.005, 0.038).scale.set(1, 1.1, 0.4);
      add(eye, G.sphere(0.018, 8, 6), WHITE, 0.022, 0.03, 0.05);
      this.eyes.push(eye);
    }
    for (const side of [-1, 1]) add(this.head, G.sphere(0.055, 10, 8), CHEEK, side * 0.21, 0.27, 0.27).scale.set(1, 0.7, 0.35);
    this.mouthSmile = add(this.head, G.torus(0.075, 0.02, Math.PI, 6, 12), MOUTH, 0, 0.245, 0.335);
    this.mouthSmile.rotation.z = Math.PI;
    this.mouthO = add(this.head, G.sphere(0.05, 10, 8), MOUTH, 0, 0.23, 0.335);
    this.mouthO.scale.set(1, 1.2, 0.5);
    this.mouthO.visible = false;
    this.tongue = add(this.head, G.sphere(0.045, 10, 8), TONGUE, 0, 0.21, 0.35);
    this.tongue.scale.set(1, 1.3, 0.5);
    this.tongue.visible = false;
    this.buildHair(app.hairStyle);

    this.legL.rotation.set(0, 0, 0);
  }

  buildShoe(leg, kind) {
    const m = this.mats;
    const y = -0.45;
    if (kind === 'boots') {
      add(leg, G.cyl(0.1, 0.1, 0.22, 10), m.shoes, 0, y + 0.05, 0);
      add(leg, G.box(0.17, 0.08, 0.24), m.shoes, 0, y - 0.03, 0.04);
      add(leg, G.box(0.18, 0.03, 0.25), DARK, 0, y - 0.075, 0.04);
    } else if (kind === 'sandals') {
      add(leg, G.box(0.14, 0.07, 0.22), m.skin, 0, y - 0.02, 0.04);
      add(leg, G.box(0.17, 0.03, 0.26), m.shoes, 0, y - 0.07, 0.04);
      add(leg, G.box(0.16, 0.03, 0.04), m.shoes, 0, y + 0.0, 0.08);
      add(leg, G.box(0.16, 0.03, 0.04), m.shoes, 0, y + 0.0, -0.02);
    } else {
      add(leg, G.box(0.16, 0.1, 0.25), m.shoes, 0, y - 0.01, 0.045);
      add(leg, G.sphere(0.08, 10, 8), m.shoes, 0, y - 0.02, 0.15).scale.set(1, 0.65, 0.6);
      add(leg, G.box(0.17, 0.035, 0.29), kind === 'lightup' ? m.sole : WHITE, 0, y - 0.07, 0.05);
      add(leg, G.box(0.1, 0.012, 0.012), WHITE, 0, y + 0.045, 0.1);
    }
  }

  buildJacket(kind) {
    if (kind === 'none') return;
    const m = this.mats;
    const t = this.torso;
    if (kind === 'jean') {
      // open-front shell
      add(t, G.cyl(0.215, 0.255, 0.48, 16, true, 0.55, Math.PI * 2 - 1.1), m.jacketDouble, 0, 0.26, 0);
      const collar = add(t, G.torus(0.15, 0.04, Math.PI * 2, 6, 16), m.jacket, 0, 0.5, -0.02);
      collar.rotation.x = Math.PI / 2;
      for (const side of [-1, 1]) {
        add(t, G.box(0.08, 0.06, 0.02), m.jacket, side * 0.14, 0.33, 0.2).rotation.y = side * 0.5;
        add(t, G.box(0.05, 0.005, 0.005), DENIM_STITCH, side * 0.14, 0.31, 0.215).rotation.y = side * 0.5;
      }
    } else if (kind === 'puffer') {
      add(t, G.cyl(0.25, 0.28, 0.5, 16), m.jacket, 0, 0.25, 0);
      for (const y of [0.08, 0.22, 0.36]) {
        const ring = add(t, G.torus(0.26 - y * 0.08, 0.045, Math.PI * 2, 6, 18), m.jacket, 0, y, 0);
        ring.rotation.x = Math.PI / 2;
      }
      const collar = add(t, G.torus(0.15, 0.06, Math.PI * 2, 6, 16), m.jacket, 0, 0.5, 0);
      collar.rotation.x = Math.PI / 2;
      add(t, G.box(0.015, 0.45, 0.02), WHITE, 0, 0.25, 0.265);
    } else if (kind === 'raincoat') {
      add(t, G.cyl(0.225, 0.34, 0.72, 16), m.jacket, 0, 0.15, 0);
      const hood = add(t, G.torus(0.17, 0.08, Math.PI * 2, 8, 16), m.jacket, 0, 0.47, -0.12);
      hood.rotation.x = Math.PI / 2.4;
      for (const y of [0.0, 0.15, 0.3]) add(t, G.sphere(0.025, 8, 6), WHITE, 0, y, 0.25 - y * 0.06 + 0.04);
    }
  }

  buildHair(style) {
    const m = this.mats;
    const hd = this.head;
    // Base cap — tilted back so the forehead and eyes stay visible.
    const cap = add(hd, G.cap(0.385, Math.PI * 0.52), m.hair, 0, 0.38, -0.01);
    cap.rotation.x = -0.5;
    // bangs
    for (let i = -2; i <= 2; i++) {
      const b = add(hd, G.sphere(0.09, 10, 8), m.hair, i * 0.085, 0.6 - Math.abs(i) * 0.02, 0.27 - Math.abs(i) * 0.035);
      b.scale.set(1.1, 0.7, 0.7);
    }
    const tie = (x, y, z, rx = 0, rz = 0) => {
      const t = add(hd, G.torus(0.06, 0.025, Math.PI * 2, 6, 12), TIE, x, y, z);
      t.rotation.set(rx, 0, rz);
    };
    switch (style) {
      case 'short':
        for (const s of [-1, 1]) add(hd, G.sphere(0.12, 10, 8), m.hair, s * 0.3, 0.42, -0.06).scale.set(0.7, 1, 1);
        add(hd, G.sphere(0.3, 14, 10), m.hair, 0, 0.36, -0.12).scale.set(1.15, 1.05, 0.9);
        break;
      case 'long': {
        add(hd, G.box(0.66, 0.72, 0.18), m.hair, 0, 0.18, -0.22);
        add(hd, G.sphere(0.33, 14, 10), m.hair, 0, 0.38, -0.12).scale.set(1.12, 1.05, 0.9);
        for (const s of [-1, 1]) {
          const lock = add(hd, G.capsule(0.09, 0.42), m.hair, s * 0.31, 0.14, 0.02);
          lock.rotation.z = s * 0.08;
        }
        break;
      }
      case 'ponytail': {
        add(hd, G.sphere(0.32, 14, 10), m.hair, 0, 0.38, -0.12).scale.set(1.1, 1.05, 0.9);
        tie(0, 0.56, -0.38, 0.6);
        const tail = add(hd, G.capsule(0.1, 0.38), m.hair, 0, 0.32, -0.52);
        tail.rotation.x = 0.45;
        break;
      }
      case 'pigtails':
        add(hd, G.sphere(0.32, 14, 10), m.hair, 0, 0.38, -0.12).scale.set(1.1, 1.05, 0.9);
        for (const s of [-1, 1]) {
          tie(s * 0.38, 0.46, -0.08, 0, s * 1.2);
          const tail = add(hd, G.capsule(0.1, 0.32), m.hair, s * 0.5, 0.28, -0.08);
          tail.rotation.z = s * 0.45;
        }
        break;
      case 'curly': {
        const n = 26;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2 * 3.3;
          const yN = 1 - (i / (n - 1)) * 1.25; // 1 (top) -> -0.25
          const r = Math.sqrt(Math.max(0.05, 1 - yN * yN));
          const x = Math.sin(a) * r * 0.4;
          const z = Math.cos(a) * r * 0.4 - 0.06;
          if (z > 0.2 && yN < 0.55) continue; // keep the face clear
          add(hd, G.ico(0.12), m.hair, x, 0.38 + yN * 0.36, z);
        }
        break;
      }
      case 'afropuff': {
        add(hd, G.sphere(0.32, 14, 10), m.hair, 0, 0.4, -0.1).scale.set(1.1, 1.05, 0.95);
        add(hd, G.ico(0.32), m.hair, 0, 0.82, -0.18);
        add(hd, G.sphere(0.2, 12, 10), m.hair, 0, 0.66, -0.08).scale.set(1.2, 0.6, 1.2);
        const band = add(hd, G.torus(0.2, 0.035, Math.PI * 2, 6, 16), TIE, 0, 0.6, -0.12);
        band.rotation.x = Math.PI / 2 - 0.3;
        break;
      }
      case 'bun':
        add(hd, G.sphere(0.32, 14, 10), m.hair, 0, 0.38, -0.1).scale.set(1.1, 1.05, 0.9);
        add(hd, G.sphere(0.16, 14, 10), m.hair, 0, 0.8, -0.12);
        tie(0, 0.68, -0.11, Math.PI / 2 - 0.2);
        break;
    }
  }

  // ------------------------------------------------------------ props / bubbles
  setLabel(text, color) {
    if (this.labelSprite) this.root.remove(this.labelSprite);
    this.labelSprite = makeSprite(labelTexture(text, color), 0.34);
    this.labelSprite.position.y = 2.25 * this.scaleFactor;
    this.root.add(this.labelSprite);
  }

  showBubble(tex, height, seconds) {
    if (this.bubble) {
      this.root.remove(this.bubble);
      this.bubble.material.dispose();
    }
    this.bubble = makeSprite(tex, height);
    this.bubble.userData.baseScale = this.bubble.scale.clone();
    this.bubble.position.y = (this.labelSprite?.visible ? 2.75 : 2.3) * this.scaleFactor + height / 2 - 0.2;
    this.bubbleT = seconds;
    this.bubbleTotal = seconds;
    this.root.add(this.bubble);
  }

  clearBubble() {
    if (!this.bubble) return;
    this.root.remove(this.bubble);
    this.bubble.material.dispose();
    this.bubble = null;
  }

  say(text) {
    this.showBubble(speechTexture(text), 0.75, 3.2);
  }

  playEmote(name) {
    if (!EMOTE_DURATION[name]) return;
    this.emote = name;
    this.emoteT = 0;
    const info = EMOTE_INFO[name];
    if (info && name !== 'jump') this.showBubble(emojiTexture(info.emoji), 0.7, 2.0);
  }

  holdCamera(on) {
    this.holdingCamera = on;
    if (on && !this.cameraProp) {
      const cam = new THREE.Group();
      add(cam, G.box(0.2, 0.14, 0.1), CAMERA_BODY);
      const lens = add(cam, G.cyl(0.045, 0.05, 0.06, 12), CAMERA_LENS, 0, 0, 0.07);
      lens.rotation.x = Math.PI / 2;
      add(cam, G.sphere(0.02, 8, 6), new THREE.MeshLambertMaterial({ color: '#ff3b3b', emissive: '#aa0000' }), 0.07, 0.05, 0.05);
      cam.rotation.x = -0.3;
      this.cameraProp = cam;
      this.armL.userData.anchor.add(cam);
    }
    if (this.cameraProp) this.cameraProp.visible = on;
  }

  /** Put an object in the right hand (used for the bite animation). */
  setHeldItem(obj) {
    if (this.heldItem) this.heldItem.parent?.remove(this.heldItem);
    this.heldItem = obj;
    if (obj) this.armR.userData.anchor.add(obj);
  }

  // ------------------------------------------------------------ animation
  update(dt) {
    this.time += dt;
    const moving = this.speed > 0.05;
    this.walkAmt += ((moving ? 1 : 0) - this.walkAmt) * damp(10, dt);
    this.phase += dt * (4 + 7 * this.speed);

    const w = this.walkAmt;
    const s = Math.sin(this.phase);
    const breath = Math.sin(this.time * 2.2) * 0.012;
    const P = {
      armLx: -s * 0.65 * w, armRx: s * 0.65 * w, armLz: -0.12, armRz: 0.12,
      legLx: s * 0.75 * w, legRx: -s * 0.75 * w,
      bodyY: Math.abs(Math.cos(this.phase)) * 0.07 * w + breath,
      headX: 0, headZ: Math.sin(this.time * 1.3) * 0.03, headY: 0, bodyRy: 0, mouth: 'smile', squint: false, thumb: false,
    };
    if (this.pose === 'sit') {
      P.legLx = P.legRx = -1.45;
      P.armLx = P.armRx = -0.55;
      P.bodyY = breath;
    }
    if (this.holdingCamera) {
      P.armLx = -1.35;
      P.armLz = -0.35;
    }

    // Emote overlay
    if (this.emote !== 'jump') this.jumpY = 0;
    if (this.emote) {
      const dur = EMOTE_DURATION[this.emote];
      this.emoteT += dt;
      const t = this.emoteT;
      const k = smooth01(Math.min(1, t / 0.18)) * smooth01(Math.min(1, (dur - t) / 0.22));
      const E = this.emotePose(this.emote, t, dur);
      for (const key in E) {
        if (typeof E[key] === 'number') P[key] = lerp(P[key], E[key], k);
        else P[key] = E[key];
      }
      if (t >= dur) this.emote = null;
    }

    // Apply
    this.armL.rotation.set(P.armLx, 0, P.armLz);
    this.armR.rotation.set(P.armRx, 0, P.armRz);
    this.legL.rotation.x = P.legLx;
    this.legR.rotation.x = P.legRx;
    this.body.position.y = P.bodyY + this.jumpY;
    this.body.rotation.y = P.bodyRy;
    this.head.rotation.set(P.headX, P.headY, P.headZ);
    this.mouthSmile.visible = P.mouth === 'smile' || P.mouth === 'tongue';
    this.mouthO.visible = P.mouth === 'o' || P.mouth === 'chomp';
    if (P.mouth === 'chomp') this.mouthO.scale.y = 0.4 + Math.abs(Math.sin(this.time * 18)) * 1.0;
    else this.mouthO.scale.y = 1.2;
    this.tongue.visible = P.mouth === 'tongue';
    this.thumb.visible = P.thumb;

    // Blink / squint
    this.blinkT -= dt;
    let eyeY = 1;
    if (this.blinkT < 0) {
      eyeY = 0.1;
      if (this.blinkT < -0.12) this.blinkT = 2.5 + Math.random() * 3;
    }
    if (P.squint) eyeY = 0.25;
    for (const e of this.eyes) e.scale.y = eyeY;

    // Light-up shoes twinkle while walking
    if (this.app.shoes === 'lightup') {
      this.lightHue = (this.lightHue + dt * (0.3 + w * 1.5)) % 1;
      const glow = 0.25 + w * 0.75 * (0.5 + 0.5 * Math.sin(this.time * 14));
      this.mats.sole.emissive.setHSL(this.lightHue, 1, 0.5 * glow);
    }

    // Bubble pop-in / fade
    if (this.bubble) {
      this.bubbleT -= dt;
      const age = this.bubbleTotal - this.bubbleT;
      const pop = age < 0.25 ? 0.4 + 0.6 * smooth01(age / 0.25) * 1.1 : 1;
      this.bubble.scale.copy(this.bubble.userData.baseScale).multiplyScalar(Math.min(pop, 1.08));
      this.bubble.material.opacity = Math.min(1, this.bubbleT / 0.3);
      this.bubble.position.y += Math.sin(this.time * 3) * 0.0015;
      if (this.bubbleT <= 0) {
        this.root.remove(this.bubble);
        this.bubble.material.dispose();
        this.bubble = null;
      }
    }
  }

  emotePose(name, t, dur) {
    const f = t / dur;
    switch (name) {
      case 'wave':
        return { armRz: 2.6 + Math.sin(t * 12) * 0.35, armRx: 0, headZ: 0.12, mouth: 'smile' };
      case 'wow':
        return { armRz: 2.5, armLz: -2.5, armRx: 0, armLx: 0, bodyY: Math.abs(Math.sin(t * 6)) * 0.15, mouth: 'o', headX: -0.15 };
      case 'yum':
        return { armRx: -1.0, armRz: -0.75 + Math.sin(t * 10) * 0.18, armLx: -0.9, armLz: 0.7 - Math.sin(t * 10) * 0.18, squint: true, mouth: 'smile', headZ: Math.sin(t * 5) * 0.15 };
      case 'thumbs':
        return { armRx: -1.45, armRz: 0.25, thumb: true, headZ: -0.12, squint: f > 0.2 && f < 0.8, mouth: 'smile' };
      case 'silly':
        return { headZ: Math.sin(t * 9) * 0.38, armLz: -2.6 + Math.sin(t * 14) * 0.2, armRz: 2.6 - Math.sin(t * 14) * 0.2, armLx: -0.3, armRx: -0.3, mouth: 'tongue', squint: true };
      case 'kiss': {
        const toMouth = f < 0.45;
        return toMouth
          ? { armRx: -2.2, armRz: -0.45, mouth: 'o', squint: true, headX: 0.05 }
          : { armRx: -1.3, armRz: 1.4, mouth: 'smile', squint: true, headX: -0.12 };
      }
      case 'dance':
        return {
          bodyRy: f * Math.PI * 2, bodyY: Math.abs(Math.sin(t * 8)) * 0.14,
          armRz: 1.8 + Math.sin(t * 8) * 0.8, armLz: -1.8 + Math.sin(t * 8) * 0.8, armRx: 0, armLx: 0,
          legLx: Math.sin(t * 8) * 0.4, legRx: -Math.sin(t * 8) * 0.4, mouth: 'smile', squint: true,
        };
      case 'heart':
        return { armRz: 2.75, armLz: -2.75, armRx: -0.35, armLx: -0.35, mouth: 'smile', squint: true, headZ: Math.sin(t * 4) * 0.12 };
      case 'jump':
        this.jumpY = Math.sin(Math.min(1, f) * Math.PI) * 0.9;
        if (f >= 1) this.jumpY = 0;
        return { armRz: 1.2, armLz: -1.2, legLx: -0.4, legRx: -0.2, mouth: 'o' };
      case 'bite': {
        const up = f < 0.75;
        return up
          ? { armRx: -2.35, armRz: -0.5, mouth: f > 0.3 ? 'chomp' : 'o', squint: f > 0.35 }
          : { armRx: -0.9, armRz: -0.2, mouth: 'smile', squint: true };
      }
    }
    return {};
  }
}
