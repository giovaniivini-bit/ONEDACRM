# Produção time de amostras

Tela em Estilo Amostras, imediatamente abaixo de Prog Feira. Abas Costura e Corte.
O identificador de navegação `producao-costura` e o tipo da API foram mantidos
para compatibilidade; os nomes apresentados ao usuário foram atualizados.

## Fonte e atualização

- Arquivo: Painel Amostras, id `1h04pHGE4wYZ3FnhAT3M-IeSB8pIFAi-RHdsqwKxwMwU`.
- Exclusivamente aba Produção Amostras, gid `2024325688`.
- API: GET `/api/external-sheet?type=producao_costura`.
- Atualização forçada: POST na mesma API com `&refresh=1`, protegida pelo login administrativo existente.
- Cache: `data/producao_costura_external.json`, ignorado pelo Git. Não substituir em deploy.
- Consulta periódica enquanto a tela está aberta; cache segue TTL existente de cinco minutos. Atualizar ou Sincronizar Sheets pode forçar uma nova leitura.
- Falha de rede mantém os últimos dados, identificados como cache, com timestamp. Sem cache disponível não inventa números.
- Payload schema 2: `weeks` da costura e `cuttingWeeks` do corte, obtidos da mesma leitura.
  Cache schema 1 continua disponível em falha de rede para a costura; o corte informa
  indisponibilidade até a próxima leitura, sem criar números zero.

## Leitura dos blocos

`costura.js` identifica as colunas pelos nomes Jô, Cleide e Josi e procura as datas acima desses blocos. Não depende de letras ou posições fixas; novas semanas podem entrar à esquerda e deslocar o histórico. Usa o calendário da costura, sem aproveitar o calendário ou os números do corte.

Conta as atividades de cada costureira até a linha TOTAL, sem somar TOTAL novamente. Confronta as linhas TOTAL preenchidas com a soma das atividades e sinaliza divergências. Valores em branco entram como zero nos somatórios, conforme SUM da planilha. Ausência de um bloco de pessoa é sinalizada e não cria média individual fictícia.

As datas devem formar segunda a sexta. Cabeçalhos DD/MM recebem o ano do ciclo industrial CQs semana AASS, quando disponível; os primeiros ciclos em novembro/dezembro pertencem ao ano anterior. Sem ciclo, usa proximidade da data atual para a primeira semana e acompanha a virada de ano nos blocos seguintes. Datas completas prevalecem.

Cada período repetido permanece registrado para conferência. Apenas o bloco mais à esquerda participa dos indicadores agregados. Datas inválidas não entram nas médias. A aba original não é editada.

## Meta e cálculos

A meta é a soma dos componentes sob Quantidade de amostras da semana: CQ, programação, testes etc. Não é o total do corte. Meta ausente permanece não informada; meta zero não é tratada como atingida.

- Realizado: soma das atividades de Jô, Cleide e Josi.
- Atingimento: realizado / meta × 100, calculado sem arredondamento intermediário.
- Faltam: máximo entre zero e meta − realizado.
- Meta diária: meta / dias previstos. Número principal arredondado; valor exato indicado abaixo.
- Média no período: realizado / dias previstos, com a mesma apresentação.
- Ritmo até hoje: realizado / dias previstos transcorridos.
- Necessárias por dia restante: faltam / dias previstos restantes, incluindo hoje.
- Participação individual: produção da pessoa / produção da equipe.

Exemplo validado: meta 69, realizado 58, atingimento 84,1%, faltam 11; meta diária 13,8 → 14 e média diária 11,6 → 12.

## Corte — produtividade por ações

`buildCuttingWeeks` reutiliza o parser semanal para Andrea e Chico. Procura o
cabeçalho próprio do corte acima desses colaboradores, sem aproveitar as datas ou
a meta da costura. Contabiliza todas as atividades, incluindo reprocessos, como
ações: um produto pode gerar mais de uma ação. Não mede referências únicas nem
aplica uma meta de entrega ao corte.

Primeiro plano: ações da semana atual, média por dia, comparação anterior e
reprocessos. Depois: ações por dia, totais/participações/médias/reprocessos por
pessoa e distribuição por atividade. Na semana em andamento, a comparação
principal considera os mesmos dias da semana anterior disponível. O total semanal
bruto fica identificado como potencialmente parcial.

O histórico inclui evolução semanal da equipe e de cada colaborador, variação em
ações e percentual (Subiu/Caiu/Estável), gráfico empilhado por pessoa, médias de
semanas encerradas, melhor semana e detalhamento. Sem base anterior não inventa
variação; base zero não produz percentual infinito. A seleção de período e de
detalhe é independente entre as abas.

Exemplo 26–30/10/2026: 156 ações (Andrea 120, Chico 36), média de 31,2/dia,
13 reprocessos. Semana anterior: 96 ações; aumento de 60 (+62,5%). Andrea
subiu de 77 para 120 e Chico de 19 para 36.

Datas inválidas e duplicadas são sinalizadas e ficam fora das médias, com
precedência para o bloco mais à esquerda. O cabeçalho malformado de janeiro no
histórico do corte não é corrigido com as datas da costura. Quando não há datas
da semana atual, a última semana fica explicitamente identificada.

## Hierarquia da tela

1. Semana atual, identificada pela data de São Paulo: meta, realizado, atingimento, saldo e ritmo.
2. Produção diária, distribuição por costureira, atividades e composição da meta.
3. Histórico com seleção de 4/8/12/todas as semanas, gráfico meta × entregue, variação contra semana anterior disponível e detalhe de cada período.
4. Médias históricas por pessoa, melhor semana, participação e percentual de metas atingidas.

Métricas históricas consideram somente semanas encerradas no período selecionado, sem a semana atual, semanas futuras ou períodos duplicados. Semanas sem meta não entram no denominador de metas atingidas. Se a semana atual ainda não existir na planilha, a tela informa isso e apresenta a última disponível com identificação explícita.

## Arquivos e validação

- `costura.js`: normalização e métricas das duas equipes.
- `costura-view.js` / `corte-view.js` / `costura.css`: abas, controles compartilhados e responsividade.
- `server.js`: matriz CSV, nova fonte e cache.
- `app.js` / `index.html`: navegação, carregamento e atualização.
- `test/costura.test.js`, `test/corte.test.js` e `test/server-routes.test.js`: datas, cálculos, ausência de dados, CSV, texto seguro e autorização.

151 testes passaram na divisão em abas. Chrome com a fonte real confirmou 15
blocos da costura (58/69 preservados) e 16 do corte, com 14 períodos válidos únicos
do corte após excluir um cabeçalho inválido e uma duplicação. Conferidos menu,
troca de abas, estados independentes, métricas 156/120/36 e +62,5%, histórico,
detalhe, temas, 390px, atualização com sucesso/falha, cache legado, semana atual
ausente e retorno às telas Raio X/Prog Feira.
