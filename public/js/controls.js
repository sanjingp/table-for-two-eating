// Input: floating virtual joystick (touch events + mouse pointer fallback),
// WASD / arrow keys, and drag-to-look on the 3D canvas.
import { clamp } from './util.js';

export class Controls {
  constructor({ zone, base, knob, canvas }) {
    this.zone = zone;
    this.base = base;
    this.knob = knob;
    this.joy = { x: 0, y: 0 }; // x: right, y: forward (both -1..1)
    this.keys = new Set();
    this.touchId = null;
    this.mouseDown = false;
    this.origin = { x: 0, y: 0 };
    this.radius = 60;
    this.lookDelta = 0; // accumulated horizontal drag (px) for camera yaw
    this.lookDeltaY = 0;
    this.enabled = true;

    const opts = { passive: false };
    zone.addEventListener('touchstart', (e) => this.onTouchStart(e), opts);
    zone.addEventListener('touchmove', (e) => this.onTouchMove(e), opts);
    zone.addEventListener('touchend', (e) => this.onTouchEnd(e), opts);
    zone.addEventListener('touchcancel', (e) => this.onTouchEnd(e), opts);
    // Mouse fallback (touch is handled above so we ignore pointerType 'touch' here).
    zone.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse') return;
      this.mouseDown = true;
      this.start(e.clientX, e.clientY);
      zone.setPointerCapture?.(e.pointerId);
    });
    zone.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'mouse' && this.mouseDown) this.move(e.clientX, e.clientY);
    });
    const mouseUp = (e) => {
      if (e.pointerType === 'mouse' && this.mouseDown) {
        this.mouseDown = false;
        this.end();
      }
    };
    zone.addEventListener('pointerup', mouseUp);
    zone.addEventListener('pointercancel', mouseUp);

    // Keyboard
    addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement) return;
      const k = e.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) {
        this.keys.add(k);
        e.preventDefault();
      }
    });
    addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    addEventListener('blur', () => this.keys.clear());

    // Drag on the canvas to turn the camera (one finger or mouse).
    let lookId = null;
    let lastX = 0;
    let lastY = 0;
    canvas.addEventListener('pointerdown', (e) => {
      if (lookId !== null) return;
      lookId = e.pointerId;
      lastX = e.clientX;
      lastY = e.clientY;
      canvas.setPointerCapture?.(e.pointerId);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (e.pointerId !== lookId) return;
      this.lookDelta += e.clientX - lastX;
      this.lookDeltaY += e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
    });
    const lookEnd = (e) => {
      if (e.pointerId === lookId) lookId = null;
    };
    canvas.addEventListener('pointerup', lookEnd);
    canvas.addEventListener('pointercancel', lookEnd);
    this.resetBase();
    addEventListener('resize', () => this.resetBase());
  }

  resetBase() {
    // Rest position: centred in the zone's lower-left area
    this.base.style.left = '';
    this.base.style.top = '';
    this.base.classList.remove('active');
    this.knob.style.transform = 'translate(-50%, -50%)';
  }

  start(x, y) {
    const zr = this.zone.getBoundingClientRect();
    this.origin = { x, y };
    this.base.style.left = `${x - zr.left}px`;
    this.base.style.top = `${y - zr.top}px`;
    this.base.classList.add('active');
    this.move(x, y);
  }

  move(x, y) {
    let dx = x - this.origin.x;
    let dy = y - this.origin.y;
    const d = Math.hypot(dx, dy);
    if (d > this.radius) {
      dx = (dx / d) * this.radius;
      dy = (dy / d) * this.radius;
    }
    this.knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    const dead = 0.12;
    const nx = dx / this.radius;
    const ny = -dy / this.radius;
    const mag = Math.hypot(nx, ny);
    if (mag < dead) this.joy = { x: 0, y: 0 };
    else {
      const k = (mag - dead) / (1 - dead) / mag;
      this.joy = { x: nx * k, y: ny * k };
    }
  }

  end() {
    this.joy = { x: 0, y: 0 };
    this.resetBase();
  }

  onTouchStart(e) {
    e.preventDefault();
    if (this.touchId !== null) return;
    const t = e.changedTouches[0];
    this.touchId = t.identifier;
    this.start(t.clientX, t.clientY);
  }
  onTouchMove(e) {
    e.preventDefault();
    for (const t of e.changedTouches) if (t.identifier === this.touchId) this.move(t.clientX, t.clientY);
  }
  onTouchEnd(e) {
    for (const t of e.changedTouches) {
      if (t.identifier === this.touchId) {
        this.touchId = null;
        this.end();
      }
    }
  }

  /** Combined movement input { x, y } with magnitude <= 1. */
  get move2() {
    let x = this.joy.x;
    let y = this.joy.y;
    const k = this.keys;
    if (k.has('a') || k.has('arrowleft')) x -= 1;
    if (k.has('d') || k.has('arrowright')) x += 1;
    if (k.has('w') || k.has('arrowup')) y += 1;
    if (k.has('s') || k.has('arrowdown')) y -= 1;
    const m = Math.hypot(x, y);
    if (m > 1) {
      x /= m;
      y /= m;
    }
    return { x: clamp(x, -1, 1), y: clamp(y, -1, 1) };
  }

  takeLook() {
    const d = { x: this.lookDelta, y: this.lookDeltaY };
    this.lookDelta = 0;
    this.lookDeltaY = 0;
    return d;
  }
}
