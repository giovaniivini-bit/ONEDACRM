# Raio X

Fonte: mesma planilha `testess` sincronizada pelo CRM. A tela fica em Estilo Pedido,
logo após Pend. Setor 01.

Um card por OF e código completo, reunindo os setores 01, 02, 03, 04, 05G, 43, CM1,
05, 06, 12, 13, 20, 26, 31 e 106. Produtos diferentes da mesma OF não são unidos.
Os setores secundários não criam cards por si só.

Cor D01 e aviamento X01 são cruzados pela mesma OF e código completo.
Filtros Com cor e Com aviamento são inclusivos: o produto que tem ambas aparece
nos dois. Cor e aviamento exige as duas; Sem cor e aviamento exige nenhuma.
A regra exclusiva de Só cor/Só aviamento do Setor01 permanece inalterada.
Malotes: parte D7 em 83/88, confirmada pelo usuário a partir da base atual.
Os status de estilo reutilizam os grupos do Setor 01; status desconhecidos ficam
em Todos. Quando há status distintos por setor, todos são apresentados e o filtro
aceita qualquer um dos status exibidos. Modelagem oferece valores dinâmicos.

Quantidade: maior quantidade consolidada entre setores, sem somar novamente o mesmo
produto por estar em várias etapas. O card explicita esse critério. Cada setor mantém
seus próprios dias de permanência. A contagem por setor pode somar mais que o total
de cards, porque o produto pode estar em vários setores.

Filtros combináveis: setor, cliente, cor/aviamento, estilo, modelagem, malotes e busca.
Os botões de Produtos por setor permitem seleção múltipla: um produto em qualquer
setor marcado é incluído uma única vez. Todos ou desmarcar o último setor restaura
a base inteira. As contagens dos botões respeitam os demais filtros e não são
zeradas pela seleção de outro setor, permitindo comparar e ampliar a seleção.
Filtros globais do CRM também restringem os produtos principais, mas nunca removem
os registros secundários usados no cruzamento. PDF usa o conjunto visível.

Impressão: grupos de até seis cards, três colunas e duas linhas em A4 paisagem.
Margens de 12 mm em todos os lados, prevalecendo sobre a margem global.
Identificação, descrição e detalhes em linhas próprias, com quebra de texto e altura
automática, sem esconder excedentes. Layout exclusivo de impressão não altera a tela.
O resumo e os totais aparecem somente na primeira folha. Controles e seleção de
setores ficam ocultos, assim como os metadados de cliente/marca/etiqueta/semana/OC/peças.
Permanecem a identificação do produto, foto em destaque, setores/dias, status e
pendências de cor, aviamento e malote. O modo da tela é restaurado após imprimir.

Validação: testes de consolidação, chaves, setores, D7, grupos de estilo e combinações.
O smoke opcional com CRM_SMOKE_PDF testa 17 cards ([6,6,5]), caso denso,
fallback de foto e restauração após impressão. O PDF gerado deve ser conferido
quanto à contagem real por página e renderizado para revisão visual.

## Complementos das planilhas de cores e aviamentos

Apenas D01 recebe dados de cores; apenas X01 recebe dados de aviamentos. Ambos
exigem uma linha útil na planilha externa com PRODUTO igual ao código completo,
ignorando apenas espaços externos/caixa. Não remove sufixos nem usa prefixos.
Planilhas sem OF são cruzadas por produto; cards seguem identificados por OF+código.
Sem correspondência, fonte indisponível ou linha só com PRODUTO: não acrescentar
bloco. A pendência D01/X01 original continua, mesmo se houver envio ao cliente.

Cada linha vira um item: cor/Pantone ou tipo/descrição de aviamento. ENV CLIENTE
(cores) e ENV. CLIENTE (aviamentos) têm prioridade sobre PREVISÃO. Se envio estiver
vazio, traço ou erro de célula, mostrar a previsão. Se não houver ambos, mas houver
cor/tipo/descrição, informar envio/previsão não informados. Não inferir aprovação,
não usar RECEBIDO como envio ao cliente e não converter conteúdo textual em data.
Todos os itens são preservados, inclusive após a linha50; sem escolher último registro.

Atualização das fontes refaz o Raio X aberto; isLive=false identifica cache local.
PDF conserva complementos legíveis e margem segura. Muitos detalhes podem ocupar
mais folhas: não reduzir fontes nem esconder conteúdo para forçar seis por folha.

Smoke opcional: fornecer Playwright via NODE_PATH, definir CRM_SMOKE_URL para a
prévia e rodar node scripts/smoke-raio-x-sheets.cjs. CRM_SMOKE_PDF opcional grava
PDF da fixture; o teste só intercepta leituras em seu navegador isolado.

### Observações das planilhas (29/10/2026)

Cada item de cor/aviamento conserva OBS/OBSERVAÇÃO da própria linha e a apresenta
abaixo de envio/previsão, omitindo campos vazios. Cor e Pantone dividem a linha de
título quando houver espaço; em telas estreitas quebram sem sobrepor. Observação
preserva novas linhas, é escapada e integra a impressão. Demais regras de D01/X01,
correspondência completa e preferência de ENV. CLIENTE permanecem iguais.
