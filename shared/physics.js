// Física determinística da mesa (passo fixo). Usada pelo servidor, pelo cliente e pelos bots.
(function (g) {
  const W = 900, H = 450, R = 13, PR = 20, E_B = 0.96, E_R = 0.78;
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
  // Tabelas: faces planas em x=0, x=W, y=0, y=H (a bola encosta quando o centro chega a R da face).
  // Em cada caçapa a tabela termina numa quina arredondada (raio KR); a bola colide com a face enquanto o
  // centro está sobre ela e com a quina quando passa pela boca da caçapa. Nada de "zona sem parede".
  const KR = 3, MC = 32, MS = 26, E_K = 0.6; // raio da quina, recuo da quina nos cantos, meia-boca da caçapa lateral, restituição da quina
  const KN = [ // centros das quinas (tangentes às faces, por isso a transição face/quina é contínua)
    [MC, -KR], [W / 2 - MS, -KR], [W / 2 + MS, -KR], [W - MC, -KR],
    [MC, H + KR], [W / 2 - MS, H + KR], [W / 2 + MS, H + KR], [W - MC, H + KR],
    [-KR, MC], [-KR, H - MC], [W + KR, MC], [W + KR, H - MC]
  ];
  const onX = x => (x >= MC && x <= W / 2 - MS) || (x >= W / 2 + MS && x <= W - MC); // trecho de tabela no topo/fundo
  const onY = y => y >= MC && y <= H - MC;                                           // trecho de tabela nas laterais
  function bounce(b, nx, ny, e) { // (nx,ny) aponta da parede para a bola
    const vn = b.vx * nx + b.vy * ny;
    if (vn >= 0) return false;
    b.vx -= (1 + e) * vn * nx; b.vy -= (1 + e) * vn * ny; return true;
  }
  function walls(b) {
    let hit = false;
    if (onX(b.x)) {
      if (b.y < R) { b.y = R; hit = bounce(b, 0, 1, E_R) || hit; } else if (b.y > H - R) { b.y = H - R; hit = bounce(b, 0, -1, E_R) || hit; }
    }
    if (onY(b.y)) {
      if (b.x < R) { b.x = R; hit = bounce(b, 1, 0, E_R) || hit; } else if (b.x > W - R) { b.x = W - R; hit = bounce(b, -1, 0, E_R) || hit; }
    }
    const rr = (R + KR) * (R + KR);
    for (const k of KN) {
      const dx = b.x - k[0], dy = b.y - k[1], d2 = dx * dx + dy * dy;
      if (d2 >= rr || d2 === 0) continue;
      const d = Math.sqrt(d2), nx = dx / d, ny = dy / d;
      b.x = k[0] + nx * (R + KR); b.y = k[1] + ny * (R + KR);
      hit = bounce(b, nx, ny, E_K) || hit;
    }
    return hit;
  }
  const SP = new Array(16).fill(0); // velocidade de cada bola no início do passo (para contar toques na tabela)
  function step(balls, h, o) {
    for (let i = 0; i < balls.length; i++) {
      const b = balls[i]; if (b.in) continue;
      b.x += b.vx * h; b.y += b.vy * h;
      const sp = Math.hypot(b.vx, b.vy);
      if (sp) { const n = Math.max(0, sp - (150 + sp * 0.3) * h); if (n < 5) b.vx = b.vy = 0; else { b.vx *= n / sp; b.vy *= n / sp; } }
      SP[i] = sp;
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
    for (let i = 0; i < balls.length; i++) { // paredes por último: nenhuma bola termina o passo dentro da tabela, nem empurrada por outra bola
      const b = balls[i]; if (b.in) continue;
      if (walls(b) && SP[i] > 20) { if (b.id && !o.rails.includes(b.id)) o.rails.push(b.id); if (o.first !== null) o.railAfter = true; }
    }
    for (const b of balls) {
      if (b.in) continue;
      // caiu: entrou no raio da caçapa ou o centro passou da linha da tabela pela boca da caçapa (garantia contra bola "fugindo" da mesa)
      if (POCKETS.some(p => Math.hypot(b.x - p[0], b.y - p[1]) < PR) || b.x < 0 || b.x > W || b.y < 0 || b.y > H) { b.in = true; b.vx = b.vy = 0; o.pocketed.push(b.id); }
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
  const API = { C: { W, H, R, PR, POCKETS, KR, KN }, rack, simulate, strike };
  if (typeof module === 'object') module.exports = API; else g.PoolPhysics = API;
})(typeof window !== 'undefined' ? window : globalThis);
