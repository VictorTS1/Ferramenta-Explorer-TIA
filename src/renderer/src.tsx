import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import type { BlockRecord, BlockType, CallRecord, IndexProgress } from "../shared/types";
import { normalizeSearch, semanticTermsForQuery, translatedFolderLabel } from "../shared/semantic";
import "./styles.css";

declare global { interface Window { explorer: import("../shared/types").ExplorerApi; } }

type TreeKind = "project" | "cpu" | "program" | "folder" | "block";
interface TreeNode { id: string; label: string; kind: TreeKind; project: string; cpu?: string; folder?: string; record?: BlockRecord; children: TreeNode[]; }

const allTypes: BlockType[] = ["OB", "FB", "FC", "InstanceDB", "GlobalDB"];
const displayType: Record<BlockType, string> = { OB: "OB", FB: "FB", FC: "FC", InstanceDB: "DB de instância", GlobalDB: "DB de usuário" };

function unique(values: string[]) { return [...new Set(values)].sort((left, right) => left.localeCompare(right, "pt-BR")); }
function parseTypedNumberQuery(query: string): { kind: "FC" | "FB" | "DB"; number: string } | null {
  const match = query.match(/^\s*(FC|FB|DB)\s*(\d+)\s*$/i);
  return match ? { kind: match[1].toUpperCase() as "FC" | "FB" | "DB", number: match[2] } : null;
}
function addNode(parent: TreeNode, node: Omit<TreeNode, "children">): TreeNode {
  const found = parent.children.find((child) => child.id === node.id);
  if (found) return found;
  const added = { ...node, children: [] };
  parent.children.push(added);
  return added;
}
function buildTree(records: BlockRecord[]): TreeNode[] {
  const root: TreeNode = { id: "root", label: "", kind: "project", project: "", children: [] };
  for (const record of records) {
    const project = addNode(root, { id: `project:${record.project}`, label: record.project, kind: "project", project: record.project });
    const cpu = addNode(project, { id: `cpu:${record.project}:${record.cpu}`, label: record.cpu, kind: "cpu", project: record.project, cpu: record.cpu });
    const program = addNode(cpu, { id: `program:${record.project}:${record.cpu}`, label: "Program blocks", kind: "program", project: record.project, cpu: record.cpu });
    let parent = program;
    let folderPath = "";
    for (const segment of record.folder.split("/").filter(Boolean)) {
      folderPath = folderPath ? `${folderPath}/${segment}` : segment;
      parent = addNode(parent, { id: `folder:${record.project}:${record.cpu}:${folderPath}`, label: translatedFolderLabel(segment), kind: "folder", project: record.project, cpu: record.cpu, folder: folderPath });
    }
    addNode(parent, { id: `block:${record.id}`, label: `${record.type}${record.number || ""} — ${record.name}`, kind: "block", project: record.project, cpu: record.cpu, folder: record.folder, record });
  }
  const sortNode = (node: TreeNode) => { node.children.sort((left, right) => (left.kind === "block" ? 1 : 0) - (right.kind === "block" ? 1 : 0) || left.label.localeCompare(right.label, "pt-BR")); node.children.forEach(sortNode); };
  sortNode(root);
  return root.children;
}
function TreeItem({ node, expanded, selectedId, onToggle, onSelect }: { node: TreeNode; expanded: Set<string>; selectedId: string; onToggle: (id: string) => void; onSelect: (node: TreeNode) => void }) {
  const hasChildren = node.children.length > 0;
  const isOpen = expanded.has(node.id);
  return <li><div className={`tree-row ${selectedId === node.id ? "tree-selected" : ""} ${node.kind}`}>{hasChildren ? <button className="tree-toggle" onClick={() => onToggle(node.id)} aria-label={isOpen ? "Recolher" : "Expandir"}>{isOpen ? "⌄" : "›"}</button> : <span className="tree-spacer" />}<button className="tree-label" onClick={() => onSelect(node)}>{node.label}</button></div>{hasChildren && isOpen && <ul>{node.children.map((child) => <TreeItem key={child.id} node={child} expanded={expanded} selectedId={selectedId} onToggle={onToggle} onSelect={onSelect} />)}</ul>}</li>;
}

