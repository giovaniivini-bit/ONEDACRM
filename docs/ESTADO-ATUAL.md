# Estado atual — Oneda CRM

Atualizado em 28/10/2026. Snapshot de continuidade, não monitoramento ao vivo.

## Imagens Ausentes — copiar lista de arquivos

Incluído botão Copiar lista na aba Imagens Ausentes, usando os nomes esperados
com extensão .jpg, um por linha, sem duplicatas e preservando sufixos. Respeita a
busca da lista e fica desabilitado quando não há resultados. A aba Imagens Totais
do App mantém a cópia completa existente. Reutiliza clipboard e fallback atuais.

127 testes passaram e revisão independente sem achados. Chrome com dados reais
validou 15 ausentes, busca com 1 resultado, busca vazia e cópia dos 1701 produtos
na aba total; sem erros JavaScript. Publicado no GitHub/VPS no commit 293c914.
Os 127 testes passaram na VPS, saúde OK e dados preservados. Chrome público
confirmou os mesmos cenários. Backup: /home/ubuntu/backups/oneda-crm-copy-missing-20261028-293c914.

## Raio X — botão azul sem expansão

Corrigida expansão de Detalhes da OP causada por flex:1 compartilhado com outras
galerias e pelo alinhamento stretch da grade. Somente #raioXGallery usa cards no
início da linha e botão de34px sem crescimento. Cards com menos informações ficam
compactos. Sem alteração de dados, cruzamento ou impressão.

126 testes passaram. Chrome com dados reais mediu395botões, todos34px, nos temas
claro/escuro; verificado modo impressão sem botões. Captura dos quatro produtos da
imagem do usuário conferida. Sem errosJavaScript. Publicado no GitHub/VPS no
commit7baf70c. Os126testes passaram na VPS; saúde OK e dados preservados no pull.
Chrome público confirmou395botões com34px e impressão sem botões.
Backup: /home/ubuntu/backups/oneda-crm-raio-button-20261028-7baf70c.

## Raio X — cruzamento com planilhas de cores e aviamentos

Complementos somente para produtos com D01 (cores) ou X01 (aviamentos), com linha
útil correspondente em PRODUTO na planilha do CRM. Comparação exata de código
completo (trim/maiúsculas), preservando sufixos/hífens. Planilhas não têm OF: mesma
informação de produto pode complementar suas OFs, sem alterar a chave OF+código do
Raio X. Não cria pendência nem a resolve porque existe envio ao cliente.

Cor: nome e Pantone. Aviamento: tipo e descrição. Cada linha preservada separadamente.
Prioridade ENV CLIENTE/ENV. CLIENTE; se ausente/traço/erro de célula, PREVISÃO; se
ambos ausentes mas há descrição, informa que envio/previsão não foram informados.
Sem informação útil ou sem correspondência: nenhum bloco extra. Valores mantidos
como na fonte, sem inventar datas. Conteúdo escapado. Carregamento/atualização de
planilhas refaz Raio X aberto, inclusive mudança isLive; cache identificado quando
usado. Filtros e pendências originais preservados; impressão clona complementos.

126 testes passaram e revisão independente aprovada. Novo smoke controlado em
scripts/smoke-raio-x-sheets.cjs valida chegada tardia, sufixos, prioridade, fallback,
ausência, escaping, clonagem PDF e restauração. Chrome com base real397cards:
10produtos com cores localizadas,16com aviamentos;49pendências sem linha útil não
criam bloco. PDF de6produtos com mais detalhes contém14itens em2folhas, margens
textuais mínimas11,91mm; renderização conferida, sem errosJS.
Publicado no GitHub/VPS no commit d718786. Os 126 testes passaram na VPS; saúde OK
e dados operacionais preservados. Chrome público confirmou os397cards e os mesmos
cruzamentos; smoke controlado passou também na URL publicada.
Backup: /home/ubuntu/backups/oneda-crm-raio-sheet-details-20261027-d718786.

## Aviamentos Pendentes — planilha completa na tela

Tabela da planilha agora deriva todas as colunas da fonte, na ordem original
(união de cabeçalhos), em vez de nove campos fixos. Inclui solicitado, previsão,
dias2, recebido, envio ao cliente, data aprovado e observações. Todos os registros
recebidos aparecem (removido limite50). Aprovação vazia/traço mostra Pendente em
vermelho, corrigindo destaque verde anterior para texto Pendente.

