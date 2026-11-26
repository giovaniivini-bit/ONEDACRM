# Prog CQ — estrutura inicial

## Escopo confirmado em 22/11/2026

Novo módulo em Controle de Qualidade, com padrão visual da Prog Feira.
Partes, nesta ordem (definidas em 26/11/2026):

- Parte F6: EN, IS, 17, D9, B8, D10, B9, E7, E8, E9, E5.
- Parte F7: 17x, D9x, B8x, D11, B9x, E7x, E8x, E9x, E5x.

A mesma configuração ordena os gráficos horizontais e os grupos verticais.
Seleção múltipla por união, identificada por parte:setor. Filtro de parte e
limpeza disponíveis. Não tratar 17 e 17x como o mesmo setor.

O total de produtos de cada parte fica junto ao título do gráfico e conta os
cards visíveis após os filtros, incluindo a seleção de setores. Quando as duas
partes são exibidas, o total geral soma F6 e F7.

## Planilha conectada

A fonte é a aba Página1 da planilha Prog CQ. A integração usa o cache do CRM e
o comando Sincronizar Sheets. As linhas das partes F6 e F7 são agrupadas pelo
setor da coluna C e pela parte da coluna G. O gráfico, a seleção e os cards
mostram somente os setores previstos na sequência oficial da parte. A importação
conserva as linhas fora do fluxo no cache.

| Coluna | Uso |
| --- | --- |
| B | OF |
| C | Setor pendente |
| E | Código completo do produto e referência para a imagem |
| F | Descrição |
| G | Parte |
| K | Andamento do pedido, com as quebras de linha da planilha |
| M | Campo preenchido aciona a tarja laranja AV. PENDENTE CQ |

Falhas de leitura mantêm o último cache válido. Sem cache, a tela indica que a
fonte está indisponível. A impressão específica da Prog CQ ainda está pendente.


Os filtros de malha e aviamento podem ser combinados com parte e setor. Qualquer
linha de andamento em tecelagem ou tinturaria indica falta de malha. Laboratório
e depósito são considerados outros setores, ainda que o nome cite tinturaria.
Andamento sem setor informado fica separado como situação desconhecida. A coluna
M preenchida indica falta de aviamento. As barras contam registros após o filtro
de materiais, por parte, e continuam servindo para selecionar setores.

O filtro Semana lista os códigos de quatro dígitos do início das linhas da coluna K,
em ordem crescente e sem duplicatas, para as duas partes. A seleção combina com os
demais filtros e atualiza o gráfico. Um card com pedidos de semanas diferentes é
exibido quando tem pedido na semana selecionada e mostra os andamentos dessa semana.
