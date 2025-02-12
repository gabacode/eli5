import { useState } from "react";
import { useGlobalState } from "../state/useGlobalState";

interface IUseWs {
  wsRef: React.RefObject<WebSocket | null>;
  setAudioQueue: React.Dispatch<React.SetStateAction<ArrayBuffer[]>>;
}

export const useWebSocket = ({ wsRef, setAudioQueue }: IUseWs) => {
  const { state, dispatch } = useGlobalState();
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
      dispatch({
        type: "SET_STATUS",
        status: state.status === "processing" ? "completed" : "idle",
      });
    };

    ws.onerror = (error: Event) => {
      console.error("WebSocket error:", error);
      dispatch({
        type: "SET_STATUS",
        status: "idle",
      });
    };

    ws.onmessage = async (event: MessageEvent) => {
      const data = JSON.parse(event.data);
      if (data.type === "text") {
        dispatch({
          type: "ADD_MESSAGE",
          message: { text: data.content, played: false },
        });
      } else if (data.type === "audio") {
        const audioBuffer = base64ToBuffer(data.content);
        setAudioQueue((prev) => [...prev, audioBuffer]);
      } else if (data.type === "error") {
        console.error("Server error:", data.content);
        dispatch({
          type: "SET_STATUS",
          status: "idle",
        });
      }
    };
  };

  return { connectWebSocket, isConnected };
};
