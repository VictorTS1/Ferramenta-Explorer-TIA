import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { parseBlockXml } from "../src/main/indexer";

describe("amostras de referência", () => {
  const root = path.resolve(__dirname, "..");

  it("extrai o OB1 em LAD", async () => {
    const refsPath = path.join(root, "refs");
    const filePath = path.join(refsPath, "V6-39E231.ap17", "KASTIH1-----BS1---KFU1", "Program blocks", "ARG", "1_OB", "OB1.xml");
    const record = parseBlockXml(filePath, await readFile(filePath, "utf8"), refsPath);
    expect(record).toMatchObject({ project: "V6-39E231.ap17", cpu: "KASTIH1-----BS1---KFU1", folder: "ARG/1_OB", name: "OB1", type: "OB", language: "LAD" });
  });

  it("distingue DB de instância e DB global", () => {
    const refsPath = path.join(root, "refs");
    const instance = parseBlockXml(path.join(refsPath, "Projeto.ap17", "CPU", "Program blocks", "DB-Instanzen", "x.xml"), "<SW.Blocks.InstanceDB><Name>Instancia</Name><ProgrammingLanguage>DB</ProgrammingLanguage>", refsPath);
    const global = parseBlockXml(path.join(refsPath, "Projeto.ap17", "CPU", "Program blocks", "DB-Anwender", "x.xml"), "<SW.Blocks.GlobalDB><Name>Usuario</Name><ProgrammingLanguage>DB</ProgrammingLanguage>", refsPath);
    expect(instance?.type).toBe("InstanceDB");
    expect(global?.type).toBe("GlobalDB");
  });
});
