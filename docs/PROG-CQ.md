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
| L | Números de ordem de compra, exibidos abaixo de aviamento e usados no filtro OC |
| M | Campo preenchido aciona a tarja laranja AV. PENDENTE CQ |

Dias parados no setor vêm da coluna DB da Prog Feira para as partes F6/F7 da
coluna E. O cruzamento usa código completo, OF, parte e setor. Zeros de formatação
à esquerda da OF não alteram o vínculo. Grades com dias diferentes no mesmo
vínculo deixam o valor indefinido. Zero aparece como número. Campo vazio,
inválido, divergente ou sem correspondência aparece como traço.

Falhas de leitura mantêm o último cache válido. Sem cache, a tela indica que a
fonte está indisponível. Cache anterior à leitura da coluna L mantém os cards,
mostra OC indisponível e suspende o filtro de OC até a próxima leitura válida.

## Impressão

Gerar PDF e Ctrl+P usam a composição da Prog Feira em A4 paisagem, com quatro
cards por linha e até oito da mesma parte e setor por folha. São impressos os
cards que correspondem aos filtros da tela, com título de parte e setor por
folha. Imagens continuam proporcionais à largura do card e os dados do card
são preservados, incluindo dias parados, andamento e pendência de aviamento.
A impressão aguarda as imagens e tenta a fonte alternativa em caso de erro.

Na tela e no PDF, o cabeçalho mostra o código à esquerda, a primeira semana
da coluna K no centro e a OF em destaque à direita. A semana do cabeçalho
segue a ordem original do andamento do pedido, inclusive com filtros ativos.


Os filtros de malha e aviamento podem ser combinados com parte e setor. Qualquer
linha de andamento em tecelagem ou tinturaria indica falta de malha. Laboratório
e depósito são considerados outros setores, ainda que o nome cite tinturaria.
Andamento sem setor informado fica separado como situação desconhecida. A coluna
M preenchida indica falta de aviamento. As barras contam registros após o filtro
de materiais, por parte, e continuam servindo para selecionar setores.

O filtro Semana lista os códigos de quatro dígitos do início das linhas da coluna K,
em ordem crescente e sem duplicatas, para as duas partes. Marque uma ou mais
semanas para filtrar gráfico, cards e totais junto com os demais filtros. Cada card
exibe somente os andamentos das semanas marcadas e conta uma vez no total mesmo
quando contém pedidos de várias delas. Sem marcações, todas são consideradas.
