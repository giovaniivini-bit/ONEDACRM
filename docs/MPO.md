# Módulo MPO

O CRM consulta a API de leitura do MPO em `http://127.0.0.1:8085` através de
`GET /api/mpo`. O navegador acessa somente a API do CRM e as imagens HTTPS do MPO.

A primeira ação é selecionar uma programação. Apenas nomes `B` seguidos de números
(B41, B42 etc.) são oferecidos; os IDs internos identificam a consulta, mas não são
usados como nomes exibidos. Nenhuma programação é selecionada automaticamente.

O módulo mostra produtos, pendências, previsões, observações, imagens e filtros por
responsável. O botão Atualizar consulta novamente a API. A integração é somente leitura.

## Pendência encontrada na implantação

Em 10/10/2026, o MPO armazenava os nomes dos projetos em `localStorage`
(`mpo_projects_index`), mas a API expunha somente IDs internos. Para disponibilizar as
programações no CRM, o MPO deve persistir os nomes reais no campo `name` de
`public/workspaces/<id>/workspace_info.json`, incluindo futuras criações e renomeações.
Não atribuir B41/B42 a IDs antigos por suposição. Programações ainda não publicadas
no servidor também precisam ser enviadas pelo MPO.
