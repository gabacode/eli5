import { ChangeEvent } from "react";
import { useGlobalState } from "../../state/useGlobalState";

interface FileBoxProps {
  wsRef: React.RefObject<WebSocket | null>;
  onStart: () => void;
}

export const FileBox = ({ wsRef, onStart }: FileBoxProps) => {
  const { state, dispatch } = useGlobalState();

  const handleFileUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      onStart();
      const content = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = (e) => reject(e);
        reader.readAsText(file);
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
    </div>
  );
};
