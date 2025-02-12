import { useGlobalState } from "../../state/useGlobalState";

interface IMessageBox {
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
}

export const MessageBox = ({ messagesEndRef }: IMessageBox) => {
  const { state } = useGlobalState();
  return (
    <div
      className="p-3 bg-light rounded"
      style={{ maxHeight: "400px", overflowY: "auto" }}
    >
      {state.messages
        .filter((_, idx) => idx <= state.messageIdx)
        .map((msg, idx) => (
          <div
            key={idx}
            className={`p-2 mb-2 rounded ${
              idx === state.messageIdx && state.isPlaying
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
