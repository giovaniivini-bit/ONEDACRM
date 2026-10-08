# Sincronização de imagens do Oneda CRM

## Fluxo oficial

```text
PC da empresa                         VPS Oracle                         CRM
C:\ONEDA\Fotos-CRM  -- Syncthing --> /home/ubuntu/data/oneda-crm/images --> índice automático
   somente envio                         somente recebimento               telas e miniaturas
```

O Google Drive permanece como contingência temporária, mas não faz parte do caminho
necessário para uma imagem nova ou substituída aparecer no CRM.

## Operação diária

1. Abra **Gestão & Dados → Imagens Ausentes**.
2. Entre na aba **Imagens Totais do App** e use **Copiar lista** para obter os nomes
   esperados pelo aplicativo.
3. Salve cada arquivo em `C:\ONEDA\Fotos-CRM` usando o código completo do produto.
4. Mantenha o Syncthing aberto. Ele inicia automaticamente com o Windows e trabalha em
   segundo plano.
5. Aguarde a transferência. Com a aba do CRM visível, o índice é consultado a cada 15
   segundos.
6. Confirme a miniatura na tela correspondente e confira se o produto saiu de
   **Imagens Ausentes**.

Não é necessário clicar em **Sincronizar Fotos**, enviar imagens ao GitHub, executar
deploy ou estabelecer comunicação manual do PC com a VPS.

## Nome dos arquivos

- Use o código completo: `01.16.42.0579.jpg`.
- Preserve letras e números finais: `21.19.00.0007.jpg` e
  `21.19.00.0007A.jpg` representam produtos diferentes.
- Extensões aceitas: `.jpg`, `.jpeg`, `.png`, `.webp`, `.gif` e `.svg`.
- Ao substituir uma imagem, o arquivo novo pode ter extensão diferente. O CRM dá
  prioridade à versão presente na pasta sincronizada.
- Não use nomes genéricos, espaços adicionais ou descrições no lugar do código.

## Onde as imagens aparecem

O mesmo índice atende Setor 01, Setor 13, Andamento do CQ, Prog Feira, Alertas,
Imagens Ausentes e os demais módulos com miniaturas. A correspondência sempre usa o
código completo, evitando que produtos com sufixos compartilhem a mesma foto.

## Prioridade das fontes

1. pasta Syncthing recebida na VPS;
2. imagens locais legadas publicadas com o aplicativo;
3. imagem indexada no Google Drive;
4. placeholder de imagem ausente.

Quando existe um ID antigo do Drive para o mesmo produto, ele é preservado apenas como
fallback caso o arquivo local não possa ser lido.

## Diagnóstico rápido

Se uma foto não aparecer:

1. confirme que o nome do arquivo é exatamente o código completo;
2. confirme que o arquivo está em `C:\ONEDA\Fotos-CRM`;
3. confirme que o ícone/processo do Syncthing está ativo no PC;
4. aguarde 15 segundos com a aba do CRM visível e atualize a página uma vez;
5. confira **Imagens Ausentes** e o módulo de origem do produto;
6. se continuar ausente, peça a verificação das contagens do PC, VPS e índice do CRM.

Ter o CRM aberto em vários computadores não interfere na sincronização. A transferência
é feita entre o Syncthing do PC de origem e a VPS; os navegadores apenas consultam o
índice pronto.

## Snapshot operacional validado manualmente em 08/10/2026

- 477 arquivos na pasta do PC;
- 477 arquivos recebidos na VPS;
- 477 arquivos reconhecidos e servidos pela origem Syncthing;
- zero arquivo perdido no lote;
- substituição entre extensões validada;
- 81 testes automatizados aprovados no computador e na VPS;
- aplicação disponível por HTTPS e processo PM2 online.

Esse bloco registra o resultado da validação de implantação realizada nessa data, não um
painel dinâmico. As contagens atuais devem ser conferidas novamente no PC, na pasta
`/home/ubuntu/data/oneda-crm/images` e no índice `/api/drive-images` da VPS.

## Recuperação e contingência

Não apague o acervo antigo do Drive nesta fase. Ele continua sendo uma camada de
contingência enquanto o fluxo Syncthing é observado em produção. A pasta da VPS é
configurada como somente recebimento para evitar que uma alteração acidental no
servidor apague arquivos do PC.
