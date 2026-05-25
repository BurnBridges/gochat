const mongoose = require("mongoose");

const chatSchema = new mongoose.Schema(
  {
    users: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    lastMessage: {
      type: String,
      default: "",
    },

    lastMessageTime: {
      type: Date,
      default: Date.now,
    },

    unreadCounts: {
      type: Map,
      of: Number,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

chatSchema.index({ users: 1 });
chatSchema.index({ lastMessageTime: -1 });

module.exports = mongoose.model("Chat", chatSchema);