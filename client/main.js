(() => {
const $ = s => document.querySelector(s), P = PoolPhysics, Rules = PoolRules, Bot = PoolBot, { W, H, R, POCKETS } = P.C, M = 38, CFG = HKP, AV = CFG.AVATARS;
const ok = im => im && im.complete && im.naturalWidth > 0;
const avi = i => { const c = CFG.CHARS[i] || CFG.CHARS[0]; return `<img class="avi" src="${c.img.src}" alt="${c.e}" title="${c.n}" onerror="this.replaceWith(document.createTextNode(this.alt))">`; };
const prof = Object.assign({ name: 'Jogador', avatar: 0, theme: 0, guide: true, aimColor: '#ffffff', w: 0, l: 0, coins: 0, xp: 0 }, JSON.parse(localStorage.hkp || '{}'));
const persist = () => localStorage.hkp = JSON.stringify(prof);
const AIMC = [['Branco', '#ffffff'], ['Rosa', '#ff4f9a'], ['Ciano', '#29d9ff'], ['Verde', '#5cff7a'], ['Vermelho', '#ff3b3b'], ['Roxo', '#b06bff']];
if (!AIMC.some(c => c[1] === prof.aimColor)) prof.aimColor = '#ffffff';
if (!prof.rk) { prof.rk = 1; prof.w = prof.l = prof.xp = 0; } // V/D/nível agora são do servidor (só online); zera os valores antigos, que incluíam bots
const renderAim = () => { $('#aimc').innerHTML = AIMC.map(([n, c]) => `<button class="sw ${c === prof.aimColor ? 'sel' : ''}" data-c="${c}" style="background:${c}" title="${n}" aria-label="${n}"></button>`).join(''); };
const token = localStorage.hkpt || (localStorage.hkpt = Math.random().toString(36).slice(2) + Date.now().toString(36));
const sock = io({ auth: { token } });
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const COL = ['#fff', '#ffd84d', '#4aa3ff', '#ff5c7a', '#a46bff', '#ff9a3d', '#46c37b', '#c23b5a', '#2b2b2b'];
let sess = null, state = null, replay = null, pending = false, drag = null, botT = null, room = null, sc = 1, ox = 0, oy = 0;
const aim = { a: 0, show: true, grab: false };
let oaim = null; // mira do adversário (online: recebida pela rede; bot: o tiro que ele vai dar), com suavização
// rot = true: mesa girada 90° (comprimento na vertical) quando a tela está em pé. UP = ângulo que deixa figuras/números em pé na tela.
let rot = false, UP = 0;
const show = id => document.querySelectorAll('.screen').forEach(e => e.classList.toggle('on', e.id === id));
const toast = t => { const e = $('#toast'); e.textContent = t; e.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => e.classList.remove('on'), 2800); };
const renderProf = () => { $('#prof').innerHTML = `${avi(prof.avatar)} ${prof.name} · Nv ${Math.floor(prof.xp / 100) + 1} · 🪙 ${prof.coins} · ${prof.w}V/${prof.l}D`; };
const act = (ev, d) => { sock.emit('profile', { name: prof.name, avatar: prof.avatar }); sock.emit(ev, d); };
const nm = i => sess.players[i].name;

// ---------- Menus ----------
function renderCustom() {
  $('#nm').value = prof.name;
  $('#avs').innerHTML = AV.map((a, i) => `<button data-a="${i}" class="${i === prof.avatar ? 'sel' : ''}">${avi(i)}</button>`).join('');
  $('#ths').innerHTML = CFG.THEMES.map((t, i) => `<button data-t="${i}" class="${i === prof.theme ? 'sel' : ''}">${avi(i)} ${t.n}</button>`).join('');
}
$('#avs').onclick = e => { const b = e.target.closest('button'); if (b) { prof.avatar = +b.dataset.a; persist(); renderCustom(); } };
$('#ths').onclick = e => { const b = e.target.closest('button'); if (b) { prof.theme = +b.dataset.t; persist(); applyTheme(); renderCustom(); } };
document.querySelectorAll('.back').forEach(b => b.onclick = () => { prof.name = ($('#nm').value || prof.name).trim().slice(0, 16) || 'Jogador'; persist(); renderProf(); show('home'); });
$('#bCustom').onclick = () => { renderCustom(); show('custom'); };
$('#bSet').onclick = () => { $('#gd').checked = prof.guide; renderAim(); show('settings'); };
$('#aimc').onclick = e => { const b = e.target.closest('button'); if (b) { prof.aimColor = b.dataset.c; persist(); renderAim(); } };
$('#gd').onchange = e => { prof.guide = e.target.checked; persist(); };
$('#rst').onclick = () => { prof.coins = 0; persist(); renderProf(); toast('Moedas zeradas'); }; // V/D/nível ficam no ranking do servidor e não podem ser zerados daqui
$('#bFriend').onclick = () => show('friend');
// ---------- Ranking ----------
const rkRow = r => `<li class="${r.me ? 'me' : ''}"><b class="pos">${['🥇', '🥈', '🥉'][r.pos - 1] || r.pos}</b><span class="who">${avi(r.avatar)} <span>${esc(r.name)}</span></span><span>Nv ${r.level}</span><span>${r.w}V</span><span>${r.l}D</span></li>`;
const rkMsg = t => { $('#rk').innerHTML = `<li class="msg">${t}</li>`; };
let rkT = null, rkLast = null;
const renderRank = d => {
  rkLast = d; clearTimeout(rkT);
  if (!d.list.length) return rkMsg('Ninguém jogou online ainda. Seja o(a) primeiro(a)! 🎀');
  $('#rk').innerHTML = '<li class="hd"><b class="pos">#</b><span class="who">Jogador</span><span>Nível</span><span>Vit.</span><span>Der.</span></li>' + d.list.map(rkRow).join('') + (d.you ? '<li class="gap">⋯</li>' + rkRow(d.you) : '');
};
$('#bRank').onclick = () => {
  show('ranking'); if (rkLast) renderRank(rkLast); else rkMsg('Carregando...');
  if (!sock.connected) return rkMsg('🔴 Sem conexão com o servidor');
  sock.emit('ranking'); clearTimeout(rkT); rkT = setTimeout(() => sock.emit('ranking'), 500); // reenvia uma vez caso o servidor tenha limitado a 1ª chamada
};
$('#bRankBack').onclick = () => { clearTimeout(rkT); show('home'); };
sock.on('ranking', renderRank);
sock.on('stats', s => { if (s) { Object.assign(prof, { w: s.w, l: s.l, xp: s.xp }); persist(); renderProf(); } });
$('#bOnline').onclick = () => act('quick');
$('#bCreate').onclick = () => act('create');
$('#bJoin').onclick = () => act('join', { code: $('#code').value });
$('#bReady').onclick = () => act('ready');
$('#bLeave').onclick = () => { sock.emit('leave'); show('home'); };
const copy = t => navigator.clipboard.writeText(t).then(() => toast('Copiado!'), () => toast(t));
$('#cCode').onclick = () => copy(room.code);
$('#cLink').onclick = () => copy(location.origin + '/?sala=' + room.code);
$('#bBot').onclick = () => {
  const level = $('#diff').value;
  sess = { mode: 'bot', me: 0, level, players: [{ name: prof.name, avatar: prof.avatar }, { name: 'Bot ' + { easy: 'Fácil', medium: 'Médio', hard: 'Difícil' }[level], avatar: (prof.avatar + 3) % AV.length }] };
  beginGame(Rules.newGame());
};

// ---------- Rede ----------
sock.on('connect', () => { $('#conn').textContent = '🟢 Conectado'; $('#gc').textContent = '🟢'; const c = new URLSearchParams(location.search).get('sala'); if (c && !sock.joined) { sock.joined = 1; act('join', { code: c }); history.replaceState(null, '', '/'); } });
sock.on('disconnect', () => { $('#conn').textContent = '🔴 Sem conexão'; $('#gc').textContent = '🔴 reconectando...'; });
sock.on('connect_error', () => { $('#conn').textContent = '🔴 Servidor indisponível'; });
sock.on('err', m => { pending = false; toast(m); });
sock.on('queued', () => { $('#lt').textContent = 'Procurando adversário...'; $('#lcode').textContent = ''; $('#lp').innerHTML = ''; $('#lshare').style.display = 'none'; $('#bReady').style.display = 'none'; show('lobby'); });
sock.on('room', r => {
  room = r;
  if (r.status === 'waiting') {
    sess = null; $('#lt').textContent = 'Sala privada'; $('#lcode').textContent = r.code; $('#lshare').style.display = ''; $('#bReady').style.display = r.players[r.you].ready ? 'none' : '';
    $('#lp').innerHTML = r.players.map(p => `<li>${avi(p.avatar)} ${esc(p.name)} — ${p.ready ? 'pronto ✅' : 'aguardando'}${p.connected ? '' : ' (offline)'}</li>`).join('') + (r.players.length < 2 ? '<li>⏳ Aguardando o amigo entrar...</li>' : '');
    return show('lobby');
  }
  if (!sess || sess.mode !== 'online' || sess.code !== r.code) { sess = { mode: 'online', code: r.code, me: r.you, players: r.players }; replay = null; pending = false; beginGame(r.state); if (r.status === 'over') showOver(); }
  else { sess.players = r.players; if (r.status === 'over' && state.phase !== 'over' && !replay) { state = r.state; updateHUD(); showOver(); } }
  const o = r.players[1 - r.you]; $('#gc').textContent = o && !o.connected ? '🟠 adversário offline' : '🟢';
});
sock.on('shot', d => { if (sess && sess.mode === 'online') startReplay(d.frames, d.state); });
sock.on('aim', d => {
  if (!sess || sess.mode !== 'online' || !state || replay || state.phase === 'over' || state.turn === sess.me || !d) return;
  oaim = { a: +d.a || 0, p: +d.p || 0, show: !!d.s, col: AIMC.some(c => c[1] === d.col) ? d.col : '#ffffff', cue: d.cue || null, da: oaim ? oaim.da : +d.a || 0, dp: oaim ? oaim.dp : +d.p || 0, k: .3 };
});
// envia a minha mira ao adversário (~20x/s, só quando muda) enquanto é a minha vez
let sentAim = null; sock.on('connect', () => { sentAim = null; });
setInterval(() => {
  if (!sess || sess.mode !== 'online') return;
  if (!canAct()) { sentAim = null; return; }
  const c = state.balls[0], m = { a: +aim.a.toFixed(4), p: +($('#pow').value / 100).toFixed(2), s: aim.show ? 1 : 0, col: prof.aimColor };
  if (state.inHand) m.cue = { x: Math.round(c.x * 10) / 10, y: Math.round(c.y * 10) / 10 };
  const k = JSON.stringify(m); if (k === sentAim) return; sentAim = k; sock.emit('aim', m);
}, 50);

// ---------- Partida ----------
function beginGame(st) {
  state = st; replay = null; oaim = null; pending = false; aim.show = true; clearTimeout(botT); $('#over').className = ''; show('game'); updateHUD(); announce(st.lastEvent);
  if (sess.mode === 'bot') maybeBot();
}
const canAct = () => sess && state && state.phase !== 'over' && state.turn === sess.me && !replay && !pending;
function updateHUD() {
  $('#fine').style.visibility = canAct() ? 'visible' : 'hidden'; // visibility (não display) para a mesa não mudar de tamanho a cada vez
  [0, 1].forEach(i => {
    const p = sess.players[i], g = state.groups[i], ids = g === 'solid' ? [1, 2, 3, 4, 5, 6, 7] : g ? [9, 10, 11, 12, 13, 14, 15] : [];
    const e = $('#p' + i); e.className = 'pl' + (state.turn === i && state.phase !== 'over' ? ' on' : '');
    e.innerHTML = `<span class="av">${avi(p.avatar)} <b>${esc(p.name)}</b></span><i>${g ? (g === 'solid' ? 'Lisas' : 'Listradas') : 'Mesa aberta'}</i><span class="dots">${ids.map(id => `<u class="${state.balls[id].in ? 'x' : ''}" style="background:${COL[id > 8 ? id - 8 : id]}"></u>`).join('')}</span>`;
  });
  $('#tn').textContent = state.phase === 'over' ? 'Fim de jogo' : canAct() ? (state.inHand ? 'Bola na mão: arraste a branca, mire e toque em Tacar' : 'Sua vez: arraste o taco (ou a mesa) para girar a mira, ajuste a força e toque em Tacar') : `Vez de ${nm(state.turn)}`;
}
const FOULS = { scratch: 'bola branca encaçapada', nohit: 'nenhuma bola foi tocada', wronggroup: 'primeira bola tocada não era do grupo', norail: 'nenhuma bola tocou a tabela', badbreak: 'quebra ilegal' };
function announce(ev) {
  let t = '';
  if (ev.type === 'start') t = `${nm(0)} faz a quebra`;
  if (ev.type === 'foul') t = `Falta de ${nm(ev.by)}: ${FOULS[ev.foul]}. ${nm(1 - ev.by)} joga com a bola na mão`;
  if (ev.type === 'continue') t = `${nm(ev.by)} encaçapou! Continua jogando`;
  if (ev.type === 'turn') t = `Vez de ${nm(1 - ev.by)}`;
  if (!t) return; const m = $('#msg'); m.textContent = t; m.classList.add('on'); clearTimeout(announce.t); announce.t = setTimeout(() => m.classList.remove('on'), 3200);
}
function submit(shot) {
  if (sess.mode === 'bot') { const r = Rules.playShot(state, sess.me, shot); if (!r.ok) return toast(r.error); startReplay(r.frames, r.state); }
  else { pending = true; act('shot', shot); }
}
function startReplay(frames, next) { replay = { frames, next, t0: performance.now() }; aim.show = false; oaim = null; updateHUD(); }
function endReplay() {
  state = replay.next; replay = null; pending = false; aim.show = true; updateHUD(); announce(state.lastEvent);
  if (state.phase === 'over') showOver(); else if (sess.mode === 'bot') maybeBot();
}
function maybeBot() {
  if (state.phase === 'over' || state.turn !== 1) return; const s0 = state;
  const shot = Bot.chooseShot(state, sess.level);
  oaim = { a: shot.angle, p: shot.power, show: true, col: '#ff4f9a', cue: shot.cue || null, da: shot.angle + (Math.random() < .5 ? -1 : 1) * (.5 + Math.random() * .5), dp: .2, k: .06 };
  botT = setTimeout(() => { if (!sess || sess.mode !== 'bot' || state !== s0) return; const r = Rules.playShot(state, 1, shot); if (r.ok) startReplay(r.frames, r.state); }, 1200);
}
const REASON = { 8: 'bola 8 encaçapada corretamente', early8: 'bola 8 encaçapada antes da hora', scratch8: 'bola branca caiu junto com a 8', abandono: 'o adversário abandonou', 'desconexão': 'o adversário desconectou' };
function showOver() {
  const won = state.winner === sess.me;
  if (!sess.counted) { sess.counted = 1; if (sess.mode === 'online') { prof.coins += won ? 50 : 15; persist(); renderProf(); } } // V/D e XP vêm do servidor ('stats'); contra o bot nada é contabilizado
  $('#over').innerHTML = `<h2>${won ? '🎉 Você venceu! 🎉' : '😿 Você perdeu'}</h2><p>${esc(nm(state.winner))} ganhou: ${REASON[state.lastEvent.reason] || ''}</p>` + (sess.mode === 'bot' ? '<small>Treino: não conta no ranking</small><button id="again">Jogar de novo</button>' : '') + '<button id="toMenu">Menu</button>';
  $('#over').className = 'on';
  $('#toMenu').onclick = exitGame; if ($('#again')) $('#again').onclick = () => { const s = sess; sess = { ...s, counted: 0 }; beginGame(Rules.newGame()); };
}
function exitGame() { if (sess && sess.mode === 'online') sock.emit('leave'); clearTimeout(botT); sess = null; state = null; replay = null; oaim = null; $('#over').className = ''; show('home'); }
$('#exit').onclick = exitGame;
$('#fire').onclick = fire; $('#cancel').onclick = () => { aim.show = false; $('#pow').value = 60; };
function fire() { if (!canAct()) return; const c = state.balls[0]; submit({ angle: aim.a, power: $('#pow').value / 100, cue: state.inHand ? { x: c.x, y: c.y } : undefined }); }
addEventListener('keydown', e => { if (e.code === 'Space' || e.code === 'Enter') { if (document.activeElement.tagName !== 'INPUT') { e.preventDefault(); fire(); } } if (e.code === 'Escape') $('#cancel').click(); });

// ---------- Entrada (mouse/toque) ----------
const cv = $('#cv'), ctx = cv.getContext('2d');
const toT = e => {
  const r = cv.getBoundingClientRect(), px = (e.clientX - r.left - ox) / sc, py = (e.clientY - r.top - oy) / sc;
  // vertical: x da mesa cresce para CIMA (branca embaixo, triângulo em cima) e y cresce para a direita
  return rot ? { x: (W + 2 * M) - py - M, y: px - M } : { x: px - M, y: py - M };
};
let pid = null, last = null;
const R0 = 110; // abaixo desse raio a mira fica mais lenta (controle fino perto da bola)
const endDrag = e => { if (e && e.pointerId !== pid) return; drag = null; pid = null; aim.grab = false; };
cv.addEventListener('pointerdown', e => {
  if (!canAct() || pid !== null) return; const p = toT(e), c = state.balls[0]; cv.setPointerCapture(e.pointerId); pid = e.pointerId; aim.show = true; last = p;
  if (state.inHand && Math.hypot(p.x - c.x, p.y - c.y) < 3 * R) drag = 'cue'; else { drag = 'aim'; aim.grab = true; }
});
cv.addEventListener('pointermove', e => {
  if (e.pointerId !== pid || !canAct()) return; const p = toT(e), c = state.balls[0];
  if (drag === 'cue') { if (Rules.validCue(state, p.x, p.y)) { c.x = p.x; c.y = p.y; } }
  else if (drag === 'aim') {
    // o ângulo gira conforme o dedo ORBITA a bola branca: arrastar a ponta do taco = o taco acompanha o dedo,
    // sem pular. Quanto mais longe da bola, mais fino o controle.
    const vx = last.x - c.x, vy = last.y - c.y, dx = p.x - last.x, dy = p.y - last.y;
    aim.a += (vx * dy - vy * dx) / Math.max(vx * vx + vy * vy, R0 * R0); aim.show = true;
  }
  last = p;
});
cv.addEventListener('pointerup', endDrag); cv.addEventListener('pointercancel', endDrag);
// faixa de ajuste fino (como no 8 Ball Pool): arraste para os lados
const fine = $('#fine'); let fy = null;
fine.addEventListener('pointerdown', e => { if (!canAct()) return; fine.setPointerCapture(e.pointerId); fy = e.clientX; aim.show = true; fine.classList.add('on'); });
fine.addEventListener('pointermove', e => { if (fy === null || !canAct()) return; aim.a += (e.clientX - fy) * 0.0012; fy = e.clientX; });
const fineEnd = () => { fy = null; fine.classList.remove('on'); }; fine.addEventListener('pointerup', fineEnd); fine.addEventListener('pointercancel', fineEnd);
addEventListener('keydown', e => { if (!canAct() || document.activeElement.tagName === 'INPUT') return; const k = e.shiftKey ? .01 : .0025; if (e.code === 'ArrowLeft' || e.code === 'ArrowUp') { aim.a -= k; aim.show = true; e.preventDefault(); } if (e.code === 'ArrowRight' || e.code === 'ArrowDown') { aim.a += k; aim.show = true; e.preventDefault(); } });

// ---------- Desenho ----------
function layout() {
  const w = cv.clientWidth, h = cv.clientHeight, d = devicePixelRatio || 1;
  cv.width = Math.round(w * d); cv.height = Math.round(h * d);
  const TW = W + 2 * M, TH = H + 2 * M, scL = Math.min(w / TW, h / TH), scP = Math.min(w / TH, h / TW);
  rot = innerHeight > innerWidth; /* tela em pé => mesa sempre na vertical */ UP = rot ? Math.PI / 2 : 0; sc = (rot ? scP : scL) * 0.97;
  const bw = (rot ? TH : TW) * sc, bh = (rot ? TW : TH) * sc; ox = (w - bw) / 2; oy = (h - bh) / 2;
}
function ball(x, y, id) {
  ctx.save(); ctx.translate(x + M, y + M); ctx.rotate(UP); ctx.beginPath(); ctx.arc(0, 0, R, 0, 7); ctx.clip();
  const c = COL[id > 8 ? id - 8 : id]; ctx.fillStyle = id > 8 ? '#fff' : c; ctx.fillRect(-R, -R, 2 * R, 2 * R);
  if (id > 8) { ctx.fillStyle = c; ctx.fillRect(-R, -R * 0.55, 2 * R, R * 1.1); }
  if (id) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, R * 0.46, 0, 7); ctx.fill(); ctx.fillStyle = '#222'; ctx.font = 'bold ' + Math.round(R * 0.7) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(id, 0, 0.5); }
  ctx.beginPath(); ctx.arc(-R * 0.3, -R * 0.3, R * 0.22, 0, 7); ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.fill(); ctx.restore();
}
function guide(c, o) { // o = { a: ângulo, pw: força 0-100, color, line: mostra linha de mira, grab, opp: é o adversário }
  ctx.save(); if (o.opp) ctx.globalAlpha = .75;
  const dx = Math.cos(o.a), dy = Math.sin(o.a); let t = Infinity, hit = null;
  if (dx > 0) t = Math.min(t, (W - R - c.x) / dx); if (dx < 0) t = Math.min(t, (R - c.x) / dx);
  if (dy > 0) t = Math.min(t, (H - R - c.y) / dy); if (dy < 0) t = Math.min(t, (R - c.y) / dy);
  for (let i = 1; i < 16; i++) {
    const b = state.balls[i]; if (b.in) continue; const fx = c.x - b.x, fy = c.y - b.y, bq = fx * dx + fy * dy, cq = fx * fx + fy * fy - 4 * R * R, disc = bq * bq - cq;
    if (disc >= 0) { const tt = -bq - Math.sqrt(disc); if (tt > 0 && tt < t) { t = tt; hit = b; } }
  }
  const ex = c.x + dx * t + M, ey = c.y + dy * t + M;
  if (o.line) {
    ctx.strokeStyle = o.color; ctx.lineWidth = 1.5; ctx.setLineDash([6, 5]); ctx.beginPath(); ctx.moveTo(c.x + M, c.y + M); ctx.lineTo(ex, ey); ctx.stroke(); ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(ex, ey, R, 0, 7); ctx.stroke();
    if (hit) { const nx = hit.x - (ex - M), ny = hit.y - (ey - M), l = Math.hypot(nx, ny); ctx.strokeStyle = o.color; ctx.beginPath(); ctx.moveTo(hit.x + M, hit.y + M); ctx.lineTo(hit.x + M + nx / l * 60, hit.y + M + ny / l * 60); ctx.stroke(); }
  }
  const pull = 14 + o.pw * 0.6, ux = -dx, uy = -dy, nx = -uy, ny = ux, trim = CFG.THEMES[prof.theme].trim, bx = c.x + M, by = c.y + M;
  const seg = (l0, l1, w0, w1, col) => { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(bx + ux * l0 + nx * w0, by + uy * l0 + ny * w0); ctx.lineTo(bx + ux * l1 + nx * w1, by + uy * l1 + ny * w1); ctx.lineTo(bx + ux * l1 - nx * w1, by + uy * l1 - ny * w1); ctx.lineTo(bx + ux * l0 - nx * w0, by + uy * l0 - ny * w0); ctx.closePath(); ctx.fill(); };
  const s0 = R + pull, TW = W + 2 * M, TH = H + 2 * M;
  // comprimento do taco limitado ao que cabe na tela (para a ponta de trás sempre ficar visível e "pegável")
  let room = Infinity; if (ux > 0) room = Math.min(room, (TW - 6 - bx) / ux); if (ux < 0) room = Math.min(room, (6 - bx) / ux); if (uy > 0) room = Math.min(room, (TH - 6 - by) / uy); if (uy < 0) room = Math.min(room, (6 - by) / uy);
  const Lc = Math.max(110, Math.min(345, room - s0)), sh = Lc * .72;
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.25)'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 2;
  seg(s0, s0 + 5, 2.2, 2.4, '#6ec1ff'); seg(s0 + 5, s0 + 14, 2.4, 2.6, '#ffffff'); seg(s0 + 14, s0 + sh, 2.6, 5, '#f6dba6'); seg(s0 + sh, s0 + Lc, 5, 6.5, trim); seg(s0 + sh, s0 + sh + 6, 5, 5.2, '#ffffff');
  ctx.restore();
  const ex2 = bx + ux * (s0 + Lc), ey2 = by + uy * (s0 + Lc);
  ctx.fillStyle = trim; ctx.beginPath(); ctx.arc(ex2, ey2, 6.5, 0, 7); ctx.fill();
  if (o.opp) { /* sem anel de "pegar" no taco do adversário */ } else if (o.grab) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.globalAlpha = .9; ctx.beginPath(); ctx.arc(ex2, ey2, 14, 0, 7); ctx.stroke(); ctx.globalAlpha = 1; }
  else { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.globalAlpha = .45 + .25 * Math.sin(performance.now() / 300); ctx.beginPath(); ctx.arc(ex2, ey2, 12, 0, 7); ctx.stroke(); ctx.globalAlpha = 1; }
  ctx.restore();
}

