require("dotenv").config();

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const path = require("path");
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
app.get("/messages/:chatId", async (req, res) => {
  try {

    const messages = await Message.find({
      chatId: req.params.chatId,
    }).sort({ createdAt: 1 });

    res.json(messages);

  } catch (err) {

    console.log(err);

    res.status(500).json([]);

  }
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
socket.on("sendMessage", async (data) => {
  try {

    // =======================
    // FIND CHAT
    // =======================

    const chat = await Chat.findById(
      data.chatId
    );

    if (!chat) {
      console.log("CHAT NOT FOUND");
      return;
    }

    // =======================
    // CREATE MESSAGE
    // =======================

    const msg = await Message.create({
      chatId: chat.chatId,
      senderId: data.senderId,
      receiverId: data.receiverId,
      text: data.text,
      messageId: data.messageId,
      status: "sent",
    });

    // =======================
    // UPDATE CHAT
    // =======================

    chat.lastMessage = data.text;
    chat.lastMessageTime = new Date();

    chat.unreadCounts.set(
      data.receiverId,
      (
        chat.unreadCounts?.get(
          data.receiverId
        ) || 0
      ) + 1
    );

    await chat.save();

    // =======================
    // SEND TO RECEIVER
    // =======================

    const receiverSocket =
      getSocketId(data.receiverId);

    if (receiverSocket) {
      io.to(receiverSocket).emit(
        "getMessage",
        msg
      );
    }

    // =======================
    // SEND TO SENDER
    // =======================

    io.to(socket.id).emit(
      "getMessage",
      msg
    );

  } catch (err) {
    console.log(
      "SEND ERROR:",
      err
    );
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
    res.status(500).json({ error: "server error" });
  }
});
// =======================
app.post("/chat/open", async (req, res) => {
  try {
    const { userId, otherId } = req.body;

    const chatId = createChatId(userId, otherId);

    let chat = await Chat.findOne({ chatId });

    if (!chat) {
      chat = await Chat.create({
        chatId,
        users: [userId, otherId],
        lastMessage: "",
        lastMessageTime: new Date(),
        unreadCounts: {},
      });
    }

    res.json({
      chatId: chat._id,
      users: chat.users,
    });

  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "chat open failed" });
  }
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
    const chatId = createChatId(
  senderId,
  receiverId
);

await Chat.updateOne(
  { chatId },
  {
    $set: {
      [`unreadCounts.${receiverId}`]: 0,
    },
  }
);
    const senderSocket = onlineUsers.get(senderId);

    if (senderSocket) {
      io.to(senderSocket).emit("messageRead", {
        from: receiverId,
      });
    }

    res.json({ success: true });

  } catch (err) {
    console.log("READ ERROR:", err);
    res.status(500).json({ error: "server error" });
  }
});
// =======================
function createChatId(a, b) {
  return [a, b].sort().join("_");
}
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