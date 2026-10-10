// The sushi conveyor belt: a counter across the front of the dining room with plates of
// food gliding past. main.js does the tapping (see pick) and flies the grabbed plate to the table.
import * as THREE from '../vendor/three.module.js';
import { mat, stripeTexture, emojiTexture, makeSprite } from './util.js';
import { createFood } from './food.js';

export const BELT_SPEEDS = { slow: 0.55, fast: 1.6 }; // units per second
const LENGTH = 14.4; // wall to wall and a little more, so plates loop out of sight
const SLOTS = 8;
const MYSTERY_SLOT = 3; // one plate hides a Mystery Plate under a silver dome
const BELT_Y = 0.8;
const BELT_Z = 3.2;
const HIT_RADIUS = 0.62; // generous, so a small finger never misses
const SUNK = -1.7; // the whole counter sinks into the floor while a review is being filmed
const PLATE_COLORS = ['#ff8fc7', '#74c0fc', '#ffd23f', '#8ce99a', '#b197fc'];

const DISH = new THREE.CylinderGeometry(0.42, 0.34, 0.05, 24);
const DOME = new THREE.SphereGeometry(0.36, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
const KNOB = new THREE.SphereGeometry(0.06, 8, 6);
const tmp = new THREE.Vector3();

export class SushiBelt {
  /** `parent` is the interior set; the belt stays hidden until a restaurant with a belt is loaded. */
  constructor(parent) {
    this.group = new THREE.Group();
    this.group.position.set(0, 0, BELT_Z);
    this.group.visible = false;
    parent.add(this.group);

    this.bodyMat = new THREE.MeshLambertMaterial();
    this.trimMat = new THREE.MeshLambertMaterial();
    const body = new THREE.Mesh(new THREE.BoxGeometry(LENGTH, BELT_Y - 0.08, 1.0), this.bodyMat);
    body.position.y = (BELT_Y - 0.08) / 2;
    const counter = new THREE.Mesh(new THREE.BoxGeometry(LENGTH, 0.08, 1.16), this.trimMat);
    counter.position.y = BELT_Y - 0.04;
    // the moving belt is a striped texture that scrolls along with the plates
    this.tex = stripeTexture('#4a4458', '#5d5770', 2).clone();
    this.tex.wrapS = THREE.RepeatWrapping;
    this.tex.repeat.set(LENGTH / 1.2, 1);
    this.tex.needsUpdate = true;
    const top = new THREE.Mesh(new THREE.PlaneGeometry(LENGTH, 0.74), new THREE.MeshLambertMaterial({ map: this.tex }));
    top.rotation.x = -Math.PI / 2;
    top.position.y = BELT_Y + 0.005;
    this.group.add(body, counter, top);

    this.plates = [];
    this.speed = BELT_SPEEDS.slow;
    this.offset = 0;
    this.active = false; // a restaurant's plates are loaded
    this.raised = true; // false = sink out of the way
    this.lift = 0;
  }

  /** Fill the belt with restaurant r's menu (repeating) and one Mystery Plate dome. */
  load(r) {
    this.unload();
    this.bodyMat.color.set(r.accent);
    this.trimMat.color.set(r.trim);
    let next = 0;
    for (let slot = 0; slot < SLOTS; slot++) {
      const mystery = slot === MYSTERY_SLOT;
      const item = mystery ? null : r.menu[next++ % r.menu.length];
      const g = new THREE.Group();
      g.add(new THREE.Mesh(DISH, mat(mystery ? '#ffffff' : PLATE_COLORS[slot % PLATE_COLORS.length])));
      const plate = { group: g, slot, item, mystery, taken: false, food: null, sprite: null };
      if (mystery) {
        const dome = new THREE.Mesh(DOME, mat('#dfe6f0'));
        dome.position.y = 0.02;
        const knob = new THREE.Mesh(KNOB, mat('#ffd23f'));
        knob.position.y = 0.4;
        plate.sprite = makeSprite(emojiTexture('🎲'), 0.42);
        plate.sprite.position.y = 0.78;
        g.add(dome, knob, plate.sprite);
      } else {
        plate.food = createFood(item.id, r.accent);
        plate.food.scale.setScalar(1.25);
        plate.food.position.y = 0.03;
        g.add(plate.food);
      }
      this.group.add(g);
      this.plates.push(plate);
    }
    this.active = true;
    this.raised = true;
    this.lift = 0;
    this.offset = 0; // always starts the same way: the dome is just gliding into view on the left
    this.update(0);
  }

  unload() {
    for (const p of this.plates) {
      this.group.remove(p.group);
      p.food?.traverse((o) => o.geometry?.dispose());
      p.sprite?.material.dispose();
    }
    this.plates = [];
    this.active = false;
    this.group.visible = false;
  }

  setFast(fast) {
    this.speed = fast ? BELT_SPEEDS.fast : BELT_SPEEDS.slow;
  }

  update(dt) {
    if (!this.active) return;
    this.lift += ((this.raised ? 0 : SUNK) - this.lift) * (1 - Math.exp(-6 * dt));
    this.group.position.y = this.lift;
    this.group.visible = this.lift > SUNK + 0.05;
    if (!this.group.visible) return;
    this.offset = (this.offset + this.speed * dt) % LENGTH;
    this.tex.offset.x = -(this.offset / LENGTH) * this.tex.repeat.x;
    for (const p of this.plates) {
      if (p.taken) continue;
      const x = (p.slot * (LENGTH / SLOTS) + this.offset) % LENGTH;
      p.group.position.set(x - LENGTH / 2, BELT_Y + 0.03, 0);
    }
  }

  /** World position of the middle of a plate's food (for picking and for tests). */
  plateCenter(plate, out) {
    return plate.group.getWorldPosition(out).setY(out.y + 0.15);
  }

  /** The plate nearest to `ray` (THREE.Ray, world space) within a finger's width, or null. */
  pick(ray) {
    let best = null;
    let bestDist = HIT_RADIUS;
    for (const p of this.plates) {
      if (p.taken) continue;
      const d = ray.distanceToPoint(this.plateCenter(p, tmp));
      if (d < bestDist) {
        bestDist = d;
        best = p;
      }
    }
    return best;
  }
}
