# Guia do Oneda CRM 360

Este documento é a referência para manutenção do CRM, especialmente antes de solicitar alterações pelo Antigravity, Codex ou outro agente. Ele descreve como o aplicativo funciona hoje e quais cuidados evitam regressões.

## 1. Visão geral

O CRM consolida informações de produção e controle da Oneda. A interface possui módulos para:

- resumo macro;
- pedidos no Setor 13;
- pedidos em processo nos setores 05, 06 e 12;
- lead time produtivo;
- pendências do Setor 01;
- situação de estampa;
- cores e aviamentos pendentes;
- rotativos;
- malotes dos setores 88 e 83;
- feira e protótipos;
- andamento do Controle de Qualidade;
- sincronização, calendário e controle de imagens ausentes.

O projeto não utiliza React, banco SQL ou API externa própria. É uma aplicação Node.js com HTML, CSS e JavaScript puros.

## 2. Arquivos importantes

| Arquivo/pasta | Responsabilidade |
| --- | --- |
| `server.js` | Servidor HTTP, APIs, sincronização de planilhas, índice e entrega de imagens. |
| `app.js` | Estado da aplicação, transformação dos dados, navegação e renderização das telas. |
| `index.html` | Estrutura fixa, menu lateral e carregamento dos arquivos da interface. |
| `style.css` | Identidade visual e layout responsivo. |
| `data.js` | Fonte local de contingência usada quando necessário. |
| `data/` | CSVs, índices e caches operacionais gerados pelo servidor. |
| `images/` | Fotos estáticas que são publicadas junto com o CRM. |
| `image_map.json` | Liga códigos/aliases de produtos aos arquivos da pasta `images/`. |
| `drive-image-cache.js` | Proxy e cache persistente das imagens obtidas no Google Drive. |
| `test/` | Testes automatizados do proxy/cache de imagens. |

## 3. Como os dados das planilhas chegam ao CRM

1. O servidor baixa os CSVs publicados ou exportados pelo Google Sheets.
2. Os dados são normalizados em `server.js` e `app.js`.
3. O navegador recebe os registros pelas APIs locais do CRM.
4. `app.js` agrupa os registros por OP, código, setor, cliente, marca e status.
5. Cada tela aplica seus próprios filtros e indicadores.

Algumas planilhas auxiliares mantêm snapshots em `data/*_external.json`. Esses arquivos são dados operacionais, não código. Uma alteração visual ou funcional não deve sobrescrevê-los na VPS por acidente.

Se uma planilha estiver temporariamente indisponível, o CRM pode continuar usando o último cache válido. Por isso, um valor antigo na tela nem sempre significa problema no frontend; primeiro verifique a sincronização.

## 4. Como as imagens funcionam

O CRM usa um modelo híbrido.

### 4.1 Imagens estáticas na VPS

- Ficam em `/home/ubuntu/apps/ONEDACRM/images/` na produção.
- São versionadas no repositório dentro de `images/`.
- `image_map.json` relaciona códigos de produto a arquivos.
- São servidas em `/images/NOME-DO-ARQUIVO`.
- É o caminho mais rápido, pois não depende do Google Drive durante a visualização.

### 4.2 Imagens existentes somente no Google Drive

1. O usuário adiciona a imagem à pasta do Drive usada pelo CRM.
2. O nome do arquivo deve usar o código completo do produto, por exemplo `01.16.00.7930.jpg`.
3. O botão **Sincronizar Fotos** solicita `/api/drive-images?refresh=1`.
4. Sem uma API autenticada, o Google entrega à VPS somente uma parte da listagem da pasta pública. Portanto, esse botão atualiza os arquivos que a VPS consegue enxergar, mas não garante descobrir todo o acervo.
5. Quando o arquivo foi descoberto e possui ID, a VPS busca a miniatura pelo proxy `/api/proxy-image`.
6. A resposta válida é guardada em `data/drive_thumbnail_cache/`.
7. Os acessos seguintes usam o cache local da VPS.

O botão de sincronização não copia arquivos para `images/` e não deve ser tratado como uma varredura completa. Enquanto não houver Google Drive API autenticada, o fluxo confiável usado pelo CRM e pelo Studeoneda é copiar as imagens da pasta sincronizada do Drive no computador para `images/`, versioná-las no GitHub e publicá-las na VPS.

### 4.3 Fallback

- A interface tenta primeiro a imagem local quando ela existe.
- Se o arquivo local falhar e houver ID do Drive, tenta o proxy do Drive.
- A ampliação também tenta a fonte alternativa antes do placeholder.
- Se nenhuma fonte funcionar, a interface mostra “Imagem indisponível” ou “Sem foto na pasta”.

