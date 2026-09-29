# Auditoria técnica do Oneda CRM — setembro de 2026

## Resumo executivo

O CRM atende a operação atual, mas cresceu como uma aplicação monolítica em JavaScript
puro. A prioridade desta rodada foi reduzir riscos imediatos sem reescrever o produto:
preservar as telas, proteger mutações no servidor, limitar exposição de arquivos,
estabilizar integrações externas e criar o primeiro módulo de regras operacionais.

## Arquitetura observada

- servidor HTTP nativo em `server.js`, sem framework;
- interface em `index.html`, `style.css` e `app.js`;
- dados principais em CSV/JSON e snapshots de planilhas;
- imagens locais com fallback/proxy/cache do Google Drive;
- execução em processo PM2 na VPS;
- ausência de banco de dados, contas de usuário e separação formal em módulos.

## Riscos tratados nesta rodada

1. **Arquivos internos públicos:** o servidor entregava qualquer arquivo do diretório,
   incluindo código e dados. A publicação agora usa uma lista explícita de arquivos web.
2. **Rotas de escrita abertas:** sincronizações, imports, uploads e regras agora passam por
   um gate administrativo no servidor.
3. **Corpos sem limite:** imports e uploads passam a rejeitar requisições excessivas.
4. **CORS aberto:** somente a origem do próprio CRM recebe autorização CORS.
5. **Falhas externas mascaradas:** a API não inventa mais estatísticas quando uma planilha
   e seu cache falham; retorna erro verificável.
6. **Escrita parcial de snapshots:** atualizações passam a usar arquivo temporário e troca
   atômica.
7. **Consultas repetidas:** snapshots externos válidos têm janela curta de reutilização.
8. **Prazo com data fixa:** o cálculo volta a usar o dia atual.

## Módulo Alertas

O módulo foi separado em um motor puro (`alerts-engine.js`) para evitar misturar a regra
de negócio com a renderização. Ele recebe registros e regras validadas, produz ocorrências
deduplicadas e não altera os dados de origem. A interface pagina os resultados e a API
persiste somente as regras personalizadas.

Essa base foi desenhada para receber futuramente o Calendário Industrial: a planilha deve
ser normalizada em campos de data no servidor e, depois, exposta como condições do motor,
sem codificar cada alerta diretamente na tela.

## Pontos ainda recomendados

### Prioridade alta

- colocar o endereço do CRM atrás de autenticação individual ou VPN/Cloudflare Access;
- configurar `CRM_ADMIN_TOKEN` forte e backup de `data/alert_rules.json` na VPS;
- autenticar a Google Drive API para eliminar a listagem pública parcial;
- adicionar smoke automatizado das rotas HTTP ao pipeline de publicação.

### Prioridade média

- dividir `app.js` em módulos por domínio, começando por CQ, imagens e alertas;
- remover handlers legados duplicados após testes de regressão dedicados;
- criar contrato único de normalização das colunas das planilhas;
- automatizar deploy, health check e rollback.

### Prioridade futura

- adotar banco de dados quando histórico, autoria e auditoria de decisões forem requisitos;
- integrar Alertas ao Galeed para registrar contexto, justificativas e decisões, mantendo o
  CRM como fonte operacional e o Galeed como memória consultável.

## Evidências de validação

- verificação de sintaxe dos quatro arquivos JavaScript centrais;
- 15 testes automatizados aprovados, incluindo rotas HTTP reais;
- smoke HTTP para arquivos públicos, arquivos bloqueados, CORS, autorização e métodos;
- validação visual da tela Alertas, cálculo real, filtro, criação, teste e persistência;
- abertura da tela inicial com os 377 registros e badges dos módulos existentes.
