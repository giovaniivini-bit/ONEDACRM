---
name: oneda-crm
description: Retomar e manter o projeto Oneda CRM, recuperando decisões, arquitetura, operação de imagens, integrações e pendências a partir da documentação do repositório. Use para trabalhos neste CRM, não para outros CRMs.
---

# Memória do Oneda CRM

Esta skill é um ponto de entrada para a memória mantida no repositório, não uma cópia
do histórico completo nem uma autorização de deploy.

## Recuperar contexto

Localize o checkout de `giovaniivini-bit/ONEDACRM`. O caminho conhecido neste PC é
`C:/360 skills/Dev-multiagentes/.tmp-onedacrm-image-refresh`; confirme o remoto e o
estado Git antes de usá-lo. Se o caminho não existir, procure o projeto ou consulte o
repositório conectado, sem assumir que os dados desta skill estão atualizados.

Leia primeiro `docs/MEMORIA-PROJETO.md` e `docs/ESTADO-ATUAL.md`. Para a tarefa em
questão, consulte somente os documentos relevantes: `docs/GUIA-DO-CRM.md`,
`docs/DEPLOY.md`, `docs/SINCRONIZACAO-DE-IMAGENS.md` ou `docs/MPO.md`.

Explique brevemente o estado recuperado e o próximo passo. Diferencie fatos verificados,
relatos do usuário e pendências. Mudanças feitas por Antigravity ou outro agente podem
ter ocorrido após o snapshot: verifique código/API atuais quando isso importar.

## Preservar continuidade

Ao concluir uma alteração neste projeto, atualize `docs/ESTADO-ATUAL.md` com data,
arquivos/commit, verificações realizadas, limitações e próximo passo. Decisões duradouras
ficam em `docs/MEMORIA-PROJETO.md`; regras operacionais detalhadas ficam nos guias
específicos. Corrija estados anteriores em vez de acumular resumos contraditórios.

Não armazene senhas, tokens, chaves privadas, conteúdo de `.env` ou configuração secreta
do PM2. Registre somente locais de configuração e instruções seguras de acesso.
Não transforme essa memória em autorização permanente para publicação ou mutações
fora do pedido atual. Preserve dados operacionais e alterações de outros agentes.

Uma nova conversa pode começar com: “Use $oneda-crm, leia a memória do projeto e
verifique o estado atual antes de continuar com [tarefa]”.
