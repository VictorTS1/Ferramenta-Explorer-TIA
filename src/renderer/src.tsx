import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import type { BlockRecord, BlockType, CallRecord, IndexProgress } from "../shared/types";
import "./styles.css";

declare global {
  interface Window {
    explorer: import("../shared/types").ExplorerApi;
  }
}

const allTypes: BlockType[] = ["OB", "FB", "FC", "InstanceDB", "GlobalDB"];
const displayType: Record<BlockType, string> = {
  OB: "OB",
  FB: "FB",
  FC: "FC",
  InstanceDB: "DB de instância",
  GlobalDB: "DB de usuário"
};

function unique(values: string[]) {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right, "pt-BR"));
}

function App() {
  const [records, setRecords] = useState<BlockRecord[]>([]);
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [selected, setSelected] = useState<BlockRecord | null>(null);
  const [project, setProject] = useState("");
  const [cpu, setCpu] = useState("");
  const [type, setType] = useState<"" | BlockType>("");
  const [query, setQuery] = useState("");
  const [progress, setProgress] = useState<IndexProgress>({ phase: "checking", current: 0, total: 0, message: "Preparando…" });
  const [error, setError] = useState("");
  const [reused, setReused] = useState(false);
  const [callQuery, setCallQuery] = useState("");
  const [callerType, setCallerType] = useState<"" | BlockType>("");
  const [showInfrastructure, setShowInfrastructure] = useState(false);

  useEffect(() => {
    const unsubscribe = window.explorer.onProgress(setProgress);
    void load();
    return unsubscribe;
  }, []);

  async function load(force = false) {
    setError("");
    setSelected(null);
    try {
      const result = await window.explorer.loadIndex(force);
      setRecords(result.index.records);
      setCalls(result.index.calls);
      setReused(result.reused);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível criar o índice.");
      setProgress({ phase: "error", current: 0, total: 0, message: "Falha ao carregar as referências." });
    }
  }

  const projects = useMemo(() => unique(records.map((record) => record.project)), [records]);
  const cpus = useMemo(() => unique(records.filter((record) => !project || record.project === project).map((record) => record.cpu)), [records, project]);
  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR");
    return records.filter((record) =>
      (!project || record.project === project) &&
      (!cpu || record.cpu === cpu) &&
      (!type || record.type === type) &&
      (!normalizedQuery || `${record.name} ${record.folder} ${record.relativePath}`.toLocaleLowerCase("pt-BR").includes(normalizedQuery))
    );
  }, [records, project, cpu, type, query]);

  const incomingCalls = useMemo(() => {
    if (!selected || (selected.type !== "FB" && selected.type !== "FC")) return [];
    const normalizedQuery = callQuery.trim().toLocaleLowerCase("pt-BR");
    return calls.filter((call) =>
      call.project === selected.project &&
      call.cpu === selected.cpu &&
      call.calleeName === selected.name &&
      call.calleeType === selected.type &&
      (!callerType || call.callerType === callerType) &&
      (showInfrastructure || !call.isInfrastructure) &&
      (!normalizedQuery || `${call.callerName} ${call.title} ${call.comment} ${call.callerRelativePath}`.toLocaleLowerCase("pt-BR").includes(normalizedQuery))
    );
  }, [calls, selected, callerType, showInfrastructure, callQuery]);

  function chooseProject(value: string) {
    setProject(value);
    setCpu("");
  }

  const isLoading = progress.phase === "checking" || progress.phase === "indexing";
  return <main>
    <header>
      <div>
        <p className="eyebrow">REFERÊNCIAS LOCAIS</p>
        <h1>Explorer TIA</h1>
        <p className="subtitle">Blocos de programa e bancos de dados dos projetos de armação.</p>
      </div>
      <button className="primary" onClick={() => void load(true)} disabled={isLoading}>Reindexar</button>
    </header>

    <section className="status" aria-live="polite">
      <span className={`indicator ${progress.phase}`} />
      <span>{progress.message}</span>
      {progress.total > 0 && <span className="muted">{progress.current}/{progress.total}</span>}
      {reused && <span className="cache">índice local reutilizado</span>}
    </section>

    {error ? <section className="empty error"><h2>Não foi possível abrir as referências</h2><p>{error}</p><p>Verifique se a pasta <code>refs/</code> existe na raiz do projeto.</p></section> : <>
      <section className="filters" aria-label="Filtros de pesquisa">
        <label>Projeto<select value={project} onChange={(event) => chooseProject(event.target.value)}><option value="">Todos os projetos</option>{projects.map((value) => <option key={value}>{value}</option>)}</select></label>
        <label>CPU<select value={cpu} onChange={(event) => setCpu(event.target.value)}><option value="">Todas as CPUs</option>{cpus.map((value) => <option key={value}>{value}</option>)}</select></label>
        <label>Categoria<select value={type} onChange={(event) => setType(event.target.value as "" | BlockType)}><option value="">Todos os tipos</option>{allTypes.map((value) => <option key={value} value={value}>{displayType[value]}</option>)}</select></label>
        <label className="search">Pesquisar<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nome ou caminho do bloco" /></label>
      </section>

      <section className="content">
        <div className="results">
          <div className="result-heading"><strong>{filtered.length} resultados</strong><span>{records.length} registros no índice</span></div>
          <div className="table-wrap"><table><thead><tr><th>Nome</th><th>Tipo</th><th>Linguagem</th><th>Projeto</th><th>CPU</th><th>Pasta</th></tr></thead>
            <tbody>{filtered.map((record) => <tr key={record.id} className={selected?.id === record.id ? "selected" : ""} onClick={() => setSelected(record)}><td>{record.name}</td><td><span className="type">{displayType[record.type]}</span></td><td>{record.language}</td><td>{record.project}</td><td>{record.cpu}</td><td title={record.folder}>{record.folder || "—"}</td></tr>)}</tbody>
          </table></div>
          {!isLoading && filtered.length === 0 && <p className="no-results">Nenhum bloco corresponde aos filtros atuais.</p>}
        </div>
        <aside className="details">{selected ? <><p className="eyebrow">DETALHES DO BLOCO</p><h2>{selected.name}</h2><dl><dt>Tipo</dt><dd>{displayType[selected.type]}</dd><dt>Linguagem</dt><dd>{selected.language}</dd><dt>Projeto</dt><dd>{selected.project}</dd><dt>CPU</dt><dd>{selected.cpu}</dd><dt>Pasta</dt><dd>{selected.folder || "Raiz de Program blocks"}</dd><dt>XML</dt><dd className="path">{selected.relativePath}</dd></dl>
          {(selected.type === "FB" || selected.type === "FC") && <section className="callers"><div className="callers-heading"><strong>Chamado por</strong><span>{incomingCalls.length} ocorrências</span></div><label className="call-search">Filtrar chamadas<input value={callQuery} onChange={(event) => setCallQuery(event.target.value)} placeholder="Bloco, título ou comentário" /></label><label>Tipo do chamador<select value={callerType} onChange={(event) => setCallerType(event.target.value as "" | BlockType)}><option value="">Todos</option><option value="OB">OB</option><option value="FB">FB</option><option value="FC">FC</option></select></label><label className="checkbox"><input type="checkbox" checked={showInfrastructure} onChange={(event) => setShowInfrastructure(event.target.checked)} /> Exibir chamadas de infraestrutura</label>
            {incomingCalls.length > 0 ? <div className="call-list">{incomingCalls.map((call) => <article className="call" key={call.id}><strong>{call.callerName}</strong><span>{displayType[call.callerType]} · {call.callerLanguage}</span><b>{call.locationLabel}</b><small>ID XML: {call.compileUnitId}</small>{call.title && <p>{call.title}</p>}{call.comment && <p className="comment">{call.comment}</p>}<code>{call.callerRelativePath}</code></article>)}</div> : <p className="no-calls">Nenhuma chamada correspondente foi encontrada.</p>}</section>}</> : <p className="placeholder">Selecione um bloco para consultar seus metadados.</p>}</aside>
      </section>
    </>}
  </main>;
}

createRoot(document.getElementById("root")!).render(<React.StrictMode><App /></React.StrictMode>);