function App() {
  const [records, setRecords] = useState<BlockRecord[]>([]);
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [selected, setSelected] = useState<BlockRecord | null>(null);
  const [project, setProject] = useState(""); const [cpu, setCpu] = useState(""); const [treeFolder, setTreeFolder] = useState("");
  const [treeSelectedId, setTreeSelectedId] = useState(""); const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [type, setType] = useState<"" | BlockType>(""); const [query, setQuery] = useState("");
  const [progress, setProgress] = useState<IndexProgress>({ phase: "checking", current: 0, total: 0, message: "Preparando…" });
  const [error, setError] = useState(""); const [reused, setReused] = useState(false); const [callQuery, setCallQuery] = useState("");
  const [callerType, setCallerType] = useState<"" | BlockType>(""); const [showInfrastructure, setShowInfrastructure] = useState(false);

  useEffect(() => { const unsubscribe = window.explorer.onProgress(setProgress); void load(); return unsubscribe; }, []);
  async function load(force = false) { setError(""); setSelected(null); try { const result = await window.explorer.loadIndex(force); setRecords(result.index.records); setCalls(result.index.calls); setReused(result.reused); } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível criar o índice."); setProgress({ phase: "error", current: 0, total: 0, message: "Falha ao carregar as referências." }); } }

  const projects = useMemo(() => unique(records.map((record) => record.project)), [records]);
  const cpus = useMemo(() => unique(records.filter((record) => !project || record.project === project).map((record) => record.cpu)), [records, project]);
  const tree = useMemo(() => buildTree(records), [records]);
  const filtered = useMemo(() => {
    const typedNumberQuery = parseTypedNumberQuery(query); const normalizedQuery = normalizeSearch(query.trim());
    const base = records.filter((record) => (!project || record.project === project) && (!cpu || record.cpu === cpu) && (!treeFolder || record.folder === treeFolder || record.folder.startsWith(`${treeFolder}/`)) && (!type || record.type === type));
    if (typedNumberQuery) return base.filter((record) => (typedNumberQuery.kind === "DB" ? record.type === "InstanceDB" || record.type === "GlobalDB" : record.type === typedNumberQuery.kind) && record.number === typedNumberQuery.number);
    if (!normalizedQuery) return base;
    const terms = semanticTermsForQuery(query);
    const direct = base.filter((record) => { const haystack = normalizeSearch(`${record.name} ${record.folder} ${record.relativePath}`); return terms.some((term) => haystack.includes(term)); });
    if (terms.length === 1) return direct;
    const targets = new Set(direct.filter((record) => record.type === "FB" || record.type === "FC").map((record) => `${record.project}|${record.cpu}|${record.type}|${record.name}`));
    const callers = new Set(calls.filter((call) => targets.has(`${call.project}|${call.cpu}|${call.calleeType}|${call.calleeName}`)).map((call) => call.callerBlockId));
    return base.filter((record) => direct.some((match) => match.id === record.id) || callers.has(record.id));
  }, [records, calls, project, cpu, treeFolder, type, query]);
  const incomingCalls = useMemo(() => {
    if (!selected || (selected.type !== "FB" && selected.type !== "FC")) return [];
    const normalizedQuery = normalizeSearch(callQuery.trim());
    return calls.filter((call) => call.project === selected.project && call.cpu === selected.cpu && call.calleeName === selected.name && call.calleeType === selected.type && (!callerType || call.callerType === callerType) && (showInfrastructure || !call.isInfrastructure) && (!normalizedQuery || normalizeSearch(`${call.callerName} ${call.title} ${call.comment} ${call.callerRelativePath}`).includes(normalizedQuery)));
  }, [calls, selected, callerType, showInfrastructure, callQuery]);
  function chooseProject(value: string) { setProject(value); setCpu(""); setTreeFolder(""); setTreeSelectedId(""); }
  function selectTreeNode(node: TreeNode) { setTreeSelectedId(node.id); setProject(node.project); setCpu(node.cpu ?? ""); setTreeFolder(node.folder ?? ""); if (node.record) setSelected(node.record); }
  function toggleTreeNode(id: string) { setExpandedNodes((current) => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next; }); }
  function clearTreeSelection() { setProject(""); setCpu(""); setTreeFolder(""); setTreeSelectedId(""); }
  const isLoading = progress.phase === "checking" || progress.phase === "indexing";

  return <main><header><div><p className="eyebrow">REFERÊNCIAS LOCAIS</p><h1>Explorer TIA</h1><p className="subtitle">Blocos, bancos de dados e relações dos projetos de armação.</p></div><button className="primary" onClick={() => void load(true)} disabled={isLoading}>Reindexar</button></header><section className="status" aria-live="polite"><span className={`indicator ${progress.phase}`} /><span>{progress.message}</span>{progress.total > 0 && <span className="muted">{progress.current}/{progress.total}</span>}{reused && <span className="cache">índice local reutilizado</span>}</section>{error ? <section className="empty error"><h2>Não foi possível abrir as referências</h2><p>{error}</p><p>Verifique se a pasta <code>refs/</code> existe na raiz do projeto.</p></section> : <><section className="filters" aria-label="Filtros de pesquisa"><label>Projeto<select value={project} onChange={(event) => chooseProject(event.target.value)}><option value="">Todos os projetos</option>{projects.map((value) => <option key={value}>{value}</option>)}</select></label><label>CPU<select value={cpu} onChange={(event) => setCpu(event.target.value)}><option value="">Todas as CPUs</option>{cpus.map((value) => <option key={value}>{value}</option>)}</select></label><label>Categoria<select value={type} onChange={(event) => setType(event.target.value as "" | BlockType)}><option value="">Todos os tipos</option>{allTypes.map((value) => <option key={value} value={value}>{displayType[value]}</option>)}</select></label><label className="search">Pesquisar<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nome, FC13, solda ou transportador" /></label></section><section className="workspace"><aside className="tree-panel"><div className="tree-heading"><strong>Estrutura do projeto</strong>{treeSelectedId && <button onClick={clearTreeSelection}>Limpar</button>}</div><ul className="tree">{tree.map((node) => <TreeItem key={node.id} node={node} expanded={expandedNodes} selectedId={treeSelectedId} onToggle={toggleTreeNode} onSelect={selectTreeNode} />)}</ul></aside><section className="content"><div className="results"><div className="result-heading"><strong>{filtered.length} resultados</strong><span>{records.length} registros no índice</span></div><div className="table-wrap"><table><thead><tr><th>Nome</th><th>Número</th><th>Tipo</th><th>Linguagem</th><th>Projeto</th><th>CPU</th><th>Pasta</th></tr></thead><tbody>{filtered.map((record) => <tr key={record.id} className={selected?.id === record.id ? "selected" : ""} onClick={() => setSelected(record)}><td>{record.name}</td><td>{record.number || "—"}</td><td><span className="type">{displayType[record.type]}</span></td><td>{record.language}</td><td>{record.project}</td><td>{record.cpu}</td><td title={record.folder}>{record.folder || "—"}</td></tr>)}</tbody></table></div>{!isLoading && filtered.length === 0 && <p className="no-results">Nenhum bloco corresponde aos filtros atuais.</p>}</div><aside className="details">{selected ? <><p className="eyebrow">DETALHES DO BLOCO</p><h2>{selected.name}</h2><dl><dt>Número</dt><dd>{selected.number || "—"}</dd><dt>Tipo</dt><dd>{displayType[selected.type]}</dd><dt>Linguagem</dt><dd>{selected.language}</dd><dt>Projeto</dt><dd>{selected.project}</dd><dt>CPU</dt><dd>{selected.cpu}</dd><dt>Pasta</dt><dd>{selected.folder || "Raiz de Program blocks"}</dd><dt>XML</dt><dd className="path">{selected.relativePath}</dd></dl>{(selected.type === "FB" || selected.type === "FC") && <section className="callers"><div className="callers-heading"><strong>Chamado por</strong><span>{incomingCalls.length} ocorrências</span></div><label className="call-search">Filtrar chamadas<input value={callQuery} onChange={(event) => setCallQuery(event.target.value)} placeholder="Bloco, título ou comentário" /></label><label>Tipo do chamador<select value={callerType} onChange={(event) => setCallerType(event.target.value as "" | BlockType)}><option value="">Todos</option><option value="OB">OB</option><option value="FB">FB</option><option value="FC">FC</option></select></label><label className="checkbox"><input type="checkbox" checked={showInfrastructure} onChange={(event) => setShowInfrastructure(event.target.checked)} /> Exibir chamadas de infraestrutura</label>{incomingCalls.length > 0 ? <div className="call-list">{incomingCalls.map((call) => <article className="call" key={call.id}><strong>{call.callerName}</strong><span>{displayType[call.callerType]} · {call.callerLanguage}</span><b>{call.locationLabel}</b><small>ID XML: {call.compileUnitId}</small>{call.title && <p>{call.title}</p>}{call.comment && <p className="comment">{call.comment}</p>}<code>{call.callerRelativePath}</code></article>)}</div> : <p className="no-calls">Nenhuma chamada correspondente foi encontrada.</p>}</section>}</> : <p className="placeholder">Selecione um bloco na árvore ou na tabela para consultar seus metadados.</p>}</aside></section></section></>}</main>;
}

createRoot(document.getElementById("root")!).render(<React.StrictMode><App /></React.StrictMode>);
