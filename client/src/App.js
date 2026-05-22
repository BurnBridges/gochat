import { useState, useEffect, useRef } from "react";
import "./App.css";
import io from "socket.io-client";
import { messaging } from "./firebase";
import { getToken } from "firebase/messaging";

const socket = io("https://secretx.ru", {
  transports: ["websocket"],
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
});

const API = "https://secretx.ru";


function App() {
const [activeTab, setActiveTab] = useState("chats");
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [avatarFull, setAvatarFull] = useState(false);
  const [profileUser, setProfileUser] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState({});
  const [editMode, setEditMode] = useState(false);
  const [selectedChats, setSelectedChats] = useState([]);
  const totalUnread = (obj) =>
  Object.values(obj).reduce((a, b) => a + b, 0);
  const goTo = (page) => {

if (page === "chats") {
  setCurrentChat(null);
  setCurrentChatUser(null);
  setProfileUser(null);
  setReceiverId("");
  setMessages([]);
  setActiveTab("chats");
}

  if (page === "profile") {
    setActiveTab("profile");
  }
if (page === "chat") {
  setActiveTab("chats");
  return;
}
};

const backToHome = () => {
  setCurrentChat(null);
  setCurrentChatUser(null);
  setProfileUser(null);
  setReceiverId("");
  setMessages([]);
  setActiveTab("chats");
};
const backToChat = () => {
  setProfileUser(null);
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
  const isOnline = (id) => {
    return onlineUsers.has(id);
  };

 useEffect(() => {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker
      .register("/firebase-messaging-sw.js")
      .then(() => console.log("SW registered"))
      .catch((err) => console.log("SW error", err));
  }
}, []);

const [userId, setUserId] = useState(null);
const [avatar, setAvatar] = useState(null);
useEffect(() => {
  if (!userId) return;

  const saved = localStorage.getItem("avatar_" + userId);

  if (saved) {
    setAvatar(saved);
  } else {
    setAvatar(null);
  }
}, [userId]);

const fileInputRef = useRef(null);

const [isAuth, setIsAuth] = useState(false);
useEffect(() => {
  if (userId) {
    console.log("🔌 JOIN SOCKET:", userId);
    socket.emit("join", userId);
  }
}, [userId]);

const messagesEndRef = useRef(null);
const scrollToBottom = () => {
  requestAnimationFrame(() => {
    messagesEndRef.current?.scrollIntoView();
  });
};
const messagesContainerRef = useRef(null);
const [showScrollBtn, setShowScrollBtn] = useState(false);

const handleAvatarUpload = async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append("avatar", file);
  formData.append("userId", userId);

  try {
    // upload image
    const res = await fetch(API + "/upload-avatar", {
      method: "POST",
      body: formData,
    });
    console.log("URL:", res.url);
    console.log("STATUS:", res.status);
    const data = await res.json();

    console.log("UPLOAD RESULT:", data);

    if (!data.url) return;

    // set local avatar
    setAvatar(data.url);

    // save per-user
    localStorage.setItem("avatar_" + userId, data.url);

    // socket update
    socket.emit("avatarUpdated", {
      userId,
      avatar: data.url,
    });

  } catch (err) {
    console.log("UPLOAD ERROR:", err);
  }
};

