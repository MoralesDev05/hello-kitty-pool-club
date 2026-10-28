// Salas, matchmaking, convites e partidas. O servidor é a autoridade: valida e simula cada tacada.
const Rules = require('../../shared/rules.js'), { C } = require('../../shared/physics.js');
const RECONNECT_MS = +process.env.RECONNECT_MS || 45000;
module.exports = function (io, rk) { // rk: ranking já carregado (server/ranking.js)
  const rooms = new Map(), byToken = new Map();
  let queue = [];
  const clean = (s, n) => String(s || '').replace(/[<>&"']/g, '').slice(0, n);
  const newCode = () => { const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let c; do { c = Array.from({ length: 5 }, () => a[Math.random() * a.length | 0]).join(''); } while (rooms.has(c)); return c; };
  const pub = (r, tok) => ({ code: r.code, status: r.status, you: r.players.findIndex(p => p.token === tok), state: r.status === 'waiting' ? null : r.state, players: r.players.map(p => ({ name: p.name, avatar: p.avatar, ready: p.ready, connected: p.connected })) });
  const notify = r => r.players.forEach(p => p.connected && io.to(p.sid).emit('room', pub(r, p.token)));
  // fim de partida online: contabiliza V/D no ranking (uma única vez por sala) e avisa cada jogador conectado do seu novo total
  const finish = r => {
    if (r.counted || r.state.winner == null) return; r.counted = true;
    r.players.forEach((p, i) => { rk.record(p.token, p.name, p.avatar, r.state.winner === i); if (p.connected) io.to(p.sid).emit('stats', rk.stats(p.token)); });
  };
  const forfeit = (r, loser, reason) => { r.status = 'over'; r.state.phase = 'over'; r.state.winner = 1 - loser; r.state.lastEvent = { type: 'win', winner: 1 - loser, reason }; finish(r); notify(r); };
  function start(r) { r.status = 'playing'; r.state = Rules.newGame(); r.busy = false; notify(r); }
  function leave(tok) {
    const code = byToken.get(tok), r = code && rooms.get(code); queue = queue.filter(q => q.token !== tok);
    if (!r) return; byToken.delete(tok);
    const i = r.players.findIndex(p => p.token === tok); if (i < 0) return;
    clearTimeout(r.players[i].timer);
    if (r.status === 'playing') forfeit(r, i, 'abandono');
    if (r.status === 'waiting') r.players.splice(i, 1);
    if (!r.players.some(p => byToken.get(p.token) === code)) rooms.delete(code); else notify(r);
  }
  const seat = (r, me, sid) => { r.players.push({ token: me.token, name: me.name, avatar: me.avatar, sid, ready: false, connected: true }); byToken.set(me.token, r.code); io.sockets.sockets.get(sid)?.join(r.code); };
  io.on('connection', sock => {
    const me = { token: clean(sock.handshake.auth && sock.handshake.auth.token, 40) || sock.id, name: 'Jogador', avatar: 0 };
    const code = byToken.get(me.token), old = code && rooms.get(code);
    if (old) { const p = old.players.find(x => x.token === me.token); if (p) { clearTimeout(p.timer); p.sid = sock.id; p.connected = true; sock.join(old.code); notify(old); } }
    const mine = rk.stats(me.token); if (mine) sock.emit('stats', mine); // reconectou: sincroniza V/D/XP do servidor
    sock.on('ranking', () => { const t = Date.now(); if (t - (me.lastRank || 0) < 300) return; me.lastRank = t; sock.emit('ranking', rk.top(me.token)); });
    sock.on('profile', d => { me.name = clean(d && d.name, 16) || 'Jogador'; me.avatar = Math.max(0, Math.min(11, d && d.avatar | 0)); });
    sock.on('quick', () => {
      leave(me.token);
      const opp = queue.find(q => q.token !== me.token && io.sockets.sockets.has(q.sid));
      if (!opp) { queue.push({ token: me.token, sid: sock.id, name: me.name, avatar: me.avatar }); sock.emit('queued'); return; }
      queue = queue.filter(q => q !== opp);
      const r = { code: newCode(), status: 'waiting', players: [], state: null, busy: false }; rooms.set(r.code, r);
      seat(r, opp, opp.sid); seat(r, me, sock.id); r.players.forEach(p => p.ready = true); start(r);
    });
    sock.on('create', () => {
      leave(me.token);
      const r = { code: newCode(), status: 'waiting', players: [], state: null, busy: false }; rooms.set(r.code, r); seat(r, me, sock.id); notify(r);
    });
    sock.on('join', d => {
      const r = rooms.get(clean(d && d.code, 5).toUpperCase());
      if (!r) return sock.emit('err', 'Código inválido');
      if (r.status !== 'waiting') return sock.emit('err', 'Partida já iniciada');
      if (r.players.length >= 2) return sock.emit('err', 'Sala cheia');
      if (r.players[0].token === me.token) return sock.emit('err', 'Você já está nesta sala');
      leave(me.token); seat(r, me, sock.id); notify(r);
    });
    sock.on('ready', () => {
      const r = rooms.get(byToken.get(me.token)); if (!r || r.status !== 'waiting') return;
      r.players.find(p => p.token === me.token).ready = true;
      if (r.players.length === 2 && r.players.every(p => p.ready && p.connected)) start(r); else notify(r);
    });
    sock.on('shot', d => {
      const r = rooms.get(byToken.get(me.token)); if (!r || r.status !== 'playing') return sock.emit('err', 'Sem partida em andamento');
      if (r.busy) return sock.emit('err', 'Aguarde as bolas pararem');
      const idx = r.players.findIndex(p => p.token === me.token);
      const out = Rules.playShot(r.state, idx, d || {});
      if (!out.ok) return sock.emit('err', out.error);
      r.state = out.state; r.busy = true;
      if (out.state.phase === 'over') { r.status = 'over'; finish(r); }
      io.to(r.code).emit('shot', { by: idx, frames: out.frames, state: out.state });
      setTimeout(() => { r.busy = false; }, out.frames.length / 60 * 1000 + 300);
    });
    // mira ao vivo: só quem está na vez pode enviar; o servidor valida/limita os números e repassa ao adversário
    sock.on('aim', d => {
      const r = rooms.get(byToken.get(me.token)); if (!r || r.status !== 'playing' || r.busy || !d || typeof d !== 'object') return;
      const idx = r.players.findIndex(p => p.token === me.token); if (idx < 0 || r.state.turn !== idx) return;
      const now = Date.now(); if (now - (me.lastAim || 0) < 20) return; me.lastAim = now;
      const n = (v, lo, hi) => Math.max(lo, Math.min(hi, +v || 0));
      const out = { a: n(d.a, -1e4, 1e4), p: n(d.p, 0, 1), s: d.s ? 1 : 0, col: /^#[0-9a-f]{6}$/i.test(d.col) ? d.col : '#ffffff' };
      if (d.cue && r.state.inHand) out.cue = { x: n(d.cue.x, 0, C.W), y: n(d.cue.y, 0, C.H) };
      sock.to(r.code).emit('aim', out);
    });
    sock.on('leave', () => leave(me.token));
    sock.on('disconnect', () => {
      queue = queue.filter(q => q.token !== me.token);
      const r = rooms.get(byToken.get(me.token)); if (!r) return;
      const p = r.players.find(x => x.token === me.token); if (!p || p.sid !== sock.id) return;
      p.connected = false; notify(r);
      if (r.status === 'playing') p.timer = setTimeout(() => { if (!p.connected && r.status === 'playing') forfeit(r, r.players.indexOf(p), 'desconexão'); }, RECONNECT_MS);
      else if (r.status === 'waiting') p.timer = setTimeout(() => { if (!p.connected) leave(p.token); }, 15000);
    });
  });
};
