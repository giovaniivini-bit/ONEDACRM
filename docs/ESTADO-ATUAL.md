# Estado atual — Oneda CRM

## Raio X — impressão com foto e dados do card (11/11/2026)

Padrão vigente: foto e informações completas de cada card, sem painel global de
setores/filtros/KPIs. Substitui a impressão somente imagens publicada antes.
Paginação em grupos de até8 cards (quatro colunas), altura automática para não
cortar descrição, status, metadados ou complementos de cor/aviamento. Conteúdo
denso pode ocupar mais folhas. Botões interativos removidos; fotos contidas.
228 testes aprovados e revisão sem Critical/Important. PDF com10 cards reais
preservou corpos completos, status, OF e malote, sem filtros/KPIs; densidade gerou
três folhas. Espaços internos compactados e contraste dos badges corrigido.
Publicado no GitHub/VPS no commite0a6c36;228 testes passaram na VPS, saúde OK e
1.069 arquivos operacionais preservados por hash. Backup:
/home/ubuntu/backups/oneda-crm-raio-x-details-20261111-e0a6c36.

## Raio X — impressão somente imagens, 16 por folha (11/11/2026)

Layout compacto semelhante ao Prog Feira: 4×4 cards por A4 paisagem, com margem
12mm e fotos inteiras (contain). Sem painel de setores, filtros, KPIs, resumo,
textos de status ou detalhes. Respeita todos os cards atualmente filtrados na tela;
última folha pode ser parcial. Tela, filtros, imagens e dados permanecem iguais.
Substitui o formato anterior de seis cards com detalhes. Fallback e limpeza após
impressão preservados. Arquivos: app.js, style.css, index.html, test/raio-x.test.js.
228 testes passaram; revisão independente sem Critical/Important. Edge com cards
reais:33→3folhas(16/16/1),17→2(16/1),6→1. PDF extraído e renderizado confirmou
paginação sem filtros/KPIs; outra amostra carregou17 fotos reais,16na primeira folha,
inteiras e sem cortes. Tela preservada e sem erros JavaScript.
Publicado no GitHub/VPS no commitba05578; testes passaram na VPS, saúde OK e
1.067 arquivos operacionais preservados por hash. Backup:
/home/ubuntu/backups/oneda-crm-raio-x-images-20261111-ba05578.

## PDFs por estilista — um tema por folha (09/11/2026)

Substitui o espaço de meia folha: cada tema/subtema começa em folha própria,
com título no topo e cards imediatamente abaixo. Continuações mantêm alinhamento
superior e nenhum tema compartilha folha com outro. PDFs antigos preservados;
o novo layout é aplicado às próximas gerações.

## PDFs automáticos — espaço entre temas (09/11/2026)

Relatórios por estilista reservam meia área útil de folha entre temas/subtemas,
inclusive atravessando quebras, mantendo títulos junto dos cards. Relatório sem
pendências permanece compacto. 25 testes de relatórios/paginação passaram.
A alteração aplica-se a PDFs novos; versões históricas permanecem preservadas.

Atualizado em 08/11/2026. Snapshot de continuidade, não monitoramento ao vivo.

## Prog Feira — seleção múltipla de setores (08/11/2026)

Correção posterior: o helper prog-feira.js havia mantido a URL de versão antiga,
permitindo cache incompatível com app.js novo e impedindo abrir a tela em sessões
existentes. Referência atualizada para 20261108-prog-multisector-1, com regressão
da versão no HTML. 27 testes focados passaram. Correção destinada ao GitHub/VPS.

O gráfico Produtos por setor agora apresenta um flag em cada coluna e aceita mais
de um setor simultaneamente. Cliques alternam cada setor de forma independente;
os selecionados são combinados por OU, sem duplicar referências. O resumo da barra
lista os códigos ativos e oferece Mostrar todos; Limpar restaura Todos. Cards,
KPIs, etiquetas, programações, entregas e contadores acompanham a mesma seleção.

Implementação em prog-feira.js, app.js, style.css e index.html, com regressões em
test/prog-feira.test.js. 222 testes completos e 27 testes focados passaram. Revisão
independente aprovada sem Critical/Important. Navegador local com fonte ao vivo
validou 01A=60 e 01B=58 selecionados juntos, total 118, grupos corretos, temas
escuro/claro e console sem erros. Publicado no GitHub e na VPS no commit ee76cc8.
Os 222 testes passaram também na VPS; hashes dos arquivos operacionais preservados
e somente oneda-crm-app reiniciado. Backup:
/home/ubuntu/backups/oneda-crm-prog-multisector-20261108-ee76cc8. O CRM público
carregou os assets novos e confirmou 01A+01B=118, só os dois grupos e nenhum erro JS.

## Aproveitamento — data de finalização em segunda planilha (08/11/2026)

