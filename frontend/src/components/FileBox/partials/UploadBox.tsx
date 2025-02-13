import { useGlobalState } from "../../../state/useGlobalState";

interface UploadBoxProps {
  handleFileInput: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

export const UploadBox = ({ handleFileInput }: UploadBoxProps) => {
  const { state } = useGlobalState();

  const buttonClass = state.status === "processing" ? "disabled" : "";

  return (
    <div>
      <i className="bi bi-cloud-upload fs-1 text-primary mb-3 d-block"></i>
      <p className="mb-3">
        <strong>Click to upload</strong> or drag and drop a text file
      </p>
      <input
        type="file"
        className="d-none"
        accept=".txt, .pdf"
        onChange={handleFileInput}
        id="fileInput"
        disabled={state.status === "processing"}
      />
      <label htmlFor="fileInput" className={`btn btn-primary ${buttonClass}`}>
        Choose File
      </label>
    </div>
  );
};
