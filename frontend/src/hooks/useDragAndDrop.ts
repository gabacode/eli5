import { DragEvent, useState } from "react";

interface IDragAndDrop {
  setFile: (file: File) => void;
  onDropped: (file: File) => void;
}

export const useDragAndDrop = ({ setFile, onDropped }: IDragAndDrop) => {
  const [isDragging, setIsDragging] = useState(false);

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);

    const selected = event.dataTransfer.files?.[0];
    if (selected) {
      setFile(selected);
      onDropped(selected);
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
    isDragging,
    onDrop,
    onDragOver,
    onDragEnter,
    onDragLeave,
  };
};
