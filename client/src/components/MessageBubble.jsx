export default function MessageBubble({ m, userId }) {
  const mine = (m.senderId?._id || m.senderId) === userId;

  return (
    <div className={mine ? "myRow" : "otherRow"}>
      <div className={mine ? "myBubble" : "otherBubble"}>
        <div>{m.text}</div>

        <div className="messageMeta">
          <span>
            {new Date(m.createdAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>

          {mine && (
            <span>{m.status === "read" ? "✓✓" : "✓"}</span>
          )}
        </div>
      </div>
    </div>
  );
}ы