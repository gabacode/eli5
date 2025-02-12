import { Status } from "../utils/types";

interface FileBoxProps {
  status: Status;
  handleFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

export const FileBox = ({ status, handleFileUpload }: FileBoxProps) => {
  return (
    <div className="mb-4">
      <div className="text-center p-4 border rounded bg-light">
        <i className="bi bi-cloud-upload fs-1 text-primary mb-3 d-block"></i>
        <p className="mb-3">
          <strong>Click to upload</strong> or drag and drop a text file
        </p>
        <input
          type="file"
          className="d-none"
          accept=".txt"
          onChange={handleFileUpload}
          id="fileInput"
          disabled={status === "processing"}
        />
        <label
          htmlFor="fileInput"
          className={`btn btn-primary ${
            status === "processing" ? "disabled" : ""
          }`}
        >
          Choose File
        </label>
      </div>
    </div>
  );
};
