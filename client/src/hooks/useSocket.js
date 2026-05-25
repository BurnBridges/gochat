import { useEffect } from "react";
import io from "socket.io-client";

const socket = io("https://secretx.ru", {
  transports: ["websocket"],
});

export function useSocket(userId, onMessage, onOnline) {
  useEffect(() => {
    if (!userId) return;

    socket.emit("join", userId);

    socket.on("getMessage", onMessage);
    socket.on("onlineUsers", onOnline);

    return () => {
      socket.off("getMessage", onMessage);
      socket.off("onlineUsers", onOnline);
    };
  }, [userId]);

  return socket;
}