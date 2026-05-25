import { useState } from "react";
import "./App.css";

import { useAuth } from "./hooks/useAuth";
import { useSocket } from "./hooks/useSocket";

import ChatList from "./components/ChatList";
import ChatWindow from "./components/ChatWindow";

function App() {
  const { user, isAuth } = useAuth();

  const [messages, setMessages] = useState([]);
  const [chats, setChats] = useState([]);
  const [text, setText] = useState("");
  const [currentChat, setCurrentChat] = useState(null);

  const socket = useSocket(
    user?.userId,
    (msg) => setMessages((p) => [...p, msg]),
    (users) => console.log(users)
  );

  const sendMessage = () => {
    if (!text.trim()) return;

    const msg = {
      text,
      senderId: user.userId,
      chatId: currentChat,
    };

    socket.emit("sendMessage", msg);
    setText("");
  };

  const openChat = (user) => {
    setCurrentChat(user._id);
  };

  if (!isAuth) return <div>LOGIN SCREEN</div>;

  return (
    <div className="appContainer">
      {!currentChat ? (
        <ChatList chats={chats} openChat={openChat} />
      ) : (
        <ChatWindow
          messages={messages}
          text={text}
          setText={setText}
          sendMessage={sendMessage}
          userId={user.userId}
        />
      )}
    </div>
  );
}

export default App;