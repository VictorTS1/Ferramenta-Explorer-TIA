import type { HelpDocument } from "./types";

const WELDING_TERMS = ["schweiss", "schweissen", "weld", "migmag", "bolzen", "primespmm", "rob_schweissen"];
const GLUING_TERMS = ["kleben", "rob_kleben"];
const LASER_TERMS = ["laser", "rob_laser", "rob_lasersk", "rob_llskopf", "lasertor"];
const STAMPING_TERMS = ["stanzen", "rob_stanzen"];
const JOINING_TERMS = ["fuegen", "fügen", "rob_fuegen"];
const MEASUREMENT_TERMS = ["messen", "rob_messen"];
const VISION_TERMS = ["vision", "rob_vision_k"];
const HANDLING_TERMS = ["greifer", "rob_greifer", "roboter", "robot"];
const FASTENING_TERMS = ["bolzen", "rob_bolzen", "fds", "rob_fds"];
const CONVEYOR_TERMS = ["foerdertechnik", "fordertechnik", "transport", "conveyor", "motor_vr", "elefant", "hubremech", "sew_amx", "sinamics"];
const ELEVATOR_TERMS = ["hubremech", "hubtor", "elefant2_amx_alh", "elefant2_amx_elh"];
const TURNING_TABLE_TERMS = ["drehtfu", "drehtisch"];
const ROTARY_DRUM_TERMS = ["trommelfu", "drehtrommel"];
const ROLLER_CONVEYOR_TERMS = ["elefant2_amx_2p", "elefant2_amx_rbock", "sew_amx2_rb_2p", "sinamics_rb", "motor_vr"];
const TRANSFER_TERMS = ["elefant2", "gw_elefant2", "amx"];
const SAFETY_GATE_TERMS = ["rolltor", "lasertor", "tor_profisafe", "fb_tor", "stb_tor", "hmi-udt_tor"];

const SEMANTIC_ALIASES: Record<string, string[]> = {
  solda: WELDING_TERMS,
  soldas: WELDING_TERMS,
  cola: GLUING_TERMS,
  colas: GLUING_TERMS,
  colagem: GLUING_TERMS,
  colagens: GLUING_TERMS,
  laser: LASER_TERMS,
  lasers: LASER_TERMS,
  estampagem: STAMPING_TERMS,
  estampagens: STAMPING_TERMS,
  estampar: STAMPING_TERMS,
  uniao: JOINING_TERMS,
  unioes: JOINING_TERMS,
  montagem: JOINING_TERMS,
  montagens: JOINING_TERMS,
  medicao: MEASUREMENT_TERMS,
  medicoes: MEASUREMENT_TERMS,
  medir: MEASUREMENT_TERMS,
  visao: VISION_TERMS,
  visoes: VISION_TERMS,
  manipulacao: HANDLING_TERMS,
  manipulacoes: HANDLING_TERMS,
  manuseio: HANDLING_TERMS,
  manuseios: HANDLING_TERMS,
  fixacao: FASTENING_TERMS,
  fixacoes: FASTENING_TERMS,
  pino: FASTENING_TERMS,
  pinos: FASTENING_TERMS,
  transportador: CONVEYOR_TERMS,
  transportadores: CONVEYOR_TERMS,
  transporte: CONVEYOR_TERMS,
  transportes: CONVEYOR_TERMS,
  elevador: ELEVATOR_TERMS,
  elevadores: ELEVATOR_TERMS,
  elevacao: ELEVATOR_TERMS,
  elevacoes: ELEVATOR_TERMS,
  levantador: ELEVATOR_TERMS,
  levantadores: ELEVATOR_TERMS,
  "mesa giratoria": TURNING_TABLE_TERMS,
  "mesas giratorias": TURNING_TABLE_TERMS,
  giratoria: TURNING_TABLE_TERMS,
  giratorias: TURNING_TABLE_TERMS,
  "posicionador rotativo": TURNING_TABLE_TERMS,
  "posicionadores rotativos": TURNING_TABLE_TERMS,
  tambor: ROTARY_DRUM_TERMS,
  tambores: ROTARY_DRUM_TERMS,
  "tambor giratorio": ROTARY_DRUM_TERMS,
  "tambores giratorios": ROTARY_DRUM_TERMS,
  esteira: ROLLER_CONVEYOR_TERMS,
  esteiras: ROLLER_CONVEYOR_TERMS,
  "linha de roletes": ROLLER_CONVEYOR_TERMS,
  "linhas de roletes": ROLLER_CONVEYOR_TERMS,
  rolete: ROLLER_CONVEYOR_TERMS,
  roletes: ROLLER_CONVEYOR_TERMS,
  transferidor: TRANSFER_TERMS,
  transferidores: TRANSFER_TERMS,
  transferencia: TRANSFER_TERMS,
  transferencias: TRANSFER_TERMS,
  porta: SAFETY_GATE_TERMS,
  portas: SAFETY_GATE_TERMS,
  "porta de seguranca": SAFETY_GATE_TERMS,
  "portas de seguranca": SAFETY_GATE_TERMS,
  "porta rolante": SAFETY_GATE_TERMS,
  "portas rolantes": SAFETY_GATE_TERMS,
  "porta laser": SAFETY_GATE_TERMS,
  "portas laser": SAFETY_GATE_TERMS,
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
  const exactTerms = SEMANTIC_ALIASES[normalized];
  if (exactTerms) return exactTerms;

  const suggestedTerms = Object.entries(SEMANTIC_ALIASES)
    .filter(([alias]) => alias.startsWith(normalized))
    .flatMap(([, terms]) => terms);
  return suggestedTerms.length ? [...new Set([normalized, ...suggestedTerms])] : [normalized];
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
