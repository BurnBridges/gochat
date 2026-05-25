const router = require("express").Router();
const Chat = require("../models/Chat");

router.post("/open", async (req, res) => {
  const { userId, otherId } = req.body;

  const users = [userId, otherId].sort();
  const chatId = users.join("_");

  let chat = await Chat.findOne({ chatId });

  if (!chat) {
    chat = await Chat.create({
      chatId,
      users,
      lastMessage: "",
      lastMessageTime: new Date(),
    });
  }

  res.json(chat);
});

module.exports = router;