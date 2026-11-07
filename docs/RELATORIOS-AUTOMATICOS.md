# Relatórios automáticos

Gerar e guardar PDFs e snapshots automaticamente às 07:00 e 13:30 de America/Sao_Paulo,
ou sob demanda pelo botão Gerar relatórios.
Sincronização geral e do Prog Feira atualiza dados sem gerar PDFs.
O agendamento roda na VPS, sem dependência de navegador ou computador do usuário.
Não há envio externo nesta fase.

1. Regras e testes: M00 >5, M02 >7 dias na própria parte TF/D43; entrega anterior
   ao dia de referência de São Paulo, com os critérios atuais do Prog Feira;
   malotes e cores com as mesmas funções de domínio usadas pelos alertas.
2. PDFs persistidos e índice atômico: cada horário guarda oito versões novas,
   sem apagar versões anteriores; falha não publica relatório parcial.
3. Tela de histórico com descrição, data da fonte, cards e PDF já pronto para abrir.
4. Validar regras nas fronteiras, reinício/falha da fonte, rotas e PDF renderizado;
   revisão independente antes da entrega.

PDFs e dados ficam em data/automatic-reports (fora do Git e do servidor de arquivos
estáticos). Rotas GET controladas servem apenas IDs conhecidos no índice. PDFs
incorporam as imagens disponíveis no momento da geração. Fonte sem data válida
não é classificada silenciosamente: o relatório informa a exclusão. A geração
é serial para preservar o índice mesmo com sincronizações concorrentes.

Retenção: versões são mantidas até exclusão pelo usuário. A tela oferece seleção
individual, Selecionar todos, Excluir selecionados e Excluir todos os PDFs, além de
Excluir PDF por linha, com confirmação e autenticação administrativa. DELETE recebe
IDs explícitos da lista apresentada; não atinge PDFs gerados depois da seleção.
Remove somente PDF, snapshot e entrada de histórico escolhidos; pedidos não mudam.
Exclusão compartilha a fila da geração. Uma intenção persistente
`deletionPending` permite tentar novamente se a remoção física falhar parcialmente,
inclusive após reiniciar o servidor. Não há limpeza automática de histórico.
A data de referência não muda ao reabrir PDF.

Implantação: instalar a dependência versionada com npm ci antes dos testes e do
restart do CRM. Preservar data/automatic-reports em deploys e backups. Versões
anteriores continuam disponíveis com seu PDF original; as regras e layouts novos
são aplicados às versões geradas após a atualização.

Validação local: 171 testes e smoke de navegador/API com fonte real. Os dados de
04/11/2026 resultaram em 82 produtos em permanência M00/M02 e 19 entregas atrasadas;
104 produtos sem entrega válida foram explicitamente excluídos da classificação.
Os PDFs incorporaram as fotos e foram renderizados para conferência visual.

## Geração sob demanda — 07/11/2026

O botão Gerar relatórios solicita login administrativo quando necessário e gera
os oito tipos com as quatro fontes atualizadas, acrescentando novas versões ao
histórico. Não exige esperar os horários automáticos. Atualizar lista somente
consulta o histórico. Durante a geração, o botão informa Gerando relatórios e
bloqueia novos cliques/exclusões nessa tela; ao terminar, a lista é recarregada.
Falha ou cancelamento do login libera uma nova tentativa e informa o erro.

POST /api/automatic-reports/generate exige a autenticação administrativa existente
(sessão HttpOnly e mesma origem). Reutiliza fontes, critérios, PDFs e fila do
agendamento/exclusão. Requisições manuais simultâneas compartilham um lote; depois
que ele termina, outro clique pode criar novas versões. Falha de fonte/PDF não
publica lote parcial nem altera o índice anterior. A geração manual não escreve
schedule-runs.json nem scheduleKey: o agendamento continua independente e com
suas travas de horário/deduplicação. Sincronizar planilhas continua sem gerar PDFs.

Validação: 212 testes completos aprovados e revisão independente sem achados.
Edge com histórico temporário validou login/cancelamento, falha com preservação,
geração de oito novas versões, PDF, bloqueios, temas, celular e impressão sem
botões ou erros JavaScript. Nenhum PDF de produção foi excluído nos testes.

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

Atualização adicional: malotes agora reserva a metade física superior de cada
folha para o setor 88 e a inferior para o setor 83, com quatro cards por setor.
O excedente continua na mesma metade da folha seguinte. A tela também separa os
setores. Testes cobrem divisão física, grupo vazio e continuação, exclusão
autenticada, IDs inválidos, arquivo inacessível após exclusão, falha parcial com
retentativa e concorrência entre geração e exclusão.

## Pendências por estilista

Plano: reutilizar classificação e critérios existentes; compor snapshots por tema;
renderizar os grupos na tela e no PDF; testar variantes, datas e permanência;
conferir PDFs com fotos e navegador, revisar e publicar.

Cada horário acrescenta os quatro relatórios gerais e um relatório para
Camila, Ketlyn, Joyce e Thamires. A atribuição usa `product-stylist.js`, sem mudar
prefixos nem incluir produtos classificados como "Sem estilista".

Os seis grupos, sempre visíveis mesmo vazios, são:

- PEDIDO / PRODUTOS COM PENDÊNCIA DE ESTAMPA: universo e vínculos do Raio X,
  classificação de status compartilhada com a tela Sit. Estampa. Não usa o local
  de modelagem como status de produto.
