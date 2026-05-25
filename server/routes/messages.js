const router = require("express").Router();
const Message = require("../models/Message");
const Chat = require("../models/Chat");

router.get("/:chatId", async (req, res) => {
  const messages = await Message.find({
    chatId: req.params.chatId,
  }).sort({ createdAt: 1 });

  res.json(messages);
});

router.post("/send", async (req, res) => {
  const msg = await Message.create(req.body);

  await Chat.updateOne(
    { chatId: msg.chatId },
    {
      lastMessage: msg.text,
      lastMessageTime: new Date(),
    }
  );

  res.json(msg);
});

module.exports = router;