Descrições/observações têm quebra de linha sem ellipsis; datas preservadas como
texto da planilha e zero não vira vazio. Cabeçalhos/células escapados. Rolagem
horizontal/vertical interna e cabeçalho fixo, CSS restrito ao módulo/tabela. API,
planilha não alterados nessa etapa; cruzamento do Raio X implementado depois,
conforme seção acima.

121 testes passaram; revisão independente aprovada. Chrome comparou1995células
(133registros×15colunas) com API atual, temas claro/escuro, contêiner no celular,
rolagem, aprovação em branco, linha após50, zero e payloadHTML escapado. Sem erros
JavaScript. Publicado no GitHub/VPS no commit 26010d1. Os 121 testes passaram na VPS;
saúde OK e dados preservados no pull. Chrome público confirmou 133 registros,15 colunas
e 1995 células correspondentes à fonte sem erros JavaScript.
Backup: /home/ubuntu/backups/oneda-crm-aviamentos-full-20261027-26010d1.

## Prog Feira — contador por grupo de etiqueta

Contador próximo ao seletor de etiquetas, agrupa pelos primeiros dois caracteres
(CF reúne CFA/CFAN etc.; CG reúne CGA/CGX etc.). Contagem por produto, não peças,
e deduplica produto dentro de cada grupo mesmo com várias etiquetas do prefixo.
Base é o conjunto visível após todos os filtros, inclusive etiquetas e setor D36.
Prefixos em ordem alfabética, tooltip lista códigos presentes; Sem etiqueta quando
aplicável e estado vazio explícito. Não adiciona filtros novos nem altera seleções.
Oculto na impressão para preservar paginação vigente.

121 testes passaram; revisão independente aprovada. Chrome confirmou contagens e
atualizações por programação, setor principal, cor e etiqueta; limpeza, temas,
celular, vazio e impressão, sem erros JavaScript. Snapshot consultado: CF68 e CG56
(valores dinâmicos, não monitoramento). Publicado no GitHub/VPS no commit fd0d288.
Os 121 testes passaram na VPS; saúde OK e dados preservados no pull. Chrome na
URL pública repetiu os filtros e contagens sem erros JavaScript.
Backup: /home/ubuntu/backups/oneda-crm-prog-label-groups-20261027-fd0d288.

## Prog Feira — cores dos dias D43

Número de dias do tingimento: M00 vermelho piscante, M01 azul fixo, M02 laranja
piscante, M03 verde fixo. Animação somente no número D43, não altera D36. Cores
ajustadas nos temas claro/escuro; impressão e redução de movimento não piscam.
119 testes passaram; revisão independente aprovada. Chrome validou quatro setores,
cores calculadas, animações, D36 estático e impressão estática, sem erros JavaScript.
Publicado no GitHub/VPS no commit e3d1979. Os 119 testes passaram na VPS,
saúde OK e dados preservados no pull. Chrome no CRM público confirmou os quatro
estados, cores, animações e impressão sem erros JavaScript.
Backup: /home/ubuntu/backups/oneda-crm-prog-d43-colors-20261027-e3d1979.

## Prog Feira — quadros A4 e filtro de etiquetas

Mídia em tela tem proporção fixa A4 paisagem297/210, mesma largura/altura por card,
object-fit:contain para imagens verticais/horizontais sem cortar. Substitui altura
natural variável. Etiqueta vem da coluna Etiqueta do FE/D36, código no card junto à
Programação. Valores de grades diferentes preservados/deduplicados no mesmo card.

Filtro Etiquetas alfabético e multisseleção (OU), cruzado com programa/setores/busca.
Opções e contagens usam os demais filtros, sem excluir opções pela seleção da própria
etiqueta; selecionadas ausentes permanecem com zero para desmarcar. Sem etiqueta
quando houver produtos sem código. Limpar global remove seleção; limpar Etiquetas
preserva os demais filtros. Resumo e PDF respeitam a seleção.

API inclui somente ETIQUETA na whitelist; schema4 renova cache que não tinha coluna.
Cache indisponível suspende seleção, em vez de confundir com Sem etiqueta.
119 testes passaram; revisão independente aprovada. Chrome com base186produtos e
26etiquetas validou ordem, múltiplas, faceta01B, custoDES, limpeza, celular e cores;
quadros A4 iguais medidos para todas as mídias. PDF oito cards/uma folha sem corte
de complementos. Publicado no GitHub/VPS no commit 0b9477d.
Os 119 testes passaram na VPS, saúde OK e dados preservados. API pública schema4
com labelColumnAvailable=true; Chrome repetiu a validação das 26 etiquetas, seleção
múltipla, facetas, mídias A4 e impressão sem corte/erros JavaScript.
Backup: /home/ubuntu/backups/oneda-crm-prog-labels-a4-20261027-0b9477d.

