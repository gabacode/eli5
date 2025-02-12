import { useGlobalState } from "../../state/useGlobalState";

export const StatusBar = () => {
  const { state } = useGlobalState();
  return (
    state.status !== "idle" &&
    state.status !== "completed" && (
      <div className="alert alert-info d-flex align-items-center">
        <div className="spinner-border spinner-border-sm me-2" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        {state.status === "uploading"
          ? "Uploading file..."
          : "Processing text..."}
      </div>
    )
  );
};
