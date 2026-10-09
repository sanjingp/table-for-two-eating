// Lightweight 2D confetti burst on its own canvas (only animates while active).
const COLORS = ['#ff5fa2', '#ffd23f', '#3a86ff', '#2ec4b6', '#9b5de5', '#ff9f1c', '#7ae582'];
let canvas;
let ctx;
let parts = [];
let running = false;

export function initConfetti(el) {
  canvas = el;
  ctx = canvas.getContext('2d');
}

export function confetti(count = 160) {
  if (!canvas) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  for (let i = 0; i < count; i++) {
    const fromLeft = i % 2 === 0;
    parts.push({
      x: fromLeft ? -10 : innerWidth + 10,
      y: innerHeight * (0.55 + Math.random() * 0.3),
      vx: (fromLeft ? 1 : -1) * (250 + Math.random() * 450),
      vy: -(500 + Math.random() * 600),
      r: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 12,
      w: 8 + Math.random() * 8,
      hgt: 5 + Math.random() * 6,
      c: COLORS[i % COLORS.length],
      round: Math.random() < 0.3,
      life: 0,
    });
  }
  if (!running) {
    running = true;
    let last = performance.now();
    const step = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      for (const p of parts) {
        p.life += dt;
        p.vy += 900 * dt;
        p.vx *= 1 - 1.2 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.r += p.vr * dt;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.r);
        ctx.fillStyle = p.c;
        if (p.round) {
          ctx.beginPath();
          ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2);
          ctx.fill();
        } else ctx.fillRect(-p.w / 2, -p.hgt / 2, p.w, p.hgt * Math.abs(Math.cos(p.r * 2)) + 1);
        ctx.restore();
      }
      parts = parts.filter((p) => p.y < innerHeight + 40 && p.life < 5);
      if (parts.length) requestAnimationFrame(step);
      else {
        running = false;
        ctx.clearRect(0, 0, innerWidth, innerHeight);
      }
    };
    requestAnimationFrame(step);
  }
}