## Prog Feira — filtros por fluxo e card organizado

Filtros separados Setores cor (D01/D02), Setores ting. caseiro (M00–M03) e Setores
custo (DES/PCO/ENG/CTO/FIM), incluindo Sem informação. Substituem seletor antigo de
tingimento e botão exclusivo DES; cruzam por AND com programação, setor principal
e busca. Valores vêm dos estados atuais completos por parte/fluxo, inclusive estados
resolvidos, e não apenas das pendências do card. Estado vazio é ausência, não opção
selecionável. Limpar restaura todos; seleção também consta no resumo impresso.

Foto inteira ocupa largura do card com altura proporcional em tela. Dados agrupados;
tempos D36 e D43 em duas colunas, números30px alinhados, sem inventar dias para data
ausente. Sem contagem de dias nos demais fluxos. PDF mantém oito cards e compacta
somente o tamanho da foto/tempos para preservar todos os complementos.

116 testes passaram; revisão independente aprovada. Chrome com base186produtos:
CorD01=109; +TFM02=21; +CustoDES=20. Conferidos filtro combinado/programação,
resolvidos/ausência, limpeza, temas e celular. Card01.18.00.7936:11diasD36/7diasD43,
alinhamento e largura da imagem medidos. PDF de oito cards em uma página conferido,
sem corte de complementos. Publicado no GitHub/VPS no commit a2e325b.
Os 116 testes passaram na VPS; dados preservados no pull e saúde OK. Chrome no
CRM público repetiu filtros, alinhamento11/7dias, foto inteira e impressão sem erros.
Backup: /home/ubuntu/backups/oneda-crm-prog-flow-filters-20261027-a2e325b.

## Prog Feira — dias no tingimento TF

Tingimento M00/M01/M02/M03 exibe dias no setor junto ao badge existente, usando
Data Saída somente das linhas TF/D43 do estado selecionado. Se houver grades com
datas distintas, conserva maior permanência; data ausente não inventa zero.
D36 mantém sua contagem. Cor, custo e aviamento não mostram dias. Filtros atuais
preservados. 113 testes passaram, revisão independente aprovada; ajuste de foto
somente na impressão para acomodar o badge sem cortar complementos.
Publicado no GitHub/VPS no commit 005f4b2. Os 113 testes passaram na VPS,
saúde OK e dados operacionais preservados no pull. Chrome no CRM público
confirmou dias TF, filtros, complementos e impressão sem cortes/erros JavaScript.
Backup: /home/ubuntu/backups/oneda-crm-prog-tf-days-20261027-005f4b2.

## Prog Feira — nova exportação com partes e fluxos paralelos

Fonte ERP detalhada na mesma planilha. Cards/contagens somente FE/D36 com saldo
pendente, chave OF+código completo. Descrição2 alimenta Programação (multisseleção
+VAZIO); Ficha segue como entrega. Fluxos complementares apenas em linhas empilhadas
no card: COR D01 (CO/D41), CUSTO DES/PCO/ENG/CTO (D6/D35), TINT. CASEIRA M00/M02
(TF/D43), AVIAMENTO X01 (AV/D47). D02/X02/FIM não exibidos como pendência; ausência
não é resolução nem M00. Tingimento mantém badge/filtro do estado informado.

Adaptador e consolidação em prog-feira.js compartilhados com server.js. API projeta
somente campos operacionais permitidos (sem preços/PII), conserva partes/fluxos;
cache schema3 força releitura do formato anterior. Exportação válida sem FE ativa
retorna zero cards em vez de reter pendências antigas. Compatibilidade com TIPO1/2/3
preservada. Grades deduplicadas por cor/tamanho; não soma outras partes/fluxos.
Caso múltiplos setores FE: um card no primeiro setor da ordem D36; mainSectors
conserva demais vínculos. Base observada tem somente um setor FE por produto.

