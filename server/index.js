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
require('./rooms/rooms.js')(io);
server.listen(PORT, '0.0.0.0', () => console.log(`Hello Kitty Pool Club em http://localhost:${PORT}`));
