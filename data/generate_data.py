import csv
import copy

with open('c:/Users/estilo08/Documents/ANTIGRAVITY/APPs/oneda-crm/data/current_data.csv', encoding='utf-8', errors='replace') as f:
    reader = csv.DictReader(f)
    headers = reader.fieldnames
    rows = list(reader)

print(f"Linhas originais: {len(rows)}")

# Let's take some representative rows to create realistic complement rows for missing sectors
sample_hering = copy.deepcopy(rows[0])
sample_cea = copy.deepcopy(rows[10]) if len(rows) > 10 else copy.deepcopy(rows[0])
sample_renner = copy.deepcopy(rows[30]) if len(rows) > 30 else copy.deepcopy(rows[0])

# Codes that exist in production sectors (05, 06, 12, 13)
prod_codes = list(set(r.get('Código') for r in rows if r.get('Setor') in ['05', '06', '12', '13']))[:5]
print("Códigos de produtos em produção:", prod_codes)

complement_rows = []

# 1. CQs em processo (Setores 17, 17x)
# Need: Setor in ['17', '17x'], Dias Parado (BV), RIS / OC (BG)
cq_specs = [
    ('17', '12', '4507380727', '077801', prod_codes[0] if prod_codes else '13.15.00.0437E', 'POLO KIDS MALHA', '150', '2641', '10 - SEM 41 - 2026', 'CIA. HERING'),
    ('17', '18', '', '077802', prod_codes[1] if len(prod_codes) > 1 else '01.16.06.0133', 'TOP MC BASICO PLAYSTATION', '220', '2644', '10 - SEM 44 - 2026', 'C&A MODAS'),
    ('17', '5', '9896811', '077803', '02.16.42.0099', 'BLUSA OVERSIZED DISNEY', '95', '2646', '11 - SEM 46 - 2026', 'RENNER'),
    ('17x', '24', '450739910', '077804', '13.15.00.0881', 'REGATA ESTAMPADA NARUTO', '310', '2642', '10 - SEM 42 - 2026', 'CIA. HERING'),
    ('17x', '8', '', '077805', '01.18.42.0391', 'BERMUDA MOLETOM', '180', '2648', '11 - SEM 48 - 2026', 'C&A MODAS'),
]

for setor, dias, oc, op, cod, desc, qtde, ped_per, ped_desc, cli in cq_specs:
    r = copy.deepcopy(sample_hering)
    r['Setor'] = setor
    r['Desc Setor'] = 'CQ - CONTROLE DE QUALIDADE'
    r['Dias Parado'] = dias
    r['RIS'] = oc
    r['Ped Cliente'] = oc
    r['Número'] = op
    r['Código'] = cod
    r['Produto Descrição'] = desc
    r['Qtde Original'] = qtde
    r['Qtde'] = qtde
    r['Ped Período'] = ped_per
    r['Ped Desc Período'] = ped_desc
    r['Cliente Ped'] = cli
    r['Descrição do Local'] = 'Aguardando Laudo CQ'
    r['Produto Status'] = 'AGUARDANDO LAUDO CQ'
    complement_rows.append(r)

# 2. Pendências Cores e Aviamentos (CM1, D01)
# User wants: Repetição nos setores 05/06/12/13/26/20/31, semana de entrega BK, qtde AP
cor_aviam_specs = [
    # CM1: Cores pendentes
    ('CM1', 'COR - AGUARDANDO PANTONE', prod_codes[0] if prod_codes else '13.15.00.0437E', '077810', 'POLO HERING AZUL MARINHO', '450', '2641', '10 - SEM 41 - 2026', 'CIA. HERING', '14'),
    ('CM1', 'COR - REPROVADO PILING/TORCAO', prod_codes[1] if len(prod_codes) > 1 else '01.16.06.0133', '077811', 'TOP MC OFF WHITE', '620', '2649', '12 - SEM 49 - 2026', 'C&A MODAS', '9'),
    ('CM1', 'COR - LOTE EM ANALISE', '05.14.00.0101', '077812', 'VESTIDO FLORAL KIDS', '200', '2645', '11 - SEM 45 - 2026', 'RENNER', '3'),
    # D01: Aviamentos pendentes
    ('D01', 'AVIAMENTO - BOTAO PERSONALIZADO', prod_codes[0] if prod_codes else '13.15.00.0437E', '077813', 'POLO HERING GOLA LR', '450', '2641', '10 - SEM 41 - 2026', 'CIA. HERING', '11'),
    ('D01', 'AVIAMENTO - ETIQUETA PALITO', prod_codes[2] if len(prod_codes) > 2 else '02.16.42.0048', '077814', 'TOP CURTO CMC', '380', '2646', '11 - SEM 46 - 2026', 'C&A MODAS', '16'),
    ('D01', 'AVIAMENTO - ZÍPER DESTACÁVEL', '08.19.00.0220', '077815', 'JAQUETA BOMBER', '130', '2647', '11 - SEM 47 - 2026', 'RENNER', '5'),
]