Implementação publicada e validada em GitHub/VPS, autorizada pelo usuário em 08/11/2026.
Base de código atualizada até 374d851, preservando geração manual, horários
exclusivos dos relatórios, exclusão em lote e filtro Leadtime de outros agentes.
Documentação e contratos em APROVEITAMENTO.md.

Fonte comercial mantém comprado/não comprado, PRECO_VENDA, cliente e demais campos.
Nova fonte 1bshn2-m-8O2WvkS5uX0Qbnt3YoCbGAM_gLX5pciTmsk/gid0 fornece apenas produto
e data de finalização da amostra em 01F. Cruzamento pelo código completo, com sufixos.
Nenhum uso de DATA_CAD ou DT_APROV como finalização. Atalhos/personalizado, KPIs,
gráficos, título e tabela usam a nova data. Todo período mantém a base inteira,
com título BASE COMPLETA quando há produtos sem data. Data consta na impressão.
Ausência, inválidas, conflitos e cache/indisponibilidade têm avisos explícitos.

Arquivos: aproveitamento-dates.js, aproveitamento-finalizacao.js, app.js, server.js,
index.html, style.css, .gitignore, testes Aproveitamento/rotas e smoke específico.
CSV curto/cabeçalho sem dados é válido na nova fonte, inclusive após redirecionamento;
demais fontes preservam seu limite anterior. Nova cache operacional ignorada no Git.

220 testes passaram; revisão independente aprovou após corrigir o download de CSV
curto. Edge verificou compra/preços preservados, intervalos inclusivos, cliente,
código com sufixo, fonte vazia/falha/cache, tabela, temas e celular, sem erros JS.
PDF com coluna e data individual conferido por extração. Na leitura real, 29
finalizações vinculadas a 2.097 registros; 2.068 sem data e nenhum conflito.
Nenhuma escrita feita nas planilhas. Publicado em GitHub e VPS no commit 8c928a7, em 08/11/2026 (America/Sao_Paulo), após autorização explícita do usuário. Os 220 testes passaram também na VPS; hashes confirmaram preservação de 1.697 arquivos operacionais. Backup: /home/ubuntu/backups/oneda-crm-aproveitamento-20261108-8c928a7. Reiniciado somente oneda-crm-app. Saúde OK, fonte nova ao vivo com 29 linhas, versão pública e navegador Edge confirmados: 29 vínculos/2.097 registros, coluna de finalização presente e nenhum erro JavaScript.
Atualizado em 11/11/2026. Snapshot de continuidade, não monitoramento ao vivo.

## Relatórios por estilista — produto único por tema (09/11/2026)

Consolidação por código completo e subtema na geração. Card mostra quantidade de
OFs distintas e partes por OF; grades não multiplicam partes. Mesma referência
permanece em temas diferentes, sufixos preservados. Ocorrências no snapshot,
detalhes expansíveis na tela e detalhamento textual paginado no PDF conservam
vínculos OF/parte, status, datas, quantidades e previsões. Permanência mostra
maior valor (até), com dados de cada OF consultáveis. Fotos não repetem por OF;
previsões acima20 têm continuação sem foto. PDFs antigos preservados.
228 testes aprovados, revisão independente e Edge real sem erros: Camila125→106,
Ketlyn28→14; produto01.14.00.7269H reúne duas OFs e cinco partes. PDF renderizado
conferido com ambas OFs no detalhamento. Guia RELATORIOS-AUTOMATICOS.md atualizado.
Publicado no GitHub/VPS no commit36473fb. 228 testes passaram na VPS, saúde OK,
1.026 arquivos operacionais preservados por hashes durante deploy. Novo lote de
oito relatórios gerado: unicidade código/tema validada nos quatro estilistas,
16 arquivos PDF/snapshot anteriores e ledger preservados. Edge público confirmou
106 cards de Camila e detalhes de ambas OFs, sem erros JS.
Backup: /home/ubuntu/backups/oneda-crm-reports-product-theme-20261109-36473fb.
Arquivos: stylist-reports.js, automatic-report-groups.js, automatic-reports-view.js,
automatic-reports-pdf.js, style.css, index.html e testes por estilista.

## Aproveitamento — ocultar nota técnica na impressão (09/11/2026)

Bloco aproveitamento-date-note (critério de datas, estatísticas de vínculos e link
à planilha de finalização) oculto somente na impressão, a pedido do usuário.
Tela mantém o bloco. Período, seleção de clientes e observação do usuário preservados.

## Aproveitamento — vários clientes e observação (09/11/2026)

Filtro de clientes agora tem checkboxes, Marcar todos e Limpar seleção. Seleção
múltipla usa união: Renner+C&A ou todos menos Hering. Limpar significa nenhum;
Marcar todos restaura a base e inclui clientes em atualizações. Cliques no gráfico
alternam o cliente na seleção. KPIs, gráfico, resumo e lista usam o mesmo recorte.

