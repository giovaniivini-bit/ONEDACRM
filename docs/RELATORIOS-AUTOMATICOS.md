# Relatórios automáticos

Plano inicial: gerar e guardar PDFs e snapshots a cada sincronização bem-sucedida
geral e do Prog Feira (POST autenticado). A atualização complementar após o sync
geral não duplica o lote que já foi gerado. Nenhuma dependência de navegador aberto,
agendamento por horário ou envio externo nesta fase.

1. Regras e testes: M00 >5, M02 >7 dias na própria parte TF/D43; entrega anterior
   ao dia de referência de São Paulo, com os critérios atuais do Prog Feira.
2. PDFs persistidos e índice atômico: uma sincronização guarda duas versões novas,
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
restart do CRM. Preservar data/automatic-reports em deploys e backups. Nenhum
relatório de produção foi criado nesta implementação local; a primeira versão
será gerada pela próxima sincronização depois de publicar.

Validação local: 171 testes e smoke de navegador/API com fonte real. Os dados de
04/11/2026 resultaram em 82 produtos em permanência M00/M02 e 19 entregas atrasadas;
104 produtos sem entrega válida foram explicitamente excluídos da classificação.
Os PDFs incorporaram as fotos e foram renderizados para conferência visual.