- PEDIDO / PRODUTOS COM PENDÊNCIA DE AVIAMENTO: X01 na mesma OF e código completo.
- PEDIDO / PRODUTOS COM PENDÊNCIA DE COR: D01 na mesma OF e código completo.
- AMOSTRA / PRODUTOS EM ATRASO: fonte Prog Feira, entrega anterior ao dia de São
  Paulo. Entregas de hoje não estão atrasadas.
- AMOSTRA / PRODUTOS SEM DATA DE ENTREGA VÁLIDA: datas vazias ou inválidas; as
  inválidas recebem identificação explícita e aviso.
- AMOSTRA / MAIS DE 15 DIAS EM 01A, 01B OU 1B2: setor principal atual FE/D36 e dias
  da sua movimentação. Exatamente 15 dias não entra; fluxos paralelos não mudam
  esse prazo. Sem movimentação válida não é possível classificar permanência.

Um produto com várias pendências aparece em cada subtema correspondente. O total
de pendências distingue essas ocorrências da contagem de produtos/OFs únicos.
Pedidos consolidam tamanhos antes do Raio X, com semana, descrição, setores,
status e peças. Amostras mantêm entrega, programação, peças e tempo no setor.
Snapshots registram timestamps de PEDIDO e AMOSTRA separadamente. Os PDFs antigos
continuam intactos; os novos tipos também permitem exclusão individual.

### Previsões D01 / X01 e horários diários

Plano desta atualização: atualizar as fontes de cores e aviamentos ao vivo;
enriquecer produtos com o mesmo helper do Raio X; compactar os metadados dos cards;
testar datas/vínculos, fontes e runner; revisar PDF e navegador; instalar e validar
o timer de produção.

Os cards por estilista incluem previsões e envios de D01 e X01 quando essas
pendências estiverem ativas. PEDIDO usa os vínculos OF + código do Raio X;
AMOSTRA usa os paralelos CO/D41/D01 e AV/D47/X01 com saldo pendente. As planilhas
de previsão não contêm OF; seus detalhes seguem o código completo, sem misturar
sufixos. "Enviado ao cliente" tem prioridade sobre previsão, como no Raio X;
recebimento não é prova de envio. Ausência de informação aparece explicitamente.

Fontes de cores e aviamentos são baixadas e validadas em cada geração. Falha não
publica lote parcial. Timestamps das quatro fontes ficam no snapshot. Cards de
PDF mantêm dimensões de 214 pontos e até oito por folha. Foram reorganizados os
textos para reservar quatro linhas de previsão, mantendo semana/entrega, etiqueta,
peças, status/descrição e setor/tempo. Se houver mais de quatro registros, outro
card do mesmo tamanho continua as previsões, sem inflar o total de pendências.

Agendamento nativo da VPS, com templates versionados em `deploy/`:

```sh
cd /home/ubuntu/apps/ONEDACRM
sudo install -m 644 deploy/oneda-crm-reports.service /etc/systemd/system/oneda-crm-reports.service
sudo install -m 644 deploy/oneda-crm-reports.timer /etc/systemd/system/oneda-crm-reports.timer
sudo systemd-analyze verify /etc/systemd/system/oneda-crm-reports.service /etc/systemd/system/oneda-crm-reports.timer
sudo systemctl daemon-reload
sudo systemctl enable --now oneda-crm-reports.timer
sudo systemctl restart oneda-crm-reports.timer
systemctl list-timers oneda-crm-reports.timer
journalctl -u oneda-crm-reports.service -n 10 --no-pager
```

O timer tem dois OnCalendar com fuso explícito, sem atraso aleatório. Persistent
é false: horário perdido não é recuperado depois. Restart=no impede repetições
cinco minutos depois. O runner e a rota agendada admitem início somente nos minutos
07:00 e 13:30 de São Paulo. Uma execução admitida pode terminar depois; sua data
de geração registra o início, não a conclusão do processamento.
`scripts/generate-scheduled-reports.cjs` chama POST /api/automatic-reports/scheduled,
exclusivo para acesso direto loopback, Host local e token administrativo, sem
cabeçalhos de proxy. Autentica
com `/home/ubuntu/.config/oneda-crm/admin-token` (modo 600) e valida os oito tipos
gerados com fonte ao vivo. Não envia credencial a destinos externos nem segue
redirecionamentos. Logs contêm apenas resultado, tipos e quantidades.

## Correção de 05/11/2026 — somente horários e exclusão em lote

Removidos os disparos da sincronização geral e do refresh de Prog Feira. A fila
confere novamente o horário antes de iniciar. schedule-runs.json, no mesmo diretório
protegido dos PDFs, registra cada data/horário concluído. Repetições concorrentes,
reinício e exclusão de todo o histórico não geram um segundo lote naquele horário.
Se houver falha entre publicar índice e concluir o registro, os metadados scheduleKey
permitem recuperar a conclusão. Falha de fonte não publica lote vazio/parcial.

DELETE /api/automatic-reports aceita JSON {ids:[...]}; DELETE com ?id= continua
compatível. IDs são validados antes de qualquer exclusão, com deduplicação. Falha
parcial devolve deletedIds/missingIds/failedIds (HTTP 207); itens que falharam ficam
deletionPending para retentativa e demais selecionados são removidos. A interface
reconcilia seleção, versão aberta e histórico. Excluir todos usa somente IDs atuais
confirmados, preservando gerações posteriores e o registro de horários.

Testes cobrem fuso/fronteiras de minuto, não geração em sync, deduplicação/reinício,
perda do horário na fila, exclusão autenticada em lote, IDs inválidos e falha parcial.
Chrome com histórico temporário conferiu seleção, confirmação/cancelamento, login,
exclusão em lote/todos, retentativa, atualização, temas e celular. Nenhum PDF de
produção é removido pela implantação ou pelas verificações.
