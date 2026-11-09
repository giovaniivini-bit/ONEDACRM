# Aproveitamento por finalização da amostra

## Plano de implementação — 08/11/2026

1. Contrato e cruzamento testáveis: produto completo, data explícita de conclusão,
   tratamento de vazios, datas inválidas e duplicidades conflitantes.
2. API/caches: nova fonte de finalização independente da fonte comercial existente.
3. Tela e impressão: filtros/KPIs/gráficos pela finalização, data por produto,
   estados claros enquanto a nova base estiver vazia ou indisponível.
4. Regressões, navegador, revisão independente e documentação de continuidade.

## Fontes e contrato

- Base comercial: `1gUzTqx6VOuRMBiMlAvyqsyRzVtOy5SaI7ORCeaUG36k`, aba
  `Aproveitamento Amostras (760)`. Mantém preço `PRECO_VENDA`, comprado se
  `PEDIDO=S`, cliente pelo prefixo, descrição/categoria e demais informações.
- Finalização: `1bshn2-m-8O2WvkS5uX0Qbnt3YoCbGAM_gLX5pciTmsk`, aba de gid 0
  (nome observado: Página1), com duas colunas na mesma aba. Cabeçalhos observados:
  `PRODUTO` e `DATA FINALIZAÇÂO`. Nome do arquivo: aproveitamento atual 2026 - produtos e datas.
- Chave: código completo com pontos e sufixos, removendo apenas espaços externos e
  normalizando caixa. Nunca cruzar por prefixo, data, posição de linha ou pedaço do código.
- Nova data em `DD/MM/AAAA` (localidade pt_BR da planilha) ou ISO `AAAA-MM-DD`.
  Datas da base comercial estão em `M/D/YYYY`, formato diferente. Não reinterpretar
  cadastro/aprovação como finalização nem permitir rolagem de mês inválido.
- As duas colunas devem permanecer nessa aba. A aplicação não edita a planilha.

## Regras de período e ausência

Todo o período mantém a base comercial inteira, identificando os produtos sem data.
Períodos de 15/30/45 dias, 6 meses e personalizado consideram somente produtos com
data de finalização válida e inequívoca. Datas inicial/final inclusivas. Atalhos
usam a maior finalização dos produtos vinculados à base comercial, não uma data
de cadastro ou de um produto externo sem correspondência.

Repetição da mesma data para o mesmo produto não duplica produtos nem indicadores.
Datas válidas distintas para o mesmo código ficam em revisão, sem escolher
automaticamente a primeira/última. Código sem correspondência, vazio, data inválida,
conflito e fonte indisponível têm estados explícitos. Uma falha pode usar o último
cache válido com aviso; nunca inventa uma conclusão.

Primeira leitura confirmou cabeçalhos sem dados. O usuário preencherá os registros
posteriormente; a tela deve ficar pronta sem exigir datas fictícias ou de exemplo.

## Validação local

Leitura posterior em 08/11 encontrou 29 datas/produtos e permitiu conferir 29 vínculos
na base comercial de 2.097 registros. Os outros 2.068 ficam sem data; esses números
são da conferência, não monitoramento. Não foram editadas células da planilha.
220 testes e smoke Edge com cenários controlados e fontes reais passaram.
O PDF inclui a coluna de finalização e a data por produto. Temas claro/escuro e
tabela foram conferidos; controles e superfícies desse módulo receberam contraste
adequado no tema claro, preservando os demais módulos.
Após preencher mais linhas, usar Sincronizar Sheets para uma leitura forçada ou
reabrir a tela respeitando o cache normal de cinco minutos. Sem novo deploy.
