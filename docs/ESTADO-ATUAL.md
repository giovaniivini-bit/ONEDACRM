# Estado atual — Oneda CRM

Atualizado em 14/10/2026. Snapshot de continuidade, não monitoramento ao vivo.

## MPO — filtros de pendência e entrega validados, publicação em curso

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

Próxima ação: publicar no GitHub/VPS com backup e preservar os dados operacionais.

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
