# Requisitos — Ferramenta Explorer TIA

## Objetivo

Desenvolver uma ferramenta desktop local para explorar e pesquisar exportações XML do TIA Portal usadas em linhas de produção de armação automotiva.

As referências representam linhas com estações e células de robôs de manipulação, robôs de solda, robôs mistos e células de solda estacionária. Esse contexto deve orientar a evolução da ferramenta, sem classificar uma célula apenas pelo nome de um bloco.

## Fonte de dados e restrições

- A aplicação é destinada inicialmente a Windows.
- A aplicação deve ser desenvolvida em TypeScript, React e Electron.
- A pasta de entrada é fixa: `refs/`, na raiz do projeto.
- Os XMLs em `refs/` devem ser tratados como somente leitura.
- As seis referências de projeto devem permanecer preservadas e fora do versionamento Git.
- A interface, filtros e mensagens de erro devem estar em português.
- Arquivos gerados localmente devem ser mantidos em `output/` e fora do Git.
- A ferramenta não deve exigir seleção manual de outra pasta de referências na primeira versão.

## Modelo de identificação

A ferramenta deve reconhecer a hierarquia dos artefatos exportados:

- projeto: diretório com extensão `.ap17`;
- CPU/controlador: diretório logo abaixo do projeto;
- pasta de programa: caminho abaixo de `Program blocks/`;
- bloco de programa: XML identificado pelo elemento `SW.Blocks.*`;
- DB de instância: `SW.Blocks.InstanceDB`, associado a um FB por `InstanceOfName`, `InstanceOfNumber` e `InstanceOfType`;
- DB de usuário/global: `SW.Blocks.GlobalDB`.

A classificação técnica deve usar o elemento XML, não somente o nome do arquivo ou da pasta.

## Primeira entrega

A primeira versão pesquisável deve indexar apenas blocos de programa e DBs sob `Program blocks/`.

Ela deve:

- identificar os tipos `OB`, `FB`, `FC`, `InstanceDB` e `GlobalDB`;
- extrair projeto, CPU, pasta, nome, tipo, linguagem e caminho do XML;
- permitir filtros por projeto, CPU e categoria/tipo de bloco;
- permitir pesquisa textual por nome e caminho;
- permitir pesquisa exata por número técnico com prefixo de tipo, como `FC13`, `FB200` e `DB2010`;
- tratar uma consulta composta somente por números como pesquisa textual, sem presumir o tipo de bloco;
- listar projeto, CPU, pasta, nome, tipo, linguagem e caminho completo;
- apresentar um painel de detalhes para o bloco selecionado;
- informar progresso, referências ausentes e falhas de leitura;
- disponibilizar uma ação de reindexação.

## Índice local

- A ferramenta deve criar um índice JSON local em `output/`.
- O índice deve ser reutilizado quando os XMLs não tiverem sido alterados.
- A ferramenta deve detectar alterações por uma assinatura baseada nos arquivos de referência.
- A ação **Reindexar** deve recriar o índice local.
- A solução inicial deve priorizar simplicidade de depuração; uma migração para SQLite só será considerada se o desempenho exigir.

## Relações de chamadas

- A ferramenta deve indexar chamadas de FB e FC encontradas em `CallInfo`.
- Para um FB ou FC selecionado, a interface deve mostrar onde ele é chamado no mesmo projeto e CPU.
- Cada ocorrência deve informar bloco chamador, tipo, linguagem, network ou unidade compilada, ID XML, título, comentário e caminho do XML.
- Para LAD e F_LAD, a localização deve ser exibida como `Network N`, calculada pela ordem da `CompileUnit` no export.
- Para SCL, STL e GRAPH, a localização deve ser exibida como unidade compilada, com sua linguagem.
- A interface deve permitir filtrar por texto e tipo de bloco chamador.
- Chamadas de infraestrutura devem permanecer no índice, mas ficar ocultas por padrão por uma opção para exibi-las.

## Evoluções previstas

Após a estabilização da primeira entrega, a ferramenta deve passar a indexar e pesquisar:

- tabelas e declarações de tags globais em `PLC tags/`;
- variáveis locais e seus usos, identificados por `Access Scope="LocalVariable"`;
- membros de DB e referências globais, preservando caminhos como `DB_ARG.FunktionDocken`;
- relações entre blocos, DBs e tags;
- localização da ocorrência dentro de uma unidade compilada: rede LAD, título, comentário ou trecho SCL;
- visualização do XML de origem em modo somente leitura.

## Regras de interpretação

- Uma definição de bloco deve ser distinguida de uma chamada de bloco: a definição está em `SW.Blocks.*`; a chamada está em uma unidade compilada como `Call` e `CallInfo`.
- Declarações de variáveis devem ser lidas na interface do bloco, em `Section` e `Member`.
- Usos de símbolos devem considerar `Access Scope` e a sequência de `Component`.
- Uma referência global simples pode ser uma tag; uma sequência de componentes pode representar um membro de DB.
- A resolução de símbolos deve preservar projeto, CPU e caminho completo, pois há nomes repetidos entre projetos e possíveis colisões entre tags e membros de DB.
- A ferramenta deve tratar LAD, SCL, STL, GRAPH, DB, F_DB e F_LAD de acordo com suas estruturas próprias.
- Blocos Safety devem permanecer distinguíveis de blocos padrão e não devem receber interpretação equivalente sem validação específica.

## Organização do código

- `src/main/`: processo Electron, acesso ao sistema de arquivos e indexação.
- `src/preload/`: ponte segura entre o processo principal e a interface.
- `src/renderer/`: interface React.
- `src/shared/`: contratos e tipos compartilhados.
- `tests/`: testes do extrator e das regras de classificação.
- `docs/`: documentação de requisitos e levantamento das referências.
