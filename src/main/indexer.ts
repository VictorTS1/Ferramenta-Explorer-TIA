import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { SaxesParser } from "saxes";
import type { BlockRecord, BlockType, CallRecord, CallableBlockType, HelpDocument, IndexData, IndexProgress, VariableRecord, VariableUseRecord } from "../shared/types";

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

async function walkFiles(directory: string, extension: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return walkFiles(entryPath, extension);
    return entry.isFile() && entry.name.toLowerCase().endsWith(extension) ? [entryPath] : [];
  }));
  return nested.flat();
}

async function walkXml(directory: string): Promise<string[]> {
  return walkFiles(directory, ".xml");
}

async function readHelpDocuments(helpsPath: string): Promise<HelpDocument[]> {
  try {
    await stat(helpsPath);
  } catch {
    return [];
  }
  const files = await walkFiles(helpsPath, ".pdf");
  return files.map((filePath) => {
    const relativePath = path.relative(helpsPath, filePath).replaceAll(path.sep, "/");
    return { id: relativePath, name: path.basename(filePath, ".pdf"), relativePath };
  }).sort((left, right) => left.relativePath.localeCompare(right.relativePath, "pt-BR"));
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

function firstComment(comments: Array<{ culture: string; text: string }>): string {
  return comments.find((item) => item.culture === "de-DE")?.text
    ?? comments.find((item) => item.text)?.text
    ?? "";
}

export function parseBlockVariablesXml(block: BlockRecord, xml: string): VariableRecord[] {
  const variables: VariableRecord[] = [];
  const sections: string[] = [];
  const tags: string[] = [];
  let current: { name: string; dataType: string; section: string; comments: Array<{ culture: string; text: string }>; commentCulture: string; readingComment: boolean; commentText: string } | null = null;
  try {
    const parser = new SaxesParser({ xmlns: false, position: false });
    parser.on("opentag", (tag) => {
      if (tag.name === "Section") {
        sections.push(attribute(tag, "Name"));
        return;
      }
      if (tag.name === "Member" && sections.length === 1) {
        current = { name: attribute(tag, "Name"), dataType: attribute(tag, "Datatype"), section: sections[0], comments: [], commentCulture: "", readingComment: false, commentText: "" };
        return;
      }
      if (!current) return;
      if (tag.name === "MultiLanguageText") {
        current.commentCulture = attribute(tag, "Lang");
        current.readingComment = true;
        current.commentText = "";
      }
    });
    parser.on("text", (text) => { if (current?.readingComment) current.commentText += text; });
    parser.on("closetag", (tag) => {
      const name = closingName(tag);
      if (current && name === "MultiLanguageText" && current.readingComment) {
        current.comments.push({ culture: current.commentCulture, text: current.commentText.trim() });
        current.readingComment = false;
      } else if (current && name === "Member" && sections.length === 1) {
        if (current.name) {
          const symbolPath = block.type.endsWith("DB") ? `${block.name}.${current.name}` : current.name;
          variables.push({
            id: `${block.id}#variable#${current.section}#${current.name}`,
            kind: "blockMember", project: block.project, cpu: block.cpu, name: current.name, symbolPath,
            dataType: current.dataType, comment: firstComment(current.comments), section: current.section,
            ownerBlockId: block.id, ownerName: block.name, ownerType: block.type, tableName: "", logicalAddress: "", relativePath: block.relativePath
          });
        }
        current = null;
      }
      if (name === "Section") sections.pop();
    });
    parser.write(xml).close();
  } catch {
    return [];
  }
  return variables;
}

export function parsePlcTagsXml(filePath: string, xml: string, refsPath: string): VariableRecord[] {
  const relativePath = path.relative(refsPath, filePath).replaceAll(path.sep, "/");
  const parts = relativePath.split("/");
  if (parts.length < 4 || parts.indexOf("PLC tags") < 2) return [];
  const variables: VariableRecord[] = [];
  let tableName = "";
  let inTableAttributes = false;
  let current: { id: string; name: string; dataType: string; logicalAddress: string; comments: Array<{ culture: string; text: string }>; commentCulture: string; readingComment: boolean; commentField: "culture" | "text" | null; commentText: string } | null = null;
  let field: "name" | "dataType" | "logicalAddress" | null = null;
  let text = "";
  try {
    const parser = new SaxesParser({ xmlns: false, position: false });
    parser.on("opentag", (tag) => {
      if (tag.name === "SW.Tags.PlcTagTable") return;
      if (tag.name === "SW.Tags.PlcTag") {
        current = { id: attribute(tag, "ID"), name: "", dataType: "", logicalAddress: "", comments: [], commentCulture: "", readingComment: false, commentField: null, commentText: "" };
      } else if (tag.name === "AttributeList") {
        if (current) return;
        inTableAttributes = !tableName;
      } else if (tag.name === "Name") {
        field = current ? "name" : inTableAttributes ? "name" : null;
        text = "";
      } else if (current && tag.name === "DataTypeName") { field = "dataType"; text = ""; }
      else if (current && tag.name === "LogicalAddress") { field = "logicalAddress"; text = ""; }
      else if (current && tag.name === "MultiLanguageText" && attribute(tag, "Lang")) { current.commentCulture = attribute(tag, "Lang"); current.readingComment = true; current.commentText = ""; }
      else if (current && tag.name === "Culture") { current.commentField = "culture"; current.commentText = ""; }
      else if (current && tag.name === "Text") { current.commentField = "text"; current.commentText = ""; }
    });
    parser.on("text", (value) => { if (field) text += value; if (current?.readingComment || current?.commentField) current.commentText += value; });
    parser.on("closetag", (tag) => {
      const name = closingName(tag);
      if (name === "Name" && field === "name") { if (current) current.name = text.trim(); else tableName = text.trim(); field = null; }
      else if (name === "DataTypeName" && current) { current.dataType = text.trim(); field = null; }
      else if (name === "LogicalAddress" && current) { current.logicalAddress = text.trim(); field = null; }
      else if (name === "AttributeList" && !current) inTableAttributes = false;
      else if (name === "Culture" && current?.commentField === "culture") { current.commentCulture = current.commentText.trim(); current.commentField = null; }
      else if (name === "Text" && current?.commentField === "text") { current.comments.push({ culture: current.commentCulture, text: current.commentText.trim() }); current.commentField = null; }
      else if (name === "MultiLanguageText" && current?.readingComment) { current.comments.push({ culture: current.commentCulture, text: current.commentText.trim() }); current.readingComment = false; }
      else if (name === "SW.Tags.PlcTag" && current) {
        if (current.name) variables.push({ id: `${relativePath}#tag#${current.id}`, kind: "plcTag", project: parts[0], cpu: parts[1], name: current.name, symbolPath: current.name, dataType: current.dataType, comment: firstComment(current.comments), section: "Tag global", ownerBlockId: "", ownerName: "", ownerType: "PlcTagTable", tableName, logicalAddress: current.logicalAddress, relativePath });
        current = null;
      }
    });
    parser.write(xml).close();
  } catch { return []; }
  return variables;
}

export function parseVariableUsesXml(caller: BlockRecord, xml: string): VariableUseRecord[] {
  const uses: VariableUseRecord[] = [];
  let activeUnit: { id: string; order: number; language: string; title: string; comment: string } | null = null;
  let unitCount = 0;
  let readingLanguage = false;
  let languageText = "";
  let textCollector: TextCollector | null = null;
  const tags: string[] = [];
  const accesses: Array<{ scope: "LocalVariable" | "GlobalVariable"; id: string; paths: string[] }> = [];
  try {
    const parser = new SaxesParser({ xmlns: false, position: false });
    parser.on("opentag", (tag) => {
      tags.push(tag.name);
      if (tag.name === "SW.Blocks.CompileUnit") { unitCount += 1; activeUnit = { id: attribute(tag, "ID"), order: unitCount, language: caller.language, title: "", comment: "" }; return; }
      if (!activeUnit) return;
      if (tag.name === "MultilingualText") { const composition = attribute(tag, "CompositionName"); if (composition === "Title" || composition === "Comment") textCollector = { kind: composition === "Title" ? "title" : "comment", culture: "", field: null, value: "", fallback: "" }; }
      else if (textCollector && tag.name === "Culture") { textCollector.field = "culture"; textCollector.value = ""; }
      else if (textCollector && tag.name === "Text") { textCollector.field = "text"; textCollector.value = ""; }
      else if (tag.name === "ProgrammingLanguage") { readingLanguage = true; languageText = ""; }
      else if (tag.name === "Access") { const scope = attribute(tag, "Scope"); if (scope === "LocalVariable" || scope === "GlobalVariable") accesses.push({ scope, id: attribute(tag, "UId"), paths: [] }); }
      else if (tag.name === "Component" && accesses.length && tags[tags.length - 2] === "Symbol") accesses[accesses.length - 1].paths.push(attribute(tag, "Name"));
    });
    parser.on("text", (value) => { if (readingLanguage) languageText += value; if (textCollector?.field) textCollector.value += value; });
    parser.on("closetag", (tag) => {
      const name = closingName(tag);
      if (textCollector && name === "Culture" && textCollector.field === "culture") { textCollector.culture = textCollector.value.trim(); textCollector.field = null; }
      else if (textCollector && name === "Text" && textCollector.field === "text") { const value = textCollector.value.trim(); if (value) { if (textCollector.culture === "de-DE" || textCollector.fallback === "") textCollector.fallback = value; } textCollector.field = null; }
      else if (textCollector && name === "MultilingualText") { if (textCollector.kind === "title") activeUnit!.title = textCollector.fallback; else activeUnit!.comment = textCollector.fallback; textCollector = null; }
      if (name === "ProgrammingLanguage" && activeUnit) { activeUnit.language = languageText.trim() || caller.language; readingLanguage = false; }
      if (name === "Access" && accesses.length) {
        const access = accesses.pop()!;
        const symbolPath = access.paths.filter(Boolean).join(".");
        if (symbolPath && activeUnit) {
          const locationLabel = activeUnit.language === "LAD" || activeUnit.language === "F_LAD" ? `Network ${activeUnit.order}` : `Unidade ${activeUnit.order} (${activeUnit.language || caller.language})`;
          uses.push({ id: `${caller.id}#${activeUnit.id}#access#${access.id || uses.length + 1}`, project: caller.project, cpu: caller.cpu, scope: access.scope, symbolPath, targetVariableId: "", callerBlockId: caller.id, callerName: caller.name, callerType: caller.type, callerLanguage: caller.language, callerRelativePath: caller.relativePath, compileUnitId: activeUnit.id, compileUnitOrder: activeUnit.order, locationLabel, title: activeUnit.title, comment: activeUnit.comment });
        }
      }
      if (name === "SW.Blocks.CompileUnit" && activeUnit) {
        for (const use of uses) {
          if (use.callerBlockId === caller.id && use.compileUnitId === activeUnit.id) {
            use.title = activeUnit.title;
            use.comment = activeUnit.comment;
          }
        }
        activeUnit = null;
      }
      tags.pop();
    });
    parser.write(xml).close();
  } catch { return []; }
  return uses;
}

function resolveVariableUses(variables: VariableRecord[], uses: VariableUseRecord[]): void {
  const local = new Map<string, VariableRecord[]>();
  const global = new Map<string, VariableRecord[]>();
  for (const variable of variables) {
    const localKey = `${variable.ownerBlockId}|${variable.name}`;
    if (variable.kind === "blockMember" && !variable.ownerType.toString().endsWith("DB")) local.set(localKey, [...(local.get(localKey) ?? []), variable]);
    if (variable.kind === "plcTag" || variable.ownerType.toString().endsWith("DB")) {
      const globalKey = `${variable.project}|${variable.cpu}|${variable.symbolPath}`;
      global.set(globalKey, [...(global.get(globalKey) ?? []), variable]);
    }
  }
  for (const use of uses) {
    const matches = use.scope === "LocalVariable"
      ? local.get(`${use.callerBlockId}|${use.symbolPath.split(".")[0]}`)
      : global.get(`${use.project}|${use.cpu}|${use.symbolPath}`);
    if (matches?.length === 1) use.targetVariableId = matches[0].id;
  }
}

async function signatureFor(sources: Array<{ filePath: string; key: string }>): Promise<string> {
  const hash = createHash("sha256");
  for (const source of sources.sort((left, right) => left.key.localeCompare(right.key))) {
    const details = await stat(source.filePath);
    hash.update(source.key);
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

  private get helpsPath() {
    return path.join(this.rootPath, "helps");
  }

  async load(force = false): Promise<{ index: IndexData; reused: boolean }> {
    if (!force) {
      try {
        const cached = JSON.parse(await readFile(this.indexPath, "utf8")) as IndexData;
        if (cached.version === 5 && Array.isArray(cached.records) && Array.isArray(cached.calls) && Array.isArray(cached.variables) && Array.isArray(cached.variableUses) && Array.isArray(cached.helpDocuments)) {
          this.notify({ phase: "ready", current: cached.records.length, total: cached.records.length, message: "Indice local carregado." });
          return { index: cached, reused: true };
        }
      } catch {
        // Sem cache valido: a primeira abertura precisa criar o indice.
      }
    }
    this.notify({ phase: "checking", current: 0, total: 0, message: "Verificando referências…" });
    try {
      await stat(this.refsPath);
    } catch {
      throw new MissingReferencesError(this.refsPath);
    }

    const files = await walkXml(this.refsPath);
    const helpDocuments = await readHelpDocuments(this.helpsPath);
    const signature = await signatureFor([
      ...files.map((filePath) => ({ filePath, key: `refs/${path.relative(this.refsPath, filePath)}` })),
      ...helpDocuments.map((document) => ({ filePath: path.join(this.helpsPath, document.relativePath), key: `helps/${document.relativePath}` }))
    ]);

    if (!force) {
      try {
        const cached = JSON.parse(await readFile(this.indexPath, "utf8")) as IndexData;
        if (cached.version === 5 && cached.signature === signature && Array.isArray(cached.calls) && Array.isArray(cached.variables) && Array.isArray(cached.variableUses) && Array.isArray(cached.helpDocuments)) {
          this.notify({ phase: "ready", current: cached.records.length, total: cached.records.length, message: "Índice local carregado." });
          return { index: cached, reused: true };
        }
      } catch {
        // Cache inexistente ou inválido: criar um novo índice.
      }
    }

    const records: BlockRecord[] = [];
    const calls: CallRecord[] = [];
    const variables: VariableRecord[] = [];
    const variableUses: VariableUseRecord[] = [];
    const total = files.length;
    for (let position = 0; position < files.length; position += 1) {
      const file = files[position];
      const xml = await readFile(file, "utf8");
      const record = parseBlockXml(file, xml, this.refsPath);
      if (record) {
        records.push(record);
        calls.push(...parseCallsXml(record, xml));
        variables.push(...parseBlockVariablesXml(record, xml));
        variableUses.push(...parseVariableUsesXml(record, xml));
      }
      variables.push(...parsePlcTagsXml(file, xml, this.refsPath));
      if (position % 25 === 0 || position === total - 1) {
        this.notify({ phase: "indexing", current: position + 1, total, message: `Lendo XMLs: ${position + 1} de ${total}` });
      }
    }

    records.sort((left, right) => left.name.localeCompare(right.name, "pt-BR"));
    variables.sort((left, right) => left.symbolPath.localeCompare(right.symbolPath, "pt-BR"));
    resolveVariableUses(variables, variableUses);
    const index: IndexData = { version: 5, generatedAt: new Date().toISOString(), signature, records, calls, variables, variableUses, helpDocuments };
    await mkdir(path.dirname(this.indexPath), { recursive: true });
    await writeFile(this.indexPath, JSON.stringify(index, null, 2), "utf8");
    this.notify({ phase: "ready", current: total, total, message: `${records.length} blocos e ${variables.length} variaveis indexados.` });
    return { index, reused: false };
  }
}
