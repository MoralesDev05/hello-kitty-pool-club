// A mira de quem está na vez é repassada ao adversário (validada pelo servidor); quem não está na vez não consegue enviar.
const test = require('node:test'), assert = require('node:assert'), { spawn } = require('node:child_process'), path = require('node:path');
const { io } = require('socket.io-client');
const wait = ms => new Promise(r => setTimeout(r, ms));
test('multiplayer: taco/mira do jogador da vez chega ao adversário', async () => {
  const PORT = 3600 + Math.floor(Math.random() * 300);
  const srv = spawn('node', [path.join(__dirname, '../server/index.js')], { env: { ...process.env, PORT } });
  await new Promise(r => srv.stdout.once('data', r));
  const mk = t => io(`http://localhost:${PORT}`, { auth: { token: t } });
  const a = mk('aimA'), b = mk('aimB'), gotA = [], gotB = [];
  a.on('aim', d => gotA.push(d)); b.on('aim', d => gotB.push(d));
  try {
    await new Promise((resolve, reject) => {
      let code; setTimeout(() => reject(new Error('timeout')), 6000);
      a.on('room', r => {
        if (r.status === 'waiting' && !code) { code = r.code; b.emit('join', { code }); }
        if (r.status === 'waiting' && r.players.length === 2) { a.emit('ready'); b.emit('ready'); }
        if (r.status === 'playing') resolve();
      });
      a.emit('create');
    });
    // vez do jogador A (índice 0): B recebe; valores fora do limite e cor inválida são saneados; posição da branca só com bola na mão
    a.emit('aim', { a: 1.25, p: 7, s: 1, col: 'javascript:x', cue: { x: 99999, y: 225 } });
    await wait(150);
    assert.equal(gotB.length, 1); assert.equal(gotA.length, 0);
    assert.equal(gotB[0].a, 1.25); assert.equal(gotB[0].p, 1); assert.equal(gotB[0].s, 1); assert.equal(gotB[0].col, '#ffffff');
    assert.deepEqual(gotB[0].cue, { x: 900, y: 225 });
    a.emit('aim', { a: 2, p: 0.5, s: 0, col: '#29d9ff' }); await wait(60);
    assert.equal(gotB.at(-1).s, 0); assert.equal(gotB.at(-1).col, '#29d9ff');
    // B não está na vez: nada chega em A
    b.emit('aim', { a: 3, p: 0.5, s: 1, col: '#ffffff' }); await wait(150);
    assert.equal(gotA.length, 0);
  } finally { a.close(); b.close(); srv.kill(); }
});
