export type Message = {
  text: string;
  played: boolean;
};

export type Status = "idle" | "uploading" | "processing" | "completed";
