import { useState } from "react";
import { Message, Status } from "../utils/types";

interface IUseWs {
  wsRef: React.RefObject<WebSocket | null>;
  setStatus: React.Dispatch<React.SetStateAction<Status>>;
  setAudioQueue: React.Dispatch<React.SetStateAction<ArrayBuffer[]>>;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
}

export const useWebSocket = ({
  wsRef,
  setStatus,
  setAudioQueue,
  setMessages,
}: IUseWs) => {
  const [isConnected, setIsConnected] = useState(false);

  const base64ToBuffer = (base64: string): ArrayBuffer => {
    const binaryString = window.atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  };

  const connectWebSocket = () => {
    if (wsRef.current) wsRef.current.close();

    const ws = new WebSocket("ws://localhost:8765");
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("WebSocket connected");
      setIsConnected(true);
    };

    ws.onclose = () => {
      console.log("WebSocket disconnected");
      setIsConnected(false);
      setStatus((prev) => (prev === "processing" ? "completed" : "idle"));
    };

    ws.onerror = (error: Event) => {
      console.error("WebSocket error:", error);
      setStatus("idle");
    };

    ws.onmessage = async (event: MessageEvent) => {
      const data = JSON.parse(event.data);
      if (data.type === "text") {
        setMessages((prev) => [...prev, { text: data.content, played: false }]);
      } else if (data.type === "audio") {
        const audioBuffer = base64ToBuffer(data.content);
        setAudioQueue((prev) => [...prev, audioBuffer]);
      } else if (data.type === "error") {
        console.error("Server error:", data.content);
        setStatus("idle");
      }
    };
  };

  return { connectWebSocket, isConnected };
};
