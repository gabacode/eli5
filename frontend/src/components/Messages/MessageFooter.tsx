import { useGlobalState } from "../../state/useGlobalState";
import { FaPlay, FaPause, FaBackward, FaForward } from "react-icons/fa";

interface IMessageFooter {
  skipAudio: () => void;
  stopAudio: () => void;
}

export const MessageFooter = ({ skipAudio, stopAudio }: IMessageFooter) => {
  const { state } = useGlobalState();

  const handleForwardClick = () => {
    skipAudio();
  };

  const handleStopClick = () => {
    stopAudio();
  };

  return (
    <div className="d-flex justify-content-center align-items-center mt-3 mb-3">
      <div className="d-flex align-items-center gap-3">
        <FaBackward
          style={styles.icon}
          onClick={() => console.log("Backward functionality")}
        />
        {state.isPlaying ? (
          <FaPause style={styles.icon} onClick={handleStopClick} />
        ) : (
          <FaPlay
            style={styles.icon}
            onClick={() => console.log("Play functionality")}
          />
        )}
        <FaForward style={styles.icon} onClick={handleForwardClick} />
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
