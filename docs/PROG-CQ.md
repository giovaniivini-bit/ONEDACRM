# Prog CQ — estrutura inicial

## Escopo confirmado em 22/11/2026

Novo módulo em Controle de Qualidade, com padrão visual da Prog Feira.
Partes, nesta ordem (definidas em 26/11/2026):

- Parte F6: 17x, 17, D9x, B8x, D11, B9x, E7x, E8x, E9x, E5x.
- Parte F7: EN, IS, 17, D9, B8, D10, B9, E7, E8, E9, E5.

A mesma configuração ordena os gráficos horizontais e os grupos verticais.
Seleção múltipla por união, identificada por parte:setor. Filtro de parte e
limpeza disponíveis. Não tratar 17 e 17x como o mesmo setor.

## Planilha conectada

A fonte é a aba Página1 da planilha Prog CQ. A integração usa o cache do CRM e
o comando Sincronizar Sheets. Cada linha válida de Parte F6 ou F7 gera um card,
agrupado pelo setor da coluna C e pela parte da coluna G. Setores adicionais da
fonte entram no fim da lista da parte. F6 inclui o setor 17, distinto de 17x.

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