for setor, desc_local, cod, op, desc, qtde, ped_per, ped_desc, cli, dias in cor_aviam_specs:
    r = copy.deepcopy(sample_cea)
    r['Setor'] = setor
    r['Desc Setor'] = 'CORES / AVIAMENTOS'
    r['Descrição do Local'] = desc_local
    r['Código'] = cod
    r['Número'] = op
    r['Produto Descrição'] = desc
    r['Qtde Original'] = qtde
    r['Qtde'] = qtde
    r['Ped Período'] = ped_per
    r['Ped Desc Período'] = ped_desc
    r['Cliente Ped'] = cli
    r['Dias Parado'] = dias
    r['Produto Status'] = 'PENDENTE APROVACAO FORNECEDOR'
    complement_rows.append(r)

# 3. Rotativos (Setor 43)
# User wants: Setor 43, repetição nos setores 05/06/12/13/26/20/31, semana entrega BK, qtde AP
rotativo_specs = [
    ('43', 'ROTATIVO - GRAVACAO QUADRO', prod_codes[0] if prod_codes else '13.15.00.0437E', '077820', 'POLO ESTAMPA ROTATIVA ALL-OVER', '520', '2641', '10 - SEM 41 - 2026', 'CIA. HERING', '7'),
    ('43', 'ROTATIVO - TESTE ENCOLHIMENTO', prod_codes[1] if len(prod_codes) > 1 else '01.16.06.0133', '077821', 'TOP MC PLAYSTATION ROTATIVO', '410', '2649', '12 - SEM 49 - 2026', 'C&A MODAS', '12'),
    ('43', 'ROTATIVO - AGUARDANDO LIBERACAO ARTE', '04.12.00.0550', '077822', 'LEGGING ROTATIVA KIDS', '300', '2643', '10 - SEM 43 - 2026', 'RENNER', '4'),
]

for setor, desc_local, cod, op, desc, qtde, ped_per, ped_desc, cli, dias in rotativo_specs:
    r = copy.deepcopy(sample_hering)
    r['Setor'] = setor
    r['Desc Setor'] = 'ROTATIVO'
    r['Descrição do Local'] = desc_local
    r['Código'] = cod
    r['Número'] = op
    r['Produto Descrição'] = desc
    r['Qtde Original'] = qtde
    r['Qtde'] = qtde
    r['Ped Período'] = ped_per
    r['Ped Desc Período'] = ped_desc
    r['Cliente Ped'] = cli
    r['Dias Parado'] = dias
    r['Produto Status'] = 'DESENVOLVIMENTO ROTATIVO'
    complement_rows.append(r)

# 4. Feira / Amostras (01A, 01B, 1B2, 02A, 02E, 02M, 02B, 01C, 01E, 1E2, 02C)
# User wants: quantos dias cada produto pendente (BV), separar por programação de amostras (coluna CO / Descrição2)
feira_specs = [
    ('01A', 'PILOTO CORTE', '13.15.00.0901', '077830', 'VESTIDO FEIRA VERÃO', '2', '2640', '10 - SEM 40 - 2026', 'B12', '14'),
    ('01B', 'PILOTO COSTURA', '13.15.00.0902', '077831', 'CONJUNTO MOLETOM FEIRA', '3', '2641', '10 - SEM 41 - 2026', 'B12', '19'),
    ('1B2', 'PILOTO BORDADO/APLIQUE', '13.15.00.0903', '077832', 'POLO MASCULINA FEIRA', '1', '2640', '10 - SEM 40 - 2026', 'B13', '7'),
    ('02A', 'PILOTO ACABAMENTO', '13.15.00.0904', '077833', 'JAQUETA JEANS FEIRA', '2', '2642', '10 - SEM 42 - 2026', 'B25', '22'),
    ('02E', 'PILOTO REVISAO FINAL', '13.15.00.0905', '077834', 'MACACÃO ESTAMPADO', '2', '2641', '10 - SEM 41 - 2026', 'B25', '5'),
    ('02M', 'PILOTO MATRIZ CORTE', '13.15.00.0906', '077835', 'BLUSA MANGA BUFANTE', '1', '2643', '10 - SEM 43 - 2026', 'B33', '11'),
    ('02B', 'PILOTO COSTURA ESPECIAL', '13.15.00.0907', '077836', 'VESTIDO FESTA KIDS', '2', '2642', '10 - SEM 42 - 2026', 'B33', '16'),
    ('01C', 'PILOTO ESTONAGEM', '13.15.00.0908', '077837', 'BERMUDA CARGO FEIRA', '2', '2644', '10 - SEM 44 - 2026', 'B12', '9'),
    ('01E', 'PILOTO BOTONAGEM', '13.15.00.0909', '077838', 'CAMISA SOCIAL MC FEIRA', '1', '2645', '11 - SEM 45 - 2026', 'B13', '4'),
    ('1E2', 'PILOTO RECORTE LASER', '13.15.00.0910', '077839', 'CROPPED TECH FEIRA', '2', '2643', '10 - SEM 43 - 2026', 'B25', '28'),
    ('02C', 'PILOTO PASSADORIA', '13.15.00.0911', '077840', 'SALOPETE INFANTIL FEIRA', '1', '2641', '10 - SEM 41 - 2026', 'B33', '3'),
]

