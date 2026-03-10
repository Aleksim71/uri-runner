const http = require("node:http");

const port = Number(process.env.TEST_PORT || 43123);

const server = http.createServer((req, res) => {
  if (req.url === "/health") {
    res.statusCode = 200;
    res.end("ok");
    return;
  }
  if (req.url === "/ok") {
    res.statusCode = 200;
    res.end("ok");
    return;
  }
  if (req.url === "/nope") {
    res.statusCode = 404;
    res.end("nope");
    return;
  }
  res.statusCode = 200;
  res.end("hello");
});

server.listen(port, "127.0.0.1", () => {
  // eslint-disable-next-line no-console
  console.log(`READY http://127.0.0.1:${port}`);
});

process.on("SIGTERM", () => server.close(() => process.exit(0)));
process.on("SIGINT", () => server.close(() => process.exit(0)));
