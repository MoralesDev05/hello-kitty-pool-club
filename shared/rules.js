// Regras do 8-ball (módulo independente). O estado é JSON puro.
(function (g) {
  const P = typeof require === 'function' ? require('./physics.js') : g.PoolPhysics;
  const { W, H, R } = P.C;
  const BREAK_BOOST = 1.3, BREAK_RAILS = 3; // quebra mais forte e regra mais justa: 3 bolas nas tabelas (ou encaçapar)
  const clone = o => JSON.parse(JSON.stringify(o));
  const grp = id => id === 8 ? 'eight' : id > 8 ? 'stripe' : 'solid';
  const newGame = () => ({ balls: P.rack(), turn: 0, groups: [null, null], inHand: true, phase: 'break', winner: null, lastEvent: { type: 'start', by: 0 } });
  function validCue(st, x, y) {
    if (!(x >= R && x <= W - R && y >= R && y <= H - R)) return false;
    if (st.phase === 'break' && x > W * 0.25) return false;
    for (let i = 1; i < 16; i++) { const b = st.balls[i]; if (!b.in && Math.hypot(b.x - x, b.y - y) < 2 * R + 1) return false; }
    return true;
  }
  const left = (balls, gr) => { let n = 0; for (let i = 1; i < 16; i++) if (grp(i) === gr && !balls[i].in) n++; return n; };
  // res = { first, pocketed:[ids na ordem], railAfter, rails:[ids] }; post = bolas depois da simulação
  function applyShot(st, sh, res, post) {
    const s = clone(st); s.balls = clone(post || st.balls);
    const op = 1 - sh, own = st.groups[sh], brk = st.phase === 'break';
    const onEight = !!own && left(st.balls, own) === 0;
    const scratch = res.pocketed.includes(0);
    let pk = res.pocketed.filter(i => i);
    const end = (w, reason) => { s.phase = 'over'; s.winner = w; s.inHand = false; s.lastEvent = { type: 'win', winner: w, reason }; return s; };
    if (pk.includes(8)) {
      if (brk) { // 8 na quebra: volta para a marca do pé
        const b = s.balls[8]; b.in = false; b.vx = b.vy = 0; b.x = W * 0.7; b.y = H / 2;
        while (s.balls.some(o => o.id !== 8 && !o.in && Math.hypot(o.x - b.x, o.y - b.y) < 2 * R)) b.x += 2 * R;
        pk = pk.filter(i => i !== 8);
      } else return (onEight && !scratch && res.first === 8) ? end(sh, '8') : end(op, scratch && onEight ? 'scratch8' : 'early8');
    }
    let foul = null;
    if (scratch) foul = 'scratch';
    else if (res.first === null) foul = 'nohit';
    else {
      const gg = grp(res.first);
      if (own) { if (gg !== (onEight ? 'eight' : own)) foul = 'wronggroup'; }
      else if (gg === 'eight' && !brk) foul = 'wronggroup';
    }
    if (!foul && !pk.length && (brk ? res.rails.length < BREAK_RAILS : !res.railAfter)) foul = brk ? 'badbreak' : 'norail';
    if (!own && !brk && !foul && pk.length) { const gr = grp(pk[0]); s.groups[sh] = gr; s.groups[op] = gr === 'solid' ? 'stripe' : 'solid'; }
    const mine = s.groups[sh];
    const made = brk ? pk.length > 0 : pk.some(i => grp(i) === mine);
    if (scratch) { const c = s.balls[0]; c.in = false; c.vx = c.vy = 0; c.x = W * 0.25; c.y = H / 2; }
    s.phase = 'play';
    if (foul) { s.turn = op; s.inHand = true; s.lastEvent = { type: 'foul', foul, by: sh }; }
    else if (made) { s.turn = sh; s.inHand = false; s.lastEvent = { type: 'continue', by: sh }; }
    else { s.turn = op; s.inHand = false; s.lastEvent = { type: 'turn', by: sh }; }
    return s;
  }
  function playShot(st, who, shot, opt) {
    if (st.phase === 'over') return { ok: false, error: 'Partida encerrada' };
    if (who !== st.turn) return { ok: false, error: 'Não é a sua vez' };
    const a = +shot.angle, pw = +shot.power;
    if (!isFinite(a) || !isFinite(pw)) return { ok: false, error: 'Tacada inválida' };
    const s = clone(st);
    if (s.inHand) {
      const c = shot.cue || s.balls[0];
      if (!validCue(s, +c.x, +c.y)) return { ok: false, error: 'Posição da bola branca inválida' };
      s.balls[0].x = +c.x; s.balls[0].y = +c.y;
    }
    P.strike(s.balls, a, Math.min(1, Math.max(0.03, pw)));
    if (st.phase === 'break') { s.balls[0].vx *= BREAK_BOOST; s.balls[0].vy *= BREAK_BOOST; }
    const res = P.simulate(s.balls, !opt || opt.record !== false);
    return { ok: true, frames: res.frames, res, state: applyShot(st, who, res, s.balls) };
  }
  const API = { newGame, validCue, applyShot, playShot, grp, left };
  if (typeof module === 'object') module.exports = API; else g.PoolRules = API;
})(typeof window !== 'undefined' ? window : globalThis);