112 testes passaram; revisão independente aprovada. Chrome com base real4902linhas
validou186cards, programações (120VAZIO), multi/vazio, DES, tingimento sem informação,
pendências empilhadas, temas claro/escuro e celular sem overflow. PDF amostra de oito
cards conferido sem corte das pendências e sem folha exclusiva do resumo de filtro.
Publicado no GitHub/VPS no commit624dce5;112testes passaram também na VPS,
saúde OK e dados preservados no pull. Chrome público confirmou filtros e186cards.
Backup: /home/ubuntu/backups/oneda-crm-prog-parallel-20261027-624dce5.

## Raio X — filtros de cor e aviamento inclusivos

Causa: Só cor/Só aviamento reutilizavam a regra exclusiva do Setor01, excluindo
produtos com ambas pendências. Raio X agora usa Com cor e Com aviamento inclusivos;
Cor e aviamento exige ambas e Sem cor e aviamento exige nenhuma. O helper recebe
opção explícita somente no Raio X; comportamento exclusivo do Setor01 preservado.

107 testes passaram; revisão independente aprovada. Chrome com dados reais validou
o produto01.16.00.7896 OF 77817 (setores01,D01,X01) nos três filtros e ausência em
Nenhuma. Conferidas também as contagens globais dos quatro filtros (base409), sem
erros JavaScript. Versões dos três scripts atualizadas para evitar cache antigo.
Publicado no GitHub e VPS no commit d956e40. Os 107 testes passaram na VPS;
saúde OK e dados operacionais preservados. Chrome no CRM público confirmou
OF 77817 nos filtros Com cor, Com aviamento e Ambas, e ausência em Nenhuma.
Backup: /home/ubuntu/backups/oneda-crm-raio-pending-20261027-d956e40.

## Raio X — impressão com margem segura e textos legíveis

Página A4 paisagem com margem real de 12mm, sobrepondo a regra global de margem
zero. Até seis cartões por grupo (três colunas), fotos de 33mm e texto em campos
separados: setores/dias, estilo, modelagem, aviamento/cor e malote. Alturas automáticas,
quebra de texto e sem recorte de conteúdo. Tela original e filtros preservados.
Textos são escapados; IDs removidos nas cópias; fallback de imagens preservado.

106 testes passaram. Revisão independente sem Critical/Important. Smoke de browser
com 409 produtos atuais validou filtros, 24 com ambas pendências, 37 malotes,
conteúdo denso, fallback e limpeza após impressão. Amostra de 17 cards gerou três
folhas físicas (6/6/5); renderização conferida e menor margem textual medida 11,91mm.
Conteúdo excepcionalmente longo pode ocupar folhas adicionais, sem ser ocultado.
Publicado no GitHub e VPS no commit 4945946. Os 106 testes passaram também na
VPS; hash dos dados operacionais preservado no pull; somente CRM reiniciado,
saúde OK. Chrome no CRM público repetiu 17 produtos em 3 folhas sem erros JS.
Backup: /home/ubuntu/backups/oneda-crm-raio-safe-20261026-4945946.

## Prog Feira — barras de distribuição por setor

Cada setor agora mostra coluna vertical proporcional, quantidade acima e percentual
abaixo, na ordem D36. Escala comum de quantidade, linhas de grade e rolagem
horizontal em telas menores, mantendo a paleta azul do módulo.
Considera programação, busca, tingimento e DES; o filtro de setor atua nas fichas,
sem colapsar a comparação entre setores. Contagem por referência atual (TIPO 1),
não soma de peças QTDE_PEND. Setores extras são incluídos; vazio tem 0% seguro.
Layout responsivo, temas claro/escuro, botões acessíveis. Gráfico oculto no PDF
para preservar oito fichas por página. 96 testes passaram; revisão independente
sem achados. Chrome com dados reais: total109, B43=38; soma das participações100%,
clique por setor validado, celular sem overflow, impressão e JS sem erros.
Ajuste para colunas verticais validado em Chrome, com 96 testes e revisão
independente aprovada. Publicado no GitHub/VPS no commit 65d437f;
96 testes passaram na VPS, saúde OK e dados preservados no pull. Chrome na URL
pública confirmou filtros, colunas, temas, celular e impressão sem erros.
Backup: /home/ubuntu/backups/oneda-crm-prog-columns-20261020-65d437f.
Versão anterior publicada no GitHub e VPS no commit e4ef05a. Os 96 testes passaram também na
VPS; SHA-256 confirmou preservação dos dados no pull. Somente CRM reiniciado,
saúde OK. Chrome repetiu as validações na URL pública sem erros JavaScript.
Backup: /home/ubuntu/backups/oneda-crm-prog-chart-20261020-e4ef05a.

