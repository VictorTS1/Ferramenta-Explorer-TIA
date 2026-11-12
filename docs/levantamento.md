# Levantamento das referências TIA

## Escopo analisado

A pasta `refs/` contém seis exportações de projeto TIA Portal (`.ap17`), cada uma organizada por controlador e pelas categorias abaixo:

- `Program blocks/`: blocos de programa.
- `PLC data types/`: tipos de dados definidos pelo projeto.
- `PLC tags/`: tabelas de tags globais.

Foram identificados 5.250 arquivos XML. As linguagens encontradas nos metadados dos blocos são `LAD`, `SCL`, `STL`, `GRAPH`, `DB`, `F_LAD` e `F_DB`.

Os exemplos abaixo pertencem a `V6-39E231.ap17/KASTIH1-----BS1---KFU1`.

## Contexto funcional da linha

As seis referências correspondem a projetos de linhas de produção de armação automotiva. A organização funcional inclui estações e robôs, que podem ter finalidades distintas:

- robôs de manipulação;
- robôs de solda;
- robôs que combinam manipulação e solda;
- células de solda estacionária.

Essa classificação é contexto de processo fornecido para orientar a interpretação dos nomes, caminhos e relações entre blocos, DBs, UDTs e tags. Ela não deve ser inferida apenas pelo nome de um único bloco.

## Hierarquia dos artefatos

| Elemento | Critério de identificação |
| --- | --- |
| Projeto | Diretório de primeiro nível com extensão `.ap17`, por exemplo `V6-39E231.ap17`. |
| CPU/controlador | Primeiro diretório abaixo do projeto, por exemplo `KASTIH1-----BS1---KFU1`. Esse diretório delimita os artefatos exportados para uma CPU. |
| Pasta de programa | Caminho abaixo de `Program blocks/`, como `ARG/40_Betriebsarten/`. Ele organiza os blocos, mas não define seu tipo técnico. |
| Bloco de programa | Arquivo em `Program blocks/`; seu tipo é confirmado pelo elemento `SW.Blocks.*` do XML. |
| DB de instância | Elemento `<SW.Blocks.InstanceDB>` com `InstanceOfName`, `InstanceOfNumber` e `InstanceOfType`, que o vinculam a um FB. |
| DB de usuário/global | Elemento `<SW.Blocks.GlobalDB>` sem vínculo `InstanceOf*`; sua estrutura é declarada diretamente em seções como `Static`. |

Os caminhos e nomes de pasta são úteis para navegação, mas a classificação deve usar o elemento XML. Assim, `SW.Blocks.InstanceDB` e `SW.Blocks.GlobalDB` têm precedência sobre os nomes `DB-Instanzen` e `DB-Anwender`.

## Categorias e exemplos

| Categoria | Arquivo | Trecho XML | Interpretação |
| --- | --- | --- | --- |
| Bloco de função (FB) | `Program blocks/VASS_V6/Spanntechnik/Ventil/FB_Ventil.xml` | `<SW.Blocks.FB ID="0">` e `<ProgrammingLanguage>SCL</ProgrammingLanguage>` | Define o FB `FB_Ventil`, implementado em SCL. |
| Função (FC) | `Program blocks/VASS_V6/ZAU/ZAU_Werte/FC_ZAU_Werte.xml` | `<SW.Blocks.FC ID="0">` e `<ProgrammingLanguage>SCL</ProgrammingLanguage>` | Define a FC `FC_ZAU_Werte`, implementada em SCL. |
| Bloco organizacional (OB) | `Program blocks/ARG/1_OB/OB1.xml` | `<SW.Blocks.OB ID="0">` e `<ProgrammingLanguage>LAD</ProgrammingLanguage>` | Define o OB1, ciclo principal em LAD. |
| Chamada de bloco | `Program blocks/ARG/1_OB/OB1.xml` | `<CallInfo Name="IBN" BlockType="FC">` | Uma rede LAD do OB1 chama a FC `IBN`. |
| Variável local | `Program blocks/VASS_V6/Spanntechnik/Ventil/FB_Ventil.xml` | `<Access Scope="LocalVariable"> ... <Component Name="bBGExxR" />` | `bBGExxR` é uma variável do contexto local do FB. |
| Acesso a membro de DB | `Program blocks/VASS_V6/Spanntechnik/Ventil/FB_Ventil.xml` | `<Component Name="DB_ARG" /> ... <Component Name="FunktionDocken" />` | Acesso simbólico ao membro `DB_ARG.FunktionDocken`. |
| Declaração de tag global | `PLC tags/Standard-Variablentabelle.xml` | `<Name>Clock_Byte</Name>` e `<LogicalAddress>%MB0</LogicalAddress>` | Declara a tag global `Clock_Byte`, do tipo `Byte`, no endereço `%MB0`. |
| Uso de tag global | `Program blocks/VASS_V6/Allgemein/Steuerung/FB_Steuerung.xml` | `<Access Scope="GlobalVariable"> ... <Component Name="Clock_Byte" />` | Lê a tag global `Clock_Byte` e a atribui ao membro `DB_ARG.Clock_Byte`. |

