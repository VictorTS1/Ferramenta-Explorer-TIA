# Como usar o Explorer TIA

Guia prático para consultar exportações XML do TIA Portal localmente. O [README.md](README.md) foi mantido como enunciado do projeto.

## Requisitos e instalação

- Windows (ambiente inicialmente suportado);
- Node.js 22.9 ou superior;
- npm;
- exportações XML em `refs/`, organizadas por projeto e CPU.

No PowerShell, na raiz do projeto:

```powershell
npm install
```

Não altere os arquivos dentro de `refs/`. A aplicação os trata como fonte somente leitura.

## Execução

Para desenvolvimento, execute:

```powershell
npm run dev
```

Na primeira abertura, a aplicação lê `refs/` e cria `output/block-index.json`. Nas próximas aberturas, o índice local é reutilizado quando os XMLs e PDFs de ajuda não mudaram.

Use o botão **Reindexar** depois de atualizar os XMLs em `refs/` ou os PDFs em `helps/`. O índice também é recriado automaticamente quando a versão do seu formato muda.

Para gerar a versão compilada:

```powershell
npm run build
```

## Consultando blocos

Na aba **Blocos**, os filtros de projeto, CPU e categoria podem ser combinados. A tabela lista OBs, FBs, FCs e DBs; ao selecionar uma linha, o painel lateral exibe os metadados, PDFs de ajuda associados e, para FBs/FCs, os locais onde foram chamados.

Exemplos de pesquisa:

| Pesquisa | Resultado esperado |
| --- | --- |
| `FC13` | FC de número técnico 13 |
| `FB200` | FB de número técnico 200 |
| `DB2010` | DB global ou de instância de número 2010 |
| `ventil` | blocos cujo nome ou caminho contém o termo |
| `solda` | blocos relacionados aos termos técnicos de solda e seus chamadores |
| `transportador` | blocos relacionados aos termos técnicos de transporte e seus chamadores |

Consultas compostas apenas por números são tratadas como texto; para procurar o número técnico, inclua o prefixo `FC`, `FB` ou `DB`.

## Consultando variáveis e tags

Na aba **Variáveis**, escolha opcionalmente projeto, CPU e origem:

- **Bloco ou DB**: membros declarados diretamente em seções como `Input`, `Output`, `InOut`, `Temp`, `Static`, `Constant` e `Return`;
- **PLC tags**: tags definidas nas tabelas XML em `PLC tags/`.

A pesquisa considera nome, caminho simbólico, tipo, comentário, bloco/tabela de origem e endereço lógico. Exemplos:

| Pesquisa | Resultado esperado |
| --- | --- |
| `Clock_Byte` | tag global e seus metadados, quando exportada |
| `DB_ARG.Reset_Ein` | membro direto de DB com esse caminho |
| `Bool` | variáveis e tags do tipo Booleano |
| `%M1.0` | tag associada ao endereço lógico |
| `telegramm` | variáveis cujo comentário contém o termo |

Ao selecionar uma variável, o painel lateral mostra sua definição e os usos resolvidos: bloco, linguagem, escopo local/global, network ou unidade compilada e caminho acessado.

PDFs colocados em `helps/` são associados a um bloco quando o nome do arquivo sem `.pdf` é igual ao nome técnico do bloco. Por exemplo, `helps/Library Types/FB_Ventil.pdf` aparecerá no detalhe de `FB_Ventil`.

## Testes

Execute a suíte automatizada com:

```powershell
npm test
```

Antes de entregar alterações, execute ambos:

```powershell
npm test
npm run build
```

Os testes cobrem classificação de blocos e DBs, chamadas, cache, pesquisa semântica, declarações diretas de variáveis, tags PLC e acessos locais/globais.

## Limitações atuais

- Apenas blocos e DBs sob `Program blocks/` e tags sob `PLC tags/` são indexados; UDTs e outros artefatos do TIA Portal não entram na pesquisa.
- Apenas membros de primeiro nível são definições pesquisáveis. Acessos a caminhos aninhados são preservados como texto, mas os membros internos de `Struct` e arrays ainda não ganham registros próprios.
- Um uso é associado a uma definição apenas quando há correspondência única de projeto, CPU e caminho simbólico. Referências ambíguas ou sem definição exportada permanecem sem vínculo para evitar falsos positivos.
- As chamadas indexadas são apenas de FBs e FCs encontradas em `CallInfo`.
- Arquivos XML malformados ou estruturas não reconhecidas podem não gerar relações completas; a aplicação continua indexando os demais arquivos sempre que possível.
- A aplicação é voltada inicialmente para Windows e não gera instalador nesta etapa.