Campo de observação opcional até 600 caracteres, mantido no estado da tela ao
mudar filtros. Texto literal/escapado, sem HTML; digitá-lo não redesenha a tela.
Na primeira folha aparece abaixo do gráfico com fonte9pt; quebras são compactadas
para não gerar folhas por linhas vazias. Campo vazio não cria bloco impresso.
225 testes passaram; revisão independente final aprovada. Edge verificou união,
exclusão de Hering, vazio, todos e nota preservada/segura. PDFs com600 caracteres
e300 quebras de linha foram extraídos e renderizados: título, gráfico e observação
na primeira página. Arquivos: app.js, style.css, index.html e teste Aproveitamento.

## Aproveitamento — gráfico ampliado e conversão por cliente (09/11/2026)

Cartões menores no PDF; gráfico ampliado em toda a largura, cabeçalho e gráfico
mantidos na primeira página. Abaixo da participação de produtos, nova linha
Compra: percentual de amostras compradas/total do próprio cliente. Mesmos filtros
e cálculo já usados no resumo; disponível na tela e impressão. Margem inferior do
SVG ampliada para não cortar a nova linha. 223 testes passaram, revisão independente
aprovada. PDF real renderizado e conferido: primeira página com título, KPIs,
gráfico inteiro e taxas de todos os clientes. Publicação via backup e hashes.

## Impressão Aproveitamento — 09/11/2026

Removida quebra obrigatória antes do gráfico. Cabeçalho, filtros, KPIs e gráfico
agrupados na primeira página, com medidas próprias para impressão. Título grande:
controle do aproveitamento da venda de amostras - RQ 008 - setor desenvolvimento.
Título novo aparece somente na impressão; layout em tela preservado.
212 testes aprovados e revisão independente sem Critical/Important. PDF A4 paisagem
com dados reais gerado e primeira página renderizada: título, indicadores e gráfico
juntos, sem cortes. Arquivos: app.js, style.css, index.html. Publicação autorizada
pelo fluxo vigente; conferir saúde e preservação dos dados no deploy.

## Relatórios automáticos — botão Gerar relatórios (07/11/2026)

Incluída geração sob demanda dos oito relatórios com fontes atualizadas e login
administrativo. Botão com estado Gerando relatórios, bloqueio de cliques/exclusões,
recarregamento do histórico e erro/retentativa. Novas versões preservam as antigas.
Rota POST /api/automatic-reports/generate reutiliza autenticação e mesma origem,
fontes, PDFs e fila existente. Pedidos manuais simultâneos compartilham o lote.
Horários 07:00/13:30 e ledger agendado permanecem independentes; sincronizações
continuam sem gerar PDFs. Falha de fonte/PDF não publica lote parcial.

Arquivos: automatic-reports.js, server.js, app.js, automatic-reports-view.js,
style.css, index.html, package.json, test/manual-reports.test.js e teste de rotas.
212 testes completos passaram; sintaxe JS e diff conferidos, duas passadas de
revisão independente sem achados. Edge com histórico temporário validou login
cancelado, falha preservando oito versões, sucesso acrescentando oito, PDF,
bloqueios, temas claro/escuro, celular e impressão sem botões, sem erros JS.
Publicado no GitHub e VPS no commit 644baf6. Os 212 testes passaram também na
VPS; hashes confirmaram preservação de 1.006 arquivos operacionais no deploy.
Reiniciado somente oneda-crm-app, saúde OK e timer 07:00/13:30 ativo.
Geração manual real validou os oito tipos: histórico 8→16 versões, PDFs antigos
e ledger preservados. Snapshot dos novos relatórios: tingimento59, entregas14,
malotes10, cores12, Camila124, Ketlyn27, Joyce88 e Thamires21 (dados dinâmicos).
Edge na URL pública confirmou botão/versão nova, login e cancelamento, 16 versões,
celular e ausência de erros JS. Nenhum PDF de produção excluído nos testes.
Backup: /home/ubuntu/backups/oneda-crm-manual-reports-20261107-644baf6.

## Pasta CRM, arquivo local e skill CRM

Organização local em 06/11/2026: pasta `C:/360 skills/Dev-multiagentes/CRM`
com índice, exportador de conversas e snapshots Markdown. Duas conversas do CRM
identificadas pelos títulos/IDs do Codex e exportadas dos logs locais, somente
mensagens textuais usuário/assistente; ferramentas, raciocínio e instruções
internas excluídos, padrões de credenciais ocultados, anexos binários não copiados.
Registro ativo é snapshot, atualizado somente ao executar o script novamente.
Skill CRM validada e instalada no Codex, com descoberta automática habilitada;
roteamento DEV-multiagentes e codar/revisar. AGENTS.md adicionado ao checkout para
manter o fluxo nos próximos trabalhos. Nenhuma tela, API, dado de produção ou
infraestrutura alterada nesta organização; arquivo de conversas permanece local.

