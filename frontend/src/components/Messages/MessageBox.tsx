interface IMessageBox {
  messages: { text: string; played: boolean }[];
  messageIdx: number;
  isPlaying: boolean;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
}

export const MessageBox = ({
  messages,
  messageIdx,
  isPlaying,
  messagesEndRef,
}: IMessageBox) => {
  return (
    <div
      className="p-3 bg-light rounded"
      style={{ maxHeight: "400px", overflowY: "auto" }}
    >
      {messages
        .filter((_, idx) => idx <= messageIdx)
        .map((msg, idx) => (
          <div
            key={idx}
            className={`p-2 mb-2 rounded ${
              idx === messageIdx && isPlaying
                ? "bg-primary text-white"
                : msg.played
                ? "bg-white border opacity-75"
                : "bg-white border"
            }`}
          >
            {msg.text}
          </div>
        ))}
      <div ref={messagesEndRef} />
    </div>
  );
};
