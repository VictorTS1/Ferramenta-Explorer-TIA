import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type { BlockRecord, BlockType, IndexData, IndexProgress } from "../shared/types";

const BLOCK_TYPES: Array<[RegExp, BlockType]> = [
  [/<SW\.Blocks\.OB\b/, "OB"],
  [/<SW\.Blocks\.FB\b/, "FB"],
  [/<SW\.Blocks\.FC\b/, "FC"],
  [/<SW\.Blocks\.InstanceDB\b/, "InstanceDB"],
  [/<SW\.Blocks\.GlobalDB\b/, "GlobalDB"]
];

export class MissingReferencesError extends Error {
  constructor(referencePath: string) {
    super(`A pasta de referências não foi encontrada: ${referencePath}`);
    this.name = "MissingReferencesError";
  }
}

async function walkXml(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return walkXml(entryPath);
    return entry.isFile() && entry.name.toLowerCase().endsWith(".xml") ? [entryPath] : [];
  }));
  return nested.flat();
}

function extractField(xml: string, expression: RegExp): string {
  return expression.exec(xml)?.[1]?.trim() ?? "";
}

export function parseBlockXml(filePath: string, xml: string, refsPath: string): BlockRecord | null {
  const type = BLOCK_TYPES.find(([expression]) => expression.test(xml))?.[1];
  if (!type) return null;

  const relativePath = path.relative(refsPath, filePath);
  const parts = relativePath.split(path.sep);
  const programBlocksIndex = parts.findIndex((part) => part === "Program blocks");
  if (parts.length < 4 || programBlocksIndex < 2) return null;

  const project = parts[0];
  const cpu = parts[1];
  const folder = parts.slice(programBlocksIndex + 1, -1).join("/");
  const fallbackName = path.basename(filePath, ".xml");
  const name = extractField(xml, /<Name>([^<]+)<\/Name>/) || fallbackName;
  const language = extractField(xml, /<ProgrammingLanguage>([^<]+)<\/ProgrammingLanguage>/) || "—";

  return {
    id: relativePath.replaceAll(path.sep, "/"),
    project,
    cpu,
    folder,
    name,
    type,
    language,
    relativePath: relativePath.replaceAll(path.sep, "/"),
    absolutePath: filePath
  };
}

async function signatureFor(files: string[], refsPath: string): Promise<string> {
  const hash = createHash("sha256");
  for (const file of files.sort()) {
    const details = await stat(file);
    hash.update(path.relative(refsPath, file));
    hash.update(`${details.size}:${details.mtimeMs}`);
  }
  return hash.digest("hex");
}

export class ProjectIndexer {
  constructor(
    private readonly rootPath: string,
    private readonly notify: (progress: IndexProgress) => void
  ) {}

  private get refsPath() {
    return path.join(this.rootPath, "refs");
  }

  private get indexPath() {
    return path.join(this.rootPath, "output", "block-index.json");
  }

  async load(force = false): Promise<{ index: IndexData; reused: boolean }> {
    this.notify({ phase: "checking", current: 0, total: 0, message: "Verificando referências…" });
    try {
      await stat(this.refsPath);
    } catch {
      throw new MissingReferencesError(this.refsPath);
    }

    const files = await walkXml(this.refsPath);
    const signature = await signatureFor(files, this.refsPath);

    if (!force) {
      try {
        const cached = JSON.parse(await readFile(this.indexPath, "utf8")) as IndexData;
        if (cached.version === 1 && cached.signature === signature) {
          this.notify({ phase: "ready", current: cached.records.length, total: cached.records.length, message: "Índice local carregado." });
          return { index: cached, reused: true };
        }
      } catch {
        // Cache inexistente ou inválido: criar um novo índice.
      }
    }

    const records: BlockRecord[] = [];
    const total = files.length;
    for (let position = 0; position < files.length; position += 1) {
      const file = files[position];
      const xml = await readFile(file, "utf8");
      const record = parseBlockXml(file, xml, this.refsPath);
      if (record) records.push(record);
      if (position % 25 === 0 || position === total - 1) {
        this.notify({ phase: "indexing", current: position + 1, total, message: `Lendo XMLs: ${position + 1} de ${total}` });
      }
    }

    records.sort((left, right) => left.name.localeCompare(right.name, "pt-BR"));
    const index: IndexData = { version: 1, generatedAt: new Date().toISOString(), signature, records };
    await mkdir(path.dirname(this.indexPath), { recursive: true });
    await writeFile(this.indexPath, JSON.stringify(index, null, 2), "utf8");
    this.notify({ phase: "ready", current: total, total, message: `${records.length} blocos indexados.` });
    return { index, reused: false };
  }
}
