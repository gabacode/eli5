import { Status } from "../../utils/types";

interface IMessageFooter {
  status: Status;
  isPlaying: boolean;
  audioQueue: ArrayBuffer[];
  skipCurrent: () => void;
}

export const MessageFooter = ({
  status,
  isPlaying,
  audioQueue,
  skipCurrent,
}: IMessageFooter) => (
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
      <span className="badge bg-secondary">{audioQueue.length} in queue</span>
    )}
  </div>
);
