import { useState, useEffect, useRef, ChangeEvent } from "react";
import { useAudio } from "./hooks/useAudio";
import { Message } from "./utils/types";
import { FileBox } from "./components/FileBox";
import { StatusBar } from "./components/StatusBar";
import { MessageBox } from "./components/Messages/MessageBox";
import { MessageFooter } from "./components/Messages/MessageFooter";
import { useWebSocket } from "./hooks/useWebSocket";
import { useGlobalState } from "./state/useGlobalState";

const TTSWebSocket = () => {
  const { state, dispatch } = useGlobalState();
  const [messages, setMessages] = useState<Message[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const handleAudioEnd = () => {
    setMessages((prev) => {
      const newMessages = [...prev];
      if (newMessages[state.messageIdx]) {
        newMessages[state.messageIdx].played = true;
      }
      return newMessages;
    });
    dispatch({ type: "SET_MSG_IDX", index: state.messageIdx + 1 });
  };

  const { playNextAudio, skipCurrent, audioQueue, setAudioQueue } = useAudio({
    wsRef,
    onEnd: handleAudioEnd,
  });

  const { connectWebSocket, isConnected } = useWebSocket({
    wsRef,
    setAudioQueue,
    setMessages,
  });

  const initState = () => {
    dispatch({ type: "SET_STATUS", status: "uploading" });
    setMessages([]);
    setAudioQueue([]);
    dispatch({ type: "SET_MSG_IDX", index: 0 });
    if (!isConnected) {
      connectWebSocket();
    }
  };

  useEffect(() => {
    if (audioQueue.length > 0 && !state.isPlaying) {
      playNextAudio();
    } else if (
      audioQueue.length === 0 &&
      messages.length > 0 &&
      state.status === "processing"
    ) {
      const allPlayed = messages.every((msg) => msg.played);
      if (allPlayed) {
        dispatch({ type: "SET_STATUS", status: "completed" });
      }
    }
  }, [
    audioQueue.length,
    dispatch,
    messages,
    playNextAudio,
    state.isPlaying,
    state.status,
  ]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleFileUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      initState();
      const content = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = (e) => reject(e);
        reader.readAsText(file);
      });
      while (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      wsRef.current.send(JSON.stringify({ content }));
      dispatch({ type: "SET_STATUS", status: "processing" });
    } catch (error) {
      console.error("Error handling file:", error);
      dispatch({ type: "SET_STATUS", status: "idle" });
    }
  };

  return (
    <div className="container py-5">
      <div className="row justify-content-center">
        <div className="col-md-8">
          <div className="card shadow-sm">
            <div className="card-header bg-primary text-white">
              <h5 className="card-title mb-0">ELI5</h5>
            </div>
            <div className="card-body">
              <FileBox handleFileUpload={handleFileUpload} />
              <StatusBar />
              {messages.length > 0 && (
                <div className="mt-4">
                  <MessageBox
                    messages={messages}
                    messagesEndRef={messagesEndRef}
                  />
                  <MessageFooter
                    audioQueue={audioQueue}
                    skipCurrent={skipCurrent}
                  />
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