### 4.4 Tela Imagens Ausentes

Em **Gestão & Dados → Imagens Ausentes**, o CRM lista códigos de produtos atuais sem correspondência no índice de imagens. A tela permite:

- pesquisar por código, OP, cliente, marca ou setor;
- ver o nome de arquivo esperado;
- sincronizar novamente o Drive;
- exportar as pendências em CSV.

## 5. Regras para novas imagens

- Use `.jpg`, `.jpeg`, `.png`, `.webp`, `.gif` ou `.svg`.
- O nome deve conter o código exato: `CODIGO.jpg`.
- Preserve sufixos: um produto `01.16.00.7930A` deve usar `01.16.00.7930A.jpg`.
- Evite nomes genéricos como `foto nova.jpg`.
- Aguarde o Google Drive para computador concluir a sincronização local.
- Copie os novos arquivos para `images/`, publique a versão no GitHub/VPS e confira **Imagens Ausentes**.
- O botão **Sincronizar Fotos** pode localizar arquivos públicos adicionais, mas não substitui essa publicação enquanto a API oficial não estiver configurada.

## 6. Estabilidade visual das fotos

As galerias não usam blur, zoom, animação, transformação 3D ou escurecimento no hover. Esses efeitos foram removidos porque grades extensas provocavam piscadas, blocos pretos e travamentos em alguns computadores. Não reintroduza `backdrop-filter`, `translateZ`, `content-visibility` nos cards, filtros gráficos ou animações por foto sem um teste longo de rolagem no Chrome.

No CQ, a mídia possui altura fixa e a imagem é clicável diretamente. A tela inicia no modo de cards para não montar cards e tabela simultaneamente.

## 7. Execução e validação local

Requisitos: Node.js disponível no computador.

```bash
npm start
```

Por padrão, o CRM abre em `http://127.0.0.1:3000`. Para usar outra porta no PowerShell:

```powershell
$env:PORT='3102'
node server.js
```

Checks mínimos antes de publicar:

```bash
node --check app.js
node --check server.js
npm test
git diff --check
```

Validação manual obrigatória:

1. Abrir Setor 13, Processo, Estampa e CQ.
2. Rolar uma grade longa sem piscadas ou blocos pretos.
3. Abrir uma foto no lightbox.
4. Conferir a tela Imagens Ausentes.
5. Sincronizar fotos e confirmar que os números são recalculados.

## 8. Produção e publicação

- URL pública: `https://crm.136-248-111-213.sslip.io`
- Diretório: `/home/ubuntu/apps/ONEDACRM`
- Processo PM2: `oneda-crm-app`

Fluxo seguro:

1. Criar commit apenas com arquivos intencionais.
2. Enviar o commit ao GitHub.
3. Fazer backup dos arquivos que serão substituídos na VPS.
4. Atualizar o código em `/home/ubuntu/apps/ONEDACRM`.
5. Não sobrescrever `.env`, caches ou snapshots de planilhas sem necessidade.
6. Reiniciar somente `oneda-crm-app` no PM2.
7. Verificar APIs, imagens e telas no endereço público.

## 9. Checklist para alterações pelo Antigravity

Inclua estas instruções na solicitação:

> Leia `README.md` e `docs/GUIA-DO-CRM.md` antes de alterar o CRM. Preserve a arquitetura Node.js + JavaScript puro, as integrações de planilhas, o índice híbrido de imagens e os caches. Não reintroduza efeitos nas imagens. Não substitua arquivos de `data/` nem configurações da VPS sem autorização. Rode os testes e valide visualmente as telas afetadas.

Antes de aceitar a alteração, confirme:

- quais arquivos serão modificados;
- se dados operacionais serão tocados;
- se a mudança altera nomes de colunas das planilhas;
- se a alteração interfere no índice ou cache de imagens;
- como o agente testará o caminho feliz e os erros;
- quais arquivos serão publicados na VPS.

## 10. Limitações atuais e próximos passos

- A leitura do Google Drive não usa ainda uma API autenticada oficial.
- A listagem pública do Drive é parcial; imagens novas só ficam garantidas quando são espelhadas em `images/` e publicadas.
- Os dados continuam dependentes de planilhas e seus formatos de colunas.
- O deploy na VPS é manual e depende de acesso SSH.

Evoluções recomendadas:

1. integração autenticada com Google Drive API;
2. espelhamento em segundo plano das novas imagens para a VPS;
3. CI/CD com publicação reproduzível;
4. testes automatizados das telas e da correspondência produto-imagem;
5. monitoramento de falhas de sincronização.
