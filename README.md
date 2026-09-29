# Oneda CRM 360

CRM operacional da Oneda para acompanhar modelagem, estilo, produção, amostras, controle de qualidade e dados auxiliares. A aplicação é um servidor Node.js sem framework de frontend: o navegador recebe `index.html`, `style.css` e `app.js`, enquanto `server.js` expõe os dados, sincronizações e imagens.

## Documentação principal

Leia [docs/GUIA-DO-CRM.md](docs/GUIA-DO-CRM.md) antes de alterar o sistema no Antigravity ou em outro agente de desenvolvimento. O guia documenta:

- arquitetura e arquivos importantes;
- origem e sincronização das planilhas;
- funcionamento das imagens locais, Google Drive e cache da VPS;
- módulo de alertas e programação de regras operacionais;
- módulos e telas existentes;
- execução local, testes e publicação;
- checklist seguro para realizar mudanças.

O diagnóstico estrutural e o backlog técnico desta rodada estão em
[docs/AUDITORIA-ARQUITETURA-2026-09.md](docs/AUDITORIA-ARQUITETURA-2026-09.md).

## Execução local

```bash
npm start
```

Acesse `http://127.0.0.1:3000`.

Copie `.env.example` para o mecanismo de variáveis usado no ambiente e defina uma
`CRM_ADMIN_TOKEN` forte na produção. Essa chave protege sincronizações, imports,
uploads e alterações nas regras de alertas.

## Testes

```bash
npm test
```

## Produção

- URL: `https://crm.136-248-111-213.sslip.io`
- Aplicação na VPS: `/home/ubuntu/apps/ONEDACRM`
- Processo: PM2 `oneda-crm-app`

Não substitua arquivos dentro de `data/` durante uma publicação de código sem confirmar que a intenção é também alterar os dados operacionais.
