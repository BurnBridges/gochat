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
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
});

function App() {
  // ================= STATE =================
  const [isAuth, setIsAuth] = useState(false);
  const [isLogin, setIsLogin] = useState(true);

  const [userId, setUserId] = useState(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [avatar, setAvatar] = useState(null);

  const [activeTab, setActiveTab] = useState("chats");

  const [chats, setChats] = useState([]);
  const [messages, setMessages] = useState([]);

  const [currentChat, setCurrentChat] = useState(null);
  const [currentChatUser, setCurrentChatUser] = useState(null);
  const [receiverId, setReceiverId] = useState("");

  const [text, setText] = useState("");

  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [search, setSearch] = useState("");
  const [foundUsers, setFoundUsers] = useState([]);

  const [profileUser, setProfileUser] = useState(null);

  // ================= REFS =================
  const userIdRef = useRef(null);
  const receiverIdRef = useRef(null);
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    userIdRef.current = userId;
  }, [userId]);

  useEffect(() => {
    receiverIdRef.current = receiverId;
  }, [receiverId]);

  // ================= SOCKET =================
  useEffect(() => {
    socket.on("onlineUsers", setOnlineUsers);

    socket.on("getMessage", (msg) => {
      const sender = msg.senderId?._id || msg.senderId;
      const receiver = msg.receiverId?._id || msg.receiverId;

      const isCurrentChat =
        (sender === userIdRef.current &&
          receiver === receiverIdRef.current) ||
        (receiver === userIdRef.current &&
          sender === receiverIdRef.current);

      if (isCurrentChat) {
        setMessages((prev) => [...prev, msg]);
      }

      setChats((prev) =>
        prev.map((c) => {
          const other =
            (c.senderId?._id || c.senderId) === userIdRef.current
              ? c.receiverId
              : c.senderId;

          const otherId = other?._id || other;

          if (otherId === sender) {
            return {
              ...c,
              lastMessage: msg.text,
              lastMessageTime: Date.now(),
            };
          }

          return c;
        })
      );
    });

    return () => {
      socket.off("onlineUsers");
      socket.off("getMessage");
    };
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
      localStorage.setItem("token", data.token);
      localStorage.setItem("userId", data.userId);
      localStorage.setItem("username", data.username);

      setUserId(data.userId);
      setUsername(data.username);
      setIsAuth(true);

      socket.emit("join", data.userId);
    }
  };

  // ================= OPEN CHAT =================
  const openChat = async (user) => {
    setReceiverId(user._id);
    setCurrentChatUser(user);

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

    const msgRes = await fetch(API + "/messages/" + chat._id);
    const data = await msgRes.json();

    setMessages(data);
  };

  // ================= SEND =================
  const sendMessage = () => {
    if (!text.trim()) return;

    const msg = {
      senderId: userId,
      receiverId,
      text,
      messageId: uuidv4(),
      createdAt: Date.now(),
      status: "sent",
    };

    socket.emit("sendMessage", msg);
    setMessages((prev) => [...prev, msg]);
    setText("");
  };

  // ================= PROFILE =================
  const openProfile = (user) => {
    if (!user) return;

    setProfileUser(user);
    setActiveTab("profile");
  };

  const isOnline = (id) => onlineUsers.has(id);

  // ================= UI =================
  if (!isAuth) {
    return (
      <div className="authPage">
        <div className="authCard">
          <input
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <input
            placeholder="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button onClick={auth}>
            {isLogin ? "Login" : "Register"}
          </button>

          <p onClick={() => setIsLogin(!isLogin)}>
            {isLogin ? "Create account" : "Login"}
          </p>
        </div>
      </div>
    );
  }

  const isChatOpen = !!currentChatUser;

  return (
    <div className="appContainer">

      {/* CHAT */}
      {isChatOpen && (
        <div className="chatPage">
          <div className="chatTop">
            <button onClick={() => setCurrentChatUser(null)}>
              ‹
            </button>
            <div>{currentChatUser?.username}</div>
          </div>

          <div className="chatMessages">
            {messages.map((m, i) => (
              <div key={i}>{m.text}</div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <div className="chatBottom">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <button onClick={sendMessage}>Send</button>
          </div>
        </div>
      )}

      {/* HOME */}
      {!isChatOpen && (
        <div className="homePage">
          <h2>Chats</h2>
        </div>
      )}
    </div>
  );
}

export default App;ы