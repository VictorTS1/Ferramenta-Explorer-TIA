import type { HelpDocument } from "./types";

const SEMANTIC_ALIASES: Record<string, string[]> = {
  solda: ["schweiss", "schweissen", "weld", "migmag", "bolzen", "laser", "primespmm", "rob_schweissen"],
  soldas: ["schweiss", "schweissen", "weld", "migmag", "bolzen", "laser", "primespmm", "rob_schweissen"],
  transportador: ["foerdertechnik", "fordertechnik", "transport", "conveyor", "motor_vr", "elefant", "hubremech", "sew_amx", "sinamics"],
  transportadores: ["foerdertechnik", "fordertechnik", "transport", "conveyor", "motor_vr", "elefant", "hubremech", "sew_amx", "sinamics"],
  robo: ["roboter", "robot", "_r0", "_rb"],
  robos: ["roboter", "robot", "_r0", "_rb"],
  estacao: ["stationen", "_sb", "_rb", "_v0"],
  estacoes: ["stationen", "_sb", "_rb", "_v0"]
};

export function normalizeSearch(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
}

export function semanticTermsForQuery(query: string): string[] {
  const normalized = normalizeSearch(query.trim());
  return SEMANTIC_ALIASES[normalized] ?? [normalized];
}

export function translatedFolderLabel(name: string): string {
  const translations: Record<string, string> = {
    ARG: "Lógica da aplicação",
    "1_OB": "Organização do programa",
    "2_Safety": "Segurança",
    "9_IBN": "Comissionamento",
    "20_Grundfunktionen": "Funções básicas",
    "30_Vorwahlen": "Pré-seleções",
    "40_Betriebsarten": "Modos de operação",
    "50_Stationen": "Estações",
    "60_Roboter": "Robôs",
    "70_Schnittstellen": "Interfaces",
    "90_ZAUE": "ZAU",
    "110_ProDiag": "Diagnóstico ProDiag",
    VASS_V6: "Biblioteca VASS V6",
    VASS_Safety_V6: "Biblioteca Safety V6",
    Foerdertechnik: "Transportadores",
    Roboterprozesse: "Processos de robôs",
    Roboter: "Robôs",
    Rob_Schweissen: "Robôs de solda",
    "DB-Instanzen": "DBs de instância",
    "DB-Anwender": "DBs de usuário"
  };
  return translations[name] ? `${name} — ${translations[name]}` : name;
}

export function matchingHelpDocuments(blockName: string, documents: HelpDocument[]): HelpDocument[] {
  const normalizedName = normalizeSearch(blockName);
  return documents.filter((document) => normalizeSearch(document.name) === normalizedName);
}
