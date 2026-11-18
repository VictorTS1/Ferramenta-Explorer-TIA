# Andamento do Explorer TIA

## Funções concluídas

- Indexação de blocos de programa sob `Program blocks/`: OB, FB, FC, DB de instância e DB de usuário/global.
- Extração de projeto, CPU, pasta, nome, número técnico, tipo, linguagem e caminho do XML.
- Pesquisa por texto, projeto, CPU e categoria de bloco.
- Pesquisa técnica por `FC<número>`, `FB<número>` e `DB<número>`.
- Expansão de alguns termos semânticos em português, como solda e transportador.
- Indexação de chamadas FB/FC e exibição dos blocos chamadores, com network/unidade compilada, título, comentário e XML de origem.
- Associação de PDFs em `helps/` a blocos pelo nome técnico e abertura no visualizador padrão do Windows.
- Cache local em `output/block-index.json`, com assinatura das referências e reindexação manual.
- Aba de variáveis, com filtros por projeto, CPU e origem.
- Indexação de membros diretos de interfaces de blocos e DBs, incluindo seção, tipo e comentário.
- Indexação de tags das tabelas em `PLC tags/`, incluindo tabela, tipo, comentário e endereço lógico.
- Indexação de usos locais e globais encontrados em `Access`, preservando o caminho simbólico e a localização da ocorrência.
- Vinculação de usos à definição quando existe uma correspondência única no mesmo projeto e CPU.

## Testes realizados

- `npm test`: executado com sucesso; 10 testes automatizados aprovados.
- `npm run build`: executado com sucesso; compilação TypeScript do processo principal/preload e bundle do renderer concluídos.
- Validação em XML real de uma tabela PLC: a tag `Clock_Byte` foi extraída com nome, tipo, endereço, tabela e comentário.
- Cobertura automatizada para:
  - classificação de blocos e DBs;
  - números técnicos;
  - chamadas e localização em network;
  - marcação de chamadas de infraestrutura;
  - pesquisa semântica e associação de PDFs;
  - reutilização do cache;
  - membros diretos de interfaces;
  - tags PLC;
  - acessos locais e globais.

## Pendências em aberto

- Indexar membros aninhados de `Struct`, arrays e outros tipos compostos como definições pesquisáveis próprias.
- Resolver referências globais ambíguas e referências sem definição exportada, oferecendo uma visualização de ocorrências não vinculadas.
- Indexar UDTs e demais artefatos do TIA Portal fora de `Program blocks/` e `PLC tags/`.
- Diferenciar e ampliar a interpretação específica de estruturas Safety, especialmente `F_LAD` e `F_DB`.
- Exibir o XML de origem em modo somente leitura na interface.
- Incluir filtros adicionais nas chamadas, como tipo de bloco chamador e exibição opcional de chamadas de infraestrutura.
- Avaliar desempenho em bases maiores e considerar SQLite somente se o índice JSON deixar de ser suficiente.
- Criar empacotamento/instalador para distribuição no Windows.
