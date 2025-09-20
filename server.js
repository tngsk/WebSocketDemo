const WebSocket = require("ws");
const http = require("http");
const fs = require("fs");
const path = require("path");

const PUBLIC_DIR = path.join(__dirname, "public");
const MIME_TYPES = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
};
const COLORS = [
  "#FF6B6B",
  "#4ECDC4",
  "#45B7D1",
  "#96CEB4",
  "#FFEAA7",
  "#DDA0DD",
  "#98D8C8",
  "#F7DC6F",
];
const EMOJIS = [
  "❤️",
  "🎉",
  "⭐",
  "💫",
  "🔥",
  "👍",
  "💯",
  "✨",
  "🚀",
  "💡",
  "🌈",
  "🥳",
  "🤩",
  "👏",
  "👋",
];
const MAX_COORD = 2000;
const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  const filePath = path.join(
    PUBLIC_DIR,
    req.url === "/" ? "index.html" : req.url,
  );

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(err.code === "ENOENT" ? 404 : 500);
      res.end(err.code === "ENOENT" ? "File not found" : "Server error");
    } else {
      res.writeHead(200, {
        "Content-Type": MIME_TYPES[path.extname(filePath)] || "text/plain",
      });
      res.end(content);
    }
  });
});

const wss = new WebSocket.Server({ server });
const users = new Map();

const broadcast = (msg, exclude = null) => {
  const data = JSON.stringify(msg);
  wss.clients.forEach((client) => {
    if (client !== exclude && client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
};

const clamp = (val, min, max) => Math.max(min, Math.min(val, max));

wss.on("connection", (ws) => {
  const userId = Math.random().toString(36).substring(2, 15);
  const color = COLORS[Math.floor(Math.random() * COLORS.length)];
  const name = `User${Math.floor(Math.random() * 9999) + 1}`;

  users.set(userId, { ws, color, name, x: 0, y: 0 });

  ws.send(JSON.stringify({ type: "welcome", userId, color, name }));
  broadcast({ type: "join", userId, color, name, count: users.size });

  ws.on("message", (data) => {
    try {
      const msg = JSON.parse(data);
      if (!users.has(userId)) return;

      const user = users.get(userId);

      switch (msg.type) {
        case "cursor":
          user.x = clamp(msg.x, 0, MAX_COORD);
          user.y = clamp(msg.y, 0, MAX_COORD);
          broadcast(
            {
              type: "cursor",
              userId,
              x: user.x,
              y: user.y,
              color: user.color,
              name: user.name,
            },
            ws,
          );
          break;
        case "reaction":
          if (EMOJIS.includes(msg.emoji)) {
            broadcast(
              {
                type: "reaction",
                userId,
                x: clamp(msg.x, 0, MAX_COORD),
                y: clamp(msg.y, 0, MAX_COORD),
                emoji: msg.emoji,
                name: user.name,
              },
              ws,
            );
          }
          break;
        case "firework":
          broadcast(
            {
              type: "firework",
              userId,
              x: clamp(msg.x, 0, MAX_COORD),
              y: clamp(msg.y, 0, MAX_COORD),
              name: user.name,
            },
            ws,
          );
          break;
        case "name":
          const newName = msg.name.trim();
          if (/^[a-zA-Z]{1,20}$/.test(newName)) {
            const oldName = user.name;
            user.name = newName;
            broadcast({ type: "name", userId, name: newName, oldName });
          }
          break;
      }
    } catch (error) {
      console.error("Error parsing message:", error);
    }
  });

  ws.on("close", () => {
    const user = users.get(userId);
    if (user) {
      users.delete(userId);
      broadcast({ type: "leave", userId, name: user.name, count: users.size });
    }
  });

  ws.on("error", (error) => console.error("WebSocket error:", error));
});

server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

process.on("SIGTERM", () => {
  server.close(() => process.exit(0));
});
