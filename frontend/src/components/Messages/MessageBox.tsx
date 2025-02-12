import { useMemo } from "react";
import { useGlobalState } from "../../state/useGlobalState";
import { Message } from "../../utils/types";

export const MessageBox = () => {
  const { state } = useGlobalState();

  const getMessageStyle = (msg: Message, actualIdx: number) => {
    if (actualIdx === state.messageIdx && state.isPlaying) {
      return "bg-primary text-white";
    }
    return msg.played ? "bg-white border opacity-75" : "bg-white border";
  };

  const messages = useMemo(() => {
    return state.messages.slice(0, state.messageIdx + 1).reverse();
  }, [state.messages, state.messageIdx]);

  return (
    <div className="p-3 bg-light rounded d-flex flex-column overflow-auto h-256 border">
      {messages.map((msg, reversedIdx, arr) => {
        const actualIdx = arr.length - 1 - reversedIdx;
        return (
          <div
            key={actualIdx}
            className={`p-2 mb-2 rounded ${getMessageStyle(msg, actualIdx)}`}
          >
            {msg.text}
          </div>
        );
      })}
    </div>
  );
};
