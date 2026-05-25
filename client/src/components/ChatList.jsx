export default function ChatList({ chats, openChat }) {
  return (
    <div className="chatList">
      {chats.map((chat, i) => {
        const user =
          chat.senderId?.username ? chat.senderId : chat.receiverId;

        return (
          <div key={i} className="chatItem" onClick={() => openChat(user)}>
            <div className="chatName">{user.username}</div>
            <div className="chatPreview">{chat.lastMessage}</div>
          </div>
        );
      })}
    </div>
  );
}