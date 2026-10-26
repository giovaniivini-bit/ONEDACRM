# Raio X

Fonte: mesma planilha `testess` sincronizada pelo CRM. A tela fica em Estilo Pedido,
logo após Pend. Setor 01.

Um card por OF e código completo, reunindo os setores 01, 02, 03, 04, 05G, 43, CM1,
05, 06, 12, 13, 20, 26, 31 e 106. Produtos diferentes da mesma OF não são unidos.
Os setores secundários não criam cards por si só.

Cor D01 e aviamento X01 são cruzados pela mesma OF e código completo.
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

Validação: testes de consolidação, chaves, setores, D7, grupos de estilo e combinações.
