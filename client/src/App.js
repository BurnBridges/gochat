import { useState, useEffect, useRef } from "react";
import "./App.css";
import io from "socket.io-client";
import { messaging } from "./firebase";
import { getToken } from "firebase/messaging";
import { v4 as uuidv4 } from "uuid";

const socket = io("https://secretx.ru", {
  transports: ["websocket"],
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
});

const API = "https://secretx.ru";

function App() {
  // ================= STATE =================
  const [activeTab, setActiveTab] = useState("chats");
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [profileUser, setProfileUser] = useState(null);
  const [unreadMessages, setUnreadMessages] = useState({});
  const [editMode, setEditMode] = useState(false);
  const [selectedChats, setSelectedChats] = useState([]);

  const [userId, setUserId] = useState(null);
  const [avatar, setAvatar] = useState(null);
  const [isAuth, setIsAuth] = useState(false);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLogin, setIsLogin] = useState(true);

  const [search, setSearch] = useState("");
  const [foundUsers, setFoundUsers] = useState([]);
  const [chats, setChats] = useState([]);

  const [currentChat, setCurrentChat] = useState(null);
  const [receiverId, setReceiverId] = useState("");
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [currentChatUser, setCurrentChatUser] = useState(null);

  // ================= REFS =================
  const receiverIdRef = useRef("");
  const userIdRef = useRef("");
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    receiverIdRef.current = receiverId;
  }, [receiverId]);

  useEffect(() => {
    userIdRef.current = userId;
  }, [userId]);

  // ================= OPEN CHAT (FIXED) =================
  const openChat = async (user) => {
    setReceiverId(user._id);
    setCurrentChatUser(user);

    const chatRes = await fetch(API + "/chat/open", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        otherId: user._id,
      }),
    });

    const chat = await chatRes.json();

    setCurrentChat(chat._id);

    const res = await fetch(API + "/messages/" + chat._id);
    const data = await res.json();

    setMessages(data);
  };

  const backToHome = () => {
    setCurrentChat(null);
    setCurrentChatUser(null);
    setProfileUser(null);
    setReceiverId("");
    setMessages([]);
    setActiveTab("chats");
  };

  const openProfile = (user) => {
    if (!user) return;

    setProfileUser({
      _id: user._id,
      username: user.username || "User",
      avatar: user.avatar || null,
    });

    setActiveTab("profile");
  };

  const isOnline = (id) => onlineUsers.has(id);

  // ================= SOCKET =================
  useEffect(() => {
    socket.on("onlineUsers", (users) => {
      setOnlineUsers(new Set(users));
    });

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

      setChats((prev) => {
        const updated = prev.map((c) => {
          const other =
            (c.senderId?._id || c.senderId) === userId
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
        });

        return updated;
      });
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

  // ================= UI =================
  if (!isAuth) {
    return (
      <div className="authPage">
        <input value={username} onChange={(e) => setUsername(e.target.value)} />
        <input value={password} onChange={(e) => setPassword(e.target.value)} />
        <button onClick={auth}>{isLogin ? "Login" : "Register"}</button>
      </div>
    );
  }

  const isChatOpen = !!currentChatUser;

  return (
    <div className="appContainer">

      {isChatOpen && (
        <div className="chatPage">
          <div className="chatTop">
            <button onClick={backToHome}>‹</button>
            <div>{currentChatUser?.username}</div>
          </div>

          <div className="chatMessages">
            {messages.map((m, i) => (
              <div key={i}>{m.text}</div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <div className="chatBottom">
            <input value={text} onChange={(e) => setText(e.target.value)} />
            <button onClick={sendMessage}>Send</button>
          </div>
        </div>
      )}

      {!isChatOpen && (
        <div className="homePage">
          <h2>Chats</h2>
        </div>
      )}
    </div>
  );
}

export default App;