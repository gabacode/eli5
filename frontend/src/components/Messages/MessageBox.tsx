import { useEffect, useRef } from "react";
import { useGlobalState } from "../../state/useGlobalState";
import { Message } from "../../utils/types";

export const MessageBox = () => {
  const { state } = useGlobalState();
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const getMessageStyle = (msg: Message, idx: number) => {
    if (idx === state.messageIdx && state.isPlaying) {
      return "bg-primary text-white";
    }
    return msg.played ? "bg-white border opacity-75" : "bg-white border";
  };

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [state.messageIdx, state.messages]);

  return (
    <div
      className="p-3 bg-light rounded"
      style={{ maxHeight: "256px", overflowY: "auto" }}
    >
      {state.messages
        .filter((_, idx) => idx <= state.messageIdx)
        .map((msg, idx) => (
          <div
            key={idx}
            className={`p-2 mb-2 rounded ${getMessageStyle(msg, idx)}`}
          >
            {msg.text}
          </div>
        ))}
      <div ref={messagesEndRef} />
    </div>
  );
};
