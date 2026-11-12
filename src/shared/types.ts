export type BlockType = "OB" | "FB" | "FC" | "InstanceDB" | "GlobalDB";
export type CallableBlockType = "FB" | "FC";

export interface BlockRecord {
  id: string;
  project: string;
  cpu: string;
  folder: string;
  name: string;
  number: string;
  type: BlockType;
  language: string;
  relativePath: string;
  absolutePath: string;
}

export interface CallRecord {
  id: string;
  project: string;
  cpu: string;
  callerBlockId: string;
  callerName: string;
  callerType: BlockType;
  callerLanguage: string;
  callerRelativePath: string;
  calleeName: string;
  calleeType: CallableBlockType;
  compileUnitId: string;
  compileUnitOrder: number;
  callOrder: number;
  locationLabel: string;
  title: string;
  comment: string;
  isInfrastructure: boolean;
}

export interface IndexData {
  version: 3;
  generatedAt: string;
  signature: string;
  records: BlockRecord[];
  calls: CallRecord[];
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
