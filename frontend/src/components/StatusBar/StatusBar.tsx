import { useGlobalState } from "../../state/useGlobalState";

const STATUS_MESSAGES = {
  idle: "",
  uploading: "Uploading files...",
  processing: "Processing text...",
  completed: "Completed!",
  playing: "Playing audio...",
} as const;

export const StatusBar = () => {
  const { state } = useGlobalState();

  const getCurrentStatus = () => (state.isPlaying ? "playing" : state.status);

  const status = getCurrentStatus();
  const message = STATUS_MESSAGES[status];
  const isLoading = status === "uploading" || status === "processing";

  return (
    <div className="d-flex align-items-center gap-2 small text-muted justify-content-between">
      <div>
        {isLoading && (
          <div
            className="spinner-border spinner-border-sm text-secondary me-2"
            role="status"
            aria-hidden="true"
          />
        )}
        <span className="fw-light">{message}</span>
      </div>
      {state.audioQueue.length > 0 && (
        <span className="badge bg-secondary ms-2">
          {state.audioQueue.length} in queue
        </span>
      )}
    </div>
  );
};
