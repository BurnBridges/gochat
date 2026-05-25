const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    chatId: {
      type: String,
      required: true,
      index: true,
    },

    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    text: String,

    messageId: {
      type: String,
      index: true,
    },

    read: {
      type: Boolean,
      default: false,
    },

    status: {
      type: String,
      enum: ["sent", "read"],
      default: "sent",
    },
  },
  { timestamps: true }
);

messageSchema.index({ chatId: 1, createdAt: 1 });

module.exports = mongoose.model("Message", messageSchema);