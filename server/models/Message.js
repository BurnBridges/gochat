const mongoose = require("mongoose");

const MessageSchema = new mongoose.Schema({
  chatId: String,
  senderId: String,
  receiverId: String,
  text: String,
  status: { type: String, default: "sent" },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Message", MessageSchema);