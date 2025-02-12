import { FaStop } from "react-icons/fa";
import { useGlobalState } from "../../state/useGlobalState";

interface PlayingBoxProps {
  onStop: () => void;
}

export const PlayingBox = ({ onStop }: PlayingBoxProps) => {
  const { state } = useGlobalState();

  return (
    <div className="d-flex align-items-center gap-2 justify-content-center">
      {state.isPlaying && (
        <button
          role="button"
          onClick={onStop}
          className="btn btn-link text-danger p-0 d-flex align-items-center gap-2"
        >
          <FaStop />
          <span>Click here to stop</span>
        </button>
      )}
    </div>
  );
};