useEffect(() => {
  socket.on("avatarUpdated", ({ userId, avatar }) => {
    console.log("AVATAR UPDATED:", userId);

    // обновляем чаты
    setChats((prev) =>
      prev.map((chat) => {
        const sender = chat.senderId?._id || chat.senderId;
        const receiver = chat.receiverId?._id || chat.receiverId;

        if (sender === userIdRef.current) {
          return {
            ...chat,
            senderId: { ...chat.senderId, avatar },
          };
        }

        if (receiver === userId) {
          return {
            ...chat,
            receiverId: { ...chat.receiverId, avatar },
          };
        }

        return chat;
      })
    );

    // обновляем открытый чат
    setCurrentChatUser((prev) =>
      prev?._id === userId
        ? { ...prev, avatar }
        : prev
    );
  });

  return () => socket.off("avatarUpdated");
}, []);
// =====================
// LOAD SESSION
// =====================
useEffect(() => {
  const token = localStorage.getItem("token");
  const savedUserId = localStorage.getItem("userId");
  const savedUsername = localStorage.getItem("username");

  if (token && savedUserId) {
    setUserId(savedUserId);
    setUsername(savedUsername || "");
    setIsAuth(true);
  }
}, []);
// =====================
// PUSH INIT (🔥 ГЛАВНОЕ)
// =====================
useEffect(() => {
  if (!userId) return;

  const initPush = async () => {
    try {

      // iPhone Safari иногда тупит
      if (!("Notification" in window)) {
        return;
      }

      // если пользователь запретил
      if (Notification.permission === "denied") {
        console.log("Push blocked");
        return;
      }

      // запрос разрешения
      if (Notification.permission !== "granted") {

        const permission =
          await Notification.requestPermission();

        if (permission !== "granted") {
          return;
        }
      }

      // ждём service worker
      const registration =
        await navigator.serviceWorker.ready;

      // firebase token
      const token = await getToken(messaging, {
        vapidKey:
          "BPoh-QmKEmOHfNFWsQEulP99oAkLyJVC89FHRObX50SJadb5IYAD4mTrD38dO_dNB-KR2La0LDevkkeCm6JBScA",
        serviceWorkerRegistration: registration,
      });

      if (!token) return;

      console.log("PUSH TOKEN:", token);

      // save token
      await fetch(API + "/push/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId,
          token,
        }),
      });

    } catch (err) {
      console.log("Push error:", err);
    }
  };

  // 🔥 delay like Telegram
  const timer = setTimeout(() => {
    initPush();
  }, 3000);

  return () => clearTimeout(timer);

}, [userId]);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLogin, setIsLogin] = useState(true);
  const [search, setSearch] = useState("");
  const [foundUsers, setFoundUsers] = useState([]);
  const [chats, setChats] = useState([]);

  useEffect(() => {

  chats.forEach((chat) => {
    const senderAvatar =
      chat.senderId?.avatar;
    const receiverAvatar =
      chat.receiverId?.avatar;
    if (senderAvatar) {
      const img = new Image();
      img.src = senderAvatar;
    }
    if (receiverAvatar) {
      const img = new Image();
      img.src = receiverAvatar;
    }
  });
}, [chats]);
  const [currentChat, setCurrentChat] = useState(null);
  const [receiverId, setReceiverId] = useState("");
  const receiverIdRef = useRef("");
  const userIdRef = useRef("");
  useEffect(() => {
  receiverIdRef.current = receiverId;
}, [receiverId]);

