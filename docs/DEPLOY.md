# Deploy do Oneda CRM

## Produção

- URL: `https://crm.136-248-111-213.sslip.io`
- VPS: Oracle, usuário `ubuntu`, IP `136.248.111.213`
- Diretório: `/home/ubuntu/apps/ONEDACRM`
- Processo: PM2 `oneda-crm-app`
- Health check: `/api/health`

## Dados que não podem ser substituídos

O diretório `data/` contém CSVs, snapshots e caches atualizados pela operação. Um deploy
de código deve abortar se o commit remoto trouxer alterações inesperadas nesses arquivos.
Também preserve `data/alert_rules.json`, que contém as regras personalizadas do módulo
Alertas e não é versionado no Git.

## Atualização segura

```bash
cd /home/ubuntu/apps/ONEDACRM
git fetch origin main
git diff --name-only HEAD..origin/main
git pull --ff-only origin main
npm test
pm2 restart oneda-crm-app --update-env
pm2 save
curl -fsS https://crm.136-248-111-213.sslip.io/api/health
```

Antes do `git pull`, confirme que a relação de arquivos não inclui dados operacionais.
Reinicie somente `oneda-crm-app`; os demais aplicativos da VPS não fazem parte deste
deploy.

## Chave administrativa

A chave não fica no Git. Na VPS, ela está armazenada em:

```text
/home/ubuntu/.config/oneda-crm/admin-token
```

O arquivo deve permanecer com permissão `600`. O PM2 recebe a variável
`CRM_ADMIN_TOKEN` e sua lista de processos persistida mantém a configuração após reboot.
Nunca copie o valor da chave para documentação, commit, log ou canal público.

## Rollback

O commit anterior ao último deploy fica registrado em:

```text
/home/ubuntu/.config/oneda-crm/previous-commit
```

Antes de qualquer rollback, faça backup dos dados operacionais e confirme o commit alvo.
Depois do rollback, rode os testes, reinicie somente `oneda-crm-app` e valide o health
check e as telas principais.
