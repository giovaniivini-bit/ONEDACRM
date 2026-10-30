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

PC `C:\ONEDA\Fotos-CRM` → VPS `/home/ubuntu/data/oneda-crm/images` → índice automático CRM.
Em 28/10/2026, a pedido do usuário, Syncthing foi desinstalado do PC e da VPS.
Imagens preservadas; não há mais envio automático por Syncthing. O usuário pretende
criar automação Python; ela ainda não foi implementada nesta sessão.
Browser consulta índice a cada 15 segundos com aba visível. Drive e imagens
empacotadas são contingência. Não requer GitHub/deploy para imagens nessa pasta.
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

## Impressão Raio X (26/10/2026)

Usar A4 paisagem com margem mínima de 1cm (CSS aplica12mm!important para vencer
regra global de margem zero). Até6cartões por grupo,3colunas; campos separados e
altura automática. Não voltar aos badges comprimidos de6px ou esconder excedentes.

## Nova base Prog Feira — 27/10/2026

A fonte atual é ERP detalhado. Cards somente parte FE/fluxo D36 com Qtde Pend>0,
setores da sequência já existente; consolidar por Número (OF)+Código completo.
Descrição2 é Programação, mantendo multisseleção e VAZIO. Ficha é entrega.
D6/D35 custos, TF/D43 tingimento, AV/D47 aviamento, CO/D41 cor complementam o card;
apenas estados pendentes em linhas empilhadas (COR, CUSTO, TINT. CASEIRA, AVIAMENTO).
Cor usa D01/D02; aviamento X01/X02. Não criar cards de fluxos paralelos isolados,
não somar suas quantidades e não interpretar ausência como resolvido ou como M00.
Formato antigo TIPO1/2/3 e COD_CLIENTE é compatibilidade, não a fonte atual.

## Raio X × planilhas externas — 27/10/2026

Somente card com D01/X01 e informação útil em linha PRODUTO de cores/aviamentos
recebe complemento. Código completo preserva sufixos, sem cruzamento por prefixo.
Mostrar cor/Pantone ou tipo/descrição; ENV CLIENTE/ENV. CLIENTE prevalece sobre
PREVISÃO. Se vazio, usar previsão; nunca RECEBIDO. Preservar todas as linhas e valores
textuais. Sem informação correspondente não criar bloco nem inventar ausência de
pendência; envio não resolve D01/X01 automaticamente. PDF conserva os complementos.

## Acompanhamento de previsões em Alertas (29/10/2026)

Tipos Andamento cores e Andamento aviamentos em Avisos ativos comparam PREVISÃO ao dia civil de
São Paulo: mostrar somente vencidos e hoje. Um alerta por linha, código completo
inclusive ON/sufixos, sem restringir a D01/X01. Regra confirmada pelo usuário:
retirar linha quando RECEBIDO ou ENV. CLIENTE tiver data válida. Linhas sem previsão
válida ou produtos identificáveis não geram alerta. Itens de um produto podem ter
previsões e conclusões independentes; não consolidar pela primeira ocorrência.

Prog Feira oferece alternância Apenas imagens e dias, antes dos grupos de imagens:
no modo compacto mantém somente ficha e contadores D36/D43, ocultando códigos e
setores dos cards. Filtros/contagens preservados. Segundo clique restaura; imagem
continua ampliável e impressão acompanha o modo escolhido.

Impressão Prog Feira: 8 cards/página no modo completo; 16 (4×4) exclusivamente no
modo Apenas imagens e dias. Paginação mantém setores separados e pode terminar
com página parcial. Fotos contidas sem corte, com dias D36/D43 abaixo.

## Produção do costura (30/10/2026)

Tela abaixo de Prog Feira, ligada exclusivamente à aba Produção Amostras do arquivo
1h04pHGE4wYZ3FnhAT3M-IeSB8pIFAi-RHdsqwKxwMwU, gid2024325688. Semana atual sempre
primeiro; depois produção diária/pessoa e histórico. Costura = Jô/Cleide/Josi;
ações do corte ficam fora. Meta é quantidade de referências para entregar na semana.
Calcular percentuais pelos totais exatos; médias principais arredondadas para inteiro
(69/5→14,58/5→12). Novas semanas entram à esquerda: detectar nomes/datas, não letras
fixas. Datas repetidas ficam sinalizadas, sem duplicar médias. Guia: PRODUCAO-COSTURA.md.
