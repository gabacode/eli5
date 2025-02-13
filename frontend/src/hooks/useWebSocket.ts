import { useState } from "react";
import { useGlobalState } from "../state/useGlobalState";

interface IUseWs {
  wsRef: React.RefObject<WebSocket | null>;
}

export const useWebSocket = ({ wsRef }: IUseWs) => {
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

  const waitForWebSocket = async (timeout = 5000) => {
    const start = Date.now();
    while (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      if (Date.now() - start > timeout) {
        throw new Error("WebSocket connection timeout");
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  };

  const connectWebSocket = () => {
    if (wsRef.current) wsRef.current.close();

    const ws = new WebSocket("ws://localhost:8765");
    (wsRef.current as WebSocket | null) = ws;

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
      throw new Error("WebSocket encountered an error");
    };

    ws.onmessage = async (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "text") {
          dispatch({
            type: "ADD_MESSAGE",
            message: { text: data.content, played: false },
          });
        } else if (data.type === "audio") {
          const audioBuffer = base64ToBuffer(data.content);
          dispatch({
            type: "ADD_TO_AUDIO_QUEUE",
            audio: audioBuffer,
          });
        } else if (data.type === "error") {
          throw new Error(`Server error: ${data.content}`);
        }
      } catch (error) {
        console.error("WebSocket message processing error:", error);
        dispatch({ type: "SET_STATUS", status: "idle" });
      }
    };
  };

  const sendMessage = async (message: object) => {
    try {
      await waitForWebSocket();
      if (!wsRef.current) throw new Error("WebSocket is not connected");

      wsRef.current.send(JSON.stringify(message));
    } catch (error) {
      console.error("WebSocket send error:", error);
      throw error;
    }
  };

  const uploadFile = async (file: File) => {
    try {
      const content = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const base64String = e.target?.result as string;
          resolve(base64String.split(",")[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      await sendMessage({ content });
      dispatch({ type: "SET_STATUS", status: "processing" });
    } catch (error) {
      console.error("Error handling file:", error);
      dispatch({ type: "SET_STATUS", status: "idle" });
    }
  };

  return { connectWebSocket, uploadFile, isConnected };
};