## Leadtime Produtivo — seleção dos meses da planilha

Período fixo set/2025–ago/2026 substituído por filtro múltiplo dos meses/anos
válidos de REALIZADO_FIM. Todos os meses por padrão, incluindo novas liberações.
Gráfico, média ponderada por registro, total liberado, peças, mês mais rápido e
listagem acompanham o período; clique na coluna afunila somente a tabela dentro
da seleção. Busca da tabela e limpeza do mês funcionando, com cursor preservado.
Datas ausentes/inválidas ficam fora do período e são informadas no resumo geral;
total monitorado mantém toda a base. Layout preservado, filtro com quebra de linha.
Arquivos: app.js, style.css, index.html, package.json, test/leadtime-period.test.js.
207 testes passaram e revisão independente aprovada. Prévia com dados reais:
17 meses, 1.867 registros datados/68 sem data; set+out/2026 somam 181 registros.
Publicado no GitHub/VPS nos commits 40838d6, e6101dd e 37d260c. Os 207 testes também
passaram na VPS, saúde OK e hashes dos dados operacionais/PDFs preservados.
Chrome público validou set/out=181; controles e KPIs com contraste no tema claro.
Backup final: /home/ubuntu/backups/oneda-crm-leadtime-period-20261106-37d260c.

## Relatórios automáticos — horários exclusivos e exclusão em lote

Recuperadas atualizações de outro agente até 66a8617: oito tipos de PDFs, por
tema e estilista, persistência/histórico e timer da VPS. Correção atual remove
geração das sincronizações geral/Prog Feira; endpoint local autenticado exclusivo
para 07:00/13:30 de São Paulo. Runner e fila validam horário; ledger persistente
impede duplicação, mesmo após reiniciar ou excluir todos. Sem catchup/retries tardios.
UI com seleção individual/todos e Excluir selecionados/Excluir todos os PDFs,
confirmação e login administrativo. IDs explícitos, fila compartilhada, falha
parcial com retentativa e reconciliação de seleção/versão aberta. Histórico da
VPS não é apagado no deploy. 201 testes e Chrome com arquivos temporários passaram;
duas revisões independentes aprovadas. Publicado no GitHub/VPS no commit b37e1cf.
201 testes passaram na VPS, saúde OK. Timer ativo, Persistent=no e Restart=no,
próximo disparo 06/11 às 07h de São Paulo. Runner executado fora de horário
retornou skipped=true sem gerar PDFs; hashes dos arquivos preservados. Chrome
público conferiu seleção, confirmações canceladas, detalhe e celular sem erros;
23 versões existentes preservadas. Backup de código, unidades e histórico:
/home/ubuntu/backups/oneda-crm-reports-controls-20261105-b37e1cf.
Detalhes e operação em RELATORIOS-AUTOMATICOS.md.

## Produção time de amostras — reconhecimento da semana 03–07/11

Parser exigia seg–sex e descartava as datas válidas terça–sábado da nova semana.
Agora aceita cinco datas consecutivas reais e usa calendário/intervalo efetivo
para identificar a semana atual, sem estender terça até segunda seguinte. Gráficos
mostram dias reais e o prazo usa a data final planejada. Costura e Corte mantêm
calendários próprios. Schema 3 reprocessa cache legado 1/2 na próxima leitura,
preservando fallback em falha. 165 testes passaram e revisão independente aprovada.
Chrome com fonte real confirmou 03–07/11, meta62 e lançamentos novos sendo lidos
(11→14→21 durante as conferências), corte35 (Andrea29/Chico6), histórico e cache
na falha, sem erros JS. Publicado no GitHub/VPS no commit 5926444. 165 testes
passaram também na VPS; saúde OK e dados preservados. Chrome público confirmou
costura21/meta62 e corte35, dias terça–sábado e schema3 após a migração do cache.
Backup: /home/ubuntu/backups/oneda-crm-team-calendar-20261104-5926444.

## Prog Feira — entrega visível no card simplificado

Modo Apenas imagens e dias agora mantém o selo ENTREGA da FICHA no canto da
imagem, em tela e impressão compacta. Removida somente a regra CSS que ocultava
esse selo; demais informações continuam ocultas e os contadores D36/D43 mantidos.
162 testes passaram; Chrome confirmou 04/11 no produto 05.20.00.0178 em modo
completo/compacto e impressão, sem erros JS. Publicado no GitHub/VPS no commit
657acd7; 162 testes também passaram na VPS, saúde OK e dados preservados.
Chrome público confirmou o selo em tela/impressão. Backup:
/home/ubuntu/backups/oneda-crm-compact-delivery-20261104-657acd7.

