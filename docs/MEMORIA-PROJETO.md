# Memória do projeto Oneda CRM

Registro consolidado em 12/10/2026 a partir desta conversa e dos documentos do checkout.
Não é transcrição integral. O código e a VPS devem ser verificados para confirmar o
estado presente, especialmente após alterações realizadas por outros agentes.

## Objetivo e localização

CRM operacional da Oneda: modelagem, estilo, produção, amostras, qualidade e alertas.
Repositório: https://github.com/giovaniivini-bit/ONEDACRM
Produção: https://crm.136-248-111-213.sslip.io/
VPS Oracle: usuário ubuntu, aplicação `/home/ubuntu/apps/ONEDACRM`, porta 3036,
processo PM2 `oneda-crm-app`. O servidor usa Node.js nativo, HTML/CSS/JS puro,
sem Express/React. Planilhas Google Sheets alimentam APIs e snapshots em `data/`.

## Decisões que devem permanecer

- Preservar funcionalidades atuais em qualquer alteração; testar áreas afetadas.
- Dados operacionais `data.js`, CSVs, índices e `data/*_external.json` não devem ser
  sobrescritos por deploy de código. Há alterações operacionais na VPS.
- Imagens usam o código COMPLETO: `21.19.00.0007` e `21.19.00.0007A` são distintos.
- Galerias sem blur, filtros, efeitos 3D ou animações por imagem. Esse comportamento
  resolveu piscadas e travamentos relatados pelo usuário.
- Tema claro precisa de textos legíveis e contraste consistente, preservando o escuro.
- Regras de alertas são alteradas na programação; o app oferece consulta de regras,
  não um editor de regras.
- Operações administrativas usam senha validada no servidor e sessão HttpOnly.
- Antigravity também modifica os aplicativos: inspecionar o estado real antes de editar.

## Imagens — fluxo vigente

PC `C:\ONEDA\Fotos-CRM` (Syncthing somente envio) → VPS
`/home/ubuntu/data/oneda-crm/images` (somente recebimento) → índice automático CRM.
Browser consulta índice a cada 15 segundos com aba visível. Prioridade Syncthing,
incluindo substituições entre extensões. Drive e imagens empacotadas são contingência.
Não requer GitHub/deploy/botão Sincronizar Fotos para imagens nessa pasta.
O PC precisa estar ligado, conectado e com Syncthing ativo para enviar novas alterações.
Guia: `docs/SINCRONIZACAO-DE-IMAGENS.md`.

## Módulos e regras acordadas

Setor 01: miniaturas padronizadas com Setor 13, ETIQUETA e setores de cor/aviamento;
D01/X01 vermelhos piscantes, D02/X02 verdes. Controle de Imagens Ausentes considera
os produtos exibidos nos módulos e preserva correspondência exata.

Prog Feira: planilha `1VdgVNsnz5HTeoCO2pRseXkvgbVcIDxc9u1zrIVLrv1s`.
CODIGO localiza imagem; OP na exportação representa setor; FICHA orienta entrega.
TIPO 1 atual, TIPO 2 agrupamento em ORDEM, TIPO 3 histórico.
O filtro Programação usa exclusivamente COD_CLIENTE do TIPO 1, com seleção
múltipla e opção VAZIO / Sem programação. Não substituir COD_CLIENTE por ORDEM. Fluxo D36 ordenado; DES recebe
tarja azul; SETOR_TING informa M00/M01/M02/M03. Mostrar dias no setor atual.
PDF A4 com quatro colunas e duas linhas (oito cards), setores em páginas separadas.

Calendário industrial: planilha `1T9u4hGeKPPJyKix62u--mudStz3R22RlIrDkqk0ViBg`.
Setor 13 cruza semana A com prazo B; Setor 01 usa limite de dias E. Limites de Feira
vêm das colunas/setores correspondentes. Código vigente é a fonte para detalhes.

Alertas acordados: Setor 13 atrasado; Setor 01 acima do limite; malote 83/88 com parte
principal 20/26; CQ REPROVADO com dias; PEND. PRODUTO aviamento em produção+X01;
PEND. PRODUTO cor em produção+D01 incluindo previsão do módulo Cor; Feira/Amostras
acima do limite com dias atuais e desejados. Consultar `alerts-engine.js` e guia para
listas exatas de setores, critérios e mensagens, sem recriá-los de memória.

## MPO

Aplicativo Python `/home/ubuntu/mapa-otimizado`, porta 8085, PM2 `mapa-otimizado`.
URL https://mpo.136-248-111-213.sslip.io/; documento fonte
`README_INTEGRACAO_CRM.md`. API `/api/crm/workspaces`, `/summary`, `/all-summaries`,
`/search`, `/health`. CRM consulta por backend local via `/api/mpo`.

Tela desejada: pendências por Joyce/Rayza/Ana, Quadro e Mesa de Amostra; busca pessoa,
produto, pendência, previsão, observação e entrega; imagens/fase/cliente/folha completa.
Em 12/10/2026, o usuário esclareceu que a programação só é conhecida pelo nome do PDF
processado, e o MPO guarda as pendências sem uma divisão confiável por programação.
O CRM deve sincronizar toda a memória exposta pela API, inclusive fontes default e
IDs internos. Não exigir B41/B42 nem inferir nomes por ID. Botão Sincronizar MPO,
filtros por responsável, dados da ficha, imagem e folha completa. Cópias de conteúdo
idêntico são unidas; conteúdo diferente permanece separado. Totais por pessoa podem
se sobrepor. Datas sem ano não justificam inferir atraso. Última consulta válida é
preservada com aviso em falhas. Imagens continuam servidas pelo MPO.
Detalhes: `docs/MPO.md`, `docs/ESTADO-ATUAL.md`.

Em 14/10/2026, o usuário pediu filtros independentes para combinação/terceiros por
pessoa e imagens agrupadas por entrega. Implementados nove grupos, cruzados com
responsável, busca e data. Trocar responsável ou sincronizar preserva as outras
seleções; Limpar filtros remove todas. Contadores podem se sobrepor e respeitam os
filtros pertinentes. Preservar anos explícitos; não presumir ano nem atraso.

## Galeed e outros aplicativos

Objetivo informado para Galeed: segundo cérebro da Oneda, arquivar informação importante,
histórico e apoiar decisões. Usuário informou instalação concluída; integração com CRM
não foi validada nesta rodada. Consultar instalação/documentação atual antes de agir.
Não assumir que CRM e Galeed já trocam dados.

Usuário anteriormente autorizou remoção de Hermes/Ollama e verificações de proteção da
VPS; esta memória não atesta a segurança atual nem autoriza novas remoções.

## Organização da memória

Este arquivo registra decisões duradouras. `ESTADO-ATUAL.md` registra o trabalho em
curso. Os guias detalham a operação. Skill `skills/oneda-crm/SKILL.md` recupera esses
arquivos em novas conversas. Publicar documentos no GitHub quando incluído no escopo;
arquivos locais e chat, sozinhos, não constituem backup remoto.
