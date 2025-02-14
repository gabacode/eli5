export type Message = {
  text: string;
  played: boolean;
};

export type ChunkMessage = {
  type: "chunk";
  filename: string;
  contentType: string;
  chunkIndex: number;
  totalChunks: number;
  content: ArrayBuffer;
};

export type Status = "idle" | "uploading" | "processing" | "completed";
