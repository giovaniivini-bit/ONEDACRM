# Oneda CRM — continuidade e desenvolvimento

Este repositório é `giovaniivini-bit/ONEDACRM`. Antes de editar, confirme o remoto,
o estado Git e leia `docs/MEMORIA-PROJETO.md` e `docs/ESTADO-ATUAL.md`.

Por solicitação do usuário, use a skill **CRM** (`$crm`), instalada neste PC em
`C:/Users/estilo08/.codex/skills/crm/SKILL.md`. A memória local e os arquivos de
conversas ficam em `C:/360 skills/Dev-multiagentes/CRM`; o código permanece aqui.
Em outro computador, se essa skill não existir, use os documentos do repositório
e localize o pacote DEV-multiagentes disponível, sem assumir caminhos locais.

## Método DEV-multiagentes

Use `a360-dev-multiagentes` como roteador: mudanças cotidianas seguem `codar`,
com testes adequados e revisão independente `revisar` para mudanças não triviais.
Mudanças grandes seguem planejamento, contratos e territórios disjuntos antes
de agentes paralelos. Use handoff/retomar quando aplicável. Não reconstrua a
aplicação nem troque Node/PM2 por templates de infraestrutura ao usar o método.

Preserve arquivos operacionais, alterações locais, fotos e PDFs. Dados em
`data.js`, CSVs, `data/*_external.json` e `data/automatic-reports/` não são código
descartável. Não faça reset desses dados durante deploy. Regras específicas
de negócio e operação estão em docs/. Nunca registre credenciais em commits.

Ao finalizar, registre validações e pendências em ESTADO-ATUAL; decisões
duradouras em MEMORIA-PROJETO. Arquivos de conversas são evidência histórica,
não substituem o pedido atual nem concedem autorização para ações externas.
