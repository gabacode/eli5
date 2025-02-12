import { useGlobalState } from "../../state/useGlobalState";
import { FaPlay, FaPause, FaBackward, FaForward } from "react-icons/fa";

interface IMessageFooter {
  skipAudio: () => void;
}

export const MessageFooter = ({ skipAudio }: IMessageFooter) => {
  const { state } = useGlobalState();

  const renderStatus = () => {
    if (state.status === "completed") {
      return "Processing complete";
    } else if (state.isPlaying) {
      return "Playing audio...";
    } else if (state.audioQueue.length > 0) {
      return "Waiting for next segment...";
    }
  };

  const handleForwardClick = () => {
    skipAudio(); // Call skipAudio when the forward button is clicked
  };

  return (
    <div className="mt-2 d-flex justify-content-between align-items-center">
      <div className="d-flex align-items-center gap-3">
        <span className="text-muted small">
          {state.status === "idle" ? "Idle" : renderStatus()}
        </span>
      </div>
      <div className="d-flex align-items-center gap-4">
        {/* Backward Button */}
        <FaBackward
          style={styles.icon}
          onClick={() => console.log("Backward functionality")}
        />

        {/* Play/Pause Button */}
        {state.isPlaying ? (
          <FaPause
            style={styles.icon}
            onClick={() => console.log("Pause functionality")}
          />
        ) : (
          <FaPlay
            style={styles.icon}
            onClick={() => console.log("Play functionality")}
          />
        )}

        {/* Forward Button */}
        <FaForward style={styles.icon} onClick={handleForwardClick} />
      </div>
      <div>
        {state.audioQueue.length > 0 && (
          <span className="badge bg-secondary">
            {state.audioQueue.length} in queue
          </span>
        )}
      </div>
    </div>
  );
};

const styles = {
  icon: {
    fontSize: "24px",
    cursor: "pointer",
    margin: "0 10px",
  },
};
