const http = require('http'), fs = require('fs'), path = require('path');
const { Server } = require('socket.io');
const PORT = process.env.PORT || 3000, ROOT = path.join(__dirname, '..');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  if (p === '/health') { res.end('ok'); return; }
  const base = p.startsWith('/shared/') ? ROOT : path.join(ROOT, 'client');
  const file = path.normalize(path.join(base, p));
  if (!file.startsWith(base) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('Não encontrado'); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
const io = new Server(server, { cors: { origin: process.env.CORS_ORIGIN || false } });
// o servidor só começa a aceitar jogadores depois de carregar o ranking salvo
const rk = require('./ranking.js')();
if (!rk.remote && process.env.RENDER) console.warn('AVISO: ranking em arquivo local. No Render o disco é apagado quando o servidor desliga; configure UPSTASH_REDIS_REST_URL e UPSTASH_REDIS_REST_TOKEN.');
rk.load().then(() => {
  require('./rooms/rooms.js')(io, rk);
  server.listen(PORT, '0.0.0.0', () => console.log(`Hello Kitty Pool Club em http://localhost:${PORT} (ranking: ${rk.remote ? 'Upstash' : 'arquivo local'})`));
}).catch(e => { console.error(e.message); process.exit(1); });
// o Render manda SIGTERM ao desligar/redeployar: garante que nada fique sem salvar
process.on('SIGTERM', () => rk.flush().finally(() => process.exit(0)));
