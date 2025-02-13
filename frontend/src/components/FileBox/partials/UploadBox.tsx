import { ChangeEvent } from "react";
import { useGlobalState } from "../../../state/useGlobalState";

interface UploadBoxProps {
  onFileChange: (file: File) => void;
}

export const UploadBox = ({ onFileChange }: UploadBoxProps) => {
  const { state } = useGlobalState();

  const buttonClass = state.status === "processing" ? "disabled" : "";

  const handleFileInput = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) onFileChange(file);
  };

  return (
    <div>
      <i className="bi bi-cloud-upload fs-1 text-primary mb-3 d-block"></i>
      <p className="mb-3">
        <strong>Click to upload</strong> or drag and drop a text file
      </p>
      <input
        id="fileInput"
        type="file"
        className="d-none"
        accept=".txt, .pdf"
        onChange={handleFileInput}
        disabled={state.status === "processing"}
      />
      <label htmlFor="fileInput" className={`btn btn-primary ${buttonClass}`}>
        Choose File
      </label>
    </div>
  );
};
