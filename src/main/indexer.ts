import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { SaxesParser } from "saxes";
import type { BlockRecord, BlockType, CallRecord, CallableBlockType, IndexData, IndexProgress } from "../shared/types";

const BLOCK_TYPES: Array<[RegExp, BlockType]> = [
  [/<SW\.Blocks\.OB\b/, "OB"],
  [/<SW\.Blocks\.FB\b/, "FB"],
  [/<SW\.Blocks\.FC\b/, "FC"],
  [/<SW\.Blocks\.InstanceDB\b/, "InstanceDB"],
  [/<SW\.Blocks\.GlobalDB\b/, "GlobalDB"]
];

const INFRASTRUCTURE_BLOCKS = new Set([
  "R_Trig", "F_Trig", "TON", "TOF", "TP", "CTU", "CTD", "BIT_TO_BYTE", "DTL_TO_BCD", "R_BIT_IN_DWORD"
]);

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
  const number = extractField(xml, /<Number>([^<]+)<\/Number>/);
  const language = extractField(xml, /<ProgrammingLanguage>([^<]+)<\/ProgrammingLanguage>/) || "—";

  return {
    id: relativePath.replaceAll(path.sep, "/"),
    project,
    cpu,
    folder,
    name,
    number,
    type,
    language,
    relativePath: relativePath.replaceAll(path.sep, "/"),
    absolutePath: filePath
  };
}

interface PendingCall {
  calleeName: string;
  calleeType: CallableBlockType;
  callOrder: number;
}

interface CompileUnit {
  id: string;
  order: number;
  language: string;
  title: string;
  comment: string;
  calls: PendingCall[];
}

interface TextCollector {
  kind: "title" | "comment";
  culture: string;
  field: "culture" | "text" | null;
  value: string;
  fallback: string;
}

function attribute(tag: { attributes: Record<string, string> }, name: string): string {
  return tag.attributes[name] ?? "";
}

function closingName(tag: string | { name: string }): string {
  return typeof tag === "string" ? tag : tag.name;
}

export function parseCallsXml(caller: BlockRecord, xml: string): CallRecord[] {
  const calls: CallRecord[] = [];
  let activeUnit: CompileUnit | null = null;
  let unitCount = 0;
  let textCollector: TextCollector | null = null;
  let readingLanguage = false;
  let languageText = "";

  try {
    const parser = new SaxesParser({ xmlns: false, position: false });
    parser.on("opentag", (tag) => {
      if (tag.name === "SW.Blocks.CompileUnit") {
        unitCount += 1;
        activeUnit = { id: attribute(tag, "ID"), order: unitCount, language: caller.language, title: "", comment: "", calls: [] };
        return;
      }
      if (!activeUnit) return;

      if (tag.name === "MultilingualText") {
        const composition = attribute(tag, "CompositionName");
        if (composition === "Title" || composition === "Comment") {
          textCollector = { kind: composition === "Title" ? "title" : "comment", culture: "", field: null, value: "", fallback: "" };
        }
      } else if (textCollector && tag.name === "Culture") {
        textCollector.field = "culture";
        textCollector.value = "";
      } else if (textCollector && tag.name === "Text") {
        textCollector.field = "text";
        textCollector.value = "";
      } else if (tag.name === "ProgrammingLanguage") {
        readingLanguage = true;
        languageText = "";
      } else if (tag.name === "CallInfo") {
        const calleeName = attribute(tag, "Name");
        const blockType = attribute(tag, "BlockType");
        if (calleeName && (blockType === "FB" || blockType === "FC")) {
          activeUnit.calls.push({ calleeName, calleeType: blockType, callOrder: activeUnit.calls.length + 1 });
        }
      }
    });
    parser.on("text", (text) => {
      if (readingLanguage) languageText += text;
      if (textCollector?.field) textCollector.value += text;
    });
    parser.on("closetag", (tag) => {
      const name = closingName(tag);
      if (textCollector && name === "Culture" && textCollector.field === "culture") {
        textCollector.culture = textCollector.value.trim();
        textCollector.field = null;
      } else if (textCollector && name === "Text" && textCollector.field === "text") {
        const text = textCollector.value.trim();
        if (text) {
          if (textCollector.kind === "title" && textCollector.culture === "") activeUnit!.language = text;
          else if (textCollector.culture === "de-DE" || textCollector.fallback === "") textCollector.fallback = text;
        }
        textCollector.field = null;
      } else if (textCollector && name === "MultilingualText") {
        if (textCollector.kind === "title") activeUnit!.title = textCollector.fallback;
        else activeUnit!.comment = textCollector.fallback;
        textCollector = null;
      }

      if (name === "ProgrammingLanguage" && activeUnit) {
        activeUnit.language = languageText.trim() || caller.language;
        readingLanguage = false;
      }

      if (name === "SW.Blocks.CompileUnit" && activeUnit) {
        const locationLabel = activeUnit.language === "LAD" || activeUnit.language === "F_LAD"
          ? `Network ${activeUnit.order}`
          : `Unidade ${activeUnit.order} (${activeUnit.language || caller.language})`;
        for (const pending of activeUnit.calls) {
          calls.push({
            id: `${caller.id}#${activeUnit.id}#${pending.callOrder}`,
            project: caller.project,
            cpu: caller.cpu,
            callerBlockId: caller.id,
            callerName: caller.name,
            callerType: caller.type,
            callerLanguage: caller.language,
            callerRelativePath: caller.relativePath,
            calleeName: pending.calleeName,
            calleeType: pending.calleeType,
            compileUnitId: activeUnit.id,
            compileUnitOrder: activeUnit.order,
            callOrder: pending.callOrder,
            locationLabel,
            title: activeUnit.title,
            comment: activeUnit.comment,
            isInfrastructure: INFRASTRUCTURE_BLOCKS.has(pending.calleeName)
          });
        }
        activeUnit = null;
      }
    });
    parser.write(xml).close();
  } catch {
    return [];
  }
  return calls;
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
        if (cached.version === 3 && cached.signature === signature && Array.isArray(cached.calls)) {
          this.notify({ phase: "ready", current: cached.records.length, total: cached.records.length, message: "Índice local carregado." });
          return { index: cached, reused: true };
        }
      } catch {
        // Cache inexistente ou inválido: criar um novo índice.
      }
    }

    const records: BlockRecord[] = [];
    const calls: CallRecord[] = [];
    const total = files.length;
    for (let position = 0; position < files.length; position += 1) {
      const file = files[position];
      const xml = await readFile(file, "utf8");
      const record = parseBlockXml(file, xml, this.refsPath);
      if (record) {
        records.push(record);
        calls.push(...parseCallsXml(record, xml));
      }
      if (position % 25 === 0 || position === total - 1) {
        this.notify({ phase: "indexing", current: position + 1, total, message: `Lendo XMLs: ${position + 1} de ${total}` });
      }
    }

    records.sort((left, right) => left.name.localeCompare(right.name, "pt-BR"));
    const index: IndexData = { version: 3, generatedAt: new Date().toISOString(), signature, records, calls };
    await mkdir(path.dirname(this.indexPath), { recursive: true });
    await writeFile(this.indexPath, JSON.stringify(index, null, 2), "utf8");
    this.notify({ phase: "ready", current: total, total, message: `${records.length} blocos indexados.` });
    return { index, reused: false };
  }
}
