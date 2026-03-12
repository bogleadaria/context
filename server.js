const http = require("http");
const fs = require("fs");
const path = require("path");
const { WebSocketServer } = require("ws");

const PORT = process.env.PORT || 3000;

const MIME_TYPES = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".mp3": "audio/mpeg",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
};

const server = http.createServer((req, res) => {
  let filePath = req.url === "/" ? "/host.html" : req.url;
  filePath = path.join(__dirname, filePath);

  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || "application/octet-stream";

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("404 Not Found");
      return;
    }
    res.writeHead(200, { "Content-Type": contentType });
    res.end(data);
  });
});

const wss = new WebSocketServer({ server });
const clienti = new Set();

wss.on("connection", (ws) => {
  clienti.add(ws);
  ws.isAlive = true;
  console.log(`Client conectat. Total: ${clienti.size}`);

  ws.on("pong", () => { ws.isAlive = true; });

  ws.on("message", (mesaj) => {
    for (const client of clienti) {
      if (client !== ws && client.readyState === 1) {
        client.send(mesaj.toString());
      }
    }
  });

  ws.on("close", () => {
    clienti.delete(ws);
    console.log(`Client deconectat. Total: ${clienti.size}`);
  });
});

// Ping la fiecare 30s ca să nu închidă Railway conexiunile idle
setInterval(() => {
  for (const ws of clienti) {
    if (!ws.isAlive) {
      clienti.delete(ws);
      ws.terminate();
    } else {
      ws.isAlive = false;
      ws.ping();
    }
  }
}, 30000);

server.listen(PORT, () => {
  console.log(`Server pornit pe portul ${PORT}`);
});
