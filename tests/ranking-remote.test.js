// Ranking com banco externo (Upstash simulado): os dados sobrevivem a uma "reinicialização" e o servidor não começa vazio se o banco falhar.
const test = require('node:test'), assert = require('node:assert'), http = require('node:http');
const createRanking = require('../server/ranking.js');
function fakeUpstash() {
  const hash = new Map(); let down = false;
  const srv = http.createServer((req, res) => { let b = ''; req.on('data', d => b += d); req.on('end', () => {
    const send = (c, o) => { res.writeHead(c, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
    if (down) return send(500, { error: 'down' }); if (req.headers.authorization !== 'Bearer tk') return send(401, { error: 'auth' });
    const [c, , ...a] = JSON.parse(b);
    if (c === 'HGETALL') return send(200, { result: [...hash].flat() });
    if (c === 'HSET') { for (let i = 0; i < a.length; i += 2) hash.set(a[i], a[i + 1]); return send(200, { result: a.length / 2 }); }
    send(400, { error: 'cmd' });
  }); });
  return new Promise(r => srv.listen(0, () => r({ srv, hash, url: `http://localhost:${srv.address().port}`, setDown: v => down = v })));
}
test('ranking remoto: sobrevive a reinício e recusa iniciar vazio se o banco estiver fora', async () => {
  const f = await fakeUpstash(), opt = { url: f.url, token: 'tk', retryMs: 20 };
  try {
    const a = await createRanking(opt).load(); assert.equal(a.top('x').total, 0);
    a.record('t1', 'Ana', 1, true); a.record('t1', 'Ana', 1, true); a.record('t2', 'Bia', 2, false); await a.flush();
    assert.equal(f.hash.size, 2);
    const b = await createRanking(opt).load(); // "servidor reiniciou": nova instância, memória vazia
    assert.deepEqual(b.stats('t1'), { w: 2, l: 0, xp: 60 }); assert.deepEqual(b.top('t2').list.map(x => [x.name, x.w, x.l]), [['Ana', 2, 0], ['Bia', 0, 1]]);
    // falha temporária ao salvar: tenta de novo sem perder
    f.setDown(true); b.record('t1', 'Ana', 1, true); setTimeout(() => f.setDown(false), 80); await b.flush();
    assert.equal(JSON.parse(f.hash.get('t1')).w, 3);
    // banco fora na inicialização: não pode começar vazio
    f.setDown(true); await assert.rejects(createRanking(opt).load(), /Upstash/);
  } finally { f.srv.close(); }
});
