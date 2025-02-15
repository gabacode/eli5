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

  const pasteText = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const blob = new Blob([text], { type: "text/plain" });
      const file = new File([blob], "clipboard.txt");
      onFileChange(file);
    } catch (error) {
      console.error("Failed to read clipboard:", error);
    }
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
      <div>
        <label htmlFor="fileInput" className={`btn btn-primary ${buttonClass}`}>
          Choose File
        </label>
      </div>
      <div className="small my-2">
        <span>or</span>
      </div>
      <div>
        <button
          className="btn btn-primary"
          onClick={pasteText}
          disabled={state.status === "processing"}
        >
          Paste Text
        </button>
      </div>
    </div>
  );
};