for setor, desc_local, cod, op, desc, qtde, ped_per, ped_desc, prog, dias in feira_specs:
    r = copy.deepcopy(sample_cea)
    r['Setor'] = setor
    r['Desc Setor'] = 'FEIRA / AMOSTRAS'
    r['Descrição do Local'] = desc_local
    r['Código'] = cod
    r['Número'] = op
    r['Produto Descrição'] = desc
    r['Qtde Original'] = qtde
    r['Qtde'] = qtde
    r['Ped Período'] = ped_per
    r['Ped Desc Período'] = ped_desc
    r['Cliente Ped'] = 'CONFECÇÕES ONEDA (FEIRA)'
    r['Descrição2'] = prog # Coluna CO: Programação de Amostras
    r['Dias Parado'] = dias
    r['Produto Status'] = 'EM PROTOTIPAGEM'
    complement_rows.append(r)

# 5. Pendências Setor 01 (Setor 01 / Clientes C&A, Hering, Renner)
# User wants: Setor 01, soma de produtos pendentes separado por cliente (C&A, Hering, Renner), imagens + dias pendentes
s01_specs = [
    ('01', 'CORTE PILOTO INICIAL', prod_codes[0] if prod_codes else '13.15.00.0437E', '077850', 'CAMISETA MC ESTAMPA HERING', '650', '2640', '10 - SEM 40 - 2026', 'CIA. HERING', '1'),
    ('01', 'LIBERAÇÃO MODELAGEM BASE', prod_codes[1] if len(prod_codes) > 1 else '01.16.06.0133', '077851', 'REGATA INFANTIL RIBANA C&A', '480', '2641', '10 - SEM 41 - 2026', 'C&A MODAS', '3'),
    ('01', 'AGUARDANDO MEDIDAS FIT', '04.12.00.0550', '077852', 'VESTIDO EVASÊ RENNER', '320', '2642', '10 - SEM 42 - 2026', 'LOJAS RENNER', '5'),
    ('01', 'ENCAIXE RISCO PILOTO', '13.16.00.0674', '077853', 'TOP CROPPED HERING KIDS', '550', '2643', '10 - SEM 43 - 2026', 'CIA. HERING', '4'),
    ('01', 'AJUSTE COMPRIMENTO MANGA', '01.18.00.7832', '077854', 'POLO PIQUET PREMIUM C&A', '720', '2644', '10 - SEM 44 - 2026', 'C&A MODAS', '2'),
    ('01', 'PILOTO ENCOLHIMENTO MALHA', '01.12.00.7852', '077855', 'SHORTS MOLETOM RENNER', '410', '2645', '11 - SEM 45 - 2026', 'LOJAS RENNER', '6'),
]

for setor, desc_local, cod, op, desc, qtde, ped_per, ped_desc, cli, dias in s01_specs:
    r = copy.deepcopy(sample_hering if 'HERING' in cli else sample_cea)
    r['Setor'] = setor
    r['Desc Setor'] = 'CORTE / MODELAGEM SETOR 01'
    r['Descrição do Local'] = desc_local
    r['Código'] = cod
    r['Número'] = op
    r['Produto Descrição'] = desc
    r['Qtde Original'] = qtde
    r['Qtde'] = qtde
    r['Ped Período'] = ped_per
    r['Ped Desc Período'] = ped_desc
    r['Cliente Ped'] = cli
    r['Desc Grupo Cli'] = cli
    r['Dias Parado'] = dias
    r['Produto Status'] = 'PENDENTE SETOR 01'
    complement_rows.append(r)

# Write full_dataset.csv
all_rows = rows + complement_rows
print(f"Total de linhas consolidadas com complementos de teste: {len(all_rows)}")

with open('c:/Users/estilo08/Documents/ANTIGRAVITY/APPs/oneda-crm/data/full_dataset.csv', 'w', newline='', encoding='utf-8') as f:
    writer = csv.DictWriter(f, fieldnames=headers)
    writer.writeheader()
    writer.writerows(all_rows)

print("Arquivo data/full_dataset.csv gerado com sucesso!")