useEffect(() => {
  userIdRef.current = userId;
}, [userId]);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [currentChatUser, setCurrentChatUser] = useState(null);
const getSafeName = (user) => {
  if (!user) return "U";
  if (typeof user === "string") return user;
  return user.username || user.name || "U";
};
const getAvatarLetter = (name) => {
  if (!name) return "U";
  return name.trim().charAt(0).toUpperCase();
};
const getAvatarColor = (name = "") => {
  const colors = [
    "#2b5278",
    "#4e8cff",
    "#9b59b6",
    "#e67e22",
    "#1abc9c",
    "#e74c3c",
    "#f39c12",
    "#8e44ad",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};
  // AUTH
  // =====================
const auth = async () => {
  const url = isLogin ? "/login" : "/register";
  const res = await fetch(API + url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  console.log("URL:", res.url);
  console.log("STATUS:", res.status);
  const data = await res.json();
    localStorage.setItem(
      "avatar_" + data.userId,
      data.avatar || ""
    );
  console.log("LOGIN RESPONSE:", data); // 👈 добавь это
  if (data.userId && data.token) {
    localStorage.setItem("token", data.token);
    localStorage.setItem("userId", data.userId);
    localStorage.setItem("username", data.username);
    setUserId(data.userId);
    setUsername(data.username); 
    setAvatar(data.avatar || null);
    setIsAuth(true);
    socket.emit("join", data.userId);
  } 
    setTimeout(() => {
    Notification.requestPermission();
  }, 500);
};
// =====================
const loadChats = async () => {
  if (!userId) return;
  try {
    const res = await fetch(`${API}/chats/${userId}`);
    const data = await res.json();
    console.log("CHATS RESPONSE:", data);
    setChats(data);
  } catch (err) {
    console.log("LOAD CHATS ERROR:", err);
  }
};
useEffect(() => {
  if (!userId || !isAuth) return;
  loadChats();
  loadUnread();
}, [userId, isAuth]);
useEffect(() => {
  const total = Object.values(unreadMessages || {}).reduce(
    (sum, val) => sum + val,
    0
  );
  setUnreadCount(total);
}, [unreadMessages]);
  useEffect(() => {
  scrollToBottom();
}, [messages]);
  // =====================
const loadUnread = async () => {
  if (!userId) return;
  const res = await fetch(API + "/unread/" + userId);
  console.log("URL:", res.url);
  console.log("STATUS:", res.status);
  const data = await res.json();
  const formatted = {};
  data.forEach((item) => {
    formatted[item._id] = item.count;
  });
 (
  data.reduce((sum, i) => sum + i.count, 0)
);
setUnreadMessages(formatted);
  setUnreadMessages(formatted);
};
  // =====================
 useEffect(() => {
  if (!search) {
    setFoundUsers([]);
    return;
  }
  const timer = setTimeout(async () => {
    try {
      const res = await fetch(`${API}/users/search/${search}`);
      const data = await res.json();
      console.log("SEARCH DATA:", data);
      const users = Array.isArray(data) ? data : data.users || [];
      setFoundUsers(users.filter((u) => u._id !== userId));
    } catch (err) {
      console.log("SEARCH ERROR:", err);
    }
  }, 300);
  return () => clearTimeout(timer);
}, [search, userId]);
  // =====================
  // OPEN CHAT
  // =====================
const markAsRead = async (senderId, receiverId) => {
  await fetch(API + "/messages/read", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      senderId,
      receiverId,
    }),
  });
};
app.post("/chat/open", async (req, res) => {
  try {
    const { userId, otherId } = req.body;

    const u1 = mongoose.Types.ObjectId(userId);
    const u2 = mongoose.Types.ObjectId(otherId);

    let chat = await Chat.findOne({
      users: { $all: [u1, u2] },
    }).lean();

    if (!chat) {
      chat = await Chat.create({
        users: [u1, u2],
        lastMessage: "",
        lastMessageTime: new Date(),
        unreadCounts: {},
      });
    }

    res.json(chat);
  } catch (err) {
    console.log("CHAT OPEN ERROR:", err);
    res.status(500).json({ error: "chat open failed" });
  }
});
// =====================
const toggleChatSelect = (chatId) => {
  setSelectedChats((prev) =>
    prev.includes(chatId)
      ? prev.filter((id) => id !== chatId)
      : [...prev, chatId]
  );
};
const deleteSelectedChats = async () => {
  try {
    await fetch(API + "/delete-chats", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userId,
        chatIds: selectedChats,
      }),
    });
    setChats((prev) =>
      prev.filter((chat) => {
        const sender =
          chat.senderId?._id || chat.senderId;

        const other =
          sender === userIdRef.current
            ? chat.receiverId?._id || chat.receiverId
            : sender;

        return !selectedChats.includes(other);
      })
    );
    setSelectedChats([]);
    setEditMode(false);
  } catch (err) {
    console.log("DELETE CHAT ERROR:", err);
  }
};
// =====================
useEffect(() => {
  if (!socket) return;
 const handleRead = ({ from }) => {
  console.log("READ FROM:", from);
    setMessages((prev) =>
      prev.map((m) => {
        const sender = m.senderId?._id || m.senderId;

        if (String(sender) !== String(from)) return m;

        if (m.status === "read") return m;
        return {
          ...m,
          status: "read",
        };
      })
    );
};
  socket.on("messageRead", handleRead);
  return () => {
    socket.off("messageRead", handleRead);
  };
}, [socket, userId]);
// =====================
useEffect(() => {
  // ONLINE USERS
  socket.on("onlineUsers", (users) => {
    console.log("ONLINE:", users);
    setOnlineUsers(new Set(users));
  });
  // NEW MESSAGE
socket.on("getMessage", (msg) => {
  const sender = msg.senderId?._id || msg.senderId;
  const receiver = msg.receiverId?._id || msg.receiverId;
  const isSelfMessage = sender === userIdRef.current;
  const isCurrentChat =
    (sender === receiverIdRef.current && receiver === userIdRef.current) ||
    (sender === userIdRef.current && receiver === receiverId);

  console.log("NEW MESSAGE:", msg);
// =====================
// AUTO READ IF CHAT OPEN
// =====================
if (
  sender === receiverId &&
  receiver === userId &&
  msg.status !== "read"
) {
  fetch(API + "/messages/read", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      senderId: sender,
      receiverId: userId,
    }),
  });
}
  // =====================
  // 1. UNREAD COUNT
  // =====================
  if (sender !== userId && sender !== receiverId) {
    setUnreadMessages((prev) => ({
      ...prev,
      [sender]: (prev[sender] || 0) + 1,
    }));
  }
  // =====================
  // 2. ADD MESSAGE TO CHAT
  // =====================
  if (isCurrentChat) {
    setMessages((prev) => {
      const exists = prev.some(
        (m) => m.messageId === msg.messageId
      );

      if (exists) return prev;

      return [...prev, msg];
    });
  }
  // =====================
  // 3. UPDATE CHAT LIST
  // =====================
  setChats((prev) => {
    const otherId =
      sender === userIdRef.current ? receiver : sender;

    let found = false;

    const updated = prev.map((chat) => {
      const chatSender =
        chat.senderId?._id || chat.senderId;

      const chatReceiver =
        chat.receiverId?._id || chat.receiverId;

      const chatOther =
        chatSender === userIdRef.current
          ? chatReceiver
          : chatSender;

      if (chatOther === otherId) {
        found = true;

        return {
          ...chat,

          text: msg.text,
          updatedAt: Date.now(),

          // 🔥 важно сохранить статус
          status: msg.status || "sent",

          senderId: msg.senderId,
          receiverId: msg.receiverId,
        };
      }

      return chat;
    });

    if (!found) {
      updated.unshift({
        senderId: msg.senderId,
        receiverId: msg.receiverId,
        text: msg.text,
        updatedAt: Date.now(),
        status: msg.status || "sent",
      });
    }

    updated.sort(
      (a, b) =>
        (b.updatedAt || 0) - (a.updatedAt || 0)
    );

    return updated;
  });
});
  return () => {
    socket.off("onlineUsers");
    socket.off("getMessage");
  };

}, []);
  // =====================
  // SEND
  // =====================
