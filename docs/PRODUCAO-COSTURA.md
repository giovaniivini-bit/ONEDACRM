# Produção do costura

Tela em Estilo Amostras, imediatamente abaixo de Prog Feira.

## Fonte e atualização

- Arquivo: Painel Amostras, id `1h04pHGE4wYZ3FnhAT3M-IeSB8pIFAi-RHdsqwKxwMwU`.
- Exclusivamente aba Produção Amostras, gid `2024325688`.
- API: GET `/api/external-sheet?type=producao_costura`.
- Atualização forçada: POST na mesma API com `&refresh=1`, protegida pelo login administrativo existente.
- Cache: `data/producao_costura_external.json`, ignorado pelo Git. Não substituir em deploy.
- Consulta periódica enquanto a tela está aberta; cache segue TTL existente de cinco minutos. Atualizar ou Sincronizar Sheets pode forçar uma nova leitura.
- Falha de rede mantém os últimos dados, identificados como cache, com timestamp. Sem cache disponível não inventa números.

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

## Hierarquia da tela

1. Semana atual, identificada pela data de São Paulo: meta, realizado, atingimento, saldo e ritmo.
2. Produção diária, distribuição por costureira, atividades e composição da meta.
3. Histórico com seleção de 4/8/12/todas as semanas, gráfico meta × entregue, variação contra semana anterior disponível e detalhe de cada período.
4. Médias históricas por pessoa, melhor semana, participação e percentual de metas atingidas.

Métricas históricas consideram somente semanas encerradas no período selecionado, sem a semana atual, semanas futuras ou períodos duplicados. Semanas sem meta não entram no denominador de metas atingidas. Se a semana atual ainda não existir na planilha, a tela informa isso e apresenta a última disponível com identificação explícita.

## Arquivos e validação

- `costura.js`: normalização e métricas.
- `costura-view.js` / `costura.css`: tela e responsividade.
- `server.js`: matriz CSV, nova fonte e cache.
- `app.js` / `index.html`: navegação, carregamento e atualização.
- `test/costura.test.js` e `test/server-routes.test.js`: datas, cálculos, ausência de dados, CSV, texto seguro e autorização.

145 testes passaram na implementação. Chrome com a fonte real confirmou 15 blocos, 14 períodos únicos, semana atual 58/69 e 13 semanas anteriores. Conferidos temas, 390px, detalhe, filtro de histórico, cache em falha, atualização, fonte indisponível, semana atual ausente e retorno às telas Raio X/Prog Feira.