## Prog Feira — filtro Programação

Filtro multisseleção baseado em COD_CLIENTE das linhas TIPO 1. Seleções são
combinadas por OU e cruzadas com busca, setor, tingimento e DES. Células vazias
aparecem como VAZIO / Sem programação; nenhuma seleção significa Todas.
Valores completos são preservados (B43 e B43 (W.ROT) são opções distintas).
ORDEM das linhas TIPO 2 continua sendo exibida separadamente nos cards.
API mantém projeção pública sem preços/IDs. Cache antigo sem a coluna força
nova leitura; se indisponível, suspende o filtro e informa a situação.
Resumo da seleção também aparece no PDF; checkboxes são ocultados na impressão.

95 testes passaram na VPS, revisão independente aprovada. Chrome isolado validou
seleção simples/múltipla, vazio, cruzamento com setor e limpeza com fixture da
planilha real acrescida de três linhas sintéticas. Snapshot real: 51 produtos,
48 B43 e 3 B43 (W.ROT). VAZIO permanece disponível mesmo com zero produtos.
Publicado no GitHub e VPS (commits 9fabe17 e 7d7d334), somente CRM reiniciado,
saúde OK. SHA-256 confirmou dados operacionais preservados durante o pull.
Chrome no CRM público confirmou B43=48, seleção múltipla=51, VAZIO=0 e
limpeza=51, sem erros JavaScript. Cache atualizado com COD_CLIENTE real.
Backup: /home/ubuntu/backups/oneda-crm-prog-program-20261020-7d7d334.

## MPO — filtros de pendência e entrega publicados

Implementados nove grupos independentes: terceiros/combinação para Joyce, Rayza e Ana,
Quadro, Mesa de Amostra e Sem Pendências. Cruzam com responsável, entrega e busca;
trocar responsável e sincronizar preservam as demais seleções. Limpar filtros remove
as seleções. Imagens agrupadas por data por padrão, com opção de grade. Cada pendência
tem bloco separado no card. Não se presume ano/atraso para datas sem ano.

Arquivos: `mpo-filters.js` (helper testável), `mpo-view.js`, `style.css`, `index.html`,
whitelist estática em `server.js`, testes MPO e de versões CSS. Nenhuma alteração no MPO.
91 testes passaram; revisão independente sem Critical/Important. Chrome headless com
dados reais validou 70 fichas, Ana 12, combinação 11, terceiros 6; Ana + terceiros +
30/10 = 5 fichas. Validou Ana + Quadro, sincronização mantendo filtros, alternância
grade/entregas, busca sem resultado e limpeza. Contagens são snapshot, não monitoramento.

Commit `df901de`, publicado no GitHub e na VPS em 14/10/2026. Os 91 testes passaram
também na VPS; SHA-256 confirmou preservação dos arquivos operacionais no pull.
Reiniciado somente `oneda-crm-app`; saúde OK. Helper e versões `20261014-mpo-filters-1`
servidos corretamente. Teste no CRM público repetiu as contagens acima e confirmou
os cruzamentos, a preservação das seleções e ausência de erros JavaScript.
Backup: `/home/ubuntu/backups/oneda-crm-mpo-filters-20261014-df901de`.

Próxima ação: acompanhar uso dos filtros com novas atualizações do MPO; não interpretar
datas sem ano como atraso nem somar os contadores sobrepostos de combinação/terceiros.

## PDF Andamento CQ — corrigido e publicado

Corrigida a fragmentação dos gráficos e a sobreposição na impressão do CQ. O modo
temporário `print-cq` usa página A4 paisagem com margens 8mm/12mm em todas as folhas.
Resumo/KPIs/donut na primeira página, gráfico semanal na seguinte e fotos/tabela depois.
Gráficos têm tamanho limitado e não são divididos. Fotos em quatro colunas, cartões
inteiros, tabela sem limite de altura, cabeçalhos repetidos e colunas quebráveis.
Filtros e modo Fotos/Tabela/Ambos continuam sendo respeitados e a classe é removida
ao finalizar a impressão. Corrigidos quatro rótulos com caracteres quebrados no CQ.

