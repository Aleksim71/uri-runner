const http = require("node:http");

const server = http.createServer((req, res) => {
  res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
  res.end("ok");
});

server.listen(4310, "127.0.0.1", () => {
  console.log("server ready on 4310");
});
