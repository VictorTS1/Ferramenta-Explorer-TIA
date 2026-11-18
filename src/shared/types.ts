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

export interface HelpDocument {
  id: string;
  name: string;
  relativePath: string;
}

export type VariableKind = "blockMember" | "plcTag";
export type VariableUseScope = "LocalVariable" | "GlobalVariable";

export interface VariableRecord {
  id: string;
  kind: VariableKind;
  project: string;
  cpu: string;
  name: string;
  symbolPath: string;
  dataType: string;
  comment: string;
  section: string;
  ownerBlockId: string;
  ownerName: string;
  ownerType: BlockType | "PlcTagTable";
  tableName: string;
  logicalAddress: string;
  relativePath: string;
}

export interface VariableUseRecord {
  id: string;
  project: string;
  cpu: string;
  scope: VariableUseScope;
  symbolPath: string;
  targetVariableId: string;
  callerBlockId: string;
  callerName: string;
  callerType: BlockType;
  callerLanguage: string;
  callerRelativePath: string;
  compileUnitId: string;
  compileUnitOrder: number;
  locationLabel: string;
  title: string;
  comment: string;
}

export interface IndexData {
  version: 5;
  generatedAt: string;
  signature: string;
  records: BlockRecord[];
  calls: CallRecord[];
  variables: VariableRecord[];
  variableUses: VariableUseRecord[];
  helpDocuments: HelpDocument[];
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
  listHelpDocuments(): Promise<HelpDocument[]>;
  openHelp(helpId: string): Promise<void>;
  onProgress(listener: (progress: IndexProgress) => void): () => void;
}
