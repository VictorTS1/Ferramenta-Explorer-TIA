import { describe, expect, it } from "vitest";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { parseBlockVariablesXml, parseBlockXml, parseCallsXml, parsePlcTagsXml, parseVariableUsesXml, ProjectIndexer } from "../src/main/indexer";
import { matchingHelpDocuments, semanticTermsForQuery, translatedFolderLabel } from "../src/shared/semantic";

describe("amostras de referência", () => {
  const root = path.resolve(__dirname, "..");

  it("extrai o OB1 em LAD", async () => {
    const refsPath = path.join(root, "refs");
    const filePath = path.join(refsPath, "V6-39E231.ap17", "KASTIH1-----BS1---KFU1", "Program blocks", "ARG", "1_OB", "OB1.xml");
    const record = parseBlockXml(filePath, await readFile(filePath, "utf8"), refsPath);
    expect(record).toMatchObject({ project: "V6-39E231.ap17", cpu: "KASTIH1-----BS1---KFU1", folder: "ARG/1_OB", name: "OB1", number: "1", type: "OB", language: "LAD" });
  });

  it("distingue DB de instância e DB global", () => {
    const refsPath = path.join(root, "refs");
    const instance = parseBlockXml(path.join(refsPath, "Projeto.ap17", "CPU", "Program blocks", "DB-Instanzen", "x.xml"), "<SW.Blocks.InstanceDB><Name>Instancia</Name><ProgrammingLanguage>DB</ProgrammingLanguage>", refsPath);
    const global = parseBlockXml(path.join(refsPath, "Projeto.ap17", "CPU", "Program blocks", "DB-Anwender", "x.xml"), "<SW.Blocks.GlobalDB><Name>Usuario</Name><ProgrammingLanguage>DB</ProgrammingLanguage>", refsPath);
    expect(instance?.type).toBe("InstanceDB");
    expect(global?.type).toBe("GlobalDB");
  });

  it("extrai o número técnico de uma FC", async () => {
    const refsPath = path.join(root, "refs");
    const filePath = path.join(refsPath, "V6-39E231.ap17", "KASTIH1-----BS1---KFU1", "Program blocks", "VASS_V6", "ZAU", "ZAU_Werte", "FC_ZAU_Werte.xml");
    const record = parseBlockXml(filePath, await readFile(filePath, "utf8"), refsPath);
    expect(record).toMatchObject({ name: "FC_ZAU_Werte", number: "600", type: "FC" });
  });

  it("localiza a chamada de IBN no OB1", async () => {
    const refsPath = path.join(root, "refs");
    const filePath = path.join(refsPath, "V6-39E231.ap17", "KASTIH1-----BS1---KFU1", "Program blocks", "ARG", "1_OB", "OB1.xml");
    const xml = await readFile(filePath, "utf8");
    const block = parseBlockXml(filePath, xml, refsPath);
    expect(block).not.toBeNull();
    const call = parseCallsXml(block!, xml).find((item) => item.calleeName === "IBN");
    expect(call).toMatchObject({
      callerName: "OB1",
      callerType: "OB",
      calleeName: "IBN",
      calleeType: "FC",
      locationLabel: "Network 3",
      title: "Inbetriebnahme",
      compileUnitId: "12"
    });
  });

  it("marca auxiliares conhecidos como infraestrutura", () => {
    const refsPath = path.join(root, "refs");
    const caller = parseBlockXml(path.join(refsPath, "Projeto.ap17", "CPU", "Program blocks", "x.xml"), "<SW.Blocks.FC><Name>Chamador</Name><ProgrammingLanguage>LAD</ProgrammingLanguage></SW.Blocks.FC>", refsPath)!;
    const xml = `<Document><SW.Blocks.CompileUnit ID="A"><AttributeList><NetworkSource><Call><CallInfo Name="R_Trig" BlockType="FB" /></Call></NetworkSource><ProgrammingLanguage>LAD</ProgrammingLanguage></AttributeList></SW.Blocks.CompileUnit></Document>`;
    const [call] = parseCallsXml(caller, xml);
    expect(call).toMatchObject({ calleeName: "R_Trig", isInfrastructure: true, locationLabel: "Network 1" });
  });

  it("indexa somente membros diretos da interface do bloco", () => {
    const refsPath = path.join(root, "refs");
    const filePath = path.join(refsPath, "Projeto.ap17", "CPU", "Program blocks", "x.xml");
    const block = parseBlockXml(filePath, "<SW.Blocks.FB><Name>Teste</Name><ProgrammingLanguage>SCL</ProgrammingLanguage></SW.Blocks.FB>", refsPath)!;
    const xml = `<Document><Section Name="Input"><Member Name="Entrada" Datatype="Bool"><Comment><MultiLanguageText Lang="de-DE">Entrada principal</MultiLanguageText></Comment></Member><Member Name="Estrutura" Datatype="Struct"><Sections><Section Name="None"><Member Name="Interna" Datatype="Int" /></Section></Sections></Member></Section><Section Name="Temp"><Member Name="Aux" Datatype="Real" /></Section></Document>`;
    expect(parseBlockVariablesXml(block, xml)).toMatchObject([
      { name: "Entrada", dataType: "Bool", section: "Input", comment: "Entrada principal" },
      { name: "Estrutura", dataType: "Struct", section: "Input" },
      { name: "Aux", dataType: "Real", section: "Temp" }
    ]);
  });

  it("extrai tags PLC e usos locais e globais com caminho completo", () => {
    const refsPath = path.join(root, "refs");
    const tagPath = path.join(refsPath, "Projeto.ap17", "CPU", "PLC tags", "Tabela.xml");
    const tags = parsePlcTagsXml(tagPath, `<Document><SW.Tags.PlcTagTable><AttributeList><Name>Tabela</Name></AttributeList><SW.Tags.PlcTag ID="1"><AttributeList><DataTypeName>Bool</DataTypeName><LogicalAddress>%M1.0</LogicalAddress><Name>Clock_Byte</Name></AttributeList></SW.Tags.PlcTag></SW.Tags.PlcTagTable></Document>`, refsPath);
    expect(tags).toMatchObject([{ name: "Clock_Byte", tableName: "Tabela", dataType: "Bool", logicalAddress: "%M1.0", kind: "plcTag" }]);
    const blockPath = path.join(refsPath, "Projeto.ap17", "CPU", "Program blocks", "x.xml");
    const block = parseBlockXml(blockPath, "<SW.Blocks.FC><Name>Teste</Name><ProgrammingLanguage>SCL</ProgrammingLanguage></SW.Blocks.FC>", refsPath)!;
    const uses = parseVariableUsesXml(block, `<Document><SW.Blocks.CompileUnit ID="A"><AttributeList><NetworkSource><StructuredText><Access Scope="LocalVariable" UId="1"><Symbol><Component Name="Entrada" /></Symbol></Access><Access Scope="GlobalVariable" UId="2"><Symbol><Component Name="DB_ARG" /><Component Name="Reset" /></Symbol></Access></StructuredText></NetworkSource><ProgrammingLanguage>SCL</ProgrammingLanguage></AttributeList></SW.Blocks.CompileUnit></Document>`);
    expect(uses).toMatchObject([{ scope: "LocalVariable", symbolPath: "Entrada", locationLabel: "Unidade 1 (SCL)" }, { scope: "GlobalVariable", symbolPath: "DB_ARG.Reset" }]);
  });

  it("traduz pastas e expande pesquisas semânticas", () => {
    expect(translatedFolderLabel("50_Stationen")).toBe("50_Stationen — Estações");
    expect(semanticTermsForQuery("solda")).toContain("schweiss");
    expect(semanticTermsForQuery("solda")).not.toContain("laser");
    expect(semanticTermsForQuery("laser")).toContain("rob_laser");
    expect(semanticTermsForQuery("cola")).toContain("rob_kleben");
    expect(semanticTermsForQuery("estampagem")).toContain("rob_stanzen");
    expect(semanticTermsForQuery("uniao")).toContain("rob_fuegen");
    expect(semanticTermsForQuery(`uni${String.fromCharCode(0x00e3)}o`)).toContain("rob_fuegen");
    expect(semanticTermsForQuery("medicoes")).toContain("rob_messen");
    expect(semanticTermsForQuery("visao")).toContain("rob_vision_k");
    expect(semanticTermsForQuery(`vis${String.fromCharCode(0x00e3)}o`)).toContain("rob_vision_k");
    expect(semanticTermsForQuery("manipulacao")).toContain("rob_greifer");
    expect(semanticTermsForQuery("fixacoes")).toContain("rob_fds");
    expect(semanticTermsForQuery("transportes")).toContain("foerdertechnik");
    expect(semanticTermsForQuery("elevadores")).toContain("hubremech");
    expect(semanticTermsForQuery("mesa")).toContain("drehtfu");
    expect(semanticTermsForQuery("mesa giratoria")).toContain("drehtfu");
    expect(semanticTermsForQuery("tambores")).toContain("trommelfu");
    expect(semanticTermsForQuery("esteira")).toContain("elefant2_amx_rbock");
    expect(semanticTermsForQuery("transferencia")).toContain("gw_elefant2");
    expect(semanticTermsForQuery("porta de seguranca")).toContain("tor_profisafe");
    expect(semanticTermsForQuery("robôs")).toContain("roboter");
  });

  it("associa PDFs pelo nome tecnico do bloco", () => {
    const documents = [
      { id: "Library Types/FB_Ventil.pdf", name: "FB_Ventil", relativePath: "Library Types/FB_Ventil.pdf" },
      { id: "Library Types/FC_Ventil.pdf", name: "FC_Ventil", relativePath: "Library Types/FC_Ventil.pdf" }
    ];
    expect(matchingHelpDocuments("FB_Ventil", documents)).toEqual([documents[0]]);
  });

  it("abre o cache sem precisar da pasta de referencias", async () => {
    const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "explorer-tia-"));
    const index = { version: 5, generatedAt: "2026-01-01T00:00:00.000Z", signature: "cache", records: [], calls: [], variables: [], variableUses: [], helpDocuments: [] };
    try {
      await mkdir(path.join(temporaryRoot, "output"));
      await writeFile(path.join(temporaryRoot, "output", "block-index.json"), JSON.stringify(index));
      const result = await new ProjectIndexer(temporaryRoot, () => undefined).load();
      expect(result).toEqual({ index, reused: true });
    } finally {
      await rm(temporaryRoot, { recursive: true, force: true });
    }
  });
});
