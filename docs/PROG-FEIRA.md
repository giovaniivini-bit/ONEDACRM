# Prog Feira — partes e fluxos

A tela mantém setores/gráfico do fluxo principal D36. A planilha bruta é projetada
por normalizeSourceRecords (prog-feira.js) antes da sanitização no servidor.
Somente linhas FE/D36 com Qtde Pend positiva em setores conhecidos geram cards.
Identidade: Número + Código completo, incluindo sufixos. Zero linhas FE ativas em
uma exportação válida significa zero cards; não reutilizar cache antigo nesse caso.

| Informação | Parte/fluxo | Pendentes | Outros estados conhecidos |
|---|---|---|---|
| Amostras | FE/D36 | Ordem D36 atual, exceto cancelado01Z | FIM fora do fluxo visual |
| Custos | D6/D35 | DES,PCO,ENG,CTO | FIM |
| Tingimento | TF/D43 | M00,M02 | M01,M03 |
| Aviamento | AV/D47 | X01 | X02 |
| Cor | CO/D41 | D01 | D02 |

Programação vem de Descrição2, inclusive branco; Ficha é entrega, Data Saída calcula
dias no setor. Quantidade usa saldo FE deduplicado por cor/tamanho (máximo quando a
mesma dimensão se repete), sem adicionar saldos de outros fluxos. Setores/estados
resolvidos com saldo zero continuam informados; pendência exige estado pendente e
saldo positivo. Desconhecido/ausente não é inferido como resolvido.

Cards mostram complementos como linhas simples uma abaixo da outra, na ordem COR,
CUSTO,TINT. CASEIRA,AVIAMENTO. Tingimento real também conserva badge e filtro; opção
Sem informação distingue ausência de M00. Busca considera pendências complementares.
Impressão mantém oito cards e abrevia complementos para códigos sem omiti-los.

O cache schema4 mantém o formato canônico com Parte/Fluxo. Evitar expor todos os
campos da planilha: a API conserva whitelist, sem preços, CNPJ, endereços ou IDs.

Dias: somente D36 e TF/D43 aparecem na tela. O badge de tingimento informa dias no
estado atual M00–M03, calculados de Data Saída das próprias linhas TF. Maior tempo
entre grades desse estado; data ausente permanece sem contagem. Não há contagem
visível de dias para custos, cor ou aviamento. Filtros mantidos.

## Filtros por fluxo e organização do card

Seletores independentes Cor (CO/D41), Ting. caseiro (TF/D43), Custos (D6/D35).
Composição AND entre seletores e os filtros existentes. Todos remove a restrição do
fluxo, Sem informação exige nenhum setor registrado. Estados resolvidos continuam
filtráveis; estados vazios não criam opção vazia. Produtos com múltiplos setores
podem corresponder a qualquer setor daquele fluxo, sem duplicar cards.

Imagem em tela ocupa quadro fixo A4 paisagem (297/210), com object-fit:contain,
sem corte e sem variar a altura conforme o arquivo original. Tempos D36 e D43
lado a lado com números grandes e alinhados; datas ausentes ficam sem número.
Impressão mantém oito cards, ajustando foto e tempos; inclui seleção no resumo.

## Etiquetas

ETIQUETA é projetada da coluna Etiqueta da parte FE/D36. Código mostrado no card,
sem substituir por Desc Etiqueta. Grades com etiquetas diferentes preservam todas.
Filtro multisseleção por OU, ordenado alfabeticamente; cruza por AND com os demais.
Opções são facetadas pelos outros filtros, inclusive setor principal, sem aplicar
a seleção da própria etiqueta. Retém selecionadas com contagem zero. Coluna ausente
no cache sinaliza indisponibilidade e suspende esse filtro até carregar nova base.

## Cores dos dias do tingimento

M00: vermelho piscante; M01: azul fixo; M02: laranja piscante; M03: verde fixo.
Somente número de dias D43 anima; D36 mantém estilo anterior. Impressão e preferência
por movimento reduzido desativam a animação, preservando a cor do estado.

## Contadores por prefixo de etiqueta

Cada grupo usa as primeiras duas posições do código normalizado (CF,CG,58 etc.).
Contador aplica todos os filtros da tela e conta produtos, sem somar quantidade de
peças. Mesmo produto com CFA e CFAN conta uma vez em CF; com CF e CG pode entrar em
ambos. Grupos ordenados alfabeticamente, Sem etiqueta quando necessário. Apenas
consulta, sem criar seleção adicional; bloco oculto na impressão.
