require("dotenv").config();

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const path = require("path");
const admin = require("./firebase");
const PushToken = require("./models/PushToken");
const connectDB = require("./db");
const Message = require("./models/Message");
const Chat = require("./models/Chat");
const onlineUsers = new Map();
const JWT_SECRET = process.env.JWT_SECRET;

// =======================
// APP INIT
// =======================
const express = require("express");
const http = require("http");
const cors = require("cors");
const mongoose = require("mongoose");

const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());

// =======================
// CLOUDINARY CONFIG
// =======================
const cloudinary = require("cloudinary").v2;
const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_API_SECRET,
});

// =======================
// STORAGE (FIXED)
// =======================
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "avatars",
    allowed_formats: ["jpg", "png", "jpeg", "webp"],
  },
});

const upload = multer({ storage });

// =======================
// USER MODEL
// =======================
const userSchema = new mongoose.Schema({
  username: String,
  password: String,
  avatar: String,
  about: String,
  
});

const User = mongoose.model("User", userSchema);
// =======================
// AUTH (ВАЖНО: ДО STATIC)
// =======================
app.post("/register", async (req, res) => {
  const { username, password, phone, birthDate } = req.body;

  const exist = await User.findOne({ username });
  if (exist) return res.status(400).json({ error: "exists" });

  const hash = await bcrypt.hash(password, 10);

  const user = await User.create({
    username,
    password: hash,
    phone,
    birthDate,
  });

  res.json({ userId: user._id });
});

app.post("/login", async (req, res) => {
  const { username, password, phone, birthDate } = req.body;

  const user = await User.findOne({ username });
  if (!user) return res.status(400).json({ error: "not found" });

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return res.status(400).json({ error: "wrong" });

  const token = jwt.sign(
    { userId: user._id },
    JWT_SECRET,
    { expiresIn: "7d" }
  );

  res.json({
  token,
  userId: user._id,
  avatar: user.avatar,
  about: user.about || "",
  username: user.username,
});
});
// =======================
app.post("/chat/open", async (req, res) => {
  const { userId, otherId } = req.body;

  let chat = await Chat.findOne({
    users: {
      $all: [
        new mongoose.Types.ObjectId(userId),
        new mongoose.Types.ObjectId(otherId),
      ],
    },
  });

  if (!chat) {
    chat = await Chat.create({
      users: [
        new mongoose.Types.ObjectId(userId),
        new mongoose.Types.ObjectId(otherId),
      ],
      lastMessage: "",
      lastMessageTime: new Date(),
      unreadCounts: {},
    });
  }

  res.json(chat);
});
// =======================
app.post("/update-profile", async (req, res) => {
  const { userId, about } = req.body;

  const user = await User.findByIdAndUpdate(
    userId,
    { about },
    { new: true }
  );

  res.json({
    userId: user._id,
    about: user.about,
  });
});


app.get("/me/:id", async (req, res) => {
  const user = await User.findById(req.params.id);

  res.json(user);
});
// =======================
// PUSH REGISTER
// =======================
app.post("/push/register", async (req, res) => {
  try {
    const { userId, token } = req.body;

    await PushToken.findOneAndUpdate(
      { userId },
      { token },
      { upsert: true, returnDocument: "after" }
    );

    res.json({ ok: true });
  } catch (err) {
    console.log("push register error:", err);
    res.status(500).json({ error: "server error" });
  }
});

// =======================
// MESSAGES API
// =======================
app.get("/messages/:u1/:u2", async (req, res) => {
  const { u1, u2 } = req.params;

  const messages = await Message.find({
    $or: [
      { senderId: u1, receiverId: u2 },
      { senderId: u2, receiverId: u1 },
    ],
  })  .sort({ createdAt: 1 })
  .populate("senderId receiverId", "username avatar");

  res.json(messages);
});

app.get("/unread/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    const unread = await Message.aggregate([
      {
        $match: {
          receiverId: new mongoose.Types.ObjectId(userId),
          read: false,
        },
      },
      {
        $group: {
          _id: "$senderId",
          count: { $sum: 1 },
        },
      },
    ]);

    res.json(unread);
  } catch (err) {
    console.log("UNREAD ERROR:", err);
    res.status(500).json({ error: "server error" });
  }
});
// =======================
// SOCKET.IO
// =======================
const io = new Server(server, {
  cors: { origin: "*" },
});

const getSocketId = (userId) => onlineUsers.get(userId);

io.on("connection", (socket) => {

  // =======================
  // JOIN
  // =======================
  socket.on("join", (userId) => {
    onlineUsers.set(userId, socket.id);
    socket.userId = userId;

    io.emit("onlineUsers", Array.from(onlineUsers.keys()));
  });

  // =======================
  // SEND MESSAGE
  // =======================
socket.on("sendMessage", async ({ senderId, receiverId, text, messageId }) => {
  try {

    const msg = await Message.create({
      senderId,
      receiverId,
      text,
      messageId,
      status: "sent",
    });

    let chat = await Chat.findOne({
      users: { $all: [senderId, receiverId] },
    });

    if (chat) {
      chat.lastMessage = text;
      chat.lastMessageTime = new Date();
      chat.unreadCounts.set(receiverId, (chat.unreadCounts?.get(receiverId) || 0) + 1);
      await chat.save();
    }

    const [sender, receiver] = await Promise.all([
      User.findById(senderId),
      User.findById(receiverId),
    ]);

    const fullMessage = {
      ...msg._doc,
      senderId: {
        _id: sender._id,
        username: sender.username,
        avatar: sender.avatar,
      },
      receiverId: {
        _id: receiver._id,
        username: receiver.username,
        avatar: receiver.avatar,
      },
    };

    const receiverSocket = getSocketId(receiverId);

    if (receiverSocket) {
      io.to(receiverSocket).emit("getMessage", fullMessage);
    }

  } catch (err) {
    console.log("SEND MESSAGE ERROR:", err);
  }
});

  // =======================
  // DISCONNECT
  // =======================
  socket.on("disconnect", () => {
    if (socket.userId) {
      onlineUsers.delete(socket.userId);
    }

    io.emit("onlineUsers", Array.from(onlineUsers.keys()));
  });

});
// =======================
// USER SEARCH
// =======================
app.get("/users/search/:query", async (req, res) => {
  try {
    const q = req.params.query;

    const users = await User.find({
      username: { $regex: q, $options: "i" },
    }).limit(10);

    res.json(users);
  } catch (err) {
    console.log("SEARCH ERROR:", err);
    res.status(500).json({ error: "server error" });
  }
});
// =======================
// CHATS
// =======================

