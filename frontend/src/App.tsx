import React, { useState, useEffect, useRef, useCallback } from "react";

type Message = {
  text: string;
  played: boolean;
};

type Status = "idle" | "uploading" | "processing" | "completed";

const TTSWebSocket = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [audioQueue, setAudioQueue] = useState<ArrayBuffer[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);

  useEffect(() => {
    audioContextRef.current = new (window.AudioContext ||
      window.AudioContext)();
    return () => {
      if (wsRef.current) wsRef.current.close();
      if (audioContextRef.current) audioContextRef.current.close();
    };
  }, []);

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

      // Clean up any existing source
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
        // This callback will NOT fire if we manually clear it via skipCurrent.
        source.disconnect();
        setIsPlaying(false);
        setAudioQueue((prev) => prev.slice(1));
        setMessages((prev) => {
          const newMessages = [...prev];
          if (newMessages[currentMessageIndex]) {
            newMessages[currentMessageIndex].played = true;
          }
          return newMessages;
        });
        setCurrentMessageIndex((prev) => prev + 1);
        currentSourceRef.current = null;
      };

      source.start(0);
    } catch (error) {
      console.error("Error playing audio:", error);
      setIsPlaying(false);
      setAudioQueue((prev) => prev.slice(1));
      setCurrentMessageIndex((prev) => prev + 1);
      currentSourceRef.current = null;
    }
  }, [audioQueue, isPlaying, currentMessageIndex]);

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
  }, [audioQueue, isPlaying, messages, playNextAudio, status]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const skipCurrent = useCallback(() => {
    // Only proceed if there's an active audio source.
    if (!currentSourceRef.current) return;

    // Remove the onended callback so it doesn't trigger after stopping.
    currentSourceRef.current.onended = null;

    // Stop and disconnect the current audio.
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

    // Mark the current message as played.
    setMessages((prev) => {
      const newMessages = [...prev];
      if (newMessages[currentMessageIndex]) {
        newMessages[currentMessageIndex].played = true;
      }
      return newMessages;
    });

    // Remove the current audio from the queue.
    setAudioQueue((prev) => prev.slice(1));

    // Update playing state and move to the next message.
    setIsPlaying(false);
    setCurrentMessageIndex((prev) => prev + 1);
  }, [currentMessageIndex]);

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

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setStatus("uploading");
      setMessages([]);
      setAudioQueue([]);
      setCurrentMessageIndex(0);

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

  const base64ToBuffer = (base64: string): ArrayBuffer => {
    const binaryString = window.atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  };

  return (
    <div className="container py-5">
      <div className="row justify-content-center">
        <div className="col-md-8">
          <div className="card shadow-sm">
            <div className="card-header bg-primary text-white">
              <h5 className="card-title mb-0">Text to Speech Converter</h5>
            </div>
            <div className="card-body">
              <div className="mb-4">
                <div className="text-center p-4 border rounded bg-light">
                  <i className="bi bi-cloud-upload fs-1 text-primary mb-3 d-block"></i>
                  <p className="mb-3">
                    <strong>Click to upload</strong> or drag and drop a text
                    file
                  </p>
                  <input
                    type="file"
                    className="d-none"
                    accept=".txt"
                    onChange={handleFileUpload}
                    id="fileInput"
                    disabled={status === "processing"}
                  />
                  <label
                    htmlFor="fileInput"
                    className={`btn btn-primary ${
                      status === "processing" ? "disabled" : ""
                    }`}
                  >
                    Choose File
                  </label>
                </div>
              </div>

              {status !== "idle" && status !== "completed" && (
                <div className="alert alert-info d-flex align-items-center">
                  <div
                    className="spinner-border spinner-border-sm me-2"
                    role="status"
                  >
                    <span className="visually-hidden">Loading...</span>
                  </div>
                  {status === "uploading"
                    ? "Uploading file..."
                    : "Processing text..."}
                </div>
              )}

              {messages.length > 0 && (
                <div className="mt-4">
                  <div
                    className="p-3 bg-light rounded"
                    style={{ maxHeight: "400px", overflowY: "auto" }}
                  >
                    {messages
                      .filter((_, idx) => idx <= currentMessageIndex)
                      .map((msg, idx) => (
                        <div
                          key={idx}
                          className={`p-2 mb-2 rounded ${
                            idx === currentMessageIndex && isPlaying
                              ? "bg-primary text-white"
                              : msg.played
                              ? "bg-white border opacity-75"
                              : "bg-white border"
                          }`}
                        >
                          {msg.text}
                        </div>
                      ))}
                    <div ref={messagesEndRef} />
                  </div>

                  <div className="mt-2 d-flex justify-content-between align-items-center">
                    <div className="d-flex align-items-center gap-3">
                      <span className="text-muted small">
                        {status === "completed"
                          ? "Processing complete"
                          : isPlaying
                          ? "Playing audio..."
                          : audioQueue.length > 0
                          ? "Waiting for next segment..."
                          : ""}
                      </span>
                      {(isPlaying || audioQueue.length > 0) && (
                        <button
                          className="btn btn-sm btn-outline-secondary"
                          onClick={skipCurrent}
                        >
                          Skip
                        </button>
                      )}
                    </div>
                    {audioQueue.length > 0 && (
                      <span className="badge bg-secondary">
                        {audioQueue.length} in queue
                      </span>
                    )}
                  </div>
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
