# Estado atual — Oneda CRM

Atualizado em 12/10/2026. Snapshot de continuidade, não monitoramento ao vivo.

## Última implementação verificada

Commit `9d12ebd`: MPO por responsável, publicado GitHub/VPS em 10/10/2026.
84 testes passaram; saúde CRM OK; `/api/mpo` respondeu com lista vazia e zero fichas.
Arquivos principais: `mpo-integration.js`, `mpo-view.js`, `docs/MPO.md`.

Imagens: última conferência em 09/10/2026 registrou 495 no PC, 495 na VPS e 495 no
índice CRM. Syncthing foi reativado após encontrá-lo parado. Há registro de início
automático do Windows, mas não foi feito teste de reboot. Log mostrou falta de espaço
anterior no PC; naquele momento da conferência havia 12,45 GB livres. Não interpretar
esses números como estado atual.

## Pendência em curso

Na última inspeção o MPO tinha somente `mpo_project_default` (37 fichas),
`mpo_project_1785869413022` (36 fichas) e `default`; nomes B41/B42 não apareciam na API.
Versão servida é `public/app.js`; o `app.js` da raiz é antigo e difere do servido.
Upload aceita `workspaceName` e salva metadados. Nomes legados também existem em
localStorage. Usuário pediu ao Antigravity resolver a disponibilização das programações
em 12/10/2026. A correção ainda NÃO foi inspecionada por este agente.

Próxima ação: verificar API MPO/workspaces e CRM/api/mpo; conferir nomes corretos,
produtos, responsáveis, imagens e entregas. Não solicitar reenvio de PDFs antes de
verificar se Antigravity já publicou os dados. Não renomear projetos por suposição.

## Limitações conhecidas do módulo

- Consolidação consulta resumos sequencialmente; falha de uma fonte interrompe o total.
- Busca de pessoa depende do texto de pendência; filtros por pessoa usam grupos da API.
- Busca atual aplica ao confirmar/sair do campo; datas pesquisadas como texto original.
- Tests de unidade/regressão passaram; navegação visual completa com dados B41/B42
  reais ainda não foi validada porque a API estava vazia para essas programações.

## Retomar em nova conversa

“Use $oneda-crm. Leia docs/MEMORIA-PROJETO.md e docs/ESTADO-ATUAL.md. O Antigravity
trabalhou na API do MPO: confira o que está publicado e valide a integração no CRM.”

Nunca incluir chaves privadas, senhas, tokens ou conteúdo de ambiente no resumo.
