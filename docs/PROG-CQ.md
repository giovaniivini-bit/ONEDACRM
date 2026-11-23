# Prog CQ — estrutura inicial

## Escopo confirmado em 22/11/2026

Novo módulo em Controle de Qualidade, com padrão visual da Prog Feira.
Fluxos, nesta ordem:

- C32: 17x, D9x, B8x, D11, B9x, E7x, E8x, E9x, E5x.
- D32: EN, IS, 17, D9, B8, D10, B9, E7, E8, E9, E5.

A mesma configuração ordena os gráficos horizontais e os grupos verticais.
Seleção múltipla por união, identificada por fluxo:setor. Filtro de fluxo e
limpeza disponíveis. Não tratar 17 e 17x como o mesmo setor.

## Implementado nesta etapa

- Navegação, título, layout claro/escuro e scripts/estilos versionados.
- Estado explícito aguardando planilha, sem zeros ou produtos fictícios.
- Regiões para cards/imagens por setor, ainda sem renderização de produtos.
- Helper separado de configuração/ordenação, com testes da sequência e seleção.
- Gerar PDF informa que a fonte precisa ser configurada, sem imprimir base alheia.

Não existe API, sincronização, cache CQ ou parser da planilha nesta etapa.
prog-cq.js contém apenas um contrato interno de apresentação (flow, sector,
codigo completo, numero opcional); não define nomes/colunas da futura planilha,
chave de consolidação ou contagens finais. Nenhuma regra D36 da Feira é aplicada.

## Próxima etapa, após receber a fonte

Fonte recebida em 22/11/2026: Prog CQ,
https://docs.google.com/spreadsheets/d/1QMegrgLwnsXnOyOrkUK_XELhL6Tji_WARdZXu3WSlKg/edit#gid=0.
Metadados confirmam aba Página1, gid 0. Leitura A1:Z5 vazia, sem cabeçalhos.
SOURCE registrada no helper e link disponível na tela. Não houve escrita na
planilha; nenhuma sincronização ou interpretação de colunas foi ativada.

Confirmar URL/aba, cabeçalhos, identificação do produto e da amostra/OF, indicação
de fluxo/setor, estados válidos e regras de saldo. Definir os cruzamentos, campos
dos cards, datas/ordenação dentro de cada setor e métricas com o usuário. Preservar
códigos completos e sufixos para as fotos. Só então implementar adaptador/API,
cache, imagens, filtros complementares e impressão conforme contrato confirmado.

## Validação

226 testes passaram na suíte completa. Browser local validou os dois fluxos,
ordem dos 20 grupos, seleção cruzada C32:17x+D32:EN, limpeza e filtro D32,
temas claro/escuro e console sem erros. Revisão independente sem Critical/Important.
Publicada no GitHub/VPS em 23/11/2026 no commit 9cac422. Após integrar as entregas
recentes, 265 testes passaram nos dois ambientes e a navegação pública foi validada.
