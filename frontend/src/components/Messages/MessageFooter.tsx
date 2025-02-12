import { useGlobalState } from "../../state/useGlobalState";

interface IMessageFooter {
  skipAudio: () => void;
}

export const MessageFooter = ({ skipAudio }: IMessageFooter) => {
  const { state } = useGlobalState();

  const renderStatue = () => {
    if (state.status === "completed") {
      return "Processing complete";
    } else if (state.isPlaying) {
      return "Playing audio...";
    } else if (state.audioQueue.length > 0) {
      return "Waiting for next segment...";
    }
  };

  return (
    <div className="mt-2 d-flex justify-content-between align-items-center">
      <div className="d-flex align-items-center gap-3">
        <span className="text-muted small">
          {state.status === "idle" ? "Idle" : renderStatue()}
        </span>
        {(state.isPlaying || state.audioQueue.length > 0) && (
          <button
            className="btn btn-sm btn-outline-secondary"
            onClick={skipAudio}
          >
            Skip
          </button>
        )}
      </div>
      {state.audioQueue.length > 0 && (
        <span className="badge bg-secondary">
          {state.audioQueue.length} in queue
        </span>
      )}
    </div>
  );
};