const sendMessage = () => {
  if (!text.trim()) return;
  const msg = {
    senderId: userId,
    chatId: currentChat,
    text,
    messageId: Date.now(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    status: "sent",
  };
  // отправка
  socket.emit("sendMessage", msg);
  // UPDATE CHAT LIST
  // =====================
  setChats((prev) => {
    const updated = prev.map((chat) => {
      const sender =
        chat.senderId?._id || chat.senderId;

      const receiver =
        chat.receiverId?._id || chat.receiverId;

      const otherId =
        sender === userId
          ? receiver
          : sender;

      if (otherId === receiverId) {
        return {
          ...chat,
          text: msg.text,
          updatedAt: Date.now(),
          status: "sent",
        };
      }

      return chat;
    });

    updated.sort(
      (a, b) =>
        (b.updatedAt || 0) -
        (a.updatedAt || 0)
    );

    return updated;
  });

  setText("");
};
  // =====================
  // LOGIN SCREEN
  // =====================
  if (!isAuth) {
    return (
      <div className="authPage">
        <div className="authCard">
          <h1>Chat</h1>
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
            {isLogin
              ? "Create account"
              : "Already have account?"}
          </p>
        </div>
      </div>
    );
  }
  // =====================
  // HOME SCREEN
  // =====================
// =====================
// PROFILE LOGIC
// =====================
const viewingOwnProfile =
  !profileUser || profileUser._id === userId;
const isOwnProfile =
  !profileUser || profileUser._id === userId;
const displayAvatar = isOwnProfile
  ? avatar
  : profileUser?.avatar;
// =====================
// PROFILE DATA
// =====================
const profileData = viewingOwnProfile
  ? {
      username,
      avatar: profileUser?.avatar ?? avatar,
    }
  : {
      username: profileUser?.username || "User",
      avatar: profileUser?.avatar || null,
    };
// =====================
// CHAT HELPERS
// =====================
const getOtherUser = (chat) => {
  const sender =
    typeof chat.senderId === "object"
      ? chat.senderId
      : { _id: chat.senderId };

  const receiver =
    typeof chat.receiverId === "object"
      ? chat.receiverId
      : { _id: chat.receiverId };

  return sender._id === userId ? receiver : sender;
};
// =====================
// CHAT STATE FIX (IMPORTANT)
// =====================
const isChatOpen = !!currentChatUser;
return (
  <div className="appContainer">
  {/* ================= CHAT ================= */}
  {isChatOpen && activeTab !== "profile" && (
  <div className="chatPage">
      <div className="chatTop">
        <button
          className="backBtn"
          onClick={() => {
            setProfileUser(null);
            backToHome();
          }}
        >
          ‹
        </button>
        <div className="chatNamePill">
          <div className="chatName">
            {currentChatUser?.username}
          </div>
          <div className="chatStatus">
            <span
              className={`statusDot ${
                isOnline(currentChatUser?._id)
                  ? "online"
                  : "offline"
              }`}
            />
            {isOnline(currentChatUser?._id)
              ? "online"
              : "offline"}
          </div>
        </div>
        <div
          className="chatAvatarRight"
          onClick={() =>
            openProfile(currentChatUser)
          }
          style={{
            background: getAvatarColor(
              currentChatUser?.username || ""
            ),
          }}
        >
          {currentChatUser?.avatar ? (
            <img
              src={currentChatUser.avatar}
              className="avatarImg"
            />
          ) : (
            getAvatarLetter(
              currentChatUser?.username
            )
          )}
        </div>
      </div>
      <div className="chatMessages">
        {messages.map((m, i) => {

          const mine =
            (m.senderId?._id || m.senderId) === userId;

          return (
            <div
              key={i}
              className={
                mine
                  ? "bubbleRow myRow"
                  : "bubbleRow otherRow"
              }
            >
              <div
  className={
    mine
      ? "bubble myBubble"
      : "bubble otherBubble"
  }
>
  <div className="messageText">
    {m.text}
  </div>
<div className="messageMeta">
  <span className="messageTime">
    {new Date(m.createdAt || m.updatedAt || Date.now()).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    })}
  </span>
{mine && (
  <span className={`messageStatus ${m.status}`}>
    {m.status === "read" ? "✓✓" : "✓"}
  </span>
)}
</div>
</div>
            </div>
          );
        })}
            <div ref={messagesEndRef} />
      </div>
      <div className="chatBottom">
        <input
          className="chatInput"
          value={text}
          onChange={(e) =>
            setText(e.target.value)
          }
          placeholder="Message..."
        />
        <button
          className="sendBtn"
          onClick={sendMessage}
        >
          ➜
        </button>
      </div>
    </div>
  )}
  {/* ================= PROFILE ================= */}
{activeTab === "profile" && (
  <div className="profilePage">
    {/* HEADER */}
    <div className="tgProfileHeader">
      {/* BACK */}
      <button
        className="tgBackBtn"
        onClick={() => {
          if (currentChatUser) {
            setProfileUser(null);
            setActiveTab("chats");
          } else {
            backToHome();
          }
        }}
      >
        <span>‹</span>
      </button>
      {/* IMAGE */}
      {profileUser?.avatar || avatar ? (
        <img
          src={profileUser?.avatar || avatar}
          className="tgProfileImage"
        />
      ) : (
        <div
          className="tgProfileFallback"
          style={{
            background: getAvatarColor(
              profileUser?.username || username
            ),
          }}
        >
          {getAvatarLetter(
            profileUser?.username || username
          )}
        </div>
      )}
      {/* OVERLAY */}
      <div className="tgOverlay" />
      {/* USER INFO */}
      <div className="tgProfileInfo">
        <div className="tgProfileName">
          {profileUser?.username || username}
        </div>
        <div className="tgProfileStatus">
          {viewingOwnProfile
            ? "online"
            : isOnline(profileUser?._id)
            ? "online"
            : "offline"}
        </div>
      </div>
      {/* CHANGE PHOTO */}
      {viewingOwnProfile && (
        <button
          className="tgChangePhoto"
          onClick={() => fileInputRef.current?.click()}
        >
          Change photo
        </button>
      )}
    </div>
    {/* BODY */}
    <div className="tgProfileBody">
      <div className="tgCard">
        <div className="tgFieldLabel">
          Username
        </div>
        <div className="tgFieldValue">
          @{profileUser?.username || username}
        </div>
      </div>
      {viewingOwnProfile && (
        <button
          className="tgLogoutBtn"
          onClick={() => {
            localStorage.clear();

            setIsAuth(false);
            setUserId(null);
            setCurrentChat(null);
            setProfileUser(null);
          }}
        >
          Log out
        </button>
      )}
    </div>
    {/* hidden input */}
    <input
      type="file"
      ref={fileInputRef}
      style={{ display: "none" }}
      onChange={handleAvatarUpload}
    />
  </div>
)}
  {/* ================= HOME ================= */}
{!isChatOpen && activeTab === "chats" && (
  <div className="homePage">
    {/* HEADER */}
<div className="homeHeader">
  {/* EDIT BUTTON */}
  <button
    className="editBtn"
    onClick={() => {
      setEditMode(!editMode);
      setSelectedChats([]);
    }}
  >
    {editMode ? "Cancel" : "Edit"}
  </button>
  {/* TITLE */}
  <div className="headerTitle">
    Chats
  </div>
  {/* AVATAR */}
  <div
    className="headerAvatar"
    onClick={() =>
      setActiveTab("profile")
    }
  >
    {avatar ? (
      <img
        src={avatar}
        className="avatarImg"
      />
    ) : (
      (username || "U")[0].toUpperCase()
    )}
  </div>
</div>
    {/* SEARCH */}
    <div className="searchWrap">
      <input
        className="searchInput"
        placeholder="Search"
        value={search}
        onChange={(e) =>
          setSearch(e.target.value)
        }
      />
    </div>
    {/* SEARCH USERS */}
{search.length > 0 ? (
  foundUsers.length > 0 ? (
    <div className="chatList">
      {foundUsers.map((user, i) => (
        <div
          key={i}
          className="chatItem"
          onClick={() => {
            openChat(user);
            setSearch("");
          }}
        >
          <div
            className="avatar"
            style={{ background: getAvatarColor(user.username) }}
          >
            {user.avatar ? (
              <img src={user.avatar} className="avatarImg" />
            ) : (
              getAvatarLetter(user.username)
            )}
          </div>
          <div className="chatInfo">
            <div className="chatName">{user.username}</div>
          </div>
        </div>
      ))}
    </div>
  ) : (
    <div className="noResults">No users found</div>
  )
) : null}
    {/* DELETE BAR */}
    {editMode && selectedChats.length > 0 && (
      <div className="deleteBar">
        <button
          className="deleteChatsBtn"
          onClick={deleteSelectedChats}
        >
          Delete ({selectedChats.length})
        </button>
      </div>
    )}
    {/* CHATS */}
{!search && (
  <div className="chatList">
    {chats.map((chat, i) => {
      const sender = chat.senderId?._id || chat.senderId;
      const receiver = chat.receiverId?._id || chat.receiverId;
      const otherUser =
        sender === userIdRef.current ? chat.receiverId : chat.senderId;
        const safeUser = {
        _id: otherUser?._id || "",
        username: otherUser?.username || "User",
        avatar: otherUser?.avatar || null,
      };
      return (
        <div
          key={i}
          className={`chatItem ${
            selectedChats.includes(otherUser._id)
              ? "selectedChat"
              : ""
          }`}
          onClick={() => {
            if (editMode) {
              toggleChatSelect(otherUser._id);
            } else {
              openChat(otherUser);
            }
          }}
        >
          <div
            className="avatar"
            style={{
              background: getAvatarColor(
                otherUser.username
              ),
            }}
          >
            {otherUser.avatar ? (
              <img
                src={otherUser.avatar}
                className="avatarImg"
              />
            ) : (
              getAvatarLetter(otherUser.username)
            )}
          </div>
          <div className="chatInfo">
<div className="chatInfo">
  <div className="chatTopLine">
    <div className="chatName">
      {otherUser.username}
    </div>

    <div className="chatTime">
      {chat.updatedAt
        ? new Date(chat.updatedAt).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })
        : ""}
    </div>
  </div>
  <div className="chatPreview">
    <span className="previewText">
      {chat.text}
    </span>
    {unreadMessages?.[otherUser._id] > 0 && (
      <div className="chatUnreadBadge">
        {unreadMessages[otherUser._id]}
      </div>
    )}
  </div>
</div>
          </div>
        </div>
      );
    })}
  </div>
)}
  </div>
)}
  {/* ================= BOTTOM NAV ================= */}
 {!isChatOpen && (
  <div className="bottomNavWrap">
      <div className="bottomNav">
        <button
  className={`navItem ${
    activeTab === "chats"
      ? "active"
      : ""
  }`}
  onClick={() =>
    setActiveTab("chats")
  }
>
  <img
    src="/icons/chat.png"
    className="navImg"
  />
  <div className="navLabel">
  <span>Chats</span>
  {unreadCount > 0 && (
    <div className="navBadge">
      {unreadCount}
    </div>
  )}
  </div>
  </button>
  <button
    className={`navItem ${
      activeTab === "profile"
        ? "active"
        : ""
    }`}
    onClick={() =>
      setActiveTab("profile")
    }
  >
    <img
      src="/icons/profile.png"
      className="navImg"
    />
    <span>Profile</span>
  </button>
      </div>
    </div>
  )}
</div>
);
}
export default App;