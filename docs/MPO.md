# MPO — sincronização da memória disponível

O CRM consulta `http://127.0.0.1:8085/api/crm/all-summaries` no backend. Não exige
programações B41/B42: o MPO guarda fichas de PDFs e pendências, mas não conserva
necessariamente a identificação da programação. Nomes internos nunca viram nomes
de programação por suposição. Quando houver nome real de origem, ele aparece no card.

Em **MPO**, clique em **Sincronizar MPO**. A abertura da tela também consulta a API.
São exibidos produto, cliente, fase, folha, entrega, responsáveis, pendências,
previsões, observações, imagem da ficha e link para a folha completa.
Filtros: Joyce (pink), Rayza (rosa claro), Ana (azul claro), Quadro (verde),
Mesa de Amostra e Sem Pendências. A busca aplica enquanto se digita e inclui os
responsáveis definidos pelos grupos da API, mesmo se o nome não estiver no texto.
Datas são exibidas como recebidas; não se presume ano nem atraso.

### Pendências independentes e entregas (14/10/2026)

O filtro **Responsável** cruza com **Grupo de pendência independente** e **Data de
entrega**. Os nove grupos são terceiros/combinação de Joyce, Rayza e Ana, Quadro,
Mesa de Amostra e Sem Pendências. Todos permanecem disponíveis, inclusive para
cruzar Ana + Quadro. Trocar responsável não apaga grupo nem entrega; **Limpar filtros**
remove as três seleções e a busca. Sincronizar também preserva as seleções atuais.

Exemplo: Ana → Terceiros pendentes Ana → 30/10. Uma ficha pode aparecer em combinação
e terceiros, mas aparece uma só vez no resultado. Os contadores de grupos respeitam
responsável, busca e data atual; os contadores de datas respeitam responsável, grupo
e busca, permitindo escolher outra entrega. Uma seleção sem resultado continua
explícita e pode ser removida. Os totais por responsável referem-se a toda a consulta.

As imagens iniciam agrupadas por entrega, com cabeçalho e quantidade por data. A opção
**Grade de fichas** reúne os mesmos resultados sem os cabeçalhos de data. Nos cards,
cada pendência tem seu próprio bloco, com previsão/informação correspondente.

O helper compartilhado `mpo-filters.js` classifica pelos nomes oficiais de pendência
da API. Datas válidas são normalizadas (5/8 → 05/08); anos explícitos são preservados.
Sem ano, não se presume atraso. Datas sem ano são ordenadas por mês/dia, seguidas
das datas com ano explícito; valores não reconhecidos e fichas sem data ficam em
grupos próprios. Alternativas de imagem são associadas à chave da ficha para não
misturar fotos quando o agrupamento muda a ordem dos cards.

## Contrato do CRM

`GET /api/mpo/pending-by-person` e `GET /api/mpo` retornam o mesmo objeto:

```json
{
  "fetchedAt": "2026-10-12T12:00:00.000Z",
  "stale": false,
  "summary": {
    "workspace": {
      "nome": "Memória disponível do MPO",
      "total_pecas": 1,
      "total_com_pendencia": 1,
      "total_sem_pendencia": 0
    },
    "sourceCount": 1,
    "identicalCopies": 0,
    "todas_pecas": [{
      "key": "identificador-de-conteudo",
      "ref": "01.16.00.7930A",
      "pendencias": ["pendente combinação Ana"],
      "previsoes": {},
      "sources": [{"id": "default", "name": "", "updatedAt": ""}],
      "image_full_url": "https://mpo.136-248-111-213.sslip.io/workspaces/default/images/fichas/a.png",
      "image_urls": ["https://mpo.136-248-111-213.sslip.io/workspaces/default/images/fichas/a.png"],
      "folha_full_url": "",
      "folha_urls": []
    }],
    "por_responsavel": {
      "ana": {"responsavel": "Ana", "total_pecas": 1, "itens": [{"key": "identificador-de-conteudo"}]}
    }
  }
}
```

A API preserva os demais campos originais da ficha. `warning` é opcional e explica
falha de consulta ou de gravação do cache. Sem consulta anterior e com MPO indisponível,
o CRM retorna HTTP 502. Métodos diferentes de GET retornam 405.

## Consolidação e contingência

Todos os conjuntos retornados pelo MPO são considerados, incluindo `default` e IDs
internos. Cópias com mesmo código completo, cliente, folha, fase, entrega, situação,
pendências, previsões e observações são unidas. Imagens alternativas e fontes são
preservadas. Registros com conteúdo diferente permanecem separados, mesmo com a
mesma referência. Totais por responsável podem se sobrepor e não devem ser somados.

A última resposta válida fica em `data/mpo_snapshot.json`, ignorado pelo Git e gravado
atomicamente. Falha do MPO ou contrato incompleto mantém o snapshot anterior e a data
original, com aviso explícito. Uma resposta válida com fontes sem fichas pode limpar
o resultado. Consultas simultâneas compartilham a mesma requisição.

Imagens usam HTTPS no domínio do MPO, com validação de caminhos e alternativas para
cópias idênticas. Se o MPO estiver fora do ar, o snapshot preserva textos e links,
mas não garante as imagens: os arquivos continuam servidos pelo MPO. Nenhum PDF,
pendência, planilha ou configuração do MPO é alterado pela sincronização do CRM.

## Limites verificados em 12/10/2026

A API mostra três fontes internas. A leitura real resultou em 73 fichas distintas,
30 com pendências e 36 cópias idênticas unidas, com links de imagem nas 73 fichas.
Isso é uma conferência pontual; o botão consulta os dados disponíveis naquele momento.
A sincronização não recupera programações ou fichas que não estejam expostas pela API.
