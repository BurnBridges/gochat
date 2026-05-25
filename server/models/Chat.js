const mongoose = require("mongoose");

const ChatSchema = new mongoose.Schema({
  users: [{ type: String }],
  lastMessage: String,
  lastMessageTime: Date,
});

module.exports = mongoose.model("Chat", ChatSchema);