## Prog Feira — filtro múltiplo por data de entrega

Novo fieldset após Programação e antes dos grupos de etiquetas. Datas da mesma
FICHA exibida no card FE/D36, normalizadas e ordenadas cronologicamente, com ano
e SEM DATA para vazio/inválido. Seleção múltipla por união; Todas/Limpar restauram
a base. Opções/contagens consideram busca, setor, estilista, fluxos paralelos,
etiquetas e programação, excluindo a própria seleção de entrega. Seleções fora do
conjunto atual permanecem visíveis com zero. Gráfico, cards, grupos, resumos de
tela/PDF e os quatro KPIs acompanham os filtros; total geral permanece identificado.
Reuso de parseDelivery mantém filtro alinhado à data/ordem já usada pelo card.
162 testes e revisão independente aprovados. Chrome real: 189 produtos, nove
datas e 104 SEM DATA; conferidos cada opção, múltiplas datas, estilista/busca,
zero resultado, seleção preservada, limpeza, KPIs, resumo/PDF e temas/celular.
Publicado no GitHub/VPS no commit d690d3e. 162 testes passaram também na VPS,
saúde OK e dados preservados. Chrome público confirmou cada data, SEM DATA,
múltipla seleção, contagens/KPIs, estilista/busca, zero resultado, limpeza,
resumo/PDF e temas/celular sem erros JS.
Backup: /home/ubuntu/backups/oneda-crm-delivery-20261104-d690d3e.

## Estilista responsável — Raio X e Prog Feira

Seletor Todos/Camila/Ketlyn/Joyce/Thamires/Sem estilista nas duas telas, com
estados independentes e limpeza integrada. Classificação única product-stylist.js:
Camila 01.11/12/14/16; Ketlyn 01.13/15; Joyce 02.10–19, 05 e 13.10–19;
Thamires 01.17/18/19/20, 03.01 e 15. Demais códigos: Sem estilista. Limites de
sala não confundem 01.12 com 01.120 nem 05 com 050. Usuário confirmou 01.11/12
Camila e 01.19/20 Thamires; demais prefixos originais preservados.
Etiquetas/programações, gráfico e totais acompanham filtro; resumo de tela/PDF
identifica seleção. Fontes e produtos preservados. 159 testes passaram e revisão
independente aprovada. Chrome real conferiu grupos, busca, limpar, estados
independentes, resumo/PDF e temas/celular sem erros JS. Publicado no GitHub/VPS
no commit 4455cdd. 159 testes passaram também na VPS; saúde OK e dados preservados.
Chrome público confirmou todos os grupos nas duas telas, busca, limpar e PDF.
Backup: /home/ubuntu/backups/oneda-crm-stylist-20261103-4455cdd.

## Corte — detalhamento por atividade e semana

Na aba Corte de Produção time de amostras, a última semana válida disponível tem
prioridade: tabelas de Andrea e Chico por atividade, quantidade atual/anterior e
variação absoluta/percentual, logo após o resumo. Histórico com duas matrizes
atividade × semana, mais recentes à esquerda, com variações em cada célula.
Seletor 4/8/12/todas compartilhado com os totais; comparação usa base anterior
mesmo fora da janela. Detalhar semana inclui atividades. Ausência permanece —,
linha em branco vale zero, base zero não cria percentual. Semana parcial usa dias
equivalentes na seção em destaque e fica identificada nas matrizes históricas.
Costura e totais existentes preservados. Alterações em costura.js, corte-view.js,
costura.css, index.html e test/corte.test.js. Revisão independente aprovada.
Chrome com dados reais conferiu Andrea Corte Feira 16 vs. 12 (+33,3%) e Chico
23 vs. 12 (+91,7%), prioridade, filtros, histórico, temas/celular e navegação.
Publicado no GitHub e VPS no commit 77df865. 155 testes passaram localmente e na
VPS, com saúde OK e dados operacionais preservados. Chrome público confirmou
quantidades/variações, prioridade da última semana, matrizes por colaborador,
seleção de período, detalhes, temas/celular, cache e navegação sem erros JS.
Backup: /home/ubuntu/backups/oneda-crm-corte-activities-20261101-77df865.

## Produção time de amostras — abas Costura e Corte

