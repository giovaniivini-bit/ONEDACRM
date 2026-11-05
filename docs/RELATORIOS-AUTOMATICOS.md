# Relatórios automáticos

Plano inicial: gerar e guardar PDFs e snapshots a cada sincronização bem-sucedida
geral e do Prog Feira (POST autenticado). A atualização complementar após o sync
geral não duplica o lote que já foi gerado. Nenhuma dependência de navegador aberto,
agendamento por horário ou envio externo nesta fase.

1. Regras e testes: M00 >5, M02 >7 dias na própria parte TF/D43; entrega anterior
   ao dia de referência de São Paulo, com os critérios atuais do Prog Feira;
   malotes e cores com as mesmas funções de domínio usadas pelos alertas.
2. PDFs persistidos e índice atômico: uma sincronização guarda quatro versões novas,
   sem apagar versões anteriores; falha não publica relatório parcial.
3. Tela de histórico com descrição, data da fonte, cards e PDF já pronto para abrir.
4. Validar regras nas fronteiras, reinício/falha da fonte, rotas e PDF renderizado;
   revisão independente antes da entrega.

PDFs e dados ficam em data/automatic-reports (fora do Git e do servidor de arquivos
estáticos). Rotas GET controladas servem apenas IDs conhecidos no índice. PDFs
incorporam as imagens disponíveis no momento da geração. Fonte sem data válida
não é classificada silenciosamente: o relatório informa a exclusão. A geração
é serial para preservar o índice mesmo com sincronizações concorrentes.

Retenção: todas as versões são mantidas nesta fase. Uma política de limpeza será
definida antes de excluir históricos. A data de referência não muda ao reabrir PDF.

Implantação: instalar a dependência versionada com npm ci antes dos testes e do
restart do CRM. Preservar data/automatic-reports em deploys e backups. Versões
anteriores continuam disponíveis com seu PDF original; as regras e layouts novos
são aplicados às versões geradas após a atualização.

Validação local: 171 testes e smoke de navegador/API com fonte real. Os dados de
04/11/2026 resultaram em 82 produtos em permanência M00/M02 e 19 entregas atrasadas;
104 produtos sem entrega válida foram explicitamente excluídos da classificação.
Os PDFs incorporaram as fotos e foram renderizados para conferência visual.

## Atualização de 05/11/2026

Plano executado: (1) ordenar e agrupar snapshots, com regressões de datas e fluxos;
(2) paginação e tela compartilhando os grupos; (3) fontes dedicadas e novos
relatórios, validando falha da fonte; (4) testes completos, smoke e revisão independente.

- M00 aparece antes de M02. Cada grupo vai da menor permanência acima do limite
  para a maior. Um mesmo produto pendente nos dois setores aparece nos dois grupos.
- Entregas são agrupadas pelo dia normalizado, da menos atrasada para a mais
  atrasada. O PDF mostra a data antes dos cards e reserva meia área útil de folha
  entre grupos, inclusive quando o espaço atravessa uma quebra de página.
  Cabeçalhos acompanham os cards, com no máximo oito cards por folha.
- Malotes usa a base principal e a regra `malotes-parte-principal` do motor de
  alertas: setores 83/88 cruzados pela OF com a parte principal em 20/26.
- Cores usa a mesma fonte e o mesmo filtro Pantone da tela de cores e a função
  `buildForecastAlerts`: previsão para hoje ou vencida, sem data válida em
  recebido/envio ao cliente. Cada pendência de cor tem seu card, mesmo se houver
  mais de uma cor para o mesmo produto. Não é o alerta de produção em D01.
- No sync geral, malotes usa a base que acabou de ser baixada. No sync isolado do
  Prog Feira, essa base é buscada novamente. Cores sempre é buscada ao vivo;
  exportação inválida ou indisponível preserva o lote anterior, sem publicar um
  relatório vazio falso. Cada snapshot registra a data de sua própria fonte.

Validação desta atualização: 177 testes passaram; navegador desktop/mobile sem
erros. Smoke com as fontes de 05/11 encontrou 83 entradas M00/M02, 21 entregas,
8 malotes e 6 pendências de cor. PDFs com fotos renderizados e conferidos.
