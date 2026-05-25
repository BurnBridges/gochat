require("dotenv").config();

const express = require("express");
const http = require("http");
const cors = require("cors");

const connectDB = require("./db");
const socketInit = require("./socket");

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());

// routes
app.use("/api/auth", require("./routes/auth"));
app.use("/api/chats", require("./routes/chats"));
app.use("/api/messages", require("./routes/messages"));

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

// socket
socketInit(server);

// start
const PORT = process.env.PORT || 8080;

(async () => {
  try {
    await connectDB();

    server.listen(PORT, "0.0.0.0", () => {
      console.log("🚀 Telegram-style backend running on", PORT);
    });
  } catch (err) {
    console.log("❌ DB ERROR:", err);
    process.exit(1);
  }
})();