import { useGlobalState } from "../../../state/useGlobalState";

interface FilenameBoxProps {
  fileName: string;
}

export const FilenameBox = ({ fileName }: FilenameBoxProps) => {
  const { state } = useGlobalState();
  return (
    <div className="text-center">
      <div className="spinner-border text-primary mb-3"></div>
      <p className="mb-3">
        <strong>{state.status.toUpperCase()}</strong>
        <span className="d-block text-secondary">
          {fileName || "No file selected"}
        </span>
      </p>
    </div>
  );
};