## Definições, chamadas e acessos

Uma definição aparece no elemento principal do arquivo, como `<SW.Blocks.FB>`, `<SW.Blocks.FC>` ou `<SW.Blocks.OB>`, acompanhado de atributos como `Name` e `ProgrammingLanguage`. Uma chamada aparece dentro de uma unidade compilada como `<Call>` e `<CallInfo Name="..." BlockType="...">`.

As declarações de variáveis pertencem à interface do bloco, em `Section` e `Member`. O código identifica os usos pelo elemento `Access`:

- `Scope="LocalVariable"`: variável do contexto local do bloco;
- `Scope="GlobalVariable"`: tag global ou referência a um DB;
- uma sequência de `Component`, como `DB_ARG` e `FunktionDocken`, representa o caminho `DB_ARG.FunktionDocken`;
- uma tag global é declarada em `PLC tags/`, por `SW.Tags.PlcTag`, `Name` e `LogicalAddress`.

## Modelo de representação no XML

Os acessos a símbolos são representados por elementos `Access`. O atributo `Scope` informa o contexto, e os elementos `Component` compõem o caminho do símbolo.

```xml
<Access Scope="LocalVariable">
  <Symbol>
    <Component Name="Position" />
  </Symbol>
</Access>

<Access Scope="GlobalVariable">
  <Symbol>
    <Component Name="DB_ARG" />
    <Component Name="FunktionDocken" />
  </Symbol>
</Access>
```

Uma `GlobalVariable` pode ser uma tag global simples, como `Clock_Byte`, ou um caminho de membro de DB, como `DB_ARG.FunktionDocken`. A ferramenta deverá tratar esses casos separadamente pelo número e pela sequência de `Component`.

## Localização de ocorrências

Cada ocorrência de lógica pertence a uma `SW.Blocks.CompileUnit`. A ferramenta deve guardar o identificador e a ordem da unidade no bloco, além de título, comentário e linguagem.

| Contexto | Marcadores XML |
| --- | --- |
| Rede LAD | `NetworkSource/FlgNet`, com `Parts` e `Wires`. Os elementos podem representar contatos, bobinas, chamadas e acessos. |
| Trecho SCL | Tokens, `Access` e constantes dentro da unidade compilada; a sequência deve ser recomposta como código. |
| Título | `MultilingualText` com `CompositionName="Title"`. |
| Comentário | `MultilingualText` ou `Comment`, com `CompositionName="Comment"`. |

As chamadas de bloco são identificadas por `CallInfo`. Para navegação, a ocorrência deve manter o bloco chamador, a unidade compilada e seu ID XML. Em LAD e F_LAD, a ordem da `CompileUnit` é apresentada como network calculada; o export não contém um número de network explícito.

## Tratamentos por linguagem e estrutura

- `LAD`: interpretar redes, partes e conexões.
- `SCL`: recompor o trecho a partir de `Token`, `Access` e constantes.
- `STL`: tratar instruções na sua representação textual própria.
- `GRAPH`: tratar etapas e transições como uma estrutura de sequência.
- `DB` e `F_DB`: interpretar a estrutura de dados, sem supor lógica executável.
- `F_LAD`: tratar como lógica Safety, separada da lógica padrão.

## Limitações atuais

- O nome e o modelo físico da CPU ainda não foram localizados; será necessário analisar a configuração de hardware exportada.
- O XML permite identificar estrutura, tipos, chamadas, nomes e endereços, mas não explica completamente a finalidade operacional de cada rede LAD, bloco GRAPH ou trecho STL.
- A semântica de blocos depende de bibliotecas VASS, UDTs, sinais de campo, relações com robôs e configuração de hardware que não foram analisados integralmente.
- Há símbolos com o mesmo nome em projetos diferentes e casos em que um nome aparece tanto como tag global quanto como membro de DB; a resolução deve sempre manter projeto, CPU e caminho simbólico completo.
- Blocos Safety (`F_LAD` e `F_DB`) requerem interpretação específica da camada Safety e não devem ser tratados como equivalentes a blocos padrão sem validação adicional.
