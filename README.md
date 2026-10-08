# Oneda CRM 360

CRM operacional da Oneda para acompanhar modelagem, estilo, produção, amostras, controle de qualidade e dados auxiliares. A aplicação é um servidor Node.js sem framework de frontend: o navegador recebe `index.html`, `style.css` e `app.js`, enquanto `server.js` expõe os dados, sincronizações e imagens.

## Documentação principal

Leia [docs/GUIA-DO-CRM.md](docs/GUIA-DO-CRM.md) antes de alterar o sistema no Antigravity ou em outro agente de desenvolvimento. O guia documenta:

- arquitetura e arquivos importantes;
- origem e sincronização das planilhas;
- funcionamento das imagens locais, Google Drive e cache da VPS;
- módulo de alertas com regras operacionais versionadas no código;
- módulos e telas existentes;
- execução local, testes e publicação;
- checklist seguro para realizar mudanças.

O diagnóstico estrutural e o backlog técnico desta rodada estão em
[docs/AUDITORIA-ARQUITETURA-2026-09.md](docs/AUDITORIA-ARQUITETURA-2026-09.md).
O procedimento de publicação, verificação e rollback está em
[docs/DEPLOY.md](docs/DEPLOY.md).
O procedimento operacional das fotos está em
[docs/SINCRONIZACAO-DE-IMAGENS.md](docs/SINCRONIZACAO-DE-IMAGENS.md).

## Execução local

```bash
npm start
```

Acesse `http://127.0.0.1:3000`.

Copie `.env.example` para o mecanismo de variáveis usado no ambiente e defina
`CRM_ADMIN_PASSWORD_HASH` na produção. O navegador abre o login somente ao executar
uma ação administrativa; a senha é validada no servidor e nunca é armazenada no
navegador. A sessão segura dura até 8 horas e protege sincronizações, imports, uploads
e outras operações administrativas.

`CRM_ADMIN_TOKEN` existe apenas como recuperação temporária para automações antigas e
deve permanecer fora do Git.

Para gerar um hash compatível sem deixar a senha no histórico do terminal, execute
`node scripts/generate-admin-hash.js`; a digitação é mascarada e apenas o hash é exibido.

## Testes

```bash
npm test
```

## Produção

- URL: `https://crm.136-248-111-213.sslip.io`
- Aplicação na VPS: `/home/ubuntu/apps/ONEDACRM`
- Processo: PM2 `oneda-crm-app`

Não substitua arquivos dentro de `data/` durante uma publicação de código sem confirmar que a intenção é também alterar os dados operacionais.
