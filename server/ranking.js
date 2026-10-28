// Ranking geral online. Guarda vitórias/derrotas/XP por jogador (identificado pelo token do navegador).
// Só partidas online (matchmaking e salas privadas) entram aqui; partidas contra bot rodam no navegador e nunca chegam ao servidor.
// Armazenamento:
//  - Com UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN: banco externo (Redis hash, 1 campo por jogador). Sobrevive a reinícios/deploys
//    do Render (o disco do plano free é apagado sempre que o servidor desliga).
//  - Sem elas: arquivo JSON local (RANKING_FILE, padrão data/ranking.json). Bom para desenvolvimento.
const fs = require('fs'), path = require('path');
const XP_WIN = 30, XP_LOSS = 10, LIMIT = 50;
const level = xp => Math.floor(xp / 100) + 1;
const sleep = ms => new Promise(r => setTimeout(r, ms));
module.exports = function createRanking(opt = {}) {
  const env = process.env, url = opt.url || env.UPSTASH_REDIS_REST_URL, auth = opt.token || env.UPSTASH_REDIS_REST_TOKEN, KEY = opt.key || env.RANKING_KEY || 'hkp:ranking';
  const file = opt.file || env.RANKING_FILE || path.join(__dirname, '../data/ranking.json'), remote = !!(url && auth), retryMs = opt.retryMs || 5000;
  let db = {}; const dirty = new Set(); let flushing = null, timer = null;
  const cmd = async args => {
    const r = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${auth}`, 'Content-Type': 'application/json' }, body: JSON.stringify(args), signal: AbortSignal.timeout(8000) });
    const j = await r.json().catch(() => ({})); if (!r.ok || j.error) throw new Error(j.error || 'HTTP ' + r.status); return j.result;
  };
  const saveFile = () => { try { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file + '.tmp', JSON.stringify(db)); fs.renameSync(file + '.tmp', file); } catch (e) { console.error('Ranking: não foi possível salvar —', e.message); } };
  // envia ao banco os jogadores alterados (sempre o estado ATUAL de cada um, então tentativas repetidas nunca regravam dado velho)
  const flush = () => flushing || (flushing = (async () => {
    try {
      while (dirty.size) {
        const toks = [...dirty], args = ['HSET', KEY]; toks.forEach(t => args.push(t, JSON.stringify(db[t])));
        try { await cmd(args); toks.forEach(t => dirty.delete(t)); } catch (e) { console.error('Ranking: falha ao salvar no banco, tentando de novo —', e.message); await sleep(retryMs); }
      }
    } finally { flushing = null; }
  })());
  const save = tok => { if (!remote) return saveFile(); dirty.add(tok); clearTimeout(timer); timer = setTimeout(flush, 0); };
  const order = () => Object.entries(db).sort(([, a], [, b]) => b.w - a.w || a.l - b.l || a.name.localeCompare(b.name));
  const row = (tok, r, pos, me) => ({ pos, name: r.name, avatar: r.avatar, level: level(r.xp), w: r.w, l: r.l, me: tok === me });
  return {
    remote,
    // Carrega o ranking salvo. No modo remoto, se não conseguir ler o banco, FALHA (em vez de começar vazio e sobrescrever os dados).
    async load() {
      if (!remote) { try { const j = JSON.parse(fs.readFileSync(file, 'utf8')); if (j && typeof j === 'object' && !Array.isArray(j)) db = j; } catch { /* ainda não existe */ } return this; }
      let err; for (let i = 0; i < 4; i++) {
        try { const a = await cmd(['HGETALL', KEY]) || [], o = {}; for (let k = 0; k < a.length; k += 2) { try { o[a[k]] = JSON.parse(a[k + 1]); } catch { /* ignora campo corrompido */ } } db = o; return this; }
        catch (e) { err = e; await sleep(1000 * (i + 1)); }
      }
      throw new Error('Ranking: não foi possível ler o banco Upstash (' + err.message + ')');
    },
    flush: async () => { clearTimeout(timer); while (dirty.size || flushing) await (flush() || sleep(50)); },
    record(tok, name, avatar, won) {
      const r = db[tok] || (db[tok] = { name: 'Jogador', avatar: 0, w: 0, l: 0, xp: 0 });
      r.name = name || r.name; r.avatar = avatar | 0;
      if (won) { r.w++; r.xp += XP_WIN; } else { r.l++; r.xp += XP_LOSS; }
      save(tok);
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
