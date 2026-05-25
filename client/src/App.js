import { useState, useEffect, useRef } from "react";
import "./App.css";
import io from "socket.io-client";
import { messaging } from "./firebase";
import { getToken } from "firebase/messaging";
import { v4 as uuidv4 } from "uuid";

const API = "https://secretx.ru";

const socket = io(API, {
  transports: ["websocket"],
  reconnection: true,
});

export default function App() {
  // ================= STATE =================
  const [isAuth, setIsAuth] = useState(false);
  const [isLogin, setIsLogin] = useState(true);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [userId, setUserId] = useState(null);

  const [chats, setChats] = useState([]);
  const [messages, setMessages] = useState([]);

  const [currentChat, setCurrentChat] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);

  const [text, setText] = useState("");
  const [search, setSearch] = useState("");
  const [foundUsers, setFoundUsers] = useState([]);

  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [unread, setUnread] = useState({});

  const messagesEndRef = useRef(null);

  // ================= SOCKET JOIN =================
  useEffect(() => {
    if (userId) socket.emit("join", userId);
  }, [userId]);

  // ================= LOAD SESSION =================
  useEffect(() => {
    const id = localStorage.getItem("userId");
    const token = localStorage.getItem("token");
    const name = localStorage.getItem("username");

    if (id && token) {
      setUserId(id);
      setUsername(name || "");
      setIsAuth(true);
    }
  }, []);

  // ================= AUTH =================
  const auth = async () => {
    const url = isLogin ? "/login" : "/register";

    const res = await fetch(API + url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    const data = await res.json();

    if (data.userId && data.token) {
      localStorage.setItem("userId", data.userId);
      localStorage.setItem("token", data.token);
      localStorage.setItem("username", data.username);

      setUserId(data.userId);
      setIsAuth(true);
    }
  };

  // ================= LOAD CHATS =================
  useEffect(() => {
    if (!userId) return;

    fetch(API + "/chats/" + userId)
      .then((r) => r.json())
      .then(setChats);
  }, [userId]);

  // ================= OPEN CHAT =================
  const openChat = async (user) => {
    setCurrentUser(user);

    const res = await fetch(API + "/chat/open", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        otherId: user._id,
      }),
    });

    const chat = await res.json();

    setCurrentChat(chat._id);

    const msgs = await fetch(API + "/messages/" + chat._id);
    setMessages(await msgs.json());
  };

  // ================= SEND MESSAGE =================
  const sendMessage = () => {
    if (!text.trim()) return;

    const msg = {
      senderId: userId,
      receiverId: currentUser._id,
      chatId: currentChat,
      text,
      messageId: uuidv4(),
      createdAt: Date.now(),
    };

    socket.emit("sendMessage", msg);

    setMessages((p) => [...p, msg]);
    setText("");
  };

  // ================= SOCKET EVENTS =================
  useEffect(() => {
    socket.on("onlineUsers", setOnlineUsers);

    socket.on("getMessage", (msg) => {
      if (msg.chatId === currentChat) {
        setMessages((p) => [...p, msg]);
      }
    });

    return () => {
      socket.off("onlineUsers");
      socket.off("getMessage");
    };
  }, [currentChat]);

  // ================= SEARCH USERS =================
  useEffect(() => {
    if (!search) return setFoundUsers([]);

    const t = setTimeout(async () => {
      const res = await fetch(API + "/users/search/" + search);
      setFoundUsers(await res.json());
    }, 300);

    return () => clearTimeout(t);
  }, [search]);

  // ================= SCROLL =================
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ================= UI =================
  if (!isAuth) {
    return (
      <div className="authPage">
        <input
          placeholder="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <input
          placeholder="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button onClick={auth}>
          {isLogin ? "Login" : "Register"}
        </button>

        <p onClick={() => setIsLogin(!isLogin)}>
          switch
        </p>
      </div>
    );
  }

  return (
    <div className="app">

      {/* LEFT */}
      <div className="sidebar">
        <input
          placeholder="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {foundUsers.map((u) => (
          <div key={u._id} onClick={() => openChat(u)}>
            {u.username}
          </div>
        ))}

        {chats.map((c) => (
          <div key={c._id} onClick={() => openChat(c.senderId)}>
            {c.lastMessage || "chat"}
          </div>
        ))}
      </div>

      {/* CHAT */}
      <div className="chat">
        <div className="messages">
          {messages.map((m, i) => (
            <div key={i}>{m.text}</div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <div className="input">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <button onClick={sendMessage}>Send</button>
        </div>
      </div>

    </div>
  );
}