const { Server } = require("socket.io");

const onlineUsers = new Map();

module.exports = (server) => {
  const io = new Server(server, {
    cors: { origin: "*" },
  });

  io.on("connection", (socket) => {
    console.log("user connected");

    socket.on("join", (userId) => {
      onlineUsers.set(userId, socket.id);
      socket.userId = userId;

      io.emit("online", Array.from(onlineUsers.keys()));
    });

    socket.on("send_message", (msg) => {
      const receiverSocket = onlineUsers.get(msg.receiverId);

      if (receiverSocket) {
        io.to(receiverSocket).emit("new_message", msg);
      }

      io.to(socket.id).emit("new_message", msg);
    });

    socket.on("disconnect", () => {
      if (socket.userId) {
        onlineUsers.delete(socket.userId);
      }

      io.emit("online", Array.from(onlineUsers.keys()));
    });
  });
};