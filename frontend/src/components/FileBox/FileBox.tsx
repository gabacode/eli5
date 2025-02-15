import { RefObject, useState } from "react";
import { UploadBox } from "./partials/UploadBox";
import { FilenameBox } from "./partials/FilenameBox";
import { useWebSocket } from "../../hooks";
import { useDragAndDrop } from "../../hooks/useDragAndDrop";

interface FileBoxProps {
  wsRef: RefObject<WebSocket | null>;
  onStart: () => void;
}

export const FileBox = ({ wsRef, onStart }: FileBoxProps) => {
  const { uploadFile } = useWebSocket({ wsRef });
  const [file, setFile] = useState<File | null>(null);

  const onDropped = async (file: File) => {
    try {
      onStart();
      uploadFile(file);
    } catch (error) {
      console.error("Error uploading file:", error);
    }
  };

  const { isDragging, onDrop, onDragOver, onDragEnter, onDragLeave } =
    useDragAndDrop({ setFile, onDropped });

  return (
    <div
      id="fileBox"
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDragEnter={onDragEnter}
      className={isDragging ? "dragging" : ""}
    >
      {file ? (
        <FilenameBox fileName={file.name} />
      ) : (
        <UploadBox
          onFileChange={(selectedFile) => {
            setFile(selectedFile);
            onDropped(selectedFile);
          }}
        />
      )}
    </div>
  );
};
