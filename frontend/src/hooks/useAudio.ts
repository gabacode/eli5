import { useState, useCallback, useRef, useEffect } from "react";

interface UseAudioProps {
  wsRef: React.RefObject<WebSocket | null>;
  onEnd: () => void;
  onError: () => void;
}

export const useAudio = ({ wsRef, onEnd, onError }: UseAudioProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
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
    setIsPlaying(false);
  }, [onEnd]);

  const playNextAudio = useCallback(async () => {
    if (audioQueue.length === 0 || isPlaying) return;

    try {
      setIsPlaying(true);
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
        setIsPlaying(false);
        setAudioQueue((prev) => prev.slice(1));
        onEnd();
        currentSourceRef.current = null;
      };

      source.start(0);
    } catch (error) {
      console.error("Error playing audio:", error);
      setIsPlaying(false);
      setAudioQueue((prev) => prev.slice(1));
      onError();
      currentSourceRef.current = null;
    }
  }, [audioQueue, isPlaying, onEnd, onError]);

  return {
    audioQueue,
    isPlaying,
    playNextAudio,
    skipCurrent,
    setAudioQueue,
  };
};
