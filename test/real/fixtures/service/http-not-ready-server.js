// path: test/real/fixtures/service/http-not-ready-server.js
const http = require('node:http');
const port = Number(process.env.PORT || 3011);
const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(503, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: false }));
    return;
  }
  res.writeHead(200, { 'content-type': 'text/plain' });
  res.end('booting');
});
server.listen(port, '127.0.0.1', () => {
  console.log(`started:${port}`);
});
