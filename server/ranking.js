// Ranking geral online. Guarda vitórias/derrotas/XP por jogador (identificado pelo token do navegador) em um arquivo JSON.
// Só partidas online entram aqui (matchmaking e salas privadas); partidas contra bot rodam no navegador e nunca chegam ao servidor.
const fs = require('fs'), path = require('path');
const XP_WIN = 30, XP_LOSS = 10, LIMIT = 50;
const level = xp => Math.floor(xp / 100) + 1;
module.exports = function createRanking(file = process.env.RANKING_FILE || path.join(__dirname, '../data/ranking.json')) {
  let db = {};
  try { const j = JSON.parse(fs.readFileSync(file, 'utf8')); if (j && typeof j === 'object' && !Array.isArray(j)) db = j; } catch { /* arquivo ainda não existe */ }
  const save = () => {
    try { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file + '.tmp', JSON.stringify(db)); fs.renameSync(file + '.tmp', file); }
    catch (e) { console.error('Ranking: não foi possível salvar —', e.message); }
  };
  const order = () => Object.entries(db).sort(([, a], [, b]) => b.w - a.w || a.l - b.l || a.name.localeCompare(b.name));
  const row = (tok, r, pos, me) => ({ pos, name: r.name, avatar: r.avatar, level: level(r.xp), w: r.w, l: r.l, me: tok === me });
  return {
    record(tok, name, avatar, won) {
      const r = db[tok] || (db[tok] = { name: 'Jogador', avatar: 0, w: 0, l: 0, xp: 0 });
      r.name = name || r.name; r.avatar = avatar | 0;
      if (won) { r.w++; r.xp += XP_WIN; } else { r.l++; r.xp += XP_LOSS; }
      save();
    },
    stats(tok) { const r = db[tok]; return r ? { w: r.w, l: r.l, xp: r.xp } : null; },
    // top N + a posição do próprio jogador (mesmo fora do top); o token nunca sai do servidor
    top(me) {
      const all = order(), list = all.slice(0, LIMIT).map(([t, r], i) => row(t, r, i + 1, me));
      const i = all.findIndex(([t]) => t === me);
      return { list, total: all.length, you: i >= LIMIT ? row(me, all[i][1], i + 1, me) : null };
    }
  };
};
