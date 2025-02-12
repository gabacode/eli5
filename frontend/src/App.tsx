import { useEffect, useRef } from "react";
import { useAudio } from "./hooks/useAudio";
import { FileBox } from "./components/FileBox";
import { StatusBar } from "./components/StatusBar";
import { MessageBox } from "./components/Messages/MessageBox";
import { MessageFooter } from "./components/Messages/MessageFooter";
import { useWebSocket } from "./hooks/useWebSocket";
import { useGlobalState } from "./state/useGlobalState";

const TTSWebSocket = () => {
  const { state, dispatch } = useGlobalState();

  const wsRef = useRef<WebSocket | null>(null);

  const { playNext, skipAudio } = useAudio({ wsRef });
  const { connectWebSocket, isConnected } = useWebSocket({ wsRef });

  const initState = () => {
    dispatch({ type: "SET_STATUS", status: "uploading" });
    dispatch({ type: "SET_MESSAGES", messages: [] });
    dispatch({ type: "SET_AUDIO_QUEUE", queue: [] });
    dispatch({ type: "SET_MSG_IDX", index: 0 });
    if (!isConnected) {
      connectWebSocket();
    }
  };

  useEffect(() => {
    if (state.audioQueue.length > 0 && !state.isPlaying) {
      playNext();
    } else if (
      state.audioQueue.length === 0 &&
      state.messages.length > 0 &&
      state.status === "processing"
    ) {
      const allPlayed = state.messages.every((msg) => msg.played);
      if (allPlayed) {
        dispatch({ type: "SET_STATUS", status: "completed" });
      }
    }
  }, [
    state.audioQueue.length,
    dispatch,
    state.messages,
    playNext,
    state.isPlaying,
    state.status,
  ]);

  return (
    <div className="container py-5">
      <div className="row justify-content-center">
        <div className="col-md-8">
          <div className="card shadow-sm">
            <div className="card-header bg-primary text-white">
              <h5 className="card-title mb-0">ELI5</h5>
            </div>
            <div className="card-body">
              <FileBox wsRef={wsRef} onStart={initState} />
              <StatusBar />
              {state.messages.length > 0 && (
                <div className="mt-4">
                  <MessageBox />
                  <MessageFooter skipAudio={skipAudio} />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TTSWebSocket;
