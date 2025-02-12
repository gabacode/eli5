import { useState, useEffect, useRef, ChangeEvent } from "react";
import { useAudio } from "./hooks/useAudio";
import { Message, Status } from "./utils/types";
import { FileBox } from "./components/FileBox";
import { StatusBar } from "./components/StatusBar";
import { MessageBox } from "./components/Messages/MessageBox";
import { MessageFooter } from "./components/Messages/MessageFooter";
import { useWebSocket } from "./hooks/useWebSocket";

const TTSWebSocket = () => {
  const [status, setStatus] = useState<Status>("idle");
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageIdx, setMessageIdx] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const handleAudioEnd = () => {
    setMessages((prev) => {
      const newMessages = [...prev];
      if (newMessages[messageIdx]) {
        newMessages[messageIdx].played = true;
      }
      return newMessages;
    });
    setMessageIdx((prev) => prev + 1);
  };

  const handleAudioError = () => {
    setMessageIdx((prev) => prev + 1);
  };

  const { playNextAudio, skipCurrent, audioQueue, isPlaying, setAudioQueue } =
    useAudio({
      wsRef,
      onEnd: handleAudioEnd,
      onError: handleAudioError,
    });

  const { connectWebSocket, isConnected } = useWebSocket({
    wsRef,
    setStatus,
    setAudioQueue,
    setMessages,
  });

  useEffect(() => {
    if (audioQueue.length > 0 && !isPlaying) {
      playNextAudio();
    } else if (
      audioQueue.length === 0 &&
      messages.length > 0 &&
      status === "processing"
    ) {
      const allPlayed = messages.every((msg) => msg.played);
      if (allPlayed) setStatus("completed");
    }
  }, [audioQueue.length, isPlaying, messages, playNextAudio, status]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const initState = () => {
    setStatus("uploading");
    setMessages([]);
    setAudioQueue([]);
    setMessageIdx(0);
  };

  const handleFileUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      initState();
      if (!isConnected) {
        connectWebSocket();
      }
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
      setStatus("processing");
    } catch (error) {
      console.error("Error handling file:", error);
      setStatus("idle");
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
              <FileBox status={status} handleFileUpload={handleFileUpload} />
              <StatusBar status={status} />
              {messages.length > 0 && (
                <div className="mt-4">
                  <MessageBox
                    messages={messages}
                    isPlaying={isPlaying}
                    messageIdx={messageIdx}
                    messagesEndRef={messagesEndRef}
                  />
                  <MessageFooter
                    status={status}
                    isPlaying={isPlaying}
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
