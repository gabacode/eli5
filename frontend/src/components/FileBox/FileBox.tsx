import { ChangeEvent, DragEvent, useState } from "react";
import { useGlobalState } from "../../state/useGlobalState";
import { UploadBox } from "./partials/UploadBox";
import { FilenameBox } from "./partials/FilenameBox";
import { useWebSocket } from "../../hooks";

interface FileBoxProps {
  wsRef: React.RefObject<WebSocket | null>;
  onStart: () => void;
}

export const FileBox = ({ wsRef, onStart }: FileBoxProps) => {
  const { dispatch } = useGlobalState();
  const { sendMessage } = useWebSocket({ wsRef });
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileUpload = async (file: File) => {
    if (!file) return;
    setFile(file);

    try {
      onStart();
      const content = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const base64String = e.target?.result as string;
          resolve(base64String.split(",")[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      await sendMessage({ content });
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

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const handleDragEnter = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  return (
    <div
      id="fileBox"
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={isDragging ? "dragging" : ""}
    >
      {file ? (
        <FilenameBox fileName={file.name} />
      ) : (
        <UploadBox handleFileInput={handleFileInput} />
      )}
    </div>
  );
};
