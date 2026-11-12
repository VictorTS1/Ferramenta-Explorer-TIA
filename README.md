# Ferramenta Explorer TIA

Aplicação desktop local para pesquisar blocos e bancos de dados exportados do TIA Portal.

## Executar

Requisitos: Node.js 22.9 ou superior e npm.

```powershell
npm install
npm run dev
```

A aplicação sempre lê `refs/` na raiz do projeto. Na primeira abertura, ela cria `output/block-index.json`; use **Reindexar** para recriar o cache quando os XMLs forem alterados.

## Estrutura

- `src/main/`: processo Electron e indexação dos XMLs.
- `src/preload/`: ponte segura entre Electron e interface.
- `src/renderer/`: interface React em português.
- `src/shared/`: contratos tipados compartilhados.
- `tests/`: testes do extrator.
- `docs/`: levantamento das referências.
- `refs/`: fontes XML locais, fora do Git.
- `output/`: índice e logs gerados, fora do Git.
