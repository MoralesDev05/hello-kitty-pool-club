// Ranking online: partida online conta V/D; ranking não vaza o token; persiste em arquivo.
const test = require('node:test'), assert = require('node:assert'), { spawn } = require('node:child_process'), path = require('node:path'), fs = require('node:fs'), os = require('node:os');
const { io } = require('socket.io-client');
const once = (s, ev) => new Promise(r => s.once(ev, r));
test('ranking: vitória/derrota só em partida online, com nível e persistência', async () => {
  const PORT = 3600 + Math.floor(Math.random() * 300), file = path.join(os.tmpdir(), `hkp-rank-${process.pid}-${PORT}.json`);
  const srv = spawn('node', [path.join(__dirname, '../server/index.js')], { env: { ...process.env, PORT, RANKING_FILE: file } });
  await new Promise(r => srv.stdout.once('data', r));
  const mk = t => io(`http://localhost:${PORT}`, { auth: { token: t } });
  const a = mk('rkA'), b = mk('rkB'), c = mk('rkC');
  try {
    assert.deepEqual((await (async () => { c.emit('ranking'); return once(c, 'ranking'); })()).list, []); // vazio no início
    a.emit('profile', { name: 'Ana', avatar: 1 }); b.emit('profile', { name: 'Bia', avatar: 2 });
    const stA = once(a, 'stats'), stB = once(b, 'stats');
    await new Promise((resolve, reject) => {
      setTimeout(() => reject(new Error('timeout')), 6000); let code, left = false;
      a.on('room', r => {
        if (r.status === 'waiting' && !code) { code = r.code; b.emit('join', { code }); }
        if (r.status === 'waiting' && r.players.length === 2) { a.emit('ready'); b.emit('ready'); }
        if (r.status === 'playing' && !left) { left = true; b.emit('leave'); } // Bia abandona => Ana vence
        if (r.status === 'over') resolve();
      });
      a.emit('create');
    });
    assert.deepEqual(await stA, { w: 1, l: 0, xp: 30 }); assert.deepEqual(await stB, { w: 0, l: 1, xp: 10 });
    await new Promise(r => setTimeout(r, 350)); c.emit('ranking'); const rk = await once(c, 'ranking');
    assert.deepEqual(rk.list.map(x => [x.pos, x.name, x.level, x.w, x.l]), [[1, 'Ana', 1, 1, 0], [2, 'Bia', 1, 0, 1]]);
    assert.ok(rk.list.every(x => !('token' in x)) && !JSON.stringify(rk).includes('rkA'));
    assert.ok(fs.existsSync(file) && Object.keys(JSON.parse(fs.readFileSync(file, 'utf8'))).length === 2);
  } finally { a.close(); b.close(); c.close(); srv.kill(); fs.rmSync(file, { force: true }); }
});