Renomeada no menu, título e controles; continua abaixo de Prog Feira. Abas com
histórico/detalhe independentes. Costura preservada (58 de 69, 84,1%). Novas datas
e metas continuam dinâmicas com semanas inseridas à esquerda. Corte conta ações
de Andrea e Chico, incluindo reprocessos e com calendário próprio, sem meta da
costura. Atual: 156 ações (120/36), 13 reprocessos, 31,2/dia; anterior 96, alta de
60 (+62,5%). Comparação principal em semana parcial usa dias equivalentes.
Histórico com evolução por pessoa/atividade, médias, variação e detalhe.
Schema 2 acrescenta cuttingWeeks; cache legado preserva costura em falha e informa
indisponibilidade do corte. Fonte única Produção Amostras. Datas inválidas e
repetidas sinalizadas/excluídas das médias; não cruza os calendários.
151 testes passaram; Chrome real conferiu números, menu, abas, histórico, temas,
celular, atualização/falha, cache legado, semana ausente e navegação sem erros JS.
Revisão independente aprovada. Publicado no GitHub e VPS no commit bba5876.
151 testes passaram também na VPS; saúde OK e dados operacionais preservados.
Chrome público confirmou as duas abas, 58/69 e 156/120/36, comparativo +62,5%,
histórico, estados independentes, temas/celular, cache/falha/semana ausente,
sem erros JavaScript. Backup:
/home/ubuntu/backups/oneda-crm-amostras-tabs-20261031-bba5876.
Detalhes de operação em PRODUCAO-COSTURA.md.

## Produção do costura — nova tela

Menu em Estilo Amostras, abaixo de Prog Feira. Fonte exclusiva Produção Amostras
(gid 2024325688) do Painel Amostras. Semana atual com meta/entregas/atingimento,
meta diária, média, saldo e ritmo. Abaixo: produção diária, pessoas/atividades,
composição da meta, histórico, evolução e médias por costureira. Não soma o corte.
Blocos detectados por nomes/datas, suportando semanas novas inseridas à esquerda.
Meta usa componentes e cálculo exato; 69/58 → 84,1%, 11 restantes, 14/12 por dia
arredondados. Histórico sem meta fica explícito; repetição de 24/08 sinalizada e
não duplica médias. Fonte/cache indisponível e semana atual ausente não inventam
dados. Leitura periódica e atualização administrativa seguem o padrão existente.
145 testes e duas revisões independentes aprovados. Chrome real: 15 blocos,
14 períodos únicos, 13 históricos encerrados, 58/69 na semana atual. Conferidos
histórico/detalhe, temas, celular, atualização com sucesso/falha, cache, ausência
da semana atual/fonte e regressão de navegação para Raio X e Prog Feira.
Novo cache data/producao_costura_external.json ignorado. Guia completo em
PRODUCAO-COSTURA.md. Publicado no GitHub/VPS no commit b3c81ba.
145 testes passaram na VPS; saúde OK e dados operacionais preservados. Chrome
público confirmou integração real, menu, métricas, histórico, responsividade e
estados de cache/falha/semana ausente, sem erros JavaScript.
Backup: /home/ubuntu/backups/oneda-crm-costura-20261030-b3c81ba.

## Prog Feira — busca corrigida e Etiquetas antes de Programação

Busca do topo e busca local agora compartilham state.filters.search. Prog Feira
filtra sua própria base com esse termo e atualiza o contador do topo. Texto de
apresentação preserva caixa/espaços; debounce mantém foco/cursor. Trocar de módulo
não restaura consultas antigas; Limpar limpa ambos os campos e demais filtros.
Etiquetas agora vem antes de Programação. Opções de etiquetas consideram busca,
setor e filtros paralelos, sem restringir pelas programações selecionadas. Opções
e Todas de Programação consideram etiquetas selecionadas e demais filtros, sem
restringir pela própria seleção de programação. VAZIO continua selecionável.
135 testes passaram e revisão independente aprovada. Chrome validou buscas por
produto e inexistente, ambas as caixas, foco/pausas/espaços, limpeza, navegação e
contagens dependentes de etiquetas: CFI com 8 produtos, B44=1 e VAZIO=7 na base
atual de 182. Publicado no GitHub/VPS no commit 897a374.
135 testes passaram na VPS; saúde OK e dados preservados. Chrome público confirmou
busca/foco/navegação, frases com pausa e múltiplas etiquetas sem erros.
Backup: /home/ubuntu/backups/oneda-crm-prog-search-labels-20261030-897a374.

## Raio X — correção da busca do topo

Busca global interrompia input antes de applyFiltersAndRender porque acessava
clearSearchBtn.style, mas esse botão não existe no HTML atual. Acesso agora é
condicional; filtragem executa mesmo sem botão de limpar. Sem alteração dos
critérios de pesquisa ou filtros específicos do Raio X. Cache do app atualizado.
Regressão automatizada cobre digitação/normalização/limpeza sem botão. 135 testes
passaram. Chrome com dados reais: 386 cards antes, 2 para código existente,
1 para OF, nenhum para texto inexistente; apagar restaura todos. Busca interna e
Limpar filtros também conferidos sem erros. Código da captura 01.16.32.0273 não
está no conjunto atual do Raio X e retorna zero após a correção.
Publicado no GitHub/VPS no commit ad93f67. 135 testes passaram na VPS;
saúde OK e dados preservados. Chrome público confirmou buscas e limpeza sem erros.
Backup: /home/ubuntu/backups/oneda-crm-header-search-20261030-ad93f67.

