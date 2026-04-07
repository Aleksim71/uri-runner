// path: test/real/fixtures/service/http-ready-server.js
const http = require('node:http');
const port = Number(process.env.PORT || 3010);
const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }
  res.writeHead(200, { 'content-type': 'text/plain' });
  res.end('hello');
});
server.listen(port, '127.0.0.1', () => {
  console.log(`ready:${port}`);
});
