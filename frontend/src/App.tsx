import { useCallback, useEffect, useRef } from "react";
import { FileBox, StatusBar, MessageBox, MessageFooter } from "./components";
import { useAudio, useWebSocket } from "./hooks";
import { useGlobalState } from "./state/useGlobalState";
import { AudioVisualizer } from "./components/AudioVisualizer";

const TTSWebSocket = () => {
  const { state, dispatch } = useGlobalState();

  const wsRef = useRef<WebSocket | null>(null);

  const { playNext, skipAudio } = useAudio({ wsRef });
  const { connectWebSocket, isConnected } = useWebSocket({ wsRef });

  const initState = useCallback(() => {
    dispatch({ type: "SET_STATUS", status: "uploading" });
    dispatch({ type: "SET_MESSAGES", messages: [] });
    dispatch({ type: "SET_AUDIO_QUEUE", queue: [] });
    dispatch({ type: "SET_MSG_IDX", index: 0 });
    if (!isConnected) {
      connectWebSocket();
    }
  }, [dispatch, isConnected, connectWebSocket]);

  const stopPlayback = () => {
    wsRef.current?.close();
    dispatch({ type: "SET_STATUS", status: "idle" });
    dispatch({ type: "SET_AUDIO_QUEUE", queue: [] });
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
        const timeoutId = setTimeout(() => {
          wsRef.current?.close();
        }, 10000);
        return () => clearTimeout(timeoutId);
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
              <div className="mb-2">
                <div className="text-center border rounded bg-light">
                  {state.isPlaying ? (
                    <AudioVisualizer />
                  ) : (
                    <FileBox wsRef={wsRef} onStart={initState} />
                  )}
                </div>
              </div>
              {state.messages.length > 0 && (
                <div className="mt-2">
                  <MessageBox />
                  <MessageFooter
                    skipAudio={skipAudio}
                    stopAudio={stopPlayback}
                  />
                </div>
              )}
              <StatusBar />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TTSWebSocket;