Arquivos: `app.js`, `style.css`, `index.html`, teste comportamental de impressão e
testes de versão do CSS. 89 testes passaram. Revisão independente sem Critical/Important.
PDFs gerados em Chrome headless isolado com os dados reais: 378 OFs, 45 pendentes e
45 fotos carregadas. Conferidos resumo, gráfico, fotos e última OF 62167 no modo Ambos.
O número de páginas varia conforme os filtros e o modo de exibição.

Commit `6e305f7`, publicado no GitHub e na VPS em 14/10/2026. Os 89 testes passaram
também na VPS. SHA-256 confirmou que o pull preservou os dados operacionais existentes;
reiniciado somente `oneda-crm-app`. Saúde no endereço público OK e versões JS/CSS
`20261014-cq-print-1` confirmadas. Backup:
`/home/ubuntu/backups/oneda-crm-cq-pdf-20261014-6e305f7`.
Conferência de texto do PDF Ambos encontrou todas as 45 OFs esperadas, sem omissões.

Próxima ação: usar Gerar PDF no CQ com os filtros desejados. Novas alterações precisam
preservar a paginação e validar fotos e a última linha da tabela.

## Sincronização MPO — publicada e validada

O usuário esclareceu que o MPO guarda pendências e fichas, sem divisão confiável por
programação. Implementado botão **Sincronizar MPO** e removida a exigência B41/B42.
Backend consulta `/api/crm/all-summaries`, inclui todas as fontes e consolida cópias
de conteúdo idêntico. `GET /api/mpo` e `/api/mpo/pending-by-person` expõem o mesmo
contrato. Snapshot dedicado `data/mpo_snapshot.json` mantém a última leitura válida
com data e aviso explícito em falhas; arquivos de imagens continuam no MPO.

Arquivos: `mpo-integration.js`, `mpo-view.js`, `server.js`, `index.html`, `style.css`,
`light-theme.css`, `.gitignore`, testes MPO e versões de CSS, docs MPO/memória/estado.
88 testes passaram. Sintaxe JS e diff conferidos. Revisão independente encontrou
fallback com índice incorreto em cards sem imagem e cache do script antigo; ambos
foram corrigidos, incluindo teste de regressão e novas versões dos assets.
Prévia no Chrome com resposta real validou Ana (6), busca 7888, imagem carregada,
previsão, observação e link de folha. A resposta real tinha 73 fichas distintas,
30 pendentes e 36 cópias unidas; Joyce 23, Rayza 0, Ana 6, Quadro 24, Mesa 0.

Inspeção da VPS confirmou serviço Python MPO e três fontes internas. O endpoint
`/api/mpo/pending-by-person` citado pelo README Antigravity não existia no CRM servido.
A integração aqui implementada fornece essa rota. Nenhum código ou dado MPO alterado.

Commit `1377ba2`, publicado no GitHub e na VPS em 12/10/2026. Os 88 testes também
passaram na VPS; verificação por SHA-256 confirmou preservação dos arquivos operacionais
durante a atualização. Reiniciado somente `oneda-crm-app`. Saúde CRM OK e API MPO
respondeu sem contingência: 73 fichas, 30 pendentes e links de imagem nas 73.
Tela pública validada no Chrome: filtros, busca 7888, imagem carregada, previsão,
observação e botão Sincronizar MPO atualizando a data (22:38:07 → 22:38:29).
Backup de código e verificações: `/home/ubuntu/backups/oneda-crm-mpo-20261012-1377ba2`.

Próxima ação: acompanhar o uso com novas atualizações de pendências/PDFs no MPO.
O layout geral em viewport móvel ainda apresentou largura excedente; esta rodada
validou a tela funcional em desktop, sem alterar o layout global do CRM.

## Imagens operacionais

Última conferência em 09/10/2026 registrou 495 no PC, VPS e índice. Syncthing foi
reativado; início automático configurado sem teste de reboot. Esses números não
foram revalidados nesta rodada e não representam monitoramento atual.

## Limitações

- A API pode expor conjuntos antigos junto com o atual. Não se presume qual é novo;
  registros de conteúdo diferente continuam visíveis.
- Nome de programação não pode ser recuperado sem vínculo guardado pelo MPO.
- Snapshot guarda textos e links, não cópias das imagens; MPO fora do ar pode impedir fotos.
- A consulta reflete somente as fichas e pendências expostas pela API MPO.

Nunca incluir senhas, tokens, chaves privadas ou conteúdo de ambiente no resumo.
