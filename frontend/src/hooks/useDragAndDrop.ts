import { DragEvent, useState } from "react";

interface IDragAndDrop {
  onDropped: (file: File) => void;
}

export const useDragAndDrop = ({ onDropped }: IDragAndDrop) => {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);

    const file = event.dataTransfer.files?.[0];
    if (file) {
      setFile(file);
      onDropped(file);
    }
  };

  const onDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const onDragEnter = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => setIsDragging(false);

  return {
    file,
    isDragging,
    onDrop,
    onDragOver,
    onDragEnter,
    onDragLeave,
  };
};
