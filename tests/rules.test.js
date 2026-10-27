const test = require('node:test'), assert = require('node:assert');
const P = require('../shared/physics'), Rules = require('../shared/rules'), Bot = require('../shared/bot');
const play = (o = {}) => Object.assign(Rules.newGame(), { phase: 'play', inHand: false }, o);
const res = o => Object.assign({ first: null, pocketed: [], railAfter: true, rails: [] }, o);
const out = (st, ids) => { ids.forEach(i => { st.balls[i].in = true; }); return st; };

test('mesa: 16 bolas, 8 no centro do triângulo', () => {
  const b = P.rack(); assert.equal(b.length, 16);
  assert.ok(Math.abs(b[8].y - P.C.H / 2) < 0.01);
});
test('encaçapar bola do grupo livre define grupos e mantém a vez', () => {
  const s = Rules.applyShot(play(), 0, res({ first: 3, pocketed: [3] }));
  assert.deepEqual(s.groups, ['solid', 'stripe']); assert.equal(s.turn, 0);
});
test('sem encaçapar, a vez passa', () => {
  const s = Rules.applyShot(play(), 0, res({ first: 3 })); assert.equal(s.turn, 1); assert.equal(s.inHand, false);
});
test('branca encaçapada: falta e bola na mão', () => {
  const s = Rules.applyShot(play(), 0, res({ first: 3, pocketed: [0] }));
  assert.equal(s.lastEvent.foul, 'scratch'); assert.equal(s.turn, 1); assert.ok(s.inHand);
});
test('não tocar bola alguma é falta', () => {
  assert.equal(Rules.applyShot(play(), 0, res({})).lastEvent.foul, 'nohit');
});
test('primeira bola do grupo errado é falta', () => {
  const st = play({ groups: ['solid', 'stripe'] });
  assert.equal(Rules.applyShot(st, 0, res({ first: 10 })).lastEvent.foul, 'wronggroup');
});
test('nenhuma bola na tabela é falta', () => {
  assert.equal(Rules.applyShot(play(), 0, res({ first: 3, railAfter: false })).lastEvent.foul, 'norail');
});
test('bola 8 antes da hora = derrota', () => {
  const s = Rules.applyShot(play({ groups: ['solid', 'stripe'] }), 0, res({ first: 8, pocketed: [8] }));
  assert.equal(s.phase, 'over'); assert.equal(s.winner, 1);
});
test('bola 8 no fim = vitória; com branca = derrota', () => {
  const st = out(play({ groups: ['solid', 'stripe'] }), [1, 2, 3, 4, 5, 6, 7]);
  assert.equal(Rules.applyShot(st, 0, res({ first: 8, pocketed: [8] })).winner, 0);
  assert.equal(Rules.applyShot(st, 0, res({ first: 8, pocketed: [0, 8] })).winner, 1);
});
test('quebra sem encaçapar e com menos de 4 bolas na tabela é falta', () => {
  const s = Rules.applyShot(Rules.newGame(), 0, res({ first: 15, rails: [1, 2] })); assert.equal(s.lastEvent.foul, 'badbreak');
});
test('física: determinística, estável e termina parada', () => {
  const a = Rules.playShot(Rules.newGame(), 0, { angle: 0, power: 1 }), b = Rules.playShot(Rules.newGame(), 0, { angle: 0, power: 1 });
  assert.deepEqual(a.frames, b.frames);
  assert.ok(a.frames.at(-1).every(v => Number.isFinite(v) && (v === -100 || (v > -5 && v < 910))));
  assert.ok(a.res.first !== null);
});
test('física: bola direta na caçapa é encaçapada', () => {
  const st = play(); out(st, [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
  Object.assign(st.balls[0], { x: 160, y: 160 }); Object.assign(st.balls[1], { x: 80, y: 80 });
  const r = Rules.playShot(st, 0, { angle: Math.atan2(-80, -80), power: 0.5 });
  assert.ok(r.res.pocketed.includes(1));
});
test('servidor rejeita jogada fora da vez e posição inválida', () => {
  assert.equal(Rules.playShot(Rules.newGame(), 1, { angle: 0, power: 1 }).ok, false);
  assert.equal(Rules.playShot(Rules.newGame(), 0, { angle: 0, power: 1, cue: { x: 600, y: 200 } }).ok, false);
});
test('bots jogam uma partida completa só com jogadas legais', () => {
  let s = Rules.newGame();
  for (let i = 0; i < 80 && s.phase !== 'over'; i++) {
    const r = Rules.playShot(s, s.turn, Bot.chooseShot(s, ['hard', 'medium', 'easy'][i % 3]));
    assert.ok(r.ok, r.error); s = r.state;
  }
});

test('quebra com força máxima, centralizada, não é falta', () => {
  const r = Rules.playShot(Rules.newGame(), 0, { angle: 0, power: 1, cue: { x: 225, y: 225 } });
  assert.equal(r.ok, true); assert.notEqual(r.state.lastEvent.type, 'foul');
});
