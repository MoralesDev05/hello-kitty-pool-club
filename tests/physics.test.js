// Colisão com tabelas e quinas das caçapas.
const test = require('node:test'), assert = require('node:assert');
const P = require('../shared/physics'), { W, H, R } = P.C;
const lone = (x, y, vx, vy) => { // só a bola 1 em jogo
  const balls = P.rack(); balls.forEach(b => { b.in = true; });
  Object.assign(balls[1], { in: false, x, y, vx, vy });
  const o = P.simulate(balls, false); return { b: balls[1], o };
};

test('tabelas: nenhuma bola foge da mesa sem cair numa caçapa (tacadas aleatórias, bolas coladas nas bordas)', () => {
  let seed = 4242; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let t = 0; t < 400; t++) {
    const balls = P.rack();
    balls.forEach(b => {
      b.in = false; b.vx = b.vy = 0;
      b.x = rnd() < .5 ? R + rnd() * 60 : W - R - rnd() * 60; b.y = rnd() < .5 ? R + rnd() * 60 : H - R - rnd() * 60;
      if (rnd() < .3) { b.x = W / 2 + (rnd() - .5) * 70; b.y = rnd() < .5 ? R + rnd() * 20 : H - R - rnd() * 20; }
    });
    P.strike(balls, rnd() * 2 * Math.PI, rnd());
    balls.slice(1).forEach(b => { if (rnd() < .5) { const a = rnd() * 6.283, v = rnd() * 900; b.vx = Math.cos(a) * v; b.vy = Math.sin(a) * v; } });
    P.simulate(balls, false);
    for (const b of balls) if (!b.in) assert.ok(b.x >= 0 && b.x <= W && b.y >= 0 && b.y <= H && Number.isFinite(b.x + b.y), `bola ${b.id} fora da mesa em (${b.x}, ${b.y})`);
  }
});

test('quina da caçapa: bola batendo de frente na ponta da tabela volta, não cai nem atravessa', () => {
  const { b, o } = lone(31, 200, 0, -600); // sobe rente à ponta da tabela do canto superior esquerdo
  assert.equal(b.in, false); assert.ok(b.y >= R - 0.01 && b.y <= H - R); assert.ok(o.rails.includes(1));
});

test('tabela: bola em alta velocidade contra a parede reflete com a restituição da tabela', () => {
  const { b } = lone(300, 300, 0, -400);
  assert.equal(b.in, false); assert.ok(b.y >= R - 0.01);
});

test('caçapa lateral: bola que passa rente à tabela pela boca não cai nem sai da mesa', () => {
  const { b } = lone(300, R, 500, 0);
  assert.equal(b.in, false); assert.ok(b.x > W / 2 + 40 && b.y >= R - 0.01);
});

test('caçapa do canto: bola na diagonal entra; bola lançada para dentro da boca nunca fica fora da mesa', () => {
  assert.equal(lone(200, 200, -300, -300).b.in, true);
  for (let a = 0; a < 360; a += 3) {
    const r = a * Math.PI / 180, { b } = lone(60, 60, Math.cos(r) * 900, Math.sin(r) * 900);
    assert.ok(b.in || (b.x >= 0 && b.y >= 0 && b.x <= W && b.y <= H));
  }
});
