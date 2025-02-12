import { ChangeEvent, DragEvent, useState } from "react";
import { useGlobalState } from "../../state/useGlobalState";

interface FileBoxProps {
  wsRef: React.RefObject<WebSocket | null>;
  onStart: () => void;
}

export const FileBox = ({ wsRef, onStart }: FileBoxProps) => {
  const { state, dispatch } = useGlobalState();
  const [isDragging, setIsDragging] = useState(false);

  const handleFileUpload = async (file: File) => {
    if (!file) return;
    try {
      onStart();
      const content = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const base64String = e.target?.result as string;
          resolve(base64String.split(",")[1]);
        };
        reader.onerror = (e) => reject(e);
        reader.readAsDataURL(file);
      });

      while (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      wsRef.current.send(JSON.stringify({ content }));
      dispatch({ type: "SET_STATUS", status: "processing" });
    } catch (error) {
      console.error("Error handling file:", error);
      dispatch({ type: "SET_STATUS", status: "idle" });
    }
  };

  const handleFileInput = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) handleFileUpload(file);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);

    const file = event.dataTransfer.files?.[0];
    if (file) handleFileUpload(file);
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragEnter={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      className={`file-drop-area ${isDragging ? "dragging" : ""}`}
      style={{
        border: isDragging ? "2px dashed #007bff" : "2px dashed transparent",
        padding: "20px",
        textAlign: "center",
        transition: "border 0.2s ease-in-out",
      }}
    >
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
      <label
        htmlFor="fileInput"
        className={`btn btn-primary ${
          state.status === "processing" ? "disabled" : ""
        }`}
      >
        Choose File
      </label>
    </div>
  );
};