## Prog Feira — impressão de 16 cards somente no modo simplificado

Paginação por setor usa 16 itens com Apenas imagens e dias ativo e mantém 8 no
modo completo. Somente CSS de impressão compacta usa grade 4×4, cards de 42mm,
foto contida em 28mm e contadores D36/D43 alinhados. A4 paisagem e separação por
setores mantidas; última página pode ter menos itens. Sem mudança dos cálculos.
134 testes passaram e revisão sem achados. Chrome gerou PDFs de um setor real com
99 produtos: compacto 7 páginas [16,16,16,16,16,16,3], completo 13 páginas com 8 e
última com 3. pypdf confirmou contagem D36 em cada página e A4 paisagem; Poppler
renderizou primeira/última página, imagens e contadores sem cortes. Conferidos
carregamento do índice de fotos e geometria dos contadores dentro dos cards.
Publicado no GitHub/VPS no commit a20f322. 134 testes passaram na VPS;
saúde OK e dados preservados. Chrome público e extração dos PDFs confirmaram
as mesmas contagens: 7 páginas compactas ou 13 completas, total 99 cards.
Backup: /home/ubuntu/backups/oneda-crm-prog-print16-20261029-a20f322.

## Raio X — observações e Pantone junto da cor

Complementos das planilhas agora incluem observação da linha correspondente em
D01/X01 (OBS/OBSERVAÇÃO e variantes), abaixo de envio/previsão. Campo vazio não
cria parágrafo; conteúdo escapado, quebras preservadas e palavras longas quebram.
Nome da cor e Pantone compartilham cabeçalho flexível, lado a lado quando couber.
Descrição de aviamento permanece abaixo do nome. Linha contendo apenas observação
útil pode complementar o produto. Código completo/sufixos, regra D01/X01 e
prioridade de envio sobre previsão mantidos. Impressão reutiliza os complementos.
134 testes passaram, revisão sem achados. Smoke ampliado validou notas por linha,
multilinha, escaping, Pantone na mesma linha, campo vazio e cópia na impressão.
Chrome com base real: 386 cards, 16 com cores/21 com aviamentos, 26 sem linha útil;
temas/390px/PDF com 18 itens complementares conferidos, sem erros JavaScript.
Publicado no GitHub/VPS no commit d8fa96c. 134 testes passaram na VPS;
saúde OK e dados operacionais preservados. Smoke e conferência real no Chrome
público confirmaram os mesmos resultados sem erros.
Backup: /home/ubuntu/backups/oneda-crm-rx-notes-20261029-d8fa96c.

## Alertas — observação das previsões

Alertas Andamento cores/aviamentos incluem Observação abaixo da mensagem/metadados,
extraída da mesma linha de origem (OBS, OBSERVAÇÃO/OBSERVACAO e plural). Campo vazio
não cria bloco; texto escapado, quebra de linha preservada e palavras longas podem
quebrar. Busca inclui observação. Critérios de prazo/conclusão/identidade mantidos.
133 testes passaram e revisão independente sem achados. Chrome conferiu planilhas
reais (3 cores/6 aviamentos, observações vazias nessas linhas) e fixtures com duas
pendências do mesmo produto: nota apenas na linha correta, nova linha, texto HTML
como texto e busca por observação. Publicado no GitHub/VPS no commit 959240d.
133 testes passaram na VPS; saúde OK e dados preservados. Chrome público
confirmou os mesmos cenários sem erros.
Backup: /home/ubuntu/backups/oneda-crm-forecast-notes-20261029-959240d.

## Alertas — Andamento cores e aviamentos como tipos dos avisos ativos

Ajuste solicitado após a primeira versão: Andamento cores e Andamento aviamentos
agora são filtros de Tipo em Avisos ativos, junto de CQ/Malote/etc. Removidas as
abas separadas. Previsões entram no conjunto comum, totais, badges, busca, filtros
de prioridade e paginação. Mantidos dia de Brasília, critérios de atraso/hoje e
retirada por RECEBIDO OU ENV. CLIENTE com data válida. Códigos completos inclusive
ON/sufixos e múltiplos itens preservados; origem em cache sinalizada no card.
Regras operacionais existentes e aba Regras vigentes mantidas.

## Prog Feira — Apenas imagens e dias (refinamento)

