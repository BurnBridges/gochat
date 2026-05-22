const mongoose = require("mongoose");

const pushTokenSchema = new mongoose.Schema({
  userId: String,
  token: String,
});

module.exports = mongoose.model("PushToken", pushTokenSchema);