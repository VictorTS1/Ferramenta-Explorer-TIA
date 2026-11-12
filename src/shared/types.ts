export type BlockType = "OB" | "FB" | "FC" | "InstanceDB" | "GlobalDB";

export interface BlockRecord {
  id: string;
  project: string;
  cpu: string;
  folder: string;
  name: string;
  type: BlockType;
  language: string;
  relativePath: string;
  absolutePath: string;
}

export interface IndexData {
  version: 1;
  generatedAt: string;
  signature: string;
  records: BlockRecord[];
}

export interface IndexProgress {
  phase: "checking" | "indexing" | "ready" | "error";
  current: number;
  total: number;
  message: string;
}

export interface IndexResponse {
  index: IndexData;
  reused: boolean;
}

export interface ExplorerApi {
  loadIndex(force?: boolean): Promise<IndexResponse>;
  onProgress(listener: (progress: IndexProgress) => void): () => void;
}
