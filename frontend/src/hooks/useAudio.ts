import { useState, useCallback, useRef, useEffect } from "react";
import { useGlobalState } from "../state/useGlobalState";

interface UseAudioProps {
  wsRef: React.RefObject<WebSocket | null>;
  onEnd: () => void;
}

export const useAudio = ({ wsRef, onEnd }: UseAudioProps) => {
  const { state, dispatch } = useGlobalState();
  const [audioQueue, setAudioQueue] = useState<ArrayBuffer[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);

  useEffect(() => {
    audioContextRef.current = new (window.AudioContext ||
      window.AudioContext)();
    const ws = wsRef.current;
    return () => {
      if (ws) ws.close();
      if (audioContextRef.current) audioContextRef.current.close();
    };
  }, [wsRef]);

  const skipCurrent = useCallback(() => {
    if (!currentSourceRef.current) return;
    currentSourceRef.current.onended = null;
    try {
      currentSourceRef.current.stop();
    } catch (e) {
      console.error("Error stopping audio:", e);
    }
    try {
      currentSourceRef.current.disconnect();
    } catch (e) {
      console.error("Error disconnecting audio:", e);
    }
    currentSourceRef.current = null;
    onEnd();
    setAudioQueue((prev) => prev.slice(1));
    dispatch({ type: "SET_IS_PLAYING", isPlaying: false });
  }, [dispatch, onEnd]);

  const playNextAudio = useCallback(async () => {
    if (audioQueue.length === 0 || state.isPlaying) return;

    try {
      dispatch({ type: "SET_IS_PLAYING", isPlaying: true });
      const audioData = audioQueue[0];

      if (!audioContextRef.current) {
        console.error("No audio context available");
        return;
      }

      const audioBuffer = await audioContextRef.current.decodeAudioData(
        audioData.slice(0)
      );
      const source = audioContextRef.current.createBufferSource();

      if (currentSourceRef.current) {
        try {
          currentSourceRef.current.disconnect();
        } catch (e) {
          console.error("Error disconnecting previous source:", e);
        }
      }

      currentSourceRef.current = source;
      source.buffer = audioBuffer;
      source.connect(audioContextRef.current.destination);

      source.onended = () => {
        source.disconnect();
        dispatch({ type: "SET_IS_PLAYING", isPlaying: false });
        setAudioQueue((prev) => prev.slice(1));
        onEnd();
        currentSourceRef.current = null;
      };

      source.start(0);
    } catch (error) {
      console.error("Error playing audio:", error);
      dispatch({ type: "SET_IS_PLAYING", isPlaying: false });
      setAudioQueue((prev) => prev.slice(1));
      dispatch({ type: "SET_MSG_IDX", index: state.messageIdx + 1 });
      currentSourceRef.current = null;
    }
  }, [audioQueue, dispatch, onEnd, state.isPlaying, state.messageIdx]);

  return {
    audioQueue,
    playNextAudio,
    skipCurrent,
    setAudioQueue,
  };
};