app.get("/chats/:userId", async (req, res) => {
  try {

    const { userId } = req.params;

    const chats = await Chat.find({
      users: userId,
    })
    .sort({ lastMessageTime: -1 })
    .populate("users", "username avatar")
    .lean();
    

    const formatted = chats.map((chat) => {

      const otherUser = chat.users.find(
        (u) => u._id.toString() !== userId
      );

      return {
        _id: chat._id,
        text: chat.lastMessage,
        updatedAt: chat.lastMessageTime,

        senderId: { _id: userId },

        receiverId: otherUser,

        unreadCount:
          chat.unreadCounts?.[userId] || 0,
      };
    });

    res.json(formatted);

  } catch (err) {
    console.log("CHATS ERROR:", err);
    console.log("GET CHATS FOR:", userId);
    console.log("CHATS RAW:", chats);
    res.status(500).json({ error: "server error" });
  }
});
// =======================
app.post("/chat/open", async (req, res) => {
  const { userId, otherId } = req.body;

  let chat = await Chat.findOne({
    users: {
      $all: [
        new mongoose.Types.ObjectId(userId),
        new mongoose.Types.ObjectId(otherId),
      ],
    },
  });

  if (!chat) {
    chat = await Chat.create({
      users: [
        new mongoose.Types.ObjectId(userId),
        new mongoose.Types.ObjectId(otherId),
      ],
      lastMessage: "",
      lastMessageTime: new Date(),
      unreadCounts: {},
    });
  }

  res.json(chat);
});
// =======================
app.post("/messages/read", async (req, res) => {
  try {
    const { senderId, receiverId } = req.body;

    await Message.updateMany(
      {
        senderId,
        receiverId,
        read: false,
      },
      {
        $set: {
          status: "read",
          read: true,
        },
      }
    );

    const senderSocket = onlineUsers.get(senderId);

    if (senderSocket) {
      io.to(senderSocket).emit("messageRead", {
        from: senderId,
      });
    }

    res.json({ success: true });

  } catch (err) {
    console.log("READ ERROR:", err);
    res.status(500).json({ error: "server error" });
  }
});
// =======================
// STATIC (ПОСЛЕ ВСЕХ API)
// =======================
app.post("/upload-avatar", upload.single("avatar"), async (req, res) => {
  try {
    const userId = req.body.userId;

    if (!req.file) {
      return res.status(400).json({ error: "No file" });
    }

    const avatarUrl = cloudinary.url(
  req.file.filename,
    {
      width: 120,
      height: 120,
      crop: "fill",
      gravity: "face",

      quality: "auto",
      fetch_format: "auto",
    }
  );

    // ✅ сохраняем в MongoDB
    await User.findByIdAndUpdate(userId, {
      avatar: avatarUrl,
    });

    // 🔥 обновляем ВСЕХ пользователей
    io.emit("avatarUpdated", {
      userId,
      avatar: avatarUrl,
    });

    res.json({ url: avatarUrl });

  } catch (err) {
    console.log("UPLOAD ERROR:", err);
    res.status(500).json({ error: "upload failed" });
  }
});

// =======================
// DELETE CHATS
// =======================
app.post("/delete-chats", async (req, res) => {
  try {

    const { userId, chatIds } = req.body;

    // =====================
    // DELETE MESSAGES
    // =====================

    await Message.deleteMany({
      $or: chatIds.map((chatId) => ({
        $or: [
          {
            senderId: userId,
            receiverId: chatId,
          },
          {
            senderId: chatId,
            receiverId: userId,
          },
        ],
      })),
    });

    // =====================
    // DELETE CHAT
    // =====================

    await Chat.deleteMany({
      users: {
        $all: chatIds.concat(userId),
      },
    });

    res.json({ success: true });

  } catch (err) {

    console.log("DELETE CHAT ERROR:", err);

    res.status(500).json({
      error: "server error",
    });

  }
});

// =======================
// STATIC
// =======================

app.use(express.static(path.join(__dirname, "../client/build")));

app.get("*", (req, res) => {
  res.sendFile(
    path.join(__dirname, "../client/build/index.html")
  );
});

// =======================
// START SERVER
// =======================

const PORT = process.env.PORT || 8080;

(async () => {
  try {
    await connectDB();

    server.listen(PORT, "0.0.0.0", () => {
      console.log("SERVER STARTED ON", PORT);
    });

  } catch (err) {
    console.log("FATAL ERROR:", err);
    process.exit(1);
  }
})();