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

O cache schema3 mantém o formato canônico com Parte/Fluxo. Evitar expor todos os
campos da planilha: a API conserva whitelist, sem preços, CNPJ, endereços ou IDs.