Botão movido do cabeçalho para imediatamente antes dos grupos de imagens, após a
legenda. Usa exec-action-btn no padrão existente, mínimo 34px, e nome Apenas
imagens e dias. No modo compacto mantém somente a ficha e os contadores de dias
D36/D43 lado a lado; oculta todos os badges/setores complementares, códigos de setor
nos cabeçalhos dos contadores e demais detalhes. Segundo clique restaura o card
completo e mantém filtros. Ampliação, cores dos tempos e impressão preservadas.
134 testes passaram e revisão sem achados. Chrome validou botão/posição, 26 cards
B44, valores dos dias preservados/alinhados, setores ocultos, restauração/filtros,
lightbox, claro/escuro e impressão, sem erros JavaScript.
Publicado no GitHub/VPS no commit c8f6dc7. 134 testes passaram na VPS;
saúde OK e dados preservados. Chrome público confirmou os mesmos cenários.
Backup: /home/ubuntu/backups/oneda-crm-prog-images-days-20261029-c8f6dc7.

## Prog Feira — participação percentual dos grupos de etiquetas

Contadores por prefixo agora exibem quantidade e percentual com uma casa decimal
sobre o total de produtos filtrados na tela (programação, setor, etiqueta, busca e
filtros complementares). Preserva a contagem única por grupo. Rodapé esclarece que
um produto pode participar de mais de um grupo, sem alterar contagens existentes.
128 testes passaram; revisão independente sem achados. Chrome validou os nove
grupos sobre 194 produtos, filtros de programação/etiqueta/setor e busca vazia.
Exemplo: CF 67/194 = 34,5%; CG 56/194 = 28,9%. Publicado no GitHub/VPS
no commit 7431caf; 128 testes passaram na VPS, saúde OK e dados preservados.
Chrome público confirmou percentuais e filtros sem erros.
Backup: /home/ubuntu/backups/oneda-crm-label-percent-20261028-7431caf.

## Raio X — redução de 25% nos botões de setores

Tamanho dos botões reduzido para 75%: fonte 20→15px, código 22→16,5px,
padding/gaps/contador e altura mínima proporcionais; largura do grupo em desktop
75%. Em celular mantém largura disponível para leitura. Ordem e seleção preservadas.
128 testes passaram; Chrome validou ordem, filtros, temas e telas 1600/1401/1280/
390/320px. Altura dos setores caiu de 106px para 80px (bordas preservadas).
Publicado no GitHub/VPS no commit 649246f. 128 testes passaram na VPS;
saúde OK, dados preservados e Chrome público conferido sem erros.
Backup: /home/ubuntu/backups/oneda-crm-rx-size-20261028-649246f.

## Imagens Ausentes — horário geral da atualização

Cabeçalho mostra uma informação macro: Última atualização do índice de imagens,
com data/hora do timestamp real retornado por /api/drive-images, em pt-BR e fuso
America/Sao_Paulo (horário de Brasília). Não representa data por arquivo nem hora
de abertura da página. Ausência de timestamp válido: Ainda não informada.
GET periódico e sincronização manual guardam timestamp; mudanças somente no horário
atualizam a tela de imagens ausentes, sem redesenhar outras galerias.
128 testes passaram, revisão sem achados bloqueantes. Chrome conferiu horário da
API, fuso, temas e renovação automática com mapa idêntico. Publicado no GitHub/VPS
no commit f809965. 128 testes passaram na VPS; saúde OK e dados preservados.
Chrome público confirmou horário e atualização automática sem erros.
Backup: /home/ubuntu/backups/oneda-crm-image-time-20261028-f809965.

## Raio X — setores organizados e botões ampliados

Filtro de setores organizado em quatro grupos visuais: Todos; 01/02/03/04/05G;
05/06/12/13/26/20/31/106; 43/CM1. Fonte, padding e espaçamento ampliados,
código e contador na primeira linha e descrição na segunda. Grade adapta para
quatro/duas colunas em telas menores. Multisseleção e contagens preservadas.
127 testes passaram, revisão independente sem achados bloqueantes; Chrome validou
ordem, multisseleção, Todos, temas claro/escuro e larguras 1600/1280/390/320.
Publicado no GitHub/VPS no commit e62aa36. Os 127 testes passaram na VPS;
saúde OK, dados preservados. Chrome público confirmou todos os cenários,
incluindo largura 1401px. Backup: /home/ubuntu/backups/oneda-crm-rx-sectors-20261028-e62aa36.

## Operação de imagens — Syncthing removido em 28/10/2026

A pedido do usuário, Syncthing desinstalado do PC e da VPS e serviço desativado.
1554 imagens preservadas em cada máquina; CRM saudável. Envio por Syncthing
encerrado; automação Python mencionada pelo usuário ainda não foi criada aqui.

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
