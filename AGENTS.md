# Repository Guidelines

## Project Structure & Module Organization

- `src/main/` contains the Electron main process, filesystem access, and XML indexing. Keep all direct reads of `refs/` here.
- `src/preload/` exposes the minimal, typed IPC bridge to the renderer. Do not expose Node or Electron APIs directly to the browser context.
- `src/renderer/` contains the React interface, styles, filters, tables, and details views.
- `src/shared/` contains interfaces used by both Electron and React, such as `BlockRecord` and index payloads.
- `tests/` contains Vitest tests. Use representative XML paths from `refs/` only when a test needs real export structure.
- `docs/` holds functional requirements and XML research. `refs/` is source material and must remain read-only; generated indexes belong in ignored `output/`.

## Build, Test, and Development Commands

```powershell
npm install       # install locked project dependencies
npm run dev       # run Vite, TypeScript watchers, and Electron
npm run build     # compile main/preload code and bundle the renderer
npm test          # execute the Vitest suite
```

Run `npm run build` and `npm test` before handing off changes. Reindexing happens in the application; it writes `output/block-index.json`, which must not be committed.

## Coding Style & Naming Conventions

Use TypeScript with strict types. Indent JSON, TypeScript, and CSS with two spaces; use semicolons and double quotes in TypeScript to match existing files. Use `PascalCase` for interfaces, types, and React components; use `camelCase` for functions, properties, and variables. Name extractor functions after their domain, for example `parseBlockXml` or `parseCallInfo`.

Keep renderer code free of filesystem APIs. Add IPC methods to `ExplorerApi` and implement them in preload and main together. Treat malformed XML as data-quality input: skip or report it without aborting a full index.

## Testing Guidelines

Use Vitest and name files `*.test.ts`. Test parser output with focused assertions for project, CPU, block type, language, and source location. Cover normal XML, missing fields, malformed/unsupported XML, cache reuse, and filter behavior. Avoid broad snapshots of the 5,250 reference files.

## Commit & Pull Request Guidelines

Recent commits use short Portuguese imperative summaries, such as `definido levantamento` and `primeira versão do projeto`. Follow that style; optional conventional prefixes are appropriate when useful, for example `feat: indexar chamadas de blocos`.

Keep each commit focused. Pull requests should explain the user-visible behavior, list validation commands, note indexing or schema changes, and include a screenshot for renderer changes. Never commit `refs/`, `output/`, `node_modules/`, or `dist/`.
