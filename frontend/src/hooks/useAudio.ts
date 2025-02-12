import { useCallback, useRef, useEffect } from "react";
import { useGlobalState } from "../state/useGlobalState";

interface UseAudioProps {
  wsRef: React.RefObject<WebSocket | null>;
}

export const useAudio = ({ wsRef }: UseAudioProps) => {
  const { state, dispatch } = useGlobalState();
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

  const onEnd = useCallback(() => {
    dispatch({ type: "MARK_PLAYED", index: state.messageIdx });
    dispatch({ type: "SET_MSG_IDX", index: state.messageIdx + 1 });
  }, [dispatch, state.messageIdx]);

  const skipAudio = useCallback(() => {
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
    dispatch({ type: "REMOVE_FIRST_AUDIO" });
    dispatch({ type: "SET_IS_PLAYING", isPlaying: false });
  }, [dispatch, onEnd]);

  const playNext = useCallback(async () => {
    if (state.audioQueue.length === 0 || state.isPlaying) return;

    try {
      dispatch({ type: "SET_IS_PLAYING", isPlaying: true });
      const audioData = state.audioQueue[0];

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
        dispatch({ type: "REMOVE_FIRST_AUDIO" });
        onEnd();
        currentSourceRef.current = null;
      };

      source.start(0);
    } catch (error) {
      console.error("Error playing audio:", error);
      dispatch({ type: "SET_IS_PLAYING", isPlaying: false });
      dispatch({ type: "REMOVE_FIRST_AUDIO" });
      dispatch({ type: "SET_MSG_IDX", index: state.messageIdx + 1 });
      currentSourceRef.current = null;
    }
  }, [dispatch, onEnd, state.audioQueue, state.isPlaying, state.messageIdx]);

  return {
    playNext,
    skipAudio,
  };
};
