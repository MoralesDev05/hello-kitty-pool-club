// Salas, matchmaking, convites e partidas. O servidor é a autoridade: valida e simula cada tacada.
const Rules = require('../../shared/rules.js');
const RECONNECT_MS = +process.env.RECONNECT_MS || 45000;
module.exports = function (io) {
  const rooms = new Map(), byToken = new Map();
  let queue = [];
  const clean = (s, n) => String(s || '').replace(/[<>&"']/g, '').slice(0, n);
  const newCode = () => { const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let c; do { c = Array.from({ length: 5 }, () => a[Math.random() * a.length | 0]).join(''); } while (rooms.has(c)); return c; };
  const pub = (r, tok) => ({ code: r.code, status: r.status, you: r.players.findIndex(p => p.token === tok), state: r.status === 'waiting' ? null : r.state, players: r.players.map(p => ({ name: p.name, avatar: p.avatar, ready: p.ready, connected: p.connected })) });
  const notify = r => r.players.forEach(p => p.connected && io.to(p.sid).emit('room', pub(r, p.token)));
  const forfeit = (r, loser, reason) => { r.status = 'over'; r.state.phase = 'over'; r.state.winner = 1 - loser; r.state.lastEvent = { type: 'win', winner: 1 - loser, reason }; notify(r); };
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
      if (out.state.phase === 'over') r.status = 'over';
      io.to(r.code).emit('shot', { by: idx, frames: out.frames, state: out.state });
      setTimeout(() => { r.busy = false; }, out.frames.length / 60 * 1000 + 300);
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
