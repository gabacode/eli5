import { Status } from "../utils/types";

interface StatusBarProps {
  status: Status;
}

export const StatusBar = ({ status }: StatusBarProps) =>
  status !== "idle" &&
  status !== "completed" && (
    <div className="alert alert-info d-flex align-items-center">
      <div className="spinner-border spinner-border-sm me-2" role="status">
        <span className="visually-hidden">Loading...</span>
      </div>
      {status === "uploading" ? "Uploading file..." : "Processing text..."}
    </div>
  );