// ---- decoração da mesa (desenhada 1x em canvas offscreen e reaproveitada) ----
const LAYERS = new Map(), S2 = 2;
function fitImg(c, im, cx, cy, box, alpha = 1, rot = 0) {
  if (!ok(im)) return; const k = Math.min(box / im.naturalWidth, box / im.naturalHeight), w = im.naturalWidth * k, h = im.naturalHeight * k;
  c.save(); c.globalAlpha = alpha; c.translate(cx, cy); c.rotate(rot + UP); c.drawImage(im, -w / 2, -h / 2, w, h); c.restore();
}
function layer(th) {
  const key = prof.theme + ':' + HKP.loaded + ':' + (rot ? 'v' : 'h'); let L = LAYERS.get(key); if (L) return L;
  const ch = th.char, TW = W + 2 * M, TH = H + 2 * M; L = document.createElement('canvas'); L.width = TW * S2; L.height = TH * S2;
  const c = L.getContext('2d'); c.scale(S2, S2);
  c.fillStyle = th.rail; c.beginPath(); c.roundRect(0, 0, TW, TH, 26); c.fill();
  c.strokeStyle = th.trim; c.lineWidth = 4; c.beginPath(); c.roundRect(5, 5, TW - 10, TH - 10, 22); c.stroke();
  // borda: personagem entre as caçapas + enfeites
  c.font = '17px serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
  const txt = (t, x, y) => { c.save(); c.translate(x, y); c.rotate(UP); c.fillText(t, 0, 0); c.restore(); };
  [[.25, 0], [.75, 0], [.25, 1], [.75, 1]].forEach(([fx, bot]) => { const x = M + W * fx, y = bot ? H + 1.5 * M : M / 2; ok(ch.ico) ? fitImg(c, ch.ico, x, y, M - 8) : txt(ch.e, x, y); });
  [[0, .5], [1, .5]].forEach(([r, fy]) => { const x = r ? W + 1.5 * M : M / 2, y = M + H * fy; ok(ch.ico) ? fitImg(c, ch.ico, x, y, M - 8) : txt(ch.e, x, y); });
  [.125, .375, .625, .875].forEach((fx, i) => { txt(ch.deco[i % ch.deco.length], M + W * fx, M / 2); txt(ch.deco[(i + 1) % ch.deco.length], M + W * fx, H + 1.5 * M); });
  [.25, .75].forEach((fy, i) => { txt(ch.deco[i], M / 2, M + H * fy); txt(ch.deco[(i + 1) % ch.deco.length], W + 1.5 * M, M + H * fy); });
  // feltro
  c.fillStyle = th.felt; c.fillRect(M, M, W, H);
  c.save(); c.beginPath(); c.rect(M, M, W, H); c.clip();
  for (let r = 0, y = M + 30; y < M + H + 40; y += 70, r++) for (let x = M + (r % 2 ? 70 : 30); x < M + W + 40; x += 140) fitImg(c, ch.ico, x, y, 44, .07, (r % 2 ? .2 : -.2));
  let seed = 7 + prof.theme * 13; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  c.font = '22px serif'; c.globalAlpha = .16; for (let i = 0; i < 20; i++) txt(ch.deco[i % ch.deco.length], M + 20 + rnd() * (W - 40), M + 20 + rnd() * (H - 40)); c.globalAlpha = 1;
  fitImg(c, ch.img, M + W / 2, M + H / 2, H * .8, .15);
  c.restore();
  c.strokeStyle = 'rgba(255,255,255,.45)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(M + W * .25, M); c.lineTo(M + W * .25, M + H); c.stroke();
  c.fillStyle = 'rgba(255,255,255,.5)'; c.beginPath(); c.arc(M + W * .7, M + H / 2, 3, 0, 7); c.fill();
  LAYERS.clear(); LAYERS.set(key, L); return L;
}
// fundo das telas: degradê do personagem + estampa de ícones
function applyTheme() {
  const th = CFG.THEMES[prof.theme], ch = th.char, t = document.createElement('canvas'); t.width = t.height = 160; const c = t.getContext('2d');
  fitImg(c, ch.ico, 40, 40, 46, .16, -.2); fitImg(c, ch.ico, 120, 120, 46, .16, .2);
  c.font = '20px serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.globalAlpha = .25; c.fillText(ch.deco[0], 120, 36); c.fillText(ch.deco[1 % ch.deco.length], 40, 124);
  const bg = `url(${t.toDataURL()}) 0 0/160px, linear-gradient(160deg, ${ch.bg[0]}, ${ch.bg[1]})`;
  document.documentElement.style.background = bg; document.body.style.background = bg;
}
HKP.onload = applyTheme;
const oppAim = () => oaim && oaim.show && sess && state && !replay && state.phase !== 'over' && state.turn !== sess.me;
function draw() {
  if (cv.width !== Math.round(cv.clientWidth * (devicePixelRatio || 1)) || cv.height !== Math.round(cv.clientHeight * (devicePixelRatio || 1))) layout();
  const d = devicePixelRatio || 1, th = CFG.THEMES[prof.theme]; ctx.setTransform(d, 0, 0, d, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height);
  if (rot) ctx.setTransform(0, -d * sc, d * sc, 0, d * ox, d * (oy + (W + 2 * M) * sc)); // gira 90° anti-horário
  else ctx.setTransform(d * sc, 0, 0, d * sc, d * ox, d * oy);
  ctx.drawImage(layer(th), 0, 0, W + 2 * M, H + 2 * M);
  POCKETS.forEach(p => { ctx.fillStyle = '#3b1d2e'; ctx.beginPath(); ctx.arc(p[0] + M, p[1] + M, P.C.PR, 0, 7); ctx.fill(); ctx.strokeStyle = th.trim; ctx.lineWidth = 3; ctx.stroke(); });
  if (!state) return;
  let disp = null;
  if (replay) { const i = Math.floor((performance.now() - replay.t0) / 1000 * 60); if (i >= replay.frames.length - 1) { disp = replay.frames.at(-1); endReplay(); } else disp = replay.frames[i]; }
  const opp = oppAim(), oc = opp && state.inHand && oaim.cue; // adversário com bola na mão: a branca aparece onde ele a posicionou
  for (let i = 0; i < 16; i++) {
    if (disp) { if (disp[2 * i] > -50) ball(disp[2 * i], disp[2 * i + 1], i); }
    else { const b = state.balls[i]; if (!b.in) ball(i === 0 && oc ? oc.x : b.x, i === 0 && oc ? oc.y : b.y, i); }
  }
  if (!replay && canAct() && aim.show) guide(state.balls[0], { a: aim.a, pw: $('#pow').value, color: prof.aimColor, line: prof.guide, grab: aim.grab });
  if (opp) { // taco e mira do adversário (suavizados para não "pular" entre as atualizações da rede)
    const df = Math.atan2(Math.sin(oaim.a - oaim.da), Math.cos(oaim.a - oaim.da)); oaim.da += df * oaim.k; oaim.dp += (oaim.p - oaim.dp) * oaim.k;
    guide(oc || state.balls[0], { a: oaim.da, pw: oaim.dp * 100, color: oaim.col, line: true, opp: true });
  }
  if (!replay && canAct() && state.inHand) { const c = state.balls[0]; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(c.x + M, c.y + M, R + 5, 0, 7); ctx.stroke(); }
}
(function loop() { if ($('#game').classList.contains('on')) draw(); requestAnimationFrame(loop); })();
$('#crew').innerHTML = CFG.CHARS.map(c => `<img src="${c.ico.src}" alt="${c.e}" title="${c.n}">`).join('');
renderProf(); applyTheme();
})();
