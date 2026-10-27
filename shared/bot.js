// Bots: mesmas regras e mesma física do jogador humano (usam Rules.playShot).
(function (g) {
  const P = typeof require === 'function' ? require('./physics.js') : g.PoolPhysics;
  const Rules = typeof require === 'function' ? require('./rules.js') : g.PoolRules;
  const { W, H, R, POCKETS } = P.C;
  function targets(st) {
    const gr = st.groups[st.turn], out = [];
    const clear = gr && Rules.left(st.balls, gr) === 0;
    for (let i = 1; i < 16; i++) {
      if (st.balls[i].in) continue;
      const t = Rules.grp(i);
      if (clear ? t === 'eight' : gr ? t === gr : t !== 'eight') out.push(i);
    }
    return out;
  }
  const segD = (px, py, ax, ay, bx, by) => { const dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy || 1; let t = ((px - ax) * dx + (py - ay) * dy) / l; t = Math.max(0, Math.min(1, t)); return Math.hypot(px - ax - t * dx, py - ay - t * dy); };
  function candidates(st, cue) {
    const out = [];
    for (const id of targets(st)) {
      const t = st.balls[id];
      for (const p of POCKETS) {
        const dx = p[0] - t.x, dy = p[1] - t.y, d = Math.hypot(dx, dy), ux = dx / d, uy = dy / d;
        const gx = t.x - ux * 2 * R, gy = t.y - uy * 2 * R, ax = gx - cue.x, ay = gy - cue.y, al = Math.hypot(ax, ay);
        if (al < 1) continue;
        const cos = (ax * ux + ay * uy) / al;
        if (cos < 0.25) continue;
        let blocked = false;
        for (const o of st.balls) {
          if (o.in || o.id === 0 || o.id === id) continue;
          if (segD(o.x, o.y, cue.x, cue.y, gx, gy) < 2 * R - 1 || segD(o.x, o.y, t.x, t.y, p[0], p[1]) < 2 * R - 1) { blocked = true; break; }
        }
        const v = Math.sqrt(320 * (al + d) * 1.2);
        out.push({ id, angle: Math.atan2(ay, ax), power: Math.min(1, Math.max(0.2, (v - 80) / 1420 + 0.15)), score: al + d * 0.8 + (1 - cos) * 400 + (blocked ? 1000 : 0), blocked });
      }
    }
    return out.sort((a, b) => a.score - b.score);
  }
  function placement(st, level) {
    const pts = [];
    if (st.phase === 'break') pts.push({ x: W * 0.22, y: H / 2 });
    else for (let x = 60; x < W - 40; x += 90) for (let y = 50; y < H - 30; y += 70) pts.push({ x, y });
    pts.push({ x: W * 0.25, y: H / 2 });
    const ok = pts.filter(p => Rules.validCue(st, p.x, p.y));
    if (level !== 'hard' || st.phase === 'break') return ok[0] || { x: W * 0.25, y: H / 2 };
    let best = ok[0], bs = Infinity;
    for (const p of ok) { const c = candidates(st, p)[0]; if (c && c.score < bs) { bs = c.score; best = p; } }
    return best;
  }
  function value(st, r, me) {
    const s = r.state;
    if (s.phase === 'over') return s.winner === me ? 1e4 : -1e4;
    const mine = s.groups[me];
    let v = 100 * r.res.pocketed.filter(i => i && (mine ? Rules.grp(i) === mine : true)).length;
    v += s.turn === me ? 40 : -20;
    if (s.lastEvent.type === 'foul') v -= 150;
    return v;
  }
  function chooseShot(st, level, rnd) {
    rnd = rnd || Math.random;
    const cue = st.inHand ? placement(st, level) : st.balls[0];
    const base = st.inHand ? { cue } : {};
    if (st.phase === 'break') return { ...base, angle: (rnd() - 0.5) * (level === 'easy' ? 0.08 : 0.02), power: level === 'easy' ? 0.75 : 0.97 };
    const c = candidates(st, cue);
    if (!c.length) { // sem tacada geométrica: acerta a bola legal mais próxima
      const t = targets(st).map(i => st.balls[i]).sort((a, b) => Math.hypot(a.x - cue.x, a.y - cue.y) - Math.hypot(b.x - cue.x, b.y - cue.y))[0];
      return { ...base, angle: Math.atan2(t.y - cue.y, t.x - cue.x) + (rnd() - 0.5) * 0.03, power: 0.55 };
    }
    if (level === 'easy') {
      if (rnd() < 0.2) return { ...base, angle: rnd() * Math.PI * 2, power: 0.3 + rnd() * 0.4 };
      const p = c[Math.floor(rnd() * c.length)];
      return { ...base, angle: p.angle + (rnd() - 0.5) * 0.14, power: 0.35 + rnd() * 0.4 };
    }
    if (level === 'medium') { const p = c.find(x => !x.blocked) || c[0]; return { ...base, angle: p.angle + (rnd() - 0.5) * 0.03, power: p.power }; }
    let best = null, bv = -Infinity; // difícil: simula as melhores jogadas
    for (const p of c.slice(0, 10)) for (const pw of [p.power, Math.min(1, p.power + 0.25)]) {
      const shot = { ...base, angle: p.angle, power: pw };
      const r = Rules.playShot(st, st.turn, shot, { record: false });
      if (!r.ok) continue;
      const v = value(st, r, st.turn) - p.score * 0.05;
      if (v > bv) { bv = v; best = shot; }
    }
    return best || { ...base, angle: c[0].angle, power: c[0].power };
  }
  const API = { chooseShot };
  if (typeof module === 'object') module.exports = API; else g.PoolBot = API;
})(typeof window !== 'undefined' ? window : globalThis);
