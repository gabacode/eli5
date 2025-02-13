import { useCallback, useRef, useEffect } from "react";
import { useGlobalState } from "../state/useGlobalState";
import { AudioAnalyzer } from "../components/AudioVisualizer/Analyzer";

interface UseAudioProps {
  wsRef: React.RefObject<WebSocket | null>;
}

interface UseAudioReturn {
  playNext: () => Promise<void>;
  skipAudio: () => void;
  analyzerRef: React.MutableRefObject<AudioAnalyzer | null>;
  audioContextRef: React.RefObject<AudioContext | null>;
}

export const useAudio = ({ wsRef }: UseAudioProps): UseAudioReturn => {
  const { state, dispatch } = useGlobalState();
  const audioContextRef = useRef<AudioContext | null>(null);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const analyzerRef = useRef<AudioAnalyzer | null>(null);

  useEffect(() => {
    audioContextRef.current = new window.AudioContext();

    if (audioContextRef.current) {
      analyzerRef.current = new AudioAnalyzer(audioContextRef.current);
    }

    const ws = wsRef.current;
    return () => {
      if (ws) ws.close();
      if (audioContextRef.current) audioContextRef.current.close();
      if (analyzerRef.current) analyzerRef.current.cleanup();
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
      if (!state.isPlaying) {
        dispatch({ type: "SET_IS_PLAYING", isPlaying: true });
      }

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

      if (!analyzerRef.current && audioContextRef.current) {
        analyzerRef.current = new AudioAnalyzer(audioContextRef.current);
        console.log("Created new analyzer:", analyzerRef.current);
      }
      const gainNode = audioContextRef.current.createGain();
      gainNode.gain.value = 1.0;

      if (analyzerRef.current) {
        const analyzerNode = analyzerRef.current.getAnalyzerNode();
        try {
          source.disconnect();
          analyzerNode.disconnect();
          gainNode.disconnect();
        } catch (e) {
          console.log(e);
        }
        source.connect(analyzerNode);
        analyzerNode.connect(gainNode);
        gainNode.connect(audioContextRef.current.destination);
      } else {
        console.warn(
          "No analyzer available, connecting source directly to gain"
        );
        source.connect(gainNode);
        gainNode.connect(audioContextRef.current.destination);
      }

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
    analyzerRef,
    audioContextRef,
  };
};
