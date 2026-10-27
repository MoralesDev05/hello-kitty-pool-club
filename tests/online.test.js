// Teste de integração: dois clientes, sala privada, tacada validada pelo servidor.
const test = require('node:test'), assert = require('node:assert'), { spawn } = require('node:child_process'), path = require('node:path');
const { io } = require('socket.io-client');
test('multiplayer: sala privada, ready e tacada sincronizada', async () => {
  const PORT = 3100 + Math.floor(Math.random() * 500);
  const srv = spawn('node', [path.join(__dirname, '../server/index.js')], { env: { ...process.env, PORT } });
  await new Promise(r => srv.stdout.once('data', r));
  const mk = t => io(`http://localhost:${PORT}`, { auth: { token: t } });
  const a = mk('tokA'), b = mk('tokB');
  try {
    const got = await new Promise((resolve, reject) => {
      let code, started = false; setTimeout(() => reject(new Error('timeout')), 6000);
      a.on('err', reject);
      a.on('room', r => {
        if (r.status === 'waiting' && !code) { code = r.code; b.emit('join', { code }); }
        if (r.status === 'waiting' && r.players.length === 2) { a.emit('ready'); b.emit('ready'); }
        if (r.status === 'playing' && !started) { started = true; b.emit('shot', { angle: 0, power: 1 }); a.emit('shot', { angle: 0, power: 1, cue: { x: 200, y: 225 } }); }
      });
      b.on('err', m => { if (m !== 'Não é a sua vez') reject(new Error(m)); });
      a.on('shot', resolve); a.emit('create');
    });
    assert.ok(got.frames.length > 10); assert.equal(got.by, 0);
  } finally { a.close(); b.close(); srv.kill(); }
});
