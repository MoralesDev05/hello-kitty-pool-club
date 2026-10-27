// Física determinística da mesa (passo fixo). Usada pelo servidor, pelo cliente e pelos bots.
(function (g) {
  const W = 900, H = 450, R = 10, PR = 20, E_B = 0.96, E_R = 0.78;
  const POCKETS = [[-2, -2], [W / 2, -9], [W + 2, -2], [-2, H + 2], [W / 2, H + 9], [W + 2, H + 2]];
  const ORDER = [15, 9, 2, 10, 8, 3, 11, 4, 12, 5, 13, 6, 14, 7, 1]; // 8 no centro, uma lisa e uma listrada nos cantos
  function rack() {
    const balls = [{ id: 0, x: W * 0.25, y: H / 2, vx: 0, vy: 0, in: false }], by = [];
    let k = 0;
    for (let r = 0; r < 5; r++) for (let c = 0; c <= r; c++) {
      const id = ORDER[k++];
      by[id] = { id, x: W * 0.7 + r * (R * 1.732 + 0.4), y: H / 2 + (c - r / 2) * (2 * R + 0.4), vx: 0, vy: 0, in: false };
    }
    for (let i = 1; i <= 15; i++) balls.push(by[i]);
    return balls;
  }
  const zone = b => POCKETS.some(p => Math.hypot(b.x - p[0], b.y - p[1]) < PR * 1.7);
  function step(balls, h, o) {
    for (const b of balls) {
      if (b.in) continue;
      b.x += b.vx * h; b.y += b.vy * h;
      const sp = Math.hypot(b.vx, b.vy);
      if (sp) { const n = Math.max(0, sp - (150 + sp * 0.3) * h); if (n < 5) b.vx = b.vy = 0; else { b.vx *= n / sp; b.vy *= n / sp; } }
      if (zone(b)) continue;
      let hit = false;
      if (b.x < R) { b.x = R; if (b.vx < 0) { b.vx *= -E_R; hit = true; } } else if (b.x > W - R) { b.x = W - R; if (b.vx > 0) { b.vx *= -E_R; hit = true; } }
      if (b.y < R) { b.y = R; if (b.vy < 0) { b.vy *= -E_R; hit = true; } } else if (b.y > H - R) { b.y = H - R; if (b.vy > 0) { b.vy *= -E_R; hit = true; } }
      if (hit && sp > 20) { if (b.id && !o.rails.includes(b.id)) o.rails.push(b.id); if (o.first !== null) o.railAfter = true; }
    }
    for (let i = 0; i < balls.length; i++) {
      const a = balls[i]; if (a.in) continue;
      for (let j = i + 1; j < balls.length; j++) {
        const b = balls[j]; if (b.in) continue;
        const dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy;
        if (d2 >= 4 * R * R || d2 === 0) continue;
        const d = Math.sqrt(d2), nx = dx / d, ny = dy / d, ov = (2 * R - d) / 2;
        a.x += nx * ov; a.y += ny * ov; b.x -= nx * ov; b.y -= ny * ov;
        const vn = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
        if (vn < 0) {
          const k = -(1 + E_B) * vn / 2;
          a.vx += k * nx; a.vy += k * ny; b.vx -= k * nx; b.vy -= k * ny;
          if (o.first === null && i === 0) o.first = j;
        }
      }
    }
    for (const b of balls) {
      if (b.in) continue;
      if (POCKETS.some(p => Math.hypot(b.x - p[0], b.y - p[1]) < PR)) { b.in = true; b.vx = b.vy = 0; o.pocketed.push(b.id); }
    }
  }
  function simulate(balls, record) {
    const o = { first: null, pocketed: [], railAfter: false, rails: [], frames: record ? [] : null };
    const snap = () => { const a = new Array(32); for (let i = 0; i < 16; i++) { const b = balls[i]; a[2 * i] = b.in ? -100 : Math.round(b.x * 10) / 10; a[2 * i + 1] = b.in ? -100 : Math.round(b.y * 10) / 10; } return a; };
    if (record) o.frames.push(snap());
    for (let f = 0; f < 3600; f++) {
      for (let s = 0; s < 4; s++) step(balls, 1 / 240, o);
      if (record) o.frames.push(snap());
      if (!balls.some(b => !b.in && (b.vx || b.vy))) break;
    }
    return o;
  }
  function strike(balls, angle, power) {
    const v = 80 + 1420 * power; balls[0].vx = Math.cos(angle) * v; balls[0].vy = Math.sin(angle) * v;
  }
  const API = { C: { W, H, R, PR, POCKETS }, rack, simulate, strike };
  if (typeof module === 'object') module.exports = API; else g.PoolPhysics = API;
})(typeof window !== 'undefined' ? window : globalThis);
