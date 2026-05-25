import MessageBubble from "./MessageBubble";

export default function ChatWindow({
  messages,
  text,
  setText,
  sendMessage,
  userId,
}) {
  return (
    <div className="chatPage">
      <div className="chatMessages">
        {messages.map((m, i) => (
          <MessageBubble key={i} m={m} userId={userId} />
        ))}
      </div>

      <div className="chatBottom">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button onClick={sendMessage}>➜</button>
      </div>
    </div>
  );
}