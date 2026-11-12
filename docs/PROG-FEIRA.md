# Prog Feira — partes e fluxos

## Seleção múltipla de setores

As colunas de Produtos por setor funcionam como flags independentes. Cada clique
marca ou desmarca o setor, e vários setores selecionados são combinados por união
(OU), sem duplicar referências. Sem flags ativos, a tela mostra Todos. O resumo na
barra identifica os códigos escolhidos e oferece Mostrar todos; Limpar restaura a
seleção geral junto dos demais filtros. Cards, KPIs, etiquetas, programações,
entregas, contadores e relatório respeitam a mesma seleção.

## Data de entrega

O selo ENTREGA permanece visível no canto superior da imagem também no modo
Apenas imagens e dias e em sua impressão de 16 cards por página (ajuste 04/11/2026).

Filtro múltiplo após Programação, antes dos grupos de etiquetas. Lê a FICHA do
produto FE/D36 consolidado, a mesma informação exibida no card. Reutiliza
parseDelivery para normalizar formatos e inferir ano em DD/MM. Opções com ano,
em ordem cronológica; vazio ou data inválida entram em SEM DATA, sempre disponível.
Não utiliza datas das linhas de cor, custo, tingimento ou aviamento.

As opções consideram busca, estilista, filtros paralelos, etiquetas, programação
e setor, sem a seleção do próprio filtro; opção selecionada sem correspondência
permanece com zero. Seleção por união permite combinar datas com SEM DATA.
Todas limpa só as datas; Limpar limpa todos os filtros. Cards, gráfico, contadores,
grupos e os quatro KPIs acompanham filtros. Total global aparece identificado.
Resumos da tela e impressão incluem as entregas selecionadas. Regras nos helpers
deliveryKey/getDeliveryOptions/filterByDeliveries, com cobertura de virada de ano,
datas inválidas, múltipla escolha e FICHA exclusiva FE/D36.

## Estilista responsável

Seletor Todos, Camila, Ketlyn, Joyce, Thamires e Sem estilista na barra de filtros.
Regras compartilhadas com Raio X em product-stylist.js (mapeamento em RAIO-X.md).
Seleção antecede etiquetas/programação, recalculando suas opções, gráfico de
setores, grupos de etiquetas e contagens visíveis. Combina com busca e filtros
paralelos; Limpar restaura Todos. Resumos de tela/PDF identificam a seleção.

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

## Aviamentos da planilha — 12/11/2026

Bloco AVIAMENTO por linha pendente de aprovação da planilha: fornecedor, descrição,
SOLICITADO e PREVISÃO. Vínculo por código completo, com sufixos; não requer X01 noERP.
DATA APROVADO vazio/traço define pendência como na tabela; recebido não encerra
aprovação. Preservar todas as linhas sem truncar e sem inventar campos ausentes.
Pendente COR D01 deixa de aparecer no card, mantendo filtros e cálculos de cor.
Impressão completa se adapta ao conteúdo; modo Apenas imagens e dias inalterado.

## Filtros de previsão de aviamentos — 12/11/2026

Ver produtos com previsão de aviamentos e Produtos sem previsão de aviamentos são
alternativas, ao lado de Apenas imagens e dias. Com verifica qualquer linha do
índice pendente com previsão preenchida; Sem é seu complemento. Fonte desconhecida
suspende o filtro. Clicar de novo na opção ativa ou Limpar retorna todos. Busca,
etiquetas, programação, entrega, setores e estilista continuam combináveis. Resumo
impresso identifica o recorte. Não altera dados ou previsões na planilha.

## Prog Feira — fotos na impressão (12/11/2026)

Impressão completa mantém fotos na largura do card, sem corte (297/210), e altura
adaptável para preservar informações. Modo compacto mantém sua composição.
Exportar aguarda todas as fotos mapeadas, tenta fallback e cancela em timeout/erro
ou troca da view. Código sem arquivo exato permanece explicitamente sem imagem;
nunca substituir pela imagem de outro sufixo.
