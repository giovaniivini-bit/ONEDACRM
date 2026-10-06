/**
 * Oneda CRM - Lógica da Aplicação, Métricas e Renderização Reativa
 * Confecções Oneda & Equipe
 */

(function () {
    'use strict';

    // =========================================================================
    // ESTADO GLOBAL DA APLICAÇÃO
    // =========================================================================
    const state = {
        allData: [],            // Todos os registros carregados da planilha
        filteredData: [],       // Dados após aplicação dos filtros globais
        activeModule: 'macro',  // 'macro', 'modelagem', 'estilo-pedido', 'estilo-amostras', 'config'
        activeSubmodule: 'geral',// 'geral', 'setor13', 'processo', 'cq', 'estampa', 'cores-aviamentos', 'rotativos', 'feira', etc.
        viewMode: 'lista',      // 'lista', 'kanban', 'metricas'
        quickFilter: 'all',     // 'all', 'atrasado', 'gargalo', 'no_prazo'
        filters: {
            search: '',
            cliente: 'ALL',
            prazo: 'ALL'
        },
        productionCodes: new Set(), // Códigos de produtos presentes nos setores de produção (05, 06, 12, 13, 26, 20, 31)
        sourceType: 'full', // 'full' (com complementos de teste) ou 'raw' (somente planilha pura)
        lastSync: null,
        selectedOp: null,
        estampaFilter: null,
        estampaSearch: '',
        estampaViewMode: 'grid',
        setor13Filter: null,
        setor13Search: '',
        setor13ViewMode: 'grid', // 'grid' (4 fotos por linha) ou 'table'
        setor01Filter: null,
        setor01Search: '',
        setor01ViewMode: 'grid', // 'grid' (4 fotos por linha) ou 'table'
        coresFilter: null,
        coresSearch: '',
        coresExternalData: null,
        aviamentosFilter: null,
        aviamentosSearch: '',
        aviamentosExternalData: null,
        coresAviamentosFilter: null,
        coresAviamentosSearch: '',
        coresAviamentosViewMode: 'grid', // 'grid' (4 fotos por linha) ou 'table'
        coresAviamentosPageLimit: 32,
        rotativosFilter: null,
        rotativosSearch: '',
        rotativosViewMode: 'grid',
        rotativosExternalData: null,
        calendarExternalData: null,
        progFeiraExternalData: null,
        progFeiraSearch: '',
        progFeiraSector: 'all',
        progFeiraTing: 'all',
        progFeiraDesOnly: false,
        rotativosActiveTab: 'drive',
        rotativosDriveFilter: null,
        rotativosDriveSearch: '', // 'grid' (4 fotos por linha) ou 'table',
        cqFilter: null,
        cqSearch: '',
        cqExternalData: null,
        cqViewAllMode: false,
        aproveitamentoSearch: '',
        aproveitamentoClient: 'all',
        aproveitamentoPeriod: 'all',
        aproveitamentoDateStart: '',
        aproveitamentoDateEnd: '',
        // Cards por padrão: evita montar simultaneamente a grade de fotos e a
        // tabela completa (mais de 2 mil nós no CQ), que tornava o scroll pesado.
        cqDisplayMode: 'cards',
        malotesFilter: null,
        malotesSearch: '',
        malotesViewMode: 'critical', // 'both', 'cards', 'table'
        leadtimeFilter: null,
        leadtimeSearch: '',
        leadtimeExternalData: null,
        missingImagesSearch: '',
        missingImagesTab: 'missing',
        alertRules: [],
        alertRulesSource: 'loading',
        alertRulesError: '',
        activeAlerts: [],
        alertsTab: 'active',
        alertsSearch: '',
        alertsSeverity: 'all',
        alertsCategory: 'all',
        alertsPageLimit: 30,
        alertsLoading: true,
        imagesLoaded: false,
        driveImages: {}
    };

    // Setores de Produção para checagem de repetição / gargalos duplos
    const PROD_SECTORS = ['05', '06', '12', '13', '26', '20', '31', '106'];
    const PHOTO_SUBMODULES = new Set([
        'setor13',
        'processo',
        'setor01',
        'estampa',
        'andamento-cq',
        'rotativos',
        'malotes',
        'cores-aviamentos',
        'cores-pendentes',
        'prog-feira',
        'imagens-ausentes'
    ]);

    // =========================================================================
    // INICIALIZAÇÃO
    // =========================================================================

    function renderAproveitamentoView(container) {
        const ext = state.aproveitamentoExternalData || { count: 0, records: [] };
        const rawRecords = ext.records || [];

        const CLIENTES_APROVEITAMENTO = {
            '01': 'C&A',
            '02': 'Renner',
            '03': 'Riachuelo',
            '05': 'Centauro',
            '13': 'Hering',
            '15': 'Carrefour',
            '21': 'Santa Marca'
        };

        function parseAproveitamentoDate(value) {
            const raw = String(value || '').trim();
            if (!raw) return null;
            const brMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
            const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
            const date = brMatch
                ? new Date(Number(brMatch[3]), Number(brMatch[2]) - 1, Number(brMatch[1]))
                : isoMatch
                    ? new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]))
                    : new Date(raw);
            if (Number.isNaN(date.getTime())) return null;
            date.setHours(0, 0, 0, 0);
            return date;
        }

        function getAproveitamentoProductCode(record) {
            return String(record.PRODUTO || record.CODIGO || record.IMG_PRODUTO || '').trim();
        }

        function getAproveitamentoClient(record) {
            const code = getAproveitamentoProductCode(record);
            if (/^ON\./i.test(code)) return { prefix: 'ON', name: 'Showroom Oneda' };
            const prefixMatch = code.match(/^(\d{2})\s*\./) || code.match(/^(\d{2})/);
            const prefix = prefixMatch ? prefixMatch[1] : '';
            return { prefix, name: CLIENTES_APROVEITAMENTO[prefix] || 'Outros' };
        }

        const validDates = rawRecords.map(r => parseAproveitamentoDate(r.DATA_CAD)).filter(Boolean);
        const dataMaxDate = validDates.length
            ? new Date(Math.max(...validDates.map(date => date.getTime())))
            : null;
        const activePeriod = state.aproveitamentoPeriod || 'all';
        const activeCli = state.aproveitamentoClient || 'all';
        let periodStart = null;
        let periodEnd = dataMaxDate ? new Date(dataMaxDate) : null;

        if (dataMaxDate && ['15d', '30d', '45d'].includes(activePeriod)) {
            const days = Number(activePeriod.replace('d', ''));
            periodStart = new Date(dataMaxDate);
            periodStart.setDate(periodStart.getDate() - (days - 1));
        } else if (dataMaxDate && activePeriod === '6m') {
            periodStart = new Date(dataMaxDate);
            periodStart.setMonth(periodStart.getMonth() - 6);
        } else if (activePeriod === 'custom') {
            periodStart = parseAproveitamentoDate(state.aproveitamentoDateStart);
            periodEnd = parseAproveitamentoDate(state.aproveitamentoDateEnd);
        } else {
            periodEnd = null;
        }

        const filteredRecords = rawRecords.filter(record => {
            const recordClient = getAproveitamentoClient(record).name;
            if (activeCli !== 'all' && recordClient !== activeCli) return false;
            const recordDate = parseAproveitamentoDate(record.DATA_CAD);
            if (periodStart && (!recordDate || recordDate < periodStart)) return false;
            if (periodEnd && (!recordDate || recordDate > periodEnd)) return false;
            return true;
        });
        
        let totalCount = 0;
        let compCount = 0;
        let sumCustoGeral = 0;
        let sumCustoComp = 0;
        let sumCustoNao = 0;
        let qtdeGeralCusto = 0;
        let qtdeCompCusto = 0;
        let qtdeNaoCusto = 0;
        
        const cliMap = {};
        const macroMap = {};
        
        function parseCost(c) {
            if (!c) return 0;
            let str = String(c).replace(/[R$\s]/g, '');
            if (str.includes(',')) str = str.replace(/\./g, '').replace(',', '.');
            return parseFloat(str) || 0;
        }
        
        // Filtering
        const searchQ = (state.aproveitamentoSearch || '').toLowerCase().trim();
        
        filteredRecords.forEach(r => {
            const clientInfo = getAproveitamentoClient(r);
            const cliente = clientInfo.name;
            const prefixo = clientInfo.prefix;
            const pedido = (r.PEDIDO || r['PEDIDO'] || '').trim().toUpperCase();
            let grupoRaw = r.DESC_GRUPO || r['DESC_GRUPO'] || '';
            let macro = grupoRaw.split('(')[0].trim();
            if (!macro) macro = (r.MACRO_CATEGORIA || r['MACRO_CATEGORIA'] || 'OUTROS').trim();
            const custoRaw = r.PRECO_VENDA || r['PRECO_VENDA'] || '0';
            const custo = parseCost(custoRaw);
            
            const isComprado = (pedido === 'S');
            
            // Global metrics
            totalCount++;
            if (isComprado) compCount++;
            if (custo > 0) {
                sumCustoGeral += custo;
                qtdeGeralCusto++;
                if (isComprado) {
                    sumCustoComp += custo;
                    qtdeCompCusto++;
                } else {
                    sumCustoNao += custo;
                    qtdeNaoCusto++;
                }
            }
            
            if (!cliMap[cliente]) {
                cliMap[cliente] = { name: cliente, prefix: prefixo, total: 0, comp: 0, nao: 0, sumTotal: 0, sumComp: 0, sumNao: 0, qTotal: 0, qComp: 0, qNao: 0 };
            }
            cliMap[cliente].total++;
            if (isComprado) cliMap[cliente].comp++; else cliMap[cliente].nao++;
            if (custo > 0) {
                cliMap[cliente].sumTotal += custo;
                cliMap[cliente].qTotal++;
                if (isComprado) { cliMap[cliente].sumComp += custo; cliMap[cliente].qComp++; }
                else { cliMap[cliente].sumNao += custo; cliMap[cliente].qNao++; }
            }
            
            if (!macroMap[macro]) macroMap[macro] = { total: 0, comp: 0 };
            macroMap[macro].total++;
            if (isComprado) macroMap[macro].comp++;
        });
        
        const avgGeral = qtdeGeralCusto > 0 ? sumCustoGeral / qtdeGeralCusto : 0;
        const avgComp = qtdeCompCusto > 0 ? sumCustoComp / qtdeCompCusto : 0;
        const avgNao = qtdeNaoCusto > 0 ? sumCustoNao / qtdeNaoCusto : 0;
        
        const aprovGeral = totalCount > 0 ? (compCount / totalCount) * 100 : 0;
        const diffCustos = avgNao > 0 ? ((avgNao - avgComp) / avgNao) * 100 : 0;
        
        const monthNames = ["JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO", "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"];
        let minDate = new Date(8640000000000000);
        let maxDate = new Date(-8640000000000000);
        filteredRecords.forEach(r => {
            const date = parseAproveitamentoDate(r.DATA_CAD);
            if (date) {
                if (date < minDate) minDate = date;
                if (date > maxDate) maxDate = date;
            }
        });
        let periodText = "";
        if (minDate <= maxDate) {
            let startMonth = monthNames[minDate.getMonth()];
            let startYear = String(minDate.getFullYear()).slice(-2);
            let endMonth = monthNames[maxDate.getMonth()];
            let endYear = String(maxDate.getFullYear()).slice(-2);
            if (startMonth === endMonth && startYear === endYear) {
                periodText = `${startMonth} ${startYear}`;
            } else {
                periodText = `${startMonth} ${startYear} - ${endMonth} ${endYear}`;
            }
        }
        
        // Sorting clients
        const sortedClients = Object.values(cliMap).sort((a,b) => b.total - a.total);
        let accum = 0;
        sortedClients.forEach(c => {
            accum += c.total;
            c.paretoPct = (accum / totalCount) * 100;
        });
        
        // Grid Data
        const filteredGrid = filteredRecords.filter(r => {
            if (searchQ) {
                const s = searchQ;
                const match = getAproveitamentoProductCode(r).toLowerCase().includes(s) || String(r.DESCRICAO || '').toLowerCase().includes(s);
                if (!match) return false;
            }
            return true;
        });
        
        const formatBRL = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        
        // SVG dimensions
        const svgW = 1000;
        const svgH = 400;
        const pad = { top: 40, right: 60, bottom: 75, left: 60 };
        const drawW = svgW - pad.left - pad.right;
        const drawH = svgH - pad.top - pad.bottom;
        
        const maxVol = sortedClients.length > 0 ? sortedClients[0].total : 1;
        const yMax = Math.ceil(maxVol * 1.15);
        const colW = sortedClients.length > 0 ? Math.min(80, (drawW / sortedClients.length) - 10) : 40;
        const stepX = sortedClients.length > 0 ? drawW / sortedClients.length : drawW;
        
        let paretoPathD = '';
        const points = [];
        
        const colsHtml = sortedClients.map((c, i) => {
            const cx = pad.left + (i * stepX) + (stepX / 2);
            const hComp = (c.comp / yMax) * drawH;
            const hNao = (c.nao / yMax) * drawH;
            
            const py = pad.top + drawH - (c.paretoPct / 100) * drawH;
            points.push({x: cx, y: py});
            if (i === 0) paretoPathD += `M ${cx} ${py}`;
            else paretoPathD += ` L ${cx} ${py}`;
            
            return `
                <g style="cursor:pointer;" onclick="window.crmSetAproveitamentoClient('${c.name}')">
                    <rect x="${cx - colW/2}" y="${pad.top + drawH - hComp}" width="${colW}" height="${hComp}" fill="#10b981" />
                    <rect x="${cx - colW/2}" y="${pad.top + drawH - hComp - hNao}" width="${colW}" height="${hNao}" fill="#f43f5e" />
                    
                    <text x="${cx}" y="${pad.top + drawH - hComp - hNao - 8}" fill="#ffffff" font-size="12" font-weight="bold" text-anchor="middle" font-family="system-ui">${c.total}</text>
                    <text x="${cx}" y="${pad.top + drawH + 20}" fill="#cbd5e1" font-size="11" font-weight="bold" text-anchor="middle" font-family="system-ui">${c.name}</text>
                    <text x="${cx}" y="${pad.top + drawH + 35}" fill="#64748b" font-size="10" font-weight="normal" text-anchor="middle" font-family="system-ui">${c.prefix ? 'Pref: '+c.prefix : ''}</text>
                    <text x="${cx}" y="${pad.top + drawH + 52}" fill="#0ea5e9" font-size="11" font-weight="bold" text-anchor="middle" font-family="system-ui">${((c.total / totalCount) * 100).toFixed(1)}%</text>
                </g>
            `;
        }).join('');
        
        const lineHtml = points.length > 0 ? `
            <path d="${paretoPathD}" fill="none" stroke="#fbbf24" stroke-width="3" />
            ${points.map(p => `<circle cx="${p.x}" cy="${p.y}" r="4" fill="#1e293b" stroke="#fbbf24" stroke-width="2" />`).join('')}
        ` : '';

        function drawPie(dataArr, radius) {
            let svg = '';
            let acc = 0;
            const total = dataArr.reduce((s, d) => s + d.val, 0);
            if (total === 0) return '';
            
            const colors = ['#3b82f6', '#8b5cf6', '#ec4899', '#f43f5e', '#f59e0b', '#10b981', '#06b6d4', '#64748b'];
            
            dataArr.forEach((d, i) => {
                const pct = d.val / total;
                const a1 = acc * 2 * Math.PI;
                const a2 = (acc + pct) * 2 * Math.PI;
                acc += pct;
                
                const x1 = Math.cos(a1) * radius;
                const y1 = Math.sin(a1) * radius;
                const x2 = Math.cos(a2) * radius;
                const y2 = Math.sin(a2) * radius;
                
                const largeArc = pct > 0.5 ? 1 : 0;
                
                if (pct > 0.999) {
                    svg += `<circle cx="0" cy="0" r="${radius}" fill="${colors[i % colors.length]}" />`;
                } else {
                    svg += `<path d="M 0 0 L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z" fill="${colors[i % colors.length]}" stroke="#0f172a" stroke-width="1.5" />`;
                }
            });
            return svg;
        }

        const originalModelCount = Object.keys(macroMap).length;
        let finalMacros = [];
        let outros = { name: 'OUTROS', total: 0, comp: 0 };
        Object.keys(macroMap).forEach(k => {
            if (macroMap[k].total < 10 && k !== 'OUTROS') {
                outros.total += macroMap[k].total;
                outros.comp += macroMap[k].comp;
            } else if (k === 'OUTROS') {
                outros.total += macroMap[k].total;
                outros.comp += macroMap[k].comp;
            } else {
                finalMacros.push({ name: k, total: macroMap[k].total, comp: macroMap[k].comp });
            }
        });
        if (outros.total > 0) finalMacros.push(outros);
        finalMacros.sort((a,b) => b.total - a.total);
        
        const pieMacroData = finalMacros.map(m => ({ label: m.name, val: m.total }));
        const macroColors = ['#3b82f6', '#8b5cf6', '#ec4899', '#f43f5e', '#f59e0b', '#10b981', '#06b6d4', '#64748b', '#84cc16', '#14b8a6', '#d946ef', '#f97316', '#6366f1', '#eab308', '#22c55e', '#0ea5e9', '#be123c', '#4338ca', '#b45309', '#0f766e', '#4d7c0f', '#0369a1', '#7e22ce'];

        const html = `
            <div id="print-area-aproveitamento" style="background:#0f172a; padding: 24px;">
                <div class="header-main-title" style="margin-bottom: 24px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 12px; display:flex; justify-content: space-between; align-items:center;">
                    <div>
                        <h2 style="font-size: 24px; font-weight: 800; color: #f8fafc; margin: 0; text-transform: uppercase;">APROVEITAMENTO AMOSTRAS ${periodText ? periodText : ''}</h2>
                        <div style="font-size: 14px; color: #94a3b8; margin-top: 4px;">Setor 01F • Análise de Conversão e Ticket por Cliente</div>
                    </div>
                    <div style="display:flex; gap:12px;">
                        ${activeCli !== 'all' ? `
                        <button onclick="window.crmSetAproveitamentoClient('all')" class="badge badge-purple" style="border:none; cursor:pointer;">
                            <i class="fa-solid fa-times"></i> Limpar Filtro: ${activeCli}
                        </button>
                        ` : ''}
                        <button onclick="window.print()" class="btn btn-primary" style="font-size:13px; font-weight:bold;">
                            <i class="fa-solid fa-file-pdf"></i> Exportar PDF
                        </button>
                    </div>
                </div>

                <div class="cq-macro-card" style="padding:16px; margin-bottom:24px; display:flex; flex-wrap:wrap; gap:16px; align-items:flex-end;">
                    <div style="display:flex; flex-direction:column; gap:6px;">
                        <label style="font-size:11px; color:#94a3b8; font-weight:800; text-transform:uppercase;">Prazo</label>
                        <div style="display:flex; flex-wrap:wrap; gap:8px;">
                            ${[
                                ['all', 'Todo o período'],
                                ['15d', '15 dias'],
                                ['30d', '30 dias'],
                                ['45d', '45 dias'],
                                ['6m', '6 meses'],
                                ['custom', 'Personalizado']
                            ].map(([value, label]) => `
                                <button onclick="window.crmSetAproveitamentoPeriod('${value}')" class="exec-action-btn ${activePeriod === value ? 'active' : ''}" style="padding:7px 11px;">${label}</button>
                            `).join('')}
                        </div>
                    </div>
                    ${activePeriod === 'custom' ? `
                        <div style="display:flex; gap:8px; align-items:flex-end;">
                            <label style="display:flex; flex-direction:column; gap:6px; font-size:11px; color:#94a3b8; font-weight:800; text-transform:uppercase;">
                                De
                                <input type="date" value="${state.aproveitamentoDateStart || ''}" onchange="window.crmSetAproveitamentoCustomDate('start', this.value)" style="padding:7px 10px; border-radius:6px; border:1px solid rgba(255,255,255,.12); background:#0b1220; color:#e2e8f0;">
                            </label>
                            <label style="display:flex; flex-direction:column; gap:6px; font-size:11px; color:#94a3b8; font-weight:800; text-transform:uppercase;">
                                Até
                                <input type="date" value="${state.aproveitamentoDateEnd || ''}" onchange="window.crmSetAproveitamentoCustomDate('end', this.value)" style="padding:7px 10px; border-radius:6px; border:1px solid rgba(255,255,255,.12); background:#0b1220; color:#e2e8f0;">
                            </label>
                        </div>
                    ` : ''}
                    <label style="display:flex; flex-direction:column; gap:6px; min-width:220px; margin-left:auto;">
                        <span style="font-size:11px; color:#94a3b8; font-weight:800; text-transform:uppercase;">Cliente</span>
                        <select onchange="window.crmSetAproveitamentoClient(this.value)" style="padding:8px 10px; border-radius:6px; border:1px solid rgba(255,255,255,.12); background:#0b1220; color:#e2e8f0;">
                            <option value="all" ${activeCli === 'all' ? 'selected' : ''}>Todos os clientes</option>
                            ${Object.values(CLIENTES_APROVEITAMENTO).map(name => `<option value="${name}" ${activeCli === name ? 'selected' : ''}>${name}</option>`).join('')}
                            <option value="Showroom Oneda" ${activeCli === 'Showroom Oneda' ? 'selected' : ''}>Showroom Oneda</option>
                            <option value="Outros" ${activeCli === 'Outros' ? 'selected' : ''}>Outros</option>
                        </select>
                    </label>
                    <div style="font-size:12px; color:#64748b; width:100%;">
                        ${dataMaxDate ? `Períodos rápidos calculados até ${dataMaxDate.toLocaleDateString('pt-BR')}, a data mais recente da planilha.` : 'Nenhuma data válida encontrada na coluna DATA_CAD.'}
                    </div>
                </div>

                <!-- KPIs -->
                <div class="kpi-grid" style="grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); margin-bottom: 24px; gap: 16px; display: grid;">
                    <div class="kpi-card" style="border-color: rgba(56, 189, 248, 0.45); background: linear-gradient(135deg, rgba(14, 165, 233, 0.12) 0%, rgba(13, 16, 26, 0.9) 100%);">
                        <div class="kpi-header">
                            <span class="kpi-label" style="color: #38bdf8; font-weight: 800; letter-spacing: 0.5px;">TOTAL DE AMOSTRAS</span>
                            <div class="kpi-icon" style="color: #38bdf8;"><i class="fa-solid fa-box-open"></i></div>
                        </div>
                        <div class="kpi-value" style="font-size: 44px; font-weight: 900; color: #ffffff; line-height: 1.1;">
                            ${totalCount} <span style="font-size: 16px; font-weight: 700; color: #38bdf8;">peças</span>
                        </div>
                        <div class="kpi-footer">
                            <span style="font-weight: 600; color: var(--text-secondary);">Peças totais desenvolvidas</span>
                        </div>
                    </div>
                    
                    <div class="kpi-card" style="border-color: rgba(16, 185, 129, 0.45); background: linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(13, 16, 26, 0.9) 100%);">
                        <div class="kpi-header">
                            <span class="kpi-label" style="color: #10b981; font-weight: 800; letter-spacing: 0.5px;">AMOSTRAS COMPRADAS</span>
                            <div class="kpi-icon" style="color: #10b981;"><i class="fa-solid fa-check-double"></i></div>
                        </div>
                        <div class="kpi-value" style="font-size: 44px; font-weight: 900; color: #ffffff; line-height: 1.1;">
                            ${compCount} <span style="font-size: 16px; font-weight: 700; color: #10b981;">peças</span>
                        </div>
                        <div class="kpi-footer">
                            <span style="font-weight: 700; color: #34d399; background: rgba(16,185,129,0.1); padding: 2px 6px; border-radius: 4px;">${aprovGeral.toFixed(1)}% Taxa de Conversão</span>
                        </div>
                    </div>

                    <div class="kpi-card" style="border-color: rgba(148, 163, 184, 0.45); background: linear-gradient(135deg, rgba(148, 163, 184, 0.12) 0%, rgba(13, 16, 26, 0.9) 100%);">
                        <div class="kpi-header">
                            <span class="kpi-label" style="color: #94a3b8; font-weight: 800; letter-spacing: 0.5px;">PREÇO MÉDIO DE VENDA</span>
                            <div class="kpi-icon" style="color: #94a3b8;"><i class="fa-solid fa-money-bill-wave"></i></div>
                        </div>
                        <div class="kpi-value" style="font-size: 36px; font-weight: 900; color: #ffffff; line-height: 1.1; margin-top: 8px;">
                            ${formatBRL(avgGeral)}
                        </div>
                        <div class="kpi-footer">
                            <span style="font-weight: 600; color: var(--text-secondary);">Ticket médio em PRECO_VENDA</span>
                        </div>
                    </div>

                    <div class="kpi-card" style="border-color: rgba(244, 63, 94, 0.45); background: linear-gradient(135deg, rgba(244, 63, 94, 0.12) 0%, rgba(13, 16, 26, 0.9) 100%);">
                        <div class="kpi-header">
                            <span class="kpi-label" style="color: #f43f5e; font-weight: 800; letter-spacing: 0.5px;">DIFERENÇA DE TICKET</span>
                            <div class="kpi-icon" style="color: #f43f5e;"><i class="fa-solid fa-scale-unbalanced"></i></div>
                        </div>
                        <div class="kpi-value" style="font-size: 16px; font-weight: 700; color: #ffffff; line-height: 1.4; margin-top: 4px;">
                            Comprados: <span style="color: #10b981; font-size:18px;">${formatBRL(avgComp)}</span><br>
                            Não Comp.: <span style="color: #f43f5e; font-size:18px;">${formatBRL(avgNao)}</span>
                        </div>
                        <div class="kpi-footer">
                            <span style="font-weight: 700; color: #fbbf24; background: rgba(251,191,36,0.1); padding: 2px 6px; border-radius: 4px;">${diffCustos > 0 ? `Ticket dos comprados é ${diffCustos.toFixed(1)}% menor` : `Ticket dos comprados é ${Math.abs(diffCustos).toFixed(1)}% maior`}</span>
                        </div>
                    </div>
                </div>

                <!-- Pareto --><div class="page-break-before"></div>
                <div class="cq-macro-card" style="margin-bottom: 24px; padding: 20px;">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;">
                        <h3 style="color: #f8fafc; font-size: 16px; font-weight: 700; margin: 0;"><i class="fa-solid fa-chart-column" style="color:#fbbf24; margin-right:8px;"></i> Visualização geral por cliente</h3>
                        <div style="display:flex; gap: 12px; font-size: 12px; font-weight: 600;">
                            <span style="color: #10b981;"><i class="fa-solid fa-square"></i> Comprado (Base)</span>
                            <span style="color: #f43f5e;"><i class="fa-solid fa-square"></i> Não Comprado (Topo)</span>
                            <span style="color: #fbbf24;"><i class="fa-solid fa-minus"></i> % Acumulado</span>
                        </div>
                    </div>
                    <svg viewBox="0 0 ${svgW} ${svgH}" style="width: 100%; height: auto; background: rgba(15, 23, 42, 0.4); border-radius: 8px;">
                        ${[0, 0.25, 0.5, 0.75, 1].map(r => {
                            const y = pad.top + drawH - (drawH * r);
                            return `
                                <line x1="${pad.left - 5}" y1="${y}" x2="${svgW - pad.right}" y2="${y}" stroke="rgba(255,255,255,0.05)" stroke-width="1" />
                                <text x="${pad.left - 10}" y="${y}" fill="#64748b" font-size="11" text-anchor="end" dominant-baseline="central">${Math.round(yMax * r)}</text>
                                <text x="${svgW - pad.right + 10}" y="${y}" fill="#fbbf24" font-size="11" text-anchor="start" dominant-baseline="central">${Math.round(r * 100)}%</text>
                            `;
                        }).join('')}
                        ${colsHtml}
                        ${lineHtml}
                    </svg>
                </div>

                <!-- Exec Table & Macros -->
                <div style="display: grid; grid-template-columns: 1fr; gap: 24px; margin-bottom: 24px;">
                    <div class="cq-macro-card" style="padding: 20px; max-height: 400px; overflow-y: auto;">
                        <h3 style="color: #f8fafc; font-size: 16px; font-weight: 700; margin-top:0; margin-bottom: 16px;">
                            <i class="fa-solid fa-table" style="color:#3b82f6; margin-right:8px;"></i> Resumo Executivo
                        </h3>
                        <table class="data-table" style="width: 100%; font-size: 12px;">
                            <thead>
                                <tr>
                                    <th style="padding: 10px 8px;">Rede</th>
                                    <th style="text-align:right; padding: 10px 8px;">Volume Total</th>
                                    <th style="text-align:right; padding: 10px 8px;">Conversão</th>
                                    <th style="text-align:right; padding: 10px 8px;">Ticket (Geral)</th>
                                    <th style="text-align:right; color:#10b981; padding: 10px 8px;">Ticket Comprados (S)</th>
                                    <th style="text-align:right; color:#f43f5e; padding: 10px 8px;">Ticket Não Comp. (N)</th>
                                    <th style="text-align:right; color:#fbbf24; padding: 10px 8px;">Variação (N vs S)</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${sortedClients.map(c => {
                                    const avgG = c.qTotal > 0 ? c.sumTotal/c.qTotal : 0;
                                    const avgS = c.qComp > 0 ? c.sumComp/c.qComp : 0;
                                    const avgN = c.qNao > 0 ? c.sumNao/c.qNao : 0;
                                    return `
                                    <tr style="cursor:pointer; border-bottom: 1px solid rgba(255,255,255,0.05);" onclick="window.crmSetAproveitamentoClient('${c.name}')">
                                        <td style="padding: 12px 8px;"><strong>${c.name}</strong> <span style="font-size:10px; color:#64748b; margin-left:6px;">(${c.prefix})</span></td>
                                        <td style="text-align:right; padding: 12px 8px;">${c.total}</td>
                                        <td style="text-align:right; padding: 12px 8px; color:${c.comp/c.total > 0.3 ? '#10b981' : '#f43f5e'}; font-weight:bold;">${((c.comp/c.total)*100).toFixed(1)}%</td>
                                        <td style="text-align:right; padding: 12px 8px; font-weight:700; color:#cbd5e1;">${formatBRL(avgG)}</td>
                                        <td style="text-align:right; padding: 12px 8px; color:#34d399; font-weight:600;">${formatBRL(avgS)}</td>
                                        <td style="text-align:right; padding: 12px 8px; color:#fb7185; font-weight:600;">${formatBRL(avgN)}</td>
                                        <td style="text-align:right; padding: 12px 8px;">
                                            ${(() => {
                                                if (avgS > 0 && avgN > 0) {
                                                    const diff = ((avgN - avgS) / avgS) * 100;
                                                    if (diff > 0) return '<span style="color:#fb7185; font-weight:bold;">+' + diff.toFixed(1) + '%</span> <span style="font-size:10px; color:#64748b;">(mais caro)</span>';
                                                    if (diff < 0) return '<span style="color:#34d399; font-weight:bold;">' + diff.toFixed(1) + '%</span> <span style="font-size:10px; color:#64748b;">(mais barato)</span>';
                                                    return '<span style="color:#94a3b8; font-weight:bold;">0%</span>';
                                                }
                                                return '<span style="color:#64748b;">-</span>';
                                            })()}
                                        </td>
                                    </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>

                    <div class="cq-macro-card" style="padding: 20px; display:flex; flex-direction:column;">
                        <h3 style="color: #f8fafc; font-size: 16px; font-weight: 700; margin-top:0; margin-bottom: 24px;">
                            <i class="fa-solid fa-chart-pie" style="color:#ec4899; margin-right:8px;"></i> Divisão por Tipos de Produto (Modelos Detalhados)
                        </h3>
                        <div style="display:flex; gap:40px; align-items:center; flex:1;">
                            <div style="flex: 1; display:flex; justify-content:center;">
                                <svg viewBox="-200 -200 400 400" style="width: 100%; max-width: 500px; height: auto; filter: drop-shadow(0 4px 12px rgba(0,0,0,0.5));">
                                    ${drawPie(pieMacroData, 180)}
                                    <circle cx="0" cy="0" r="100" fill="#0f172a" />
                                    <text x="0" y="5" fill="#ffffff" font-size="36" font-weight="900" text-anchor="middle" font-family="system-ui">${originalModelCount}</text>
                                    <text x="0" y="30" fill="#94a3b8" font-size="14" font-weight="600" text-anchor="middle" font-family="system-ui">Modelos Totais</text>
                                </svg>
                            </div>
                            <div style="flex: 1; display:grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap:12px; max-height: 450px; overflow-y:auto; padding-right:16px;">
                                ${finalMacros.map((m, i) => `
                                    <div style="display:flex; justify-content:space-between; align-items:center; font-size: 12px; background: rgba(255,255,255,0.03); padding: 8px 12px; border-radius: 6px; border-left: 3px solid ${macroColors[i % macroColors.length]};">
                                        <div style="display:flex; flex-direction:column; gap:2px; overflow:hidden;">
                                            <strong style="color:#e2e8f0; white-space:nowrap; text-overflow:ellipsis; overflow:hidden;" title="${escapeHtml(m.name)}">${escapeHtml(m.name)}</strong>
                                            <span style="color:#0ea5e9; font-weight:700; font-size:10px;">Representa: ${((m.total / totalCount) * 100).toFixed(1)}%</span>
                                        </div>
                                        <div style="color:#94a3b8; font-weight:600; text-align:right;">
                                            ${m.total} un <br>
                                            <span style="color:#10b981; font-weight:900; font-size:10px;" title="Conversão">Conv: ${((m.comp/m.total)*100).toFixed(0)}%</span>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Grid --><div class="page-break-before"></div>
                <div class="cq-macro-card" style="padding: 20px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                        <h3 style="color: #f8fafc; font-size: 16px; font-weight: 700; margin: 0;">
                            <i class="fa-solid fa-list" style="color:#06b6d4; margin-right:8px;"></i> Base de Amostras (${filteredGrid.length})
                        </h3>
                        <input type="text" id="cqSearchInput" placeholder="Buscar código ou descrição..." class="cq-search-input" style="padding: 6px 12px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.1); background: rgba(0,0,0,0.3); color: white; width: 250px;">
                    </div>
                    
                    <div style="max-height: 500px; overflow-y: auto;">
                        <table class="data-table" style="width: 100%; font-size: 12px; border-collapse: collapse;">
                            <thead style="position: sticky; top: 0; background: #0f172a; z-index: 10;">
                                <tr>
                                    <th style="padding:10px;">CÓDIGO</th>
                                    <th style="padding:10px;">CLIENTE</th>
                                    <th style="padding:10px;">DESCRIÇÃO</th>
                                    <th style="padding:10px;">CATEGORIA</th>
                                    <th style="padding:10px; text-align:center;">STATUS</th>
                                    <th style="padding:10px; text-align:right;">PREÇO VENDA</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${filteredGrid.slice(0, 100).map(r => {
                                    const isC = (r.PEDIDO || '').toUpperCase() === 'S';
                                    return `
                                        <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                                            <td style="padding:10px; font-family:monospace; color:#38bdf8;">${escapeHtml(getAproveitamentoProductCode(r))}</td>
                                            <td style="padding:10px; font-weight:600; color:#e2e8f0;">${getAproveitamentoClient(r).name}</td>
                                            <td style="padding:10px; color:#cbd5e1;">${escapeHtml(r.DESCRICAO || '-')}</td>
                                            <td style="padding:10px; color:#94a3b8;">${escapeHtml(String(r.DESC_GRUPO || '').split('(')[0].trim() || r.MACRO_CATEGORIA || '-')}</td>
                                            <td style="padding:10px; text-align:center;">
                                                <span style="padding:4px 8px; border-radius:4px; font-weight:bold; font-size:10px; background:${isC ? 'rgba(16,185,129,0.2)' : 'rgba(244,63,94,0.2)'}; color:${isC ? '#34d399' : '#fb7185'};">
                                                    ${isC ? 'COMPRADO' : 'NÃO COMP.'}
                                                </span>
                                            </td>
                                            <td style="padding:10px; text-align:right; color:#e2e8f0;">${escapeHtml(r.PRECO_VENDA || '-')}</td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                        ${filteredGrid.length > 100 ? `<div style="padding: 12px; text-align: center; color: #64748b; font-style: italic;">Mostrando 100 de ${filteredGrid.length} resultados.</div>` : ''}
                    </div>
                </div>
            </div>
        `;
        
        container.innerHTML = html;
        
        const searchEl = document.getElementById('cqSearchInput');
        if (searchEl) {
            searchEl.value = state.aproveitamentoSearch || '';
            searchEl.addEventListener('keyup', (e) => {
                if (e.key === 'Enter') {
                    window.crmSearchAproveitamento(e.target.value);
                }
            });
        }
    }


    document.addEventListener('DOMContentLoaded', () => {
        setupEventListeners();
        loadCRMData();
        loadDriveImages();
        loadExternalSheets();
        loadAlertRules();
    });

    // =========================================================================
    // CARREGAMENTO DE DADOS (VIA API LOCAL OU DADOS INCORPORADOS STANDALONE)
    // =========================================================================
    async function loadCRMData(source = state.sourceType) {
        // 1. Inicialização instantânea com dados incorporados (funciona offline ou via file://)
        if (window.CRM_EMBEDDED_DATA && window.CRM_EMBEDDED_DATA.length > 0 && state.allData.length === 0) {
            state.allData = processRawRecords(window.CRM_EMBEDDED_DATA);
            state.lastSync = new Date();
            updateProductionCodes();
            updateSidebarBadges();
            applyFiltersAndRender();
            updateSystemStatus(`Modo Local Ativo (${state.allData.length} OPs)`, true);
        }

        // 2. Tentar atualizar via API se estiver em servidor HTTP
        if (window.location.protocol.startsWith('http')) {
            updateSystemStatus('Sincronizando registros...', false);
            try {
                const res = await fetch(`/api/data?source=${source}`);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                
                const json = await res.json();
                if (json.success && json.data) {
                    state.allData = processRawRecords(json.data);
                    state.lastSync = new Date(json.lastModified || Date.now());
                    updateProductionCodes();
                    updateSidebarBadges();
                    applyFiltersAndRender();
                    updateSystemStatus(`Conectado (${state.allData.length} OPs)`, true);
                }
            } catch (err) {
                console.warn('API local offline ou inacessível, utilizando dados locais pré-carregados:', err.message);
                if (state.allData.length > 0) {
                    updateSystemStatus(`Modo Local Ativo (${state.allData.length} OPs)`, true);
                } else {
                    updateSystemStatus('Erro de conexão', false);
                }
            }
        }
    }

    // Carregamento assíncrono do índice de imagens da pasta do Google Drive
    async function loadDriveImages() {
        if (!window.location.protocol.startsWith('http')) return;
        try {
            const res = await fetch('/api/drive-images');
            if (!res.ok) return;
            const json = await res.json();
            if (json.success && json.data && json.data.map) {
                state.driveImages = json.data.map;
                state.imagesLoaded = true;
                updateSidebarBadges();
                if (PHOTO_SUBMODULES.has(state.activeSubmodule)) {
                    renderActiveView();
                }
            }
        } catch (e) {
            console.warn('[DRIVE IMG] Erro ao carregar imagens do Drive:', e.message);
        }
    }

    let adminLoginPromise = null;

    function requestAdminLogin() {
        if (adminLoginPromise) return adminLoginPromise;
        const modal = document.getElementById('adminLoginModal');
        const form = document.getElementById('adminLoginForm');
        const passwordInput = document.getElementById('adminPasswordInput');
        const errorText = document.getElementById('adminLoginError');
        const cancelButton = document.getElementById('cancelAdminLoginBtn');

        adminLoginPromise = new Promise((resolve, reject) => {
            const finish = (error = null) => {
                modal.style.display = 'none';
                passwordInput.value = '';
                form.onsubmit = null;
                cancelButton.onclick = null;
                adminLoginPromise = null;
                if (error) reject(error);
                else resolve();
            };

            errorText.textContent = '';
            modal.style.display = 'flex';
            window.setTimeout(() => passwordInput.focus(), 0);

            cancelButton.onclick = () => finish(new Error('Ação administrativa cancelada.'));
            form.onsubmit = async event => {
                event.preventDefault();
                const password = passwordInput.value;
                if (!password) return;
                const submitButton = form.querySelector('button[type="submit"]');
                submitButton.disabled = true;
                errorText.textContent = '';
                try {
                    const response = await fetch('/api/admin/login', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ password })
                    });
                    const payload = await response.json().catch(() => ({}));
                    if (!response.ok) throw new Error(payload.error || 'Não foi possível entrar.');
                    finish();
                } catch (error) {
                    errorText.textContent = error.message;
                    passwordInput.select();
                } finally {
                    submitButton.disabled = false;
                }
            };
        });
        return adminLoginPromise;
    }

    async function adminFetch(url, options = {}) {
        const makeRequest = () => fetch(url, options);
        let response = await makeRequest();
        if (response.status !== 401) return response;

        await requestAdminLogin();
        response = await makeRequest();
        if (response.status === 401) {
            throw new Error('A sessão administrativa não pôde ser validada. Entre novamente.');
        }
        return response;
    }

    async function loadAlertRules() {
        if (!window.CRMAlertsEngine) {
            console.error('[ALERTAS] Motor de regras não foi carregado.');
            return;
        }
        try {
            const response = await fetch('/api/alert-rules');
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const payload = await response.json();
            if (!Array.isArray(payload.data)) throw new Error('A API não retornou uma lista de regras.');
            const validation = window.CRMAlertsEngine.validateRules(payload.data);
            if (!validation.valid) throw new Error(validation.error || 'A API retornou regras inválidas.');
            state.alertRules = payload.data;
            state.alertRulesSource = 'api';
            state.alertRulesError = '';
        } catch (error) {
            console.warn('[ALERTAS] Usando regras padrão locais:', error.message);
            state.alertRules = window.CRMAlertsEngine.cloneDefaults();
            state.alertRulesSource = 'fallback';
            state.alertRulesError = error.message;
        } finally {
            state.alertsLoading = false;
            recalculateAlerts();
            updateAlertsBadges();
            if (state.activeSubmodule === 'alertas') renderActiveView();
        }
    }

    // Carregamento assíncrono das planilhas externas do Drive (Cores, Aviamentos e CQ)
    async function loadExternalSheets(force = false) {
        if (!window.location.protocol.startsWith('http')) return;
        try {
            const requestExternal = type => {
                const url = `/api/external-sheet?type=${type}${force ? '&refresh=1' : ''}`;
                const request = force ? adminFetch(url, { method: 'POST' }) : fetch(url);
                return request.then(async response => {
                    const payload = await response.json().catch(() => null);
                    return response.ok ? payload : payload;
                }).catch(() => null);
            };
            const [coresRes, avRes, cqRes, ltRes, rotRes, apRes, calendarRes, progFeiraRes] = await Promise.all([
                requestExternal('cores'),
                requestExternal('aviamentos'),
                requestExternal('cq'),
                requestExternal('leadtime'),
                requestExternal('rotativos'),
                requestExternal('aproveitamento'),
                requestExternal('calendar'),
                requestExternal('prog_feira')
            ]);
            if (coresRes && coresRes.success) {
                state.coresExternalData = coresRes;
            }
            if (avRes && avRes.success) {
                state.aviamentosExternalData = avRes;
            }
            if (cqRes && cqRes.success) {
                state.cqExternalData = cqRes;
            }
            if (ltRes && ltRes.success) {
                state.leadtimeExternalData = ltRes;
            }
            if (rotRes && rotRes.success) {
                state.rotativosExternalData = rotRes;
            }
            if (apRes && apRes.success) {
                state.aproveitamentoExternalData = apRes;
            }
            if (calendarRes && calendarRes.success) {
                state.calendarExternalData = calendarRes;
            }
            if (progFeiraRes && progFeiraRes.success) {
                state.progFeiraExternalData = progFeiraRes;
            }
            updateSidebarBadges();
            if (['cores-pendentes', 'aviamentos-pendentes', 'cores-aviamentos', 'andamento-cq', 'aproveitamento', 'leadtime', 'rotativos', 'prog-feira', 'imagens-ausentes', 'alertas', 'geral'].includes(state.activeSubmodule)) {
                renderActiveView();
            }
        } catch (e) {
            console.warn('[EXTERNAL SHEETS] Erro ao carregar planilhas externas:', e.message);
        }
    }

    // Busca inteligente de imagem do produto no índice do Google Drive com múltiplas estratégias
    function getProductImage(itemOrCode, maybeOp) {
        let codigo = '';
        let op = '';
        if (typeof itemOrCode === 'object' && itemOrCode !== null) {
            codigo = String(itemOrCode.codigo || itemOrCode.referencia || '').trim();
            op = String(itemOrCode.op || '').trim();
        } else {
            codigo = String(itemOrCode || '').trim();
            op = String(maybeOp || '').trim();
        }

        if (!codigo && !op) return { hasImage: false };
        const map = state.driveImages || {};

        const formatEntry = (found) => {
            const filename = found.filename || `${found.base}.jpg`;
            const versionSuffix = found.version ? `&v=${encodeURIComponent(found.version)}` : '';
            const localUrl = `/api/image-file?file=${encodeURIComponent(filename)}${versionSuffix}`;
            const bundledThumbUrl = typeof found.thumbUrl === 'string' && found.thumbUrl.startsWith('/images/')
                ? found.thumbUrl
                : null;
            const bundledLargeUrl = typeof found.largeUrl === 'string' && found.largeUrl.startsWith('/images/')
                ? found.largeUrl
                : null;
            const driveThumbUrl = found.id
                ? `/api/proxy-image?id=${encodeURIComponent(found.id)}&sz=w600${versionSuffix}`
                : null;
            const driveLargeUrl = found.id
                ? `/api/proxy-image?id=${encodeURIComponent(found.id)}&sz=w1200${versionSuffix}`
                : null;
            const placeholderUrl = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22420%22 height=%22315%22 viewBox=%220 0 420 315%22%3E%3Crect width=%22420%22 height=%22315%22 fill=%22%23111827%22/%3E%3Ctext x=%22210%22 y=%22158%22 fill=%22%2394a3b8%22 font-family=%22Arial%22 font-size=%2216%22 text-anchor=%22middle%22%3EImagem indispon%C3%ADvel%3C/text%3E%3C/svg%3E';
            const isLocal = found.isLocal !== false;
            const localLargeUrl = bundledLargeUrl || bundledThumbUrl || localUrl;
            return {
                hasImage: true,
                filename: filename,
                // Arquivos somente na nuvem precisam passar pelo proxy do Drive;
                // o endpoint local nunca conseguiria servi-los pelo nome.
                thumbUrl: isLocal ? (bundledThumbUrl || localUrl) : (driveThumbUrl || placeholderUrl),
                proxyUrl: isLocal ? (driveThumbUrl || placeholderUrl) : placeholderUrl,
                largeUrl: isLocal ? localLargeUrl : (driveLargeUrl || driveThumbUrl || placeholderUrl),
                largeFallbackUrl: isLocal ? driveLargeUrl : null,
                driveUrl: found.driveUrl || `https://drive.google.com/drive/folders/1YA-gpBhY3zDeooquzzY5Vl4HK-DirjzA`
            };
        };

        const found = window.CRMImageCoverage?.resolveImageEntry(map, codigo, op);
        return found ? formatEntry(found) : { hasImage: false };
    }

    // Helper de Normalização de Chaves para Resolução Dinâmica de Colunas
    function normalizeKey(str) {
        return (str || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-zA-Z0-9]/g, '')
            .toLowerCase();
    }

    // Gerador de Resolvedor de Campos Inteligente e Dinâmico
    // Permite que colunas flutuem livremente na planilha (ex: Local Produto em AY, AO, etc.)
    function createFieldResolver(sampleRow) {
        if (!sampleRow) return (row, candidates, defaultValue = '') => defaultValue;
        const keyMap = new Map();
        for (const rawKey of Object.keys(sampleRow)) {
            const norm = normalizeKey(rawKey);
            if (norm) {
                keyMap.set(norm, rawKey);
            }
        }

        return function getField(row, candidates, defaultValue = '') {
            if (!row) return defaultValue;
            for (const cand of candidates) {
                // 1. Acesso direto caso a chave original exista
                if (row[cand] !== undefined && row[cand] !== null && String(row[cand]).trim() !== '') {
                    return String(row[cand]).trim();
                }
                // 2. Busca por chave normalizada (insensível a acentos, espaços e maiúsculas/minúsculas)
                const norm = normalizeKey(cand);
                const actualKey = keyMap.get(norm);
                if (actualKey && row[actualKey] !== undefined && row[actualKey] !== null && String(row[actualKey]).trim() !== '') {
                    return String(row[actualKey]).trim();
                }
            }
            return defaultValue;
        };
    }

    // Processamento, Agrupamento e Consolidação por PRODUTO ÚNICO
    // Regra do Usuário:
    // "Sempre que o produto (coluna E) tiver a mesma OF (coluna A), e a mesma parte (coluna AI/AG),
    // quer dizer que ele é um único produto. Fazer a soma das partes/tamanhos e contar como 1 único produto."
    function processRawRecords(rawRows) {
        if (!rawRows || rawRows.length === 0) return [];
        const groups = new Map();
        const getField = createFieldResolver(rawRows[0] || {});

        rawRows.forEach(r => {
            const op = getField(r, ['Número', 'Numero', 'Nmero', 'OF', 'Ordem', 'OP']);
            const codigo = getField(r, ['Código', 'Codigo', 'Cdigo', 'Referência', 'Referencia', 'Produto', 'Cod Produto']);
            const parte = getField(r, ['Parte', 'Parte Prod', 'Cód Parte', 'Cod Parte']);
            const descParte = getField(r, ['Desc Parte', 'Descrição Parte', 'Descricao Parte', 'Descrio Parte']);
            const tamanho = getField(r, ['Tamanho', 'Grade', 'Tam']);
            const qtdeRaw = getField(r, ['Qtde Original', 'Qtde', 'Quantidade', 'Qtd Original', 'Qtd'], '0');
            const qtdeOriginal = parseInt(qtdeRaw.replace(/[^0-9]/g, ''), 10) || 0;

            // 1. SETOR PENDENTE (Coluna: SETOR)
            let setor = getField(r, ['SETOR', 'Setor', 'Setor Pendente', 'Setor Atual']);
            if (/^\d$/.test(setor)) {
                setor = '0' + setor; // Normaliza '5' -> '05', '6' -> '06'
            }
            if (setor.includes('E+02') || setor === '1,00E+02') {
                setor = '100'; // Normaliza notação científica de planilha para Setor 100 (Bordado)
            }
            const descSetor = getField(r, ['Desc Setor', 'Descrio Setor', 'Descrição Setor', 'Descricao Setor']);

            // Chave de Consolidação por OF / Setor:
            // Regra do Usuário: Quando tiver vários registros na planilha (partes, tamanhos 1, 2, 3, 4, 5, etc.),
            // somar a quantidade e considerar como 1 única OF (quando pendente no mesmo setor).
            const productKey = `${op}__${setor || 'SEM_SETOR'}`;

            if (!groups.has(productKey)) {
                // 2. STATUS DE MODELAGEM (Coluna: Descrição do Local) - Informação mais completa (se estiver em branco sinalizar!)
                const descLocalRaw = getField(r, [
                    'Descrição do Local',
                    'Descricao do Local',
                    'Descrio do Local',
                    'Descrição Local',
                    'Descricao Local',
                    'Desc Local',
                    'Local Produto',
                    'LocalProduto',
                    'Local_Produto',
                    'Local prod',
                    'Local'
                ]);
                const isStatusEmBranco = !descLocalRaw || descLocalRaw.trim() === '' || descLocalRaw === '—' || descLocalRaw === '-';
                const statusModelagem = isStatusEmBranco ? 'EM BRANCO (NÃO INFORMADO)' : descLocalRaw.trim();
                const descLocal = statusModelagem;

                // 3. SEMANA DO PEDIDO (Coluna: Ped Desc Período)
                const pedDescPeriodo = getField(r, ['Ped Desc Período', 'Ped Desc Periodo', 'Ped Desc Perodo', 'Ped Período', 'Ped Periodo', 'Ped Perodo', 'Desc Período OP', 'Desc Periodo OP', 'Desc Perodo OP', 'Período OP', 'Semana']);
                const semanaPedido = pedDescPeriodo || 'Sem Período';

                // 4. ETIQUETA (Coluna: Etiqueta)
                const etiqueta = getField(r, ['Etiqueta', 'Etq', 'Desc Etiqueta', 'Cód Etiqueta', 'Cod Etiqueta'], '—');

                // 5. STATUS ESTILO (Coluna: Status Estilo / Situação Estilo / Produto Status)
                const statusEstilo = getField(r, ['Status Estilo', 'Situação Estilo', 'Situacao Estilo', 'Produto Status', 'Status Prod', 'Status Estampa', 'Sit Estilo', 'Desc Estilo'], '—');
                const statusProd = statusEstilo;

                // 6. TIPOS DE PRODUTO (Coluna: Desc Grupo Prod)
                const descGrupoProd = getField(r, ['Desc Grupo Prod', 'Descrio Grupo Prod', 'Descricao Grupo Prod', 'Desc Grupo Produto', 'Grupo Prod', 'Grupo Produto', 'Tipo Produto', 'Artigo']);
                const tipoProduto = descGrupoProd || 'Outros';

                // 7. PROG AMOSTRA (Coluna: Descrição2)
                const progAmostras = getField(r, ['Descrição2', 'Descricao2', 'Descrio2', 'Descricao 2', 'Descrição 2', 'Prog Amostras', 'Prog Amostra', 'Amostra'], '—');

                // 8. QUANTIDADE DIAS PENDENTE NO SETOR (Coluna: Dias Parado) - Destaque > 2 dias
                const diasParadoRaw = getField(r, ['Dias Parado', 'Dias Parado Setor', 'Dias No Setor', 'Dias Parado no Setor', 'Dias'], '0');
                const diasParado = parseInt(diasParadoRaw.replace(/[^0-9]/g, ''), 10) || 0;

                // Metadados adicionais
                const fluxo = getField(r, ['Fluxo', 'Cód Fluxo', 'Cod Fluxo']);
                const descFluxo = getField(r, ['Desc Fluxo', 'Descrição Fluxo', 'Descricao Fluxo', 'Descrio Fluxo']);
                const descPeriodoOP = getField(r, ['Desc Período OP', 'Desc Periodo OP', 'Desc Perodo OP']);
                const oc = getField(r, ['RIS', 'Ped Cliente', 'Ordem Compra', 'OC', 'Pedido']);
                const pedPeriodo = getField(r, ['Ped Período', 'Ped Periodo', 'Ped Perodo']);
                const descricao = getField(r, ['Produto Descrição', 'Produto Descricao', 'Produto Descrio', 'Desc Produto', 'Descrição', 'Descricao']);
                const rawCli = getField(r, ['Desc Grupo Cli', 'Descricao Grupo Cli', 'Cliente Ped', 'Cliente', 'Grupo Cliente', 'Grupo Cli', 'Fantasia'], '');
                const codMarca = getField(r, ['Marca', 'Cód Marca', 'Cod Marca'], '');
                const descMarca = getField(r, ['Desc Marca', 'Descrição Marca', 'Descricao Marca', 'Descrio Marca'], '');
                const descColecao = getField(r, ['Desc Coleção', 'Descricao Colecao', 'Descrio Colecao', 'Coleção', 'Colecao'], '');
                const descEtiqueta = getField(r, ['Desc Etiqueta', 'Descricao Etiqueta', 'Descrio Etiqueta', 'Etiqueta'], '');

                // Resolução Rigorosa de Clientes:
                // Apenas empresas clientes (C&A MODAS, CIA. HERING, LOJAS RENNER, CENTAURO, SANTA MARCA, etc.)
                // Marcas e licenças (como Barcelona, Licenças Variadas, Warner, Disney, etc.) NUNCA são clientes.
                let cliente = '';
                const cliText = (rawCli || '').toUpperCase();

                if (cliText.includes('HERING') || cliText.includes('SOMA')) cliente = 'CIA. HERING';
                else if (cliText.includes('C&A') || cliText.includes('CEA')) cliente = 'C&A MODAS';
                else if (cliText.includes('RENNER')) cliente = 'LOJAS RENNER';
                else if (cliText.includes('CENTAURO')) cliente = 'CENTAURO';
                else if (cliText.includes('SANTA MARCA')) cliente = 'SANTA MARCA';
                else if (cliText.includes('RIACHUELO')) cliente = 'RIACHUELO';
                else if (cliText.includes('MARISA')) cliente = 'MARISA';
                else if (cliText.includes('ONEDA')) cliente = 'ONEDA / FEIRA';

                // Se o campo do cliente direto na linha estiver vazio, identificar pelo prefixo do código do produto (padrão Oneda):
                if (!cliente) {
                    const codTrim = (codigo || '').trim();
                    if (codTrim.startsWith('13.')) cliente = 'CIA. HERING';
                    else if (codTrim.startsWith('01.')) cliente = 'C&A MODAS';
                    else if (codTrim.startsWith('02.') || codTrim.startsWith('04.')) cliente = 'LOJAS RENNER';
                    else if (codTrim.startsWith('05.')) cliente = 'CENTAURO';
                    else if (codTrim.startsWith('21.')) cliente = 'SANTA MARCA';
                }

                // Identificação adicional por menções nas coleções/marcas associadas
                if (!cliente) {
                    const metaContext = `${descMarca} ${descColecao} ${descEtiqueta}`.toUpperCase();
                    if (metaContext.includes('HERING') || metaContext.includes('SOMA')) cliente = 'CIA. HERING';
                    else if (metaContext.includes('C&A') || metaContext.includes('CEA')) cliente = 'C&A MODAS';
                    else if (metaContext.includes('RENNER') || metaContext.includes('BARCELONA')) cliente = 'LOJAS RENNER';
                    else if (metaContext.includes('CENTAURO')) cliente = 'CENTAURO';
                    else if (metaContext.includes('SANTA MARCA')) cliente = 'SANTA MARCA';
                    else if (metaContext.includes('RIACHUELO')) cliente = 'RIACHUELO';
                    else if (metaContext.includes('MARISA')) cliente = 'MARISA';
                    else cliente = 'OUTROS';
                }

                const marca = descMarca || codMarca || 'Sem Marca';
                const cor = getField(r, ['Desc Cor', 'Descrição Cor', 'Descricao Cor', 'Descrio Cor', 'Cor']);
                const dtFatura = getField(r, ['Dt Fatura Ped', 'Dt Fatura', 'Data Fatura']);
                const dtPrevMov = getField(r, ['Dt Prev Mov', 'Data Prev Mov', 'Dt Prevista']);
                const diasRetorno = getField(r, ['Dias Retorno', 'Dias Ret']);
                const prazoStatus = calculatePrazoStatus(dtFatura, dtPrevMov, diasParado, diasRetorno);

                groups.set(productKey, {
                    raw: r,
                    key: productKey,
                    op,
                    codigo,
                    parte,
                    descParte,
                    partes: parte ? [parte] : [],
                    descricao,
                    cliente,
                    codMarca,
                    descMarca,
                    marca,
                    descGrupoProd,
                    tipoProduto,
                    cor,
                    setor,
                    descSetor,
                    fluxo,
                    descFluxo,
                    statusModelagem,        // Coluna Local Produto (com sinalização de branco)
                    statusModelagemEmBranco: isStatusEmBranco,
                    descLocal,              // Alias para compatibilidade
                    descPeriodoOP,
                    semanaPedido,           // Coluna Ped Desc Período
                    etiqueta,               // Coluna Etiqueta
                    statusEstilo,           // Coluna Status Estilo / Produto Status
                    statusProd,             // Alias para compatibilidade
                    progAmostras,           // Coluna Descrição2
                    diasParado,             // Coluna Dias Parado
                    oc,
                    pedPeriodo,
                    pedDescPeriodo,
                    dtFatura,
                    dtPrevMov,
                    prazoStatus,
                    qtdeOriginal: 0,
                    gradeTamanhos: []
                });
            }

            const prod = groups.get(productKey);
            prod.qtdeOriginal += qtdeOriginal;
            if (codigo && (!prod.codigo || prod.codigo === '—' || prod.codigo === '')) {
                prod.codigo = codigo;
            }
            if (tamanho || qtdeOriginal > 0) {
                prod.gradeTamanhos.push({
                    tamanho: tamanho || 'U',
                    qtde: qtdeOriginal,
                    parte: parte || descParte || ''
                });
            }
            if (parte && !prod.partes.includes(parte)) {
                prod.partes.push(parte);
            }
        });

        return Array.from(groups.values());
    }

    // Identificar códigos de produtos nos setores de produção (05, 06, 12, 13, 26, 20, 31)
    function updateProductionCodes() {
        state.productionCodes.clear();
        state.allData.forEach(item => {
            if (PROD_SECTORS.includes(item.setor) && item.codigo) {
                state.productionCodes.add(item.codigo);
            }
        });
    }

    // Regra de Prazo
    function calculatePrazoStatus(dtFatura, dtPrevMov, diasParado, diasRetornoRaw) {
        const diasRetorno = parseInt(diasRetornoRaw || '0', 10);
        
        // Se dias retorno for muito negativo ou dias parado for muito alto, sinaliza risco/atraso
        if (diasRetorno < -10 || diasParado > 25) {
            return 'ATRASO';
        }

        // Checar data de faturamento se existir
        if (dtFatura) {
            const parts = dtFatura.split('/');
            if (parts.length === 3) {
                // As planilhas operacionais da Oneda utilizam DD/MM/YYYY.
                const dateObj = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
                if (!isNaN(dateObj.getTime())) {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    if (dateObj < today) return 'ATRASO';
                }
            }
        }

        return 'NO_PRAZO';
    }

    // Escape de caracteres HTML para segurança e integridade das strings nos inputs/atributos
    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function getImageCoverageProducts() {
        if (!window.CRMImageCoverage) return [];
        return window.CRMImageCoverage.buildImageCoverageProducts({
            main: state.allData || [],
            cq: state.cqExternalData?.records || [],
            rotativos: state.rotativosExternalData?.records || [],
            progFeira: state.progFeiraExternalData?.records || []
        }, {
            checkImage: (codigo, op) => Boolean(getProductImage(codigo, op).hasImage),
            buildProgProducts: window.CRMProgFeira?.buildProducts
        });
    }

    function recalculateAlerts() {
        if (!window.CRMAlertsEngine || !Array.isArray(state.alertRules)) {
            state.activeAlerts = [];
            return state.activeAlerts;
        }
        const records = (state.allData || []).map(item => ({
            ...item,
            // Enquanto o índice ainda carrega, a regra de imagem permanece
            // silenciosa para evitar um pico falso de alertas no primeiro paint.
            hasImage: state.imagesLoaded ? Boolean(getProductImage(item).hasImage) : true
        }));
        const cqAlertRecords = window.CRMAlertsEngine.buildCQAlertRecords(
            state.cqExternalData?.records || [],
            { now: new Date() }
        );
        const operationalRecords = window.CRMAlertsEngine.buildOperationalAlertRecords(
            [...records, ...cqAlertRecords],
            state.calendarExternalData?.records || [],
            { now: new Date() }
        );
        state.activeAlerts = window.CRMAlertsEngine.evaluateRecords(operationalRecords, state.alertRules);
        return state.activeAlerts;
    }

    function updateAlertsBadges() {
        const total = (state.activeAlerts || []).length;
        const sidebarBadge = document.getElementById('badge-alertas');
        const headerBadge = document.getElementById('headerAlertsCount');
        if (sidebarBadge) sidebarBadge.textContent = total > 999 ? '999+' : String(total);
        if (headerBadge) {
            headerBadge.textContent = total > 99 ? '99+' : String(total);
            headerBadge.style.display = total > 0 ? 'inline-flex' : 'none';
        }
    }

    // =========================================================================
    // CLASSIFICAÇÃO DE STATUS DE MODELAGEM E ALERTAS DE DIAS NO SETOR
    // =========================================================================
    // Regra do Usuário:
    // - Status ruins / pendências da modelagem:
    //   "agu retorno feira / pos feira", "ag envio amost SALA", "agu retorno amost SALA",
    //   "agu E-mail ou Laudo", "ok CLiente/ fazend teste grade/mov" ou EM BRANCO / NÃO PREENCHIDO
    //   -> GRIFAR EM VERMELHO PISCANDO!
    // - Demais status -> MANTER NA COR AZUL!
    function isModelagemPendenciaRuim(status) {
        if (!status || status.trim() === '' || status === '—' || status === '-' || 
            status.toLowerCase() === 'não informado' || status.toLowerCase() === 'em branco' || 
            status.toLowerCase() === '[não preenchido / em branco]') {
            return true; // ESTIVER EM BRANCO / NÃO PREENCHIDO
        }
        const s = status.toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]/g, ' ');

        // 1. "agu retorno feira / pos feira" ou abreviações da planilha ("agu retor feira / pos fei")
        if (s.includes('feir') || s.includes('pos fei')) return true;

        // 2. "ag envio amost SALA" / "agu. envi amost SALA"
        if ((s.includes('envi') || s.includes('envio')) && (s.includes('amost') || s.includes('sala'))) return true;

        // 3. "agu retorno amost SALA"
        if ((s.includes('retor') || s.includes('retorno')) && (s.includes('amost') || s.includes('sala'))) return true;

        // 4. "agu E-mail ou Laudo"
        if (s.includes('mail') || s.includes('laudo')) return true;

        // 5. "ok CLiente/ fazend teste grade/mov"
        if (s.includes('teste grade') || s.includes('fazend teste') || (s.includes('cliente') && s.includes('teste'))) return true;

        return false;
    }

    // Renderizador com badges oficiais (Vermelho Piscando vs Azul vs Em Branco)
        function isModelagemPendenciaLaranja(status) {
        if (!status) return false;
        const s = status.toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]/g, ' ');
        if (s.includes('teste grade') || s.includes('fazend teste') || (s.includes('cliente') && s.includes('teste'))) return true;
        return false;
    }

    function renderStatusModelagemBadge(status) {
        const isEmBranco = !status || status.trim() === '' || status === '—' || status === '-' || 
            status.toUpperCase().includes('EM BRANCO') || 
            status.toUpperCase().includes('NÃO PREENCHIDO') || 
            status.toUpperCase().includes('NÃO INFORMADO');

        if (isEmBranco) {
            return `<span class="status-ruim-piscando" style="background: rgba(225, 29, 72, 0.2); color: #fb7185; border: 1px solid #e11d48;" title="ATENÇÃO: Status de Modelagem Em Branco / Não Informado na Planilha!"><i class="fa-solid fa-triangle-exclamation"></i> ⚠️ EM BRANCO (NÃO INFORMADO)</span>`;
        }

        const isLaranja = isModelagemPendenciaLaranja(status);
        const isRuim = isModelagemPendenciaRuim(status);
        const displayText = escapeHtml(status.trim());

        if (isLaranja) {
            return `<span class="status-ruim-piscando" style="background: rgba(249, 115, 22, 0.2); color: #f97316; border: 1px solid #ea580c;" title="Status em Andamento / Teste Mov"><i class="fa-solid fa-gears"></i> ${displayText}</span>`;
        } else if (isRuim) {
            return `<span class="status-ruim-piscando" title="Pendência Crítica da Equipe de Modelagem"><i class="fa-solid fa-triangle-exclamation"></i> ${displayText}</span>`;
        } else {
            return `<span class="status-bom-azul" title="Status Resolvido / Normal de Modelagem"><i class="fa-solid fa-check"></i> ${displayText}</span>`;
        }
    }

    // Renderizador para Dias no Setor (Coluna BV)
    // Regra do Usuário: "quando ultrapassar 2 dias, insira uma cor vermelha, que fique piscando!"
    function renderDiasSetorBadge(diasParado) {
        const d = parseInt(diasParado || 0, 10);
        if (d > 2) {
            return `<span class="dias-alerta-piscando" title="ALERTA OPERACIONAL: Mais de 2 dias parado no setor (${d} dias)!"><i class="fa-solid fa-fire-flame-curved"></i> ${d} dias</span>`;
        } else {
            return `<span class="badge badge-sub" style="font-weight: 600;">${d} d</span>`;
        }
    }

    // Renderizador exclusivo para o Setor 13: acima de 2 dias use o AZUL porém PISCANDO
    function renderDiasSetor13Badge(diasParado) {
        const d = parseInt(diasParado || 0, 10);
        if (d > 2) {
            return `<span class="dias-azul-piscando" title="ALERTA: Mais de 2 dias pendente no Setor 13 (${d} dias)!"><i class="fa-solid fa-clock"></i> ${d} dias pendente</span>`;
        } else {
            return `<span class="badge badge-sub" style="font-weight: 600;">${d} dias</span>`;
        }
    }

    // =========================================================================
    // CLASSIFICAÇÃO DE STATUS DE ESTAMPA (COLUNA BD)
    // =========================================================================
    // Regra do Usuário:
    // - Grifar em AZUL INTENSO e PISCAR os status:
    //   "pendente desenvolvimento", "aguar aprov. lic / conceito", "aguar aprovação pp sample"
    // - Demais status -> Manter sem piscar (Fluxo Normal / Liberados)
    function isEstampaStatusPendente(status) {
        if (!status) return false;
        const s = status.toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

        // 1. Excluir explicitamente todos os liberados / aprovados
        // Exemplos: LIBERADO PRODUCAO, pp sample aprovada, LIB p producao / falta PP sample, LIB p producao / falta PP conceito
        if (
            s.includes('aprovad') || 
            s.includes('liberado') || 
            s.startsWith('lib ') || 
            s.startsWith('liber') ||
            s.includes('lib p ') || 
            s.includes('lib para') ||
            s.includes('lib producao')
        ) {
            return false;
        }

        // 2. Pendentes:
        // "pendente desenvolvimento", "aguar aprov. lic / conceito", "aguar aprovação pp sample", "ag conceito", "agu. pp sample"
        if (s.includes('desenv') && (s.includes('pend') || s.includes('desenvolvimento'))) return true;
        if (s.includes('conceito') || s.includes('lic')) return true;
        if (s.includes('sample') || s.includes('pp')) return true;
        if (s.includes('aguar') || s.includes('agu') || s.startsWith('ag ') || s.includes('pendente') || s.includes('pendent')) return true;

        return false;
    }

    // Renderizador para Status do Produto na tela de Estampa
    function renderStatusProdutoBadge(status) {
        const isPendente = isEstampaStatusPendente(status);
        const hasValue = status && status.trim() !== '' && status !== '—' && status !== '-';
        const displayText = hasValue ? status.trim() : '[NÃO INFORMADO]';

        if (isPendente) {
            return `<span class="status-estampa-pendente-azul" title="Pendência de Estampa/Conceito (Ação Necessária)"><i class="fa-solid fa-clock"></i> ${displayText}</span>`;
        } else {
            return `<span class="status-estampa-normal" title="Status Liberado / Sem Pendência"><i class="fa-solid fa-circle-check" style="color: #38bdf8;"></i> ${displayText}</span>`;
        }
    }

    // =========================================================================
    // EVENT LISTENERS E CONTROLES
    // =========================================================================
    function setupEventListeners() {
        // Navegação Lateral
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
                link.classList.add('active');

                state.activeModule = link.dataset.module;
                state.activeSubmodule = link.dataset.submodule;
                state.processoFilter = null; // reseta filtro específico de status
                state.feiraSectorFilter = null; // reseta filtro específico de feira
                state.estampaFilter = null; // reseta filtro específico de estampa
                state.setor13Filter = null; // reseta filtro específico do setor 13
                
                updateBreadcrumb(link.querySelector('.nav-text').textContent);
                applyFiltersAndRender();
            });
        });

        // Recolhimento do Menu Lateral
        const sidebar = document.getElementById('sidebar');
        const collapseBtn = document.getElementById('sidebarCollapseBtn');
        const mobileMenuBtn = document.getElementById('mobileMenuBtn');
        const sidebarMobileOverlay = document.getElementById('sidebarMobileOverlay');
        const closeMobileSidebar = () => {
            if (!sidebar || !mobileMenuBtn) return;
            sidebar.classList.remove('mobile-open');
            mobileMenuBtn.setAttribute('aria-expanded', 'false');
            mobileMenuBtn.setAttribute('aria-label', 'Abrir menu lateral');
        };
        if (collapseBtn) {
            collapseBtn.addEventListener('click', () => {
                if (window.innerWidth <= 1024) {
                    closeMobileSidebar();
                    return;
                }
                sidebar.classList.toggle('collapsed');
            });
        }

        // Toggle Mobile
        if (mobileMenuBtn) {
            mobileMenuBtn.addEventListener('click', () => {
                sidebar.classList.remove('collapsed');
                const isOpen = sidebar.classList.toggle('mobile-open');
                mobileMenuBtn.setAttribute('aria-expanded', String(isOpen));
                mobileMenuBtn.setAttribute('aria-label', isOpen ? 'Fechar menu lateral' : 'Abrir menu lateral');
            });
        }
        if (sidebarMobileOverlay) {
            sidebarMobileOverlay.addEventListener('click', closeMobileSidebar);
        }
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') closeMobileSidebar();
        });
        window.addEventListener('resize', () => {
            if (window.innerWidth > 1024) closeMobileSidebar();
        });
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', closeMobileSidebar);
        });

        // Filtro de Busca do Topo
        const searchInput = document.getElementById('headerSearchInput');
        const clearSearchBtn = document.getElementById('clearSearchBtn');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                state.filters.search = e.target.value.toLowerCase().trim();
                clearSearchBtn.style.display = state.filters.search ? 'block' : 'none';
                applyFiltersAndRender();
            });
        }
        if (clearSearchBtn) {
            clearSearchBtn.addEventListener('click', () => {
                searchInput.value = '';
                state.filters.search = '';
                clearSearchBtn.style.display = 'none';
                applyFiltersAndRender();
            });
        }

        // Switcher de Visão (Kanban | Lista | Métricas)
        const btnKanban = document.getElementById('viewModeKanban');
        const btnLista = document.getElementById('viewModeLista');
        const btnMetricas = document.getElementById('viewModeMetricas');

        function setViewMode(mode) {
            state.viewMode = mode;
            [btnKanban, btnLista, btnMetricas].forEach(b => b && b.classList.remove('active'));
            if (mode === 'kanban' && btnKanban) btnKanban.classList.add('active');
            if (mode === 'lista' && btnLista) btnLista.classList.add('active');
            if (mode === 'metricas' && btnMetricas) btnMetricas.classList.add('active');
            renderActiveView();
        }

        if (btnKanban) btnKanban.addEventListener('click', () => setViewMode('kanban'));
        if (btnLista) btnLista.addEventListener('click', () => setViewMode('lista'));
        if (btnMetricas) btnMetricas.addEventListener('click', () => setViewMode('metricas'));

        // Chips de Filtro Rápido (Todos, Atividade atrasada, Gargalo, No Prazo)
        document.querySelectorAll('.filter-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                state.quickFilter = chip.dataset.filter || 'all';
                applyFiltersAndRender();
            });
        });

        // Accordion Chevrons na Sidebar
        document.querySelectorAll('.nav-group-title').forEach(title => {
            title.addEventListener('click', () => {
                title.classList.toggle('collapsed');
                const targetId = title.dataset.target;
                const targetList = document.getElementById(targetId);
                if (targetList) {
                    targetList.style.display = title.classList.contains('collapsed') ? 'none' : 'flex';
                }
            });
        });

        // Sincronizar Google Sheets
        const btnSyncSheets = document.getElementById('btnSyncSheets');
        if (btnSyncSheets) {
            btnSyncSheets.addEventListener('click', syncGoogleSheets);
        }

        // Exportar CSV
        const btnExportCsv = document.getElementById('btnExportCsv');
        if (btnExportCsv) {
            btnExportCsv.addEventListener('click', exportCurrentTableCSV);
        }

        // Modal de Busca Global (Ctrl + K)
        window.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                openSearchModal();
            }
            if (e.key === 'Escape') {
                closeAllModals();
            }
        });

        const openSearchModalBtn = document.getElementById('openSearchModalBtn');
        if (openSearchModalBtn) {
            openSearchModalBtn.addEventListener('click', openSearchModal);
        }

        const closeSearchModalBtn = document.getElementById('closeSearchModalBtn');
        if (closeSearchModalBtn) {
            closeSearchModalBtn.addEventListener('click', closeAllModals);
        }

        const quickSearchModalInput = document.getElementById('quickSearchModalInput');
        if (quickSearchModalInput) {
            quickSearchModalInput.addEventListener('input', handleQuickSearchModal);
        }

        // Modal de Detalhes da OP
        const closeOpModalBtn = document.getElementById('closeOpModalBtn');
        const closeOpModalFooterBtn = document.getElementById('closeOpModalFooterBtn');
        if (closeOpModalBtn) closeOpModalBtn.addEventListener('click', closeAllModals);
        if (closeOpModalFooterBtn) closeOpModalFooterBtn.addEventListener('click', closeAllModals);

        // Copiar Resumo da OP
        const btnCopyOpDetails = document.getElementById('btnCopyOpDetails');
        if (btnCopyOpDetails) {
            btnCopyOpDetails.addEventListener('click', copyOpSummary);
        }

        // Fechar banner de alerta
        const closeAlertBannerBtn = document.getElementById('closeAlertBannerBtn');
        if (closeAlertBannerBtn) {
            closeAlertBannerBtn.addEventListener('click', () => {
                document.getElementById('globalAlertBanner').style.display = 'none';
            });
        }
    }

    // =========================================================================
    // FILTRAGEM & ATUALIZAÇÃO REATIVA
    // =========================================================================
    function applyFiltersAndRender() {
        // Filtragem Global
        let data = state.allData;

        // Filtro por Cliente
        if (state.filters.cliente !== 'ALL') {
            data = data.filter(item => item.cliente.toUpperCase().includes(state.filters.cliente.toUpperCase()));
        }

        // Filtro por Prazo
        if (state.filters.prazo !== 'ALL') {
            data = data.filter(item => item.prazoStatus === state.filters.prazo);
        }

        // Filtro por Termo de Busca
        if (state.filters.search) {
            const query = state.filters.search;
            data = data.filter(item => 
                item.op.toLowerCase().includes(query) ||
                item.codigo.toLowerCase().includes(query) ||
                item.descricao.toLowerCase().includes(query) ||
                item.descLocal.toLowerCase().includes(query) ||
                item.cliente.toLowerCase().includes(query) ||
                item.marca.toLowerCase().includes(query) ||
                item.setor.toLowerCase().includes(query)
            );
        }

        // Filtro por Quick Filter Chips (Todos, Atividade atrasada, Gargalos, No Prazo)
        if (state.quickFilter === 'atrasado') {
            data = data.filter(item => item.prazoStatus === 'ATRASO');
        } else if (state.quickFilter === 'no_prazo') {
            data = data.filter(item => item.prazoStatus === 'NO_PRAZO');
        } else if (state.quickFilter === 'gargalo') {
            data = data.filter(item => ['CM1', 'D01', '43'].includes(item.setor) && state.productionCodes.has(item.codigo));
        }

        state.filteredData = data;

        // Atualizar contador na toolbar
        const toolbarActiveCount = document.getElementById('toolbarActiveCount');
        if (toolbarActiveCount) toolbarActiveCount.textContent = data.length;

        renderActiveView();
    }

    // Atualização dos Badges do Menu Lateral
    function updateSidebarBadges() {
        const total = state.allData.length;
        const s13 = state.allData.filter(r => r.setor === '13').length;
        const sProc = state.allData.filter(r => ['05', '06', '12'].includes(r.setor)).length;
        const s01 = state.allData.filter(r => r.setor === '01' || r.setor === '1').length;
        const sEstampa = state.allData.filter(r => ['05', '06', '12', '13', '26', '20', '31', '106'].includes(r.setor)).length;
        const sCores = state.allData.filter(r => r.setor === 'D01').length;
        const sAviamentos = state.allData.filter(r => r.setor === 'X01' || r.setor === 'CM1').length;
        const sGargalos = state.allData.filter(r => ['CM1', 'D01', '43'].includes(r.setor) && state.productionCodes.has(r.codigo)).length;
        const sFeira = state.allData.filter(r => (r.fluxo === 'D36' || (r.descFluxo || '').toUpperCase().includes('D36'))).length;

        const b13 = document.getElementById('badge-setor13');
        if (b13) b13.textContent = s13;

        const bProc = document.getElementById('badge-processo');
        if (bProc) bProc.textContent = sProc;

        const b01 = document.getElementById('badge-setor01');
        if (b01) b01.textContent = s01;

        
        const sMalotes = state.allData.filter(r => r.setor === '88' || r.setor === '83' || r.setor === '088' || r.setor === '083').length;
        const bMalotes = document.getElementById('badge-malotes');
        if (bMalotes) bMalotes.textContent = sMalotes;
    
        const bEst = document.getElementById('badge-estampa');
        if (bEst) bEst.textContent = sEstampa;

        const bCores = document.getElementById('badge-cores');
        if (bCores) bCores.textContent = `${sCores}`;

        const bAviamentos = document.getElementById('badge-aviamentos');
        if (bAviamentos) bAviamentos.textContent = `${sAviamentos}`;

        const bGarg = document.getElementById('badge-gargalos');
        if (bGarg) bGarg.textContent = sGargalos;

        const bFeira = document.getElementById('badge-feira');
        if (bFeira) bFeira.textContent = sFeira;

        const bProgFeira = document.getElementById('badge-prog-feira');
        if (bProgFeira) {
            const records = state.progFeiraExternalData?.records || [];
            const products = window.CRMProgFeira ? window.CRMProgFeira.buildProducts(records) : [];
            bProgFeira.textContent = products.length || '--';
        }

        const bCQ = document.getElementById('badge-cq');
        if (bCQ) {
            const cqCount = (state.cqExternalData && state.cqExternalData.count) || (state.cqExternalData && state.cqExternalData.records && state.cqExternalData.records.length) || 0;
            bCQ.textContent = cqCount > 0 ? `${cqCount}` : 'CQ';
        }

        const bLT = document.getElementById('badge-leadtime');
        if (bLT) {
            const ltCount = (state.leadtimeExternalData && state.leadtimeExternalData.count) || (state.leadtimeExternalData && state.leadtimeExternalData.records && state.leadtimeExternalData.records.length) || 0;
            bLT.textContent = ltCount > 0 ? `${ltCount}` : '22V';
        }

        const bMissingImages = document.getElementById('badge-missing-images');
        if (bMissingImages) {
            bMissingImages.textContent = getImageCoverageProducts().filter(product => !product.hasImage).length;
        }

        recalculateAlerts();
        updateAlertsBadges();
    }

    // Atualização de Título e Setor Ativo
    function updateBreadcrumb(title) {
        const pageMainTitle = document.getElementById('pageMainTitle');
        const activeSectorLabel = document.getElementById('activeSectorLabel');
        
        let label = title;
        if (state.activeSubmodule === 'geral') label = 'Pipeline Geral (Resumo Macro)';
        else if (state.activeSubmodule === 'setor13') label = 'Setor 13 (Modelagem)';
        else if (state.activeSubmodule === 'processo') label = 'Em Processo (05, 06, 12)';
        else if (state.activeSubmodule === 'setor01') label = 'Pend. Setor 01';
        else if (state.activeSubmodule === 'estampa') label = 'Sit. Estampa';
        else if (state.activeSubmodule === 'cores-pendentes') label = 'Cores Pendentes (Setor D01)';
        else if (state.activeSubmodule === 'aviamentos-pendentes') label = 'Aviamentos Pendentes (Setor X01)';
        else if (state.activeSubmodule === 'cores-aviamentos') label = 'Cores Pendentes (Setor D01)';
        else if (state.activeSubmodule === 'rotativos') label = 'Rotativos (Setor 43)';
        else if (state.activeSubmodule === 'malotes') label = 'Malotes (Setores 88 e 83)';
        else if (state.activeSubmodule === 'feira') label = 'Feira & Protótipos';
        else if (state.activeSubmodule === 'prog-feira') label = 'Prog Feira';
        else if (state.activeSubmodule === 'andamento-cq') label = 'Andamento do CQ (Qualidade)';
        else if (state.activeSubmodule === 'aproveitamento') label = 'Aproveitamento de Amostras';
        else if (state.activeSubmodule === 'leadtime') label = 'Leadtime Produtivo (Setor 13)';
        else if (state.activeSubmodule === 'alertas') label = 'Alertas Operacionais';
        else if (state.activeSubmodule === 'imagens-ausentes') label = 'Controle de Imagens Ausentes';

        if (pageMainTitle) pageMainTitle.textContent = label;
        if (activeSectorLabel) activeSectorLabel.textContent = label;
    }

    // =========================================================================
    // RENDERIZADOR DE VIEWS DINÂMICAS
    // =========================================================================
    function renderActiveView() {
        const container = document.getElementById('viewContainer');
        if (!container) return;

        // Seletor de Views
        switch (state.activeSubmodule) {
            // Macro
            case 'geral':
                renderMacroGeralView(container);
                break;
            // Modelagem
            case 'macro':
                if (state.activeModule === 'modelagem') renderMacroModelagemView(container);
                else if (state.activeModule === 'estilo-pedido') renderMacroEstiloPedidoView(container);
                else if (state.activeModule === 'estilo-amostras') renderMacroEstiloAmostrasView(container);
                break;
            case 'setor13':
                renderSetor13View(container);
                break;
            case 'processo':
                renderProcessoView(container);
                break;
            // Estilo Pedido
            case 'setor01':
                renderSetor01View(container);
                break;
            case 'estampa':
                renderEstampaView(container);
                break;
            case 'cores-pendentes':
            case 'cores-aviamentos':
                renderCoresPendentesView(container);
                break;
            case 'aviamentos-pendentes':
                renderAviamentosPendentesView(container);
                break;
            case 'rotativos':
                renderRotativosView(container);
                break;
            case 'malotes':
                renderMalotesView(container);
                break;
            // Qualidade & CQ
            case 'andamento-cq':
                renderAndamentoCQView(container);
                break;
            case 'aproveitamento':
                renderAproveitamentoView(container);
                break;
            case 'leadtime':
                renderLeadtimeView(container);
                break;
            // Estilo Amostras
            case 'feira':
                renderFeiraView(container);
                break;
            case 'prog-feira':
                renderProgFeiraView(container);
                break;
            // Configurações
            case 'sync':
                renderSyncConfigView(container);
                break;
            case 'alertas':
                renderAlertsView(container);
                break;
            case 'imagens-ausentes':
                renderMissingImagesView(container);
                break;
            case 'calendario':
                renderCalendarioConfigView(container);
                break;
            default:
                renderMacroGeralView(container);
        }
    }

    // =========================================================================
    // 0. VISÃO GERAL MACRO (RESUMO DE TODAS AS TELAS / PAINEL EXECUTIVO)
    // =========================================================================
    function renderMacroGeralView(container) {
        const items = state.filteredData;
        const totalItems = items.length;
        const totalPecas = items.reduce((sum, r) => sum + r.qtdeOriginal, 0);
        const emAtraso = items.filter(r => r.prazoStatus === 'ATRASO').length;
        const noPrazo = items.filter(r => r.prazoStatus === 'NO_PRAZO').length;

        // Helper de cálculo SVG Donut & Paleta de Cores declarados no início
        const rDonut = 100;
        const circ = 2 * Math.PI * rDonut; // ~628.318

        function makeDonutSlices(dataArray, total) {
            let accum = 0;
            return (dataArray || []).map(d => {
                const count = d.count || 0;
                const dash = total > 0 ? (count / total) * circ : 0;
                const offset = -accum;
                accum += dash;
                return {
                    ...d,
                    dash: dash.toFixed(2),
                    offset: offset.toFixed(2),
                    percent: total > 0 ? ((count / total) * 100).toFixed(0) : '0'
                };
            });
        }

        const palette = ['#00d4ff', '#a855f7', '#f59e0b', '#10b981', '#ef4444', '#ec4899', '#06b6d4', '#eab308'];

        // 1. DADOS: SETOR 01 (Estilo Pedido - Pendências Setor 01)
        const s01Items = items.filter(r => r.setor === '01');
        const s01ClientMap = countBy(s01Items, 'cliente');
        const s01ClientList = Object.entries(s01ClientMap).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
        const s01Criticos = s01Items.filter(r => r.diasParado > 2).length;

        // 2. DADOS: MODELAGEM - SETOR 13
        const s13Items = items.filter(r => r.setor === '13');
        const s13StatusMap = countBy(s13Items, 'statusModelagem');
        const s13StatusList = Object.entries(s13StatusMap).map(([name, count]) => ({
            name, 
            count, 
            isRuim: isModelagemPendenciaRuim(name)
        })).sort((a, b) => b.count - a.count);
        const s13Ruins = s13Items.filter(r => isModelagemPendenciaRuim(r.statusModelagem)).length;

        // 3. DADOS: MODELAGEM - SETORES 05, 06, 12 (EM PROCESSO)
        const processoItems = items.filter(r => ['05', '06', '12', '5', '6'].includes(r.setor));
        const processoRuins = processoItems.filter(r => isModelagemPendenciaRuim(r.statusModelagem)).length;
        const processoBons = processoItems.length - processoRuins;

        // 4. DADOS: PEND. ESTAMPA PRODUÇÃO
        const estampaItems = items.filter(r => PROD_SECTORS.includes(r.setor) && r.statusProd && r.statusProd !== '—' && r.statusProd !== '-');
        const estampaPendentes = estampaItems.filter(r => isEstampaStatusPendente(r.statusProd)).length;
        const estampaLiberados = estampaItems.length - estampaPendentes;

        // 5. DADOS: CORES PENDENTES - SETOR D01 (CRM)
        const d01Items = items.filter(r => r.setor === 'D01');
        const d01ClientMap = countBy(d01Items, 'cliente');
        const d01ClientList = Object.entries(d01ClientMap).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
        const d01Criticos = d01Items.filter(r => r.diasParado > 2).length;

        // 6. DADOS: CORES PENDENTES - POR RESPONSÁVEL (DRIVE GOOGLE)
        const coresExt = state.coresExternalData || { count: 0, byResponsavel: {} };
        const coresRespList = Object.entries(coresExt.byResponsavel || {}).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
        const coresRespTotal = coresRespList.reduce((sum, r) => sum + r.count, 0) || coresExt.count || 0;

        // 7. DADOS: AVIAMENTOS PENDENTES - SETOR X01 (CRM)
        const x01Items = items.filter(r => r.setor === 'X01' || r.setor === 'CM1');
        const x01ClientMap = countBy(x01Items, 'cliente');
        const x01ClientList = Object.entries(x01ClientMap).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
        const x01Criticos = x01Items.filter(r => r.diasParado > 2).length;

        // 8. DADOS: AVIAMENTOS PENDENTES - POR RESPONSÁVEL (DRIVE GOOGLE)
        const avExt = state.aviamentosExternalData || { count: 0, byResponsavel: {} };
        const avRespList = Object.entries(avExt.byResponsavel || {}).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
        const avRespTotal = avRespList.reduce((sum, r) => sum + r.count, 0) || avExt.count || 0;

        // 9. DADOS: SETOR 43 - ROTATIVOS (CRM + DRIVE)
        const s43Items = items.filter(r => r.setor === '43');
        const s43Repetidos = s43Items.filter(r => state.productionCodes.has(r.codigo)).length;
        const s43Regulares = s43Items.length - s43Repetidos;

        const rotExt = state.rotativosExternalData || { count: 12, faltaReceberCount: 5, recebidosCount: 7, records: [] };
        const rotDriveTotal = rotExt.count || 0;
        const rotFaltaReceber = rotExt.faltaReceberCount || 0;
        const rotRecebidos = rotExt.recebidosCount || (rotDriveTotal - rotFaltaReceber);
        const rotDriveSlices = makeDonutSlices([
            { name: 'Falta Receber (Pendente)', count: rotFaltaReceber, color: '#ef4444' },
            { name: 'Já Recebido', count: rotRecebidos, color: '#10b981' }
        ], rotDriveTotal);

        // 10. DADOS: FEIRA & PROTÓTIPOS (FLUXO D36)
        const d36Items = items.filter(r => (r.fluxo === 'D36' || (r.descFluxo || '').toUpperCase().includes('D36')));
        const d36Criticos = d36Items.filter(r => r.diasParado > 2).length;
        const d36Regulares = d36Items.length - d36Criticos;

        // 11. DADOS: MALOTES PENDENTES (SETORES 88 E 83)
        const PROD_SECTOR_LIST = ['05', '06', '12', '13', '26', '20', '31', '106'];
        const CRITICAL_SECTOR_LIST = ['20', '31', '106'];
        const ON_TIME_SECTOR_LIST = ['05', '06', '12', '13', '26'];

        const opProdSectorsMap = new Map();
        items.forEach(item => {
            if (!item.op) return;
            if (!opProdSectorsMap.has(item.op)) {
                opProdSectorsMap.set(item.op, new Set());
            }
            if (PROD_SECTOR_LIST.includes(item.setor)) {
                opProdSectorsMap.get(item.op).add(item.setor);
            }
        });

        const malotes88Items = [];
        const malotes83Items = [];

        items.forEach(item => {
            const s = (item.setor || '').trim();
            if (s !== '88' && s !== '088' && s !== '83' && s !== '083') return;

            const pSectors = Array.from(opProdSectorsMap.get(item.op) || []);
            let primarySector = 'Sem Setor';
            if (pSectors.length > 0) {
                const crit = pSectors.find(sec => CRITICAL_SECTOR_LIST.includes(sec));
                primarySector = crit ? `Setor ${crit}` : `Setor ${pSectors[0]}`;
            }

            const isCritico = pSectors.some(sec => CRITICAL_SECTOR_LIST.includes(sec));
            const isNoPrazo = pSectors.some(sec => ON_TIME_SECTOR_LIST.includes(sec));

            const entry = {
                ...item,
                maloteSetor: (s === '88' || s === '088') ? '88' : '83',
                primarySector,
                isCritico,
                isNoPrazo
            };

            if (entry.maloteSetor === '88') {
                malotes88Items.push(entry);
            } else {
                malotes83Items.push(entry);
            }
        });

        const malotes88Criticos = malotes88Items.filter(m => m.isCritico).length;
        const malotes88NoPrazo = malotes88Items.length - malotes88Criticos;

        const malotes83Criticos = malotes83Items.filter(m => m.isCritico).length;
        const malotes83NoPrazo = malotes83Items.length - malotes83Criticos;

        const s88SectorGroups = {};
        malotes88Items.forEach(m => {
            const key = m.primarySector;
            if (!s88SectorGroups[key]) s88SectorGroups[key] = { name: key, count: 0, isCritico: m.isCritico };
            s88SectorGroups[key].count++;
        });
        const s88SectorList = Object.values(s88SectorGroups).sort((a, b) => b.count - a.count);
        const s88Slices = makeDonutSlices(s88SectorList.map((sec, idx) => ({
            ...sec,
            color: sec.isCritico ? '#f43f5e' : (palette[idx % palette.length] || '#00d4ff')
        })), malotes88Items.length);

        const s83SectorGroups = {};
        malotes83Items.forEach(m => {
            const key = m.primarySector;
            if (!s83SectorGroups[key]) s83SectorGroups[key] = { name: key, count: 0, isCritico: m.isCritico };
            s83SectorGroups[key].count++;
        });
        const s83SectorList = Object.values(s83SectorGroups).sort((a, b) => b.count - a.count);
        const s83Slices = makeDonutSlices(s83SectorList.map((sec, idx) => ({
            ...sec,
            color: sec.isCritico ? '#f43f5e' : (palette[idx % palette.length] || '#00d4ff')
        })), malotes83Items.length);

// [Helpers declarados no início da função]

        // Fatias do Donut Setor 01
        const s01Slices = makeDonutSlices(s01ClientList.map((c, i) => ({ ...c, color: palette[i % palette.length] })), s01Items.length);

        // Fatias do Donut Setor 13
        const s13Slices = makeDonutSlices(s13StatusList.map((s, i) => ({ ...s, color: s.isRuim ? '#ef4444' : palette[i % palette.length] })), s13Items.length);

        // Fatias do Donut Processo (05, 06, 12)
        const processoSlices = makeDonutSlices([
            { name: 'Status Bons (Liberados)', count: processoBons, color: '#00d4ff' },
            { name: 'Pendências de Modelagem', count: processoRuins, color: '#ef4444' }
        ], processoItems.length);

        // Fatias do Donut Estampa
        const estampaSlices = makeDonutSlices([
            { name: 'Sem Pendência (Liberado)', count: estampaLiberados, color: '#10b981' },
            { name: 'Pendências de Estampa', count: estampaPendentes, color: '#00d4ff' }
        ], estampaItems.length);

        // Fatias do Donut Cores D01 (CRM - Clientes)
        const d01Slices = makeDonutSlices(d01ClientList.map((c, i) => ({ ...c, color: palette[i % palette.length] })), d01Items.length);

        // Fatias do Donut Cores (Drive - Responsável)
        const coresRespSlices = makeDonutSlices(coresRespList.map((c, i) => ({ ...c, color: palette[i % palette.length] })), coresRespTotal);

        // Fatias do Donut Aviamentos X01 (CRM - Clientes)
        const x01Slices = makeDonutSlices(x01ClientList.map((c, i) => ({ ...c, color: palette[i % palette.length] })), x01Items.length);

        // Fatias do Donut Aviamentos (Drive - Responsável)
        const avRespSlices = makeDonutSlices(avRespList.map((c, i) => ({ ...c, color: palette[i % palette.length] })), avRespTotal);

        // Fatias do Donut Rotativos 43
        const s43Slices = makeDonutSlices([
            { name: 'Rotativos Regulares', count: s43Regulares, color: '#06b6d4' },
            { name: 'Gargalo Crítico (Repetem)', count: s43Repetidos, color: '#ef4444' }
        ], s43Items.length);

        // Fatias do Donut Feira D36
        const d36Slices = makeDonutSlices([
            { name: 'Fluxo Regular (<= 2 dias)', count: d36Regulares, color: '#ec4899' },
            { name: 'Críticos (> 2 dias)', count: d36Criticos, color: '#ef4444' }
        ], d36Items.length);

        container.innerHTML = `
            <!-- CABEÇALHO DO RESUMO MACRO -->
            <div class="module-view-header" style="margin-bottom: 18px;">
                <div class="module-view-title-group">
                    <h2 style="font-size: 21px; font-weight: 800; color: var(--text-primary);">Resumo Macro Executivo (Visão de Todas as Telas)</h2>
                    <p class="module-view-description" style="font-size: 13px; color: var(--text-muted); margin-top: 3px;">
                        Visão centralizada e ágil de pendências por setor. Clique no card de qualquer módulo para abrir sua tela detalhada.
                    </p>
                </div>
                <div class="header-action-group">
                    <span class="badge badge-purple" style="font-size: 12px; padding: 6px 14px;">
                        <i class="fa-solid fa-cubes"></i> ${totalItems} OPs Totais
                    </span>
                    <span class="badge badge-emerald" style="font-size: 12px; padding: 6px 14px;">
                        <i class="fa-solid fa-shirt"></i> ${formatNumber(totalPecas)} pçs
                    </span>
                    <button class="btn btn-glass" onclick="window.crmToggleSource()" style="font-size: 12px;">
                        <i class="fa-solid fa-database"></i>
                        <span>Fonte: ${state.sourceType === 'full' ? 'Dados Completos' : 'Planilha Pura'}</span>
                    </button>
                </div>
            </div>

            <!-- GRID PRINCIPAL DE GRÁFICOS RESUMO: 4 GRÁFICOS POR LINHA -->
            <div class="macro-executive-grid">
                
                <!-- 1. QUANTIDADE DE PRODUTOS NO SETOR 01 -->
                <div class="macro-chart-card" style="border-color: rgba(168, 85, 247, 0.35);" onclick="window.crmNavigate('estilo-pedido', 'setor01')" title="Clique para abrir a tela do Setor 01">
                    <div class="macro-chart-header">
                        <div class="macro-chart-title-box">
                            <i class="fa-solid fa-clock-rotate-left" style="color: #a855f7; font-size: 15px;"></i>
                            <h3 class="macro-chart-title">Pend. Setor 01</h3>
                        </div>
                        <span class="badge badge-purple" style="font-size: 10px; padding: 2px 7px;">Entrar →</span>
                    </div>

                    <svg viewBox="0 0 340 340" class="macro-donut-svg">
                        <g transform="rotate(-90 170 170)">
                            <circle cx="170" cy="170" r="100" fill="none" stroke="#121624" stroke-width="40" />
                            ${s01Items.length > 0 ? s01Slices.map(s => `
                                <circle cx="170" cy="170" r="100" fill="none" stroke="${s.color}" stroke-width="40"
                                    stroke-dasharray="${s.dash} ${circ.toFixed(2)}"
                                    stroke-dashoffset="${s.offset}"
                                />
                            `).join('') : `
                                <circle cx="170" cy="170" r="100" fill="none" stroke="#334155" stroke-width="40"
                                    stroke-dasharray="${circ.toFixed(2)} ${circ.toFixed(2)}" stroke-dashoffset="0"
                                />
                            `}
                        </g>
                        <text x="170" y="152" text-anchor="middle" dominant-baseline="central" fill="#ffffff" font-size="52" font-weight="900" font-family="system-ui, sans-serif">${s01Items.length}</text>
                        <text x="170" y="194" text-anchor="middle" dominant-baseline="central" fill="#a855f7" font-size="11.5px" font-weight="800" letter-spacing="2px">SETOR 01</text>
                    </svg>

                    <div class="macro-quick-legend">
                        <div class="macro-legend-pill" style="border-left: 3px solid #a855f7;">
                            <div style="font-size: 10px; color: #94a3b8;">Top Cliente</div>
                            <div style="font-size: 11.5px; font-weight: 700; color: #ffffff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${s01ClientList[0] ? s01ClientList[0].name : 'Nenhum'}</div>
                        </div>
                        <div class="macro-legend-pill" style="border-left: 3px solid ${s01Criticos > 0 ? '#ef4444' : '#10b981'};">
                            <div style="font-size: 10px; color: #94a3b8;">> 2 Dias</div>
                            <div style="font-size: 11.5px; font-weight: 700; color: ${s01Criticos > 0 ? '#f87171' : '#34d399'};">${s01Criticos} prod</div>
                        </div>
                    </div>
                </div>

                <!-- 2. MODELAGEM - SETOR 13 -->
                <div class="macro-chart-card" style="border-color: rgba(0, 212, 255, 0.35);" onclick="window.crmNavigate('modelagem', 'setor13')" title="Clique para abrir a tela do Setor 13">
                    <div class="macro-chart-header">
                        <div class="macro-chart-title-box">
                            <i class="fa-solid fa-tag" style="color: #00d4ff; font-size: 15px;"></i>
                            <h3 class="macro-chart-title">Modelagem - Setor 13</h3>
                        </div>
                        <span class="badge badge-cyan" style="font-size: 10px; padding: 2px 7px;">Entrar →</span>
                    </div>

                    <svg viewBox="0 0 340 340" class="macro-donut-svg">
                        <g transform="rotate(-90 170 170)">
                            <circle cx="170" cy="170" r="100" fill="none" stroke="#121624" stroke-width="40" />
                            ${s13Items.length > 0 ? s13Slices.map(s => `
                                <circle cx="170" cy="170" r="100" fill="none" stroke="${s.color}" stroke-width="40"
                                    stroke-dasharray="${s.dash} ${circ.toFixed(2)}"
                                    stroke-dashoffset="${s.offset}"
                                />
                            `).join('') : `
                                <circle cx="170" cy="170" r="100" fill="none" stroke="#334155" stroke-width="40"
                                    stroke-dasharray="${circ.toFixed(2)} ${circ.toFixed(2)}" stroke-dashoffset="0"
                                />
                            `}
                        </g>
                        <text x="170" y="152" text-anchor="middle" dominant-baseline="central" fill="#ffffff" font-size="52" font-weight="900" font-family="system-ui, sans-serif">${s13Items.length}</text>
                        <text x="170" y="194" text-anchor="middle" dominant-baseline="central" fill="#00d4ff" font-size="11.5px" font-weight="800" letter-spacing="2px">SETOR 13</text>
                    </svg>

                    <div class="macro-quick-legend">
                        <div class="macro-legend-pill" style="border-left: 3px solid #10b981;">
                            <div style="font-size: 10px; color: #94a3b8;">Lib Corte / Ok</div>
                            <div style="font-size: 11.5px; font-weight: 700; color: #34d399;">${s13Items.length - s13Ruins} prod</div>
                        </div>
                        <div class="macro-legend-pill" style="border-left: 3px solid #ef4444;">
                            <div style="font-size: 10px; color: #94a3b8;">Pendências</div>
                            <div style="font-size: 11.5px; font-weight: 700; color: #f87171;">${s13Ruins} prod</div>
                        </div>
                    </div>
                </div>

                <!-- 3. MODELAGEM - SETOR 05, 06, 12 (EM PROCESSO) -->
                <div class="macro-chart-card" style="border-color: rgba(14, 165, 233, 0.35);" onclick="window.crmNavigate('modelagem', 'processo')" title="Clique para abrir a tela de Processo (05, 06, 12)">
                    <div class="macro-chart-header">
                        <div class="macro-chart-title-box">
                            <i class="fa-solid fa-scissors" style="color: #38bdf8; font-size: 15px;"></i>
                            <h3 class="macro-chart-title">Processo (05, 06, 12)</h3>
                        </div>
                        <span class="badge badge-cyan" style="font-size: 10px; padding: 2px 7px;">Entrar →</span>
                    </div>

                    <svg viewBox="0 0 340 340" class="macro-donut-svg">
                        <g transform="rotate(-90 170 170)">
                            <circle cx="170" cy="170" r="100" fill="none" stroke="#121624" stroke-width="40" />
                            ${processoItems.length > 0 ? processoSlices.map(s => `
                                <circle cx="170" cy="170" r="100" fill="none" stroke="${s.color}" stroke-width="40"
                                    stroke-dasharray="${s.dash} ${circ.toFixed(2)}"
                                    stroke-dashoffset="${s.offset}"
                                />
                            `).join('') : `
                                <circle cx="170" cy="170" r="100" fill="none" stroke="#334155" stroke-width="40"
                                    stroke-dasharray="${circ.toFixed(2)} ${circ.toFixed(2)}" stroke-dashoffset="0"
                                />
                            `}
                        </g>
                        <text x="170" y="152" text-anchor="middle" dominant-baseline="central" fill="#ffffff" font-size="52" font-weight="900" font-family="system-ui, sans-serif">${processoItems.length}</text>
                        <text x="170" y="194" text-anchor="middle" dominant-baseline="central" fill="#38bdf8" font-size="11px" font-weight="800" letter-spacing="1.5px">EM PROCESSO</text>
                    </svg>

                    <div class="macro-quick-legend">
                        <div class="macro-legend-pill" style="border-left: 3px solid #00d4ff;">
                            <div style="font-size: 10px; color: #94a3b8;">Status Bons</div>
                            <div style="font-size: 11.5px; font-weight: 700; color: #38bdf8;">${processoBons} prod</div>
                        </div>
                        <div class="macro-legend-pill" style="border-left: 3px solid #ef4444;">
                            <div style="font-size: 10px; color: #94a3b8;">Pendências</div>
                            <div style="font-size: 11.5px; font-weight: 700; color: #f87171;">${processoRuins} prod</div>
                        </div>
                    </div>
                </div>

                <!-- 4. PEND. ESTAMPA PRODUÇÃO -->
                <div class="macro-chart-card" style="border-color: rgba(16, 185, 129, 0.35);" onclick="window.crmNavigate('estilo-pedido', 'estampa')" title="Clique para abrir a tela de Estampa">
                    <div class="macro-chart-header">
                        <div class="macro-chart-title-box">
                            <i class="fa-solid fa-shirt" style="color: #10b981; font-size: 15px;"></i>
                            <h3 class="macro-chart-title">Situação Estampa</h3>
                        </div>
                        <span class="badge badge-emerald" style="font-size: 10px; padding: 2px 7px;">Entrar →</span>
                    </div>

                    <svg viewBox="0 0 340 340" class="macro-donut-svg">
                        <g transform="rotate(-90 170 170)">
                            <circle cx="170" cy="170" r="100" fill="none" stroke="#121624" stroke-width="40" />
                            ${estampaItems.length > 0 ? estampaSlices.map(s => `
                                <circle cx="170" cy="170" r="100" fill="none" stroke="${s.color}" stroke-width="40"
                                    stroke-dasharray="${s.dash} ${circ.toFixed(2)}"
                                    stroke-dashoffset="${s.offset}"
                                />
                            `).join('') : `
                                <circle cx="170" cy="170" r="100" fill="none" stroke="#334155" stroke-width="40"
                                    stroke-dasharray="${circ.toFixed(2)} ${circ.toFixed(2)}" stroke-dashoffset="0"
                                />
                            `}
                        </g>
                        <text x="170" y="152" text-anchor="middle" dominant-baseline="central" fill="#ffffff" font-size="52" font-weight="900" font-family="system-ui, sans-serif">${estampaItems.length}</text>
                        <text x="170" y="194" text-anchor="middle" dominant-baseline="central" fill="#10b981" font-size="11px" font-weight="800" letter-spacing="1.5px">SIT. ESTAMPA</text>
                    </svg>

                    <div class="macro-quick-legend">
                        <div class="macro-legend-pill" style="border-left: 3px solid #10b981;">
                            <div style="font-size: 10px; color: #94a3b8;">Liberados</div>
                            <div style="font-size: 11.5px; font-weight: 700; color: #34d399;">${estampaLiberados} prod</div>
                        </div>
                        <div class="macro-legend-pill" style="border-left: 3px solid #00d4ff;">
                            <div style="font-size: 10px; color: #94a3b8;">Pendentes</div>
                            <div style="font-size: 11.5px; font-weight: 700; color: #38bdf8;">${estampaPendentes} prod</div>
                        </div>
                    </div>
                </div>

                <!-- 5. CORES PENDENTES: SETOR D01 (CRM) + PLANILHA DRIVE NO MESMO QUADRO -->
                <div class="macro-chart-card" style="border-color: rgba(0, 212, 255, 0.35);" onclick="window.crmNavigate('estilo-pedido', 'cores-pendentes')" title="Clique para abrir a tela de Cores Pendentes (Setor D01 & Drive)">
                    <div class="macro-chart-header">
                        <div class="macro-chart-title-box">
                            <i class="fa-solid fa-palette" style="color: #00d4ff; font-size: 15px;"></i>
                            <h3 class="macro-chart-title">Pendências de Cores (D01 & Drive)</h3>
                        </div>
                        <div style="display: flex; gap: 4px; align-items: center;">
                            <span class="badge badge-cyan" style="font-size: 9.5px; padding: 2px 6px;">CRM + Drive</span>
                            <span class="badge badge-purple" style="font-size: 9.5px; padding: 2px 6px;">Entrar →</span>
                        </div>
                    </div>

                    <!-- SUB-GRID COM OS DOIS GRÁFICOS NO MESMO QUADRO -->
                    <div class="macro-dual-row">
                        <!-- GRÁFICO 1: SETOR D01 (CRM) -->
                        <div class="macro-sub-box" style="border-color: rgba(0, 212, 255, 0.2);">
                            <div class="macro-sub-header">
                                <span style="font-size: 10px; font-weight: 800; color: #00d4ff; letter-spacing: 0.5px;">D01 • POR CLIENTE (CRM)</span>
                                <span class="badge badge-cyan" style="font-size: 9px; padding: 1px 5px;">${d01Items.length} prod</span>
                            </div>
                            <svg viewBox="0 0 340 340" class="macro-sub-donut-svg">
                                <g transform="rotate(-90 170 170)">
                                    <circle cx="170" cy="170" r="100" fill="none" stroke="#121624" stroke-width="40" />
                                    ${d01Items.length > 0 ? d01Slices.map(s => `
                                        <circle cx="170" cy="170" r="100" fill="none" stroke="${s.color}" stroke-width="40"
                                            stroke-dasharray="${s.dash} ${circ.toFixed(2)}"
                                            stroke-dashoffset="${s.offset}"
                                        />
                                    `).join('') : `
                                        <circle cx="170" cy="170" r="100" fill="none" stroke="#334155" stroke-width="40"
                                            stroke-dasharray="${circ.toFixed(2)} ${circ.toFixed(2)}" stroke-dashoffset="0"
                                        />
                                    `}
                                </g>
                                <text x="170" y="150" text-anchor="middle" dominant-baseline="central" fill="#ffffff" font-size="52" font-weight="900" font-family="system-ui, sans-serif">${d01Items.length}</text>
                                <text x="170" y="192" text-anchor="middle" dominant-baseline="central" fill="#00d4ff" font-size="11px" font-weight="800" letter-spacing="1px">SETOR D01</text>
                            </svg>
                            <div class="macro-sub-legend">
                                <div class="macro-legend-pill" style="border-left: 2px solid #00d4ff; padding: 4px 6px;">
                                    <div style="font-size: 9px; color: #94a3b8;">Top Cliente</div>
                                    <div style="font-size: 10.5px; font-weight: 700; color: #ffffff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${d01ClientList[0] ? d01ClientList[0].name : 'Nenhum'}</div>
                                </div>
                                <div class="macro-legend-pill" style="border-left: 2px solid ${d01Criticos > 0 ? '#ef4444' : '#10b981'}; padding: 4px 6px;">
                                    <div style="font-size: 9px; color: #94a3b8;">> 2 Dias</div>
                                    <div style="font-size: 10.5px; font-weight: 700; color: ${d01Criticos > 0 ? '#f87171' : '#34d399'};">${d01Criticos} prod</div>
                                </div>
                            </div>
                        </div>

                        <!-- GRÁFICO 2: CORES DRIVE POR RESPONSÁVEL -->
                        <div class="macro-sub-box" style="border-color: rgba(168, 85, 247, 0.2);">
                            <div class="macro-sub-header">
                                <span style="font-size: 10px; font-weight: 800; color: #c084fc; letter-spacing: 0.5px;">POR RESPONSÁVEL (DRIVE)</span>
                                <span class="badge badge-purple" style="font-size: 9px; padding: 1px 5px;">${coresRespTotal} cores</span>
                            </div>
                            <svg viewBox="0 0 340 340" class="macro-sub-donut-svg">
                                <g transform="rotate(-90 170 170)">
                                    <circle cx="170" cy="170" r="100" fill="none" stroke="#121624" stroke-width="40" />
                                    ${coresRespTotal > 0 ? coresRespSlices.map(s => `
                                        <circle cx="170" cy="170" r="100" fill="none" stroke="${s.color}" stroke-width="40"
                                            stroke-dasharray="${s.dash} ${circ.toFixed(2)}"
                                            stroke-dashoffset="${s.offset}"
                                        />
                                    `).join('') : `
                                        <circle cx="170" cy="170" r="100" fill="none" stroke="#334155" stroke-width="40"
                                            stroke-dasharray="${circ.toFixed(2)} ${circ.toFixed(2)}" stroke-dashoffset="0"
                                        />
                                    `}
                                </g>
                                <text x="170" y="150" text-anchor="middle" dominant-baseline="central" fill="#ffffff" font-size="52" font-weight="900" font-family="system-ui, sans-serif">${coresRespTotal}</text>
                                <text x="170" y="192" text-anchor="middle" dominant-baseline="central" fill="#c084fc" font-size="11px" font-weight="800" letter-spacing="1px">PLANILHA DRIVE</text>
                            </svg>
                            <div class="macro-sub-legend">
                                <div class="macro-legend-pill" style="border-left: 2px solid #a855f7; padding: 4px 6px;">
                                    <div style="font-size: 9px; color: #94a3b8;">${coresRespList[0] ? coresRespList[0].name : 'Resp 1'}</div>
                                    <div style="font-size: 10.5px; font-weight: 700; color: #ffffff;">${coresRespList[0] ? coresRespList[0].count : 0} cores</div>
                                </div>
                                <div class="macro-legend-pill" style="border-left: 2px solid #00d4ff; padding: 4px 6px;">
                                    <div style="font-size: 9px; color: #94a3b8;">${coresRespList[1] ? coresRespList[1].name : 'Resp 2'}</div>
                                    <div style="font-size: 10.5px; font-weight: 700; color: #38bdf8;">${coresRespList[1] ? coresRespList[1].count : 0} cores</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 6. AVIAMENTOS PENDENTES: SETOR X01 (CRM) + PLANILHA DRIVE NO MESMO QUADRO -->
                <div class="macro-chart-card" style="border-color: rgba(245, 158, 11, 0.35);" onclick="window.crmNavigate('estilo-pedido', 'aviamentos-pendentes')" title="Clique para abrir a tela de Aviamentos Pendentes (Setor X01 & Drive)">
                    <div class="macro-chart-header">
                        <div class="macro-chart-title-box">
                            <i class="fa-solid fa-box-open" style="color: #f59e0b; font-size: 15px;"></i>
                            <h3 class="macro-chart-title">Pendências de Aviamentos (X01 & Drive)</h3>
                        </div>
                        <div style="display: flex; gap: 4px; align-items: center;">
                            <span class="badge badge-amber" style="font-size: 9.5px; padding: 2px 6px;">CRM + Drive</span>
                            <span class="badge badge-amber" style="font-size: 9.5px; padding: 2px 6px;">Entrar →</span>
                        </div>
                    </div>

                    <!-- SUB-GRID COM OS DOIS GRÁFICOS NO MESMO QUADRO -->
                    <div class="macro-dual-row">
                        <!-- GRÁFICO 1: SETOR X01 (CRM) -->
                        <div class="macro-sub-box" style="border-color: rgba(245, 158, 11, 0.2);">
                            <div class="macro-sub-header">
                                <span style="font-size: 10px; font-weight: 800; color: #f59e0b; letter-spacing: 0.5px;">X01 • POR CLIENTE (CRM)</span>
                                <span class="badge badge-amber" style="font-size: 9px; padding: 1px 5px;">${x01Items.length} prod</span>
                            </div>
                            <svg viewBox="0 0 340 340" class="macro-sub-donut-svg">
                                <g transform="rotate(-90 170 170)">
                                    <circle cx="170" cy="170" r="100" fill="none" stroke="#121624" stroke-width="40" />
                                    ${x01Items.length > 0 ? x01Slices.map(s => `
                                        <circle cx="170" cy="170" r="100" fill="none" stroke="${s.color}" stroke-width="40"
                                            stroke-dasharray="${s.dash} ${circ.toFixed(2)}"
                                            stroke-dashoffset="${s.offset}"
                                        />
                                    `).join('') : `
                                        <circle cx="170" cy="170" r="100" fill="none" stroke="#334155" stroke-width="40"
                                            stroke-dasharray="${circ.toFixed(2)} ${circ.toFixed(2)}" stroke-dashoffset="0"
                                        />
                                    `}
                                </g>
                                <text x="170" y="150" text-anchor="middle" dominant-baseline="central" fill="#ffffff" font-size="52" font-weight="900" font-family="system-ui, sans-serif">${x01Items.length}</text>
                                <text x="170" y="192" text-anchor="middle" dominant-baseline="central" fill="#f59e0b" font-size="11px" font-weight="800" letter-spacing="1px">SETOR X01</text>
                            </svg>
                            <div class="macro-sub-legend">
                                <div class="macro-legend-pill" style="border-left: 2px solid #f59e0b; padding: 4px 6px;">
                                    <div style="font-size: 9px; color: #94a3b8;">Top Cliente</div>
                                    <div style="font-size: 10.5px; font-weight: 700; color: #ffffff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${x01ClientList[0] ? x01ClientList[0].name : 'Nenhum'}</div>
                                </div>
                                <div class="macro-legend-pill" style="border-left: 2px solid ${x01Criticos > 0 ? '#ef4444' : '#10b981'}; padding: 4px 6px;">
                                    <div style="font-size: 9px; color: #94a3b8;">> 2 Dias</div>
                                    <div style="font-size: 10.5px; font-weight: 700; color: ${x01Criticos > 0 ? '#f87171' : '#34d399'};">${x01Criticos} prod</div>
                                </div>
                            </div>
                        </div>

                        <!-- GRÁFICO 2: AVIAMENTOS DRIVE POR RESPONSÁVEL -->
                        <div class="macro-sub-box" style="border-color: rgba(251, 191, 36, 0.2);">
                            <div class="macro-sub-header">
                                <span style="font-size: 10px; font-weight: 800; color: #fbbf24; letter-spacing: 0.5px;">POR RESPONSÁVEL (DRIVE)</span>
                                <span class="badge badge-amber" style="font-size: 9px; padding: 1px 5px;">${avRespTotal} pend</span>
                            </div>
                            <svg viewBox="0 0 340 340" class="macro-sub-donut-svg">
                                <g transform="rotate(-90 170 170)">
                                    <circle cx="170" cy="170" r="100" fill="none" stroke="#121624" stroke-width="40" />
                                    ${avRespTotal > 0 ? avRespSlices.map(s => `
                                        <circle cx="170" cy="170" r="100" fill="none" stroke="${s.color}" stroke-width="40"
                                            stroke-dasharray="${s.dash} ${circ.toFixed(2)}"
                                            stroke-dashoffset="${s.offset}"
                                        />
                                    `).join('') : `
                                        <circle cx="170" cy="170" r="100" fill="none" stroke="#334155" stroke-width="40"
                                            stroke-dasharray="${circ.toFixed(2)} ${circ.toFixed(2)}" stroke-dashoffset="0"
                                        />
                                    `}
                                </g>
                                <text x="170" y="150" text-anchor="middle" dominant-baseline="central" fill="#ffffff" font-size="52" font-weight="900" font-family="system-ui, sans-serif">${avRespTotal}</text>
                                <text x="170" y="192" text-anchor="middle" dominant-baseline="central" fill="#fbbf24" font-size="11px" font-weight="800" letter-spacing="1px">PLANILHA DRIVE</text>
                            </svg>
                            <div class="macro-sub-legend">
                                <div class="macro-legend-pill" style="border-left: 2px solid #fbbf24; padding: 4px 6px;">
                                    <div style="font-size: 9px; color: #94a3b8;">${avRespList[0] ? avRespList[0].name : 'Resp 1'}</div>
                                    <div style="font-size: 10.5px; font-weight: 700; color: #ffffff;">${avRespList[0] ? avRespList[0].count : 0} pend</div>
                                </div>
                                <div class="macro-legend-pill" style="border-left: 2px solid #00d4ff; padding: 4px 6px;">
                                    <div style="font-size: 9px; color: #94a3b8;">${avRespList[1] ? avRespList[1].name : 'Resp 2'}</div>
                                    <div style="font-size: 10.5px; font-weight: 700; color: #38bdf8;">${avRespList[1] ? avRespList[1].count : 0} pend</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 9. ROTATIVOS & MESAS (SETOR 43 & DRIVE) -->
                <div class="macro-chart-card" style="border-color: rgba(6, 182, 212, 0.35);" onclick="window.crmNavigate('estilo-pedido', 'rotativos')" title="Clique para abrir a tela de Rotativos (Setor 43 & Drive)">
                    <div class="macro-chart-header">
                        <div class="macro-chart-title-box">
                            <i class="fa-solid fa-rotate" style="color: #06b6d4; font-size: 15px;"></i>
                            <h3 class="macro-chart-title">Rotativos (Setor 43 & Drive)</h3>
                        </div>
                        <div style="display: flex; gap: 4px; align-items: center;">
                            <span class="badge badge-cyan" style="font-size: 9.5px; padding: 2px 6px;">CRM + Drive</span>
                            <span class="badge badge-purple" style="font-size: 9.5px; padding: 2px 6px;">Entrar →</span>
                        </div>
                    </div>

                    <!-- SUB-GRID COM OS DOIS GRÁFICOS NO MESMO QUADRO -->
                    <div class="macro-dual-row">
                        <!-- GRÁFICO 1: SETOR 43 (CRM) -->
                        <div class="macro-sub-box" style="border-color: rgba(6, 182, 212, 0.2);">
                            <div class="macro-sub-header">
                                <span style="font-size: 10px; font-weight: 800; color: #06b6d4; letter-spacing: 0.5px;">S43 • CRM ONEDA</span>
                                <span class="badge badge-cyan" style="font-size: 9px; padding: 1px 5px;">${s43Items.length} prod</span>
                            </div>
                            <svg viewBox="0 0 340 340" class="macro-sub-donut-svg">
                                <g transform="rotate(-90 170 170)">
                                    <circle cx="170" cy="170" r="100" fill="none" stroke="#121624" stroke-width="40" />
                                    ${s43Items.length > 0 ? s43Slices.map(s => `
                                        <circle cx="170" cy="170" r="100" fill="none" stroke="${s.color}" stroke-width="40"
                                            stroke-dasharray="${s.dash} ${circ.toFixed(2)}"
                                            stroke-dashoffset="${s.offset}"
                                        />
                                    `).join('') : `
                                        <circle cx="170" cy="170" r="100" fill="none" stroke="#334155" stroke-width="40"
                                            stroke-dasharray="${circ.toFixed(2)} ${circ.toFixed(2)}" stroke-dashoffset="0"
                                        />
                                    `}
                                </g>
                                <text x="170" y="150" text-anchor="middle" dominant-baseline="central" fill="#ffffff" font-size="52" font-weight="900" font-family="system-ui, sans-serif">${s43Items.length}</text>
                                <text x="170" y="192" text-anchor="middle" dominant-baseline="central" fill="#06b6d4" font-size="11px" font-weight="800" letter-spacing="1px">SETOR 43</text>
                            </svg>
                            <div class="macro-sub-legend">
                                <div class="macro-legend-pill" style="border-left: 2px solid #06b6d4; padding: 4px 6px;">
                                    <div style="font-size: 9px; color: #94a3b8;">Normal</div>
                                    <div style="font-size: 10.5px; font-weight: 700; color: #22d3ee;">${s43Regulares} prod</div>
                                </div>
                                <div class="macro-legend-pill" style="border-left: 2px solid ${s43Repetidos > 0 ? '#ef4444' : '#10b981'}; padding: 4px 6px;">
                                    <div style="font-size: 9px; color: #94a3b8;">Repetem</div>
                                    <div style="font-size: 10.5px; font-weight: 700; color: ${s43Repetidos > 0 ? '#f87171' : '#34d399'};">${s43Repetidos} prod</div>
                                </div>
                            </div>
                        </div>

                        <!-- GRÁFICO 2: MESAS DRIVE -->
                        <div class="macro-sub-box" style="border-color: rgba(239, 68, 68, 0.2);">
                            <div class="macro-sub-header">
                                <span style="font-size: 10px; font-weight: 800; color: #f87171; letter-spacing: 0.5px;">MESAS (DRIVE)</span>
                                <span class="badge badge-rose" style="font-size: 9px; padding: 1px 5px;">${rotDriveTotal} mesas</span>
                            </div>
                            <svg viewBox="0 0 340 340" class="macro-sub-donut-svg">
                                <g transform="rotate(-90 170 170)">
                                    <circle cx="170" cy="170" r="100" fill="none" stroke="#121624" stroke-width="40" />
                                    ${rotDriveTotal > 0 ? rotDriveSlices.map(s => `
                                        <circle cx="170" cy="170" r="100" fill="none" stroke="${s.color}" stroke-width="40"
                                            stroke-dasharray="${s.dash} ${circ.toFixed(2)}"
                                            stroke-dashoffset="${s.offset}"
                                        />
                                    `).join('') : `
                                        <circle cx="170" cy="170" r="100" fill="none" stroke="#334155" stroke-width="40"
                                            stroke-dasharray="${circ.toFixed(2)} ${circ.toFixed(2)}" stroke-dashoffset="0"
                                        />
                                    `}
                                </g>
                                <text x="170" y="150" text-anchor="middle" dominant-baseline="central" fill="#ffffff" font-size="52" font-weight="900" font-family="system-ui, sans-serif">${rotDriveTotal}</text>
                                <text x="170" y="192" text-anchor="middle" dominant-baseline="central" fill="#f87171" font-size="11px" font-weight="800" letter-spacing="1px">PLANILHA DRIVE</text>
                            </svg>
                            <div class="macro-sub-legend">
                                <div class="macro-legend-pill" style="border-left: 2px solid #ef4444; padding: 4px 6px;">
                                    <div style="font-size: 9px; color: #94a3b8;">Falta Receber</div>
                                    <div style="font-size: 10.5px; font-weight: 700; color: #f87171;">${rotFaltaReceber} pend</div>
                                </div>
                                <div class="macro-legend-pill" style="border-left: 2px solid #10b981; padding: 4px 6px;">
                                    <div style="font-size: 9px; color: #94a3b8;">Recebidas</div>
                                    <div style="font-size: 10.5px; font-weight: 700; color: #34d399;">${rotRecebidos} ok</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 10. FEIRA & PROTÓTIPOS (FLUXO D36) -->
                <div class="macro-chart-card" style="border-color: rgba(236, 72, 153, 0.35);" onclick="window.crmNavigate('estilo-amostras', 'feira')" title="Clique para abrir a tela de Feira & Protótipos (Fluxo D36)">
                    <div class="macro-chart-header">
                        <div class="macro-chart-title-box">
                            <i class="fa-solid fa-gem" style="color: #ec4899; font-size: 15px;"></i>
                            <h3 class="macro-chart-title">Feira & Protótipos</h3>
                        </div>
                        <span class="badge badge-pink" style="font-size: 10px; padding: 2px 7px;">Entrar →</span>
                    </div>

                    <svg viewBox="0 0 340 340" class="macro-donut-svg">
                        <g transform="rotate(-90 170 170)">
                            <circle cx="170" cy="170" r="100" fill="none" stroke="#121624" stroke-width="40" />
                            ${d36Items.length > 0 ? d36Slices.map(s => `
                                <circle cx="170" cy="170" r="100" fill="none" stroke="${s.color}" stroke-width="40"
                                    stroke-dasharray="${s.dash} ${circ.toFixed(2)}"
                                    stroke-dashoffset="${s.offset}"
                                />
                            `).join('') : `
                                <circle cx="170" cy="170" r="100" fill="none" stroke="#334155" stroke-width="40"
                                    stroke-dasharray="${circ.toFixed(2)} ${circ.toFixed(2)}" stroke-dashoffset="0"
                                />
                            `}
                        </g>
                        <text x="170" y="152" text-anchor="middle" dominant-baseline="central" fill="#ffffff" font-size="52" font-weight="900" font-family="system-ui, sans-serif">${d36Items.length}</text>
                        <text x="170" y="194" text-anchor="middle" dominant-baseline="central" fill="#ec4899" font-size="11px" font-weight="800" letter-spacing="1.5px">FLUXO D36</text>
                    </svg>

                    <div class="macro-quick-legend">
                        <div class="macro-legend-pill" style="border-left: 3px solid #ec4899;">
                            <div style="font-size: 10px; color: #94a3b8;">Fluxo Regular</div>
                            <div style="font-size: 11.5px; font-weight: 700; color: #f472b6;">${d36Regulares} prod</div>
                        </div>
                        <div class="macro-legend-pill" style="border-left: 3px solid #ef4444;">
                            <div style="font-size: 10px; color: #94a3b8;">> 2 Dias</div>
                            <div style="font-size: 11.5px; font-weight: 700; color: #f87171;">${d36Criticos} prod</div>
                        </div>
                    </div>
                </div>

                <!-- 11. MALOTES PENDENTES (SETORES 88 E 83) -->
                <div class="macro-chart-card" style="border-color: rgba(244, 63, 94, 0.35);" onclick="window.crmNavigate('estilo-pedido', 'malotes')" title="Clique para abrir a tela de Malotes (Setores 88 e 83)">
                    <div class="macro-chart-header">
                        <div class="macro-chart-title-box">
                            <i class="fa-solid fa-envelope-open-text" style="color: #f43f5e; font-size: 15px;"></i>
                            <h3 class="macro-chart-title">Malotes (Setor 88 e 83)</h3>
                        </div>
                        <div style="display: flex; gap: 4px; align-items: center;">
                            <span class="badge badge-pink" style="font-size: 9.5px; padding: 2px 6px;">88 & 83</span>
                            <span class="badge badge-purple" style="font-size: 9.5px; padding: 2px 6px;">Entrar →</span>
                        </div>
                    </div>

                    <!-- SUB-GRID COM OS DOIS GRÁFICOS NO MESMO QUADRO -->
                    <div class="macro-dual-row">
                        <!-- GRÁFICO 1: SETOR 88 -->
                        <div class="macro-sub-box" style="border-color: rgba(244, 63, 94, 0.2);">
                            <div class="macro-sub-header">
                                <span style="font-size: 10px; font-weight: 800; color: #f43f5e; letter-spacing: 0.5px;">SETOR 88 • MALOTES</span>
                                <span class="badge badge-pink" style="font-size: 9px; padding: 1px 5px;">${malotes88Items.length} malotes</span>
                            </div>
                            <svg viewBox="0 0 340 340" class="macro-sub-donut-svg">
                                <g transform="rotate(-90 170 170)">
                                    <circle cx="170" cy="170" r="100" fill="none" stroke="#121624" stroke-width="40" />
                                    ${malotes88Items.length > 0 ? s88Slices.map(s => `
                                        <circle cx="170" cy="170" r="100" fill="none" stroke="${s.color}" stroke-width="40"
                                            stroke-dasharray="${s.dash} ${circ.toFixed(2)}"
                                            stroke-dashoffset="${s.offset}"
                                        />
                                    `).join('') : `
                                        <circle cx="170" cy="170" r="100" fill="none" stroke="#334155" stroke-width="40"
                                            stroke-dasharray="${circ.toFixed(2)} ${circ.toFixed(2)}" stroke-dashoffset="0"
                                        />
                                    `}
                                </g>
                                <text x="170" y="150" text-anchor="middle" dominant-baseline="central" fill="#ffffff" font-size="52" font-weight="900" font-family="system-ui, sans-serif">${malotes88Items.length}</text>
                                <text x="170" y="192" text-anchor="middle" dominant-baseline="central" fill="#f43f5e" font-size="11px" font-weight="800" letter-spacing="1px">SETOR 88</text>
                            </svg>
                            <div class="macro-sub-legend">
                                <div class="macro-legend-pill" style="border-left: 2px solid ${malotes88Criticos > 0 ? '#ef4444' : '#10b981'}; padding: 4px 6px;">
                                    <div style="font-size: 9px; color: #94a3b8;">Críticos</div>
                                    <div style="font-size: 10.5px; font-weight: 700; color: ${malotes88Criticos > 0 ? '#f87171' : '#34d399'};">${malotes88Criticos} malotes</div>
                                </div>
                                <div class="macro-legend-pill" style="border-left: 2px solid #00d4ff; padding: 4px 6px;">
                                    <div style="font-size: 9px; color: #94a3b8;">No Prazo</div>
                                    <div style="font-size: 10.5px; font-weight: 700; color: #38bdf8;">${malotes88NoPrazo} malotes</div>
                                </div>
                            </div>
                        </div>

                        <!-- GRÁFICO 2: SETOR 83 -->
                        <div class="macro-sub-box" style="border-color: rgba(168, 85, 247, 0.2);">
                            <div class="macro-sub-header">
                                <span style="font-size: 10px; font-weight: 800; color: #c084fc; letter-spacing: 0.5px;">SETOR 83 • MALOTES</span>
                                <span class="badge badge-purple" style="font-size: 9px; padding: 1px 5px;">${malotes83Items.length} malotes</span>
                            </div>
                            <svg viewBox="0 0 340 340" class="macro-sub-donut-svg">
                                <g transform="rotate(-90 170 170)">
                                    <circle cx="170" cy="170" r="100" fill="none" stroke="#121624" stroke-width="40" />
                                    ${malotes83Items.length > 0 ? s83Slices.map(s => `
                                        <circle cx="170" cy="170" r="100" fill="none" stroke="${s.color}" stroke-width="40"
                                            stroke-dasharray="${s.dash} ${circ.toFixed(2)}"
                                            stroke-dashoffset="${s.offset}"
                                        />
                                    `).join('') : `
                                        <circle cx="170" cy="170" r="100" fill="none" stroke="#334155" stroke-width="40"
                                            stroke-dasharray="${circ.toFixed(2)} ${circ.toFixed(2)}" stroke-dashoffset="0"
                                        />
                                    `}
                                </g>
                                <text x="170" y="150" text-anchor="middle" dominant-baseline="central" fill="#ffffff" font-size="52" font-weight="900" font-family="system-ui, sans-serif">${malotes83Items.length}</text>
                                <text x="170" y="192" text-anchor="middle" dominant-baseline="central" fill="#c084fc" font-size="11px" font-weight="800" letter-spacing="1px">SETOR 83</text>
                            </svg>
                            <div class="macro-sub-legend">
                                <div class="macro-legend-pill" style="border-left: 2px solid ${malotes83Criticos > 0 ? '#ef4444' : '#10b981'}; padding: 4px 6px;">
                                    <div style="font-size: 9px; color: #94a3b8;">Críticos</div>
                                    <div style="font-size: 10.5px; font-weight: 700; color: ${malotes83Criticos > 0 ? '#f87171' : '#34d399'};">${malotes83Criticos} malotes</div>
                                </div>
                                <div class="macro-legend-pill" style="border-left: 2px solid #00d4ff; padding: 4px 6px;">
                                    <div style="font-size: 9px; color: #94a3b8;">No Prazo</div>
                                    <div style="font-size: 10.5px; font-weight: 700; color: #38bdf8;">${malotes83NoPrazo} malotes</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        `;
    }

    // =========================================================================
    // 1. MÓDULO MODELAGEM - PEDIDOS SETOR 13
    // =========================================================================
    function renderSetor13View(container) {
        // Regras do Usuário:
        // - Exibir em NÚMEROS GRANDES:
        //   1. Quantidade de produtos pendentes no setor 13 (coluna AY) - soma total setor
        //   2. Quantidade total de peças no setor (coluna AP)
        // - GRÁFICO 1: separar por status de modelagem (coluna J)
        // - GRÁFICO 2: separar por semana do pedido (sem coluna informada ainda - semanaPedido)
        // - GRÁFICO 3: separar marca (coluna AC)
        // - GRÁFICO 4: separar por tipo de produto coluna CS
        // - TABELA: codigo do produto (coluna AE) + quantidade de dias no setor (coluna CS),
        //   caso o resultado for mais que 2 grifar em negrito!

        const s13Items = state.allData.filter(r => r.setor === '13');
        const totalItems = s13Items.length;
        const totalPecas = s13Items.reduce((sum, r) => sum + r.qtdeOriginal, 0);
        const criticosDias = s13Items.filter(r => r.diasParado > 2);
        const refUnicas = new Set(s13Items.map(i => i.codigo)).size;

        // 1. Gráfico 1: Status de Modelagem (Coluna: Local Produto) - Com alerta se em branco
        const statusModelagemCounts = {};
        s13Items.forEach(item => {
            const key = (item.statusModelagem || item.descLocal || '').trim() || 'EM BRANCO (NÃO INFORMADO)';
            if (!statusModelagemCounts[key]) {
                statusModelagemCounts[key] = { 
                    count: 0, 
                    pecas: 0, 
                    maxDias: 0, 
                    hasOver2: false, 
                    isEmBranco: key.includes('EM BRANCO') || key.includes('NÃO INFORMADO') 
                };
            }
            statusModelagemCounts[key].count += 1;
            statusModelagemCounts[key].pecas += item.qtdeOriginal;
            if (item.diasParado > statusModelagemCounts[key].maxDias) {
                statusModelagemCounts[key].maxDias = item.diasParado;
            }
            if (item.diasParado > 2) {
                statusModelagemCounts[key].hasOver2 = true;
            }
        });

        // Preparar fatias do Gráfico de Pizza/Donut de Status de Modelagem para Setor 13
        const statusEntries = Object.entries(statusModelagemCounts).sort((a, b) => b[1].count - a[1].count);
        const donutColors = [
            { stroke: '#38bdf8', glow: '#0284c7', name: 'cyan' },
            { stroke: '#ef4444', glow: '#dc2626', name: 'red' },
            { stroke: '#a855f7', glow: '#7c3aed', name: 'purple' },
            { stroke: '#f59e0b', glow: '#d97706', name: 'amber' },
            { stroke: '#10b981', glow: '#059669', name: 'emerald' },
            { stroke: '#ec4899', glow: '#db2777', name: 'pink' },
            { stroke: '#06b6d4', glow: '#0891b2', name: 'teal' }
        ];

        const s13Radius = 150;
        const s13Circ = 2 * Math.PI * s13Radius; // ~691.15
        let s13Offset = 0;
        const s13Slices = statusEntries.map(([key, data], idx) => {
            const isLaranja = isModelagemPendenciaLaranja(key);
            const colorObj = data.isEmBranco 
                ? { stroke: '#fb7185', glow: '#be123c', name: 'rose' } 
                : isLaranja
                    ? { stroke: '#f97316', glow: '#ea580c', name: 'orange' }
                    : isModelagemPendenciaRuim(key)
                        ? { stroke: '#ef4444', glow: '#dc2626', name: 'red' }
                        : { stroke: '#38bdf8', glow: '#0284c7', name: 'cyan' };
            const dash = totalItems > 0 ? (data.count / totalItems) * s13Circ : 0;
            const currentDashOffset = -s13Offset;
            s13Offset += dash;
            return {
                key,
                data,
                color: colorObj.stroke,
                glowColor: colorObj.glow,
                dash: dash.toFixed(2),
                offset: currentDashOffset.toFixed(2),
                isLaranja: isLaranja,
                isRuim: isModelagemPendenciaRuim(key),
                percent: totalItems > 0 ? ((data.count / totalItems) * 100).toFixed(1) : '0'
            };
        });

        // 2. Gráfico 2: Semana do Pedido (Coluna: Ped Desc Período)
        const semanaCounts = {};
        s13Items.forEach(item => {
            const key = (item.semanaPedido || item.pedDescPeriodo || '').trim() || 'Sem Período';
            if (!semanaCounts[key]) {
                semanaCounts[key] = { count: 0, pecas: 0 };
            }
            semanaCounts[key].count += 1;
            semanaCounts[key].pecas += item.qtdeOriginal;
        });

        // 3. Gráfico 3: Marca
        const marcaCounts = {};
        s13Items.forEach(item => {
            const key = (item.marca || item.descMarca || item.codMarca || '').trim() || 'Sem Marca';
            if (!marcaCounts[key]) {
                marcaCounts[key] = { count: 0, pecas: 0 };
            }
            marcaCounts[key].count += 1;
            marcaCounts[key].pecas += item.qtdeOriginal;
        });

        // 4. Gráfico 4: Tipos de Produto (Coluna: Desc Grupo Prod)
        const tipoCounts = {};
        s13Items.forEach(item => {
            const key = (item.tipoProduto || item.descGrupoProd || '').trim() || 'Outros';
            if (!tipoCounts[key]) {
                tipoCounts[key] = { count: 0, pecas: 0 };
            }
            tipoCounts[key].count += 1;
            tipoCounts[key].pecas += item.qtdeOriginal;
        });

        // Filtragem para a grade e tabela detalhada
        let displayItems = s13Items;
        let activeFilterLabel = null;

        if (state.setor13Filter) {
            const { field, value } = state.setor13Filter;
            if (field === 'status') {
                displayItems = s13Items.filter(r => ((r.statusModelagem || r.descLocal || '').trim() || 'EM BRANCO (NÃO INFORMADO)').toLowerCase() === value.toLowerCase());
                activeFilterLabel = `Status de Modelagem: ${value}`;
            } else if (field === 'semana') {
                displayItems = s13Items.filter(r => ((r.semanaPedido || r.pedDescPeriodo || '').trim() || 'Sem Período').toLowerCase() === value.toLowerCase());
                activeFilterLabel = `Semana do Pedido: ${value}`;
            } else if (field === 'marca') {
                displayItems = s13Items.filter(r => ((r.marca || r.descMarca || r.codMarca || '').trim() || 'Sem Marca').toLowerCase() === value.toLowerCase());
                activeFilterLabel = `Marca: ${value}`;
            } else if (field === 'tipo') {
                displayItems = s13Items.filter(r => ((r.tipoProduto || r.descGrupoProd || '').trim() || 'Outros').toLowerCase() === value.toLowerCase());
                activeFilterLabel = `Tipo de Produto: ${value}`;
            }
        }

        // Filtro de Busca em tempo real
        if (state.setor13Search && state.setor13Search.trim().length > 0) {
            const q = state.setor13Search.trim().toLowerCase();
            displayItems = displayItems.filter(r => 
                (r.codigo || '').toLowerCase().includes(q) ||
                (r.op || '').toLowerCase().includes(q) ||
                (r.marca || '').toLowerCase().includes(q) ||
                (r.etiqueta || '').toLowerCase().includes(q) ||
                (r.progAmostras || '').toLowerCase().includes(q) ||
                (r.tipoProduto || '').toLowerCase().includes(q) ||
                (r.statusModelagem || '').toLowerCase().includes(q) ||
                (r.descricao || '').toLowerCase().includes(q) ||
                (r.cliente || '').toLowerCase().includes(q)
            );
        }

        const viewMode = state.setor13ViewMode || 'grid';

        container.innerHTML = `
            <!-- CABEÇALHO DO MÓDULO -->
            <div class="module-view-header">
                <div class="module-view-title-group">
                    <h2>Módulo Modelagem: Setor 13 (Pedidos Pendentes)</h2>
                    <p class="module-view-description">Painel executivo com fotos dos produtos (4 por linha), contagem de produtos pendentes no setor, total de peças e gráficos analíticos.</p>
                </div>
                <div class="btn-group">
                    <span class="badge badge-cyan" style="font-size: 12px; padding: 6px 14px;">Setor 13 Ativo</span>
                    ${criticosDias.length > 0 ? `
                        <span class="dias-azul-piscando" style="font-size: 11px; padding: 5px 12px;">
                            <i class="fa-solid fa-triangle-exclamation"></i> ${criticosDias.length} com > 2 dias
                        </span>
                    ` : ''}
                </div>
            </div>

            <!-- 1. MÉTRICAS EM NÚMEROS GRANDES (SOLICITADO PELO USUÁRIO) -->
            <div class="kpi-grid" style="grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); margin-bottom: 24px;">
                <!-- KPI 1: Quantidade de Produtos Pendentes no Setor 13 -->
                <div class="kpi-card cyan" style="border-color: rgba(56, 189, 248, 0.45); background: linear-gradient(135deg, rgba(14, 165, 233, 0.12) 0%, rgba(13, 16, 26, 0.9) 100%);">
                    <div class="kpi-header">
                        <span class="kpi-label" style="color: #38bdf8; font-weight: 800; letter-spacing: 0.5px;">PRODUTOS PENDENTES (SETOR 13)</span>
                        <div class="kpi-icon" style="color: #38bdf8;"><i class="fa-solid fa-boxes-stacked"></i></div>
                    </div>
                    <div class="kpi-value" style="font-size: 44px; font-weight: 900; color: #ffffff; line-height: 1.1;">
                        ${totalItems} <span style="font-size: 16px; font-weight: 700; color: #38bdf8;">produtos</span>
                    </div>
                    <div class="kpi-footer">
                        <span style="font-weight: 600; color: var(--text-secondary);">Soma total do setor 13 • ${refUnicas} referências únicas</span>
                    </div>
                </div>

                <!-- KPI 2: Quantidade Total de Peças no Setor -->
                <div class="kpi-card emerald" style="border-color: rgba(16, 185, 129, 0.45); background: linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(13, 16, 26, 0.9) 100%);">
                    <div class="kpi-header">
                        <span class="kpi-label" style="color: #10b981; font-weight: 800; letter-spacing: 0.5px;">TOTAL DE PEÇAS NO SETOR</span>
                        <div class="kpi-icon" style="color: #10b981;"><i class="fa-solid fa-shirt"></i></div>
                    </div>
                    <div class="kpi-value" style="font-size: 44px; font-weight: 900; color: #10b981; line-height: 1.1;">
                        ${formatNumber(totalPecas)} <span style="font-size: 16px; font-weight: 700; color: #6ee7b7;">peças</span>
                    </div>
                    <div class="kpi-footer">
                        <span style="font-weight: 600; color: var(--text-secondary);">Volume total acumulado de peças da grade</span>
                    </div>
                </div>

                <!-- KPI 3: Produtos com Pendência > 2 Dias -->
                <div class="kpi-card ${criticosDias.length > 0 ? 'alerta-azul-piscando' : 'purple'}">
                    <div class="kpi-header">
                        <span class="kpi-label" style="font-weight: 800; letter-spacing: 0.5px;">PENDÊNCIA > 2 DIAS</span>
                        <div class="kpi-icon"><i class="fa-solid fa-clock"></i></div>
                    </div>
                    <div class="kpi-value" style="font-size: 44px; font-weight: 900; color: ${criticosDias.length > 0 ? '#38bdf8' : '#ffffff'}; line-height: 1.1;">
                        ${criticosDias.length} <span style="font-size: 16px; font-weight: 600; color: var(--text-muted);">produtos</span>
                    </div>
                    <div class="kpi-footer">
                        ${criticosDias.length > 0 ? 
                            `<span class="dias-azul-piscando" style="font-weight: 700;"><i class="fa-solid fa-fire"></i> Atenção prioritária no fluxo (> 2 dias)</span>` : 
                            `<span style="color: var(--accent-emerald); font-weight: 600;"><i class="fa-solid fa-circle-check"></i> Todos no fluxo rápido (até 2 dias)</span>`
                        }
                    </div>
                </div>

                <!-- KPI 4: Diversidade Ativa -->
                <div class="kpi-card amber">
                    <div class="kpi-header">
                        <span class="kpi-label" style="font-weight: 800; letter-spacing: 0.5px;">DIVERSIDADE NO SETOR</span>
                        <div class="kpi-icon"><i class="fa-solid fa-tags"></i></div>
                    </div>
                    <div class="kpi-value" style="font-size: 44px; font-weight: 900; color: #f59e0b; line-height: 1.1;">
                        ${Object.keys(marcaCounts).length} <span style="font-size: 16px; font-weight: 600; color: var(--text-muted);">marcas</span>
                    </div>
                    <div class="kpi-footer">
                        <span style="font-weight: 600; color: var(--text-secondary);">${Object.keys(tipoCounts).length} tipos de produto (Desc Grupo Prod)</span>
                    </div>
                </div>
            </div>

            <!-- 2. OS 4 GR�FICOS SOLICITADOS -->
            <div class="analytics-grid" style="display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 18px; margin-bottom: 24px; min-width: 0;">
                <!-- GRÁFICO 1: Separar por Status de Modelagem (GRÁFICO DE PIZZA/DONUT GRANDE) -->
                <div class="panel-card" style="border-top: 3px solid #38bdf8; display: flex; flex-direction: column;">
                    <div class="panel-header" style="margin-bottom: 12px;">
                        <div>
                            <h3 class="panel-title" style="color: var(--text-primary); font-size: 14px; font-weight: 800;">
                                <i class="fa-solid fa-chart-pie" style="color: #38bdf8;"></i> Gráfico 1: Status de Modelagem (Pizza)
                            </h3>
                            <p style="font-size: 11.5px; color: var(--text-muted); margin: 2px 0 0 0;">Fases do fluxo de modelagem no Setor 13</p>
                        </div>
                        <span class="badge badge-cyan">${statusEntries.length} fases</span>
                    </div>

                    <!-- CONTAINER DO GRÁFICO DE PIZZA/DONUT SVG GRANDE -->
                    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 6px 0 14px 0;">
                        <svg viewBox="0 0 440 440" style="width: 100%; max-width: 440px; height: auto; overflow: visible; margin: 0 auto; filter: drop-shadow(0 8px 16px rgba(0,0,0,0.5));">
                            <defs>
                                <filter id="s13GlowBlue" x="-30%" y="-30%" width="160%" height="160%">
                                    <feDropShadow dx="0" dy="0" stdDeviation="12" flood-color="#38bdf8" flood-opacity="0.65"/>
                                </filter>
                                <filter id="s13GlowRed" x="-30%" y="-30%" width="160%" height="160%">
                                    <feDropShadow dx="0" dy="0" stdDeviation="14" flood-color="#ef4444" flood-opacity="0.9"/>
                                </filter>
                                <filter id="s13GlowOrange" x="-30%" y="-30%" width="160%" height="160%">
                                    <feDropShadow dx="0" dy="0" stdDeviation="14" flood-color="#f97316" flood-opacity="0.9"/>
                                </filter>
                            </defs>
                            <g transform="rotate(-90 220 220)">
                                <!-- Trilha de fundo -->
                                <circle cx="220" cy="220" r="${s13Radius}" fill="none" stroke="#121624" stroke-width="58" />

                                <!-- Fatias Din�micas do Donut -->
                                ${totalItems === 0 ? `
                                    <circle cx="220" cy="220" r="${s13Radius}" fill="none" stroke="#1e293b" stroke-width="58" />
                                ` : s13Slices.map(sl => `
                                    <circle cx="220" cy="220" r="${s13Radius}" fill="none" stroke="${sl.color}" stroke-width="58"
                                        stroke-dasharray="${sl.dash} ${s13Circ.toFixed(2)}"
                                        stroke-dashoffset="${sl.offset}"
                                        filter="${sl.isLaranja ? 'url(#s13GlowOrange)' : sl.isRuim ? 'url(#s13GlowRed)' : 'url(#s13GlowBlue)'}"
                                        style="transition: all 0.6s ease;" />
                                `).join('')}
                            </g>
                            <!-- Texto Central Alinhado em Destaque -->
                            <text x="220" y="190" text-anchor="middle" dominant-baseline="central" fill="#ffffff" font-size="76" font-weight="900" font-family="system-ui, -apple-system, sans-serif" letter-spacing="-2px">${totalItems}</text>
                            <text x="220" y="246" text-anchor="middle" dominant-baseline="central" fill="#94a3b8" font-size="14" font-weight="800" letter-spacing="3px" font-family="system-ui, -apple-system, sans-serif">PRODUTOS</text>
                            <text x="220" y="272" text-anchor="middle" dominant-baseline="central" fill="#38bdf8" font-size="13" font-weight="800" letter-spacing="1.5px" font-family="system-ui, -apple-system, sans-serif">SETOR 13</text>
                        </svg>
                    </div>

                    <!-- LEGENDA INTERATIVA COM FILTROS -->
                    <div class="dist-list" style="margin-top: auto; border-top: 1px solid rgba(255, 255, 255, 0.06); padding-top: 12px;">
                        ${statusEntries.length === 0 ? `
                            <div style="color: var(--text-muted); font-size: 12px; padding: 12px; text-align: center;">Nenhum produto pendente.</div>
                        ` : s13Slices.map(sl => {
                            const isSelected = state.setor13Filter && state.setor13Filter.field === 'status' && state.setor13Filter.value === sl.key;
                            const escaped = sl.key.replace(/'/g, "\\'");
                            const isBlank = sl.data.isEmBranco;
                            return `
                                <div class="dist-item" style="cursor: pointer; padding: 7px 10px; border-radius: 8px; margin-bottom: 6px; transition: all 0.15s ease; background: ${isSelected ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255, 255, 255, 0.02)'}; border: 1px solid ${isSelected ? '#38bdf8' : 'rgba(255, 255, 255, 0.05)'};" onclick="window.crmFilterSetor13('status', '${escaped}')" title="Clique para filtrar por: ${sl.key}">
                                    <div class="dist-meta" style="margin-bottom: 0;">
                                        <div style="display: flex; align-items: center; gap: 8px; max-width: 60%; overflow: hidden;">
                                            <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: ${sl.color}; flex-shrink: 0; box-shadow: 0 0 6px ${sl.color};"></span>
                                            <span class="dist-name" style="font-weight: 700; color: ${isBlank ? '#fb7185' : '#ffffff'}; font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                                                ${isBlank ? '<i class="fa-solid fa-triangle-exclamation" style="color: #fb7185; margin-right: 4px;"></i>' : ''}${sl.key}
                                            </span>
                                            ${sl.data.hasOver2 ? `
                                                <span class="dias-azul-piscando" style="font-size: 9px; padding: 1px 5px; flex-shrink: 0;">
                                                    <i class="fa-solid fa-clock"></i> > 2 DIAS
                                                </span>
                                            ` : ''}
                                        </div>
                                        <div style="text-align: right; flex-shrink: 0;">
                                            <span class="dist-count" style="font-weight: 700; color: ${sl.color}; font-size: 12px;">${sl.data.count} prod (${sl.percent}%)</span>
                                            <div style="font-size: 10.5px; color: var(--text-muted);">${formatNumber(sl.data.pecas)} pçs</div>
                                        </div>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>

                <!-- GRÁFICO 2: Separar por Semana do Pedido (Coluna: Ped Desc Período) -->
                <div class="panel-card" style="border-top: 3px solid #a855f7;">
                    <div class="panel-header">
                        <div>
                            <h3 class="panel-title" style="color: var(--text-primary); font-size: 14px; font-weight: 800;">
                                <i class="fa-solid fa-calendar-days" style="color: #a855f7;"></i> Gráfico 2: Semana do Pedido (Ped Desc Período)
                            </h3>
                            <p style="font-size: 11.5px; color: var(--text-muted); margin: 2px 0 0 0;">Cronograma e distribuição de entrega dos pedidos</p>
                        </div>
                        <span class="badge badge-purple">${Object.keys(semanaCounts).length} semanas</span>
                    </div>
                    <div class="dist-list">
                        ${Object.entries(semanaCounts).length === 0 ? `
                            <div style="color: var(--text-muted); font-size: 12px; padding: 12px; text-align: center;">Nenhuma semana informada.</div>
                        ` : Object.entries(semanaCounts).sort((a, b) => b[1].count - a[1].count).map(([key, data]) => {
                            const percent = totalItems > 0 ? Math.round((data.count / totalItems) * 100) : 0;
                            const isSelected = state.setor13Filter && state.setor13Filter.field === 'semana' && state.setor13Filter.value === key;
                            const escaped = key.replace(/'/g, "\\'");
                            return `
                                <div class="dist-item" style="cursor: pointer; padding: 6px 8px; border-radius: 6px; transition: all 0.15s ease; ${isSelected ? 'background: rgba(168, 85, 247, 0.15); outline: 1px solid #a855f7;' : ''}" onclick="window.crmFilterSetor13('semana', '${escaped}')" title="Clique para filtrar por: ${key}">
                                    <div class="dist-meta" style="margin-bottom: 5px;">
                                        <span class="dist-name" style="font-weight: 700; color: #ffffff;">${key}</span>
                                        <span class="dist-count" style="font-weight: 700; color: #c084fc;">${data.count} prod (${percent}%) • ${formatNumber(data.pecas)} pçs</span>
                                    </div>
                                    <div class="dist-bar-track" style="height: 6px;">
                                        <div class="dist-bar-fill" style="width: ${percent}%; background: linear-gradient(90deg, #7c3aed, #a855f7);"></div>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>

                <!-- COLUNA PARA GR�FICOS 3 E 4 -->
                <div style="display: flex; flex-direction: column; gap: 18px; min-width: 0;">
                    <!-- GRÁFICO 3: Separar por Marca -->
                <div class="panel-card" style="border-top: 3px solid #f59e0b;">
                    <div class="panel-header">
                        <div>
                            <h3 class="panel-title" style="color: var(--text-primary); font-size: 14px; font-weight: 800;">
                                <i class="fa-solid fa-tags" style="color: #f59e0b;"></i> Gráfico 3: Marca
                            </h3>
                            <p style="font-size: 11.5px; color: var(--text-muted); margin: 2px 0 0 0;">Volume de produtos e peças agrupados por marca</p>
                        </div>
                        <span class="badge badge-amber">${Object.keys(marcaCounts).length} marcas</span>
                    </div>
                    <div class="dist-list">
                        ${Object.entries(marcaCounts).length === 0 ? `
                            <div style="color: var(--text-muted); font-size: 12px; padding: 12px; text-align: center;">Nenhuma marca informada.</div>
                        ` : Object.entries(marcaCounts).sort((a, b) => b[1].count - a[1].count).map(([key, data]) => {
                            const percent = totalItems > 0 ? Math.round((data.count / totalItems) * 100) : 0;
                            const isSelected = state.setor13Filter && state.setor13Filter.field === 'marca' && state.setor13Filter.value === key;
                            const escaped = key.replace(/'/g, "\\'");
                            return `
                                <div class="dist-item" style="cursor: pointer; padding: 6px 8px; border-radius: 6px; transition: all 0.15s ease; ${isSelected ? 'background: rgba(245, 158, 11, 0.15); outline: 1px solid #f59e0b;' : ''}" onclick="window.crmFilterSetor13('marca', '${escaped}')" title="Clique para filtrar por: ${key}">
                                    <div class="dist-meta" style="margin-bottom: 5px;">
                                        <span class="dist-name" style="font-weight: 700; color: #ffffff;">${key}</span>
                                        <span class="dist-count" style="font-weight: 700; color: #fbbf24;">${data.count} prod (${percent}%) • ${formatNumber(data.pecas)} pçs</span>
                                    </div>
                                    <div class="dist-bar-track" style="height: 6px;">
                                        <div class="dist-bar-fill" style="width: ${percent}%; background: linear-gradient(90deg, #d97706, #f59e0b);"></div>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>

                <!-- GRÁFICO 4: Separar por Tipo de Produto (Coluna: Desc Grupo Prod) -->
                <div class="panel-card" style="border-top: 3px solid #ec4899;">
                    <div class="panel-header">
                        <div>
                            <h3 class="panel-title" style="color: var(--text-primary); font-size: 14px; font-weight: 800;">
                                <i class="fa-solid fa-layer-group" style="color: #ec4899;"></i> Gráfico 4: Tipo de Produto (Desc Grupo Prod)
                            </h3>
                            <p style="font-size: 11.5px; color: var(--text-muted); margin: 2px 0 0 0;">Classificação dos produtos por grupo/artigo</p>
                        </div>
                        <span class="badge badge-pink" style="background: rgba(236, 72, 153, 0.15); color: #f472b6; border: 1px solid rgba(236, 72, 153, 0.3); font-weight: 600;">${Object.keys(tipoCounts).length} tipos</span>
                    </div>
                    <div class="dist-list">
                        ${Object.entries(tipoCounts).length === 0 ? `
                            <div style="color: var(--text-muted); font-size: 12px; padding: 12px; text-align: center;">Nenhum tipo informado.</div>
                        ` : Object.entries(tipoCounts).sort((a, b) => b[1].count - a[1].count).map(([key, data]) => {
                            const percent = totalItems > 0 ? Math.round((data.count / totalItems) * 100) : 0;
                            const isSelected = state.setor13Filter && state.setor13Filter.field === 'tipo' && state.setor13Filter.value === key;
                            const escaped = key.replace(/'/g, "\\'");
                            return `
                                <div class="dist-item" style="cursor: pointer; padding: 6px 8px; border-radius: 6px; transition: all 0.15s ease; ${isSelected ? 'background: rgba(236, 72, 153, 0.15); outline: 1px solid #ec4899;' : ''}" onclick="window.crmFilterSetor13('tipo', '${escaped}')" title="Clique para filtrar por: ${key}">
                                    <div class="dist-meta" style="margin-bottom: 5px;">
                                        <span class="dist-name" style="font-weight: 700; color: #ffffff;">${key}</span>
                                        <span class="dist-count" style="font-weight: 700; color: #f472b6;">${data.count} prod (${percent}%) • ${formatNumber(data.pecas)} pçs</span>
                                    </div>
                                    <div class="dist-bar-track" style="height: 6px;">
                                        <div class="dist-bar-fill" style="width: ${percent}%; background: linear-gradient(90deg, #db2777, #ec4899);"></div>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
                </div>
            </div>

            <!-- 3. GRADE VISUAL DE PRODUTOS COM FOTOS (4 POR LINHA - SOLICITADO PELO USUÁRIO) -->
            <div class="table-card" id="setor13TableSection">
                <div class="s13-gallery-toolbar pdf-screen-controls">
                    <div class="table-title-group">
                        <h3 class="table-title" style="display: flex; align-items: center; gap: 8px;">
                            <i class="fa-solid fa-images" style="color: #38bdf8;"></i> Modelagens & Produtos do Setor 13
                        </h3>
                        <span class="badge badge-sub">${displayItems.length} de ${totalItems} produtos</span>
                    </div>

                    <div style="display: flex; align-items: center; flex-wrap: wrap; gap: 10px;">
                        <!-- Barra de Pesquisa Rápida -->
                        <div class="s13-search-box">
                            <i class="fa-solid fa-magnifying-glass" style="color: var(--text-muted); font-size: 12px;"></i>
                            <input type="text" placeholder="Buscar por código, OP, etiqueta, marca..." value="${escapeHtml(state.setor13Search || '')}" oninput="window.crmSearchSetor13(this.value)">
                            ${state.setor13Search ? `
                                <i class="fa-solid fa-xmark" style="cursor: pointer; color: var(--text-muted);" onclick="window.crmSearchSetor13('')" title="Limpar busca"></i>
                            ` : ''}
                        </div>

                        <!-- Alternador de Visualização -->
                        <div class="btn-group" style="background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 8px; padding: 2px;">
                            <button class="toolbar-pill-btn ${viewMode === 'grid' ? 'active' : ''}" style="border: none; border-radius: 6px; padding: 5px 12px; font-size: 11.5px;" onclick="window.crmToggleSetor13ViewMode('grid')" title="Visualização em Grade de Fotos (4 por linha)">
                                <i class="fa-solid fa-table-cells" style="color: #38bdf8;"></i> Fotos (4/linha)
                            </button>
                            <button class="toolbar-pill-btn ${viewMode === 'table' ? 'active' : ''}" style="border: none; border-radius: 6px; padding: 5px 12px; font-size: 11.5px;" onclick="window.crmToggleSetor13ViewMode('table')" title="Visualização em Tabela">
                                <i class="fa-solid fa-table-list"></i> Tabela
                            </button>
                        </div>

                        ${activeFilterLabel ? `
                            <button class="filter-clear-btn" onclick="window.crmFilterSetor13(null)" title="Limpar filtro ativo">
                                <i class="fa-solid fa-xmark"></i> Limpar Filtro
                            </button>
                        ` : ''}
                        <button class="toolbar-pill-btn btn-sync-images-action" onclick="window.crmSyncImages()" title="Sincronizar fotos do Google Drive agora" style="border-color: rgba(56, 189, 248, 0.4); color: #38bdf8;">
                            <i class="fa-solid fa-arrows-rotate" style="color: #38bdf8;"></i> Sincronizar Fotos
                        </button>
                        <button class="toolbar-pill-btn btn-export-pdf" onclick="window.crmGeneratePDFReport()" title="Gerar Relatório em PDF">
                            <i class="fa-solid fa-file-pdf" style="color: #ef4444;"></i> Gerar PDF
                        </button>
                        <button class="toolbar-pill-btn" onclick="window.crmExportFilteredCSV()">
                            <i class="fa-solid fa-download"></i> CSV
                        </button>
                    </div>
                </div>

                <!-- Banner Informativo de Filtro Ativo -->
                ${activeFilterLabel ? `
                    <div class="filter-active-banner">
                        <div class="filter-active-text">
                            <i class="fa-solid fa-filter"></i>
                            <span>Exibindo <strong>${displayItems.length} produtos</strong> filtrados por: <strong>${activeFilterLabel}</strong></span>
                        </div>
                        <button class="filter-clear-btn" onclick="window.crmFilterSetor13(null)">
                            <i class="fa-solid fa-xmark"></i> Remover Filtro (Exibir Todos os ${totalItems})
                        </button>
                    </div>
                ` : ''}

                ${displayItems.length === 0 ? `
                    <div style="text-align: center; padding: 48px 20px; color: var(--text-muted); background: rgba(0, 0, 0, 0.2); border-radius: 12px; margin-top: 12px;">
                        <i class="fa-solid fa-boxes-stacked" style="font-size: 38px; color: rgba(255,255,255,0.15); margin-bottom: 12px;"></i>
                        <p style="font-size: 14px; font-weight: 600; color: #ffffff;">Nenhum produto encontrado no Setor 13</p>
                        <p style="font-size: 12px; margin-top: 4px;">Tente limpar os filtros ou alterar os termos da busca.</p>
                    </div>
                ` : viewMode === 'grid' ? `
                    <!-- GRADE VISUAL 4 POR LINHA COM FOTOS -->
                    <div class="s13-photo-grid">
                        ${displayItems.map(item => {
                            const hasOver2 = item.diasParado > 2;
                            const isAtraso = item.prazoStatus === 'ATRASO';
                            const imgInfo = getProductImage(item.codigo);
                            const escapedDesc = (item.descricao || 'Produto').replace(/'/g, "\\'");
                            const escapedCode = (item.codigo || '').replace(/'/g, "\\'");

                            return `
                                <div class="s13-photo-card ${hasOver2 ? 'card-critico' : ''}">
                                    <!-- ÁREA DA FOTO -->
                                    <div class="s13-photo-wrapper">
                                        ${imgInfo.hasImage ? `
                                            <img src="${imgInfo.thumbUrl}" loading="lazy" class="s13-photo-img" alt="${item.codigo}" onerror="this.onerror=null; this.src='${imgInfo.proxyUrl}';">
                                            <div class="s13-photo-overlay" onclick="window.crmOpenImageLightbox('${imgInfo.largeUrl}', '${escapedCode}', 'OP ${item.op} • ${escapedDesc}')">
                                                <i class="fa-solid fa-magnifying-glass-plus" style="font-size: 24px; color: #38bdf8;"></i>
                                                <span>Ampliar Foto</span>
                                            </div>
                                            <span class="s13-photo-tag" title="Foto vinculada do Google Drive">
                                                <i class="fa-brands fa-google-drive" style="color: #34d399;"></i> Foto Drive
                                            </span>
                                        ` : `
                                            <div class="s13-photo-placeholder" onclick="window.crmOpenOpModal('${item.op}')" title="Clique para detalhes da OP">
                                                <i class="fa-solid fa-shirt s13-placeholder-icon"></i>
                                                <strong style="color: #cbd5e1; font-size: 13.5px; font-family: monospace;">${item.codigo}</strong>
                                                <span style="font-size: 10.5px; color: var(--text-muted);"><i class="fa-solid fa-camera-retro"></i> Aguardando foto na pasta</span>
                                            </div>
                                        `}
                                    </div>

                                    <!-- CORPO DO CARD COM INFORMAÇÕES COMPLETAS -->
                                    <div class="s13-card-body">
                                        <!-- Linha 1: Código e OP -->
                                        <div class="s13-card-code-row">
                                            <div class="s13-card-code" title="Código do Produto">${item.codigo}</div>
                                            <span class="s13-card-op-badge" title="Ordem de Produção">OP ${item.op}</span>
                                        </div>

                                        <!-- Linha 2: Descrição -->
                                        <div class="s13-card-description" title="${item.descricao}">
                                            ${item.descricao || 'Produto sem descrição cadastrada'}
                                        </div>

                                        <!-- Linha 3: Quantidade de Dias no Setor com Destaque > 2 Dias -->
                                        <div style="margin-top: 4px;">
                                            ${hasOver2 ? `
                                                <div class="s13-dias-badge critico" title="Produto parado há mais de 2 dias no Setor 13">
                                                    <i class="fa-solid fa-fire"></i>
                                                    <strong>${item.diasParado} dias</strong> • crítico
                                                </div>
                                            ` : `
                                                <div class="s13-dias-badge normal">
                                                    <i class="fa-solid fa-clock"></i>
                                                    <strong>${item.diasParado} ${item.diasParado === 1 ? 'dia' : 'dias'} no setor</strong>
                                                </div>
                                            `}
                                        </div>

                                        <!-- Linha 4: Status de Modelagem (Coluna: Local Produto) -->
                                        <div style="margin-top: 2px;">
                                            ${renderStatusModelagemBadge(item.statusModelagem || item.descLocal)}
                                        </div>

                                        <!-- Linha 5: Metadados essenciais; os campos complementares ficam no modo tabela. -->
                                        <div class="s13-card-meta-grid" style="grid-template-columns: repeat(2, 1fr); gap: 6px;"><div class="s13-meta-item">
            <span class="s13-meta-label">OC / RIS</span>
            ${(item.oc || '').trim().toUpperCase().startsWith('S') || !(item.oc || '').trim() ? `<span class="s13-meta-val" style="color: #f97316; font-weight: 800; background: rgba(249,115,22,0.15); padding: 1px 4px; border-radius: 4px;">SEM OC</span>` : `<span class="s13-meta-val" style="color: #94a3b8; font-weight: 700;"><i class="fa-solid fa-file-invoice" style="margin-right:4px;"></i>${item.oc}</span>`}
        </div>
                                            <div class="s13-meta-item">
                                                <span class="s13-meta-label">Prog. Amostra</span>
                                                <span class="s13-meta-val" style="color: #c084fc;" title="${item.progAmostras || '—'}">${item.progAmostras || '—'}</span>
                                            </div>
                                            <div class="s13-meta-item">
                                                <span class="s13-meta-label">Semana Ped.</span>
                                                <span class="s13-meta-val" style="color: #38bdf8;" title="${item.semanaPedido || '—'}">${item.semanaPedido || '—'}</span>
                                            </div>
                                            <div class="s13-meta-item">
                                                <span class="s13-meta-label">Total Peças</span>
                                                <span class="s13-meta-val" style="color: #34d399;">${formatNumber(item.qtdeOriginal)} pçs</span>
                                            </div>
                                        </div>

                                        <!-- Linha 6: Botões de Ação -->
                                        <div class="s13-card-actions">
                                            <button class="s13-btn-action primary" onclick="window.crmOpenOpModal('${item.op}')" title="Ver Detalhes 360° da OP">
                                                <i class="fa-solid fa-circle-info"></i> Detalhes OP
                                            </button>
                                            ${imgInfo.hasImage ? `
                                                <button class="s13-btn-action" onclick="window.crmOpenImageLightbox('${imgInfo.largeUrl}', '${escapedCode}', 'OP ${item.op} • ${escapedDesc}')" title="Ampliar Imagem">
                                                    <i class="fa-solid fa-eye"></i> Foto
                                                </button>
                                                <a href="${imgInfo.driveUrl}" target="_blank" class="s13-btn-action" style="flex: 0 0 30px;" title="Abrir arquivo no Google Drive">
                                                    <i class="fa-brands fa-google-drive" style="color: #34d399;"></i>
                                                </a>
                                            ` : ''}
                                        </div>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                ` : `
                    <!-- MODO TABELA DETALHADA -->
                    <div class="table-responsive">
                        <table class="crm-table">
                            <thead>
                                <tr>
                                    <th style="width: 60px;">Foto</th>
                                    <th>OP</th>
                                    <th>Código do Produto</th>
                                    <th>Dias no Setor</th>
                                    <th>Status Modelagem (Descrição do Local)</th>
                                    <th>Etiqueta</th>
                                    <th>Prog. Amostra</th>
                                    <th>Semana do Pedido</th>
                                    <th>Tipo de Produto</th>
                                    <th>Marca</th>
                                    <th>Peças</th>
                                    <th>Cliente</th>
                                    <th>Prazo Geral</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${displayItems.map(item => {
                                    const isAtraso = item.prazoStatus === 'ATRASO';
                                    const hasOver2 = item.diasParado > 2;
                                    const imgInfo = getProductImage(item.codigo);
                                    const escapedDesc = (item.descricao || 'Produto').replace(/'/g, "\\'");
                                    const escapedCode = (item.codigo || '').replace(/'/g, "\\'");

                                    return `
                                        <tr class="${isAtraso ? 'row-danger' : ''}" onclick="window.crmOpenOpModal('${item.op}')" style="cursor: pointer; ${hasOver2 ? 'background: rgba(14, 165, 233, 0.04);' : ''}" title="Clique para abrir detalhes 360° da OP ${item.op}">
                                            <td style="text-align: center; padding: 6px;">
                                                ${imgInfo.hasImage ? `
                                                    <img src="${imgInfo.thumbUrl}" onclick="event.stopPropagation(); window.crmOpenImageLightbox('${imgInfo.largeUrl}', '${escapedCode}', 'OP ${item.op}')" style="width: 42px; height: 42px; object-fit: cover; border-radius: 6px; border: 1px solid rgba(255,255,255,0.15); cursor: pointer;" title="Clique para ampliar a foto" alt="${item.codigo}">
                                                ` : `
                                                    <div style="width: 42px; height: 42px; border-radius: 6px; background: rgba(255,255,255,0.05); display: flex; align-items: center; justify-content: center; color: var(--text-muted); font-size: 14px;">
                                                        <i class="fa-solid fa-shirt"></i>
                                                    </div>
                                                `}
                                            </td>
                                            <td class="table-op-cell">
                                                <span style="font-weight: 700; color: #38bdf8;">${item.op}</span>
                                            </td>
                                            <td>
                                                <div class="table-prod-cell">
                                                    <strong style="color: #38bdf8; font-size: 13.5px; font-weight: 800; font-family: monospace;">${item.codigo}</strong>
                                                    <span class="prod-name" title="${item.descricao}" style="font-size: 12px; color: var(--text-secondary);">${item.descricao || 'PRODUTO'}</span>
                                                </div>
                                            </td>
                                            <td>
                                                ${hasOver2 ? `
                                                    <strong class="dias-azul-piscando" style="font-weight: 900; font-size: 13.5px; display: inline-flex; align-items: center; gap: 6px;">
                                                        <i class="fa-solid fa-clock"></i> ${item.diasParado} DIAS PENDENTE
                                                    </strong>
                                                ` : `
                                                    <strong style="font-weight: 600; color: var(--text-primary); font-size: 13px;">
                                                        ${item.diasParado} ${item.diasParado === 1 ? 'dia' : 'dias'}
                                                    </strong>
                                                `}
                                            </td>
                                            <td>${renderStatusModelagemBadge(item.statusModelagem || item.descLocal)}</td>
                                            <td><span class="badge badge-sub" style="color: #60a5fa; font-weight: 700;">${item.etiqueta || '—'}</span></td>
                                            <td><span class="badge badge-purple">${item.progAmostras || '—'}</span></td>
                                            <td><strong style="color: #c084fc;">${item.semanaPedido || '—'}</strong></td>
                                            <td><span class="badge badge-pink" style="background: rgba(236, 72, 153, 0.15); color: #f472b6; border: 1px solid rgba(236, 72, 153, 0.3); font-weight: 600;">${item.tipoProduto || '—'}</span></td>
                                            <td><span class="badge badge-amber">${item.marca || '—'}</span></td>
                                            <td style="font-weight: 800; color: var(--text-primary); font-size: 13px;">${formatNumber(item.qtdeOriginal)}</td>
                                            <td>${item.cliente || '—'}</td>
                                            <td>
                                                ${isAtraso ? 
                                                    '<span class="badge badge-rose"><i class="fa-solid fa-clock"></i> Em Atraso</span>' : 
                                                    '<span class="badge badge-emerald"><i class="fa-solid fa-check"></i> No Prazo</span>'
                                                }
                                            </td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                `}
            </div>
        `;
    }

    // =========================================================================
    // 2. MÓDULO MODELAGEM - PEDIDOS EM PROCESSO (05, 06, 12)
    // =========================================================================
    function renderProcessoView(container) {
        // Regra do Usuário:
        // - produtos pendentes nos setores 05, 06, 12 (coluna AY)
        // - Métrica principal: quantos produtos pendentes separados por STATUS BONS e STATUS RUINS.
        // - ENFATIZAR com GRÁFICO GRANDE PRINCIPAL DE "PIZZA" (donut/pie 50%/50%).
        // - Mais abaixo, ANTES da lista/tabela: fotos dos produtos com pendência de modelagem (4 por linha, formato Sit Estampa / Setor 13)
        // - Destaque claro de QUAL SETOR o produto está pendente na foto (Setor 05, 06 ou 12)!
        // - Produtos liberados/status bons trazidos na tabela logo abaixo.
        const allProcItems = state.filteredData.filter(r => ['05', '06', '12', '5', '6'].includes(r.setor));
        const totalItems = allProcItems.length;
        const totalPecas = allProcItems.reduce((sum, r) => sum + r.qtdeOriginal, 0);

        // Distribuição por Setor
        const setorCounts = countBy(allProcItems, 'setor');

        // Agrupamento executivo por Status de Modelagem (Descrição do Local)
        const statusMap = {};
        allProcItems.forEach(item => {
            const st = (item.statusModelagem || item.descLocal || '').trim() || 'EM BRANCO (NÃO INFORMADO)';
            if (!statusMap[st]) {
                statusMap[st] = {
                    name: st,
                    isRuim: isModelagemPendenciaRuim(st),
                    count: 0,
                    pecas: 0,
                    maxDias: 0,
                    setores: { '05': 0, '06': 0, '12': 0 },
                    items: []
                };
            }
            statusMap[st].count += 1;
            statusMap[st].pecas += item.qtdeOriginal;
            const sKey = item.setor === '5' ? '05' : item.setor === '6' ? '06' : item.setor;
            if (statusMap[st].setores[sKey] !== undefined) {
                statusMap[st].setores[sKey] += 1;
            }
            statusMap[st].items.push(item);
            if (item.diasParado > statusMap[st].maxDias) statusMap[st].maxDias = item.diasParado;
        });

        const allStatuses = Object.values(statusMap);
        const ruinsList = allStatuses.filter(s => s.isRuim).sort((a, b) => b.count - a.count);
        const bonsList = allStatuses.filter(s => !s.isRuim).sort((a, b) => b.count - a.count);

        const ruinsCount = ruinsList.reduce((acc, s) => acc + s.count, 0);
        const ruinsPecas = ruinsList.reduce((acc, s) => acc + s.pecas, 0);
        const ruinsPct = totalItems > 0 ? ((ruinsCount / totalItems) * 100).toFixed(1) : '0';

        const bonsCount = bonsList.reduce((acc, s) => acc + s.count, 0);
        const bonsPecas = bonsList.reduce((acc, s) => acc + s.pecas, 0);
        const bonsPct = totalItems > 0 ? ((bonsCount / totalItems) * 100).toFixed(1) : '0';

        // Geometria para o Gráfico de Pizza SVG (Donut Gigante conforme Mockup 440x440)
        const radius = 150;
        const circumference = 2 * Math.PI * radius; // ~942.48
        const bonsDash = totalItems > 0 ? (bonsCount / totalItems) * circumference : circumference;
        const ruinsDash = totalItems > 0 ? (ruinsCount / totalItems) * circumference : 0;
        const ruinsOffset = -bonsDash;

        // 1. Aplicar busca em tempo real se digitada
        let searchFilteredItems = allProcItems;
        if (state.processoSearch && state.processoSearch.trim().length > 0) {
            const q = state.processoSearch.trim().toLowerCase();
            searchFilteredItems = allProcItems.filter(r => 
                (r.codigo || '').toLowerCase().includes(q) ||
                (r.op || '').toLowerCase().includes(q) ||
                (r.setor || '').toLowerCase().includes(q) ||
                (r.statusModelagem || '').toLowerCase().includes(q) ||
                (r.descLocal || '').toLowerCase().includes(q) ||
                (r.marca || '').toLowerCase().includes(q) ||
                (r.descricao || '').toLowerCase().includes(q) ||
                (r.cliente || '').toLowerCase().includes(q) ||
                (r.pedDescPeriodo || '').toLowerCase().includes(q)
            );
        }

        // 2. Definir itens pendentes (para Fotos) e itens liberados (para Lista/Tabela)
        let displayPendingItems = searchFilteredItems.filter(r => isModelagemPendenciaRuim(r.statusModelagem || r.descLocal));
        let displayReleasedItems = searchFilteredItems.filter(r => !isModelagemPendenciaRuim(r.statusModelagem || r.descLocal));
        let activeFilterLabel = null;

        if (state.processoFilter === 'ruins') {
            displayReleasedItems = []; // Foco exclusivo nos pendentes
            activeFilterLabel = 'Pendências de Modelagem (Ação Prioritária)';
        } else if (state.processoFilter === 'bons') {
            displayPendingItems = []; // Foco exclusivo nos liberados
            activeFilterLabel = 'Produtos Sem Pendência (Status Bons / Liberados)';
        } else if (state.processoFilter) {
            const filterLower = state.processoFilter.trim().toLowerCase();
            const isFilterRuim = isModelagemPendenciaRuim(state.processoFilter);
            if (isFilterRuim) {
                displayPendingItems = displayPendingItems.filter(r => (r.statusModelagem || r.descLocal || 'EM BRANCO (NÃO INFORMADO)').trim().toLowerCase() === filterLower);
                displayReleasedItems = [];
            } else {
                displayReleasedItems = displayReleasedItems.filter(r => (r.statusModelagem || r.descLocal || 'EM BRANCO (NÃO INFORMADO)').trim().toLowerCase() === filterLower);
                displayPendingItems = [];
            }
            activeFilterLabel = `Status: ${state.processoFilter}`;
        }

        container.innerHTML = `
            <!-- CABEÇALHO DO MÓDULO -->
            <div class="module-view-header" style="margin-bottom: 24px;">
                <div class="module-view-title-group">
                    <h2 style="font-size: 22px; font-weight: 800; color: var(--text-primary);">Em Processo (Setores 05, 06, 12)</h2>
                    <p class="module-view-description" style="font-size: 13px; color: var(--text-muted); margin-top: 4px;">
                        Visão executiva da proporção entre pedidos com pendência de modelagem e pedidos em fluxo normal/liberados nos setores de corte e processo.
                    </p>
                </div>
                <div class="btn-group" style="flex-wrap: wrap; gap: 6px;">
                    <span class="badge badge-purple" style="font-size: 12px; padding: 6px 14px;">${totalItems} OPs Mapeadas</span>
                    <span class="badge badge-cyan" style="font-size: 12px; padding: 6px 14px;">Setor 05 (${setorCounts['05'] || setorCounts['5'] || 0})</span>
                    <span class="badge badge-purple" style="font-size: 12px; padding: 6px 14px;">Setor 06 (${setorCounts['06'] || setorCounts['6'] || 0})</span>
                    <span class="badge badge-amber" style="font-size: 12px; padding: 6px 14px;">Setor 12 (${setorCounts['12'] || 0})</span>
                    <span class="badge badge-emerald" style="font-size: 12px; padding: 6px 14px;">${formatNumber(totalPecas)} pçs</span>
                </div>
            </div>

            <!-- PAINEL EXECUTIVO: GRÁFICO DE PIZZA GIGANTE (50%) + QUADRO DE STATUS (50%) -->
            <div class="exec-processo-layout">
                <!-- COLUNA ESQUERDA: DONUT GIGANTE (DOBRO DO TAMANHO) + CARDS MACRO -->
                <div class="hero-pie-chart-container">
                    <svg viewBox="0 0 440 440" class="hero-donut-svg">
                        <defs>
                            <filter id="glowDonutBlue" x="-30%" y="-30%" width="160%" height="160%">
                                <feDropShadow dx="0" dy="0" stdDeviation="12" flood-color="#00a8ff" flood-opacity="0.65"/>
                            </filter>
                            <filter id="glowDonutRed" x="-30%" y="-30%" width="160%" height="160%">
                                <feDropShadow dx="0" dy="0" stdDeviation="14" flood-color="#ef4444" flood-opacity="0.9"/>
                            </filter>
                        </defs>
                        <g transform="rotate(-90 220 220)">
                            <!-- Trilha de fundo circular -->
                            <circle cx="220" cy="220" r="150" fill="none" stroke="#121624" stroke-width="58" />
                            
                            <!-- Fatia Status Bons (Azul #00a8ff) -->
                            <circle cx="220" cy="220" r="150" fill="none" stroke="#00a8ff" stroke-width="58"
                                stroke-dasharray="${bonsDash.toFixed(2)} ${circumference.toFixed(2)}"
                                stroke-dashoffset="0"
                                filter="url(#glowDonutBlue)"
                                style="cursor: pointer;"
                                onclick="window.crmFilterProcesso('bons')"
                            />
                            
                            <!-- Fatia Status Ruins (Vermelho #ef4444) -->
                            ${ruinsCount > 0 ? `
                                <circle cx="220" cy="220" r="150" fill="none" stroke="#ef4444" stroke-width="58"
                                    stroke-dasharray="${ruinsDash.toFixed(2)} ${circumference.toFixed(2)}"
                                    stroke-dashoffset="${ruinsOffset.toFixed(2)}"
                                    filter="url(#glowDonutRed)"
                                    style="cursor: pointer;"
                                    onclick="window.crmFilterProcesso('ruins')"
                                />
                            ` : ''}
                        </g>
                        <!-- Texto Central Alinhado em Destaque Gigante -->
                        <text x="220" y="190" text-anchor="middle" dominant-baseline="central" fill="#ffffff" font-size="76" font-weight="900" font-family="system-ui, -apple-system, sans-serif" letter-spacing="-2px">${totalItems}</text>
                        <text x="220" y="246" text-anchor="middle" dominant-baseline="central" fill="#94a3b8" font-size="14" font-weight="800" letter-spacing="3px" font-family="system-ui, -apple-system, sans-serif">PRODUTOS</text>
                        <text x="220" y="272" text-anchor="middle" dominant-baseline="central" fill="#38bdf8" font-size="13" font-weight="800" letter-spacing="1.5px" font-family="system-ui, -apple-system, sans-serif">EM PROCESSO</text>
                    </svg>

                    <!-- Legenda Rápida em Cards de Alto Contraste Lado a Lado -->
                    <div class="hero-pie-quick-legend">
                        <div class="donut-legend-card blue ${state.processoFilter === 'bons' ? 'active' : ''}" style="cursor: pointer; border-left: 4px solid #00a8ff;" onclick="window.crmFilterProcesso('bons')" title="Clique para filtrar apenas Status Bons">
                            <div class="donut-legend-label blue">
                                <span class="legend-dot blue"></span>
                                <div>
                                    <div style="font-weight: 700; font-size: 13px; color: #ffffff;">Status Bons (Liberados)</div>
                                    <div style="font-size: 11px; color: #bae6fd;">${formatNumber(bonsPecas)} peças no fluxo (somente lista)</div>
                                </div>
                            </div>
                            <div style="text-align: right;">
                                <div class="donut-legend-value blue" style="font-size: 14px; color: #38bdf8;">${bonsCount} prod (${bonsPct}%)</div>
                                <span style="font-size: 10.5px; color: #38bdf8; text-decoration: underline;">Ver Lista ↓</span>
                            </div>
                        </div>

                        <div class="donut-legend-card red ${state.processoFilter === 'ruins' ? 'active' : ''}" style="cursor: pointer; border-left: 4px solid #ef4444; background: rgba(239, 68, 68, 0.08);" onclick="window.crmFilterProcesso('ruins')" title="Clique para filtrar apenas Pendências">
                            <div class="donut-legend-label red">
                                <span class="legend-dot red"></span>
                                <div>
                                    <div style="font-weight: 700; font-size: 13px; color: #ffffff;">Pendências de Modelagem</div>
                                    <div style="font-size: 11px; color: #fca5a5;">${formatNumber(ruinsPecas)} peças com fotos</div>
                                </div>
                            </div>
                            <div style="text-align: right;">
                                <div class="donut-legend-value red" style="font-size: 14px; color: #f87171;">${ruinsCount} prod (${ruinsPct}%)</div>
                                <span style="font-size: 10.5px; color: #f87171; text-decoration: underline;">Ver Fotos ↓</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- COLUNA DIREITA: QUADRO EXECUTIVO POR STATUS (SEM POLUIÇÃO DE CHIPS) -->
                <div class="exec-card">
                    <div class="exec-card-header">
                        <div>
                            <div class="exec-card-title">
                                <i class="fa-solid fa-layer-group" style="color: #38bdf8;"></i>
                                <span>Painel Executivo de Distribuição por Status</span>
                            </div>
                            <div class="exec-card-subtitle">
                                Clique em qualquer linha para filtrar instantaneamente os produtos abaixo
                            </div>
                        </div>
                        <div class="btn-group">
                            <button class="exec-action-btn" onclick="window.crmFilterProcesso(null)" title="Ver todos os produtos">
                                <i class="fa-solid fa-list"></i> Ver Todos (${totalItems})
                            </button>
                        </div>
                    </div>

                    <!-- 1. BLOCO STATUS RUINS / PENDÊNCIAS DA MODELAGEM -->
                    <div style="margin-bottom: 20px;">
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; padding-bottom: 6px; border-bottom: 1px solid rgba(239, 68, 68, 0.25);">
                            <span style="font-size: 12px; font-weight: 800; color: #f87171; letter-spacing: 0.5px;">
                                <i class="fa-solid fa-triangle-exclamation"></i> PENDÊNCIAS DO TIME DE MODELAGEM (${ruinsCount} PROD • EXIBIDOS COM FOTOS)
                            </span>
                            <span style="font-size: 11.5px; color: #fca5a5; font-weight: 600;">
                                ${formatNumber(ruinsPecas)} peças
                            </span>
                        </div>

                        ${ruinsList.length === 0 ? `
                            <div style="padding: 12px; background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.2); border-radius: 8px; color: #a7f3d0; font-size: 12.5px; display: flex; align-items: center; gap: 8px;">
                                <i class="fa-solid fa-circle-check" style="font-size: 15px;"></i>
                                <span>Excelente! Nenhuma pendência do time de modelagem registrada nos setores 05, 06 e 12.</span>
                            </div>
                        ` : ruinsList.map(st => {
                            const pct = totalItems > 0 ? ((st.count / totalItems) * 100).toFixed(1) : 0;
                            const isSelected = state.processoFilter && state.processoFilter.toLowerCase() === st.name.toLowerCase();
                            const escapedName = st.name.replace(/'/g, "\\'");
                            return `
                                <div class="exec-status-row is-ruim ${isSelected ? 'active' : ''}" onclick="window.crmFilterProcesso('${escapedName}')" title="Clique para filtrar por: ${st.name} (exibe com fotos)">
                                    <div class="exec-status-badge-area">
                                        <span class="status-ruim-piscando" style="font-size: 11px; padding: 3px 9px;">
                                            <i class="fa-solid fa-triangle-exclamation"></i> ${st.name.toUpperCase()}
                                        </span>
                                        <div class="exec-setores-pills">
                                            <span class="pill-setor">05: <strong>${st.setores['05']}</strong></span>
                                            <span class="pill-setor">06: <strong>${st.setores['06']}</strong></span>
                                            <span class="pill-setor">12: <strong>${st.setores['12']}</strong></span>
                                        </div>
                                    </div>
                                    <div class="exec-metrics-col">
                                        <span class="exec-metrics-count ruim">${st.count} ${st.count === 1 ? 'produto' : 'produtos'}</span>
                                        <span class="exec-metrics-sub">${formatNumber(st.pecas)} peças</span>
                                    </div>
                                    <div class="exec-progress-col">
                                        <span class="exec-progress-pct">${pct}%</span>
                                        <div class="exec-progress-bar-bg">
                                            <div class="exec-progress-fill ruim" style="width: ${pct}%;"></div>
                                        </div>
                                    </div>
                                    <div>
                                        <button class="exec-action-btn" onclick="event.stopPropagation(); window.crmFilterProcesso('${escapedName}')" style="width: 100%; border-color: rgba(239, 68, 68, 0.35); color: #fca5a5;">
                                            <i class="fa-solid ${isSelected ? 'fa-arrow-up' : 'fa-filter'}"></i> ${isSelected ? 'Ocultar OPs ↑' : 'Ver OPs ↓'}
                                        </button>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>

                    <!-- 2. BLOCO STATUS BONS / RESOLVIDOS NO FLUXO -->
                    <div>
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; padding-bottom: 6px; border-bottom: 1px solid rgba(14, 165, 233, 0.25);">
                            <span style="font-size: 12px; font-weight: 800; color: #38bdf8; letter-spacing: 0.5px;">
                                <i class="fa-solid fa-check"></i> STATUS RESOLVIDOS / FLUXO NORMAL (${bonsCount} PROD • EXIBIDOS EM LISTA)
                            </span>
                            <span style="font-size: 11.5px; color: #bae6fd; font-weight: 600;">
                                ${formatNumber(bonsPecas)} peças
                            </span>
                        </div>

                        ${bonsList.length === 0 ? `
                            <div style="padding: 12px; background: rgba(255, 255, 255, 0.03); border-radius: 8px; color: var(--text-muted); font-size: 12.5px;">
                                Nenhum produto com status liberado/resolvido.
                            </div>
                        ` : bonsList.map(st => {
                            const pct = totalItems > 0 ? ((st.count / totalItems) * 100).toFixed(1) : 0;
                            const isSelected = state.processoFilter && state.processoFilter.toLowerCase() === st.name.toLowerCase();
                            const escapedName = st.name.replace(/'/g, "\\'");
                            return `
                                <div class="exec-status-row is-bom ${isSelected ? 'active' : ''}" onclick="window.crmFilterProcesso('${escapedName}')" title="Clique para filtrar por: ${st.name} (exibe na tabela)">
                                    <div class="exec-status-badge-area">
                                        <span class="status-bom-azul" style="font-size: 11px; padding: 3px 9px;">
                                            <i class="fa-solid fa-check"></i> ${st.name}
                                        </span>
                                        <div class="exec-setores-pills">
                                            <span class="pill-setor">05: <strong>${st.setores['05']}</strong></span>
                                            <span class="pill-setor">06: <strong>${st.setores['06']}</strong></span>
                                            <span class="pill-setor">12: <strong>${st.setores['12']}</strong></span>
                                        </div>
                                    </div>
                                    <div class="exec-metrics-col">
                                        <span class="exec-metrics-count bom">${st.count} ${st.count === 1 ? 'produto' : 'produtos'}</span>
                                        <span class="exec-metrics-sub">${formatNumber(st.pecas)} peças</span>
                                    </div>
                                    <div class="exec-progress-col">
                                        <span class="exec-progress-pct">${pct}%</span>
                                        <div class="exec-progress-bar-bg">
                                            <div class="exec-progress-fill bom" style="width: ${pct}%;"></div>
                                        </div>
                                    </div>
                                    <div>
                                        <button class="exec-action-btn" onclick="event.stopPropagation(); window.crmFilterProcesso('${escapedName}')" style="width: 100%;">
                                            <i class="fa-solid ${isSelected ? 'fa-arrow-up' : 'fa-filter'}"></i> ${isSelected ? 'Ocultar OPs ↑' : 'Ver OPs ↓'}
                                        </button>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            </div>

            <!-- CONTROLES GERAIS E BARRA DE BUSCA -->
            <div class="table-card pdf-screen-controls" style="margin-bottom: 24px; padding: 16px 20px;">
                <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;">
                    <!-- Barra de Pesquisa Rápida -->
                    <div class="s13-search-box" style="flex: 1; max-width: 480px;">
                        <i class="fa-solid fa-magnifying-glass" style="color: var(--text-muted); font-size: 12px;"></i>
                        <input type="text" placeholder="Buscar por código, OP, setor, status, cliente..." value="${escapeHtml(state.processoSearch || '')}" oninput="window.crmSearchProcesso(this.value)">
                        ${state.processoSearch ? `
                            <i class="fa-solid fa-xmark" style="cursor: pointer; color: var(--text-muted);" onclick="window.crmSearchProcesso('')" title="Limpar busca"></i>
                        ` : ''}
                    </div>

                    <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                        ${activeFilterLabel ? `
                            <button class="filter-clear-btn" onclick="window.crmFilterProcesso(null)" title="Limpar filtro ativo">
                                <i class="fa-solid fa-xmark"></i> Limpar Filtro (${activeFilterLabel})
                            </button>
                        ` : ''}
                        <button class="toolbar-pill-btn btn-sync-images-action" onclick="window.crmSyncImages()" title="Sincronizar fotos do Google Drive agora" style="border-color: rgba(56, 189, 248, 0.4); color: #38bdf8;">
                            <i class="fa-solid fa-arrows-rotate" style="color: #38bdf8;"></i> Sincronizar Fotos
                        </button>
                        <button class="toolbar-pill-btn btn-export-pdf" onclick="window.crmGeneratePDFReport()" title="Gerar Relatório em PDF">
                            <i class="fa-solid fa-file-pdf" style="color: #ef4444;"></i> Gerar PDF
                        </button>
                        <button class="toolbar-pill-btn" onclick="window.crmExportFilteredCSV()">
                            <i class="fa-solid fa-download"></i> CSV
                        </button>
                    </div>
                </div>

                <!-- Banner Informativo de Filtro Ativo -->
                ${activeFilterLabel ? `
                    <div class="filter-active-banner" style="margin-top: 14px; margin-bottom: 0;">
                        <div class="filter-active-text">
                            <i class="fa-solid fa-filter"></i>
                            <span>Filtro Ativo: <strong>${activeFilterLabel}</strong> (${displayPendingItems.length} com fotos • ${displayReleasedItems.length} em lista)</span>
                        </div>
                        <button class="filter-clear-btn" onclick="window.crmFilterProcesso(null)">
                            <i class="fa-solid fa-xmark"></i> Exibir Todos
                        </button>
                    </div>
                ` : ''}
            </div>

            <!-- SEÇÃO 1: PRODUTOS COM PENDÊNCIA DE MODELAGEM (COM IMAGENS / FOTOS - 4 POR LINHA) -->
            ${state.processoFilter !== 'bons' ? `
                <div class="table-card" id="processoGallerySection" style="margin-bottom: 28px; border-top: 3px solid #ef4444;">
                    <div class="s13-gallery-toolbar pdf-screen-controls" style="border-bottom: 1px solid rgba(239, 68, 68, 0.2);">
                        <div class="table-title-group">
                            <h3 class="table-title" style="display: flex; align-items: center; gap: 8px; color: #ffffff;">
                                <i class="fa-solid fa-images" style="color: #ef4444;"></i>
                                <span>Pendências de Modelagem (Setores 05, 06, 12)</span>
                                <span class="badge badge-rose" style="font-size: 10px; padding: 2px 8px; animation: pulseGlow 1.5s infinite;">AÇÃO PRIORITÁRIA</span>
                            </h3>
                            <span class="badge badge-rose" style="font-weight: 800;">${displayPendingItems.length} produtos com imagens</span>
                        </div>
                    </div>

                    ${displayPendingItems.length === 0 ? `
                        <div style="text-align: center; padding: 36px 20px; color: var(--text-muted); background: rgba(0, 0, 0, 0.15); border-radius: 8px; margin-top: 12px;">
                            <i class="fa-solid fa-circle-check" style="font-size: 32px; color: #10b981; margin-bottom: 10px;"></i>
                            <p style="font-size: 14px; font-weight: 700; color: #ffffff;">Nenhuma pendência de modelagem encontrada nos critérios atuais.</p>
                            <p style="font-size: 12px; margin-top: 4px;">Todos os produtos filtrados estão em fluxo normal ou liberados.</p>
                        </div>
                    ` : `
                        <!-- GRADE VISUAL 4 POR LINHA COM FOTOS E SETOR PENDENTE -->
                        <div class="s13-photo-grid" style="margin-top: 14px;">
                            ${displayPendingItems.map(item => {
                                const isAtraso = item.prazoStatus === 'ATRASO';
                                const imgInfo = getProductImage(item.codigo);
                                const escapedDesc = (item.descricao || 'Produto').replace(/'/g, "\\'");
                                const escapedCode = (item.codigo || '').replace(/'/g, "\\'");

                                return `
                                    <div class="s13-photo-card card-critico">
                                        <!-- ÁREA DA FOTO -->
                                        <div class="s13-photo-wrapper">
                                            <!-- BADGE DE DESTAQUE DO SETOR PENDENTE NA FOTO -->
                                            <span class="s13-photo-tag" style="background: rgba(14, 165, 233, 0.92); color: #ffffff; font-weight: 800; top: 10px; left: 10px; border-radius: 6px; box-shadow: 0 0 10px rgba(14, 165, 233, 0.6); font-size: 11px; padding: 3px 8px;" title="Setor Onde o Pedido Está em Processo">
                                                <i class="fa-solid fa-industry"></i> SETOR ${item.setor}
                                            </span>

                                            ${imgInfo.hasImage ? `
                                                <img src="${imgInfo.thumbUrl}" loading="lazy" class="s13-photo-img" alt="${item.codigo}" onerror="this.onerror=null; this.src='${imgInfo.proxyUrl}';">
                                                <div class="s13-photo-overlay" onclick="window.crmOpenImageLightbox('${imgInfo.largeUrl}', '${escapedCode}', 'OP ${item.op} • Setor ${item.setor} • ${escapedDesc}')">
                                                    <i class="fa-solid fa-magnifying-glass-plus" style="font-size: 24px; color: #38bdf8;"></i>
                                                    <span>Ampliar Foto</span>
                                                </div>
                                                <span class="s13-photo-tag" style="top: 10px; right: 10px; left: auto;" title="Foto vinculada do Google Drive">
                                                    <i class="fa-brands fa-google-drive" style="color: #34d399;"></i> Drive
                                                </span>
                                            ` : `
                                                <div class="s13-photo-placeholder" onclick="window.crmOpenOpModal('${item.op}')" title="Clique para detalhes da OP">
                                                    <i class="fa-solid fa-scissors" style="font-size: 38px; color: rgba(239, 68, 68, 0.5);"></i>
                                                    <span style="font-size: 11px; color: var(--text-muted); margin-top: 6px;">Sem Foto no Drive</span>
                                                </div>
                                            `}
                                        </div>

                                        <!-- CONTEÚDO DO CARD -->
                                        <div class="s13-photo-body">
                                            <!-- STATUS DE MODELAGEM PISCANDO / EM DESTAQUE -->
                                            <div style="margin-bottom: 8px;">
                                                ${renderStatusModelagemBadge(item.descLocal)}
                                            </div>

                                            <div class="s13-photo-code-row">
                                                <span class="s13-photo-code" onclick="window.crmOpenOpModal('${item.op}')" title="Abrir Detalhes">${item.codigo}</span>
                                                <span class="badge badge-purple" style="font-size: 10.5px; font-weight: 700;">OP ${item.op}</span>
                                            </div>

                                            <div class="s13-photo-desc" title="${item.descricao}">
                                                ${item.descricao || 'Produto sem descrição cadastrada'}
                                            </div>

                                            <div class="s13-photo-client">
                                                <i class="fa-solid fa-building" style="color: var(--text-muted); font-size: 10.5px;"></i>
                                                <span>${item.cliente || 'Cliente não informado'}</span>
                                            </div>

                                            <!-- MÉTRICAS DE PEÇAS E DIAS NO SETOR -->
                                            <div class="s13-photo-metrics" style="grid-template-columns: 1fr 1fr; margin-top: 10px;">
                                                <div class="s13-metric-pill" style="border-left: 2.5px solid #38bdf8;">
                                                    <span class="s13-metric-label">Peças (AP)</span>
                                                    <span class="s13-metric-val" style="color: #ffffff;">${formatNumber(item.qtdeOriginal)}</span>
                                                </div>
                                                <div class="s13-metric-pill" style="border-left: 2.5px solid ${item.diasParado > 2 ? '#ef4444' : '#10b981'};">
                                                    <span class="s13-metric-label">Dias no Setor</span>
                                                    <span class="s13-metric-val" style="color: ${item.diasParado > 2 ? '#f87171' : '#34d399'}; font-weight: 800;">
                                                        ${item.diasParado} dias
                                                    </span>
                                                </div>
                                            </div>

                                            <!-- BOTÃO DE AÇÃO RÁPIDA -->
                                            <div style="margin-top: 12px; display: flex; gap: 6px;">
                                                <button class="s13-btn-action primary" onclick="window.crmOpenOpModal('${item.op}')" style="flex: 1; padding: 6px; font-size: 11px;">
                                                    <i class="fa-solid fa-circle-info"></i> Detalhes 360°
                                                </button>
                                                ${imgInfo.hasImage ? `
                                                    <button class="s13-btn-action" onclick="window.crmOpenImageLightbox('${imgInfo.largeUrl}', '${escapedCode}', 'OP ${item.op} • Setor ${item.setor} • ${escapedDesc}')" style="padding: 6px 10px;" title="Ver Foto Ampliada">
                                                        <i class="fa-solid fa-expand"></i>
                                                    </button>
                                                ` : ''}
                                            </div>
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    `}
                </div>
            ` : ''}

            <!-- SEÇÃO 2: TABELA COMPLETA DE PRODUTOS / FLUXO NORMAL (LIBERADOS) -->
            <div class="table-card pdf-detail-list" id="processoTableSection">
                <div class="table-toolbar">
                    <div class="table-title-group">
                        <h3 class="table-title" style="display: flex; align-items: center; gap: 8px;">
                            <i class="fa-solid fa-list-check" style="color: #00d4ff;"></i>
                            <span>${state.processoFilter === 'ruins' ? 'Tabela de Pendências de Modelagem' : 'Lista Completa / Produtos Liberados em Processo'}</span>
                        </h3>
                        <span class="badge badge-sub">${state.processoFilter === 'ruins' ? displayPendingItems.length : displayReleasedItems.length} de ${totalItems} produtos</span>
                    </div>
                    <div class="table-controls">
                        ${activeFilterLabel ? `
                            <button class="filter-clear-btn" onclick="window.crmFilterProcesso(null)" title="Limpar filtro ativo">
                                <i class="fa-solid fa-xmark"></i> Limpar Filtro
                            </button>
                        ` : ''}
                        <button class="toolbar-pill-btn btn-export-pdf" onclick="window.crmGeneratePDFReport()" title="Gerar Relatório em PDF">
                            <i class="fa-solid fa-file-pdf" style="color: #ef4444;"></i> Gerar PDF
                        </button>
                        <button class="toolbar-pill-btn" onclick="window.crmExportFilteredCSV()">
                            <i class="fa-solid fa-download"></i> Baixar Tabela CSV
                        </button>
                    </div>
                </div>

                <div class="table-responsive">
                    <table class="crm-table">
                        <thead>
                            <tr>
                                <th>OP</th>
                                <th>Código & Produto</th>
                                <th>Setor</th>
                                <th>Status Modelagem (Descrição do Local)</th>
                                <th>Status Produto (BD)</th>
                                <th>Dias no Setor</th>
                                <th>Peças (AP)</th>
                                <th>Cliente</th>
                                <th>Semana Entrega</th>
                                <th>Prazo</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${(state.processoFilter === 'ruins' ? displayPendingItems : displayReleasedItems).length === 0 ? `
                                <tr>
                                    <td colspan="10" style="text-align: center; padding: 32px; color: var(--text-muted);">
                                        Nenhum produto encontrado com o filtro selecionado.
                                    </td>
                                </tr>
                            ` : (state.processoFilter === 'ruins' ? displayPendingItems : displayReleasedItems).map(item => {
                                const isAtraso = item.prazoStatus === 'ATRASO';
                                return `
                                    <tr class="${isAtraso ? 'row-danger' : ''}" onclick="window.crmOpenOpModal('${item.op}')" style="cursor: pointer;" title="Clique para abrir detalhes 360° da OP ${item.op}">
                                        <td class="table-op-cell">
                                            <span style="font-weight: 700; color: #38bdf8;">${item.op}</span>
                                        </td>
                                        <td>
                                            <div class="table-prod-cell">
                                                <span class="prod-code">${item.codigo}</span>
                                                <span class="prod-name" title="${item.descricao}">${item.descricao}</span>
                                            </div>
                                        </td>
                                        <td><span class="badge badge-cyan">Setor ${item.setor}</span></td>
                                        <td>${renderStatusModelagemBadge(item.descLocal)}</td>
                                        <td><span style="font-size: 11.5px; color: var(--text-secondary);">${item.statusProd || '—'}</span></td>
                                        <td>
                                            <span class="badge badge-sub" style="font-weight: 600;">${item.diasParado} d</span>
                                        </td>
                                        <td style="font-weight: 700; color: var(--text-primary);">${formatNumber(item.qtdeOriginal)}</td>
                                        <td>${item.cliente || '—'}</td>
                                        <td><strong>${item.pedDescPeriodo || item.pedPeriodo || '—'}</strong></td>
                                        <td>
                                            ${isAtraso ? 
                                                '<span class="badge badge-rose"><i class="fa-solid fa-clock"></i> Em Atraso</span>' : 
                                                '<span class="badge badge-emerald"><i class="fa-solid fa-check"></i> No Prazo</span>'
                                            }
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    // =========================================================================
    // 3.5 MÓDULO ESTILO PEDIDO - PENDÊNCIAS SETOR 01 (POR CLIENTE & DIAS)
    // =========================================================================
    function renderSetor01View(container) {
        // Regra do Usuário:
        // - produtos pendentes no setor 01 (coluna AY)
        // - Layout base igual ao do Setor 43 / 05, 06, 12 (gráfico grande 50%/50% dividindo com informações)
        // - O gráfico deve trazer a SOMA DE PRODUTOS PENDENTES SEPARADO POR CLIENTE (C&A, Hering, Renner, etc.)
        // - Abaixo as imagens dos produtos + INFORMAÇÃO DA QUANTIDADE DE DIAS PENDENTES NESSE SETOR (destaque > 2 dias)
        const relatedSectorMap = window.CRMSetor01RelatedSectors.buildMap(state.allData);
        const s01Items = state.filteredData
            .filter(r => r.setor === '01' || r.setor === '1')
            .map(item => ({ ...item, ...window.CRMSetor01RelatedSectors.resolve(item, relatedSectorMap) }));
        const totalItems = s01Items.length;
        const totalPecas = s01Items.reduce((sum, r) => sum + r.qtdeOriginal, 0);

        // Agrupamento por Cliente
        const clienteColors = [
            { stroke: '#00d4ff', glow: '#0284c7', name: 'cyan' },
            { stroke: '#10b981', glow: '#059669', name: 'emerald' },
            { stroke: '#ef4444', glow: '#dc2626', name: 'rose' },
            { stroke: '#f59e0b', glow: '#d97706', name: 'amber' },
            { stroke: '#a855f7', glow: '#7c3aed', name: 'purple' },
            { stroke: '#ec4899', glow: '#db2777', name: 'pink' },
            { stroke: '#06b6d4', glow: '#0891b2', name: 'teal' }
        ];

        const clienteMap = {};
        s01Items.forEach(item => {
            let cli = (item.cliente || item.grupoCliente || '').trim() || 'OUTROS';
            const cliUpper = cli.toUpperCase();
            if (cliUpper.includes('HERING')) cli = 'CIA. HERING';
            else if (cliUpper.includes('C&A') || cliUpper.includes('CEA')) cli = 'C&A MODAS';
            else if (cliUpper.includes('RENNER')) cli = 'LOJAS RENNER';
            else if (cliUpper.includes('CENTAURO')) cli = 'CENTAURO';
            else if (cliUpper.includes('SANTA MARCA')) cli = 'SANTA MARCA';
            else if (cliUpper.includes('RIACHUELO')) cli = 'RIACHUELO';
            else if (cliUpper.includes('MARISA')) cli = 'MARISA';
            else if (cliUpper.includes('ONEDA')) cli = 'ONEDA / FEIRA';

            if (!clienteMap[cli]) {
                clienteMap[cli] = {
                    name: cli,
                    count: 0,
                    pecas: 0,
                    diasTotal: 0,
                    criticosCount: 0,
                    items: []
                };
            }
            clienteMap[cli].count += 1;
            clienteMap[cli].pecas += item.qtdeOriginal;
            clienteMap[cli].diasTotal += item.diasParado;
            if (item.diasParado > 2) {
                clienteMap[cli].criticosCount += 1;
            }
            clienteMap[cli].items.push(item);
        });

        const clienteList = Object.values(clienteMap).sort((a, b) => b.count - a.count);

        // Itens críticos (> 2 dias no Setor 01)
        const criticosItems = s01Items.filter(r => r.diasParado > 2);
        const totalCriticos = criticosItems.length;

        // Distribuição por Semana de Entrega (Coluna BK / Ped Desc Período)
        const semanaCounts = countBy(s01Items, 'pedDescPeriodo');

        // Geometria Donut Chart SVG Gigante (viewBox 0 0 440 440, raio 150)
        const radius = 150;
        const circumference = 2 * Math.PI * radius; // ~942.48
        let accumulatedDash = 0;
        const donutSlices = clienteList.map((cliData, idx) => {
            const colorObj = clienteColors[idx % clienteColors.length];
            const dash = totalItems > 0 ? (cliData.count / totalItems) * circumference : 0;
            const currentOffset = -accumulatedDash;
            accumulatedDash += dash;
            return {
                ...cliData,
                color: colorObj.stroke,
                glowColor: colorObj.glow,
                dash: dash.toFixed(2),
                offset: currentOffset.toFixed(2),
                percent: totalItems > 0 ? ((cliData.count / totalItems) * 100).toFixed(1) : '0'
            };
        });

        // 1. Aplicar busca em tempo real se digitada
        let searchFilteredItems = s01Items;
        if (state.setor01Search && state.setor01Search.trim().length > 0) {
            const q = state.setor01Search.trim().toLowerCase();
            searchFilteredItems = s01Items.filter(r => 
                (r.codigo || '').toLowerCase().includes(q) ||
                (r.op || '').toLowerCase().includes(q) ||
                (r.setor || '').toLowerCase().includes(q) ||
                (r.statusModelagem || '').toLowerCase().includes(q) ||
                (r.descLocal || '').toLowerCase().includes(q) ||
                (r.statusProd || '').toLowerCase().includes(q) ||
                (r.marca || '').toLowerCase().includes(q) ||
                (r.etiqueta || '').toLowerCase().includes(q) ||
                (r.descricao || '').toLowerCase().includes(q) ||
                (r.cliente || '').toLowerCase().includes(q) ||
                (r.pedDescPeriodo || '').toLowerCase().includes(q)
            );
        }

        // 2. Aplicar filtros ativos
        let displayItems = searchFilteredItems;
        let activeFilterLabel = null;

        if (state.setor01Filter === 'criticos') {
            displayItems = searchFilteredItems.filter(r => r.diasParado > 2);
            activeFilterLabel = 'Permanência Crítica (> 2 Dias no Setor 01)';
        } else if (state.setor01Filter && state.setor01Filter.field === 'cliente') {
            const valLower = state.setor01Filter.value.trim().toLowerCase();
            displayItems = searchFilteredItems.filter(r => {
                let cli = (r.cliente || r.grupoCliente || r.marca || '').trim().toLowerCase();
                if (cli.includes('hering') && valLower.includes('hering')) return true;
                if ((cli.includes('c&a') || cli.includes('cea')) && (valLower.includes('c&a') || valLower.includes('cea'))) return true;
                if (cli.includes('renner') && valLower.includes('renner')) return true;
                if (cli.includes('riachuelo') && valLower.includes('riachuelo')) return true;
                if (cli.includes('marisa') && valLower.includes('marisa')) return true;
                return cli === valLower;
            });
            activeFilterLabel = `Cliente: ${state.setor01Filter.value}`;
        } else if (state.setor01Filter && state.setor01Filter.field === 'semana') {
            const valLower = state.setor01Filter.value.trim().toLowerCase();
            displayItems = searchFilteredItems.filter(r => 
                ((r.pedDescPeriodo || r.semanaPedido || '').trim().toLowerCase()) === valLower
            );
            activeFilterLabel = `Semana: ${state.setor01Filter.value}`;
        }

        container.innerHTML = `
            <!-- CABEÇALHO DO MÓDULO -->
            <div class="module-view-header" style="margin-bottom: 24px;">
                <div class="module-view-title-group">
                    <h2 style="font-size: 22px; font-weight: 800; color: var(--text-primary);">Módulo Estilo Pedido: PEND. SETOR 01</h2>
                    <p class="module-view-description" style="font-size: 13px; color: var(--text-muted); margin-top: 4px;">
                        Visão executiva dos produtos pendentes no Setor 01 distribuídos por Cliente e monitoramento de tempo de permanência.
                    </p>
                </div>
                <div class="btn-group" style="flex-wrap: wrap; gap: 6px;">
                    <span class="badge badge-cyan" style="font-size: 12px; padding: 6px 14px;">Setor 01</span>
                    <span class="badge badge-purple" style="font-size: 12px; padding: 6px 14px;">${totalItems} OPs Mapeadas</span>
                    ${totalCriticos > 0 ? `
                        <span class="badge badge-rose badge-pulse-red" style="font-size: 11.5px; padding: 6px 12px; cursor: pointer;" onclick="window.crmFilterSetor01('criticos')" title="Filtrar produtos com mais de 2 dias parados">
                            <i class="fa-solid fa-triangle-exclamation"></i> ${totalCriticos} Parados > 2 Dias
                        </span>
                    ` : ''}
                    <span class="badge badge-emerald" style="font-size: 12px; padding: 6px 14px;">${formatNumber(totalPecas)} pçs</span>
                </div>
            </div>

            <!-- PAINEL EXECUTIVO: GRÁFICO DE PIZZA GIGANTE POR CLIENTE (50%) + QUADRO ANALÍTICO (50%) -->
            <div class="exec-processo-layout">
                <!-- COLUNA ESQUERDA: DONUT GIGANTE (SEPARADO POR CLIENTE) -->
                <div class="hero-pie-chart-container">
                    <svg viewBox="0 0 440 440" class="hero-donut-svg">
                        <defs>
                            ${donutSlices.map((slice, idx) => `
                                <filter id="glowDonutS01_${idx}" x="-30%" y="-30%" width="160%" height="160%">
                                    <feDropShadow dx="0" dy="0" stdDeviation="12" flood-color="${slice.color}" flood-opacity="0.85"/>
                                </filter>
                            `).join('')}
                        </defs>
                        <g transform="rotate(-90 220 220)">
                            <!-- Trilha de fundo circular -->
                            <circle cx="220" cy="220" r="150" fill="none" stroke="#121624" stroke-width="58" />
                            
                            <!-- Fatias por Cliente -->
                            ${totalItems > 0 ? donutSlices.map((slice, idx) => `
                                <circle cx="220" cy="220" r="150" fill="none" stroke="${slice.color}" stroke-width="58"
                                    stroke-dasharray="${slice.dash} ${circumference.toFixed(2)}"
                                    stroke-dashoffset="${slice.offset}"
                                    filter="url(#glowDonutS01_${idx})"
                                    style="cursor: pointer; transition: all 0.3s ease;"
                                    onclick="window.crmFilterSetor01('cliente', '${slice.name.replace(/'/g, "\\'")}')"
                                />
                            `).join('') : `
                                <circle cx="220" cy="220" r="150" fill="none" stroke="#334155" stroke-width="58"
                                    stroke-dasharray="${circumference.toFixed(2)} ${circumference.toFixed(2)}"
                                    stroke-dashoffset="0"
                                />
                            `}
                        </g>
                        <!-- Texto Central Alinhado em Destaque Gigante -->
                        <text x="220" y="190" text-anchor="middle" dominant-baseline="central" fill="#ffffff" font-size="76" font-weight="900" font-family="system-ui, -apple-system, sans-serif" letter-spacing="-2px">${totalItems}</text>
                        <text x="220" y="246" text-anchor="middle" dominant-baseline="central" fill="#94a3b8" font-size="14" font-weight="800" letter-spacing="3px" font-family="system-ui, -apple-system, sans-serif">PRODUTOS</text>
                        <text x="220" y="272" text-anchor="middle" dominant-baseline="central" fill="#00d4ff" font-size="13" font-weight="800" letter-spacing="1.5px" font-family="system-ui, -apple-system, sans-serif">PEND. SETOR 01</text>
                    </svg>

                    <!-- Legenda Rápida em Cards de Alto Contraste Lado a Lado -->
                    <div class="hero-pie-quick-legend" style="grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));">
                        ${donutSlices.slice(0, 4).map(slice => {
                            const isSelected = state.setor01Filter && state.setor01Filter.field === 'cliente' && state.setor01Filter.value === slice.name;
                            const escaped = slice.name.replace(/'/g, "\\'");
                            return `
                                <div class="donut-legend-card ${isSelected ? 'active' : ''}" style="cursor: pointer; border-left: 4px solid ${slice.color}; background: rgba(15, 23, 42, 0.7);" onclick="window.crmFilterSetor01('cliente', '${escaped}')" title="Clique para filtrar por ${slice.name}">
                                    <div class="donut-legend-label">
                                        <span class="legend-dot" style="background: ${slice.color}; box-shadow: 0 0 8px ${slice.color};"></span>
                                        <div>
                                            <div style="font-weight: 700; font-size: 13px; color: #ffffff;">${slice.name}</div>
                                            <div style="font-size: 11px; color: var(--text-muted);">${formatNumber(slice.pecas)} peças</div>
                                        </div>
                                    </div>
                                    <div style="text-align: right;">
                                        <div class="donut-legend-value" style="font-size: 14px; color: ${slice.color};">${slice.count} prod (${slice.percent}%)</div>
                                        <span style="font-size: 10.5px; color: ${slice.color}; text-decoration: underline;">Filtrar ↓</span>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>

                <!-- COLUNA DIREITA: QUADRO EXECUTIVO POR CLIENTE & PERMANÊNCIA -->
                <div class="exec-card">
                    <div class="exec-card-header">
                        <div>
                            <div class="exec-card-title">
                                <i class="fa-solid fa-users-viewfinder" style="color: #00d4ff;"></i>
                                <span>Painel Executivo: Soma de Produtos por Cliente (Setor 01)</span>
                            </div>
                            <div class="exec-card-subtitle">
                                Clique no cliente para filtrar instantaneamente os produtos e fotos abaixo
                            </div>
                        </div>
                        <div class="btn-group">
                            <button class="exec-action-btn" onclick="window.crmFilterSetor01(null)" title="Ver todos os produtos">
                                <i class="fa-solid fa-list"></i> Ver Todos (${totalItems})
                            </button>
                        </div>
                    </div>

                    <!-- 1. RANKING E DISTRIBUIÇÃO POR CLIENTE -->
                    <div style="margin-bottom: 18px;">
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; padding-bottom: 6px; border-bottom: 1px solid rgba(0, 212, 255, 0.3);">
                            <span style="font-size: 12px; font-weight: 800; color: #38bdf8; letter-spacing: 0.5px;">
                                <i class="fa-solid fa-building"></i> CLIENTES COM PRODUTOS PENDENTES NO SETOR 01
                            </span>
                            <span style="font-size: 11.5px; color: #7dd3fc; font-weight: 600;">
                                ${clienteList.length} clientes mapeados
                            </span>
                        </div>

                        ${clienteList.length === 0 ? `
                            <div style="padding: 12px; font-size: 12px; color: var(--text-muted); text-align: center; background: rgba(0,0,0,0.2); border-radius: 8px;">
                                <i class="fa-solid fa-circle-check" style="color: #10b981;"></i> Nenhum produto pendente no Setor 01.
                            </div>
                        ` : clienteList.map((cli, idx) => {
                            const colorObj = clienteColors[idx % clienteColors.length];
                            const pct = totalItems > 0 ? ((cli.count / totalItems) * 100).toFixed(1) : '0';
                            const diasMedio = cli.count > 0 ? (cli.diasTotal / cli.count).toFixed(1) : '0';
                            const isSelected = state.setor01Filter && state.setor01Filter.field === 'cliente' && state.setor01Filter.value === cli.name;
                            const escaped = cli.name.replace(/'/g, "\\'");

                            return `
                                <div class="exec-status-row ${isSelected ? 'active' : ''}" onclick="window.crmFilterSetor01('cliente', '${escaped}')" style="cursor: pointer; margin-bottom: 8px;" title="Filtrar por ${cli.name}">
                                    <div class="exec-status-info">
                                        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                                            <span class="status-name" style="color: #ffffff; font-weight: 700;">${cli.name}</span>
                                            ${cli.criticosCount > 0 ? `
                                                <span class="badge badge-rose" style="font-size: 10px; padding: 1px 6px;">
                                                    <i class="fa-solid fa-triangle-exclamation"></i> ${cli.criticosCount} > 2 dias
                                                </span>
                                            ` : ''}
                                        </div>
                                        <div class="exec-status-stats">
                                            <span class="exec-badge-count" style="background: rgba(0, 212, 255, 0.15); color: ${colorObj.stroke}; border: 1px solid ${colorObj.stroke};">${cli.count} OPs</span>
                                            <span style="font-size: 11.5px; color: var(--text-muted);">${formatNumber(cli.pecas)} pçs</span>
                                            <span style="font-size: 11px; color: #f59e0b; font-weight: 600;">Média ${diasMedio}d</span>
                                            <span style="font-weight: 700; color: ${colorObj.stroke};">${pct}%</span>
                                        </div>
                                    </div>
                                    <div class="exec-progress-bar">
                                        <div class="exec-progress-fill" style="width: ${pct}%; background: ${colorObj.stroke};"></div>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>

                    <!-- 2. ALERTA DE PERMANÊNCIA CRÍTICA (> 2 DIAS) -->
                    ${totalCriticos > 0 ? `
                        <div style="margin-top: 14px; padding: 12px 14px; background: rgba(239, 68, 68, 0.08); border-left: 4px solid #ef4444; border-radius: 8px; display: flex; align-items: center; justify-content: space-between;">
                            <div>
                                <div style="font-size: 12.5px; font-weight: 800; color: #fca5a5;">
                                    <i class="fa-solid fa-triangle-exclamation" style="color: #ef4444; margin-right: 6px;"></i>
                                    ATENÇÃO: ${totalCriticos} PRODUTOS HÁ MAIS DE 2 DIAS PARADOS NO SETOR 01
                                </div>
                                <div style="font-size: 11px; color: #cbd5e1; margin-top: 2px;">
                                    Requerem ação prioritária para evitar atrasos no cronograma de produção.
                                </div>
                            </div>
                            <button class="exec-action-btn" onclick="window.crmFilterSetor01('criticos')" style="background: #ef4444; color: #ffffff; border: none; padding: 4px 10px; font-size: 11px; font-weight: 700;">
                                Ver Produtos (> 2d)
                            </button>
                        </div>
                    ` : ''}

                    <!-- 3. DISTRIBUIÇÃO POR SEMANA DE ENTREGA (COLUNA BK) -->
                    <div style="margin-top: 18px; padding-top: 14px; border-top: 1px solid var(--border-color);">
                        <div style="font-size: 12px; font-weight: 800; color: #c084fc; margin-bottom: 8px; display: flex; align-items: center; justify-content: space-between;">
                            <span><i class="fa-solid fa-calendar-days"></i> CRONOGRAMA DE ENTREGA (COLUNA BK / BL)</span>
                            <span style="font-size: 11px; color: var(--text-muted);">${Object.keys(semanaCounts).length} semanas</span>
                        </div>
                        <div class="dist-list">
                            ${renderDistributionList(semanaCounts, totalItems, 'purple')}
                        </div>
                    </div>
                </div>
            </div>

            <!-- BARRA DE CONTROLE, BUSCA E FILTROS RÁPIDOS -->
            <div class="table-card pdf-screen-controls" style="margin-top: 24px; padding: 14px 18px; margin-bottom: 20px;">
                <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;">
                    <!-- Campo de Busca em Tempo Real -->
                    <div style="display: flex; align-items: center; gap: 10px; flex: 1; min-width: 280px;">
                        <div style="position: relative; width: 100%;">
                            <i class="fa-solid fa-magnifying-glass" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text-muted); font-size: 13px;"></i>
                            <input 
                                type="text" 
                                class="crm-input" 
                                placeholder="Buscar por OP, Código, Descrição, Cliente, Status, Semana..." 
                                value="${state.setor01Search || ''}" 
                                oninput="window.crmSearchSetor01(this.value)"
                                style="padding-left: 36px; width: 100%; height: 38px; font-size: 12.5px; border-radius: 8px; background: rgba(15, 23, 42, 0.6); border: 1px solid var(--border-color);"
                            />
                        </div>
                        ${state.setor01Search ? `
                            <button class="exec-action-btn" onclick="window.crmSearchSetor01('')" title="Limpar busca">
                                <i class="fa-solid fa-xmark"></i>
                            </button>
                        ` : ''}
                    </div>

                    <!-- Alternadores de Visualização e Filtro Ativo -->
                    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                        ${activeFilterLabel ? `
                            <span class="badge badge-cyan" style="font-size: 11.5px; padding: 5px 10px; display: flex; align-items: center; gap: 6px;">
                                <i class="fa-solid fa-filter"></i> ${activeFilterLabel}
                                <i class="fa-solid fa-xmark" style="cursor: pointer;" onclick="window.crmFilterSetor01(null)" title="Limpar filtro"></i>
                            </span>
                        ` : ''}
                        
                        <div class="btn-group" style="background: rgba(15, 23, 42, 0.6); padding: 2px; border-radius: 8px; border: 1px solid var(--border-color);">
                            <button class="exec-action-btn ${state.setor01ViewMode === 'grid' ? 'active' : ''}" onclick="window.crmToggleSetor01ViewMode('grid')" title="Visualização em Grade de Fotos (4 por linha)" style="font-size: 12px; padding: 6px 12px;">
                                <i class="fa-solid fa-table-cells"></i> Fotos (4 colunas)
                            </button>
                            <button class="exec-action-btn ${state.setor01ViewMode === 'table' ? 'active' : ''}" onclick="window.crmToggleSetor01ViewMode('table')" title="Visualização em Tabela Detalhada" style="font-size: 12px; padding: 6px 12px;">
                                <i class="fa-solid fa-table-list"></i> Tabela
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- SEÇÃO DE FOTOS DOS PRODUTOS PENDENTES NO SETOR 01 (GRADE VISUAL 4 POR LINHA) -->
            ${state.setor01ViewMode === 'grid' ? `
                <div class="table-card" id="setor01GallerySection" style="border-top: 3px solid #00d4ff; margin-bottom: 24px;">
                    <div class="table-toolbar" style="border-bottom: 1px solid rgba(0, 212, 255, 0.2);">
                        <div class="table-title-group">
                            <h3 class="table-title" style="display: flex; align-items: center; gap: 8px; color: #ffffff;">
                                <i class="fa-solid fa-camera-retro" style="color: #00d4ff;"></i>
                                <span>Galeria Visual dos Produtos Pendentes no Setor 01</span>
                                <span class="badge badge-cyan" style="font-size: 10px; padding: 2px 8px;">FOTOS REAIS</span>
                            </h3>
                            <span class="badge badge-sub">${displayItems.length} produtos exibidos</span>
                        </div>
                    </div>

                    ${displayItems.length === 0 ? `
                        <div style="padding: 48px; text-align: center; color: var(--text-muted);">
                            <i class="fa-solid fa-clock-rotate-left" style="font-size: 32px; color: var(--text-muted); margin-bottom: 12px;"></i>
                            <p style="font-size: 14px; font-weight: 600;">Nenhum produto encontrado no Setor 01 para os filtros selecionados.</p>
                            <button class="exec-action-btn" onclick="window.crmFilterSetor01(null); window.crmSearchSetor01('');" style="margin-top: 10px;">
                                Limpar Todos os Filtros
                            </button>
                        </div>
                    ` : `
                        <!-- GRADE VISUAL 4 POR LINHA COM FOTOS E DIAS PENDENTES -->
                        <div class="s13-photo-grid" style="margin-top: 14px;">
                            ${displayItems.map(item => {
                                const imgInfo = getProductImage(item.codigo);
                                const isCritico = item.diasParado > 2;
                                const isAtraso = item.prazoStatus === 'ATRASO';
                                const escapedDesc = (item.descricao || 'Produto').replace(/'/g, "\\'");
                                const escapedCode = (item.codigo || '').replace(/'/g, "\\'");

                                return `
                                    <div class="s13-photo-card ${isCritico ? 'card-critico' : ''}">
                                        <!-- ÁREA DA FOTO -->
                                        <div class="s13-photo-wrapper">
                                            <!-- BADGE DO SETOR 01 NA FOTO -->
                                            <span class="s13-photo-tag" style="background: rgba(0, 212, 255, 0.92); color: #021226; font-weight: 900; top: 10px; left: 10px; border-radius: 6px; box-shadow: 0 0 10px rgba(0, 212, 255, 0.6); font-size: 11px; padding: 3px 8px;" title="Setor 01">
                                                <i class="fa-solid fa-clock-rotate-left"></i> SETOR 01
                                            </span>

                                            <!-- BADGE DO CLIENTE NA FOTO -->
                                            <span class="s13-photo-tag" style="top: 10px; right: 10px; left: auto; background: rgba(15, 23, 42, 0.85); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.4); font-size: 10.5px; font-weight: 700;" title="Cliente: ${item.cliente || '—'}">
                                                ${item.cliente || 'Sem Cliente'}
                                            </span>

                                            ${imgInfo.hasImage ? `
                                                <img src="${imgInfo.thumbUrl}" loading="lazy" class="s13-photo-img" alt="${item.codigo}" onerror="this.onerror=null; this.src='${imgInfo.proxyUrl}';">
                                                <div class="s13-photo-overlay" onclick="window.crmOpenImageLightbox('${imgInfo.largeUrl}', '${escapedCode}', 'OP ${item.op} • Setor 01 • ${escapedDesc}')">
                                                    <i class="fa-solid fa-magnifying-glass-plus" style="font-size: 24px; color: #00d4ff;"></i>
                                                    <span>Ampliar Foto</span>
                                                </div>
                                            ` : `
                                                <div class="s13-photo-placeholder" onclick="window.crmOpenOpModal('${item.op}')" title="Clique para detalhes da OP">
                                                    <i class="fa-solid fa-shirt s13-placeholder-icon"></i>
                                                    <strong style="color: #cbd5e1; font-size: 13.5px; font-family: monospace;">${item.codigo}</strong>
                                                    <span style="font-size: 10.5px; color: var(--text-muted);"><i class="fa-solid fa-camera-retro"></i> Aguardando foto na pasta</span>
                                                </div>
                                            `}
                                        </div>

                                        <!-- CORPO DO CARD COM INFORMAÇÕES COMPLETAS -->
                                        <div class="s13-card-body">
                                            <!-- Linha 1: Código e OP -->
                                            <div class="s13-card-code-row">
                                                <div class="s13-card-code" title="Código do Produto">${item.codigo}</div>
                                                <div style="display: flex; align-items: center; gap: 4px;">
                                                    <span class="s13-card-op-badge" title="Ordem de Produção" onclick="window.crmOpenOpModal('${item.op}')" style="cursor: pointer;">OP ${item.op}</span>
                                                </div>
                                            </div>

                                            <!-- Linha 2: Descrição -->
                                            <div class="s13-card-description" style="font-size: 12px; font-weight: 600; color: #e2e8f0; line-height: 1.35; max-height: 34px; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;" title="${item.descricao}">
                                                ${item.descricao || 'Produto pendente no Setor 01'}
                                            </div>

                                            <!-- Linha 3: SUPER DESTAQUE DE DIAS PENDENTES NO SETOR 01 -->
                                            <div style="margin-top: 6px; margin-bottom: 6px;">
                                                ${isCritico ? `
                                                    <div class="s13-dias-badge critico badge-pulse-red" style="background: rgba(239, 68, 68, 0.16); border: 1.5px solid #ef4444; color: #fca5a5; display: flex; align-items: center; justify-content: space-between; padding: 5px 10px; border-radius: 6px;">
                                                        <span style="font-size: 11px;"><i class="fa-solid fa-triangle-exclamation" style="color: #ef4444; margin-right: 4px;"></i> <strong>PENDÊNCIA NO SETOR:</strong></span>
                                                        <span style="font-weight: 900; color: #ffffff; background: #ef4444; padding: 2px 8px; border-radius: 4px; font-size: 11.5px;">${item.diasParado} DIAS</span>
                                                    </div>
                                                ` : `
                                                    <div class="s13-dias-badge normal" style="background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16, 185, 129, 0.4); color: #6ee7b7; display: flex; align-items: center; justify-content: space-between; padding: 5px 10px; border-radius: 6px;">
                                                        <span style="font-size: 11px;"><i class="fa-solid fa-clock" style="color: #10b981; margin-right: 4px;"></i> <strong>TEMPO NO SETOR:</strong></span>
                                                        <span style="font-weight: 800; color: #ffffff; background: #059669; padding: 2px 8px; border-radius: 4px; font-size: 11.5px;">${item.diasParado} DIAS</span>
                                                    </div>
                                                `}
                                            </div>

                                            <!-- Linha 4: Status do Produto / Local -->
                                            <div style="margin-top: 2px;">
                                                <span class="badge badge-sub" style="font-size: 11px; padding: 3px 8px; font-weight: 600; width: 100%; display: block; text-align: center; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;" title="${item.statusModelagem || item.descLocal || item.statusProd || 'SETOR 01'}">
                                                    <i class="fa-solid fa-location-dot" style="color: #38bdf8;"></i> ${item.statusModelagem || item.descLocal || item.statusProd || 'SETOR 01'}
                                                </span>
                                            </div>

                                            <!-- Linha 5: Grid de Metadados (Semana, Peças, Dias no Setor, Cliente) -->
                                            <div class="s13-card-meta-grid" style="grid-template-columns: repeat(2, 1fr); gap: 6px; margin-top: 6px;"><div class="s13-meta-item">
            <span class="s13-meta-label">OC / RIS</span>
            ${(item.oc || '').trim().toUpperCase().startsWith('S') || !(item.oc || '').trim() ? `<span class="s13-meta-val" style="color: #f97316; font-weight: 800; background: rgba(249,115,22,0.15); padding: 1px 4px; border-radius: 4px;">SEM OC</span>` : `<span class="s13-meta-val" style="color: #94a3b8; font-weight: 700;"><i class="fa-solid fa-file-invoice" style="margin-right:4px;"></i>${item.oc}</span>`}
        </div>
                                                <div class="s13-meta-item">
                                                    <span class="s13-meta-label">Semana Entrega (BK)</span>
                                                    <span class="s13-meta-val" style="color: #c084fc; font-weight: 700;" title="${item.pedDescPeriodo || item.pedPeriodo || '—'}">${item.pedDescPeriodo || item.pedPeriodo || '—'}</span>
                                                </div>
                                                <div class="s13-meta-item">
                                                    <span class="s13-meta-label">Peças Pedido (AP)</span>
                                                    <span class="s13-meta-val" style="color: #38bdf8; font-weight: 800;">${formatNumber(item.qtdeOriginal)}</span>
                                                </div>
                                                <div class="s13-meta-item">
                                                    <span class="s13-meta-label">Cliente</span>
                                                    <span class="s13-meta-val" title="${item.cliente || '—'}" style="color: #67e8f9; font-weight: 700;">${item.cliente || '—'}</span>
                                                </div>
                                                <div class="s13-meta-item">
                                                    <span class="s13-meta-label">Marca / Grupo</span>
                                                    <span class="s13-meta-val" title="${item.marca || item.tipoProduto || '—'}">${item.marca || item.tipoProduto || '—'}</span>
                                                </div>
                                                <div class="s13-meta-item">
                                                    <span class="s13-meta-label">Etiqueta</span>
                                                    <span class="s13-meta-val" style="color: #60a5fa; font-weight: 800;">${item.etiqueta || '—'}</span>
                                                </div>
                                                <div class="s13-meta-item">
                                                    <span class="s13-meta-label">Setor Aviamento</span>
                                                    <span class="s01-sector-chip-list">
                                                        ${item.setoresAviamento.length ? item.setoresAviamento.map(setor => `
                                                            <span class="s01-sector-chip ${setor === 'X01' ? 'danger badge-pulse-red' : 'success'}">SETOR ${setor}</span>
                                                        `).join('') : '<span class="s01-sector-chip empty">—</span>'}
                                                    </span>
                                                </div>
                                                <div class="s13-meta-item">
                                                    <span class="s13-meta-label">Setor Cor</span>
                                                    <span class="s01-sector-chip-list">
                                                        ${item.setoresCor.length ? item.setoresCor.map(setor => `
                                                            <span class="s01-sector-chip ${setor === 'D01' ? 'danger badge-pulse-red' : 'success'}">SETOR ${setor}</span>
                                                        `).join('') : '<span class="s01-sector-chip empty">—</span>'}
                                                    </span>
                                                </div>
                                            </div>

                                            <!-- Linha 6: Botão de Ação Rápida -->
                                            <div style="margin-top: 8px;">
                                                <button class="s13-btn-action primary" onclick="window.crmOpenOpModal('${item.op}')" style="width: 100%;" title="Ver Detalhes 360° da OP">
                                                    <i class="fa-solid fa-arrow-up-right-from-square"></i> Detalhes da OP
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    `}
                </div>
            ` : ''}

            <!-- TABELA DETALHADA DE PENDÊNCIAS DO SETOR 01 -->
            <div class="table-card pdf-detail-list" id="setor01TableSection" style="border-top: 3px solid #00d4ff; ${state.setor01ViewMode === 'table' ? '' : 'display: none;'}">
                <div class="table-toolbar" style="border-bottom: 1px solid rgba(0, 212, 255, 0.2);">
                    <div class="table-title-group">
                        <h3 class="table-title" style="display: flex; align-items: center; gap: 8px; color: #ffffff;">
                            <i class="fa-solid fa-table-list" style="color: #00d4ff;"></i>
                            <span>Lista Completa de OPs Pendentes no Setor 01</span>
                        </h3>
                        <span class="badge badge-sub">${displayItems.length} OPs listadas</span>
                    </div>
                </div>

                <div class="table-responsive">
                    <table class="crm-table">
                        <thead>
                            <tr>
                                <th>OP</th>
                                <th>Código & Produto</th>
                                <th>Cliente</th>
                                <th>Dias Pendente (Setor 01)</th>
                                <th>Status / Local (AY/BD)</th>
                                <th>Semana Entrega (Col BK)</th>
                                <th>Peças Pedido (AP)</th>
                                <th>Marca / Etiqueta</th>
                                <th>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${displayItems.length === 0 ? `
                                <tr>
                                    <td colspan="9" style="text-align: center; padding: 32px; color: var(--text-muted);">
                                        Nenhuma OP pendente no Setor 01 encontrada com os filtros atuais.
                                    </td>
                                </tr>
                            ` : displayItems.map(item => {
                                const isCritico = item.diasParado > 2;
                                const isAtraso = item.prazoStatus === 'ATRASO';
                                const imgInfo = getProductImage(item.codigo);
                                const escapedDesc = (item.descricao || 'Produto').replace(/'/g, "\\'");
                                const escapedCode = (item.codigo || '').replace(/'/g, "\\'");

                                return `
                                    <tr class="${isCritico ? 'row-danger' : (isAtraso ? 'row-warning' : '')}" onclick="window.crmOpenOpModal('${item.op}')" style="cursor: pointer;" title="Clique para abrir detalhes 360° da OP ${item.op}">
                                        <td class="table-op-cell">
                                            <span style="font-weight: 700; color: #00d4ff;">${item.op}</span>
                                        </td>
                                        <td>
                                            <div class="table-product-cell">
                                                ${imgInfo.hasImage ? `
                                                    <img src="${imgInfo.thumbUrl}" loading="lazy" class="table-product-thumb" alt="${item.codigo}" onerror="this.onerror=null; this.src='${imgInfo.proxyUrl}';">
                                                ` : `
                                                    <div class="table-product-thumb-placeholder">
                                                        <i class="fa-solid fa-shirt"></i>
                                                    </div>
                                                `}
                                                <div>
                                                    <div class="table-product-code" style="color: #ffffff; font-weight: 700;">${item.codigo}</div>
                                                    <div class="table-product-desc" style="font-size: 11.5px; color: var(--text-muted);">${item.descricao || 'Produto'}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <span class="badge badge-cyan" style="font-size: 11px; font-weight: 700;">
                                                ${item.cliente || '—'}
                                            </span>
                                        </td>
                                        <td>
                                            <span class="badge ${isCritico ? 'badge-rose badge-pulse-red' : 'badge-emerald'}" style="font-size: 11.5px; padding: 3px 8px;">
                                                <i class="fa-solid ${isCritico ? 'fa-triangle-exclamation' : 'fa-clock'}"></i> ${item.diasParado} dias
                                            </span>
                                        </td>
                                        <td>
                                            <span class="badge badge-sub" style="font-size: 11px;">
                                                ${item.statusModelagem || item.descLocal || item.statusProd || 'SETOR 01'}
                                            </span>
                                        </td>
                                        <td style="color: #c084fc; font-weight: 600;">
                                            ${item.pedDescPeriodo || item.pedPeriodo || '—'}
                                        </td>
                                        <td style="font-weight: 800; color: #38bdf8;">
                                            ${formatNumber(item.qtdeOriginal)}
                                        </td>
                                        <td style="font-size: 12px; color: #cbd5e1;">
                                            ${item.marca || '—'} ${item.etiqueta && item.etiqueta !== '—' ? `(Etq ${item.etiqueta})` : ''}
                                        </td>
                                        <td onclick="event.stopPropagation()">
                                            <div style="display: flex; align-items: center; gap: 6px;">
                                                ${imgInfo.hasImage ? `
                                                    <button class="exec-action-btn" onclick="window.crmOpenImageLightbox('${imgInfo.largeUrl}', '${escapedCode}', 'OP ${item.op} • Setor 01 • ${escapedDesc}')" title="Ver foto ampliada" style="padding: 4px 8px; font-size: 11px;">
                                                        <i class="fa-solid fa-image"></i>
                                                    </button>
                                                ` : ''}
                                                <button class="exec-action-btn" onclick="window.crmOpenOpModal('${item.op}')" title="Ver Detalhes 360°" style="padding: 4px 8px; font-size: 11px;">
                                                    <i class="fa-solid fa-arrow-up-right-from-square"></i>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    // =========================================================================
    // 4. MÓDULO ESTILO PEDIDO - SIT. ESTAMPA
    // =========================================================================
    function renderEstampaView(container) {
        // Regra do Usuário:
        // - produtos pendentes nos setores 05/06/12/13/26/20/31 (coluna AY)
        // - separar por STATUS DO PRODUTO (coluna BD)
        // - destacar em AZUL INTENSO PISCANDO os status:
        //   "pendente desenvolvimento", "aguar aprov. lic / conceito", "aguar aprovação pp sample"
        // - Layout executivo conforme tela 05, 06, 12 (Gráfico Grande Donut dividindo a tela 50%/50%)
        // - Mais abaixo, ANTES da lista/tabela: fotos dos produtos com pendência de estampa (4 por linha, formato Setor 13)
        // - Destaque claro de QUAL SETOR o produto está pendente na foto e no card!
        const targetSectors = ['05', '06', '12', '13', '26', '20', '31', '106'];
        const estampaItems = state.filteredData.filter(r => targetSectors.includes(r.setor));
        const totalItems = estampaItems.length;
        const totalPecas = estampaItems.reduce((sum, r) => sum + r.qtdeOriginal, 0);

        // Contagem de produtos por setor
        const setorCounts = countBy(estampaItems, 'setor');

        // Classificação: Com Pendência vs Sem Pendência
        const pendentesItems = estampaItems.filter(r => isEstampaStatusPendente(r.statusProd));
        const semPendenciaItems = estampaItems.filter(r => !isEstampaStatusPendente(r.statusProd));

        const pendentesCount = pendentesItems.length;
        const pendentesPecas = pendentesItems.reduce((sum, r) => sum + r.qtdeOriginal, 0);
        const pendentesPct = totalItems > 0 ? ((pendentesCount / totalItems) * 100).toFixed(1) : '0';

        const semPendenciaCount = semPendenciaItems.length;
        const semPendenciaPecas = semPendenciaItems.reduce((sum, r) => sum + r.qtdeOriginal, 0);
        const semPendenciaPct = totalItems > 0 ? ((semPendenciaCount / totalItems) * 100).toFixed(1) : '0';

        // Agrupamento detalhado por Status do Produto (Coluna BD)
        const statusMap = {};
        estampaItems.forEach(item => {
            const st = (item.statusProd || '').trim() || '[NÃO INFORMADO]';
            if (!statusMap[st]) {
                statusMap[st] = {
                    name: st,
                    isPendente: isEstampaStatusPendente(st),
                    count: 0,
                    pecas: 0,
                    setores: {},
                    items: []
                };
            }
            statusMap[st].count += 1;
            statusMap[st].pecas += item.qtdeOriginal;
            statusMap[st].setores[item.setor] = (statusMap[st].setores[item.setor] || 0) + 1;
            statusMap[st].items.push(item);
        });

        const allStatuses = Object.values(statusMap);
        const pendentesList = allStatuses.filter(s => s.isPendente).sort((a, b) => b.count - a.count);
        const liberadosList = allStatuses.filter(s => !s.isPendente).sort((a, b) => b.count - a.count);

        // Geometria Donut Chart SVG Gigante (como 05, 06, 12 - viewBox 0 0 440 440, raio 150)
        const radius = 150;
        const circumference = 2 * Math.PI * radius; // ~942.48
        const semPendenciaDash = totalItems > 0 ? (semPendenciaCount / totalItems) * circumference : circumference;
        const pendentesDash = totalItems > 0 ? (pendentesCount / totalItems) * circumference : 0;
        const pendentesOffset = -semPendenciaDash;

        // 1. Aplicar busca em tempo real se digitada
        let searchFilteredItems = estampaItems;
        if (state.estampaSearch && state.estampaSearch.trim().length > 0) {
            const q = state.estampaSearch.trim().toLowerCase();
            searchFilteredItems = estampaItems.filter(r => 
                (r.codigo || '').toLowerCase().includes(q) ||
                (r.op || '').toLowerCase().includes(q) ||
                (r.setor || '').toLowerCase().includes(q) ||
                (r.statusProd || '').toLowerCase().includes(q) ||
                (r.marca || '').toLowerCase().includes(q) ||
                (r.etiqueta || '').toLowerCase().includes(q) ||
                (r.descricao || '').toLowerCase().includes(q) ||
                (r.cliente || '').toLowerCase().includes(q) ||
                (r.pedDescPeriodo || '').toLowerCase().includes(q)
            );
        }

        // 3. Definir itens pendentes (para Fotos) e itens liberados (para Lista/Tabela)
        let displayPendingItems = searchFilteredItems.filter(r => isEstampaStatusPendente(r.statusProd));
        let displayReleasedItems = searchFilteredItems.filter(r => !isEstampaStatusPendente(r.statusProd));
        let activeFilterLabel = null;

        if (state.estampaFilter === 'pendentes') {
            displayReleasedItems = []; // Foco exclusivo nos pendentes
            activeFilterLabel = 'Produtos Com Pendência de Estampa (Ação Prioritária)';
        } else if (state.estampaFilter === 'sem_pendencia') {
            displayPendingItems = []; // Foco exclusivo nos liberados
            activeFilterLabel = 'Produtos Sem Pendência (Liberados / Aprovados)';
        } else if (state.estampaFilter) {
            const filterLower = state.estampaFilter.trim().toLowerCase();
            const isFilterPendente = isEstampaStatusPendente(state.estampaFilter);
            if (isFilterPendente) {
                displayPendingItems = displayPendingItems.filter(r => (r.statusProd || '[NÃO INFORMADO]').trim().toLowerCase() === filterLower);
                displayReleasedItems = [];
            } else {
                displayReleasedItems = displayReleasedItems.filter(r => (r.statusProd || '[NÃO INFORMADO]').trim().toLowerCase() === filterLower);
                displayPendingItems = [];
            }
            activeFilterLabel = `Status: ${state.estampaFilter}`;
        }

        container.innerHTML = `
            <!-- CABEÇALHO DO MÓDULO -->
            <div class="module-view-header" style="margin-bottom: 24px;">
                <div class="module-view-title-group">
                    <h2 style="font-size: 22px; font-weight: 800; color: var(--text-primary);">Módulo Estilo Pedido: SIT. ESTAMPA</h2>
                    <p class="module-view-description" style="font-size: 13px; color: var(--text-muted); margin-top: 4px;">
                        Situação de aprovação de arte, estamparia e conceito nos setores de produção (05, 06, 12, 13, 26, 20, 31).
                    </p>
                </div>
                <div class="btn-group" style="flex-wrap: wrap; gap: 6px;">
                    <span class="badge badge-purple" style="font-size: 12px; padding: 6px 14px;">${totalItems} OPs Mapeadas</span>
                    <span class="status-estampa-pendente-azul" style="font-size: 11px; padding: 5px 12px;" onclick="window.crmFilterEstampa('pendentes')" title="Filtrar pendências">${pendentesCount} Com Pendência</span>
                    <span class="badge badge-cyan" style="font-size: 12px; padding: 6px 14px;">${formatNumber(totalPecas)} pçs</span>
                </div>
            </div>

            <!-- PAINEL EXECUTIVO: GRÁFICO DE PIZZA GIGANTE (50%) + QUADRO DE STATUS (50%) -->
            <div class="exec-processo-layout">
                <!-- COLUNA ESQUERDA: DONUT GIGANTE (DOBRO DO TAMANHO) + CARDS MACRO -->
                <div class="hero-pie-chart-container">
                    <svg viewBox="0 0 440 440" class="hero-donut-svg">
                        <defs>
                            <filter id="glowDonutEstampaNormal" x="-30%" y="-30%" width="160%" height="160%">
                                <feDropShadow dx="0" dy="0" stdDeviation="12" flood-color="#00a8ff" flood-opacity="0.65"/>
                            </filter>
                            <filter id="glowDonutEstampaPendente" x="-30%" y="-30%" width="160%" height="160%">
                                <feDropShadow dx="0" dy="0" stdDeviation="14" flood-color="#ef4444" flood-opacity="0.9"/>
                            </filter>
                        </defs>
                        <g transform="rotate(-90 220 220)">
                            <!-- Trilha de fundo circular -->
                            <circle cx="220" cy="220" r="150" fill="none" stroke="#121624" stroke-width="58" />
                            
                            <!-- Fatia Sem Pendência (Azul #00a8ff) -->
                            <circle cx="220" cy="220" r="150" fill="none" stroke="#00a8ff" stroke-width="58"
                                stroke-dasharray="${semPendenciaDash.toFixed(2)} ${circumference.toFixed(2)}"
                                stroke-dashoffset="0"
                                filter="url(#glowDonutEstampaNormal)"
                                style="cursor: pointer;"
                                onclick="window.crmFilterEstampa('sem_pendencia')"
                            />
                            
                            <!-- Fatia Com Pendência (Vermelho #ef4444) -->
                            ${pendentesCount > 0 ? `
                                <circle cx="220" cy="220" r="150" fill="none" stroke="#ef4444" stroke-width="58"
                                stroke-dasharray="${pendentesDash.toFixed(2)} ${circumference.toFixed(2)}"
                                stroke-dashoffset="${pendentesOffset.toFixed(2)}"
                                filter="url(#glowDonutEstampaPendente)"
                                style="cursor: pointer;"
                                onclick="window.crmFilterEstampa('pendentes')"
                            />
                            ` : ''}
                        </g>
                        <!-- Texto Central Alinhado em Destaque Gigante -->
                        <text x="220" y="190" text-anchor="middle" dominant-baseline="central" fill="#ffffff" font-size="76" font-weight="900" font-family="system-ui, -apple-system, sans-serif" letter-spacing="-2px">${totalItems}</text>
                        <text x="220" y="246" text-anchor="middle" dominant-baseline="central" fill="#94a3b8" font-size="14" font-weight="800" letter-spacing="3px" font-family="system-ui, -apple-system, sans-serif">PRODUTOS</text>
                        <text x="220" y="272" text-anchor="middle" dominant-baseline="central" fill="#38bdf8" font-size="13" font-weight="800" letter-spacing="1.5px" font-family="system-ui, -apple-system, sans-serif">SIT. ESTAMPA</text>
                    </svg>

                    <!-- Legenda Rápida em Cards de Alto Contraste Lado a Lado -->
                    <div class="hero-pie-quick-legend">
                        <div class="donut-legend-card blue ${state.estampaFilter === 'sem_pendencia' ? 'active' : ''}" style="cursor: pointer; border-left: 4px solid #00a8ff;" onclick="window.crmFilterEstampa('sem_pendencia')" title="Clique para filtrar apenas produtos Sem Pendência">
                            <div class="donut-legend-label blue">
                                <span class="legend-dot" style="background: #00a8ff; box-shadow: 0 0 8px #00a8ff;"></span>
                                <div>
                                    <div style="font-weight: 700; font-size: 13px; color: #ffffff;">Sem Pendência (Liberados)</div>
                                    <div style="font-size: 11px; color: #bae6fd;">${formatNumber(semPendenciaPecas)} peças no fluxo (somente lista)</div>
                                </div>
                            </div>
                            <div style="text-align: right;">
                                <div class="donut-legend-value" style="font-size: 14px; color: #00a8ff;">${semPendenciaCount} prod (${semPendenciaPct}%)</div>
                                <span style="font-size: 10.5px; color: #00a8ff; text-decoration: underline;">Ver Lista ↓</span>
                            </div>
                        </div>

                        <div class="donut-legend-card red ${state.estampaFilter === 'pendentes' ? 'active' : ''}" style="cursor: pointer; border-left: 4px solid #ef4444; background: rgba(239, 68, 68, 0.08);" onclick="window.crmFilterEstampa('pendentes')" title="Clique para filtrar apenas produtos Com Pendência">
                            <div class="donut-legend-label red">
                                <span class="legend-dot" style="background: #ef4444; box-shadow: 0 0 10px #ef4444;"></span>
                                <div>
                                    <div style="font-weight: 700; font-size: 13px; color: #ffffff;">Pendências de Estampa</div>
                                    <div style="font-size: 11px; color: #fca5a5;">${formatNumber(pendentesPecas)} peças com fotos</div>
                                </div>
                            </div>
                            <div style="text-align: right;">
                                <div class="donut-legend-value" style="font-size: 14px; color: #f87171;">${pendentesCount} prod (${pendentesPct}%)</div>
                                <span style="font-size: 10.5px; color: #f87171; text-decoration: underline;">Ver Fotos ↓</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- COLUNA DIREITA: QUADRO EXECUTIVO POR STATUS (COLUNA BD) -->
                <div class="exec-card">
                    <div class="exec-card-header">
                        <div>
                            <div class="exec-card-title">
                                <i class="fa-solid fa-stamp" style="color: #38bdf8;"></i>
                                <span>Painel Executivo de Distribuição por Status (Coluna BD)</span>
                            </div>
                            <div class="exec-card-subtitle">
                                Clique em qualquer linha para filtrar instantaneamente os produtos abaixo
                            </div>
                        </div>
                        <div class="btn-group">
                            <button class="exec-action-btn" onclick="window.crmFilterEstampa(null)" title="Ver todos os produtos">
                                <i class="fa-solid fa-list"></i> Ver Todos (${totalItems})
                            </button>
                        </div>
                    </div>

                    <!-- 1. BLOCO STATUS COM PENDÊNCIA (AZUL INTENSO / CONCEITO / PP SAMPLE) -->
                    <div style="margin-bottom: 20px;">
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; padding-bottom: 6px; border-bottom: 1px solid rgba(0, 212, 255, 0.3);">
                            <span style="font-size: 12px; font-weight: 800; color: #38bdf8; letter-spacing: 0.5px;">
                                <i class="fa-solid fa-bell"></i> PENDÊNCIAS DE ESTAMPA / CONCEITO (${pendentesCount} PROD • EXIBIDOS COM FOTOS)
                            </span>
                            <span style="font-size: 11.5px; color: #7dd3fc; font-weight: 600;">
                                ${formatNumber(pendentesPecas)} peças
                            </span>
                        </div>

                        ${pendentesList.length === 0 ? `
                            <div style="padding: 12px; font-size: 12px; color: var(--text-muted); text-align: center; background: rgba(0,0,0,0.2); border-radius: 8px;">
                                <i class="fa-solid fa-circle-check" style="color: #10b981;"></i> Nenhuma pendência de estampa no momento.
                            </div>
                        ` : pendentesList.map(item => {
                            const pct = totalItems > 0 ? ((item.count / totalItems) * 100).toFixed(1) : '0';
                            const isSelected = state.estampaFilter === item.name;
                            const escaped = item.name.replace(/'/g, "\\'");
                            const setorKeys = Object.keys(item.setores);

                            return `
                                <div class="exec-status-row ${isSelected ? 'selected' : ''}" onclick="window.crmFilterEstampa('${escaped}')" title="Clique para filtrar por: ${item.name} (exibe com fotos)" style="border-left: 3px solid #00d4ff; background: ${isSelected ? 'rgba(0, 212, 255, 0.15)' : 'rgba(0, 212, 255, 0.03)'}; margin-bottom: 6px; padding: 8px 12px; border-radius: 6px; cursor: pointer;">
                                    <div class="exec-status-name-group" style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
                                        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                                            <span class="status-estampa-pendente-azul" style="font-size: 10px; padding: 2px 7px;">
                                                <i class="fa-solid fa-clock"></i> ${item.name}
                                            </span>
                                            <div style="display: flex; gap: 3px;">
                                                ${setorKeys.map(s => `<span class="badge badge-sub" style="font-size: 9.5px; padding: 1px 5px;">S${s}: ${item.setores[s]}</span>`).join('')}
                                            </div>
                                        </div>
                                        <div style="text-align: right; min-width: 130px;">
                                            <div style="font-size: 12.5px; font-weight: 800; color: #38bdf8;">${item.count} prod (${pct}%)</div>
                                            <div style="font-size: 11px; color: var(--text-muted);">${formatNumber(item.pecas)} pçs</div>
                                        </div>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>

                    <!-- 2. BLOCO STATUS SEM PENDÊNCIA (LIBERADOS / APROVADOS) -->
                    <div>
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; padding-bottom: 6px; border-bottom: 1px solid rgba(16, 185, 129, 0.25);">
                            <span style="font-size: 12px; font-weight: 800; color: #10b981; letter-spacing: 0.5px;">
                                <i class="fa-solid fa-circle-check"></i> FLUXO NORMAL / LIBERADOS (${semPendenciaCount} PROD • EXIBIDOS EM LISTA)
                            </span>
                            <span style="font-size: 11.5px; color: #6ee7b7; font-weight: 600;">
                                ${formatNumber(semPendenciaPecas)} peças
                            </span>
                        </div>

                        ${liberadosList.length === 0 ? `
                            <div style="padding: 12px; font-size: 12px; color: var(--text-muted); text-align: center; background: rgba(0,0,0,0.2); border-radius: 8px;">
                                Nenhum produto com status liberado.
                            </div>
                        ` : liberadosList.map(item => {
                            const pct = totalItems > 0 ? ((item.count / totalItems) * 100).toFixed(1) : '0';
                            const isSelected = state.estampaFilter === item.name;
                            const escaped = item.name.replace(/'/g, "\\'");
                            const setorKeys = Object.keys(item.setores);

                            return `
                                <div class="exec-status-row ${isSelected ? 'selected' : ''}" onclick="window.crmFilterEstampa('${escaped}')" title="Clique para filtrar por: ${item.name} (exibe na tabela)" style="border-left: 3px solid #10b981; background: ${isSelected ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.02)'}; margin-bottom: 6px; padding: 8px 12px; border-radius: 6px; cursor: pointer;">
                                    <div class="exec-status-name-group" style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
                                        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                                            <span class="status-estampa-normal" style="font-size: 10.5px; padding: 2px 7px;">
                                                <i class="fa-solid fa-circle-check" style="color: #10b981;"></i> ${item.name}
                                            </span>
                                            <div style="display: flex; gap: 3px;">
                                                ${setorKeys.map(s => `<span class="badge badge-sub" style="font-size: 9.5px; padding: 1px 5px;">S${s}: ${item.setores[s]}</span>`).join('')}
                                            </div>
                                        </div>
                                        <div style="text-align: right; min-width: 130px;">
                                            <div style="font-size: 12.5px; font-weight: 800; color: #10b981;">${item.count} prod (${pct}%)</div>
                                            <div style="font-size: 11px; color: var(--text-muted);">${formatNumber(item.pecas)} pçs</div>
                                        </div>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            </div>

            <!-- CONTROLES GERAIS E BARRA DE BUSCA -->
            <div class="table-card pdf-screen-controls" style="margin-bottom: 24px; padding: 16px 20px;">
                <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;">
                    <!-- Barra de Pesquisa Rápida -->
                    <div class="s13-search-box" style="flex: 1; max-width: 480px;">
                        <i class="fa-solid fa-magnifying-glass" style="color: var(--text-muted); font-size: 12px;"></i>
                        <input type="text" placeholder="Buscar por código, OP, setor, status, cliente..." value="${escapeHtml(state.estampaSearch || '')}" oninput="window.crmSearchEstampa(this.value)">
                        ${state.estampaSearch ? `
                            <i class="fa-solid fa-xmark" style="cursor: pointer; color: var(--text-muted);" onclick="window.crmSearchEstampa('')" title="Limpar busca"></i>
                        ` : ''}
                    </div>

                    <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                        ${activeFilterLabel ? `
                            <button class="filter-clear-btn" onclick="window.crmFilterEstampa(null)" title="Limpar filtro ativo">
                                <i class="fa-solid fa-xmark"></i> Limpar Filtro (${activeFilterLabel})
                            </button>
                        ` : ''}
                        <button class="toolbar-pill-btn btn-sync-images-action" onclick="window.crmSyncImages()" title="Sincronizar fotos do Google Drive agora" style="border-color: rgba(56, 189, 248, 0.4); color: #38bdf8;">
                            <i class="fa-solid fa-arrows-rotate" style="color: #38bdf8;"></i> Sincronizar Fotos
                        </button>
                        <button class="toolbar-pill-btn btn-export-pdf" onclick="window.crmGeneratePDFReport()" title="Gerar Relatório em PDF">
                            <i class="fa-solid fa-file-pdf" style="color: #ef4444;"></i> Gerar PDF
                        </button>
                        <button class="toolbar-pill-btn" onclick="window.crmExportFilteredCSV()">
                            <i class="fa-solid fa-download"></i> CSV
                        </button>
                    </div>
                </div>

                <!-- Banner Informativo de Filtro Ativo -->
                ${activeFilterLabel ? `
                    <div class="filter-active-banner" style="margin-top: 14px; margin-bottom: 0;">
                        <div class="filter-active-text">
                            <i class="fa-solid fa-filter"></i>
                            <span>Filtro Ativo: <strong>${activeFilterLabel}</strong> (${displayPendingItems.length} com fotos • ${displayReleasedItems.length} em lista)</span>
                        </div>
                        <button class="filter-clear-btn" onclick="window.crmFilterEstampa(null)">
                            <i class="fa-solid fa-xmark"></i> Exibir Todos
                        </button>
                    </div>
                ` : ''}
            </div>

            <!-- SEÇÃO 1: PRODUTOS COM PENDÊNCIA DE ESTAMPA (COM IMAGENS / FOTOS - 4 POR LINHA) -->
            ${state.estampaFilter !== 'sem_pendencia' ? `
                <div class="table-card" id="estampaGallerySection" style="margin-bottom: 28px; border-top: 3px solid #00d4ff;">
                    <div class="s13-gallery-toolbar pdf-screen-controls" style="border-bottom: 1px solid rgba(0, 212, 255, 0.2);">
                        <div class="table-title-group">
                            <h3 class="table-title" style="display: flex; align-items: center; gap: 8px; color: #ffffff;">
                                <i class="fa-solid fa-images" style="color: #00d4ff;"></i>
                                <span>Pendências de Estampa / Conceito / PP Sample</span>
                                <span class="status-estampa-pendente-azul" style="font-size: 10px; padding: 2px 8px;">AÇÃO PRIORITÁRIA</span>
                            </h3>
                            <span class="badge badge-cyan" style="font-weight: 800;">${displayPendingItems.length} produtos com imagens</span>
                        </div>
                    </div>

                    ${displayPendingItems.length === 0 ? `
                        <div style="text-align: center; padding: 36px 20px; color: var(--text-muted); background: rgba(0, 0, 0, 0.15); border-radius: 8px; margin-top: 12px;">
                            <i class="fa-solid fa-circle-check" style="font-size: 32px; color: #10b981; margin-bottom: 10px;"></i>
                            <p style="font-size: 14px; font-weight: 700; color: #ffffff;">Nenhuma pendência de estampa encontrada nos critérios atuais.</p>
                            <p style="font-size: 12px; margin-top: 4px;">Todos os produtos filtrados estão liberados ou sem pendência.</p>
                        </div>
                    ` : `
                        <!-- GRADE VISUAL 4 POR LINHA COM FOTOS E SETOR PENDENTE -->
                        <div class="s13-photo-grid" style="margin-top: 14px;">
                            ${displayPendingItems.map(item => {
                                const isPendente = isEstampaStatusPendente(item.statusProd);
                                const isAtraso = item.prazoStatus === 'ATRASO';
                                const imgInfo = getProductImage(item.codigo);
                                const escapedDesc = (item.descricao || 'Produto').replace(/'/g, "\\'");
                                const escapedCode = (item.codigo || '').replace(/'/g, "\\'");

                                return `
                                    <div class="s13-photo-card card-critico">
                                        <!-- ÁREA DA FOTO -->
                                        <div class="s13-photo-wrapper">
                                            <!-- BADGE DE DESTAQUE DO SETOR PENDENTE NA FOTO -->
                                            <span class="s13-photo-tag" style="background: rgba(14, 165, 233, 0.92); color: #ffffff; font-weight: 800; top: 10px; left: 10px; border-radius: 6px; box-shadow: 0 0 10px rgba(14, 165, 233, 0.6); font-size: 11px; padding: 3px 8px;" title="Setor Onde o Pedido Está Pendente">
                                                <i class="fa-solid fa-industry"></i> SETOR ${item.setor}
                                            </span>

                                            ${imgInfo.hasImage ? `
                                                <img src="${imgInfo.thumbUrl}" loading="lazy" class="s13-photo-img" alt="${item.codigo}" onerror="this.onerror=null; this.src='${imgInfo.proxyUrl}';">
                                                <div class="s13-photo-overlay" onclick="window.crmOpenImageLightbox('${imgInfo.largeUrl}', '${escapedCode}', 'OP ${item.op} • Setor ${item.setor} • ${escapedDesc}')">
                                                    <i class="fa-solid fa-magnifying-glass-plus" style="font-size: 24px; color: #38bdf8;"></i>
                                                    <span>Ampliar Foto</span>
                                                </div>
                                                <span class="s13-photo-tag" style="top: 10px; right: 10px; left: auto;" title="Foto vinculada do Google Drive">
                                                    <i class="fa-brands fa-google-drive" style="color: #34d399;"></i> Drive
                                                </span>
                                            ` : `
                                                <div class="s13-photo-placeholder" onclick="window.crmOpenOpModal('${item.op}')" title="Clique para detalhes da OP">
                                                    <i class="fa-solid fa-shirt s13-placeholder-icon"></i>
                                                    <strong style="color: #cbd5e1; font-size: 13.5px; font-family: monospace;">${item.codigo}</strong>
                                                    <span style="font-size: 10.5px; color: var(--text-muted);"><i class="fa-solid fa-camera-retro"></i> Aguardando foto na pasta</span>
                                                </div>
                                            `}
                                        </div>

                                        <!-- CORPO DO CARD COM INFORMAÇÕES COMPLETAS -->
                                        <div class="s13-card-body">
                                            <!-- Linha 1: Código e OP + Badges de Etiqueta -->
                                            <div class="s13-card-code-row">
                                                <div class="s13-card-code" title="Código do Produto">${item.codigo}</div>
                                                <div style="display: flex; align-items: center; gap: 4px;">
                                                    ${item.etiqueta && item.etiqueta !== '—' ? `
                                                        <span class="badge badge-sub" style="font-size: 10.5px; padding: 2px 6px; color: #60a5fa; border-color: rgba(96, 165, 250, 0.3);" title="Etiqueta: ${item.etiqueta}">
                                                            Etq ${item.etiqueta}
                                                        </span>
                                                    ` : ''}
                                                    <span class="s13-card-op-badge" title="Ordem de Produção">OP ${item.op}</span>
                                                </div>
                                            </div>

                                            <!-- Linha 2: Descrição -->
                                            <div style="font-size: 12px; font-weight: 600; color: #e2e8f0; line-height: 1.35; max-height: 34px; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;" title="${item.descricao}">
                                                ${item.descricao || 'Produto sem descrição cadastrada'}
                                            </div>

                                            <!-- Linha 3: Destaque do Setor Pendente -->
                                            <div style="margin-top: 4px; margin-bottom: 4px;">
                                                <div class="s13-dias-badge normal" style="background: rgba(56, 189, 248, 0.12); border: 1px solid rgba(56, 189, 248, 0.4); color: #38bdf8; display: flex; align-items: center; justify-content: space-between; padding: 5px 10px;">
                                                    <span style="font-size: 11px;"><i class="fa-solid fa-industry" style="color: #38bdf8; margin-right: 4px;"></i> <strong>SETOR PENDENTE:</strong></span>
                                                    <span style="font-weight: 800; color: #ffffff; background: #0284c7; padding: 2px 8px; border-radius: 4px; font-size: 11px;">SETOR ${item.setor}</span>
                                                </div>
                                            </div>

                                            <!-- Linha 4: Status do Produto (Coluna BD) com destaque de Estampa -->
                                            <div style="margin-top: 2px;">
                                                ${renderStatusProdutoBadge(item.statusProd)}
                                            </div>

                                            <!-- Linha 5: Grid de Metadados (Semana, Peças, Dias no Setor, Cliente) -->
                                            <div class="s13-card-meta-grid" style="grid-template-columns: repeat(2, 1fr); gap: 6px; margin-top: 6px;"><div class="s13-meta-item">
            <span class="s13-meta-label">OC / RIS</span>
            ${(item.oc || '').trim().toUpperCase().startsWith('S') || !(item.oc || '').trim() ? `<span class="s13-meta-val" style="color: #f97316; font-weight: 800; background: rgba(249,115,22,0.15); padding: 1px 4px; border-radius: 4px;">SEM OC</span>` : `<span class="s13-meta-val" style="color: #94a3b8; font-weight: 700;"><i class="fa-solid fa-file-invoice" style="margin-right:4px;"></i>${item.oc}</span>`}
        </div>
                                                <div class="s13-meta-item">
                                                    <span class="s13-meta-label">Semana Entrega</span>
                                                    <span class="s13-meta-val" style="color: #c084fc; font-weight: 700;" title="${item.pedDescPeriodo || item.pedPeriodo || '—'}">${item.pedDescPeriodo || item.pedPeriodo || '—'}</span>
                                                </div>
                                                <div class="s13-meta-item">
                                                    <span class="s13-meta-label">Peças Pedido (AP)</span>
                                                    <span class="s13-meta-val" style="color: #38bdf8; font-weight: 800;">${formatNumber(item.qtdeOriginal)}</span>
                                                </div>
                                                <div class="s13-meta-item">
                                                    <span class="s13-meta-label">Dias no Setor</span>
                                                    <span class="s13-meta-val" style="color: #f59e0b; font-weight: 700;">${item.diasParado} dias</span>
                                                </div>
                                                <div class="s13-meta-item">
                                                    <span class="s13-meta-label">Cliente</span>
                                                    <span class="s13-meta-val" title="${item.cliente || '—'}">${item.cliente || '—'}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    `}
                </div>
            ` : ''}

            <!-- SEÇÃO 2: PRODUTOS LIBERADOS / SEM PENDÊNCIA (SOMENTE LISTA / TABELA DETALHADA) -->
            ${state.estampaFilter !== 'pendentes' ? `
                <div class="table-card pdf-detail-list" id="estampaTableSection" style="border-top: 3px solid #10b981;">
                    <div class="table-toolbar" style="border-bottom: 1px solid rgba(16, 185, 129, 0.2);">
                        <div class="table-title-group">
                            <h3 class="table-title" style="display: flex; align-items: center; gap: 8px; color: #ffffff;">
                                <i class="fa-solid fa-circle-check" style="color: #10b981;"></i>
                                <span>Produtos Liberados para Produção (Fluxo Normal)</span>
                                <span class="badge badge-emerald" style="font-size: 10px; padding: 2px 8px;">SOMENTE LISTA</span>
                            </h3>
                            <span class="badge badge-sub">${displayReleasedItems.length} produtos no fluxo</span>
                        </div>
                    </div>

                    <div class="table-responsive">
                        <table class="crm-table">
                            <thead>
                                <tr>
                                    <th>OP</th>
                                    <th>Código & Produto</th>
                                    <th>Setor Pendente (AY)</th>
                                    <th>Status do Produto (Coluna BD)</th>
                                    <th>Semana Entrega (Col BK)</th>
                                    <th>Peças Pedido (AP)</th>
                                    <th>Dias no Setor</th>
                                    <th>Cliente</th>
                                    <th>Prazo Geral</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${displayReleasedItems.length === 0 ? `
                                    <tr>
                                        <td colspan="9" style="text-align: center; padding: 32px; color: var(--text-muted);">
                                            Nenhum produto liberado encontrado com os filtros atuais.
                                        </td>
                                    </tr>
                                ` : displayReleasedItems.map(item => {
                                    const isAtraso = item.prazoStatus === 'ATRASO';
                                    return `
                                        <tr class="${isAtraso ? 'row-danger' : ''}" onclick="window.crmOpenOpModal('${item.op}')" style="cursor: pointer;" title="Clique para abrir detalhes 360° da OP ${item.op}">
                                            <td class="table-op-cell">
                                                <span style="font-weight: 700; color: #38bdf8;">${item.op}</span>
                                            </td>
                                            <td>
                                                <div class="table-prod-cell">
                                                    <span class="prod-code">${item.codigo}</span>
                                                    <span class="prod-name" title="${item.descricao}">${item.descricao || 'PRODUTO'}</span>
                                                </div>
                                            </td>
                                            <td><span class="badge badge-cyan" style="font-weight: 800;">Setor ${item.setor}</span></td>
                                            <td>${renderStatusProdutoBadge(item.statusProd)}</td>
                                            <td><strong>${item.pedDescPeriodo || item.pedPeriodo || '—'}</strong></td>
                                            <td style="font-weight: 700; color: var(--text-primary);">${formatNumber(item.qtdeOriginal)}</td>
                                            <td><span class="badge badge-sub">${item.diasParado} d</span></td>
                                            <td>${item.cliente || '—'}</td>
                                            <td>
                                                ${isAtraso ? 
                                                    '<span class="badge badge-rose"><i class="fa-solid fa-clock"></i> Em Atraso</span>' : 
                                                    '<span class="badge badge-emerald"><i class="fa-solid fa-check"></i> No Prazo</span>'
                                                }
                                            </td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            ` : ''}
        `;
    }

    // =========================================================================
    // 5. MÓDULO ESTILO PEDIDO - CORES PENDENTES (SETOR D01)
    // =========================================================================
    function renderCoresPendentesView(container) {
        // Regras do Usuário:
        // - Pendência Setor D01 dividida por Cliente (Gráfico 1 Donut Grande 440x440)
        // - Segundo Gráfico: Quantidade de cores pendentes dividido por Responsável (Coluna B)
        //   buscando da planilha Google Drive (gid=722944309)
        // - Lista de produtos pendentes no setor D01 abaixo (tabela com dias, OP, código, etc.)
        const d01Items = state.filteredData.filter(r => r.setor === 'D01');
        const totalItems = d01Items.length;
        const totalPecas = d01Items.reduce((sum, r) => sum + r.qtdeOriginal, 0);

        // Paleta de Cores Neon
        const clientColorPalette = [
            { stroke: '#00d4ff', glow: '#0284c7' },
            { stroke: '#a855f7', glow: '#7c3aed' },
            { stroke: '#f59e0b', glow: '#d97706' },
            { stroke: '#10b981', glow: '#059669' },
            { stroke: '#ef4444', glow: '#dc2626' },
            { stroke: '#ec4899', glow: '#db2777' },
            { stroke: '#06b6d4', glow: '#0891b2' },
            { stroke: '#eab308', glow: '#ca8a04' }
        ];

        // 1. Agrupamento por Cliente para SETOR D01 (CRM Oneda)
        const d01ClientMap = {};
        d01Items.forEach(item => {
            const cli = item.cliente || 'OUTROS';
            if (!d01ClientMap[cli]) {
                d01ClientMap[cli] = { name: cli, count: 0, pecas: 0, items: [] };
            }
            d01ClientMap[cli].count += 1;
            d01ClientMap[cli].pecas += item.qtdeOriginal;
            d01ClientMap[cli].items.push(item);
        });
        const d01ClientList = Object.values(d01ClientMap).sort((a, b) => b.count - a.count);

        // Geometria Donut SVG Gigante (viewBox 0 0 440 440, raio 150)
        const radius = 150;
        const circumference = 2 * Math.PI * radius; // ~942.48

        // Fatias do Donut D01 (Clientes)
        let accumD01 = 0;
        const d01Slices = d01ClientList.map((cliData, idx) => {
            const colorObj = clientColorPalette[idx % clientColorPalette.length];
            const dash = d01Items.length > 0 ? (cliData.count / d01Items.length) * circumference : 0;
            const currentOffset = -accumD01;
            accumD01 += dash;
            return {
                ...cliData,
                color: colorObj.stroke,
                glowColor: colorObj.glow,
                dash: dash.toFixed(2),
                offset: currentOffset.toFixed(2),
                percent: d01Items.length > 0 ? ((cliData.count / d01Items.length) * 100).toFixed(1) : '0'
            };
        });

        // 2. Dados da Planilha Externa de Cores (Google Drive - Responsável / Coluna B)
        const coresExt = state.coresExternalData || { count: 0, byResponsavel: {}, records: [], isLive: false };
        const coresRespList = Object.entries(coresExt.byResponsavel || {})
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count);
        
        const coresRespTotal = coresRespList.reduce((sum, r) => sum + r.count, 0) || coresExt.count || 0;

        let accumCoresResp = 0;
        const coresRespSlices = coresRespList.map((respData, idx) => {
            const colorObj = clientColorPalette[idx % clientColorPalette.length];
            const dash = coresRespTotal > 0 ? (respData.count / coresRespTotal) * circumference : 0;
            const currentOffset = -accumCoresResp;
            accumCoresResp += dash;
            return {
                ...respData,
                color: colorObj.stroke,
                glowColor: colorObj.glow,
                dash: dash.toFixed(2),
                offset: currentOffset.toFixed(2),
                percent: coresRespTotal > 0 ? ((respData.count / coresRespTotal) * 100).toFixed(1) : '0'
            };
        });

        // 3. Aplicar busca em tempo real
        let searchFilteredItems = d01Items;
        if (state.coresSearch && state.coresSearch.trim().length > 0) {
            const q = state.coresSearch.trim().toLowerCase();
            searchFilteredItems = d01Items.filter(r => 
                (r.codigo || '').toLowerCase().includes(q) ||
                (r.op || '').toLowerCase().includes(q) ||
                (r.statusModelagem || '').toLowerCase().includes(q) ||
                (r.descLocal || '').toLowerCase().includes(q) ||
                (r.statusProd || '').toLowerCase().includes(q) ||
                (r.marca || '').toLowerCase().includes(q) ||
                (r.etiqueta || '').toLowerCase().includes(q) ||
                (r.descricao || '').toLowerCase().includes(q) ||
                (r.cliente || '').toLowerCase().includes(q) ||
                (r.pedDescPeriodo || '').toLowerCase().includes(q)
            );
        }

        // 4. Aplicar filtros ativos
        let displayItems = searchFilteredItems;
        let activeFilterLabel = null;

        if (state.coresFilter && state.coresFilter.field === 'cliente') {
            const { clientName } = state.coresFilter;
            displayItems = searchFilteredItems.filter(r => (r.cliente || '').trim().toLowerCase() === clientName.trim().toLowerCase());
            activeFilterLabel = `Cliente: ${clientName}`;
        }

        container.innerHTML = `
            <!-- CABEÇALHO DO MÓDULO -->
            <div class="module-view-header" style="margin-bottom: 24px;">
                <div class="module-view-title-group">
                    <h2 style="font-size: 22px; font-weight: 800; color: var(--text-primary); display: flex; align-items: center; gap: 10px;">
                        <i class="fa-solid fa-palette" style="color: #00d4ff;"></i>
                        <span>Módulo Estilo Pedido: CORES PENDENTES (Setor D01)</span>
                    </h2>
                    <p class="module-view-description" style="font-size: 13px; color: var(--text-muted); margin-top: 4px;">
                        Visão unificada das pendências de cores no Setor D01 e integração direta com a planilha de responsáveis do Google Drive.
                    </p>
                </div>
                <div class="btn-group" style="flex-wrap: wrap; gap: 8px;">
                    <span class="badge badge-cyan" style="font-size: 12px; padding: 6px 14px;">
                        <i class="fa-solid fa-palette"></i> ${totalItems} OPs em D01
                    </span>
                    <span class="badge badge-purple" style="font-size: 12px; padding: 6px 14px;">
                        <i class="fa-solid fa-layer-group"></i> ${coresRespTotal} Cores na Planilha Drive
                    </span>
                    <span class="badge badge-emerald" style="font-size: 12px; padding: 6px 14px;">
                        <i class="fa-solid fa-shirt"></i> ${formatNumber(totalPecas)} pçs
                    </span>
                    <button class="btn btn-glass" onclick="window.crmSyncExternalSheets('cores')" style="font-size: 11.5px; padding: 6px 12px;" title="Atualizar dados da planilha do Drive">
                        <i class="fa-solid fa-arrows-rotate"></i> Sincronizar Drive
                    </button>
                </div>
            </div>

            <!-- GRID DOS DOIS GRÁFICOS GRANDES (50% / 50%) -->
            <div class="exec-processo-layout" style="grid-template-columns: repeat(auto-fit, minmax(420px, 1fr)); gap: 24px; margin-bottom: 24px;">
                
                <!-- GRÁFICO 1: SETOR D01 - CORES CRM (DIVIDIDO POR CLIENTES) -->
                <div class="hero-pie-chart-container" style="background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(0, 212, 255, 0.35); border-radius: 14px; padding: 22px;">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <i class="fa-solid fa-palette" style="color: #00d4ff; font-size: 18px;"></i>
                            <h3 style="font-size: 16px; font-weight: 800; color: #ffffff; margin: 0;">SETOR D01 • POR CLIENTE (CRM)</h3>
                        </div>
                        <span class="badge badge-cyan" style="font-size: 11px; padding: 3px 8px;">
                            ${d01Items.length} OPs
                        </span>
                    </div>

                    <svg viewBox="0 0 440 440" class="hero-donut-svg">
                        <defs>
                            ${d01Slices.map((slice, idx) => `
                                <filter id="glowDonutCoresCli_${idx}" x="-30%" y="-30%" width="160%" height="160%">
                                    <feDropShadow dx="0" dy="0" stdDeviation="12" flood-color="${slice.color}" flood-opacity="0.85"/>
                                </filter>
                            `).join('')}
                        </defs>
                        <g transform="rotate(-90 220 220)">
                            <!-- Trilha de fundo circular -->
                            <circle cx="220" cy="220" r="150" fill="none" stroke="#121624" stroke-width="58" />
                            
                            <!-- Fatias por Cliente D01 -->
                            ${d01Items.length > 0 ? d01Slices.map((slice, idx) => `
                                <circle cx="220" cy="220" r="150" fill="none" stroke="${slice.color}" stroke-width="58"
                                    stroke-dasharray="${slice.dash} ${circumference.toFixed(2)}"
                                    stroke-dashoffset="${slice.offset}"
                                    filter="url(#glowDonutCoresCli_${idx})"
                                    style="cursor: pointer; transition: all 0.3s ease;"
                                    onclick="window.crmFilterCoresPendentes({ field: 'cliente', clientName: '${slice.name.replace(/'/g, "\\'")}' })"
                                />
                            `).join('') : `
                                <circle cx="220" cy="220" r="150" fill="none" stroke="#334155" stroke-width="58"
                                    stroke-dasharray="${circumference.toFixed(2)} ${circumference.toFixed(2)}"
                                    stroke-dashoffset="0"
                                />
                            `}
                        </g>
                        <!-- Texto Central -->
                        <text x="220" y="190" text-anchor="middle" dominant-baseline="central" fill="#ffffff" font-size="76" font-weight="900" font-family="system-ui, -apple-system, sans-serif" letter-spacing="-2px">${d01Items.length}</text>
                        <text x="220" y="246" text-anchor="middle" dominant-baseline="central" fill="#94a3b8" font-size="14" font-weight="800" letter-spacing="3px" font-family="system-ui, -apple-system, sans-serif">PRODUTOS</text>
                        <text x="220" y="272" text-anchor="middle" dominant-baseline="central" fill="#00d4ff" font-size="13" font-weight="800" letter-spacing="1.5px" font-family="system-ui, -apple-system, sans-serif">SETOR D01 (CORES)</text>
                    </svg>

                    <!-- Legenda Rápida de Clientes do D01 -->
                    <div class="hero-pie-quick-legend" style="grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); margin-top: 14px;">
                        ${d01Slices.map(slice => {
                            const isSelected = state.coresFilter && state.coresFilter.field === 'cliente' && state.coresFilter.clientName === slice.name;
                            const escaped = slice.name.replace(/'/g, "\\'");
                            return `
                                <div class="donut-legend-card ${isSelected ? 'active' : ''}" style="cursor: pointer; border-left: 4px solid ${slice.color}; background: rgba(15, 23, 42, 0.7);" onclick="window.crmFilterCoresPendentes({ field: 'cliente', clientName: '${escaped}' })" title="Filtrar ${slice.name} em D01">
                                    <div class="donut-legend-label">
                                        <span class="legend-dot" style="background: ${slice.color}; box-shadow: 0 0 8px ${slice.color};"></span>
                                        <div>
                                            <div style="font-weight: 700; font-size: 12.5px; color: #ffffff;">${slice.name}</div>
                                            <div style="font-size: 11px; color: var(--text-muted);">${formatNumber(slice.pecas)} pçs</div>
                                        </div>
                                    </div>
                                    <div style="text-align: right;">
                                        <div class="donut-legend-value" style="font-size: 13.5px; color: ${slice.color};">${slice.count} prod (${slice.percent}%)</div>
                                        <span style="font-size: 10px; color: ${slice.color}; text-decoration: underline;">Filtrar ↓</span>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>

                <!-- GRÁFICO 2: PLANILHA DRIVE - CORES PENDENTES POR RESPONSÁVEL (COLUNA B) -->
                <div class="hero-pie-chart-container" style="background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(168, 85, 247, 0.35); border-radius: 14px; padding: 22px;">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <i class="fa-solid fa-users-gear" style="color: #a855f7; font-size: 18px;"></i>
                            <h3 style="font-size: 16px; font-weight: 800; color: #ffffff; margin: 0;">CORES • POR RESPONSÁVEL (DRIVE)</h3>
                        </div>
                        <a href="https://docs.google.com/spreadsheets/d/1j7k8WWvE9m4YZrw7qadANIcx_XtOzAlwYfWnm0AC5sA/edit?gid=722944309#gid=722944309" target="_blank" class="badge badge-purple" style="font-size: 11px; padding: 3px 8px; text-decoration: none;" title="Abrir planilha no Google Drive">
                            <i class="fa-solid fa-arrow-up-right-from-square"></i> Planilha Drive
                        </a>
                    </div>

                    <svg viewBox="0 0 440 440" class="hero-donut-svg">
                        <defs>
                            ${coresRespSlices.map((slice, idx) => `
                                <filter id="glowDonutCoresResp_${idx}" x="-30%" y="-30%" width="160%" height="160%">
                                    <feDropShadow dx="0" dy="0" stdDeviation="12" flood-color="${slice.color}" flood-opacity="0.85"/>
                                </filter>
                            `).join('')}
                        </defs>
                        <g transform="rotate(-90 220 220)">
                            <!-- Trilha de fundo circular -->
                            <circle cx="220" cy="220" r="150" fill="none" stroke="#121624" stroke-width="58" />
                            
                            <!-- Fatias por Responsável -->
                            ${coresRespTotal > 0 ? coresRespSlices.map((slice, idx) => `
                                <circle cx="220" cy="220" r="150" fill="none" stroke="${slice.color}" stroke-width="58"
                                    stroke-dasharray="${slice.dash} ${circumference.toFixed(2)}"
                                    stroke-dashoffset="${slice.offset}"
                                    filter="url(#glowDonutCoresResp_${idx})"
                                    style="transition: all 0.3s ease;"
                                />
                            `).join('') : `
                                <circle cx="220" cy="220" r="150" fill="none" stroke="#334155" stroke-width="58"
                                    stroke-dasharray="${circumference.toFixed(2)} ${circumference.toFixed(2)}"
                                    stroke-dashoffset="0"
                                />
                            `}
                        </g>
                        <!-- Texto Central -->
                        <text x="220" y="190" text-anchor="middle" dominant-baseline="central" fill="#ffffff" font-size="76" font-weight="900" font-family="system-ui, -apple-system, sans-serif" letter-spacing="-2px">${coresRespTotal}</text>
                        <text x="220" y="246" text-anchor="middle" dominant-baseline="central" fill="#c084fc" font-size="14" font-weight="800" letter-spacing="3px" font-family="system-ui, -apple-system, sans-serif">CORES PENDENTES</text>
                        <text x="220" y="272" text-anchor="middle" dominant-baseline="central" fill="#a855f7" font-size="13" font-weight="800" letter-spacing="1.5px" font-family="system-ui, -apple-system, sans-serif">PLANILHA GOOGLE DRIVE</text>
                    </svg>

                    <!-- Legenda Rápida de Responsáveis da Planilha de Cores -->
                    <div class="hero-pie-quick-legend" style="grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); margin-top: 14px;">
                        ${coresRespSlices.length > 0 ? coresRespSlices.map(slice => `
                            <div class="donut-legend-card" style="border-left: 4px solid ${slice.color}; background: rgba(15, 23, 42, 0.7);">
                                <div class="donut-legend-label">
                                    <span class="legend-dot" style="background: ${slice.color}; box-shadow: 0 0 8px ${slice.color};"></span>
                                    <div>
                                        <div style="font-weight: 700; font-size: 13px; color: #ffffff;">${slice.name}</div>
                                        <div style="font-size: 11px; color: var(--text-muted);">Responsável (Col B)</div>
                                    </div>
                                </div>
                                <div style="text-align: right;">
                                    <div class="donut-legend-value" style="font-size: 14px; color: ${slice.color};">${slice.count} cores</div>
                                    <span style="font-size: 10.5px; color: var(--text-muted);">${slice.percent}%</span>
                                </div>
                            </div>
                        `).join('') : `
                            <div style="grid-column: 1 / -1; text-align: center; padding: 18px; color: var(--text-muted); font-size: 12.5px;">
                                <i class="fa-solid fa-cloud-arrow-down"></i> Dados da planilha de cores em sincronização. Clique em "Sincronizar Drive".
                            </div>
                        `}
                    </div>
                </div>

            </div>

            <!-- BARRA DE CONTROLE, BUSCA E FILTROS RÁPIDOS -->
            <div class="table-card" style="margin-top: 24px; padding: 14px 18px; margin-bottom: 20px;">
                <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;">
                    <!-- Campo de Busca em Tempo Real -->
                    <div style="display: flex; align-items: center; gap: 10px; flex: 1; min-width: 280px;">
                        <div style="position: relative; width: 100%;">
                            <i class="fa-solid fa-magnifying-glass" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text-muted); font-size: 13px;"></i>
                            <input 
                                type="text" 
                                class="crm-input" 
                                placeholder="Buscar produtos em D01 por OP, Código, Descrição, Cliente..." 
                                value="${state.coresSearch || ''}" 
                                oninput="window.crmSearchCoresPendentes(this.value)"
                                style="padding-left: 36px; width: 100%; height: 38px; font-size: 12.5px; border-radius: 8px; background: rgba(15, 23, 42, 0.6); border: 1px solid var(--border-color);"
                            />
                        </div>
                        ${state.coresSearch ? `
                            <button class="exec-action-btn" onclick="window.crmSearchCoresPendentes('')" title="Limpar busca">
                                <i class="fa-solid fa-xmark"></i>
                            </button>
                        ` : ''}
                    </div>

                    <!-- Alternadores de Visualização e Filtro Ativo -->
                    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                        <button class="exec-action-btn ${!state.coresFilter ? 'active' : ''}" onclick="window.crmFilterCoresPendentes(null)" title="Ver todos">
                            Todos (${totalItems})
                        </button>

                        ${activeFilterLabel ? `
                            <span class="badge badge-purple" style="font-size: 11.5px; padding: 5px 10px; display: flex; align-items: center; gap: 6px;">
                                <i class="fa-solid fa-filter"></i> ${activeFilterLabel}
                                <i class="fa-solid fa-xmark" style="cursor: pointer;" onclick="window.crmFilterCoresPendentes(null)" title="Limpar filtro"></i>
                            </span>
                        ` : ''}
                    </div>
                </div>
            </div>

            <!-- TABELA DETALHADA DE PRODUTOS NO SETOR D01 (CORES PENDENTES NO CRM) -->
            <div class="table-card" style="border-top: 3px solid #00d4ff; margin-bottom: 24px;">
                <div class="table-toolbar" style="border-bottom: 1px solid rgba(0, 212, 255, 0.2); justify-content: space-between;">
                    <div class="table-title-group">
                        <h3 class="table-title" style="display: flex; align-items: center; gap: 8px; color: #ffffff;">
                            <i class="fa-solid fa-table-list" style="color: #00d4ff;"></i>
                            <span>Lista de Produtos Pendentes no Setor D01 (Cores - CRM Oneda)</span>
                        </h3>
                        <span class="badge badge-sub">${displayItems.length} OPs listadas</span>
                    </div>
                </div>

                <div class="table-responsive">
                    <table class="crm-table">
                        <thead>
                            <tr>
                                <th>OP</th>
                                <th>Código do Produto</th>
                                <th>Descrição</th>
                                <th>Setor Pendente</th>
                                <th>Cliente</th>
                                <th>Status / Descrição do Local</th>
                                <th>Semana Entrega (Col BK)</th>
                                <th>Peças Pedido (AP)</th>
                                <th>Dias no Setor</th>
                                <th>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${displayItems.length === 0 ? `
                                <tr>
                                    <td colspan="10" style="text-align: center; padding: 36px; color: var(--text-muted);">
                                        Nenhuma OP encontrada no Setor D01 para os filtros selecionados.
                                    </td>
                                </tr>
                            ` : displayItems.map(item => {
                                const isCritico = item.diasParado > 2;
                                const isAtraso = item.prazoStatus === 'ATRASO';

                                return `
                                    <tr class="${isCritico ? 'row-danger' : (isAtraso ? 'row-warning' : '')}" onclick="window.crmOpenOpModal('${item.op}')" style="cursor: pointer;" title="Clique para abrir detalhes 360° da OP ${item.op}">
                                        <td class="table-op-cell">
                                            <span style="font-weight: 800; color: #00d4ff; font-size: 13.5px;">${item.op}</span>
                                        </td>
                                        <td>
                                            <span style="font-family: 'SF Mono', Monaco, monospace; font-weight: 700; color: #ffffff; font-size: 13px;">${item.codigo}</span>
                                        </td>
                                        <td>
                                            <div style="font-size: 12.5px; color: #e2e8f0; font-weight: 500; max-width: 280px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${item.descricao || 'Produto'}">
                                                ${item.descricao || 'Produto'}
                                            </div>
                                        </td>
                                        <td>
                                            <span class="badge badge-cyan" style="font-size: 11px; font-weight: 800;">
                                                <i class="fa-solid fa-palette"></i> SETOR D01
                                            </span>
                                        </td>
                                        <td>
                                            <span class="badge badge-purple" style="font-size: 11.5px; font-weight: 700;">
                                                ${item.cliente || '—'}
                                            </span>
                                        </td>
                                        <td>
                                            <span class="badge badge-sub" style="font-size: 11px; font-weight: 600;">
                                                ${item.statusModelagem || item.descLocal || item.statusProd || item.setor}
                                            </span>
                                        </td>
                                        <td style="color: #c084fc; font-weight: 700; font-size: 12px;">
                                            ${item.pedDescPeriodo || item.pedPeriodo || '—'}
                                        </td>
                                        <td style="font-weight: 800; color: #38bdf8; font-size: 12.5px;">
                                            ${formatNumber(item.qtdeOriginal)} pçs
                                        </td>
                                        <td>
                                            <span class="badge ${item.diasParado > 2 ? 'badge-rose' : 'badge-sub'}" style="font-size: 11.5px; font-weight: 800;">
                                                ${item.diasParado} dias
                                            </span>
                                        </td>
                                        <td onclick="event.stopPropagation()">
                                            <button class="exec-action-btn" onclick="window.crmOpenOpModal('${item.op}')" title="Ver Detalhes 360°" style="padding: 5px 10px; font-size: 11.5px; color: #00d4ff;">
                                                <i class="fa-solid fa-arrow-up-right-from-square"></i> Detalhes
                                            </button>
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>

            ${coresExt.records && coresExt.records.length > 0 ? `
                <!-- TABELA ADICIONAL: ITENS DA PLANILHA DRIVE DE CORES (ABA 1 - ESTILO) -->
                <div class="table-card" style="border-top: 3px solid #a855f7; margin-bottom: 24px;">
                    <div class="table-toolbar" style="border-bottom: 1px solid rgba(168, 85, 247, 0.2); justify-content: space-between;">
                        <div class="table-title-group">
                            <h3 class="table-title" style="display: flex; align-items: center; gap: 8px; color: #ffffff;">
                                <i class="fa-solid fa-file-excel" style="color: #a855f7;"></i>
                                <span>Itens de Cores Pendentes na Planilha (Aba 1 - ESTILO)</span>
                            </h3>
                            <span class="badge badge-purple">${coresExt.records.length} cores pendentes</span>
                        </div>
                    </div>

                    <div class="table-responsive">
                        <table class="crm-table">
                            <thead>
                                <tr>
                                    <th>Tinturaria</th>
                                    <th>Responsável</th>
                                    <th>Produto / Ref</th>
                                    <th>Coleção</th>
                                    <th>Situação</th>
                                    <th>Pantone</th>
                                    <th>Cor</th>
                                    <th>Base</th>
                                    <th>Solicitação</th>
                                    <th>Previsão</th>
                                    <th>Dias</th>
                                    <th>Observação</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${coresExt.records.map(r => {
                                    const tint = r['TINTURARIA'] || 'MULTICOLOR';
                                    const resp = r['RESPONSÁVEL'] || '—';
                                    const prod = r['PRODUTO'] || '—';
                                    const col = r['COLEÇÃO'] || '—';
                                    const sit = r['SITUAÇÃO'] || '—';
                                    const pant = r['PANTONE'] || '—';
                                    const cor = r['COR'] || '—';
                                    const base = r['BASE'] || '—';
                                    const solic = r['SOLICITAÇÃO'] || '—';
                                    const prev = r['PREVISÃO'] || '—';
                                    const dias = r['DIAS'] || '—';
                                    const obs = r['OBS'] || '';

                                    return `
                                        <tr>
                                            <td><span class="badge badge-sub">${tint}</span></td>
                                            <td>
                                                <span class="badge ${resp === 'ANA' ? 'badge-purple' : (resp === 'NATHALIA' ? 'badge-amber' : 'badge-cyan')}" style="font-weight: 800;">
                                                    ${resp}
                                                </span>
                                            </td>
                                            <td style="font-family: monospace; font-weight: 700; color: #ffffff;">${prod}</td>
                                            <td style="font-weight: 600; color: #cbd5e1;">${col}</td>
                                            <td><span class="badge badge-sub">${sit}</span></td>
                                            <td style="font-family: monospace; color: #38bdf8; font-weight: 700;">${pant}</td>
                                            <td style="font-weight: 700; color: #f8fafc;">${cor}</td>
                                            <td style="font-size: 11.5px; color: #94a3b8;">${base}</td>
                                            <td style="font-size: 11.5px; color: #94a3b8;">${solic}</td>
                                            <td style="color: #c084fc; font-weight: 700; font-size: 12px;">${prev}</td>
                                            <td>
                                                <span class="badge ${parseInt(dias) > 15 ? 'badge-rose' : 'badge-sub'}">
                                                    ${dias}
                                                </span>
                                            </td>
                                            <td style="font-size: 11.5px; color: #fca5a5; max-width: 220px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${obs}">${obs || '—'}</td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            ` : ''}
        `;
    }

    // =========================================================================
    // 6. MÓDULO ESTILO PEDIDO - AVIAMENTOS PENDENTES (SETOR X01)
    // =========================================================================
    function renderAviamentosPendentesView(container) {
        // Regras do Usuário:
        // - Pendência Setor X01 dividida por Cliente (Gráfico 1 Donut Grande 440x440)
        // - Segundo Gráfico: Quantidade de aviamentos pendentes dividido por Responsável (Coluna C)
        //   buscando da planilha Google Drive (gid=0)
        // - Lista de produtos pendentes no setor X01 abaixo (tabela com dias, OP, código, etc.)
        const x01Items = state.filteredData.filter(r => r.setor === 'X01' || r.setor === 'CM1');
        const totalItems = x01Items.length;
        const totalPecas = x01Items.reduce((sum, r) => sum + r.qtdeOriginal, 0);

        // Paleta de Cores Neon
        const clientColorPalette = [
            { stroke: '#f59e0b', glow: '#d97706' },
            { stroke: '#00d4ff', glow: '#0284c7' },
            { stroke: '#a855f7', glow: '#7c3aed' },
            { stroke: '#10b981', glow: '#059669' },
            { stroke: '#ef4444', glow: '#dc2626' },
            { stroke: '#ec4899', glow: '#db2777' },
            { stroke: '#06b6d4', glow: '#0891b2' },
            { stroke: '#eab308', glow: '#ca8a04' }
        ];

        // 1. Agrupamento por Cliente para SETOR X01 (CRM Oneda)
        const x01ClientMap = {};
        x01Items.forEach(item => {
            const cli = item.cliente || 'OUTROS';
            if (!x01ClientMap[cli]) {
                x01ClientMap[cli] = { name: cli, count: 0, pecas: 0, items: [] };
            }
            x01ClientMap[cli].count += 1;
            x01ClientMap[cli].pecas += item.qtdeOriginal;
            x01ClientMap[cli].items.push(item);
        });
        const x01ClientList = Object.values(x01ClientMap).sort((a, b) => b.count - a.count);

        // Geometria Donut SVG Gigante (viewBox 0 0 440 440, raio 150)
        const radius = 150;
        const circumference = 2 * Math.PI * radius; // ~942.48

        // Fatias do Donut X01 (Clientes)
        let accumX01 = 0;
        const x01Slices = x01ClientList.map((cliData, idx) => {
            const colorObj = clientColorPalette[idx % clientColorPalette.length];
            const dash = x01Items.length > 0 ? (cliData.count / x01Items.length) * circumference : 0;
            const currentOffset = -accumX01;
            accumX01 += dash;
            return {
                ...cliData,
                color: colorObj.stroke,
                glowColor: colorObj.glow,
                dash: dash.toFixed(2),
                offset: currentOffset.toFixed(2),
                percent: x01Items.length > 0 ? ((cliData.count / x01Items.length) * 100).toFixed(1) : '0'
            };
        });

        // 2. Dados da Planilha Externa de Aviamentos (Google Drive - Responsável / Coluna C)
        const avExt = state.aviamentosExternalData || { count: 0, byResponsavel: {}, records: [], isLive: false };
        const avRespList = Object.entries(avExt.byResponsavel || {})
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count);
        
        const avRespTotal = avRespList.reduce((sum, r) => sum + r.count, 0) || avExt.count || 0;

        let accumAvResp = 0;
        const avRespSlices = avRespList.map((respData, idx) => {
            const colorObj = clientColorPalette[idx % clientColorPalette.length];
            const dash = avRespTotal > 0 ? (respData.count / avRespTotal) * circumference : 0;
            const currentOffset = -accumAvResp;
            accumAvResp += dash;
            return {
                ...respData,
                color: colorObj.stroke,
                glowColor: colorObj.glow,
                dash: dash.toFixed(2),
                offset: currentOffset.toFixed(2),
                percent: avRespTotal > 0 ? ((respData.count / avRespTotal) * 100).toFixed(1) : '0'
            };
        });

        // 3. Aplicar busca em tempo real
        let searchFilteredItems = x01Items;
        if (state.aviamentosSearch && state.aviamentosSearch.trim().length > 0) {
            const q = state.aviamentosSearch.trim().toLowerCase();
            searchFilteredItems = x01Items.filter(r => 
                (r.codigo || '').toLowerCase().includes(q) ||
                (r.op || '').toLowerCase().includes(q) ||
                (r.statusModelagem || '').toLowerCase().includes(q) ||
                (r.descLocal || '').toLowerCase().includes(q) ||
                (r.statusProd || '').toLowerCase().includes(q) ||
                (r.marca || '').toLowerCase().includes(q) ||
                (r.etiqueta || '').toLowerCase().includes(q) ||
                (r.descricao || '').toLowerCase().includes(q) ||
                (r.cliente || '').toLowerCase().includes(q) ||
                (r.pedDescPeriodo || '').toLowerCase().includes(q)
            );
        }

        // 4. Aplicar filtros ativos
        let displayItems = searchFilteredItems;
        let activeFilterLabel = null;

        if (state.aviamentosFilter && state.aviamentosFilter.field === 'cliente') {
            const { clientName } = state.aviamentosFilter;
            displayItems = searchFilteredItems.filter(r => (r.cliente || '').trim().toLowerCase() === clientName.trim().toLowerCase());
            activeFilterLabel = `Cliente: ${clientName}`;
        }

        container.innerHTML = `
            <!-- CABEÇALHO DO MÓDULO -->
            <div class="module-view-header" style="margin-bottom: 24px;">
                <div class="module-view-title-group">
                    <h2 style="font-size: 22px; font-weight: 800; color: var(--text-primary); display: flex; align-items: center; gap: 10px;">
                        <i class="fa-solid fa-box-open" style="color: #f59e0b;"></i>
                        <span>Módulo Estilo Pedido: AVIAMENTOS PENDENTES (Setor X01)</span>
                    </h2>
                    <p class="module-view-description" style="font-size: 13px; color: var(--text-muted); margin-top: 4px;">
                        Visão unificada das pendências de aviamentos no Setor X01 e integração com a planilha de responsáveis do Google Drive.
                    </p>
                </div>
                <div class="btn-group" style="flex-wrap: wrap; gap: 8px;">
                    <span class="badge badge-amber" style="font-size: 12px; padding: 6px 14px;">
                        <i class="fa-solid fa-box-open"></i> ${totalItems} OPs em X01
                    </span>
                    <span class="badge badge-purple" style="font-size: 12px; padding: 6px 14px;">
                        <i class="fa-solid fa-boxes-stacked"></i> ${avRespTotal} Aviamentos na Planilha Drive
                    </span>
                    <span class="badge badge-emerald" style="font-size: 12px; padding: 6px 14px;">
                        <i class="fa-solid fa-shirt"></i> ${formatNumber(totalPecas)} pçs
                    </span>
                    <button class="btn btn-glass" onclick="window.crmSyncExternalSheets('aviamentos')" style="font-size: 11.5px; padding: 6px 12px;" title="Atualizar dados da planilha do Drive">
                        <i class="fa-solid fa-arrows-rotate"></i> Sincronizar Drive
                    </button>
                </div>
            </div>

            <!-- GRID DOS DOIS GRÁFICOS GRANDES (50% / 50%) -->
            <div class="exec-processo-layout" style="grid-template-columns: repeat(auto-fit, minmax(420px, 1fr)); gap: 24px; margin-bottom: 24px;">
                
                <!-- GRÁFICO 1: SETOR X01 - AVIAMENTOS CRM (DIVIDIDO POR CLIENTES) -->
                <div class="hero-pie-chart-container" style="background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(245, 158, 11, 0.35); border-radius: 14px; padding: 22px;">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <i class="fa-solid fa-box-open" style="color: #f59e0b; font-size: 18px;"></i>
                            <h3 style="font-size: 16px; font-weight: 800; color: #ffffff; margin: 0;">SETOR X01 • POR CLIENTE (CRM)</h3>
                        </div>
                        <span class="badge badge-amber" style="font-size: 11px; padding: 3px 8px;">
                            ${x01Items.length} OPs
                        </span>
                    </div>

                    <svg viewBox="0 0 440 440" class="hero-donut-svg">
                        <defs>
                            ${x01Slices.map((slice, idx) => `
                                <filter id="glowDonutAvCli_${idx}" x="-30%" y="-30%" width="160%" height="160%">
                                    <feDropShadow dx="0" dy="0" stdDeviation="12" flood-color="${slice.color}" flood-opacity="0.85"/>
                                </filter>
                            `).join('')}
                        </defs>
                        <g transform="rotate(-90 220 220)">
                            <!-- Trilha de fundo circular -->
                            <circle cx="220" cy="220" r="150" fill="none" stroke="#121624" stroke-width="58" />
                            
                            <!-- Fatias por Cliente X01 -->
                            ${x01Items.length > 0 ? x01Slices.map((slice, idx) => `
                                <circle cx="220" cy="220" r="150" fill="none" stroke="${slice.color}" stroke-width="58"
                                    stroke-dasharray="${slice.dash} ${circumference.toFixed(2)}"
                                    stroke-dashoffset="${slice.offset}"
                                    filter="url(#glowDonutAvCli_${idx})"
                                    style="cursor: pointer; transition: all 0.3s ease;"
                                    onclick="window.crmFilterAviamentosPendentes({ field: 'cliente', clientName: '${slice.name.replace(/'/g, "\\'")}' })"
                                />
                            `).join('') : `
                                <circle cx="220" cy="220" r="150" fill="none" stroke="#334155" stroke-width="58"
                                    stroke-dasharray="${circumference.toFixed(2)} ${circumference.toFixed(2)}"
                                    stroke-dashoffset="0"
                                />
                            `}
                        </g>
                        <!-- Texto Central -->
                        <text x="220" y="190" text-anchor="middle" dominant-baseline="central" fill="#ffffff" font-size="76" font-weight="900" font-family="system-ui, -apple-system, sans-serif" letter-spacing="-2px">${x01Items.length}</text>
                        <text x="220" y="246" text-anchor="middle" dominant-baseline="central" fill="#94a3b8" font-size="14" font-weight="800" letter-spacing="3px" font-family="system-ui, -apple-system, sans-serif">PRODUTOS</text>
                        <text x="220" y="272" text-anchor="middle" dominant-baseline="central" fill="#f59e0b" font-size="13" font-weight="800" letter-spacing="1.5px" font-family="system-ui, -apple-system, sans-serif">SETOR X01 (AVIAMENTOS)</text>
                    </svg>

                    <!-- Legenda Rápida de Clientes do X01 -->
                    <div class="hero-pie-quick-legend" style="grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); margin-top: 14px;">
                        ${x01Slices.map(slice => {
                            const isSelected = state.aviamentosFilter && state.aviamentosFilter.field === 'cliente' && state.aviamentosFilter.clientName === slice.name;
                            const escaped = slice.name.replace(/'/g, "\\'");
                            return `
                                <div class="donut-legend-card ${isSelected ? 'active' : ''}" style="cursor: pointer; border-left: 4px solid ${slice.color}; background: rgba(15, 23, 42, 0.7);" onclick="window.crmFilterAviamentosPendentes({ field: 'cliente', clientName: '${escaped}' })" title="Filtrar ${slice.name} em X01">
                                    <div class="donut-legend-label">
                                        <span class="legend-dot" style="background: ${slice.color}; box-shadow: 0 0 8px ${slice.color};"></span>
                                        <div>
                                            <div style="font-weight: 700; font-size: 12.5px; color: #ffffff;">${slice.name}</div>
                                            <div style="font-size: 11px; color: var(--text-muted);">${formatNumber(slice.pecas)} pçs</div>
                                        </div>
                                    </div>
                                    <div style="text-align: right;">
                                        <div class="donut-legend-value" style="font-size: 13.5px; color: ${slice.color};">${slice.count} prod (${slice.percent}%)</div>
                                        <span style="font-size: 10px; color: ${slice.color}; text-decoration: underline;">Filtrar ↓</span>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>

                <!-- GRÁFICO 2: PLANILHA DRIVE - AVIAMENTOS PENDENTES POR RESPONSÁVEL (COLUNA C) -->
                <div class="hero-pie-chart-container" style="background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(245, 158, 11, 0.35); border-radius: 14px; padding: 22px;">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <i class="fa-solid fa-people-arrows" style="color: #fbbf24; font-size: 18px;"></i>
                            <h3 style="font-size: 16px; font-weight: 800; color: #ffffff; margin: 0;">AVIAMENTOS • POR RESPONSÁVEL (DRIVE)</h3>
                        </div>
                        <a href="https://docs.google.com/spreadsheets/d/1aAsiicOY0vu5MgQjeeBCsqcAZwGn3JQmj8drYrVaZtc/edit?gid=0#gid=0" target="_blank" class="badge badge-amber" style="font-size: 11px; padding: 3px 8px; text-decoration: none;" title="Abrir planilha no Google Drive">
                            <i class="fa-solid fa-arrow-up-right-from-square"></i> Planilha Drive
                        </a>
                    </div>

                    <svg viewBox="0 0 440 440" class="hero-donut-svg">
                        <defs>
                            ${avRespSlices.map((slice, idx) => `
                                <filter id="glowDonutAvResp_${idx}" x="-30%" y="-30%" width="160%" height="160%">
                                    <feDropShadow dx="0" dy="0" stdDeviation="12" flood-color="${slice.color}" flood-opacity="0.85"/>
                                </filter>
                            `).join('')}
                        </defs>
                        <g transform="rotate(-90 220 220)">
                            <!-- Trilha de fundo circular -->
                            <circle cx="220" cy="220" r="150" fill="none" stroke="#121624" stroke-width="58" />
                            
                            <!-- Fatias por Responsável -->
                            ${avRespTotal > 0 ? avRespSlices.map((slice, idx) => `
                                <circle cx="220" cy="220" r="150" fill="none" stroke="${slice.color}" stroke-width="58"
                                    stroke-dasharray="${slice.dash} ${circumference.toFixed(2)}"
                                    stroke-dashoffset="${slice.offset}"
                                    filter="url(#glowDonutAvResp_${idx})"
                                    style="transition: all 0.3s ease;"
                                />
                            `).join('') : `
                                <circle cx="220" cy="220" r="150" fill="none" stroke="#334155" stroke-width="58"
                                    stroke-dasharray="${circumference.toFixed(2)} ${circumference.toFixed(2)}"
                                    stroke-dashoffset="0"
                                />
                            `}
                        </g>
                        <!-- Texto Central -->
                        <text x="220" y="190" text-anchor="middle" dominant-baseline="central" fill="#ffffff" font-size="76" font-weight="900" font-family="system-ui, -apple-system, sans-serif" letter-spacing="-2px">${avRespTotal}</text>
                        <text x="220" y="246" text-anchor="middle" dominant-baseline="central" fill="#fbbf24" font-size="14" font-weight="800" letter-spacing="3px" font-family="system-ui, -apple-system, sans-serif">AVIAMENTOS PENDENTES</text>
                        <text x="220" y="272" text-anchor="middle" dominant-baseline="central" fill="#f59e0b" font-size="13" font-weight="800" letter-spacing="1.5px" font-family="system-ui, -apple-system, sans-serif">PLANILHA GOOGLE DRIVE</text>
                    </svg>

                    <!-- Legenda Rápida de Responsáveis da Planilha de Aviamentos -->
                    <div class="hero-pie-quick-legend" style="grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); margin-top: 14px;">
                        ${avRespSlices.length > 0 ? avRespSlices.map(slice => `
                            <div class="donut-legend-card" style="border-left: 4px solid ${slice.color}; background: rgba(15, 23, 42, 0.7);">
                                <div class="donut-legend-label">
                                    <span class="legend-dot" style="background: ${slice.color}; box-shadow: 0 0 8px ${slice.color};"></span>
                                    <div>
                                        <div style="font-weight: 700; font-size: 13px; color: #ffffff;">${slice.name}</div>
                                        <div style="font-size: 11px; color: var(--text-muted);">Responsável (Col C)</div>
                                    </div>
                                </div>
                                <div style="text-align: right;">
                                    <div class="donut-legend-value" style="font-size: 14px; color: ${slice.color};">${slice.count} pendentes</div>
                                    <span style="font-size: 10.5px; color: var(--text-muted);">${slice.percent}%</span>
                                </div>
                            </div>
                        `).join('') : `
                            <div style="grid-column: 1 / -1; text-align: center; padding: 18px; color: var(--text-muted); font-size: 12.5px;">
                                <i class="fa-solid fa-cloud-arrow-down"></i> Dados da planilha de aviamentos em sincronização. Clique em "Sincronizar Drive".
                            </div>
                        `}
                    </div>
                </div>

            </div>

            <!-- BARRA DE CONTROLE, BUSCA E FILTROS RÁPIDOS -->
            <div class="table-card" style="margin-top: 24px; padding: 14px 18px; margin-bottom: 20px;">
                <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;">
                    <!-- Campo de Busca em Tempo Real -->
                    <div style="display: flex; align-items: center; gap: 10px; flex: 1; min-width: 280px;">
                        <div style="position: relative; width: 100%;">
                            <i class="fa-solid fa-magnifying-glass" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text-muted); font-size: 13px;"></i>
                            <input 
                                type="text" 
                                class="crm-input" 
                                placeholder="Buscar produtos em X01 por OP, Código, Descrição, Cliente..." 
                                value="${state.aviamentosSearch || ''}" 
                                oninput="window.crmSearchAviamentosPendentes(this.value)"
                                style="padding-left: 36px; width: 100%; height: 38px; font-size: 12.5px; border-radius: 8px; background: rgba(15, 23, 42, 0.6); border: 1px solid var(--border-color);"
                            />
                        </div>
                        ${state.aviamentosSearch ? `
                            <button class="exec-action-btn" onclick="window.crmSearchAviamentosPendentes('')" title="Limpar busca">
                                <i class="fa-solid fa-xmark"></i>
                            </button>
                        ` : ''}
                    </div>

                    <!-- Alternadores de Visualização e Filtro Ativo -->
                    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                        <button class="exec-action-btn ${!state.aviamentosFilter ? 'active' : ''}" onclick="window.crmFilterAviamentosPendentes(null)" title="Ver todos">
                            Todos (${totalItems})
                        </button>

                        ${activeFilterLabel ? `
                            <span class="badge badge-amber" style="font-size: 11.5px; padding: 5px 10px; display: flex; align-items: center; gap: 6px;">
                                <i class="fa-solid fa-filter"></i> ${activeFilterLabel}
                                <i class="fa-solid fa-xmark" style="cursor: pointer;" onclick="window.crmFilterAviamentosPendentes(null)" title="Limpar filtro"></i>
                            </span>
                        ` : ''}
                    </div>
                </div>
            </div>

            <!-- TABELA DETALHADA DE PRODUTOS NO SETOR X01 (AVIAMENTOS PENDENTES) -->
            <div class="table-card" style="border-top: 3px solid #f59e0b; margin-bottom: 24px;">
                <div class="table-toolbar" style="border-bottom: 1px solid rgba(245, 158, 11, 0.2); justify-content: space-between;">
                    <div class="table-title-group">
                        <h3 class="table-title" style="display: flex; align-items: center; gap: 8px; color: #ffffff;">
                            <i class="fa-solid fa-table-list" style="color: #f59e0b;"></i>
                            <span>Lista de Produtos Pendentes no Setor X01 (Aviamentos)</span>
                        </h3>
                        <span class="badge badge-sub">${displayItems.length} OPs listadas</span>
                    </div>
                </div>

                <div class="table-responsive">
                    <table class="crm-table">
                        <thead>
                            <tr>
                                <th>OP</th>
                                <th>Código do Produto</th>
                                <th>Descrição</th>
                                <th>Setor Pendente</th>
                                <th>Cliente</th>
                                <th>Status / Descrição do Local</th>
                                <th>Semana Entrega (Col BK)</th>
                                <th>Peças Pedido (AP)</th>
                                <th>Dias no Setor</th>
                                <th>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${displayItems.length === 0 ? `
                                <tr>
                                    <td colspan="10" style="text-align: center; padding: 36px; color: var(--text-muted);">
                                        Nenhuma OP encontrada no Setor X01 para os filtros selecionados.
                                    </td>
                                </tr>
                            ` : displayItems.map(item => {
                                const isCritico = item.diasParado > 2;
                                const isAtraso = item.prazoStatus === 'ATRASO';

                                return `
                                    <tr class="${isCritico ? 'row-danger' : (isAtraso ? 'row-warning' : '')}" onclick="window.crmOpenOpModal('${item.op}')" style="cursor: pointer;" title="Clique para abrir detalhes 360° da OP ${item.op}">
                                        <td class="table-op-cell">
                                            <span style="font-weight: 800; color: #f59e0b; font-size: 13.5px;">${item.op}</span>
                                        </td>
                                        <td>
                                            <span style="font-family: 'SF Mono', Monaco, monospace; font-weight: 700; color: #ffffff; font-size: 13px;">${item.codigo}</span>
                                        </td>
                                        <td>
                                            <div style="font-size: 12.5px; color: #e2e8f0; font-weight: 500; max-width: 280px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${item.descricao || 'Produto'}">
                                                ${item.descricao || 'Produto'}
                                            </div>
                                        </td>
                                        <td>
                                            <span class="badge badge-amber" style="font-size: 11px; font-weight: 800;">
                                                <i class="fa-solid fa-box-open"></i> SETOR ${item.setor}
                                            </span>
                                        </td>
                                        <td>
                                            <span class="badge badge-purple" style="font-size: 11.5px; font-weight: 700;">
                                                ${item.cliente || '—'}
                                            </span>
                                        </td>
                                        <td>
                                            <span class="badge badge-sub" style="font-size: 11px; font-weight: 600;">
                                                ${item.statusModelagem || item.descLocal || item.statusProd || item.setor}
                                            </span>
                                        </td>
                                        <td style="color: #c084fc; font-weight: 700; font-size: 12px;">
                                            ${item.pedDescPeriodo || item.pedPeriodo || '—'}
                                        </td>
                                        <td style="font-weight: 800; color: #38bdf8; font-size: 12.5px;">
                                            ${formatNumber(item.qtdeOriginal)} pçs
                                        </td>
                                        <td>
                                            <span class="badge ${item.diasParado > 2 ? 'badge-rose' : 'badge-sub'}" style="font-size: 11.5px; font-weight: 800;">
                                                ${item.diasParado} dias
                                            </span>
                                        </td>
                                        <td onclick="event.stopPropagation()">
                                            <button class="exec-action-btn" onclick="window.crmOpenOpModal('${item.op}')" title="Ver Detalhes 360°" style="padding: 5px 10px; font-size: 11.5px; color: #f59e0b;">
                                                <i class="fa-solid fa-arrow-up-right-from-square"></i> Detalhes
                                            </button>
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>

            ${avExt.records && avExt.records.length > 0 ? `
                <!-- TABELA ADICIONAL: ITENS DA PLANILHA DRIVE DE AVIAMENTOS -->
                <div class="table-card" style="border-top: 3px solid #fbbf24; margin-bottom: 24px;">
                    <div class="table-toolbar" style="border-bottom: 1px solid rgba(245, 158, 11, 0.2); justify-content: space-between;">
                        <div class="table-title-group">
                            <h3 class="table-title" style="display: flex; align-items: center; gap: 8px; color: #ffffff;">
                                <i class="fa-solid fa-file-excel" style="color: #10b981;"></i>
                                <span>Itens Pendentes na Planilha de Aviamentos (Google Drive)</span>
                            </h3>
                            <span class="badge badge-amber">${avExt.records.length} registros</span>
                        </div>
                    </div>

                    <div class="table-responsive">
                        <table class="crm-table">
                            <thead>
                                <tr>
                                    <th>Tipo Aviamento</th>
                                    <th>Fornecedor</th>
                                    <th>Responsável</th>
                                    <th>Pedido / Feira</th>
                                    <th>Coleção</th>
                                    <th>Produto / Referência</th>
                                    <th>Descrição</th>
                                    <th>Dias</th>
                                    <th>Status Aprovado</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${avExt.records.slice(0, 50).map(r => {
                                    const tipo = r['TIPO AVIAMENTO'] || r[Object.keys(r)[0]] || '—';
                                    const forn = r['FORNECEDOR'] || r[Object.keys(r)[1]] || '—';
                                    const resp = r['RESPONSÁVEL'] || r[Object.keys(r)[2]] || '—';
                                    const col = r['COLEÇÃO'] || r[Object.keys(r)[3]] || '—';
                                    const ped = r['PEDIDO OU FEIRA'] || r[Object.keys(r)[4]] || '—';
                                    const prod = r['PRODUTO'] || r[Object.keys(r)[5]] || '—';
                                    const desc = r['DESCRIÇÃO'] || r[Object.keys(r)[6]] || '—';
                                    const dias = r['DIAS'] || r[Object.keys(r)[9]] || '—';
                                    const aprov = r['DATA APROVADO'] || r[Object.keys(r)[13]] || 'Pendente';

                                    return `
                                        <tr>
                                            <td><span class="badge badge-amber" style="font-weight: 700;">${tipo}</span></td>
                                            <td style="color: #cbd5e1; font-size: 12.5px;">${forn}</td>
                                            <td><span class="badge badge-purple" style="font-weight: 800;">${resp}</span></td>
                                            <td><span class="badge badge-sub">${ped}</span></td>
                                            <td style="font-size: 12px; color: #94a3b8;">${col}</td>
                                            <td style="font-family: monospace; font-weight: 700; color: #ffffff;">${prod}</td>
                                            <td style="font-size: 12px; color: #e2e8f0; max-width: 250px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${desc}">${desc}</td>
                                            <td><span class="badge badge-sub">${dias}</span></td>
                                            <td>
                                                <span class="badge ${aprov && aprov.trim() ? 'badge-emerald' : 'badge-rose'}">
                                                    ${aprov && aprov.trim() ? aprov : 'Pendente'}
                                                </span>
                                            </td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            ` : ''}
        `;
    }

    // =========================================================================
    // 5.1. MÓDULO CONTROLE DE QUALIDADE - ANDAMENTO DO CQ
    // =========================================================================
    // 5.1. MÓDULO CONTROLE DE QUALIDADE - ANDAMENTO DO CQ (GRÁFICO GRANDE DE OFs PENDENTES)
    // =========================================================================
    function renderAndamentoCQView(container) {
        // Regras do Usuário:
        // - Planilha Google Drive: andamento CQ (10VlV3p7FRn36dnsLM45wUkkiLGUVRkBTdMFGE5dkgX4)
        // - Gráfico Grande: Distribuição de OFs (Coluna B - NUMERO) divididas por Situação de Amostra (Coluna I - DESC_AMOSTRA),
        //   separadas por Período / Semana (Coluna N - PERIODO)
        // - Situações de Amostra Críticas / Pendentes consideradas:
        //   1) REENVIADO CQ
        //   2) ENVIADO
        //   3) EXPIRANDO VIGÊNCIA
        //   4) AMOSTRAS EM PRODUÇÃO
        // - Layout Visual Hierárquico das Fotos:
        //   SEMANA [PERÍODO] -
        //     [SITUAÇÃO AMOSTRA]
        //       [imagem] [imagem] [imagem] [imagem]
        //     [SITUAÇÃO AMOSTRA]
        //       [imagem] [imagem] [imagem] [imagem]
        
        const cqExt = state.cqExternalData || { count: 0, records: [], isLive: false };
        const rawRecords = cqExt.records || [];

        // Helper flexível para extração de colunas da planilha do CQ
        function extractCQField(row, possibleNames, fallbackIndex) {
            const keys = Object.keys(row || {});
            for (const name of possibleNames) {
                const targetNorm = name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
                for (const k of keys) {
                    const keyNorm = k.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
                    if (keyNorm === targetNorm || keyNorm.includes(targetNorm)) {
                        const val = row[k];
                        if (val !== undefined && val !== null && String(val).trim().length > 0) {
                            return String(val).trim();
                        }
                    }
                }
            }
            if (fallbackIndex !== undefined && keys[fallbackIndex] !== undefined) {
                const val = row[keys[fallbackIndex]];
                if (val !== undefined && val !== null && String(val).trim().length > 0) {
                    return String(val).trim();
                }
            }
            return '';
        }

        // Helper compartilhado com o motor de alertas para que relatório e
        // avisos interpretem DESC_AMOSTRA exatamente da mesma forma.
        function normalizeCQSituacao(s) {
            return window.CRMAlertsEngine?.normalizeCQStatus(s) || null;
        }

        // Helper de Cliente por Prefixo do Código (Coluna E)
        function resolveCQCliente(cod) {
            const c = (cod || '').trim();
            if (c.startsWith('01.') || c.startsWith('01')) return 'C&A';
            if (c.startsWith('02.') || c.startsWith('02')) return 'Renner';
            if (c.startsWith('03.') || c.startsWith('03')) return 'Riachuelo';
            if (c.startsWith('05.') || c.startsWith('05')) return 'Centauro';
            if (c.startsWith('13.') || c.startsWith('13')) return 'Hering';
            if (c.startsWith('15.') || c.startsWith('15')) return 'Carrefour';
            if (c.startsWith('21.') || c.startsWith('21')) return 'Santa Marca';
            return 'Outros';
        }

        // Paleta de Cores e Gradientes para as 4 Situações
        const situacaoMeta = {
            'REENVIADO CQ': {
                color: '#f59e0b',
                lightColor: '#fbbf24',
                bg: 'rgba(245, 158, 11, 0.18)',
                border: 'rgba(245, 158, 11, 0.45)',
                gradId: 'gradReenviadoCQ',
                label: 'Reenviado CQ',
                icon: 'fa-rotate-left'
            },
            'ENVIADO': {
                color: '#06b6d4',
                lightColor: '#22d3ee',
                bg: 'rgba(6, 182, 212, 0.18)',
                border: 'rgba(6, 182, 212, 0.45)',
                gradId: 'gradEnviadoCQ',
                label: 'Enviado',
                icon: 'fa-paper-plane'
            },
            'EXPIRANDO VIGÊNCIA': {
                color: '#f43f5e',
                lightColor: '#fb7185',
                bg: 'rgba(244, 63, 94, 0.18)',
                border: 'rgba(244, 63, 94, 0.45)',
                gradId: 'gradExpirandoCQ',
                label: 'Expirando Vigência',
                icon: 'fa-triangle-exclamation'
            },
            'AMOSTRAS EM PRODUÇÃO': {
                color: '#8b5cf6',
                lightColor: '#a78bfa',
                bg: 'rgba(139, 92, 246, 0.18)',
                border: 'rgba(139, 92, 246, 0.45)',
                gradId: 'gradProducaoCQ',
                label: 'Amostras em Produção',
                icon: 'fa-scissors'
            },
            'REPROVADO': {
                color: '#ef4444',
                lightColor: '#fca5a5',
                bg: 'rgba(239, 68, 68, 0.2)',
                border: '#ef4444',
                gradId: 'gradReprovadoCQ',
                label: 'Reprovado',
                icon: 'fa-circle-xmark',
                critical: true
            }
        };

        const targetSituacoes = ['REPROVADO', 'REENVIADO CQ', 'ENVIADO', 'EXPIRANDO VIGÊNCIA', 'AMOSTRAS EM PRODUÇÃO'];

        // Normalização e enriquecimento dos registros
        const normalizedRecords = rawRecords.map((r, idx) => {
            // Coluna B (NUMERO / OF)
            const of = extractCQField(r, ['numero', 'número', 'of', 'op', 'pedido'], 1) || extractCQField(r, ['ordem'], 0) || `OF-${idx + 1}`;
            const ordem = extractCQField(r, ['ordem'], 0) || '—';
            // Coluna E (CODIGO)
            const codigo = extractCQField(r, ['codigo', 'código', 'produto', 'referencia', 'ref'], 4) || '—';
            
            // Enriquecer descrição via CRM se disponível
            let rawDesc = extractCQField(r, ['produto_desc', 'descricao', 'descrição', 'produto', 'desc'], 2);
            if (!rawDesc || rawDesc === '—' || rawDesc === '-') {
                const crmMatch = state.allData.find(d => d.codigo === codigo);
                if (crmMatch && crmMatch.descricao) {
                    rawDesc = crmMatch.descricao;
                } else {
                    const artCli = extractCQField(r, ['art_cli', 'colecao'], 3);
                    rawDesc = artCli ? `Amostra Art. ${artCli}` : 'Amostra de Produto CQ';
                }
            }
            const produtoDesc = rawDesc || 'Amostra de Produto';
            const colecao = extractCQField(r, ['colecao', 'coleção', 'estacao', 'estação', 'art_cli'], 3) || '—';
            
            // Coluna I (DESC_AMOSTRA / Situação)
            const descAmostraRaw = extractCQField(r, ['desc_amostra', 'descamostra', 'situacao', 'situação', 'amostra'], 8);
            const descAmostra = descAmostraRaw || 'Vigencia';
            const sitNorm = normalizeCQSituacao(descAmostra);
            const isPending = sitNorm !== null;
            
            // Coluna K (SETOR_AMOSTRA)
            const setorAmostra = extractCQField(r, ['setor_amostra', 'setoramostra', 'setor_cq', 'setor'], 10) || 'Sem Setor';
            
            // Coluna N (PERIODO / Semana de CQ)
            const periodoRaw = extractCQField(r, ['periodo', 'período', 'semana', 'sem'], 13);
            const periodo = periodoRaw || 'Sem Período';
            
            const cliente = resolveCQCliente(codigo);
            const qtde = parseInt(extractCQField(r, ['qtd_pedido', 'qtde', 'quantidade', 'pecas', 'peças'], 17) || '1', 10) || 1;
            const diasCQ = parseInt(extractCQField(r, ['dias', 'dias_cq', 'tempo'], 21) || '0', 10) || 0;
            const responsavel = extractCQField(r, ['representante', 'responsavel', 'responsável', 'resp'], 12) || '—';
            const obs = extractCQField(r, ['observacao', 'observação', 'obs', 'detalhes'], 9) || '';

            return {
                id: idx,
                of,
                ordem,
                codigo,
                produtoDesc,
                colecao,
                descAmostra,
                sitNorm,
                isPending,
                setorAmostra,
                periodo,
                cliente,
                qtde,
                diasCQ,
                responsavel,
                obs,
                raw: r
            };
        });

        // Filtragem padrão: foca nas OFs pendentes das 4 situações
        const pendingRecords = normalizedRecords.filter(r => r.isPending);
        const totalPendingCount = pendingRecords.length;
        const totalAllCount = normalizedRecords.length;

        // Contadores por Situação
        const sitCounts = {
            'REPROVADO': 0,
            'REENVIADO CQ': 0,
            'ENVIADO': 0,
            'EXPIRANDO VIGÊNCIA': 0,
            'AMOSTRAS EM PRODUÇÃO': 0
        };
        pendingRecords.forEach(r => {
            if (sitCounts[r.sitNorm] !== undefined) {
                sitCounts[r.sitNorm]++;
            }
        });

        // =====================================================================
        // AGRUPAMENTO DE OFs PENDENTES POR SEMANA (COLUNA N) E SITUAÇÃO (COLUNA I)
        // =====================================================================
        const allWeeksSet = new Set();
        normalizedRecords.forEach(r => {
            if (r.periodo && r.periodo !== 'Sem Período') {
                allWeeksSet.add(r.periodo);
            }
        });
        const sortedWeeks = Array.from(allWeeksSet).sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true }));

        const weeksMap = {};
        sortedWeeks.forEach(w => {
            weeksMap[w] = {
                periodo: w,
                total: 0,
                bySit: {
                    'REPROVADO': 0,
                    'REENVIADO CQ': 0,
                    'ENVIADO': 0,
                    'EXPIRANDO VIGÊNCIA': 0,
                    'AMOSTRAS EM PRODUÇÃO': 0
                },
                records: []
            };
        });

        pendingRecords.forEach(r => {
            if (weeksMap[r.periodo]) {
                weeksMap[r.periodo].total++;
                weeksMap[r.periodo].bySit[r.sitNorm]++;
                weeksMap[r.periodo].records.push(r);
            }
        });

        const weeksDataList = sortedWeeks.map(w => weeksMap[w]);
        const maxWeekTotal = Math.max(...weeksDataList.map(w => w.total), 5);
        const yMaxWeek = Math.ceil(maxWeekTotal * 1.25);

        // =====================================================================
        // GERAÇÃO DO GRÁFICO GRANDE DE COLUNAS EMPILHADAS (DUAL VISUAL SVG)
        // =====================================================================
        const svgW = 1200;
        const svgH = 490;
        const pad = { top: 48, right: 80, bottom: 70, left: 80 };
        const drawW = svgW - pad.left - pad.right;
        const drawH = svgH - pad.top - pad.bottom;

        const numCols = weeksDataList.length || 1;
        const colSlotW = drawW / numCols;
        const barW = Math.min(68, Math.max(40, colSlotW - 28));

        // Coordenadas dos pontos da linha de tendência de volume
        const linePoints = weeksDataList.map((wData, idx) => {
            const cx = pad.left + (idx * colSlotW) + (colSlotW / 2);
            const cy = pad.top + drawH - ((wData.total / yMaxWeek) * drawH);
            return { x: cx, y: cy, data: wData };
        });

        const linePathD = linePoints.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`).join(' ');

        // =====================================================================
        // FILTRAGEM, BUSCA E AGRUPAMENTO HIERÁRQUICO
        // =====================================================================
        let filteredRecords = pendingRecords;

        // Se o usuário selecionou ver "Todas as Amostras (199)", ou filtramos
        const showAllMode = state.cqViewAllMode === true;
        if (showAllMode) {
            filteredRecords = normalizedRecords;
        }

        // Filtro específico clicado
        let activeFilterBadge = null;
        if (state.cqFilter) {
            if (state.cqFilter.field === 'periodo') {
                filteredRecords = filteredRecords.filter(r => r.periodo === state.cqFilter.value);
                activeFilterBadge = `Semana: ${state.cqFilter.value}`;
            } else if (state.cqFilter.field === 'situacao') {
                filteredRecords = filteredRecords.filter(r => r.sitNorm === state.cqFilter.value || r.descAmostra === state.cqFilter.value);
                activeFilterBadge = `Situação: ${state.cqFilter.value}`;
            } else if (state.cqFilter.field === 'setor') {
                filteredRecords = filteredRecords.filter(r => r.setorAmostra === state.cqFilter.value);
                activeFilterBadge = `Setor: ${state.cqFilter.value}`;
            }
        }

        // Busca textual
        if (state.cqSearch && state.cqSearch.trim().length > 0) {
            const q = state.cqSearch.trim().toLowerCase();
            filteredRecords = filteredRecords.filter(r => 
                r.of.toLowerCase().includes(q) ||
                r.codigo.toLowerCase().includes(q) ||
                r.produtoDesc.toLowerCase().includes(q) ||
                r.colecao.toLowerCase().includes(q) ||
                r.descAmostra.toLowerCase().includes(q) ||
                (r.sitNorm && r.sitNorm.toLowerCase().includes(q)) ||
                r.setorAmostra.toLowerCase().includes(q) ||
                r.periodo.toLowerCase().includes(q) ||
                r.cliente.toLowerCase().includes(q) ||
                r.responsavel.toLowerCase().includes(q) ||
                r.obs.toLowerCase().includes(q)
            );
        }

        // =====================================================================
        // CONSTRUÇÃO DA HIERARQUIA SOLICITADA:
        // SEMANA [PERÍODO] -
        //   [SITUAÇÃO AMOSTRA]
        //     [IMAGEM] [IMAGEM] [IMAGEM] [IMAGEM]
        // =====================================================================
        const hierarchyWeeks = {};
        filteredRecords.forEach(item => {
            const semKey = item.periodo || 'Sem Período';
            const sitKey = item.sitNorm || item.descAmostra || 'Outros';

            if (!hierarchyWeeks[semKey]) {
                hierarchyWeeks[semKey] = {
                    periodo: semKey,
                    total: 0,
                    situations: {}
                };
            }
            hierarchyWeeks[semKey].total++;

            if (!hierarchyWeeks[semKey].situations[sitKey]) {
                hierarchyWeeks[semKey].situations[sitKey] = {
                    sitKey: sitKey,
                    desc: item.descAmostra || sitKey,
                    items: []
                };
            }
            hierarchyWeeks[semKey].situations[sitKey].items.push(item);
        });

        // Ordenar Semanas ASC
        const sortedHierarchyWeekKeys = Object.keys(hierarchyWeeks).sort((a, b) => 
            String(a).localeCompare(String(b), undefined, { numeric: true })
        );

        // Ordenar itens dentro de cada situação (por Setor ASC -> OF ASC)
        sortedHierarchyWeekKeys.forEach(wKey => {
            const sitMap = hierarchyWeeks[wKey].situations;
            Object.keys(sitMap).forEach(sKey => {
                sitMap[sKey].items.sort((a, b) => {
                    const setA = String(a.setorAmostra || '').trim();
                    const setB = String(b.setorAmostra || '').trim();
                    const compSet = setA.localeCompare(setB, undefined, { numeric: true });
                    if (compSet !== 0) return compSet;

                    const ofA = String(a.of || '').trim();
                    const ofB = String(b.of || '').trim();
                    return ofA.localeCompare(ofB, undefined, { numeric: true });
                });
            });
        });

        const displayMode = state.cqDisplayMode || 'cards'; // 'both', 'cards', 'table'

        container.innerHTML = `
            <!-- CABEÇALHO DO MÓDULO ANDAMENTO DO CQ -->
            <div class="module-view-header" style="margin-bottom: 20px;">
                <div class="module-view-title-group">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span class="view-tag-badge" style="background: rgba(56, 189, 248, 0.2); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.4);">
                            <i class="fa-solid fa-clipboard-check"></i> CQ
                        </span>
                        <h2 style="font-size: 21px; font-weight: 800; color: #ffffff; margin: 0;">Módulo: ANDAMENTO DO CQ</h2>
                    </div>
                    <p class="module-view-description" style="font-size: 13px; color: var(--text-muted); margin-top: 4px;">
                        Monitoramento analítico de Pedidos e OFs Pendentes no Controle de Qualidade. Distribuição por Semana de CQ (Coluna N) e Situação da Amostra (Coluna I).
                    </p>
                </div>
                
                <div class="btn-group" style="flex-wrap: wrap; gap: 8px;">
                    <span class="badge badge-cyan" style="font-size: 12px; padding: 6px 14px;">
                        <i class="fa-solid fa-clock-rotate-left"></i> ${totalPendingCount} OFs Pendentes
                    </span>
                    <span class="badge badge-purple" style="font-size: 12px; padding: 6px 14px;">
                        <i class="fa-solid fa-calendar-week"></i> ${sortedWeeks.length} Semanas Ativas
                    </span>
                    <a href="https://docs.google.com/spreadsheets/d/10VlV3p7FRn36dnsLM45wUkkiLGUVRkBTdMFGE5dkgX4/edit?gid=0#gid=0" target="_blank" class="btn btn-glass" style="font-size: 11.5px; padding: 6px 12px; text-decoration: none; color: #38bdf8;" title="Abrir planilha no Google Drive">
                        <i class="fa-solid fa-arrow-up-right-from-square"></i> Planilha Drive
                    </a>
                    <button class="btn btn-glass" onclick="window.crmSyncCQDrive()" style="font-size: 11.5px; padding: 6px 12px;" title="Atualizar dados da planilha do Drive">
                        <i class="fa-solid fa-arrows-rotate"></i> Sincronizar CQ
                    </button>
                    <button class="btn btn-glass" onclick="window.crmOpenCQImportModal()" style="font-size: 11.5px; padding: 6px 12px; border-color: rgba(56, 189, 248, 0.4); color: #38bdf8;" title="Importar ou colar dados da planilha">
                        <i class="fa-solid fa-file-import"></i> Colar Dados CQ
                    </button>
                </div>
            </div>

            <!-- CARDS DE KPIS EXECUTIVOS DAS 5 SITUAÇÕES -->
            <div class="cq-kpi-grid">
                <!-- TOTAL PENDENTES -->
                <div class="cq-kpi-card">
                    <div class="cq-kpi-icon">
                        <i class="fa-solid fa-clipboard-list"></i>
                    </div>
                    <div class="cq-kpi-info">
                        <div class="cq-kpi-label">Total Pedidos Pendentes</div>
                        <div class="cq-kpi-value">${totalPendingCount} <span style="font-size: 14px; font-weight: 600; color: #94a3b8;">OFs</span></div>
                        <div class="cq-kpi-sub"><i class="fa-solid fa-layer-group"></i> Em 5 situações de controle</div>
                    </div>
                </div>

                <!-- REPROVADO — STATUS CRÍTICO -->
                <div class="cq-kpi-card ${sitCounts['REPROVADO'] > 0 ? 'cq-reprovado-pulse' : ''}" style="border-color: #ef4444; cursor: pointer;" onclick="window.crmFilterCQ({ field: 'situacao', value: 'REPROVADO' })" title="Filtrar amostras reprovadas">
                    <div class="cq-kpi-icon" style="background: rgba(239, 68, 68, 0.2); color: #fca5a5;">
                        <i class="fa-solid fa-circle-xmark"></i>
                    </div>
                    <div class="cq-kpi-info">
                        <div class="cq-kpi-label">Reprovado</div>
                        <div class="cq-kpi-value" style="color: #fca5a5;">${sitCounts['REPROVADO']} <span style="font-size: 14px; font-weight: 600; color: #fca5a5;">OFs</span></div>
                        <div class="cq-kpi-sub" style="color: #fca5a5;"><i class="fa-solid fa-triangle-exclamation"></i> Ação crítica imediata</div>
                    </div>
                </div>

                <!-- REENVIADO CQ -->
                <div class="cq-kpi-card" style="border-color: rgba(245, 158, 11, 0.35); cursor: pointer;" onclick="window.crmFilterCQ({ field: 'situacao', value: 'REENVIADO CQ' })" title="Filtrar Reenviado CQ">
                    <div class="cq-kpi-icon" style="background: rgba(245, 158, 11, 0.15); color: #fbbf24;">
                        <i class="fa-solid fa-rotate-left"></i>
                    </div>
                    <div class="cq-kpi-info">
                        <div class="cq-kpi-label">Reenviado CQ</div>
                        <div class="cq-kpi-value" style="color: #fbbf24;">${sitCounts['REENVIADO CQ']} <span style="font-size: 14px; font-weight: 600; color: #94a3b8;">OFs</span></div>
                        <div class="cq-kpi-sub" style="color: #fbbf24;"><i class="fa-solid fa-arrows-rotate"></i> Retornaram para reanálise</div>
                    </div>
                </div>

                <!-- AMOSTRAS EM PRODUÇÃO -->
                <div class="cq-kpi-card" style="border-color: rgba(139, 92, 246, 0.35); cursor: pointer;" onclick="window.crmFilterCQ({ field: 'situacao', value: 'AMOSTRAS EM PRODUÇÃO' })" title="Filtrar Amostras em Produção">
                    <div class="cq-kpi-icon" style="background: rgba(139, 92, 246, 0.15); color: #a78bfa;">
                        <i class="fa-solid fa-scissors"></i>
                    </div>
                    <div class="cq-kpi-info">
                        <div class="cq-kpi-label">Amostras em Produção</div>
                        <div class="cq-kpi-value" style="color: #a78bfa;">${sitCounts['AMOSTRAS EM PRODUÇÃO']} <span style="font-size: 14px; font-weight: 600; color: #94a3b8;">OFs</span></div>
                        <div class="cq-kpi-sub" style="color: #a78bfa;"><i class="fa-solid fa-industry"></i> Em confecção no chão</div>
                    </div>
                </div>

                <!-- EXPIRANDO & ENVIADO -->
                <div class="cq-kpi-card" style="border-color: rgba(244, 63, 94, 0.35); cursor: pointer;" onclick="window.crmFilterCQ({ field: 'situacao', value: 'EXPIRANDO VIGÊNCIA' })" title="Filtrar Expirando Vigência">
                    <div class="cq-kpi-icon" style="background: rgba(244, 63, 94, 0.15); color: #fb7185;">
                        <i class="fa-solid fa-triangle-exclamation"></i>
                    </div>
                    <div class="cq-kpi-info">
                        <div class="cq-kpi-label">Expirando / Enviado</div>
                        <div class="cq-kpi-value" style="color: #fb7185;">${sitCounts['EXPIRANDO VIGÊNCIA']} <span style="font-size: 13px; font-weight: 700; color: #38bdf8;">(+ ${sitCounts['ENVIADO']} env)</span></div>
                        <div class="cq-kpi-sub" style="color: #fb7185;"><i class="fa-solid fa-stopwatch"></i> Expirando vigência / enviadas</div>
                    </div>
                </div>
            </div>

            
            <!-- GRID COM GR�FICO 1 E GR�FICO 2 (Empilhados) -->
            <div style="display: flex; flex-direction: column; gap: 24px; margin-bottom: 24px;">
                
                <!-- GR�FICO 1: PIZZA TOTAL AMOSTRAS (Full Width com Legenda Lateral) -->
                <div class="cq-big-chart-card" style="margin-bottom: 0; display: flex; flex-direction: column;">
                    <div class="leadtime-chart-header" style="border-bottom-color: rgba(56, 189, 248, 0.2);">
                        <div>
                            <h3 class="leadtime-chart-title">
                                <i class="fa-solid fa-chart-pie" style="color: #38bdf8;"></i>
                                <span>Gr�fico 1: Total Amostras</span>
                            </h3>
                            <p class="leadtime-chart-subtitle">Resolu��o de OFs do CQ (${totalAllCount > 0 ? (((totalAllCount - totalPendingCount) / totalAllCount) * 100).toFixed(1) : 0}% resolvidas)</p>
                        </div>
                    </div>
                    
                    <div style="flex: 1; display: flex; flex-direction: row; flex-wrap: wrap; align-items: center; justify-content: center; gap: 64px; padding: 40px 20px;">
                        
                        <!-- Lado Esquerdo: SVG GIGANTE -->
                        <svg viewBox="0 0 440 440" style="width: 100%; max-width: 440px; height: auto; overflow: visible; filter: drop-shadow(0 8px 16px rgba(0,0,0,0.5));">
                            <defs>
                                <filter id="glowPieResolvidoCQ" x="-30%" y="-30%" width="160%" height="160%">
                                    <feDropShadow dx="0" dy="0" stdDeviation="12" flood-color="#10b981" flood-opacity="0.65"/>
                                </filter>
                                <filter id="glowPiePendenteCQ" x="-30%" y="-30%" width="160%" height="160%">
                                    <feDropShadow dx="0" dy="0" stdDeviation="14" flood-color="#ef4444" flood-opacity="0.9"/>
                                </filter>
                            </defs>
                            <g transform="rotate(-90 220 220)">
                                <circle cx="220" cy="220" r="150" fill="none" stroke="#121624" stroke-width="58" />

                                <!-- Resolvidos -->
                                <circle cx="220" cy="220" r="150" fill="none" stroke="#10b981" stroke-width="58"
                                    stroke-dasharray="${totalAllCount > 0 ? (((totalAllCount - totalPendingCount) / totalAllCount) * 2 * Math.PI * 150).toFixed(2) : 0} ${(2 * Math.PI * 150).toFixed(2)}"
                                    stroke-dashoffset="0"
                                    filter="url(#glowPieResolvidoCQ)"
                                    style="transition: all 0.6s ease;" />

                                <!-- Pendentes -->
                                <circle cx="220" cy="220" r="150" fill="none" stroke="#ef4444" stroke-width="58"
                                    stroke-dasharray="${totalAllCount > 0 ? ((totalPendingCount / totalAllCount) * 2 * Math.PI * 150).toFixed(2) : 0} ${(2 * Math.PI * 150).toFixed(2)}"
                                    stroke-dashoffset="${totalAllCount > 0 ? (-(((totalAllCount - totalPendingCount) / totalAllCount) * 2 * Math.PI * 150)).toFixed(2) : 0}"
                                    filter="url(#glowPiePendenteCQ)"
                                    style="transition: all 0.6s ease;" />
                            </g>

                            <!-- Texto Central -->
                            <text x="220" y="190" text-anchor="middle" dominant-baseline="central" fill="#ffffff" font-size="76" font-weight="900" font-family="system-ui, -apple-system, sans-serif" letter-spacing="-2px">${totalAllCount}</text>
                            <text x="220" y="246" text-anchor="middle" dominant-baseline="central" fill="#94a3b8" font-size="14" font-weight="800" letter-spacing="3px" font-family="system-ui, -apple-system, sans-serif">OFS NO CQ</text>
                            <text x="220" y="272" text-anchor="middle" dominant-baseline="central" fill="#10b981" font-size="13" font-weight="800" letter-spacing="1.5px" font-family="system-ui, -apple-system, sans-serif">${totalAllCount > 0 ? (((totalAllCount - totalPendingCount) / totalAllCount) * 100).toFixed(1) : 0}% RESOLVIDO</text>
                        </svg>
                        
                        <!-- Lado Direito: LEGENDA RICA E QUEBRADA POR SITUA��O -->
                        <div style="display: flex; flex-direction: column; gap: 20px; min-width: 340px;">
                            
                            <!-- Bloco Resolvidos -->
                            <div style="background: rgba(16, 185, 129, 0.08); border-left: 4px solid #10b981; padding: 18px 22px; border-radius: 0 12px 12px 0;">
                                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
                                    <div style="color: #ffffff; font-weight: 800; font-size: 16px;">Status Bons (Resolvidos)</div>
                                    <div style="color: #10b981; font-weight: 900; font-size: 18px;">${totalAllCount > 0 ? (((totalAllCount - totalPendingCount) / totalAllCount) * 100).toFixed(1) : 0}%</div>
                                </div>
                                <div style="color: #34d399; font-size: 13.5px; font-weight: 600;">${totalAllCount - totalPendingCount} OFs em dia</div>
                            </div>

                            <!-- Bloco Pendentes -->
                            <div style="background: rgba(239, 68, 68, 0.08); border-left: 4px solid #ef4444; padding: 18px 22px; border-radius: 0 12px 12px 0;">
                                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;">
                                    <div style="color: #ffffff; font-weight: 800; font-size: 16px;">Pend�ncias no CQ</div>
                                    <div style="color: #ef4444; font-weight: 900; font-size: 18px;">${totalAllCount > 0 ? ((totalPendingCount / totalAllCount) * 100).toFixed(1) : 0}%</div>
                                </div>
                                
                                <!-- Breakdown das 5 situações -->
                                <div style="display: flex; flex-direction: column; gap: 12px;">
                                    <div class="${sitCounts['REPROVADO'] > 0 ? 'cq-reprovado-pulse' : ''}" style="display: flex; justify-content: space-between; align-items: center; font-size: 14px; border: 1px solid rgba(239,68,68,.7); border-radius: 7px; padding: 8px; background: rgba(239,68,68,.12);">
                                        <div style="display: flex; align-items: center; gap: 8px; color: #fca5a5;">
                                            <span style="width: 10px; height: 10px; border-radius: 50%; background: #ef4444; box-shadow: 0 0 8px #ef4444;"></span>
                                            <span>Reprovado</span>
                                        </div>
                                        <strong style="color: #ffffff;">${sitCounts['REPROVADO'] || 0} <span style="color: #fca5a5; font-size: 12px; margin-left: 4px;">(${totalAllCount > 0 ? (((sitCounts['REPROVADO'] || 0)/totalAllCount)*100).toFixed(1) : 0}%)</span></strong>
                                    </div>
                                    <div style="display: flex; justify-content: space-between; align-items: center; font-size: 14px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 8px;">
                                        <div style="display: flex; align-items: center; gap: 8px; color: #fbbf24;">
                                            <span style="width: 10px; height: 10px; border-radius: 50%; background: #fbbf24; box-shadow: 0 0 6px #fbbf24;"></span>
                                            <span>Reenviado CQ</span>
                                        </div>
                                        <strong style="color: #ffffff;">${sitCounts['REENVIADO CQ'] || 0} <span style="color: #64748b; font-size: 12px; margin-left: 4px;">(${totalAllCount > 0 ? (((sitCounts['REENVIADO CQ'] || 0)/totalAllCount)*100).toFixed(1) : 0}%)</span></strong>
                                    </div>

                                    <div style="display: flex; justify-content: space-between; align-items: center; font-size: 14px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 8px;">
                                        <div style="display: flex; align-items: center; gap: 8px; color: #38bdf8;">
                                            <span style="width: 10px; height: 10px; border-radius: 50%; background: #38bdf8; box-shadow: 0 0 6px #38bdf8;"></span>
                                            <span>Enviado</span>
                                        </div>
                                        <strong style="color: #ffffff;">${sitCounts['ENVIADO'] || 0} <span style="color: #64748b; font-size: 12px; margin-left: 4px;">(${totalAllCount > 0 ? (((sitCounts['ENVIADO'] || 0)/totalAllCount)*100).toFixed(1) : 0}%)</span></strong>
                                    </div>

                                    <div style="display: flex; justify-content: space-between; align-items: center; font-size: 14px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 8px;">
                                        <div style="display: flex; align-items: center; gap: 8px; color: #fb7185;">
                                            <span style="width: 10px; height: 10px; border-radius: 50%; background: #fb7185; box-shadow: 0 0 6px #fb7185;"></span>
                                            <span>Expirando Vig�ncia</span>
                                        </div>
                                        <strong style="color: #ffffff;">${sitCounts['EXPIRANDO VIGÊNCIA'] || 0} <span style="color: #64748b; font-size: 12px; margin-left: 4px;">(${totalAllCount > 0 ? (((sitCounts['EXPIRANDO VIGÊNCIA'] || 0)/totalAllCount)*100).toFixed(1) : 0}%)</span></strong>
                                    </div>

                                    <div style="display: flex; justify-content: space-between; align-items: center; font-size: 14px;">
                                        <div style="display: flex; align-items: center; gap: 8px; color: #a78bfa;">
                                            <span style="width: 10px; height: 10px; border-radius: 50%; background: #a78bfa; box-shadow: 0 0 6px #a78bfa;"></span>
                                            <span>Amostras em Produção</span>
                                        </div>
                                        <strong style="color: #ffffff;">${sitCounts['AMOSTRAS EM PRODUÇÃO'] || 0} <span style="color: #64748b; font-size: 12px; margin-left: 4px;">(${totalAllCount > 0 ? (((sitCounts['AMOSTRAS EM PRODUÇÃO'] || 0)/totalAllCount)*100).toFixed(1) : 0}%)</span></strong>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- GR�FICO 2: BAR CHART ORIGINAL -->
<!-- GRÁFICO GRANDE DE OFs PENDENTES NO CQ (DUAL VISUAL SVG) -->
            <div class="cq-big-chart-card" style="margin-bottom: 0;">
                <div class="leadtime-chart-header" style="border-bottom-color: rgba(56, 189, 248, 0.2);">
                    <div>
                        <h3 class="leadtime-chart-title">
                            <i class="fa-solid fa-chart-simple" style="color: #38bdf8;"></i>
                            <span>Distribuição de OFs Pendentes no CQ por Semana (Coluna N) e Situação (Coluna I)</span>
                        </h3>
                        <p class="leadtime-chart-subtitle">
                            Colunas empilhadas por Semana de CQ | Situações: Reprovado, Reenviado CQ, Enviado, Expirando Vigência e Amostras em Produção
                        </p>
                    </div>
                    <span class="badge badge-cyan" style="font-size: 11.5px; padding: 4px 10px;">
                        Clique em qualquer coluna ou situação para filtrar as OFs
                    </span>
                </div>

                <!-- SVG DUAL-AXIS CHART -->
                <svg viewBox="0 0 ${svgW} ${svgH}" class="cq-big-svg">
                    <defs>
                        <!-- Gradientes das 5 Situações -->
                        <linearGradient id="gradReprovadoCQ" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stop-color="#ff6b6b" stop-opacity="1"/>
                            <stop offset="100%" stop-color="#dc2626" stop-opacity="0.9"/>
                        </linearGradient>
                        <linearGradient id="gradReenviadoCQ" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stop-color="#fbbf24" stop-opacity="0.95"/>
                            <stop offset="100%" stop-color="#d97706" stop-opacity="0.8"/>
                        </linearGradient>
                        <linearGradient id="gradEnviadoCQ" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stop-color="#22d3ee" stop-opacity="0.95"/>
                            <stop offset="100%" stop-color="#0891b2" stop-opacity="0.8"/>
                        </linearGradient>
                        <linearGradient id="gradExpirandoCQ" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stop-color="#fb7185" stop-opacity="0.95"/>
                            <stop offset="100%" stop-color="#e11d48" stop-opacity="0.8"/>
                        </linearGradient>
                        <linearGradient id="gradProducaoCQ" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stop-color="#a78bfa" stop-opacity="0.95"/>
                            <stop offset="100%" stop-color="#7c3aed" stop-opacity="0.8"/>
                        </linearGradient>
                    </defs>

                    <!-- Linhas de Grade Horizontais e Eixo Y -->
                    ${[0, 0.25, 0.5, 0.75, 1].map(frac => {
                        const yVal = Math.round(yMaxWeek * frac);
                        const yPos = pad.top + drawH - (drawH * frac);
                        return `
                            <line x1="${pad.left}" y1="${yPos}" x2="${svgW - pad.right}" y2="${yPos}" stroke="rgba(255,255,255,0.07)" stroke-dasharray="3 3" />
                            <text x="${pad.left - 12}" y="${yPos + 4}" fill="#38bdf8" font-size="12" font-weight="800" text-anchor="end" font-family="system-ui, sans-serif">${yVal}</text>
                            <text x="${svgW - pad.right + 12}" y="${yPos + 4}" fill="#94a3b8" font-size="12" font-weight="700" text-anchor="start" font-family="system-ui, sans-serif">${yVal} OFs</text>
                        `;
                    }).join('')}

                    <!-- Linha Base do Eixo X -->
                    <line x1="${pad.left}" y1="${pad.top + drawH}" x2="${svgW - pad.right}" y2="${pad.top + drawH}" stroke="rgba(255,255,255,0.2)" stroke-width="1.5" />

                    <!-- COLUNAS EMPILHADAS POR SEMANA -->
                    ${weeksDataList.map((wData, colIdx) => {
                        const colCenterX = pad.left + (colIdx * colSlotW) + (colSlotW / 2);
                        const barX = colCenterX - (barW / 2);
                        let currentBaseY = pad.top + drawH;
                        const isWeekSelected = state.cqFilter && state.cqFilter.field === 'periodo' && state.cqFilter.value === wData.periodo;

                        const segmentElements = targetSituacoes.map(sitKey => {
                            const count = wData.bySit[sitKey] || 0;
                            if (count === 0) return '';
                            const segH = (count / yMaxWeek) * drawH;
                            const segY = currentBaseY - segH;
                            currentBaseY = segY;
                            const meta = situacaoMeta[sitKey];
                            const isSitSelected = state.cqFilter && state.cqFilter.field === 'situacao' && state.cqFilter.value === sitKey;

                            return `
                                <rect class="${sitKey === 'REPROVADO' ? 'cq-reprovado-svg-pulse' : ''}" x="${barX}" y="${segY}" width="${barW}" height="${Math.max(segH, 3)}"
                                    fill="url(#${meta.gradId})"
                                    opacity="${(isWeekSelected || isSitSelected) ? '1' : '0.9'}"
                                    rx="4"
                                    filter="${(isWeekSelected || isSitSelected) ? 'drop-shadow(0 0 8px ' + meta.color + ')' : 'none'}"
                                    style="cursor: pointer; transition: all 0.25s ease;"
                                    onclick="event.stopPropagation(); window.crmFilterCQ({ field: 'situacao', value: '${sitKey}' })"
                                >
                                    <title>Semana ${wData.periodo} • ${meta.label}: ${count} OFs</title>
                                </rect>
                                ${segH > 18 ? `
                                    <text x="${colCenterX}" y="${segY + (segH / 2) + 4}" fill="#ffffff" font-size="11.5" font-weight="900" text-anchor="middle" font-family="system-ui, sans-serif">
                                        ${count}
                                    </text>
                                ` : ''}
                            `;
                        }).join('');

                        const totalBarH = (wData.total / yMaxWeek) * drawH;
                        const barY = pad.top + drawH - totalBarH;

                        return `
                            <g class="leadtime-bar-group" style="cursor: pointer;" onclick="window.crmFilterCQ({ field: 'periodo', value: '${wData.periodo}' })">
                                <!-- Área de Hover -->
                                <rect x="${pad.left + (colIdx * colSlotW) + 2}" y="${pad.top}" width="${colSlotW - 4}" height="${drawH}" fill="rgba(255,255,255,${isWeekSelected ? '0.08' : '0.01'})" rx="6" />
                                
                                <!-- Segmentos Empilhados -->
                                ${segmentElements}

                                <!-- Rótulo de Quantidade no Topo da Barra com Pill Badge -->
                                <g class="of-label-pill">
                                    <rect x="${colCenterX - 18}" y="${barY - 22}" width="36" height="18" rx="4" fill="rgba(15, 23, 42, 0.95)" stroke="${wData.total > 0 ? '#38bdf8' : 'rgba(255,255,255,0.2)'}" stroke-width="1.2" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.5))" />
                                    <text x="${colCenterX}" y="${barY - 9}" fill="${wData.total > 0 ? '#ffffff' : '#64748b'}" font-size="12" font-weight="900" text-anchor="middle" font-family="system-ui, sans-serif">
                                        ${wData.total}
                                    </text>
                                </g>

                                <!-- Rótulo da Semana no Eixo X -->
                                <text x="${colCenterX}" y="${pad.top + drawH + 24}" fill="${isWeekSelected ? '#38bdf8' : '#cbd5e1'}" font-size="13" font-weight="800" text-anchor="middle" font-family="system-ui, sans-serif">
                                    ${wData.periodo}
                                </text>
                                
                                <text x="${colCenterX}" y="${pad.top + drawH + 42}" fill="#64748b" font-size="10.5" font-weight="700" text-anchor="middle" font-family="system-ui, sans-serif">
                                    Sem ${String(wData.periodo || '').slice(-2)}
                                </text>
                            </g>
                        `;
                    }).join('')}

                    <!-- LINHA DE TENDÊNCIA DE VOLUME PENDENTE -->
                    ${linePoints.length > 1 ? `
                        <path d="${linePathD}" fill="none" stroke="#38bdf8" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" filter="drop-shadow(0 0 6px rgba(56,189,248,0.5))" stroke-dasharray="4 4" />
                    ` : ''}

                    <!-- PONTOS DA LINHA DE TENDÊNCIA -->
                    ${linePoints.map(pt => `
                        <circle cx="${pt.x.toFixed(1)}" cy="${pt.y.toFixed(1)}" r="5" fill="#0f172a" stroke="#38bdf8" stroke-width="2.5" />
                    `).join('')}

                    <!-- Rótulos dos Eixos -->
                    <text x="${pad.left}" y="${pad.top - 18}" fill="#38bdf8" font-size="13" font-weight="800" text-anchor="start" font-family="system-ui, sans-serif">
                        ← QTD OFs PENDENTES
                    </text>
                    <text x="${svgW - pad.right}" y="${pad.top - 18}" fill="#94a3b8" font-size="13" font-weight="800" text-anchor="end" font-family="system-ui, sans-serif">
                        SEMANAS DE CQ (COL N) →
                    </text>
                </svg>

                <!-- LEGENDA INTERATIVA DAS 5 SITUAÇÕES -->
                <div class="leadtime-legend-bar" style="border-top-color: rgba(56, 189, 248, 0.15);">
                    ${targetSituacoes.map(sitKey => {
                        const meta = situacaoMeta[sitKey];
                        const count = sitCounts[sitKey] || 0;
                        const isSelected = state.cqFilter && state.cqFilter.field === 'situacao' && state.cqFilter.value === sitKey;

                        return `
                            <div class="cq-legend-chip ${isSelected ? 'active' : ''} ${sitKey === 'REPROVADO' && count > 0 ? 'cq-reprovado-pulse' : ''}" style="cursor: pointer; ${isSelected ? `border-color: ${meta.color}; background: ${meta.bg};` : ''}" onclick="window.crmFilterCQ({ field: 'situacao', value: '${sitKey}' })" title="Filtrar ${meta.label}">
                                <span class="cq-legend-dot" style="background: ${meta.color}; box-shadow: 0 0 8px ${meta.color};"></span>
                                <span style="font-weight: 700; color: #f1f5f9;">${meta.label}</span>
                                <span class="cq-legend-count" style="color: ${meta.lightColor}; font-size: 13px;">${count} OFs</span>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>

            
            </div>

            <!-- BARRA DE CONTROLES, BUSCA E ALTERNÂNCIA DE MODO (CARDS / TABELA) -->
            <div class="filter-toolbar" style="margin-bottom: 20px;">
                <div class="filter-toolbar-left" style="width: 100%; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;">
                    <!-- Input de Busca -->
                    <div class="search-input-wrapper" style="max-width: 380px; width: 100%;">
                        <i class="fa-solid fa-magnifying-glass search-icon"></i>
                        <input 
                            type="text" 
                            class="search-input" 
                            placeholder="Buscar por OF (Col B), Código, Semana, Setor, Situação..." 
                            value="${state.cqSearch || ''}"
                            oninput="window.crmSearchCQ(this.value)"
                        />
                        ${state.cqSearch ? `
                            <button class="search-clear-btn" onclick="window.crmSearchCQ('')" title="Limpar busca">&times;</button>
                        ` : ''}
                    </div>

                    <!-- Modo de Exibição (Cards / Tabela / Ambos) e Filtros Rápidos -->
                    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                        <!-- Alternador de Visualização -->
                        <div class="btn-group" style="background: rgba(15, 23, 42, 0.7); padding: 3px; border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.1);">
                            <button class="btn ${displayMode === 'cards' ? 'btn-primary' : 'btn-ghost'}" onclick="window.crmSetCQDisplayMode('cards')" style="font-size: 11.5px; padding: 5px 10px;" title="Ver fotos dos produtos em grade de cards">
                                <i class="fa-solid fa-grip"></i> Fotos (Cards)
                            </button>
                            <button class="btn ${displayMode === 'table' ? 'btn-primary' : 'btn-ghost'}" onclick="window.crmSetCQDisplayMode('table')" style="font-size: 11.5px; padding: 5px 10px;" title="Ver tabela detalhada">
                                <i class="fa-solid fa-table-list"></i> Tabela
                            </button>
                            <button class="btn ${displayMode === 'both' ? 'btn-primary' : 'btn-ghost'}" onclick="window.crmSetCQDisplayMode('both')" style="font-size: 11.5px; padding: 5px 10px;" title="Ver fotos e tabela">
                                <i class="fa-solid fa-layer-group"></i> Ambos
                            </button>
                        </div>

                        <!-- Filtro Apenas Pendentes vs Todas -->
                        <button class="exec-action-btn ${!state.cqFilter && !showAllMode ? 'active' : ''}" onclick="window.crmSetCQViewMode(false)" title="Ver apenas as 4 situações pendentes (${totalPendingCount} OFs)">
                            <i class="fa-solid fa-filter"></i> Apenas Pendentes (${totalPendingCount})
                        </button>
                        <button class="exec-action-btn ${showAllMode ? 'active' : ''}" onclick="window.crmSetCQViewMode(true)" title="Ver todas as 199 amostras da planilha">
                            Todas as Amostras (${totalAllCount})
                        </button>

                        ${activeFilterBadge ? `
                            <span class="badge badge-cyan" style="font-size: 11.5px; padding: 5px 10px; display: flex; align-items: center; gap: 6px;">
                                <i class="fa-solid fa-filter"></i> ${activeFilterBadge}
                                <i class="fa-solid fa-xmark" style="cursor: pointer;" onclick="window.crmFilterCQ(null)" title="Limpar filtro"></i>
                            </span>
                        ` : ''}
                    </div>
                </div>
            </div>

            <!-- SEÇÃO DE FOTOS DOS PRODUTOS PENDENTES (HIERARQUIA: SEMANA -> [SITUAÇÃO] -> [FOTOS 4 POR LINHA]) -->
            ${(displayMode === 'cards' || displayMode === 'both') ? `
                <div class="table-card" style="border-top: 3px solid #8b5cf6; margin-bottom: 24px; padding: 18px 20px;">
                    <div class="table-toolbar" style="border-bottom: 1px solid rgba(139, 92, 246, 0.2); justify-content: space-between; padding-bottom: 12px; margin-bottom: 16px;">
                        <div class="table-title-group">
                            <h3 class="table-title" style="display: flex; align-items: center; gap: 8px; color: #ffffff;">
                                <i class="fa-solid fa-images" style="color: #a78bfa;"></i>
                                <span>Produtos Pendentes no CQ (Organizados por Semana e Situação)</span>
                            </h3>
                            <span class="badge badge-purple">${filteredRecords.length} OFs exibidas</span>
                        </div>
                        <div style="font-size: 11.5px; color: #94a3b8;">
                            <i class="fa-solid fa-arrow-down-short-wide"></i> Hierarquia: Semana &rarr; [Situação Amostra] &rarr; Fotos
                        </div>
                    </div>

                    ${filteredRecords.length === 0 ? `
                        <div style="text-align: center; padding: 48px 20px; color: var(--text-muted);">
                            <i class="fa-solid fa-clipboard-check" style="font-size: 38px; color: #34d399; margin-bottom: 10px; opacity: 0.8;"></i>
                            <h4 style="font-size: 15px; color: #e2e8f0; margin-bottom: 4px;">Nenhum produto pendente encontrado</h4>
                            <p style="font-size: 12px; margin-top: 4px;">Não há pedidos com as situações ou filtros selecionados no momento.</p>
                        </div>
                    ` : `
                        <div class="cq-hierarchy-container" style="display: flex; flex-direction: column; gap: 24px; width: 100%;">
                            ${sortedHierarchyWeekKeys.map(wKey => {
                                const wGroup = hierarchyWeeks[wKey];
                                const sitKeys = Object.keys(wGroup.situations);

                                return `
                                    <!-- BLOCO DA SEMANA -->
                                    <div class="cq-week-group-block" style="width: 100%; display: flex; flex-direction: column; gap: 14px; background: rgba(15, 23, 42, 0.5); border: 1px solid rgba(168, 85, 247, 0.3); border-radius: 12px; padding: 18px; box-sizing: border-box;">
                                        
                                        <!-- CABEÇALHO DA SEMANA -->
                                        <div class="cq-week-header-row" style="width: 100%; display: flex; align-items: center; justify-content: space-between; background: linear-gradient(90deg, rgba(168, 85, 247, 0.28) 0%, rgba(15, 23, 42, 0.85) 100%); border-left: 4px solid #a855f7; border-radius: 8px; padding: 12px 18px; box-sizing: border-box;">
                                            <div style="display: flex; align-items: center; gap: 10px;">
                                                <i class="fa-solid fa-calendar-week" style="color: #c084fc; font-size: 20px;"></i>
                                                <h3 style="font-size: 18px; font-weight: 800; color: #ffffff; margin: 0; letter-spacing: 0.5px; text-transform: uppercase;">
                                                    SEMANA ${wKey}
                                                </h3>
                                                <span class="badge badge-purple" style="font-size: 12px; font-weight: 800; padding: 4px 12px; cursor: pointer;" onclick="window.crmFilterCQ({ field: 'periodo', value: '${wKey}' })" title="Filtrar apenas semana ${wKey}">
                                                    ${wGroup.total} ${wGroup.total === 1 ? 'OF' : 'OFs'}
                                                </span>
                                            </div>
                                            <div style="font-size: 12px; color: #cbd5e1; font-weight: 600;">
                                                Semana ${String(wKey || '').slice(-2)} / 2026
                                            </div>
                                        </div>

                                        <!-- SITUAÇÕES DENTRO DESTA SEMANA -->
                                        ${sitKeys.map(sKey => {
                                            const sitObj = wGroup.situations[sKey];
                                            const meta = situacaoMeta[sKey] || { 
                                                color: '#94a3b8', 
                                                lightColor: '#cbd5e1', 
                                                bg: 'rgba(148, 163, 184, 0.15)', 
                                                border: 'rgba(148, 163, 184, 0.35)',
                                                label: sitObj.desc, 
                                                icon: 'fa-circle-info' 
                                            };

                                            return `
                                                <!-- SUB-BLOCO DA SITUAÇÃO -->
                                                <div class="cq-sit-group-block" style="width: 100%; display: flex; flex-direction: column; gap: 10px; margin-top: 6px; box-sizing: border-box;">
                                                    <!-- SUB-CABEÇALHO DA SITUAÇÃO -->
                                                    <div class="cq-sit-subheading" style="width: 100%; display: flex; align-items: center; gap: 10px; margin-bottom: 6px;">
                                                        <span class="${sKey === 'REPROVADO' ? 'cq-reprovado-pulse' : ''}" style="display: inline-flex; align-items: center; gap: 6px; font-size: 13.5px; font-weight: 900; color: ${meta.color}; background: ${meta.bg}; border: 1.5px solid ${meta.border}; padding: 5px 14px; border-radius: 6px; box-shadow: 0 0 10px ${meta.color}33; text-transform: uppercase; cursor: pointer;" onclick="window.crmFilterCQ({ field: 'situacao', value: '${sKey}' })" title="Filtrar ${meta.label}">
                                                            <i class="fa-solid ${meta.icon}"></i> [${meta.label.toUpperCase()}]
                                                        </span>
                                                        <span style="font-size: 12px; color: #94a3b8; font-weight: 700;">
                                                            (${sitObj.items.length} ${sitObj.items.length === 1 ? 'produto' : 'produtos'})
                                                        </span>
                                                    </div>

                                                    <!-- GRADE DE FOTOS 4 POR LINHA -->
                                                    <div class="s13-photo-grid" style="display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; width: 100%; margin-bottom: 12px; box-sizing: border-box;">
                                                        ${sitObj.items.map(item => {
                                                            const imgInfo = getProductImage(item.codigo, item.of);
                                                            const escapedDesc = (item.produtoDesc || 'Produto').replace(/'/g, "\\'");
                                                            const escapedCode = (item.codigo || '').replace(/'/g, "\\'");

                                                            return `
                                                                <div class="s13-photo-card card-critico ${item.sitNorm === 'REPROVADO' ? 'cq-reprovado-pulse' : ''}" style="border-color: ${meta.border || 'rgba(56, 189, 248, 0.35)'};">
                                                                    <!-- ÁREA DA FOTO -->
                                                                    <div class="s13-photo-wrapper cq-product-media" style="aspect-ratio: 4/3; width: 100%; height: 210px; background: #090b10; position: relative; overflow: hidden; display: flex; align-items: center; justify-content: center;">
                                                                        <!-- BADGE DA SITUAÇÃO NO TOPO ESQUERDO -->
                                                                        <span class="s13-photo-tag ${item.sitNorm === 'REPROVADO' ? 'cq-reprovado-pulse' : ''}" style="background: ${meta.color}; color: #ffffff; font-weight: 800; top: 10px; left: 10px; border-radius: 6px; box-shadow: 0 0 10px ${meta.color}88; font-size: 10.5px; padding: 3px 8px; cursor: pointer;" onclick="event.stopPropagation(); window.crmFilterCQ({ field: 'situacao', value: '${item.sitNorm || item.descAmostra}' })" title="Filtrar situação ${item.descAmostra}">
                                                                            <i class="fa-solid ${meta.icon}"></i> ${item.descAmostra}
                                                                        </span>

                                                                        <!-- BADGE DA SEMANA NO TOPO DIREITO -->
                                                                        <span class="s13-photo-tag" style="background: rgba(15, 23, 42, 0.88); border: 1px solid rgba(168, 85, 247, 0.5); color: #c084fc; font-weight: 800; top: 10px; right: 10px; left: auto; font-size: 11px; padding: 3px 8px; cursor: pointer;" onclick="event.stopPropagation(); window.crmFilterCQ({ field: 'periodo', value: '${item.periodo}' })" title="Filtrar semana ${item.periodo}">
                                                                            <i class="fa-solid fa-calendar-week"></i> ${item.periodo}
                                                                        </span>

                                                                        ${imgInfo.hasImage ? `
                                                                            <img src="${imgInfo.thumbUrl}" loading="eager" decoding="async" width="420" height="315" class="s13-photo-img cq-product-image" alt="${item.codigo}" onerror="if (this.dataset.fallback !== '1') { this.dataset.fallback='1'; this.src='${imgInfo.proxyUrl}'; } else { this.onerror=null; this.closest('.cq-product-media')?.classList.add('image-unavailable'); }" onclick="window.crmOpenImageLightbox('${imgInfo.largeUrl}', '${escapedCode}', 'OF ${item.of} • Sem ${item.periodo} • ${item.setorAmostra} • ${escapedDesc}', '${imgInfo.largeFallbackUrl || ''}')" title="Clique para ampliar a foto" style="width: 100%; height: 100%; object-fit: contain; padding: 6px;">
                                                                        ` : `
                                                                            <div class="s13-photo-placeholder" style="background: #111827; width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 16px; text-align: center;">
                                                                                <i class="fa-solid fa-shirt s13-placeholder-icon" style="font-size: 32px; color: rgba(56, 189, 248, 0.4); margin-bottom: 8px;"></i>
                                                                                <strong style="color: #cbd5e1; font-size: 13px; font-family: monospace;">${item.codigo}</strong>
                                                                                <span style="font-size: 10px; color: var(--text-muted); margin-top: 4px;"><i class="fa-solid fa-camera-retro"></i> Sem foto na pasta</span>
                                                                            </div>
                                                                        `}
                                                                    </div>

                                                                    <!-- CORPO DO CARD COM INFORMAÇÕES COMPLETAS -->
                                                                    <div class="s13-card-body" style="padding: 12px;">
                                                                        <!-- Linha 1: Código, OF e Cliente -->
                                                                        <div class="s13-card-code-row" style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
                                                                            <div class="s13-card-code" style="font-size: 13px; font-weight: 800; color: #00d4ff; font-family: monospace;" title="Código do Produto">${item.codigo}</div>
                                                                            <div style="display: flex; align-items: center; gap: 4px;">
                                                                                <span class="badge badge-cyan" style="font-size: 10px; padding: 2px 6px;" title="Cliente">${item.cliente}</span>
                                                                                <span class="s13-card-op-badge" style="background: rgba(56, 189, 248, 0.2); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.4); font-size: 10.5px; font-weight: 800; padding: 2px 6px; border-radius: 4px;" title="Ordem / OF">OF ${item.of}</span>
                                                                            </div>
                                                                        </div>

                                                                        <!-- Linha 2: Descrição do Produto -->
                                                                        <div style="font-size: 11.5px; font-weight: 600; color: #e2e8f0; line-height: 1.35; max-height: 32px; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; margin-bottom: 6px;" title="${item.produtoDesc}">
                                                                            ${item.produtoDesc || 'Amostra de Produto CQ'}
                                                                        </div>

                                                                        <!-- Linha 3: Destaque do Setor CQ (Coluna K) -->
                                                                        <div style="margin-top: 4px; margin-bottom: 6px;">
                                                                            <div class="s13-dias-badge normal" style="background: rgba(139, 92, 246, 0.12); border: 1px solid rgba(139, 92, 246, 0.35); color: #a78bfa; display: flex; align-items: center; justify-content: space-between; padding: 4px 8px; border-radius: 6px; cursor: pointer;" onclick="window.crmFilterCQ({ field: 'setor', value: '${item.setorAmostra}' })" title="Filtrar por este setor">
                                                                                <span style="font-size: 10.5px;"><i class="fa-solid fa-industry" style="color: #a78bfa; margin-right: 4px;"></i> <strong>SETOR CQ:</strong></span>
                                                                                <span style="font-weight: 800; color: #ffffff; background: #6d28d9; padding: 2px 7px; border-radius: 4px; font-size: 10.5px;">${item.setorAmostra}</span>
                                                                            </div>
                                                                        </div>

                                                                        <!-- Linha 4: Métricas do Pedido (Peças, Dias CQ, Situação) -->
                                                                        <div style="display: flex; align-items: center; justify-content: space-between; padding-top: 6px; border-top: 1px solid rgba(255, 255, 255, 0.08); font-size: 11px;">
                                                                            <span style="color: #94a3b8;"><i class="fa-solid fa-boxes-stacked"></i> <strong>${item.qtde}</strong> pçs</span>
                                                                            <span class="badge ${item.diasCQ > 3 ? 'badge-rose' : 'badge-sub'}" style="font-size: 10px; padding: 2px 6px;" title="Dias no CQ">
                                                                                <i class="fa-solid fa-clock"></i> ${item.diasCQ} dias
                                                                            </span>
                                                                            ${item.obs ? `
                                                                                <span style="color: #38bdf8; cursor: pointer; font-size: 10.5px;" title="Obs: ${item.obs}">
                                                                                    <i class="fa-solid fa-comment-dots"></i> Obs
                                                                                </span>
                                                                            ` : ''}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            `;
                                                        }).join('')}
                                                    </div>
                                                </div>
                                            `;
                                        }).join('')}
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    `}
                </div>
            ` : ''}

            <!-- TABELA DETALHADA DE OFs DO CQ -->
            ${(displayMode === 'table' || displayMode === 'both') ? `
                <div class="table-card" style="border-top: 3px solid #38bdf8; margin-bottom: 24px;">
                    <div class="table-toolbar" style="border-bottom: 1px solid rgba(56, 189, 248, 0.2); justify-content: space-between;">
                        <div class="table-title-group">
                            <h3 class="table-title" style="display: flex; align-items: center; gap: 8px; color: #ffffff;">
                                <i class="fa-solid fa-table-list" style="color: #38bdf8;"></i>
                                <span>Listagem Detalhada de OFs no Controle de Qualidade (CQ)</span>
                            </h3>
                            <span class="badge badge-sub">${filteredRecords.length} OFs exibidas</span>
                        </div>
                    </div>

                    <div class="table-responsive">
                        <table class="crm-table">
                            <thead>
                                <tr>
                                    <th>OF (Col B - NUMERO)</th>
                                    <th>Código do Produto (Col E)</th>
                                    <th>Descrição do Produto</th>
                                    <th>Coleção</th>
                                    <th>Semana / Período (Col N)</th>
                                    <th>Situação da Amostra (Col I)</th>
                                    <th>Setor CQ (Col K)</th>
                                    <th>Cliente</th>
                                    <th>Qtde Peças</th>
                                    <th>Dias no CQ</th>
                                    <th>Representante</th>
                                    <th>Observações</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${filteredRecords.length === 0 ? `
                                    <tr>
                                        <td colspan="12" style="text-align: center; padding: 36px; color: var(--text-muted);">
                                            Nenhuma OF encontrada no CQ para os filtros aplicados.
                                        </td>
                                    </tr>
                                ` : filteredRecords.map(item => {
                                    const meta = situacaoMeta[item.sitNorm] || { color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.15)' };
                                    const isCritico = item.diasCQ > 4;

                                    return `
                                        <tr class="${item.sitNorm === 'REPROVADO' ? 'row-danger cq-reprovado-row' : isCritico ? 'row-danger' : ''}">
                                            <td class="table-op-cell">
                                                <span style="font-family: monospace; font-weight: 800; color: #38bdf8; font-size: 13.5px;">${item.of}</span>
                                            </td>
                                            <td>
                                                <span style="font-family: 'SF Mono', Monaco, monospace; font-weight: 700; color: #ffffff; font-size: 13px;">${item.codigo}</span>
                                            </td>
                                            <td>
                                                <div style="font-size: 12.5px; color: #e2e8f0; font-weight: 500; max-width: 260px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${item.produtoDesc}">
                                                    ${item.produtoDesc}
                                                </div>
                                            </td>
                                            <td style="font-size: 12px; color: #94a3b8;">${item.colecao}</td>
                                            <td>
                                                <span class="badge badge-purple" style="font-weight: 800; cursor: pointer;" onclick="window.crmFilterCQ({ field: 'periodo', value: '${item.periodo}' })" title="Filtrar semana ${item.periodo}">
                                                    ${item.periodo}
                                                </span>
                                            </td>
                                            <td>
                                                <span class="badge ${item.sitNorm === 'REPROVADO' ? 'cq-reprovado-pulse' : ''}" style="background: ${meta.bg || 'rgba(15,23,42,0.8)'}; border: 1px solid ${meta.color}; color: ${meta.color}; font-weight: 800; cursor: pointer;" onclick="window.crmFilterCQ({ field: 'situacao', value: '${item.sitNorm || item.descAmostra}' })" title="Filtrar situação ${item.descAmostra}">
                                                    ${item.descAmostra}
                                                </span>
                                            </td>
                                            <td>
                                                <span class="badge badge-sub" style="font-weight: 800; color: #ffffff; cursor: pointer;" onclick="window.crmFilterCQ({ field: 'setor', value: '${item.setorAmostra}' })" title="Filtrar setor ${item.setorAmostra}">
                                                    ${item.setorAmostra}
                                                </span>
                                            </td>
                                            <td>
                                                <span class="badge badge-cyan" style="font-weight: 800;">
                                                    ${item.cliente}
                                                </span>
                                            </td>
                                            <td style="font-weight: 700; color: #f8fafc; font-family: monospace;">${item.qtde}</td>
                                            <td>
                                                <span class="badge ${item.diasCQ > 3 ? 'badge-rose' : 'badge-sub'}" style="font-weight: 800;">
                                                    ${item.diasCQ} d
                                                </span>
                                            </td>
                                            <td style="font-size: 12px; color: #cbd5e1; font-weight: 600;">${item.responsavel}</td>
                                            <td style="font-size: 11.5px; color: #94a3b8; max-width: 240px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${item.obs}">${item.obs || '—'}</td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            ` : ''}
        `;
    }


    // =========================================================================
    // 7. MÓDULO ESTILO PEDIDO - MALOTES PENDENTES (SETORES 88 E 83)
    // =========================================================================
    function renderMalotesView(container) {
        // Regras do Usuário:
        // - Cruzar informações dos produtos nos setores de malote (88 e 83) com os setores da parte principal (05, 06, 12, 13, 26, 20, 31, 106)
        // - Trazer a quantidade de MALOTES TOTAIS em cada setor (Setor 88 e Setor 83)
        // - Setores principais (05, 06, 12, 13, 26): considerados NO PRAZO (Fluxo Normal)
        // - Setores principais (20, 31, 106): considerados CRÍTICOS (Os malotes já deveriam estar prontos!)
        // - Dois gráficos de Pizza/Donut Grandes (Padrão 440x440 idêntico a Aviamentos X01 / Cores D01):
        //   1) SETOR 88 • Dividido por setor da parte principal
        //   2) SETOR 83 • Dividido por setor da parte principal
        // - Grade de Fotos (4 por linha): Trazer as imagens APENAS dos produtos pendentes no setor 88 e 83 que estão com a parte principal nos setores CRÍTICOS (20, 31, 106)!
        
        const PROD_SECTOR_LIST = ['05', '06', '12', '13', '26', '20', '31', '106'];
        const CRITICAL_SECTOR_LIST = ['20', '31', '106'];
        const ON_TIME_SECTOR_LIST = ['05', '06', '12', '13', '26'];

        // 1. Mapear setores principais de produção de cada OP em state.allData
        const opProdSectorsMap = new Map();
        state.allData.forEach(item => {
            if (!item.op) return;
            if (!opProdSectorsMap.has(item.op)) {
                opProdSectorsMap.set(item.op, new Set());
            }
            if (PROD_SECTOR_LIST.includes(item.setor)) {
                opProdSectorsMap.get(item.op).add(item.setor);
            }
        });

        // 2. Extrair todos os itens/registros de Malote (Setores 88 e 83)
        const malotes88Items = [];
        const malotes83Items = [];

        state.allData.forEach(item => {
            const s = (item.setor || '').trim();
            if (s !== '88' && s !== '088' && s !== '83' && s !== '083') return;

            const pSectors = Array.from(opProdSectorsMap.get(item.op) || []);
            let primarySector = 'Sem Setor Prod';
            if (pSectors.length > 0) {
                // Prioriza setores críticos se houver mais de um
                const crit = pSectors.find(sec => CRITICAL_SECTOR_LIST.includes(sec));
                primarySector = crit || pSectors[0];
            }

            const isCritico = pSectors.some(sec => CRITICAL_SECTOR_LIST.includes(sec));
            const isNoPrazo = pSectors.some(sec => ON_TIME_SECTOR_LIST.includes(sec));

            const maloteEntry = {
                ...item,
                maloteSetor: (s === '88' || s === '088') ? '88' : '83',
                primarySector,
                prodSectors: pSectors,
                isCritico,
                isNoPrazo
            };

            if (maloteEntry.maloteSetor === '88') {
                malotes88Items.push(maloteEntry);
            } else {
                malotes83Items.push(maloteEntry);
            }
        });

        const allMaloteItems = [...malotes88Items, ...malotes83Items];
        const totalMalotes88 = malotes88Items.length;
        const totalMalotes83 = malotes83Items.length;
        const totalAllMalotes = allMaloteItems.length;

        const uniqueOps88 = new Set(malotes88Items.map(m => m.op)).size;
        const uniqueOps83 = new Set(malotes83Items.map(m => m.op)).size;

        const criticalMalotes = allMaloteItems.filter(m => m.isCritico);
        const onTimeMalotes = allMaloteItems.filter(m => m.isNoPrazo);
        const totalPecasAll = allMaloteItems.reduce((sum, r) => sum + (r.qtdeOriginal || 0), 0);

        // Paleta de Cores e Metadados para os Setores Principais
        const sectorMetaMap = {
            '05': { color: '#38bdf8', glow: '#0284c7', label: 'Setor 05 (Desenvolvimento)', isCritico: false },
            '06': { color: '#3b82f6', glow: '#1d4ed8', label: 'Setor 06 (Arte / Estamparia)', isCritico: false },
            '12': { color: '#6366f1', glow: '#4338ca', label: 'Setor 12 (Engenharia)', isCritico: false },
            '13': { color: '#00d4ff', glow: '#0891b2', label: 'Setor 13 (Modelagem)', isCritico: false },
            '26': { color: '#10b981', glow: '#059669', label: 'Setor 26 (Corte / Sala)', isCritico: false },
            '20': { color: '#f43f5e', glow: '#e11d48', label: 'Setor 20 (Costura / Facção)', isCritico: true },
            '31': { color: '#e11d48', glow: '#be123c', label: 'Setor 31 (Acabamento)', isCritico: true },
            '106': { color: '#fb7185', glow: '#e11d48', label: 'Setor 106 (Expedição / Final)', isCritico: true },
            'Sem Setor Prod': { color: '#64748b', glow: '#475569', label: 'Sem Setor Prod', isCritico: false }
        };

        // Geometria Donut SVG Padrão (viewBox 0 0 440 440, raio 150)
        const radius = 150;
        const circumference = 2 * Math.PI * radius; // ~942.48

        // Helper para gerar fatias de donut agrupadas por setor principal
        function generateDonutData(itemsList, totalItemsCount) {
            const grouped = {};
            itemsList.forEach(item => {
                const sec = item.primarySector || 'Sem Setor Prod';
                if (!grouped[sec]) {
                    grouped[sec] = {
                        sector: sec,
                        count: 0,
                        pecas: 0,
                        ops: new Set(),
                        meta: sectorMetaMap[sec] || { color: '#94a3b8', glow: '#64748b', label: `Setor ${sec}`, isCritico: false },
                        items: []
                    };
                }
                grouped[sec].count++;
                grouped[sec].pecas += (item.qtdeOriginal || 0);
                grouped[sec].ops.add(item.op);
                grouped[sec].items.push(item);
            });

            // Ordenar: primeiro setores críticos (20, 31, 106), depois por quantidade desc
            const sortedList = Object.values(grouped).sort((a, b) => {
                const aCrit = CRITICAL_SECTOR_LIST.includes(a.sector) ? 1 : 0;
                const bCrit = CRITICAL_SECTOR_LIST.includes(b.sector) ? 1 : 0;
                if (bCrit !== aCrit) return bCrit - aCrit;
                return b.count - a.count;
            });

            let accum = 0;
            const total = totalItemsCount || itemsList.length;
            const slices = sortedList.map(g => {
                const dash = total > 0 ? (g.count / total) * circumference : 0;
                const offset = -accum;
                accum += dash;
                return {
                    ...g,
                    dash: dash.toFixed(2),
                    offset: offset.toFixed(2),
                    percent: total > 0 ? ((g.count / total) * 100).toFixed(1) : '0'
                };
            });

            return { total, slices, list: sortedList };
        }

        const donut88 = generateDonutData(malotes88Items, totalMalotes88);
        const donut83 = generateDonutData(malotes83Items, totalMalotes83);

        // 3. Filtragem e busca da tela
        let filteredDisplayMalotes = allMaloteItems;

        if (state.malotesFilter) {
            if (state.malotesFilter.field === 'maloteSetor') {
                filteredDisplayMalotes = filteredDisplayMalotes.filter(m => m.maloteSetor === state.malotesFilter.value);
            } else if (state.malotesFilter.field === 'primarySector') {
                filteredDisplayMalotes = filteredDisplayMalotes.filter(m => m.primarySector === state.malotesFilter.value);
            } else if (state.malotesFilter.field === 'status') {
                if (state.malotesFilter.value === 'critico') {
                    filteredDisplayMalotes = filteredDisplayMalotes.filter(m => m.isCritico);
                } else if (state.malotesFilter.value === 'noprazo') {
                    filteredDisplayMalotes = filteredDisplayMalotes.filter(m => m.isNoPrazo);
                }
            }
        }

        if (state.malotesSearch && state.malotesSearch.trim().length > 0) {
            const q = state.malotesSearch.trim().toLowerCase();
            filteredDisplayMalotes = filteredDisplayMalotes.filter(m => 
                (m.op || '').toLowerCase().includes(q) ||
                (m.codigo || '').toLowerCase().includes(q) ||
                (m.descricao || '').toLowerCase().includes(q) ||
                (m.cliente || '').toLowerCase().includes(q) ||
                (m.maloteSetor || '').toLowerCase().includes(q) ||
                (m.primarySector || '').toLowerCase().includes(q)
            );
        }

        // Deduplicar produtos críticos para os Cards de Fotos (1 card por OP/Código)
        const criticalPhotoMap = new Map();
        criticalMalotes.forEach(item => {
            const key = `${item.op}_${item.codigo}`;
            if (!criticalPhotoMap.has(key)) {
                criticalPhotoMap.set(key, { ...item, totalPecasOP: 0 });
            }
            criticalPhotoMap.get(key).totalPecasOP += (item.qtdeOriginal || 0);
        });

        const photoCriticalItems = Array.from(criticalPhotoMap.values()).sort((a, b) => {
            const compSec = String(a.primarySector).localeCompare(String(b.primarySector), undefined, { numeric: true });
            if (compSec !== 0) return compSec;
            return String(a.op).localeCompare(String(b.op), undefined, { numeric: true });
        });

        container.innerHTML = `
            <!-- CABEÇALHO DO MÓDULO MALOTES -->
            <div class="module-view-header" style="margin-bottom: 24px;">
                <div class="module-view-title-group">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span class="view-tag-badge" style="background: rgba(236, 72, 153, 0.2); color: #f472b6; border: 1px solid rgba(236, 72, 153, 0.4);">
                            <i class="fa-solid fa-envelope-open-text"></i> MALOTES
                        </span>
                        <h2 style="font-size: 21px; font-weight: 800; color: #ffffff; margin: 0;">Módulo Estilo Pedido: MALOTES (Setores 88 e 83)</h2>
                    </div>
                    <p class="module-view-description" style="font-size: 13px; color: var(--text-muted); margin-top: 4px;">
                        Cruzamento analítico: Malotes pendentes nos Setores 88 e 83 vs Setor onde a Parte Principal do pedido se encontra (05, 06, 12, 13, 26, 20, 31, 106).
                    </p>
                </div>
                
                <div class="btn-group" style="flex-wrap: wrap; gap: 8px;">
                    <span class="badge badge-rose" style="font-size: 12px; padding: 6px 14px; background: rgba(244, 63, 94, 0.2); border-color: rgba(244, 63, 94, 0.4); color: #fb7185;">
                        <i class="fa-solid fa-triangle-exclamation"></i> ${criticalMalotes.length} Malotes Críticos (Setores 20, 31, 106)
                    </span>
                    <span class="badge badge-emerald" style="font-size: 12px; padding: 6px 14px;">
                        <i class="fa-solid fa-circle-check"></i> ${onTimeMalotes.length} No Prazo (Setores 05, 06, 12, 13, 26)
                    </span>
                    <span class="badge badge-sub" style="font-size: 12px; padding: 6px 14px; color: #ffffff;">
                        <i class="fa-solid fa-layer-group"></i> ${totalAllMalotes} Total Malotes (${formatNumber(totalPecasAll)} pçs)
                    </span>
                </div>
            </div>

            <!-- GRID DOS DOIS GRÁFICOS GRANDES DE PIZZA / DONUT (50% / 50%) - PADRÃO EXECUTIVO -->
            <div class="exec-processo-layout" style="grid-template-columns: repeat(auto-fit, minmax(420px, 1fr)); gap: 24px; margin-bottom: 24px;">
                
                <!-- GRÁFICO 1: SETOR 88 • MALOTES POR SETOR PRINCIPAL -->
                <div class="hero-pie-chart-container" style="background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(236, 72, 153, 0.35); border-radius: 14px; padding: 22px;">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <i class="fa-solid fa-envelope" style="color: #f472b6; font-size: 18px;"></i>
                            <h3 style="font-size: 16px; font-weight: 800; color: #ffffff; margin: 0;">SETOR 88 &bull; POR SETOR PRINCIPAL (MALOTES)</h3>
                        </div>
                        <span class="badge" style="background: rgba(236, 72, 153, 0.2); color: #f472b6; border: 1px solid rgba(236, 72, 153, 0.4); font-size: 11px; padding: 3px 8px; font-weight: 800;">
                            ${totalMalotes88} Malotes (${uniqueOps88} OPs)
                        </span>
                    </div>

                    <svg viewBox="0 0 440 440" class="hero-donut-svg">
                        <defs>
                            ${donut88.slices.map((slice, idx) => `
                                <filter id="glowDonutMalote88_${idx}" x="-30%" y="-30%" width="160%" height="160%">
                                    <feDropShadow dx="0" dy="0" stdDeviation="12" flood-color="${slice.meta.color}" flood-opacity="0.85"/>
                                </filter>
                            `).join('')}
                        </defs>
                        <g transform="rotate(-90 220 220)">
                            <!-- Trilha circular de fundo -->
                            <circle cx="220" cy="220" r="150" fill="none" stroke="#121624" stroke-width="58" />
                            
                            <!-- Fatias por Setor Principal -->
                            ${donut88.total > 0 ? donut88.slices.map((slice, idx) => `
                                <circle cx="220" cy="220" r="150" fill="none" stroke="${slice.meta.color}" stroke-width="58"
                                    stroke-dasharray="${slice.dash} ${circumference.toFixed(2)}"
                                    stroke-dashoffset="${slice.offset}"
                                    filter="url(#glowDonutMalote88_${idx})"
                                    style="cursor: pointer; transition: all 0.3s ease;"
                                    onclick="window.crmFilterMalotes({ field: 'primarySector', value: '${slice.sector}' })"
                                >
                                    <title>${slice.meta.label}: ${slice.count} malotes (${slice.percent}%)</title>
                                </circle>
                            `).join('') : `
                                <circle cx="220" cy="220" r="150" fill="none" stroke="#334155" stroke-width="58"
                                    stroke-dasharray="${circumference.toFixed(2)} ${circumference.toFixed(2)}"
                                    stroke-dashoffset="0"
                                />
                            `}
                        </g>
                        <!-- Texto Central -->
                        <text x="220" y="190" text-anchor="middle" dominant-baseline="central" fill="#ffffff" font-size="76" font-weight="900" font-family="system-ui, -apple-system, sans-serif" letter-spacing="-2px">${totalMalotes88}</text>
                        <text x="220" y="246" text-anchor="middle" dominant-baseline="central" fill="#94a3b8" font-size="14" font-weight="800" letter-spacing="3px" font-family="system-ui, -apple-system, sans-serif">MALOTES</text>
                        <text x="220" y="272" text-anchor="middle" dominant-baseline="central" fill="#f472b6" font-size="13" font-weight="800" letter-spacing="1.5px" font-family="system-ui, -apple-system, sans-serif">SETOR 88 (${uniqueOps88} OPs)</text>
                    </svg>

                    <!-- Legenda Rápida de Setores Principais do Setor 88 -->
                    <div class="hero-pie-quick-legend" style="grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); margin-top: 14px;">
                        ${donut88.slices.map(slice => {
                            const isSelected = state.malotesFilter && state.malotesFilter.field === 'primarySector' && state.malotesFilter.value === slice.sector;
                            const isCrit = CRITICAL_SECTOR_LIST.includes(slice.sector);
                            return `
                                <div class="donut-legend-card ${isSelected ? 'active' : ''}" style="cursor: pointer; border-left: 4px solid ${slice.meta.color}; background: rgba(15, 23, 42, 0.7);" onclick="window.crmFilterMalotes({ field: 'primarySector', value: '${slice.sector}' })" title="Filtrar pedidos onde parte principal está no ${slice.meta.label}">
                                    <div class="donut-legend-label">
                                        <span class="legend-dot" style="background: ${slice.meta.color}; box-shadow: 0 0 8px ${slice.meta.color};"></span>
                                        <div>
                                            <div style="font-weight: 700; font-size: 12.5px; color: #ffffff;">
                                                ${isCrit ? '<i class="fa-solid fa-triangle-exclamation" style="color: #fb7185;"></i> ' : ''}SETOR ${slice.sector}
                                            </div>
                                            <div style="font-size: 11px; color: ${isCrit ? '#fb7185' : 'var(--text-muted)'}; font-weight: ${isCrit ? '700' : '500'};">
                                                ${isCrit ? '🚨 CRÍTICO' : 'No Prazo'} &bull; ${formatNumber(slice.pecas)} pçs
                                            </div>
                                        </div>
                                    </div>
                                    <div style="text-align: right;">
                                        <div class="donut-legend-value" style="font-size: 13.5px; color: ${slice.meta.color};">${slice.count} malotes (${slice.percent}%)</div>
                                        <span style="font-size: 10px; color: ${slice.meta.color}; text-decoration: underline;">Filtrar &darr;</span>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>

                <!-- GRÁFICO 2: SETOR 83 • MALOTES POR SETOR PRINCIPAL -->
                <div class="hero-pie-chart-container" style="background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(168, 85, 247, 0.35); border-radius: 14px; padding: 22px;">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <i class="fa-solid fa-folder-open" style="color: #c084fc; font-size: 18px;"></i>
                            <h3 style="font-size: 16px; font-weight: 800; color: #ffffff; margin: 0;">SETOR 83 &bull; POR SETOR PRINCIPAL (MALOTES)</h3>
                        </div>
                        <span class="badge" style="background: rgba(168, 85, 247, 0.2); color: #c084fc; border: 1px solid rgba(168, 85, 247, 0.4); font-size: 11px; padding: 3px 8px; font-weight: 800;">
                            ${totalMalotes83} Malotes (${uniqueOps83} OPs)
                        </span>
                    </div>

                    <svg viewBox="0 0 440 440" class="hero-donut-svg">
                        <defs>
                            ${donut83.slices.map((slice, idx) => `
                                <filter id="glowDonutMalote83_${idx}" x="-30%" y="-30%" width="160%" height="160%">
                                    <feDropShadow dx="0" dy="0" stdDeviation="12" flood-color="${slice.meta.color}" flood-opacity="0.85"/>
                                </filter>
                            `).join('')}
                        </defs>
                        <g transform="rotate(-90 220 220)">
                            <!-- Trilha circular de fundo -->
                            <circle cx="220" cy="220" r="150" fill="none" stroke="#121624" stroke-width="58" />
                            
                            <!-- Fatias por Setor Principal -->
                            ${donut83.total > 0 ? donut83.slices.map((slice, idx) => `
                                <circle cx="220" cy="220" r="150" fill="none" stroke="${slice.meta.color}" stroke-width="58"
                                    stroke-dasharray="${slice.dash} ${circumference.toFixed(2)}"
                                    stroke-dashoffset="${slice.offset}"
                                    filter="url(#glowDonutMalote83_${idx})"
                                    style="cursor: pointer; transition: all 0.3s ease;"
                                    onclick="window.crmFilterMalotes({ field: 'primarySector', value: '${slice.sector}' })"
                                >
                                    <title>${slice.meta.label}: ${slice.count} malotes (${slice.percent}%)</title>
                                </circle>
                            `).join('') : `
                                <circle cx="220" cy="220" r="150" fill="none" stroke="#334155" stroke-width="58"
                                    stroke-dasharray="${circumference.toFixed(2)} ${circumference.toFixed(2)}"
                                    stroke-dashoffset="0"
                                />
                            `}
                        </g>
                        <!-- Texto Central -->
                        <text x="220" y="190" text-anchor="middle" dominant-baseline="central" fill="#ffffff" font-size="76" font-weight="900" font-family="system-ui, -apple-system, sans-serif" letter-spacing="-2px">${totalMalotes83}</text>
                        <text x="220" y="246" text-anchor="middle" dominant-baseline="central" fill="#94a3b8" font-size="14" font-weight="800" letter-spacing="3px" font-family="system-ui, -apple-system, sans-serif">MALOTES</text>
                        <text x="220" y="272" text-anchor="middle" dominant-baseline="central" fill="#c084fc" font-size="13" font-weight="800" letter-spacing="1.5px" font-family="system-ui, -apple-system, sans-serif">SETOR 83 (${uniqueOps83} OPs)</text>
                    </svg>

                    <!-- Legenda Rápida de Setores Principais do Setor 83 -->
                    <div class="hero-pie-quick-legend" style="grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); margin-top: 14px;">
                        ${donut83.slices.map(slice => {
                            const isSelected = state.malotesFilter && state.malotesFilter.field === 'primarySector' && state.malotesFilter.value === slice.sector;
                            const isCrit = CRITICAL_SECTOR_LIST.includes(slice.sector);
                            return `
                                <div class="donut-legend-card ${isSelected ? 'active' : ''}" style="cursor: pointer; border-left: 4px solid ${slice.meta.color}; background: rgba(15, 23, 42, 0.7);" onclick="window.crmFilterMalotes({ field: 'primarySector', value: '${slice.sector}' })" title="Filtrar pedidos onde parte principal está no ${slice.meta.label}">
                                    <div class="donut-legend-label">
                                        <span class="legend-dot" style="background: ${slice.meta.color}; box-shadow: 0 0 8px ${slice.meta.color};"></span>
                                        <div>
                                            <div style="font-weight: 700; font-size: 12.5px; color: #ffffff;">
                                                ${isCrit ? '<i class="fa-solid fa-triangle-exclamation" style="color: #fb7185;"></i> ' : ''}SETOR ${slice.sector}
                                            </div>
                                            <div style="font-size: 11px; color: ${isCrit ? '#fb7185' : 'var(--text-muted)'}; font-weight: ${isCrit ? '700' : '500'};">
                                                ${isCrit ? '🚨 CRÍTICO' : 'No Prazo'} &bull; ${formatNumber(slice.pecas)} pçs
                                            </div>
                                        </div>
                                    </div>
                                    <div style="text-align: right;">
                                        <div class="donut-legend-value" style="font-size: 13.5px; color: ${slice.meta.color};">${slice.count} malotes (${slice.percent}%)</div>
                                        <span style="font-size: 10px; color: ${slice.meta.color}; text-decoration: underline;">Filtrar &darr;</span>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            </div>

            <!-- SEÇÃO DE FOTOS DOS PRODUTOS CRÍTICOS (PARTE PRINCIPAL NOS SETORES 20, 31 E 106) -->
            <div class="table-card" id="malotesGallerySection" style="border-top: 3px solid #f43f5e; margin-bottom: 24px; padding: 18px 20px;">
                <div class="table-toolbar" style="border-bottom: 1px solid rgba(244, 63, 94, 0.2); justify-content: space-between; padding-bottom: 12px; margin-bottom: 16px;">
                    <div class="table-title-group">
                        <h3 class="table-title" style="display: flex; align-items: center; gap: 8px; color: #ffffff;">
                            <i class="fa-solid fa-camera" style="color: #fb7185;"></i>
                            <span>Fotos dos Produtos Críticos (Malote Pendente 88/83 e Parte Principal em Setor 20, 31 ou 106)</span>
                        </h3>
                        <span class="badge badge-rose" style="font-weight: 800;">${photoCriticalItems.length} Produtos Críticos</span>
                    </div>
                    <div style="font-size: 12px; color: #fb7185; font-weight: 700;">
                        <i class="fa-solid fa-fire-flame-curved"></i> Ação Urgente: Malote atrasado em relação à produção
                    </div>
                </div>

                ${photoCriticalItems.length === 0 ? `
                    <div style="text-align: center; padding: 36px 20px; color: var(--text-muted);">
                        <i class="fa-solid fa-circle-check" style="font-size: 38px; color: #10b981; margin-bottom: 10px;"></i>
                        <h4 style="font-size: 15px; color: #e2e8f0; margin-bottom: 4px;">Nenhum produto crítico encontrado</h4>
                        <p style="font-size: 12px;">Todos os malotes nos setores 88 e 83 estão alinhados com fases iniciais da produção (05, 06, 12, 13, 26).</p>
                    </div>
                ` : `
                    <!-- GRADE VISUAL 4 POR LINHA COM FOTOS DOS PRODUTOS CRÍTICOS -->
                    <div class="s13-photo-grid" style="margin-top: 6px;">
                        ${photoCriticalItems.map(item => {
                            const imgInfo = getProductImage(item.codigo, item.op);
                            const escapedDesc = (item.descricao || 'Produto').replace(/'/g, "\\'");
                            const escapedCode = (item.codigo || '').replace(/'/g, "\\'");

                            return `
                                <div class="s13-photo-card card-critico" style="border-color: rgba(244, 63, 94, 0.45); box-shadow: 0 4px 16px rgba(244, 63, 94, 0.15);">
                                    <!-- ÁREA DA FOTO -->
                                    <div class="s13-photo-wrapper">
                                        <!-- BADGE DE DESTAQUE DO SETOR CRÍTICO NA FOTO -->
                                        <span class="s13-photo-tag" style="background: #e11d48; color: #ffffff; font-weight: 800; top: 10px; left: 10px; border-radius: 6px; box-shadow: 0 0 10px rgba(225, 29, 72, 0.8); font-size: 11px; padding: 3px 8px;" title="Setor Onde a Parte Principal Está">
                                            <i class="fa-solid fa-triangle-exclamation"></i> PRINCIPAL: SETOR ${item.primarySector}
                                        </span>

                                        <!-- BADGE DO SETOR DO MALOTE NO TOPO DIREITO -->
                                        <span class="s13-photo-tag" style="background: rgba(236, 72, 153, 0.9); color: #ffffff; font-weight: 800; top: 10px; right: 10px; left: auto; font-size: 10.5px; padding: 3px 8px;" title="Setor do Malote">
                                            <i class="fa-solid fa-envelope"></i> MALOTE ${item.maloteSetor}
                                        </span>

                                        ${imgInfo.hasImage ? `
                                            <img src="${imgInfo.thumbUrl}" loading="lazy" class="s13-photo-img" alt="${item.codigo}" onerror="this.onerror=null; this.src='${imgInfo.proxyUrl}';">
                                            <div class="s13-photo-overlay" onclick="window.crmOpenImageLightbox('${imgInfo.largeUrl}', '${escapedCode}', 'OP ${item.op} • Malote ${item.maloteSetor} • Principal Setor ${item.primarySector} • ${escapedDesc}')">
                                                <i class="fa-solid fa-magnifying-glass-plus" style="font-size: 24px; color: #38bdf8;"></i>
                                                <span>Ampliar Foto</span>
                                            </div>
                                        ` : `
                                            <div class="s13-photo-placeholder" style="background: #111827;">
                                                <i class="fa-solid fa-shirt s13-placeholder-icon"></i>
                                                <strong style="color: #cbd5e1; font-size: 13px; font-family: monospace;">${item.codigo}</strong>
                                                <span style="font-size: 10px; color: var(--text-muted);"><i class="fa-solid fa-camera-retro"></i> Sem foto na pasta</span>
                                            </div>
                                        `}
                                    </div>

                                    <!-- CORPO DO CARD COM INFORMAÇÕES COMPLETAS -->
                                    <div class="s13-card-body">
                                        <!-- Linha 1: Código, OP e Cliente -->
                                        <div class="s13-card-code-row">
                                            <div class="s13-card-code" title="Código do Produto">${item.codigo}</div>
                                            <div style="display: flex; align-items: center; gap: 4px;">
                                                <span class="badge badge-cyan" style="font-size: 10.5px; padding: 2px 6px;">${item.cliente}</span>
                                                <span class="s13-card-op-badge" style="background: rgba(244, 63, 94, 0.2); color: #fb7185; border: 1px solid rgba(244, 63, 94, 0.4);" title="Ordem / OP">OP ${item.op}</span>
                                            </div>
                                        </div>

                                        <!-- Linha 2: Descrição do Produto -->
                                        <div style="font-size: 12px; font-weight: 600; color: #e2e8f0; line-height: 1.35; max-height: 34px; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; margin-bottom: 6px;" title="${item.descricao}">
                                            ${item.descricao}
                                        </div>

                                        <!-- Linha 3: Destaque do Cruzamento (Principal vs Malote) -->
                                        <div style="margin-top: 4px; margin-bottom: 6px;">
                                            <div class="s13-dias-badge normal" style="background: rgba(225, 29, 72, 0.12); border: 1px solid rgba(225, 29, 72, 0.4); color: #fb7185; display: flex; align-items: center; justify-content: space-between; padding: 5px 8px;">
                                                <span style="font-size: 10.5px;"><strong>Principal:</strong> Setor ${item.primarySector}</span>
                                                <span style="font-size: 10.5px; color: #f472b6;"><strong>Malote:</strong> Setor ${item.maloteSetor}</span>
                                            </div>
                                        </div>

                                        <!-- Linha 4: Métricas do Pedido (Peças, Dias Parado) -->
                                        <div style="display: flex; align-items: center; justify-content: space-between; padding-top: 4px; border-top: 1px solid rgba(255, 255, 255, 0.08); font-size: 11px;">
                                            <span style="color: #94a3b8;"><i class="fa-solid fa-boxes-stacked"></i> <strong>${item.totalPecasOP || item.qtdeOriginal || 0}</strong> pçs</span>
                                            <span class="badge badge-rose" style="font-size: 10.5px; padding: 2px 6px;" title="Dias no Setor">
                                                <i class="fa-solid fa-clock"></i> ${item.diasParado} dias
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                `}
            </div>

            <!-- BARRA DE CONTROLES E BUSCA DA TABELA -->
            <div class="filter-toolbar pdf-screen-controls" style="margin-bottom: 16px;">
                <div class="filter-toolbar-left" style="width: 100%; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;">
                    <!-- Input de Busca -->
                    <div class="search-input-wrapper" style="max-width: 380px; width: 100%;">
                        <i class="fa-solid fa-magnifying-glass search-icon"></i>
                        <input 
                            type="text" 
                            class="search-input" 
                            placeholder="Buscar por OP, Código, Setor, Cliente..." 
                            value="${state.malotesSearch || ''}"
                            oninput="window.crmSearchMalotes(this.value)"
                        />
                        ${state.malotesSearch ? `
                            <button class="search-clear-btn" onclick="window.crmSearchMalotes('')" title="Limpar busca">&times;</button>
                        ` : ''}
                    </div>

                    <!-- Filtros Rápidos -->
                    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                        <button class="exec-action-btn ${!state.malotesFilter ? 'active' : ''}" onclick="window.crmFilterMalotes(null)">
                            Todos (${totalAllMalotes})
                        </button>
                        <button class="exec-action-btn ${state.malotesFilter && state.malotesFilter.value === 'critico' ? 'active' : ''}" onclick="window.crmFilterMalotes({ field: 'status', value: 'critico' })" style="border-color: rgba(244, 63, 94, 0.4); color: #fb7185;">
                            <i class="fa-solid fa-triangle-exclamation"></i> Apenas Críticos (${criticalMalotes.length})
                        </button>
                        <button class="exec-action-btn ${state.malotesFilter && state.malotesFilter.value === '88' ? 'active' : ''}" onclick="window.crmFilterMalotes({ field: 'maloteSetor', value: '88' })">
                            Setor 88 (${totalMalotes88})
                        </button>
                        <button class="exec-action-btn ${state.malotesFilter && state.malotesFilter.value === '83' ? 'active' : ''}" onclick="window.crmFilterMalotes({ field: 'maloteSetor', value: '83' })">
                            Setor 83 (${totalMalotes83})
                        </button>
                    </div>
                </div>
            </div>

            <!-- TABELA DETALHADA DE MALOTES -->
            <div class="table-card pdf-detail-list" id="malotesTableSection" style="border-top: 3px solid #ec4899; margin-bottom: 24px;">
                <div class="table-toolbar" style="border-bottom: 1px solid rgba(236, 72, 153, 0.2); justify-content: space-between;">
                    <div class="table-title-group">
                        <h3 class="table-title" style="display: flex; align-items: center; gap: 8px; color: #ffffff;">
                            <i class="fa-solid fa-table-list" style="color: #f472b6;"></i>
                            <span>Listagem Geral de Pedidos com Malote (Setores 88 e 83)</span>
                        </h3>
                        <span class="badge badge-sub">${filteredDisplayMalotes.length} Malotes listados</span>
                    </div>
                </div>

                <div class="table-responsive">
                    <table class="crm-table">
                        <thead>
                            <tr>
                                <th>OP / Número</th>
                                <th>Código do Produto</th>
                                <th>Descrição do Produto</th>
                                <th>Setor Malote</th>
                                <th>Setor Parte Principal</th>
                                <th>Status de Prazo</th>
                                <th>Cliente</th>
                                <th>Qtde Peças</th>
                                <th>Dias no Setor</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${filteredDisplayMalotes.length === 0 ? `
                                <tr>
                                    <td colspan="9" style="text-align: center; padding: 36px; color: var(--text-muted);">
                                        Nenhum pedido de malote encontrado para os filtros selecionados.
                                    </td>
                                </tr>
                            ` : filteredDisplayMalotes.map(item => {
                                const secMeta = sectorMetaMap[item.primarySector] || { color: '#94a3b8', label: item.primarySector };
                                return `
                                    <tr class="${item.isCritico ? 'row-danger' : ''}">
                                        <td class="table-op-cell">
                                            <span style="font-family: monospace; font-weight: 800; color: #38bdf8; font-size: 13.5px;">${item.op}</span>
                                        </td>
                                        <td>
                                            <span style="font-family: 'SF Mono', Monaco, monospace; font-weight: 700; color: #ffffff; font-size: 13px;">${item.codigo}</span>
                                        </td>
                                        <td>
                                            <div style="font-size: 12.5px; color: #e2e8f0; font-weight: 500; max-width: 280px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${item.descricao}">
                                                ${item.descricao}
                                            </div>
                                        </td>
                                        <td>
                                            <span class="badge" style="background: rgba(236, 72, 153, 0.2); border: 1px solid rgba(236, 72, 153, 0.4); color: #f472b6; font-weight: 800;">
                                                Setor ${item.maloteSetor}
                                            </span>
                                        </td>
                                        <td>
                                            <span class="badge" style="background: ${secMeta.color}22; border: 1px solid ${secMeta.color}66; color: ${secMeta.color}; font-weight: 800;">
                                                Setor ${item.primarySector}
                                            </span>
                                        </td>
                                        <td>
                                            ${item.isCritico ? `
                                                <span class="badge badge-rose" style="font-weight: 800; font-size: 11px;">
                                                    <i class="fa-solid fa-triangle-exclamation"></i> CRÍTICO (${item.primarySector})
                                                </span>
                                            ` : `
                                                <span class="badge badge-emerald" style="font-weight: 800; font-size: 11px;">
                                                    <i class="fa-solid fa-circle-check"></i> No Prazo
                                                </span>
                                            `}
                                        </td>
                                        <td>
                                            <span class="badge badge-cyan" style="font-weight: 800;">${item.cliente}</span>
                                        </td>
                                        <td style="font-weight: 700; color: #f8fafc; font-family: monospace;">${formatNumber(item.qtdeOriginal || 0)}</td>
                                        <td>
                                            <span class="badge ${item.diasParado > 2 ? 'badge-rose' : 'badge-sub'}" style="font-weight: 800;">
                                                ${item.diasParado} dias
                                            </span>
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    // =========================================================================
    // 5.2. MÓDULO MODELAGEM - LEADTIME PRODUTIVO (SETOR 13 - PLANILHA 22V)
    // =========================================================================
    function renderLeadtimeView(container) {
        // Regras do Usuário:
        // - Planilha Base: 22V - 2601 até 2652 (14eFcBm3glH1H04dG7UKoLvIXf0QithHrNXnscGxyvdw)
        // - Quantidade de OFs totais (Coluna A - ORDEM / OF) dividida por mês de liberação
        // - Data de Liberação: Coluna U - DT_FINAL (determina o mês)
        // - Média de tempo que ficou no setor 13: Coluna AE - DIAS_REALIZADO por mês
        // - Gráfico Grande de Colunas: quantidade de pedidos liberados em cada mês e leadtime médio (dias)
        //   para saber se o time está evoluindo (ficando mais rápido)
        
        const ltExt = state.leadtimeExternalData || { count: 0, records: [], isLive: false };
        const rawRecords = ltExt.records || [];

        // Helper flexível para extração de campos
        function extractLTField(row, possibleNames, fallbackIndex) {
            const keys = Object.keys(row || {});
            for (const name of possibleNames) {
                const targetNorm = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
                for (const k of keys) {
                    const keyNorm = k.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
                    if (keyNorm === targetNorm || keyNorm.includes(targetNorm)) {
                        const val = row[k];
                        if (val !== undefined && val !== null && String(val).trim().length > 0) {
                            return String(val).trim();
                        }
                    }
                }
            }
            if (fallbackIndex !== undefined && keys[fallbackIndex] !== undefined) {
                const val = row[keys[fallbackIndex]];
                if (val !== undefined && val !== null && String(val).trim().length > 0) {
                    return String(val).trim();
                }
            }
            return '';
        }

        // Helper de parsing de Data Final -> Mês/Ano e Chave de Ordenação
        const monthNamesPt = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        const fullMonthNamesPt = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

        function parseMonthKey(dtStr) {
            if (!dtStr || typeof dtStr !== 'string') return { key: '9999-99', label: 'Sem Data', year: 0, month: 0, sortKey: 999999 };
            const clean = dtStr.trim();
            let d, m, y;
            if (clean.includes('/')) {
                const parts = clean.split('/');
                d = parseInt(parts[0], 10);
                m = parseInt(parts[1], 10);
                y = parseInt(parts[2], 10);
                if (y < 100) y += 2000;
            } else if (clean.includes('-')) {
                const parts = clean.split('-');
                if (parts[0].length === 4) {
                    y = parseInt(parts[0], 10);
                    m = parseInt(parts[1], 10);
                    d = parseInt(parts[2], 10);
                } else {
                    d = parseInt(parts[0], 10);
                    m = parseInt(parts[1], 10);
                    y = parseInt(parts[2], 10);
                }
            }

            if (!m || isNaN(m) || m < 1 || m > 12 || !y || isNaN(y) || y < 2000) {
                return { key: '9999-99', label: 'Sem Data', year: 0, month: 0, sortKey: 999999 };
            }

            const mStr = String(m).padStart(2, '0');
            const key = `${y}-${mStr}`;
            const label = `${monthNamesPt[m - 1]}/${String(y).slice(-2)}`;
            const fullLabel = `${fullMonthNamesPt[m - 1]} de ${y}`;
            const sortKey = (y * 100) + m;

            return { key, label, fullLabel, year: y, month: m, sortKey };
        }

        // Normalização de registros da planilha 22V
        const normalizedRecords = rawRecords.map((r, idx) => {
            const op = extractLTField(r, ['ordem', 'numero', 'número', 'of', 'op', 'pedido'], 0) || `OF-${idx + 1}`;
            const codigo = extractLTField(r, ['codigo', 'código', 'produto', 'referencia', 'ref'], 7) || '—';
            const produtoDesc = extractLTField(r, ['produto_desc', 'descricao', 'descrição', 'produto', 'desc'], 8) || 'Produto em Modelagem';
            const colecao = extractLTField(r, ['colecao', 'coleção', 'estacao', 'estação', 'grupo_desc'], 9) || '—';
            
            // Coluna AA (REALIZADO_FIM) - Data efetiva de liberação do pedido na modelagem (estritamente Coluna AA)
            const dtLiberacaoRaw = extractLTField(r, ['realizado_fim', 'realizadofim', 'dt_realizado_fim'], 26);
            const dtFinal = dtLiberacaoRaw || '—';
            const monthInfo = parseMonthKey(dtLiberacaoRaw);

            // Coluna AE (DIAS_REALIZADO) - Tempo em dias no Setor 13 (estritamente Coluna AE)
            const diasRaw = extractLTField(r, ['dias_realizado', 'diasrealizado', 'dias_real'], 30);
            const diasRealizado = parseFloat(String(diasRaw).replace(',', '.')) || 0;

            const qtde = parseInt(extractLTField(r, ['pecas', 'peças', 'qtd_pedido', 'qtde', 'quantidade'], 31) || '1', 10) || 1;
            const responsavel = extractLTField(r, ['responsavel', 'responsável', 'representante', 'resp'], 12) || '—';
            const status = extractLTField(r, ['status', 'situacao', 'situação', 'posse'], 33) || 'CONCLUÍDO';

            return {
                id: idx,
                op,
                codigo,
                produtoDesc,
                colecao,
                dtFinal,
                monthKey: monthInfo.key,
                monthLabel: monthInfo.label,
                monthFullLabel: monthInfo.fullLabel,
                monthSortKey: monthInfo.sortKey,
                diasRealizado,
                qtde,
                responsavel,
                status,
                raw: r
            };
        });

        const totalOFsCount = normalizedRecords.length;
        const totalPecas = normalizedRecords.reduce((sum, r) => sum + r.qtde, 0);

        // Agrupamento por Mês
        const monthsMap = {};
        normalizedRecords.forEach(r => {
            if (r.monthKey === '9999-99') return;
            const k = r.monthKey;
            if (!monthsMap[k]) {
                monthsMap[k] = {
                    key: k,
                    label: r.monthLabel,
                    fullLabel: r.monthFullLabel,
                    sortKey: r.monthSortKey,
                    totalOFs: 0,
                    totalPecas: 0,
                    totalDias: 0,
                    diasList: [],
                    records: []
                };
            }
            monthsMap[k].totalOFs += 1;
            monthsMap[k].totalPecas += r.qtde;
            monthsMap[k].totalDias += r.diasRealizado;
            monthsMap[k].diasList.push(r.diasRealizado);
            monthsMap[k].records.push(r);
        });

        // Período solicitado: Setembro de 2025 (2025-09) até Agosto de 2026 (2026-08)
        const targetPeriodKeys = [
            '2025-09', '2025-10', '2025-11', '2025-12',
            '2026-01', '2026-02', '2026-03', '2026-04',
            '2026-05', '2026-06', '2026-07', '2026-08'
        ];

        // Garante todos os 12 meses do ciclo no período
        targetPeriodKeys.forEach(pk => {
            if (!monthsMap[pk]) {
                const parts = pk.split('-');
                const y = parseInt(parts[0], 10);
                const m = parseInt(parts[1], 10);
                monthsMap[pk] = {
                    key: pk,
                    label: monthNamesPt[m - 1] + '/' + String(y).slice(-2),
                    fullLabel: fullMonthNamesPt[m - 1] + ' de ' + y,
                    sortKey: (y * 100) + m,
                    totalOFs: 0,
                    totalPecas: 0,
                    totalDias: 0,
                    diasList: [],
                    records: []
                };
            }
        });

        const sortedMonths = targetPeriodKeys.map(k => monthsMap[k]).filter(Boolean);

        // Cálculos estatísticos por mês
        sortedMonths.forEach((m, i) => {
            m.avgLeadtime = m.totalOFs > 0 ? (m.totalDias / m.totalOFs) : 0;
            m.minDays = m.diasList.length > 0 ? Math.min(...m.diasList) : 0;
            m.maxDays = m.diasList.length > 0 ? Math.max(...m.diasList) : 0;

            if (i > 0) {
                const prev = sortedMonths[i - 1];
                if (prev.avgLeadtime > 0) {
                    const diff = m.avgLeadtime - prev.avgLeadtime;
                    m.pctChange = ((diff / prev.avgLeadtime) * 100);
                    m.isFaster = diff < 0;
                } else {
                    m.pctChange = 0;
                    m.isFaster = false;
                }
            } else {
                m.pctChange = null;
                m.isFaster = null;
            }
        });

        // Estatísticas Globais
        const validMonths = sortedMonths.filter(m => m.totalOFs > 0);
        const overallTotalDias = validMonths.reduce((sum, m) => sum + m.totalDias, 0);
        const overallTotalOFs = validMonths.reduce((sum, m) => sum + m.totalOFs, 0);
        const overallAvgLeadtime = overallTotalOFs > 0 ? (overallTotalDias / overallTotalOFs) : 0;

        let fastestMonth = null;
        let slowestMonth = null;
        if (validMonths.length > 0) {
            fastestMonth = [...validMonths].sort((a, b) => a.avgLeadtime - b.avgLeadtime)[0];
            slowestMonth = [...validMonths].sort((a, b) => b.avgLeadtime - a.avgLeadtime)[0];
        }

        let globalTrendPct = 0;
        let isGlobalImproving = false;
        if (validMonths.length >= 2) {
            const firstM = validMonths[0];
            const lastM = validMonths[validMonths.length - 1];
            if (firstM.avgLeadtime > 0) {
                globalTrendPct = (((lastM.avgLeadtime - firstM.avgLeadtime) / firstM.avgLeadtime) * 100);
                isGlobalImproving = globalTrendPct < 0;
            }
        }

        // Geração do Gráfico Grande de Colunas & Linha de Leadtime (Dual Visual SVG - Ampliado em 25%+)
        const svgW = 1200;
        const svgH = 490;
        const pad = { top: 48, right: 85, bottom: 70, left: 85 };
        const drawW = svgW - pad.left - pad.right;
        const drawH = svgH - pad.top - pad.bottom;

        const maxOFs = Math.max(...sortedMonths.map(m => m.totalOFs), 5);
        const yMaxOFs = Math.ceil(maxOFs * 1.22);

        const maxLeadtime = Math.max(...sortedMonths.map(m => m.avgLeadtime), 5);
        const yMaxLT = Math.ceil(maxLeadtime * 1.22);

        const numCols = sortedMonths.length || 1;
        const colSlotW = drawW / numCols;
        const barW = Math.min(62, Math.max(36, colSlotW - 24));

        // Coordenadas dos pontos da linha de Leadtime
        const linePoints = sortedMonths.map((m, idx) => {
            const cx = pad.left + (idx * colSlotW) + (colSlotW / 2);
            const cy = pad.top + drawH - ((m.avgLeadtime / yMaxLT) * drawH);
            return { x: cx, y: cy, data: m };
        });

        const linePathD = linePoints.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`).join(' ');

        // Filtros e Pesquisa na Tabela
        let filteredRecords = normalizedRecords;
        if (state.leadtimeSearch && state.leadtimeSearch.trim().length > 0) {
            const q = state.leadtimeSearch.trim().toLowerCase();
            filteredRecords = filteredRecords.filter(r => 
                r.op.toLowerCase().includes(q) ||
                r.codigo.toLowerCase().includes(q) ||
                r.produtoDesc.toLowerCase().includes(q) ||
                r.colecao.toLowerCase().includes(q) ||
                r.dtFinal.toLowerCase().includes(q) ||
                r.monthLabel.toLowerCase().includes(q) ||
                r.responsavel.toLowerCase().includes(q) ||
                r.status.toLowerCase().includes(q)
            );
        }

        let activeMonthBadge = null;
        if (state.leadtimeFilter) {
            filteredRecords = filteredRecords.filter(r => r.monthKey === state.leadtimeFilter);
            const mMatch = sortedMonths.find(m => m.key === state.leadtimeFilter);
            activeMonthBadge = mMatch ? mMatch.fullLabel : state.leadtimeFilter;
        }

        container.innerHTML = `
            <!-- CABEÇALHO DO MÓDULO LEADTIME PRODUTIVO -->
            <div class="module-view-header" style="margin-bottom: 22px;">
                <div class="module-view-title-group">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span class="view-tag-badge" style="background: rgba(16, 185, 129, 0.2); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.4);">
                            <i class="fa-solid fa-stopwatch"></i> SETOR 13
                        </span>
                        <h2 style="font-size: 21px; font-weight: 800; color: #ffffff; margin: 0;">Módulo: LEADTIME PRODUTIVO (MODELAGEM)</h2>
                    </div>
                    <p class="module-view-description" style="font-size: 13px; color: var(--text-muted); margin-top: 4px;">
                        Análise de produtividade e evolução da velocidade da equipe. Quantidade de OFs liberadas por mês (Coluna U - DT_FINAL) e tempo médio decorrido no Setor 13 (Coluna AE - DIAS_REALIZADO).
                    </p>
                </div>
                
                <div class="btn-group" style="flex-wrap: wrap; gap: 8px;">
                    <span class="badge badge-emerald" style="font-size: 12px; padding: 6px 14px;">
                        <i class="fa-solid fa-check-double"></i> ${totalOFsCount} OFs Monitoradas
                    </span>
                    <span class="badge badge-cyan" style="font-size: 12px; padding: 6px 14px;">
                        <i class="fa-solid fa-calendar-days"></i> ${sortedMonths.length} Meses Analisados
                    </span>
                    <a href="https://docs.google.com/spreadsheets/d/14eFcBm3glH1H04dG7UKoLvIXf0QithHrNXnscGxyvdw/edit" target="_blank" class="btn btn-glass" style="font-size: 11.5px; padding: 6px 12px; text-decoration: none; color: #34d399;" title="Abrir planilha 22V no Google Drive">
                        <i class="fa-solid fa-arrow-up-right-from-square"></i> Planilha 22V Drive
                    </a>
                    <button class="btn btn-glass" onclick="window.crmSyncLeadtimeDrive()" style="font-size: 11.5px; padding: 6px 12px;" title="Atualizar dados da planilha do Drive">
                        <i class="fa-solid fa-arrows-rotate"></i> Sincronizar 22V
                    </button>
                    <button class="btn btn-glass" onclick="window.crmOpenLeadtimeImportModal()" style="font-size: 11.5px; padding: 6px 12px; border-color: rgba(16, 185, 129, 0.4); color: #34d399;" title="Importar ou colar dados da planilha 22V">
                        <i class="fa-solid fa-file-import"></i> Colar Dados 22V
                    </button>
                </div>
            </div>

            <!-- CARDS DE KPIS EXECUTIVOS -->
            <div class="leadtime-kpi-grid">
                <div class="leadtime-kpi-card">
                    <div class="leadtime-kpi-icon">
                        <i class="fa-solid fa-gauge-high"></i>
                    </div>
                    <div class="leadtime-kpi-info">
                        <div class="leadtime-kpi-label">Leadtime Médio Geral</div>
                        <div class="leadtime-kpi-value">${overallAvgLeadtime.toFixed(2).replace('.', ',')} <span style="font-size: 14px; font-weight: 600; color: #94a3b8;">dias</span></div>
                        <div class="leadtime-kpi-sub"><i class="fa-solid fa-clock"></i> Soma: ${Math.round(overallTotalDias).toLocaleString('pt-BR')} dias (Col AE)</div>
                    </div>
                </div>

                <div class="leadtime-kpi-card" style="border-color: rgba(56, 189, 248, 0.3);">
                    <div class="leadtime-kpi-icon" style="background: rgba(56, 189, 248, 0.15); color: #38bdf8;">
                        <i class="fa-solid fa-box-check"></i>
                    </div>
                    <div class="leadtime-kpi-info">
                        <div class="leadtime-kpi-label">Total OFs Liberadas</div>
                        <div class="leadtime-kpi-value">${totalOFsCount} <span style="font-size: 14px; font-weight: 600; color: #94a3b8;">OFs</span></div>
                        <div class="leadtime-kpi-sub" style="color: #38bdf8;"><i class="fa-solid fa-cubes"></i> ${totalPecas.toLocaleString('pt-BR')} peças entregues</div>
                    </div>
                </div>

                <div class="leadtime-kpi-card" style="border-color: rgba(245, 158, 11, 0.3);">
                    <div class="leadtime-kpi-icon" style="background: rgba(245, 158, 11, 0.15); color: #fbbf24;">
                        <i class="fa-solid fa-trophy"></i>
                    </div>
                    <div class="leadtime-kpi-info">
                        <div class="leadtime-kpi-label">Mês Mais Rápido</div>
                        <div class="leadtime-kpi-value" style="color: #fbbf24;">${fastestMonth ? fastestMonth.label : '—'} <span style="font-size: 14px; font-weight: 700; color: #ffffff;">(${fastestMonth ? fastestMonth.avgLeadtime.toFixed(1) + 'd' : '—'})</span></div>
                        <div class="leadtime-kpi-sub" style="color: #fbbf24;"><i class="fa-solid fa-bolt"></i> Melhor velocidade da equipe</div>
                    </div>
                </div>
            </div>

            <!-- GRÁFICO GRANDE DE COLUNAS & LINHA DE LEADTIME -->
            <div class="leadtime-chart-card">
                <div class="leadtime-chart-header">
                    <div>
                        <h3 class="leadtime-chart-title">
                            <i class="fa-solid fa-chart-simple" style="color: #34d399;"></i>
                            <span>Volume de OFs Liberadas vs Leadtime Médio (Setor 13) por Mês</span>
                        </h3>
                        <p class="leadtime-chart-subtitle">
                            Colunas Verdes: Quantidade de OFs liberadas (Eixo Esquerdo) | Linha Dourada: Média de Dias no Setor 13 (Eixo Direito)
                        </p>
                    </div>
                    <span class="badge badge-emerald" style="font-size: 11.5px; padding: 4px 10px;">
                        Clique em qualquer coluna para filtrar as OFs
                    </span>
                </div>

                <!-- SVG DUAL-AXIS CHART -->
                <svg viewBox="0 0 ${svgW} ${svgH}" class="leadtime-big-svg">
                    <defs>
                        <!-- Gradiente das Barras de Volume -->
                        <linearGradient id="barGradLT" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stop-color="#10b981" stop-opacity="0.95"/>
                            <stop offset="100%" stop-color="#047857" stop-opacity="0.6"/>
                        </linearGradient>
                        <linearGradient id="barGradLTSelected" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stop-color="#34d399" stop-opacity="1"/>
                            <stop offset="100%" stop-color="#059669" stop-opacity="0.9"/>
                        </linearGradient>
                        <!-- Gradiente da Área sob a Linha de Leadtime -->
                        <linearGradient id="areaGradLT" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stop-color="#f59e0b" stop-opacity="0.25"/>
                            <stop offset="100%" stop-color="#f59e0b" stop-opacity="0.0"/>
                        </linearGradient>
                    </defs>

                    <!-- Linhas de Grade Horizontais -->
                    ${[0, 0.25, 0.5, 0.75, 1].map(frac => {
                        const yValOF = Math.round(yMaxOFs * frac);
                        const yValLT = (yMaxLT * frac).toFixed(1);
                        const yPos = pad.top + drawH - (drawH * frac);
                        return `
                            <line x1="${pad.left}" y1="${yPos}" x2="${svgW - pad.right}" y2="${yPos}" stroke="rgba(255,255,255,0.07)" stroke-dasharray="3 3" />
                            <!-- Eixo Esquerdo: OFs -->
                            <text x="${pad.left - 10}" y="${yPos + 4}" fill="#34d399" font-size="12" font-weight="800" text-anchor="end" font-family="system-ui, sans-serif">${yValOF}</text>
                            <!-- Eixo Direito: Leadtime Dias -->
                            <text x="${svgW - pad.right + 10}" y="${yPos + 4}" fill="#fbbf24" font-size="12" font-weight="800" text-anchor="start" font-family="system-ui, sans-serif">${yValLT} d</text>
                        `;
                    }).join('')}

                    <!-- Linha Base do Eixo X -->
                    <line x1="${pad.left}" y1="${pad.top + drawH}" x2="${svgW - pad.right}" y2="${pad.top + drawH}" stroke="rgba(255,255,255,0.2)" stroke-width="1.5" />

                    <!-- COLUNAS DE OFs LIBERADAS -->
                    ${sortedMonths.map((m, colIdx) => {
                        const colCenterX = pad.left + (colIdx * colSlotW) + (colSlotW / 2);
                        const barX = colCenterX - (barW / 2);
                        const barH = (m.totalOFs / yMaxOFs) * drawH;
                        const barY = pad.top + drawH - barH;
                        const isSelected = state.leadtimeFilter === m.key;

                        return `
                            <g class="leadtime-bar-group" style="cursor: pointer;" onclick="window.crmFilterLeadtime('${m.key}')">
                                <!-- Área de Hover -->
                                <rect x="${pad.left + (colIdx * colSlotW) + 2}" y="${pad.top}" width="${colSlotW - 4}" height="${drawH}" fill="rgba(255,255,255,${isSelected ? '0.08' : '0.01'})" rx="6" />
                                
                                <!-- Barra de Volume -->
                                <rect x="${barX}" y="${barY}" width="${barW}" height="${Math.max(barH, 3)}"
                                    fill="${isSelected ? 'url(#barGradLTSelected)' : 'url(#barGradLT)'}"
                                    rx="5"
                                    filter="${isSelected ? 'drop-shadow(0 0 8px rgba(52,211,153,0.5))' : 'none'}"
                                    style="transition: all 0.25s ease;"
                                >
                                    <title>${m.fullLabel}: ${m.totalOFs} OFs liberadas | Leadtime Médio: ${m.avgLeadtime.toFixed(2).replace('.', ',')} dias</title>
                                </rect>

                                <!-- Rótulo de Quantidade no Topo da Barra com Pill Badge de Alto Contraste -->
                                <g class="of-label-pill">
                                    <rect x="${colCenterX - 18}" y="${barY - 22}" width="36" height="18" rx="4" fill="rgba(6, 78, 59, 0.95)" stroke="#34d399" stroke-width="1.2" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.5))" />
                                    <text x="${colCenterX}" y="${barY - 9}" fill="#ffffff" font-size="12" font-weight="900" text-anchor="middle" font-family="system-ui, sans-serif">
                                        ${m.totalOFs}
                                    </text>
                                </g>

                                <!-- Rótulo do Mês no Eixo X -->
                                <text x="${colCenterX}" y="${pad.top + drawH + 24}" fill="${isSelected ? '#34d399' : '#cbd5e1'}" font-size="13" font-weight="800" text-anchor="middle" font-family="system-ui, sans-serif">
                                    ${m.label}
                                </text>
                                
                                <!-- Indicador de Variação % abaixo do mês -->
                                ${m.pctChange !== null ? `
                                    <text x="${colCenterX}" y="${pad.top + drawH + 42}" fill="${m.isFaster ? '#34d399' : '#f87171'}" font-size="11" font-weight="800" text-anchor="middle" font-family="system-ui, sans-serif">
                                        ${m.isFaster ? '↓' : '↑'} ${Math.abs(m.pctChange).toFixed(0)}%
                                    </text>
                                ` : ''}
                            </g>
                        `;
                    }).join('')}

                    <!-- LINHA DE LEADTIME MÉDIO (DIAS) -->
                    ${linePoints.length > 1 ? `
                        <path d="${linePathD}" fill="none" stroke="#f59e0b" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" filter="drop-shadow(0 0 6px rgba(245,158,11,0.6))" />
                    ` : ''}

                    <!-- PONTOS E RÓTULOS DA LINHA DE LEADTIME (COM POSICIONAMENTO INTELIGENTE ANTI-SOBREPOSIÇÃO) -->
                    ${linePoints.map(pt => {
                        const mBarH = (pt.data.totalOFs / yMaxOFs) * drawH;
                        const mBarY = pad.top + drawH - mBarH;
                        const isClose = Math.abs(pt.y - mBarY) < 38;
                        let badgeY = pt.y - 25;
                        if (isClose) {
                            if (pt.y <= mBarY) {
                                badgeY = pt.y - 35;
                            } else {
                                badgeY = pt.y + 11;
                            }
                        }

                        return `
                            <g style="cursor: pointer;" onclick="window.crmFilterLeadtime('${pt.data.key}')">
                                <!-- Círculo Externo Glow -->
                                <circle cx="${pt.x.toFixed(1)}" cy="${pt.y.toFixed(1)}" r="8" fill="#0f172a" stroke="#f59e0b" stroke-width="3.5" />
                                <circle cx="${pt.x.toFixed(1)}" cy="${pt.y.toFixed(1)}" r="3" fill="#ffffff" />
                                
                                <!-- Badge de Leadtime Médio -->
                                <rect x="${(pt.x - 25).toFixed(1)}" y="${badgeY.toFixed(1)}" width="50" height="20" rx="5" fill="rgba(15,23,42,0.95)" stroke="#f59e0b" stroke-width="1.2" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.6))" />
                                <text x="${pt.x.toFixed(1)}" y="${(badgeY + 14).toFixed(1)}" fill="#fbbf24" font-size="11.5" font-weight="900" text-anchor="middle" font-family="system-ui, sans-serif">
                                    ${pt.data.avgLeadtime.toFixed(2).replace('.', ',')} d
                                </text>
                            </g>
                        `;
                    }).join('')}

                    <!-- Rótulos dos Eixos -->
                    <text x="${pad.left}" y="${pad.top - 18}" fill="#34d399" font-size="13" font-weight="800" text-anchor="start" font-family="system-ui, sans-serif">
                        ← QTD OFs LIBERADAS
                    </text>
                    <text x="${svgW - pad.right}" y="${pad.top - 18}" fill="#fbbf24" font-size="13" font-weight="800" text-anchor="end" font-family="system-ui, sans-serif">
                        LEADTIME MÉDIO (DIAS) →
                    </text>
                </svg>

                <!-- LEGENDA DO GRÁFICO -->
                <div class="leadtime-legend-bar">
                    <div class="leadtime-legend-item">
                        <span class="leadtime-legend-box" style="background: linear-gradient(135deg, #10b981, #047857);"></span>
                        <span>OFs Liberadas no Mês (Coluna A agrupada por Coluna AA - REALIZADO_FIM)</span>
                    </div>
                    <div class="leadtime-legend-item">
                        <span class="leadtime-legend-line" style="background: #f59e0b;"></span>
                        <span>Tempo Médio no Setor 13 (Coluna AE - DIAS_REALIZADO)</span>
                    </div>
                </div>

                <!-- OBSERVAÇÃO TÉCNICA / OPERACIONAL -->
                <div style="margin-top: 18px; padding: 12px 18px; background: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.25); border-left: 4px solid #f59e0b; border-radius: 8px; display: flex; align-items: flex-start; gap: 12px;">
                    <i class="fa-solid fa-circle-exclamation" style="color: #fbbf24; font-size: 16px; margin-top: 2px; flex-shrink: 0;"></i>
                    <div style="font-size: 12.5px; color: #cbd5e1; line-height: 1.55;">
                        <strong style="color: #fbbf24; font-weight: 700;">Observação:</strong>
                        Pedido <strong style="font-family: monospace; color: #ffffff; background: rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 4px;">074240</strong> ficou <strong>240 dias pendente</strong> até ser cancelado / produtos sem OC ficam pendentes nesse setor servindo como trava.
                    </div>
                </div>
            </div>

            <!-- BARRA DE CONTROLES E BUSCA DA TABELA -->
            <div class="filter-toolbar" style="margin-bottom: 16px;">
                <div class="filter-toolbar-left" style="width: 100%; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;">
                    <!-- Input de Busca -->
                    <div class="search-input-wrapper" style="max-width: 380px; width: 100%;">
                        <i class="fa-solid fa-magnifying-glass search-icon"></i>
                        <input 
                            type="text" 
                            class="search-input" 
                            placeholder="Buscar por OF, Código, Descrição, Coleção, Data Final..." 
                            value="${state.leadtimeSearch || ''}"
                            oninput="window.crmSearchLeadtime(this.value)"
                        />
                        ${state.leadtimeSearch ? `
                            <button class="search-clear-btn" onclick="window.crmSearchLeadtime('')" title="Limpar busca">&times;</button>
                        ` : ''}
                    </div>

                    <!-- Filtros Rápidos por Mês -->
                    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                        <button class="exec-action-btn ${!state.leadtimeFilter ? 'active' : ''}" onclick="window.crmFilterLeadtime(null)" title="Ver todas as OFs">
                            Todos os Meses (${totalOFsCount})
                        </button>

                        ${activeMonthBadge ? `
                            <span class="badge badge-emerald" style="font-size: 11.5px; padding: 5px 10px; display: flex; align-items: center; gap: 6px;">
                                <i class="fa-solid fa-filter"></i> Mês: ${activeMonthBadge}
                                <i class="fa-solid fa-xmark" style="cursor: pointer;" onclick="window.crmFilterLeadtime(null)" title="Limpar filtro de mês"></i>
                            </span>
                        ` : ''}
                    </div>
                </div>
            </div>

            <!-- TABELA DETALHADA DE OFs LIBERADAS -->
            <div class="table-card" style="border-top: 3px solid #10b981; margin-bottom: 24px;">
                <div class="table-toolbar" style="border-bottom: 1px solid rgba(16, 185, 129, 0.2); justify-content: space-between;">
                    <div class="table-title-group">
                        <h3 class="table-title" style="display: flex; align-items: center; gap: 8px; color: #ffffff;">
                            <i class="fa-solid fa-table-list" style="color: #34d399;"></i>
                            <span>Listagem de OFs Liberadas no Setor 13 (22V)</span>
                        </h3>
                        <span class="badge badge-sub">${filteredRecords.length} OFs exibidas</span>
                    </div>
                </div>

                <div class="table-responsive">
                    <table class="crm-table">
                        <thead>
                            <tr>
                                <th>OF (Col A)</th>
                                <th>Código Produto</th>
                                <th>Descrição do Produto</th>
                                <th>Coleção</th>
                                <th>Data Liberação (Col AA - REALIZADO_FIM)</th>
                                <th>Mês / Período</th>
                                <th>Tempo Setor 13 (Col AE - DIAS_REALIZADO)</th>
                                <th>Qtde Peças</th>
                                <th>Responsável</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${filteredRecords.length === 0 ? `
                                <tr>
                                    <td colspan="10" style="text-align: center; padding: 36px; color: var(--text-muted);">
                                        Nenhuma OF encontrada para os filtros selecionados.
                                    </td>
                                </tr>
                            ` : filteredRecords.map(item => {
                                const diasBadgeClass = item.diasRealizado <= 3 ? 'badge-emerald' : (item.diasRealizado <= 6 ? 'badge-amber' : 'badge-rose');
                                return `
                                    <tr>
                                        <td style="font-family: monospace; font-weight: 800; color: #34d399;">${item.op}</td>
                                        <td style="font-family: monospace; font-weight: 700; color: #ffffff;">${item.codigo}</td>
                                        <td style="color: #e2e8f0; font-weight: 600;">${item.produtoDesc}</td>
                                        <td style="font-size: 12px; color: #94a3b8;">${item.colecao}</td>
                                        <td style="font-weight: 700; color: #38bdf8;">${item.dtFinal}</td>
                                        <td>
                                            <span class="badge badge-purple" style="font-weight: 800; cursor: pointer;" onclick="window.crmFilterLeadtime('${item.monthKey}')" title="Filtrar mês ${item.monthLabel}">
                                                ${item.monthLabel}
                                            </span>
                                        </td>
                                        <td>
                                            <span class="badge ${diasBadgeClass}" style="font-weight: 800; font-size: 12px;">
                                                <i class="fa-solid fa-clock"></i> ${item.diasRealizado} ${item.diasRealizado === 1 ? 'dia' : 'dias'}
                                            </span>
                                        </td>
                                        <td style="font-weight: 700; color: #f8fafc; font-family: monospace;">${item.qtde}</td>
                                        <td style="font-size: 12px; color: #cbd5e1; font-weight: 600;">${item.responsavel}</td>
                                        <td>
                                            <span class="badge badge-emerald">${item.status}</span>
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }


    // =========================================================================
    // 6. MÓDULO ESTILO PEDIDO - ROTATIVOS (SETOR 43)
    // =========================================================================
    function renderRotativosView(container) {
        // Regra do Usuário:
        // - produtos pendentes no setor 43 (coluna AY) ou com indicação de processo rotativo
        // - informar se tem produtos que se repetem nos setores 05/06/12/13/26/20/31 (coluna AY) - GARGALO CRÍTICO
        // - Planilha Google Drive de Rotativos (Mesas Pendentes):
        //   - Divisão no gráfico: produtos com pendência de mesa (Coluna A) vs não recebi mesa ainda (Coluna I)
        //   - No exemplo: 12 produtos pendentes de mesa, sendo 5 faltando receber mesa e 7 recebidos.
        // - Layout executivo com 2 Gráficos Grandes Donut (viewBox 0 0 440 440) no padrão de Aviamentos e Cores (50% / 50%)
        
        const rotItems = state.filteredData.filter(r => 
            r.setor === '43' || 
            (r.descSetor || '').toUpperCase().includes('ROTATIV') || 
            (r.descLocal || '').toUpperCase().includes('ROTATIV') || 
            (r.tipoProduto || '').toUpperCase().includes('ROTATIV')
        );
        const totalItems = rotItems.length;
        const totalPecas = rotItems.reduce((sum, r) => sum + r.qtdeOriginal, 0);

        // Repetição nos setores de produção (05, 06, 12, 13, 26, 20, 31)
        const repetidosNaProducao = rotItems.filter(r => state.productionCodes.has(r.codigo));
        const totalRepetidos = repetidosNaProducao.length;
        const repetidosPecas = repetidosNaProducao.reduce((sum, r) => sum + r.qtdeOriginal, 0);
        const repetidosPct = totalItems > 0 ? ((totalRepetidos / totalItems) * 100).toFixed(1) : '0';

        const regularesRot = rotItems.filter(r => !state.productionCodes.has(r.codigo));
        const regularesCount = regularesRot.length;
        const regularesPecas = regularesRot.reduce((sum, r) => sum + r.qtdeOriginal, 0);
        const regularesPct = totalItems > 0 ? ((regularesCount / totalItems) * 100).toFixed(1) : '0';

        // 1. Dados da Planilha Externa de Rotativos (Google Drive - Mesas Pendentes)
        const rotExt = state.rotativosExternalData || { count: 12, faltaReceberCount: 5, recebidosCount: 7, records: [], isLive: false };
        const rotDriveTotal = rotExt.count || (rotExt.records ? rotExt.records.length : 12);
        const rotFaltaReceber = rotExt.faltaReceberCount !== undefined ? rotExt.faltaReceberCount : 5;
        const rotRecebidos = rotExt.recebidosCount !== undefined ? rotExt.recebidosCount : 7;
        const rotDriveFaltaPct = rotDriveTotal > 0 ? ((rotFaltaReceber / rotDriveTotal) * 100).toFixed(1) : '0';
        const rotDriveRecebidosPct = rotDriveTotal > 0 ? ((rotRecebidos / rotDriveTotal) * 100).toFixed(1) : '0';

        // Geometria Donut Chart SVG Gigante (viewBox 0 0 440 440, raio 150)
        const radius = 150;
        const circumference = 2 * Math.PI * radius; // ~942.48

        // Fatias do Donut 1 (CRM Setor 43)
        const regularesDash = totalItems > 0 ? (regularesCount / totalItems) * circumference : circumference;
        const repetidosDash = totalItems > 0 ? (totalRepetidos / totalItems) * circumference : 0;
        const repetidosOffset = -regularesDash;

        // Fatias do Donut 2 (Google Drive Mesas)
        const driveFaltaDash = rotDriveTotal > 0 ? (rotFaltaReceber / rotDriveTotal) * circumference : 0;
        const driveRecebidosDash = rotDriveTotal > 0 ? (rotRecebidos / rotDriveTotal) * circumference : circumference;
        const driveRecebidosOffset = -driveFaltaDash;

        // 2. Filtragem de dados da Planilha Google Drive
        let driveDisplayRecords = rotExt.records && rotExt.records.length > 0 ? rotExt.records : [
            { produto: 'ON.11.0123', arquivoAprov: 'C. LANCASTER', fid: '', prevEntCilindro: 'C. LANCASTER', solicitacao: '61318', mesaEnviada: '02/09/2026', prevMesa: '14/09/2026', dias: '11', recebido: '09/09/2026', envCliente: '', obs: '', isRecebido: true, statusRecebimento: 'Já Recebido' },
            { produto: '01.14.00.7490', arquivoAprov: '02/09/2026', fid: '68644', prevEntCilindro: '04/09/2026', solicitacao: '61533', mesaEnviada: '10/09/2026', prevMesa: '14/09/2026', dias: '7', recebido: '16/09/2026', envCliente: '', obs: '', isRecebido: true, statusRecebimento: 'Já Recebido' },
            { produto: 'ON.13.0121', arquivoAprov: 'C. LANCASTER', fid: '52791', prevEntCilindro: 'C. LANCASTER', solicitacao: '61526', mesaEnviada: '10/09/2026', prevMesa: '18/09/2026', dias: '10', recebido: '18/09/2026', envCliente: '', obs: '', isRecebido: true, statusRecebimento: 'Já Recebido' },
            { produto: '13.14.00.0624E', arquivoAprov: 'C. LANCASTER', fid: '', prevEntCilindro: 'C. LANCASTER', solicitacao: '61639', mesaEnviada: '16/09/2026', prevMesa: '25/09/2026', dias: '5', recebido: '23/09/2026', envCliente: '', obs: '', isRecebido: true, statusRecebimento: 'Já Recebido' },
            { produto: '13.14.00.0624F', arquivoAprov: 'C. LANCASTER', fid: '', prevEntCilindro: 'C. LANCASTER', solicitacao: '61641', mesaEnviada: '16/09/2026', prevMesa: '25/09/2026', dias: '5', recebido: '22/09/2026', envCliente: '', obs: '', isRecebido: true, statusRecebimento: 'Já Recebido' },
            { produto: '13.14.00.0624G', arquivoAprov: 'C. LANCASTER', fid: '', prevEntCilindro: 'C. LANCASTER', solicitacao: '61643', mesaEnviada: '16/09/2026', prevMesa: '25/09/2026', dias: '5', recebido: '22/09/2026', envCliente: '', obs: '', isRecebido: true, statusRecebimento: 'Já Recebido' },
            { produto: '13.13.00.0622F', arquivoAprov: 'C. LANCASTER', fid: '', prevEntCilindro: 'C. LANCASTER', solicitacao: '61648', mesaEnviada: '16/09/2026', prevMesa: '25/09/2026', dias: '5', recebido: '', envCliente: '', obs: '', isRecebido: false, statusRecebimento: 'Falta Receber' },
            { produto: '13.13.00.0622G', arquivoAprov: 'C. LANCASTER', fid: '', prevEntCilindro: 'C. LANCASTER', solicitacao: '61649', mesaEnviada: '16/09/2026', prevMesa: '25/09/2026', dias: '5', recebido: '', envCliente: '', obs: '', isRecebido: false, statusRecebimento: 'Falta Receber' },
            { produto: '13.13.00.0623F', arquivoAprov: 'C. LANCASTER', fid: '', prevEntCilindro: 'C. LANCASTER', solicitacao: '61658', mesaEnviada: '16/09/2026', prevMesa: '25/09/2026', dias: '5', recebido: '22/09/2026', envCliente: '', obs: '', isRecebido: true, statusRecebimento: 'Já Recebido' },
            { produto: 'ON.13.0127', arquivoAprov: 'C. LANCASTER', fid: '', prevEntCilindro: 'C. LANCASTER', solicitacao: '61905', mesaEnviada: '22/09/2026', prevMesa: '01/10/2026', dias: '1', recebido: '', envCliente: '', obs: '', isRecebido: false, statusRecebimento: 'Falta Receber' },
            { produto: 'ON.16.0146', arquivoAprov: 'C. LANCASTER', fid: '', prevEntCilindro: 'C. LANCASTER', solicitacao: '61992', mesaEnviada: '23/09/2026', prevMesa: '02//10/2026', dias: '-2', recebido: '', envCliente: '', obs: '', isRecebido: false, statusRecebimento: 'Falta Receber' },
            { produto: '13.14.00.0624E', arquivoAprov: 'C. LANCASTER', fid: '', prevEntCilindro: 'C. LANCASTER', solicitacao: '62040', mesaEnviada: '', prevMesa: '', dias: '33062', recebido: '', envCliente: '', obs: '', isRecebido: false, statusRecebimento: 'Falta Receber' }
        ];

        if (state.rotativosDriveFilter === 'faltaReceber') {
            driveDisplayRecords = driveDisplayRecords.filter(r => !r.isRecebido);
        } else if (state.rotativosDriveFilter === 'recebido') {
            driveDisplayRecords = driveDisplayRecords.filter(r => r.isRecebido);
        }

        if (state.rotativosDriveSearch && state.rotativosDriveSearch.trim().length > 0) {
            const q = state.rotativosDriveSearch.trim().toLowerCase();
            driveDisplayRecords = driveDisplayRecords.filter(r => 
                (r.produto || '').toLowerCase().includes(q) ||
                (r.arquivoAprov || '').toLowerCase().includes(q) ||
                (r.fid || '').toLowerCase().includes(q) ||
                (r.solicitacao || '').toLowerCase().includes(q) ||
                (r.mesaEnviada || '').toLowerCase().includes(q) ||
                (r.prevMesa || '').toLowerCase().includes(q) ||
                (r.obs || '').toLowerCase().includes(q)
            );
        }

        // 3. Filtragem de dados do CRM (Setor 43)
        let searchFilteredItems = rotItems;
        if (state.rotativosSearch && state.rotativosSearch.trim().length > 0) {
            const q = state.rotativosSearch.trim().toLowerCase();
            searchFilteredItems = rotItems.filter(r => 
                (r.codigo || '').toLowerCase().includes(q) ||
                (r.op || '').toLowerCase().includes(q) ||
                (r.setor || '').toLowerCase().includes(q) ||
                (r.statusModelagem || '').toLowerCase().includes(q) ||
                (r.descLocal || '').toLowerCase().includes(q) ||
                (r.statusProd || '').toLowerCase().includes(q) ||
                (r.marca || '').toLowerCase().includes(q) ||
                (r.etiqueta || '').toLowerCase().includes(q) ||
                (r.descricao || '').toLowerCase().includes(q) ||
                (r.cliente || '').toLowerCase().includes(q) ||
                (r.pedDescPeriodo || '').toLowerCase().includes(q)
            );
        }

        let displayCrmItems = searchFilteredItems;
        let activeCrmFilterLabel = null;

        if (state.rotativosFilter === 'repetidos') {
            displayCrmItems = searchFilteredItems.filter(r => state.productionCodes.has(r.codigo));
            activeCrmFilterLabel = 'Gargalo Crítico: Repetem nos Setores de Produção';
        } else if (state.rotativosFilter === 'regulares') {
            displayCrmItems = searchFilteredItems.filter(r => !state.productionCodes.has(r.codigo));
            activeCrmFilterLabel = 'Rotativos Regulares (Sem Conflito com Produção)';
        }

        container.innerHTML = `
            <!-- CABEÇALHO DO MÓDULO -->
            <div class="module-view-header" style="margin-bottom: 24px;">
                <div class="module-view-title-group">
                    <h2 style="font-size: 22px; font-weight: 800; color: var(--text-primary); display: flex; align-items: center; gap: 10px;">
                        <i class="fa-solid fa-rotate" style="color: #00d4ff;"></i>
                        <span>Módulo Estilo Pedido: ROTATIVOS (SETOR 43 & DRIVE)</span>
                    </h2>
                    <p class="module-view-description" style="font-size: 13px; color: var(--text-muted); margin-top: 4px;">
                        Visão unificada das pendências de rotativos no Setor 43 (CRM) e integração com a planilha de controle de mesas do Google Drive.
                    </p>
                </div>
                <div class="btn-group" style="flex-wrap: wrap; gap: 8px;">
                    <span class="badge badge-cyan" style="font-size: 12px; padding: 6px 14px;">
                        <i class="fa-solid fa-rotate"></i> ${totalItems} OPs em S43
                    </span>
                    <span class="badge badge-purple" style="font-size: 12px; padding: 6px 14px;">
                        <i class="fa-solid fa-table"></i> ${rotDriveTotal} Mesas na Planilha Drive
                    </span>
                    <span class="badge badge-rose" style="font-size: 12px; padding: 6px 14px;">
                        <i class="fa-solid fa-triangle-exclamation"></i> ${rotFaltaReceber} Faltam Receber
                    </span>
                    <span class="badge badge-emerald" style="font-size: 12px; padding: 6px 14px;">
                        <i class="fa-solid fa-circle-check"></i> ${rotRecebidos} Já Recebidas
                    </span>
                    <span class="badge badge-sub" style="font-size: 12px; padding: 6px 14px;">
                        ${formatNumber(totalPecas)} pçs
                    </span>
                    <button class="btn btn-glass" onclick="window.crmSyncExternalSheets('rotativos')" style="font-size: 11.5px; padding: 6px 12px;" title="Atualizar dados da planilha do Drive">
                        <i class="fa-solid fa-arrows-rotate"></i> Sincronizar Drive
                    </button>
                </div>
            </div>

            <!-- GRID DOS DOIS GRÁFICOS GRANDES (50% / 50%) PADRÃO EXECUTIVO -->
            <div class="exec-processo-layout" style="grid-template-columns: repeat(auto-fit, minmax(420px, 1fr)); gap: 24px; margin-bottom: 24px;">
                
                <!-- GRÁFICO 1: SETOR 43 - ROTATIVOS CRM (FLUXO E REPETIÇÃO) -->
                <div class="hero-pie-chart-container" style="background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(0, 212, 255, 0.35); border-radius: 14px; padding: 22px;">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <i class="fa-solid fa-rotate" style="color: #00d4ff; font-size: 18px;"></i>
                            <h3 style="font-size: 16px; font-weight: 800; color: #ffffff; margin: 0;">SETOR 43 • CRM ONEDA</h3>
                        </div>
                        <span class="badge badge-cyan" style="font-size: 11px; padding: 3px 8px;">
                            ${totalItems} OPs
                        </span>
                    </div>

                    <svg viewBox="0 0 440 440" class="hero-donut-svg">
                        <defs>
                            <filter id="glowDonutRotS43_Cyan" x="-30%" y="-30%" width="160%" height="160%">
                                <feDropShadow dx="0" dy="0" stdDeviation="12" flood-color="#00d4ff" flood-opacity="0.85"/>
                            </filter>
                            <filter id="glowDonutRotS43_Rose" x="-30%" y="-30%" width="160%" height="160%">
                                <feDropShadow dx="0" dy="0" stdDeviation="14" flood-color="#ef4444" flood-opacity="0.95"/>
                            </filter>
                        </defs>
                        <g transform="rotate(-90 220 220)">
                            <!-- Trilha circular de fundo -->
                            <circle cx="220" cy="220" r="150" fill="none" stroke="#121624" stroke-width="58" />
                            
                            <!-- Fatia Rotativos Regulares (Cyan Neon #00d4ff) -->
                            <circle cx="220" cy="220" r="150" fill="none" stroke="#00d4ff" stroke-width="58"
                                stroke-dasharray="${regularesDash.toFixed(2)} ${circumference.toFixed(2)}"
                                stroke-dashoffset="0"
                                filter="url(#glowDonutRotS43_Cyan)"
                                style="cursor: pointer;"
                                onclick="window.crmFilterRotativos('regulares')"
                            />
                            
                            <!-- Fatia Repetem na Produção (Gargalo Crítico #ef4444) -->
                            ${totalRepetidos > 0 ? `
                                <circle cx="220" cy="220" r="150" fill="none" stroke="#ef4444" stroke-width="58"
                                    stroke-dasharray="${repetidosDash.toFixed(2)} ${circumference.toFixed(2)}"
                                    stroke-dashoffset="${repetidosOffset.toFixed(2)}"
                                    filter="url(#glowDonutRotS43_Rose)"
                                    style="cursor: pointer;"
                                    onclick="window.crmFilterRotativos('repetidos')"
                                />
                            ` : ''}
                        </g>
                        <!-- Texto Central -->
                        <text x="220" y="190" text-anchor="middle" dominant-baseline="central" fill="#ffffff" font-size="76" font-weight="900" font-family="system-ui, -apple-system, sans-serif" letter-spacing="-2px">${totalItems}</text>
                        <text x="220" y="246" text-anchor="middle" dominant-baseline="central" fill="#94a3b8" font-size="14" font-weight="800" letter-spacing="3px">PRODUTOS</text>
                        <text x="220" y="272" text-anchor="middle" dominant-baseline="central" fill="#00d4ff" font-size="13" font-weight="800" letter-spacing="1.5px">SETOR 43 (CRM)</text>
                    </svg>

                    <!-- Legendas Rápidas -->
                    <div class="hero-pie-quick-legend" style="grid-template-columns: repeat(2, 1fr); gap: 10px; margin-top: 18px;">
                        <div class="donut-legend-card blue ${state.rotativosFilter === 'regulares' ? 'active' : ''}" style="cursor: pointer; border-left: 4px solid #00d4ff; background: rgba(0, 212, 255, 0.08); padding: 10px 12px; border-radius: 8px;" onclick="window.crmFilterRotativos('regulares')" title="Filtrar rotativos regulares">
                            <div class="donut-legend-label blue" style="display: flex; align-items: center; gap: 8px;">
                                <span class="legend-dot" style="background: #00d4ff; width: 10px; height: 10px; border-radius: 50%; display: inline-block; box-shadow: 0 0 8px #00d4ff;"></span>
                                <div>
                                    <div style="font-weight: 700; font-size: 12.5px; color: #ffffff;">Rotativos Regulares</div>
                                    <div style="font-size: 11px; color: #7dd3fc;">${formatNumber(regularesPecas)} peças</div>
                                </div>
                            </div>
                            <div style="text-align: right; margin-top: 6px;">
                                <div style="font-size: 13px; font-weight: 800; color: #38bdf8;">${regularesCount} prod (${regularesPct}%)</div>
                                <span style="font-size: 10.5px; color: #38bdf8; text-decoration: underline;">Filtrar ↓</span>
                            </div>
                        </div>

                        <div class="donut-legend-card red ${state.rotativosFilter === 'repetidos' ? 'active' : ''}" style="cursor: pointer; border-left: 4px solid #ef4444; background: rgba(239, 68, 68, 0.08); padding: 10px 12px; border-radius: 8px;" onclick="window.crmFilterRotativos('repetidos')" title="Filtrar produtos que repetem na produção">
                            <div class="donut-legend-label red" style="display: flex; align-items: center; gap: 8px;">
                                <span class="legend-dot" style="background: #ef4444; width: 10px; height: 10px; border-radius: 50%; display: inline-block; box-shadow: 0 0 10px #ef4444;"></span>
                                <div>
                                    <div style="font-weight: 700; font-size: 12.5px; color: #ffffff;">Repetem na Produção</div>
                                    <div style="font-size: 11px; color: #fca5a5;">${formatNumber(repetidosPecas)} peças</div>
                                </div>
                            </div>
                            <div style="text-align: right; margin-top: 6px;">
                                <div style="font-size: 13px; font-weight: 800; color: #f87171;">${totalRepetidos} prod (${repetidosPct}%)</div>
                                <span style="font-size: 10.5px; color: #f87171; text-decoration: underline;">Filtrar ↓</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- GRÁFICO 2: ROTATIVOS • MESAS PENDENTES (GOOGLE DRIVE) -->
                <div class="hero-pie-chart-container" style="background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(239, 68, 68, 0.35); border-radius: 14px; padding: 22px;">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <i class="fa-solid fa-table-cells" style="color: #f87171; font-size: 18px;"></i>
                            <h3 style="font-size: 16px; font-weight: 800; color: #ffffff; margin: 0;">ROTATIVOS • MESAS PENDENTES (DRIVE)</h3>
                        </div>
                        <span class="badge badge-rose" style="font-size: 11px; padding: 3px 8px;">
                            Planilha Drive
                        </span>
                    </div>

                    <svg viewBox="0 0 440 440" class="hero-donut-svg">
                        <defs>
                            <filter id="glowDonutDriveFalta" x="-30%" y="-30%" width="160%" height="160%">
                                <feDropShadow dx="0" dy="0" stdDeviation="14" flood-color="#ef4444" flood-opacity="0.95"/>
                            </filter>
                            <filter id="glowDonutDriveRecebido" x="-30%" y="-30%" width="160%" height="160%">
                                <feDropShadow dx="0" dy="0" stdDeviation="12" flood-color="#10b981" flood-opacity="0.85"/>
                            </filter>
                        </defs>
                        <g transform="rotate(-90 220 220)">
                            <!-- Trilha circular de fundo -->
                            <circle cx="220" cy="220" r="150" fill="none" stroke="#121624" stroke-width="58" />
                            
                            <!-- Fatia Falta Receber Mesa (Vermelho Neon #ef4444) -->
                            ${rotFaltaReceber > 0 ? `
                                <circle cx="220" cy="220" r="150" fill="none" stroke="#ef4444" stroke-width="58"
                                    stroke-dasharray="${driveFaltaDash.toFixed(2)} ${circumference.toFixed(2)}"
                                    stroke-dashoffset="0"
                                    filter="url(#glowDonutDriveFalta)"
                                    style="cursor: pointer;"
                                    onclick="window.crmFilterRotativosDrive('faltaReceber')"
                                />
                            ` : ''}

                            <!-- Fatia Já Recebida (Verde Esmeralda #10b981) -->
                            ${rotRecebidos > 0 ? `
                                <circle cx="220" cy="220" r="150" fill="none" stroke="#10b981" stroke-width="58"
                                    stroke-dasharray="${driveRecebidosDash.toFixed(2)} ${circumference.toFixed(2)}"
                                    stroke-dashoffset="${driveRecebidosOffset.toFixed(2)}"
                                    filter="url(#glowDonutDriveRecebido)"
                                    style="cursor: pointer;"
                                    onclick="window.crmFilterRotativosDrive('recebido')"
                                />
                            ` : ''}
                        </g>
                        <!-- Texto Central -->
                        <text x="220" y="190" text-anchor="middle" dominant-baseline="central" fill="#ffffff" font-size="76" font-weight="900" font-family="system-ui, -apple-system, sans-serif" letter-spacing="-2px">${rotDriveTotal}</text>
                        <text x="220" y="246" text-anchor="middle" dominant-baseline="central" fill="#94a3b8" font-size="14" font-weight="800" letter-spacing="3px">PRODUTOS PENDENTES</text>
                        <text x="220" y="272" text-anchor="middle" dominant-baseline="central" fill="#f87171" font-size="13" font-weight="800" letter-spacing="1.5px">PLANILHA GOOGLE DRIVE</text>
                    </svg>

                    <!-- Legendas Rápidas -->
                    <div class="hero-pie-quick-legend" style="grid-template-columns: repeat(2, 1fr); gap: 10px; margin-top: 18px;">
                        <div class="donut-legend-card red ${state.rotativosDriveFilter === 'faltaReceber' ? 'active' : ''}" style="cursor: pointer; border-left: 4px solid #ef4444; background: rgba(239, 68, 68, 0.08); padding: 10px 12px; border-radius: 8px;" onclick="window.crmFilterRotativosDrive('faltaReceber')" title="Filtrar produtos que faltam receber mesa">
                            <div class="donut-legend-label red" style="display: flex; align-items: center; gap: 8px;">
                                <span class="legend-dot" style="background: #ef4444; width: 10px; height: 10px; border-radius: 50%; display: inline-block; box-shadow: 0 0 10px #ef4444;"></span>
                                <div>
                                    <div style="font-weight: 700; font-size: 12.5px; color: #ffffff;">Falta Receber (Pendente)</div>
                                    <div style="font-size: 11px; color: #fca5a5;">Aguardando fornecedor</div>
                                </div>
                            </div>
                            <div style="text-align: right; margin-top: 6px;">
                                <div style="font-size: 13px; font-weight: 800; color: #f87171;">${rotFaltaReceber} produtos (${rotDriveFaltaPct}%)</div>
                                <span style="font-size: 10.5px; color: #f87171; text-decoration: underline;">Filtrar Mesas ↓</span>
                            </div>
                        </div>

                        <div class="donut-legend-card green ${state.rotativosDriveFilter === 'recebido' ? 'active' : ''}" style="cursor: pointer; border-left: 4px solid #10b981; background: rgba(16, 185, 129, 0.08); padding: 10px 12px; border-radius: 8px;" onclick="window.crmFilterRotativosDrive('recebido')" title="Filtrar produtos com mesa já recebida">
                            <div class="donut-legend-label green" style="display: flex; align-items: center; gap: 8px;">
                                <span class="legend-dot" style="background: #10b981; width: 10px; height: 10px; border-radius: 50%; display: inline-block; box-shadow: 0 0 8px #10b981;"></span>
                                <div>
                                    <div style="font-weight: 700; font-size: 12.5px; color: #ffffff;">Já Recebido</div>
                                    <div style="font-size: 11px; color: #86efac;">Mesas conferidas</div>
                                </div>
                            </div>
                            <div style="text-align: right; margin-top: 6px;">
                                <div style="font-size: 13px; font-weight: 800; color: #34d399;">${rotRecebidos} produtos (${rotDriveRecebidosPct}%)</div>
                                <span style="font-size: 10.5px; color: #34d399; text-decoration: underline;">Filtrar Mesas ↓</span>
                            </div>
                        </div>
                    </div>
                </div>

            </div>

            <!-- ABAS DE NAVEGAÇÃO: PLANILHA DRIVE VS PRODUTOS CRM -->
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 20px; border-bottom: 1px solid var(--border-color); padding-bottom: 12px;">
                <button class="btn ${state.rotativosActiveTab === 'drive' ? 'btn-primary' : 'btn-glass'}" onclick="window.crmToggleRotativosTab('drive')" style="font-size: 13px; padding: 8px 18px; font-weight: 700; display: flex; align-items: center; gap: 8px;">
                    <i class="fa-solid fa-table-cells" style="color: #f87171;"></i>
                    <span>Planilha Google Drive - Mesas de Rotativos (${rotDriveTotal})</span>
                </button>
                <button class="btn ${state.rotativosActiveTab === 'crm' ? 'btn-primary' : 'btn-glass'}" onclick="window.crmToggleRotativosTab('crm')" style="font-size: 13px; padding: 8px 18px; font-weight: 700; display: flex; align-items: center; gap: 8px;">
                    <i class="fa-solid fa-rotate" style="color: #00d4ff;"></i>
                    <span>Produtos no Setor 43 - CRM Oneda (${totalItems} OPs)</span>
                </button>
            </div>

            <!-- CONTEÚDO DA ABA 1: TABELA COMPLETA DA PLANILHA GOOGLE DRIVE -->
            ${state.rotativosActiveTab === 'drive' ? `
                <div class="table-card" style="border-top: 3px solid #f87171; margin-bottom: 24px;">
                    <div class="table-toolbar" style="border-bottom: 1px solid rgba(239, 68, 68, 0.2); padding: 14px 18px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;">
                        <div class="table-title-group">
                            <h3 class="table-title" style="display: flex; align-items: center; gap: 8px; color: #ffffff;">
                                <i class="fa-solid fa-table-cells" style="color: #f87171;"></i>
                                <span>Controle de Mesas de Rotativos (Planilha Google Drive)</span>
                            </h3>
                            <span class="badge badge-sub">${driveDisplayRecords.length} de ${rotDriveTotal} registros</span>
                        </div>

                        <!-- Filtros Rápidos de Status da Planilha Drive -->
                        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                            <div class="btn-group" style="background: rgba(15, 23, 42, 0.6); padding: 2px; border-radius: 8px; border: 1px solid var(--border-color);">
                                <button class="exec-action-btn ${!state.rotativosDriveFilter ? 'active' : ''}" onclick="window.crmFilterRotativosDrive(null)" style="font-size: 11.5px; padding: 5px 10px;">
                                    Todos (${rotDriveTotal})
                                </button>
                                <button class="exec-action-btn ${state.rotativosDriveFilter === 'faltaReceber' ? 'active' : ''}" onclick="window.crmFilterRotativosDrive('faltaReceber')" style="font-size: 11.5px; padding: 5px 10px; color: #f87171;">
                                    Falta Receber (${rotFaltaReceber})
                                </button>
                                <button class="exec-action-btn ${state.rotativosDriveFilter === 'recebido' ? 'active' : ''}" onclick="window.crmFilterRotativosDrive('recebido')" style="font-size: 11.5px; padding: 5px 10px; color: #34d399;">
                                    Já Recebido (${rotRecebidos})
                                </button>
                            </div>

                            <!-- Campo de Busca na Planilha Drive -->
                            <div style="position: relative; min-width: 220px;">
                                <i class="fa-solid fa-magnifying-glass" style="position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--text-muted); font-size: 12px;"></i>
                                <input 
                                    type="text" 
                                    class="crm-input" 
                                    placeholder="Buscar na planilha..." 
                                    value="${state.rotativosDriveSearch || ''}" 
                                    oninput="window.crmSearchRotativosDrive(this.value)"
                                    style="padding-left: 32px; height: 32px; font-size: 12px; border-radius: 6px;"
                                />
                            </div>
                        </div>
                    </div>

                    <div class="table-responsive" style="max-height: 600px; overflow-y: auto;">
                        <table class="crm-table">
                            <thead>
                                <tr>
                                    <th style="width: 140px;">PRODUTO</th>
                                    <th>ARQUIVO APROV</th>
                                    <th>FID</th>
                                    <th>PREV. ENT. CILINDRO</th>
                                    <th>SOLICITAÇÃO</th>
                                    <th>MESA ENVIADA</th>
                                    <th>PREV. MESA</th>
                                    <th style="text-align: center;">DIAS</th>
                                    <th>RECEBIDO</th>
                                    <th style="text-align: center;">SITUAÇÃO</th>
                                    <th>OBS</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${driveDisplayRecords.length === 0 ? `
                                    <tr>
                                        <td colspan="11" style="text-align: center; padding: 32px; color: var(--text-muted);">
                                            Nenhum registro encontrado na planilha para os filtros informados.
                                        </td>
                                    </tr>
                                ` : driveDisplayRecords.map(r => {
                                    const isAtrasado = Number(r.dias) > 0 && !r.isRecebido;
                                    return `
                                        <tr style="${!r.isRecebido ? 'background: rgba(239, 68, 68, 0.04);' : ''}">
                                            <td style="font-weight: 800; color: #ffffff; font-family: monospace; font-size: 13px;">
                                                <span class="badge badge-purple" style="font-size: 11.5px; padding: 3px 8px;">${r.produto}</span>
                                            </td>
                                            <td style="color: #cbd5e1; font-size: 12px;">${r.arquivoAprov || '—'}</td>
                                            <td style="color: #cbd5e1; font-size: 12px; font-family: monospace;">${r.fid || '—'}</td>
                                            <td style="color: #cbd5e1; font-size: 12px;">${r.prevEntCilindro || '—'}</td>
                                            <td style="color: #38bdf8; font-size: 12px; font-weight: 700;">${r.solicitacao || '—'}</td>
                                            <td style="color: #cbd5e1; font-size: 12px;">${r.mesaEnviada || '—'}</td>
                                            <td style="color: #cbd5e1; font-size: 12px;">${r.prevMesa || '—'}</td>
                                            <td style="text-align: center; font-weight: 800; font-size: 12.5px; color: ${isAtrasado ? '#f87171' : '#94a3b8'};">
                                                ${r.dias || '—'}
                                            </td>
                                            <td style="font-weight: 700; color: ${r.isRecebido ? '#34d399' : '#f87171'}; font-size: 12px;">
                                                ${r.recebido ? `<i class="fa-solid fa-calendar-check" style="margin-right: 4px;"></i> ${r.recebido}` : '<span style="color: #fca5a5; font-style: italic;">Pendente</span>'}
                                            </td>
                                            <td style="text-align: center;">
                                                ${r.isRecebido ? `
                                                    <span class="badge badge-emerald" style="font-size: 10.5px; padding: 3px 8px;">
                                                        <i class="fa-solid fa-circle-check"></i> Já Recebido
                                                    </span>
                                                ` : `
                                                    <span class="badge badge-rose badge-pulse-red" style="font-size: 10.5px; padding: 3px 8px;">
                                                        <i class="fa-solid fa-clock"></i> Falta Receber
                                                    </span>
                                                `}
                                            </td>
                                            <td style="font-size: 11.5px; color: var(--text-muted);">${r.obs || '—'}</td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            ` : `
                <!-- CONTEÚDO DA ABA 2: PRODUTOS NO SETOR 43 DO CRM -->
                <div class="table-card" style="margin-bottom: 24px; padding: 14px 18px;">
                    <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;">
                        <!-- Campo de Busca no CRM -->
                        <div style="display: flex; align-items: center; gap: 10px; flex: 1; min-width: 280px;">
                            <div style="position: relative; width: 100%;">
                                <i class="fa-solid fa-magnifying-glass" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text-muted); font-size: 13px;"></i>
                                <input 
                                    type="text" 
                                    class="crm-input" 
                                    placeholder="Buscar por OP, Código, Descrição, Local, Semana, Cliente..." 
                                    value="${state.rotativosSearch || ''}" 
                                    oninput="window.crmSearchRotativos(this.value)"
                                    style="padding-left: 36px; width: 100%; height: 38px; font-size: 12.5px; border-radius: 8px; background: rgba(15, 23, 42, 0.6); border: 1px solid var(--border-color);"
                                />
                            </div>
                            ${state.rotativosSearch ? `
                                <button class="exec-action-btn" onclick="window.crmSearchRotativos('')" title="Limpar busca">
                                    <i class="fa-solid fa-xmark"></i>
                                </button>
                            ` : ''}
                        </div>

                        <!-- Alternadores de Visualização e Filtro Ativo -->
                        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                            ${activeCrmFilterLabel ? `
                                <span class="badge badge-cyan" style="font-size: 11.5px; padding: 5px 10px; display: flex; align-items: center; gap: 6px;">
                                    <i class="fa-solid fa-filter"></i> ${activeCrmFilterLabel}
                                    <i class="fa-solid fa-xmark" style="cursor: pointer;" onclick="window.crmFilterRotativos(null)" title="Limpar filtro"></i>
                                </span>
                            ` : ''}
                            
                            <div class="btn-group" style="background: rgba(15, 23, 42, 0.6); padding: 2px; border-radius: 8px; border: 1px solid var(--border-color);">
                                <button class="exec-action-btn ${state.rotativosViewMode === 'grid' ? 'active' : ''}" onclick="window.crmToggleRotativosViewMode('grid')" title="Visualização em Grade de Fotos (4 por linha)" style="font-size: 12px; padding: 6px 12px;">
                                    <i class="fa-solid fa-table-cells"></i> Fotos (4 colunas)
                                </button>
                                <button class="exec-action-btn ${state.rotativosViewMode === 'table' ? 'active' : ''}" onclick="window.crmToggleRotativosViewMode('table')" title="Visualização em Tabela Detalhada" style="font-size: 12px; padding: 6px 12px;">
                                    <i class="fa-solid fa-table-list"></i> Tabela
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- SEÇÃO DE FOTOS DOS PRODUTOS PENDENTES NO SETOR 43 (GRADE VISUAL 4 POR LINHA) -->
                ${state.rotativosViewMode === 'grid' ? `
                    <div class="table-card" style="border-top: 3px solid #00d4ff; margin-bottom: 24px;">
                        <div class="table-toolbar" style="border-bottom: 1px solid rgba(0, 212, 255, 0.2);">
                            <div class="table-title-group">
                                <h3 class="table-title" style="display: flex; align-items: center; gap: 8px; color: #ffffff;">
                                    <i class="fa-solid fa-camera-retro" style="color: #00d4ff;"></i>
                                    <span>Galeria Visual de Produtos com Rotativo (Setor 43)</span>
                                    <span class="badge badge-cyan" style="font-size: 10px; padding: 2px 8px;">FOTOS REAIS</span>
                                </h3>
                                <span class="badge badge-sub">${displayCrmItems.length} produtos exibidos</span>
                            </div>
                        </div>

                        ${displayCrmItems.length === 0 ? `
                            <div style="padding: 48px; text-align: center; color: var(--text-muted);">
                                <i class="fa-solid fa-rotate" style="font-size: 32px; color: var(--text-muted); margin-bottom: 12px;"></i>
                                <p style="font-size: 14px; font-weight: 600;">Nenhum produto de rotativo encontrado para os filtros selecionados.</p>
                                <button class="exec-action-btn" onclick="window.crmFilterRotativos(null); window.crmSearchRotativos('');" style="margin-top: 10px;">
                                    Limpar Todos os Filtros
                                </button>
                            </div>
                        ` : `
                            <div class="s13-photo-grid" style="margin-top: 14px;">
                                ${displayCrmItems.map(item => {
                                    const imgInfo = getProductImage(item.codigo);
                                    const isRepetido = state.productionCodes.has(item.codigo);
                                    const escapedDesc = (item.descricao || 'Produto').replace(/'/g, "\\'");
                                    const escapedCode = (item.codigo || '').replace(/'/g, "\\'");

                                    return `
                                        <div class="s13-photo-card ${isRepetido ? 'card-critico' : ''}">
                                            <div class="s13-photo-wrapper">
                                                <span class="s13-photo-tag" style="background: rgba(0, 212, 255, 0.92); color: #021226; font-weight: 900; top: 10px; left: 10px; border-radius: 6px; box-shadow: 0 0 10px rgba(0, 212, 255, 0.6); font-size: 11px; padding: 3px 8px;" title="Setor 43 - Rotativo">
                                                    <i class="fa-solid fa-rotate"></i> SETOR 43
                                                </span>

                                                ${isRepetido ? `
                                                    <span class="s13-photo-tag badge-pulse-red" style="background: rgba(239, 68, 68, 0.92); color: #ffffff; font-weight: 800; top: 10px; right: 10px; left: auto; border-radius: 6px; font-size: 10px; padding: 3px 7px;" title="Alerta: Este produto também está na linha de produção!">
                                                        <i class="fa-solid fa-triangle-exclamation"></i> EM PRODUÇÃO
                                                    </span>
                                                ` : (imgInfo.hasImage ? `
                                                    <span class="s13-photo-tag" style="top: 10px; right: 10px; left: auto;" title="Foto vinculada do Google Drive">
                                                        <i class="fa-brands fa-google-drive" style="color: #34d399;"></i> Drive
                                                    </span>
                                                ` : '')}

                                                ${imgInfo.hasImage ? `
                                                    <img src="${imgInfo.thumbUrl}" loading="lazy" class="s13-photo-img" alt="${item.codigo}" onerror="this.onerror=null; this.src='${imgInfo.proxyUrl}';">
                                                    <div class="s13-photo-overlay" onclick="window.crmOpenImageLightbox('${imgInfo.largeUrl}', '${escapedCode}', 'OP ${item.op} • Setor 43 • ${escapedDesc}')">
                                                        <i class="fa-solid fa-magnifying-glass-plus" style="font-size: 24px; color: #00d4ff;"></i>
                                                        <span>Ampliar Foto</span>
                                                    </div>
                                                ` : `
                                                    <div class="s13-photo-placeholder" onclick="window.crmOpenOpModal('${item.op}')" title="Clique para detalhes da OP">
                                                        <i class="fa-solid fa-shirt s13-placeholder-icon"></i>
                                                        <strong style="color: #cbd5e1; font-size: 13.5px; font-family: monospace;">${item.codigo}</strong>
                                                        <span style="font-size: 10.5px; color: var(--text-muted);"><i class="fa-solid fa-camera-retro"></i> Aguardando foto na pasta</span>
                                                    </div>
                                                `}
                                            </div>

                                            <div class="s13-card-body">
                                                <div class="s13-card-code-row">
                                                    <div class="s13-card-code" title="Código do Produto">${item.codigo}</div>
                                                    <div style="display: flex; align-items: center; gap: 4px;">
                                                        ${item.etiqueta && item.etiqueta !== '—' ? `
                                                            <span class="badge badge-sub" style="font-size: 10.5px; padding: 2px 6px; color: #60a5fa; border-color: rgba(96, 165, 250, 0.3);" title="Etiqueta: ${item.etiqueta}">
                                                                Etq ${item.etiqueta}
                                                            </span>
                                                        ` : ''}
                                                        <span class="s13-card-op-badge" title="Ordem de Produção" onclick="window.crmOpenOpModal('${item.op}')" style="cursor: pointer;">OP ${item.op}</span>
                                                    </div>
                                                </div>

                                                <div class="s13-card-desc" title="${item.descricao}">${item.descricao || 'Sem descrição cadastrada'}</div>

                                                <div class="s13-card-meta-grid">
                                                    <div class="s13-meta-item">
                                                        <span class="s13-meta-label">Cliente / Marca</span>
                                                        <span class="s13-meta-val" style="color: #e2e8f0; font-weight: 600;">${item.cliente || item.marca || '—'}</span>
                                                    </div>
                                                    <div class="s13-meta-item">
                                                        <span class="s13-meta-label">OC / RIS</span>
                                                        ${(item.oc || '').trim().toUpperCase().startsWith('S') || !(item.oc || '').trim() ? `<span class="s13-meta-val" style="color: #f97316; font-weight: 800; background: rgba(249,115,22,0.15); padding: 1px 4px; border-radius: 4px;">SEM OC</span>` : `<span class="s13-meta-val" style="color: #94a3b8; font-weight: 700;"><i class="fa-solid fa-file-invoice" style="margin-right:4px;"></i>${item.oc}</span>`}
                                                    </div>
                                                    <div class="s13-meta-item">
                                                        <span class="s13-meta-label">Semana Pedido</span>
                                                        <span class="s13-meta-val" style="color: #38bdf8; font-weight: 700;">${item.pedDescPeriodo || item.semanaPedido || '—'}</span>
                                                    </div>
                                                    <div class="s13-meta-item">
                                                        <span class="s13-meta-label">Qtde Peças</span>
                                                        <span class="s13-meta-val" style="color: #34d399; font-weight: 800;">${formatNumber(item.qtdeOriginal)} pçs</span>
                                                    </div>
                                                    <div class="s13-meta-item">
                                                        <span class="s13-meta-label">Dias no Setor</span>
                                                        <span class="s13-meta-val ${item.diasParado > 2 ? 'critico' : ''}">${item.diasParado} dias</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        `}
                    </div>
                ` : `
                    <!-- VISUALIZAÇÃO EM TABELA DO CRM -->
                    <div class="table-card" style="border-top: 3px solid #00d4ff; margin-bottom: 24px;">
                        <div class="table-responsive">
                            <table class="crm-table">
                                <thead>
                                    <tr>
                                        <th>OP</th>
                                        <th>CÓDIGO</th>
                                        <th>DESCRIÇÃO</th>
                                        <th>CLIENTE</th>
                                        <th>SEMANA</th>
                                        <th style="text-align: right;">PEÇAS</th>
                                        <th style="text-align: center;">DIAS</th>
                                        <th>STATUS</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${displayCrmItems.map(item => `
                                        <tr>
                                            <td style="font-weight: 800; color: #38bdf8; cursor: pointer;" onclick="window.crmOpenOpModal('${item.op}')">OP ${item.op}</td>
                                            <td style="font-family: monospace; font-weight: 700; color: #ffffff;">${item.codigo}</td>
                                            <td style="color: #cbd5e1;">${item.descricao || '—'}</td>
                                            <td style="color: #e2e8f0;">${item.cliente || '—'}</td>
                                            <td style="color: #c084fc; font-weight: 600;">${item.pedDescPeriodo || '—'}</td>
                                            <td style="text-align: right; font-weight: 700; color: #34d399;">${formatNumber(item.qtdeOriginal)}</td>
                                            <td style="text-align: center; font-weight: 800; color: ${item.diasParado > 2 ? '#f87171' : '#cbd5e1'};">${item.diasParado}d</td>
                                            <td>${item.statusModelagem || item.descLocal || '—'}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                `}
            `}
        `;
    }

    // =========================================================================
    // 7. MÓDULO ESTILO PEDIDO - MALOTES PENDENTES (SETORES 88 E 83)
    // =========================================================================
    function renderMalotesView(container) {
        // Regras do Usuário:
        // - Cruzar informações dos produtos nos setores de malote (88 e 83) com os setores da parte principal (05, 06, 12, 13, 26, 20, 31, 106)
        // - Trazer a quantidade de MALOTES TOTAIS em cada setor (Setor 88 e Setor 83)
        // - Setores principais (05, 06, 12, 13, 26): considerados NO PRAZO (Fluxo Normal)
        // - Setores principais (20, 31, 106): considerados CRÍTICOS (Os malotes já deveriam estar prontos!)
        // - Dois gráficos de Pizza/Donut Grandes (Padrão 440x440 idêntico a Aviamentos X01 / Cores D01):
        //   1) SETOR 88 • Dividido por setor da parte principal
        //   2) SETOR 83 • Dividido por setor da parte principal
        // - Grade de Fotos (4 por linha): Trazer as imagens APENAS dos produtos pendentes no setor 88 e 83 que estão com a parte principal nos setores CRÍTICOS (20, 31, 106)!
        
        const PROD_SECTOR_LIST = ['05', '06', '12', '13', '26', '20', '31', '106'];
        const CRITICAL_SECTOR_LIST = ['20', '31', '106'];
        const ON_TIME_SECTOR_LIST = ['05', '06', '12', '13', '26'];

        // 1. Mapear setores principais de produção de cada OP em state.allData
        const opProdSectorsMap = new Map();
        state.allData.forEach(item => {
            if (!item.op) return;
            if (!opProdSectorsMap.has(item.op)) {
                opProdSectorsMap.set(item.op, new Set());
            }
            if (PROD_SECTOR_LIST.includes(item.setor)) {
                opProdSectorsMap.get(item.op).add(item.setor);
            }
        });

        // 2. Extrair todos os itens/registros de Malote (Setores 88 e 83)
        const malotes88Items = [];
        const malotes83Items = [];

        state.allData.forEach(item => {
            const s = (item.setor || '').trim();
            if (s !== '88' && s !== '088' && s !== '83' && s !== '083') return;

            const pSectors = Array.from(opProdSectorsMap.get(item.op) || []);
            let primarySector = 'Sem Setor Prod';
            if (pSectors.length > 0) {
                // Prioriza setores críticos se houver mais de um
                const crit = pSectors.find(sec => CRITICAL_SECTOR_LIST.includes(sec));
                primarySector = crit || pSectors[0];
            }

            const isCritico = pSectors.some(sec => CRITICAL_SECTOR_LIST.includes(sec));
            const isNoPrazo = pSectors.some(sec => ON_TIME_SECTOR_LIST.includes(sec));

            const maloteEntry = {
                ...item,
                maloteSetor: (s === '88' || s === '088') ? '88' : '83',
                primarySector,
                prodSectors: pSectors,
                isCritico,
                isNoPrazo
            };

            if (maloteEntry.maloteSetor === '88') {
                malotes88Items.push(maloteEntry);
            } else {
                malotes83Items.push(maloteEntry);
            }
        });

        const allMaloteItems = [...malotes88Items, ...malotes83Items];
        const totalMalotes88 = malotes88Items.length;
        const totalMalotes83 = malotes83Items.length;
        const totalAllMalotes = allMaloteItems.length;

        const uniqueOps88 = new Set(malotes88Items.map(m => m.op)).size;
        const uniqueOps83 = new Set(malotes83Items.map(m => m.op)).size;

        const criticalMalotes = allMaloteItems.filter(m => m.isCritico);
        const onTimeMalotes = allMaloteItems.filter(m => m.isNoPrazo);
        const totalPecasAll = allMaloteItems.reduce((sum, r) => sum + (r.qtdeOriginal || 0), 0);

        // Paleta de Cores e Metadados para os Setores Principais
        const sectorMetaMap = {
            '05': { color: '#38bdf8', glow: '#0284c7', label: 'Setor 05 (Desenvolvimento)', isCritico: false },
            '06': { color: '#3b82f6', glow: '#1d4ed8', label: 'Setor 06 (Arte / Estamparia)', isCritico: false },
            '12': { color: '#6366f1', glow: '#4338ca', label: 'Setor 12 (Engenharia)', isCritico: false },
            '13': { color: '#00d4ff', glow: '#0891b2', label: 'Setor 13 (Modelagem)', isCritico: false },
            '26': { color: '#10b981', glow: '#059669', label: 'Setor 26 (Corte / Sala)', isCritico: false },
            '20': { color: '#f43f5e', glow: '#e11d48', label: 'Setor 20 (Costura / Facção)', isCritico: true },
            '31': { color: '#e11d48', glow: '#be123c', label: 'Setor 31 (Acabamento)', isCritico: true },
            '106': { color: '#fb7185', glow: '#e11d48', label: 'Setor 106 (Expedição / Final)', isCritico: true },
            'Sem Setor Prod': { color: '#64748b', glow: '#475569', label: 'Sem Setor Prod', isCritico: false }
        };

        // Geometria Donut SVG Padrão (viewBox 0 0 440 440, raio 150)
        const radius = 150;
        const circumference = 2 * Math.PI * radius; // ~942.48

        // Helper para gerar fatias de donut agrupadas por setor principal
        function generateDonutData(itemsList, totalItemsCount) {
            const grouped = {};
            itemsList.forEach(item => {
                const sec = item.primarySector || 'Sem Setor Prod';
                if (!grouped[sec]) {
                    grouped[sec] = {
                        sector: sec,
                        count: 0,
                        pecas: 0,
                        ops: new Set(),
                        meta: sectorMetaMap[sec] || { color: '#94a3b8', glow: '#64748b', label: `Setor ${sec}`, isCritico: false },
                        items: []
                    };
                }
                grouped[sec].count++;
                grouped[sec].pecas += (item.qtdeOriginal || 0);
                grouped[sec].ops.add(item.op);
                grouped[sec].items.push(item);
            });

            // Ordenar: primeiro setores críticos (20, 31, 106), depois por quantidade desc
            const sortedList = Object.values(grouped).sort((a, b) => {
                const aCrit = CRITICAL_SECTOR_LIST.includes(a.sector) ? 1 : 0;
                const bCrit = CRITICAL_SECTOR_LIST.includes(b.sector) ? 1 : 0;
                if (bCrit !== aCrit) return bCrit - aCrit;
                return b.count - a.count;
            });

            let accum = 0;
            const total = totalItemsCount || itemsList.length;
            const slices = sortedList.map(g => {
                const dash = total > 0 ? (g.count / total) * circumference : 0;
                const offset = -accum;
                accum += dash;
                return {
                    ...g,
                    dash: dash.toFixed(2),
                    offset: offset.toFixed(2),
                    percent: total > 0 ? ((g.count / total) * 100).toFixed(1) : '0'
                };
            });

            return { total, slices, list: sortedList };
        }

        const donut88 = generateDonutData(malotes88Items, totalMalotes88);
        const donut83 = generateDonutData(malotes83Items, totalMalotes83);

        // 3. Filtragem e busca da tela
        let filteredDisplayMalotes = allMaloteItems;

        if (state.malotesFilter) {
            if (state.malotesFilter.field === 'maloteSetor') {
                filteredDisplayMalotes = filteredDisplayMalotes.filter(m => m.maloteSetor === state.malotesFilter.value);
            } else if (state.malotesFilter.field === 'primarySector') {
                filteredDisplayMalotes = filteredDisplayMalotes.filter(m => m.primarySector === state.malotesFilter.value);
            } else if (state.malotesFilter.field === 'status') {
                if (state.malotesFilter.value === 'critico') {
                    filteredDisplayMalotes = filteredDisplayMalotes.filter(m => m.isCritico);
                } else if (state.malotesFilter.value === 'noprazo') {
                    filteredDisplayMalotes = filteredDisplayMalotes.filter(m => m.isNoPrazo);
                }
            }
        }

        if (state.malotesSearch && state.malotesSearch.trim().length > 0) {
            const q = state.malotesSearch.trim().toLowerCase();
            filteredDisplayMalotes = filteredDisplayMalotes.filter(m => 
                (m.op || '').toLowerCase().includes(q) ||
                (m.codigo || '').toLowerCase().includes(q) ||
                (m.descricao || '').toLowerCase().includes(q) ||
                (m.cliente || '').toLowerCase().includes(q) ||
                (m.maloteSetor || '').toLowerCase().includes(q) ||
                (m.primarySector || '').toLowerCase().includes(q)
            );
        }

        // Deduplicar produtos críticos para os Cards de Fotos (1 card por OP/Código)
        const criticalPhotoMap = new Map();
        criticalMalotes.forEach(item => {
            const key = `${item.op}_${item.codigo}`;
            if (!criticalPhotoMap.has(key)) {
                criticalPhotoMap.set(key, { ...item, totalPecasOP: 0 });
            }
            criticalPhotoMap.get(key).totalPecasOP += (item.qtdeOriginal || 0);
        });

        const photoCriticalItems = Array.from(criticalPhotoMap.values()).sort((a, b) => {
            const compSec = String(a.primarySector).localeCompare(String(b.primarySector), undefined, { numeric: true });
            if (compSec !== 0) return compSec;
            return String(a.op).localeCompare(String(b.op), undefined, { numeric: true });
        });

        container.innerHTML = `
            <!-- CABEÇALHO DO MÓDULO MALOTES -->
            <div class="module-view-header" style="margin-bottom: 24px;">
                <div class="module-view-title-group">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span class="view-tag-badge" style="background: rgba(236, 72, 153, 0.2); color: #f472b6; border: 1px solid rgba(236, 72, 153, 0.4);">
                            <i class="fa-solid fa-envelope-open-text"></i> MALOTES
                        </span>
                        <h2 style="font-size: 21px; font-weight: 800; color: #ffffff; margin: 0;">Módulo Estilo Pedido: MALOTES (Setores 88 e 83)</h2>
                    </div>
                    <p class="module-view-description" style="font-size: 13px; color: var(--text-muted); margin-top: 4px;">
                        Cruzamento analítico: Malotes pendentes nos Setores 88 e 83 vs Setor onde a Parte Principal do pedido se encontra (05, 06, 12, 13, 26, 20, 31, 106).
                    </p>
                </div>
                
                <div class="btn-group" style="flex-wrap: wrap; gap: 8px;">
                    <span class="badge badge-rose" style="font-size: 12px; padding: 6px 14px; background: rgba(244, 63, 94, 0.2); border-color: rgba(244, 63, 94, 0.4); color: #fb7185;">
                        <i class="fa-solid fa-triangle-exclamation"></i> ${criticalMalotes.length} Malotes Críticos (Setores 20, 31, 106)
                    </span>
                    <span class="badge badge-emerald" style="font-size: 12px; padding: 6px 14px;">
                        <i class="fa-solid fa-circle-check"></i> ${onTimeMalotes.length} No Prazo (Setores 05, 06, 12, 13, 26)
                    </span>
                    <span class="badge badge-sub" style="font-size: 12px; padding: 6px 14px; color: #ffffff;">
                        <i class="fa-solid fa-layer-group"></i> ${totalAllMalotes} Total Malotes (${formatNumber(totalPecasAll)} pçs)
                    </span>
                </div>
            </div>

            <!-- GRID DOS DOIS GRÁFICOS GRANDES DE PIZZA / DONUT (50% / 50%) - PADRÃO EXECUTIVO -->
            <div class="exec-processo-layout" style="grid-template-columns: repeat(auto-fit, minmax(420px, 1fr)); gap: 24px; margin-bottom: 24px;">
                
                <!-- GRÁFICO 1: SETOR 88 • MALOTES POR SETOR PRINCIPAL -->
                <div class="hero-pie-chart-container" style="background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(236, 72, 153, 0.35); border-radius: 14px; padding: 22px;">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <i class="fa-solid fa-envelope" style="color: #f472b6; font-size: 18px;"></i>
                            <h3 style="font-size: 16px; font-weight: 800; color: #ffffff; margin: 0;">SETOR 88 &bull; POR SETOR PRINCIPAL (MALOTES)</h3>
                        </div>
                        <span class="badge" style="background: rgba(236, 72, 153, 0.2); color: #f472b6; border: 1px solid rgba(236, 72, 153, 0.4); font-size: 11px; padding: 3px 8px; font-weight: 800;">
                            ${totalMalotes88} Malotes (${uniqueOps88} OPs)
                        </span>
                    </div>

                    <svg viewBox="0 0 440 440" class="hero-donut-svg">
                        <defs>
                            ${donut88.slices.map((slice, idx) => `
                                <filter id="glowDonutMalote88_${idx}" x="-30%" y="-30%" width="160%" height="160%">
                                    <feDropShadow dx="0" dy="0" stdDeviation="12" flood-color="${slice.meta.color}" flood-opacity="0.85"/>
                                </filter>
                            `).join('')}
                        </defs>
                        <g transform="rotate(-90 220 220)">
                            <!-- Trilha circular de fundo -->
                            <circle cx="220" cy="220" r="150" fill="none" stroke="#121624" stroke-width="58" />
                            
                            <!-- Fatias por Setor Principal -->
                            ${donut88.total > 0 ? donut88.slices.map((slice, idx) => `
                                <circle cx="220" cy="220" r="150" fill="none" stroke="${slice.meta.color}" stroke-width="58"
                                    stroke-dasharray="${slice.dash} ${circumference.toFixed(2)}"
                                    stroke-dashoffset="${slice.offset}"
                                    filter="url(#glowDonutMalote88_${idx})"
                                    style="cursor: pointer; transition: all 0.3s ease;"
                                    onclick="window.crmFilterMalotes({ field: 'primarySector', value: '${slice.sector}' })"
                                >
                                    <title>${slice.meta.label}: ${slice.count} malotes (${slice.percent}%)</title>
                                </circle>
                            `).join('') : `
                                <circle cx="220" cy="220" r="150" fill="none" stroke="#334155" stroke-width="58"
                                    stroke-dasharray="${circumference.toFixed(2)} ${circumference.toFixed(2)}"
                                    stroke-dashoffset="0"
                                />
                            `}
                        </g>
                        <!-- Texto Central -->
                        <text x="220" y="190" text-anchor="middle" dominant-baseline="central" fill="#ffffff" font-size="76" font-weight="900" font-family="system-ui, -apple-system, sans-serif" letter-spacing="-2px">${totalMalotes88}</text>
                        <text x="220" y="246" text-anchor="middle" dominant-baseline="central" fill="#94a3b8" font-size="14" font-weight="800" letter-spacing="3px" font-family="system-ui, -apple-system, sans-serif">MALOTES</text>
                        <text x="220" y="272" text-anchor="middle" dominant-baseline="central" fill="#f472b6" font-size="13" font-weight="800" letter-spacing="1.5px" font-family="system-ui, -apple-system, sans-serif">SETOR 88 (${uniqueOps88} OPs)</text>
                    </svg>

                    <!-- Legenda Rápida de Setores Principais do Setor 88 -->
                    <div class="hero-pie-quick-legend" style="grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); margin-top: 14px;">
                        ${donut88.slices.map(slice => {
                            const isSelected = state.malotesFilter && state.malotesFilter.field === 'primarySector' && state.malotesFilter.value === slice.sector;
                            const isCrit = CRITICAL_SECTOR_LIST.includes(slice.sector);
                            return `
                                <div class="donut-legend-card ${isSelected ? 'active' : ''}" style="cursor: pointer; border-left: 4px solid ${slice.meta.color}; background: rgba(15, 23, 42, 0.7);" onclick="window.crmFilterMalotes({ field: 'primarySector', value: '${slice.sector}' })" title="Filtrar pedidos onde parte principal está no ${slice.meta.label}">
                                    <div class="donut-legend-label">
                                        <span class="legend-dot" style="background: ${slice.meta.color}; box-shadow: 0 0 8px ${slice.meta.color};"></span>
                                        <div>
                                            <div style="font-weight: 700; font-size: 12.5px; color: #ffffff;">
                                                ${isCrit ? '<i class="fa-solid fa-triangle-exclamation" style="color: #fb7185;"></i> ' : ''}SETOR ${slice.sector}
                                            </div>
                                            <div style="font-size: 11px; color: ${isCrit ? '#fb7185' : 'var(--text-muted)'}; font-weight: ${isCrit ? '700' : '500'};">
                                                ${isCrit ? '🚨 CRÍTICO' : 'No Prazo'} &bull; ${formatNumber(slice.pecas)} pçs
                                            </div>
                                        </div>
                                    </div>
                                    <div style="text-align: right;">
                                        <div class="donut-legend-value" style="font-size: 13.5px; color: ${slice.meta.color};">${slice.count} malotes (${slice.percent}%)</div>
                                        <span style="font-size: 10px; color: ${slice.meta.color}; text-decoration: underline;">Filtrar &darr;</span>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>

                <!-- GRÁFICO 2: SETOR 83 • MALOTES POR SETOR PRINCIPAL -->
                <div class="hero-pie-chart-container" style="background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(168, 85, 247, 0.35); border-radius: 14px; padding: 22px;">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <i class="fa-solid fa-folder-open" style="color: #c084fc; font-size: 18px;"></i>
                            <h3 style="font-size: 16px; font-weight: 800; color: #ffffff; margin: 0;">SETOR 83 &bull; POR SETOR PRINCIPAL (MALOTES)</h3>
                        </div>
                        <span class="badge" style="background: rgba(168, 85, 247, 0.2); color: #c084fc; border: 1px solid rgba(168, 85, 247, 0.4); font-size: 11px; padding: 3px 8px; font-weight: 800;">
                            ${totalMalotes83} Malotes (${uniqueOps83} OPs)
                        </span>
                    </div>

                    <svg viewBox="0 0 440 440" class="hero-donut-svg">
                        <defs>
                            ${donut83.slices.map((slice, idx) => `
                                <filter id="glowDonutMalote83_${idx}" x="-30%" y="-30%" width="160%" height="160%">
                                    <feDropShadow dx="0" dy="0" stdDeviation="12" flood-color="${slice.meta.color}" flood-opacity="0.85"/>
                                </filter>
                            `).join('')}
                        </defs>
                        <g transform="rotate(-90 220 220)">
                            <!-- Trilha circular de fundo -->
                            <circle cx="220" cy="220" r="150" fill="none" stroke="#121624" stroke-width="58" />
                            
                            <!-- Fatias por Setor Principal -->
                            ${donut83.total > 0 ? donut83.slices.map((slice, idx) => `
                                <circle cx="220" cy="220" r="150" fill="none" stroke="${slice.meta.color}" stroke-width="58"
                                    stroke-dasharray="${slice.dash} ${circumference.toFixed(2)}"
                                    stroke-dashoffset="${slice.offset}"
                                    filter="url(#glowDonutMalote83_${idx})"
                                    style="cursor: pointer; transition: all 0.3s ease;"
                                    onclick="window.crmFilterMalotes({ field: 'primarySector', value: '${slice.sector}' })"
                                >
                                    <title>${slice.meta.label}: ${slice.count} malotes (${slice.percent}%)</title>
                                </circle>
                            `).join('') : `
                                <circle cx="220" cy="220" r="150" fill="none" stroke="#334155" stroke-width="58"
                                    stroke-dasharray="${circumference.toFixed(2)} ${circumference.toFixed(2)}"
                                    stroke-dashoffset="0"
                                />
                            `}
                        </g>
                        <!-- Texto Central -->
                        <text x="220" y="190" text-anchor="middle" dominant-baseline="central" fill="#ffffff" font-size="76" font-weight="900" font-family="system-ui, -apple-system, sans-serif" letter-spacing="-2px">${totalMalotes83}</text>
                        <text x="220" y="246" text-anchor="middle" dominant-baseline="central" fill="#94a3b8" font-size="14" font-weight="800" letter-spacing="3px" font-family="system-ui, -apple-system, sans-serif">MALOTES</text>
                        <text x="220" y="272" text-anchor="middle" dominant-baseline="central" fill="#c084fc" font-size="13" font-weight="800" letter-spacing="1.5px" font-family="system-ui, -apple-system, sans-serif">SETOR 83 (${uniqueOps83} OPs)</text>
                    </svg>

                    <!-- Legenda Rápida de Setores Principais do Setor 83 -->
                    <div class="hero-pie-quick-legend" style="grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); margin-top: 14px;">
                        ${donut83.slices.map(slice => {
                            const isSelected = state.malotesFilter && state.malotesFilter.field === 'primarySector' && state.malotesFilter.value === slice.sector;
                            const isCrit = CRITICAL_SECTOR_LIST.includes(slice.sector);
                            return `
                                <div class="donut-legend-card ${isSelected ? 'active' : ''}" style="cursor: pointer; border-left: 4px solid ${slice.meta.color}; background: rgba(15, 23, 42, 0.7);" onclick="window.crmFilterMalotes({ field: 'primarySector', value: '${slice.sector}' })" title="Filtrar pedidos onde parte principal está no ${slice.meta.label}">
                                    <div class="donut-legend-label">
                                        <span class="legend-dot" style="background: ${slice.meta.color}; box-shadow: 0 0 8px ${slice.meta.color};"></span>
                                        <div>
                                            <div style="font-weight: 700; font-size: 12.5px; color: #ffffff;">
                                                ${isCrit ? '<i class="fa-solid fa-triangle-exclamation" style="color: #fb7185;"></i> ' : ''}SETOR ${slice.sector}
                                            </div>
                                            <div style="font-size: 11px; color: ${isCrit ? '#fb7185' : 'var(--text-muted)'}; font-weight: ${isCrit ? '700' : '500'};">
                                                ${isCrit ? '🚨 CRÍTICO' : 'No Prazo'} &bull; ${formatNumber(slice.pecas)} pçs
                                            </div>
                                        </div>
                                    </div>
                                    <div style="text-align: right;">
                                        <div class="donut-legend-value" style="font-size: 13.5px; color: ${slice.meta.color};">${slice.count} malotes (${slice.percent}%)</div>
                                        <span style="font-size: 10px; color: ${slice.meta.color}; text-decoration: underline;">Filtrar &darr;</span>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            </div>

            <!-- SEÇÃO DE FOTOS DOS PRODUTOS CRÍTICOS (PARTE PRINCIPAL NOS SETORES 20, 31 E 106) -->
            <div class="table-card" id="malotesGallerySection" style="border-top: 3px solid #f43f5e; margin-bottom: 24px; padding: 18px 20px;">
                <div class="table-toolbar" style="border-bottom: 1px solid rgba(244, 63, 94, 0.2); justify-content: space-between; padding-bottom: 12px; margin-bottom: 16px;">
                    <div class="table-title-group">
                        <h3 class="table-title" style="display: flex; align-items: center; gap: 8px; color: #ffffff;">
                            <i class="fa-solid fa-camera" style="color: #fb7185;"></i>
                            <span>Fotos dos Produtos Críticos (Malote Pendente 88/83 e Parte Principal em Setor 20, 31 ou 106)</span>
                        </h3>
                        <span class="badge badge-rose" style="font-weight: 800;">${photoCriticalItems.length} Produtos Críticos</span>
                    </div>
                    <div style="font-size: 12px; color: #fb7185; font-weight: 700;">
                        <i class="fa-solid fa-fire-flame-curved"></i> Ação Urgente: Malote atrasado em relação à produção
                    </div>
                </div>

                ${photoCriticalItems.length === 0 ? `
                    <div style="text-align: center; padding: 36px 20px; color: var(--text-muted);">
                        <i class="fa-solid fa-circle-check" style="font-size: 38px; color: #10b981; margin-bottom: 10px;"></i>
                        <h4 style="font-size: 15px; color: #e2e8f0; margin-bottom: 4px;">Nenhum produto crítico encontrado</h4>
                        <p style="font-size: 12px;">Todos os malotes nos setores 88 e 83 estão alinhados com fases iniciais da produção (05, 06, 12, 13, 26).</p>
                    </div>
                ` : `
                    <!-- GRADE VISUAL 4 POR LINHA COM FOTOS DOS PRODUTOS CRÍTICOS -->
                    <div class="s13-photo-grid" style="margin-top: 6px;">
                        ${photoCriticalItems.map(item => {
                            const imgInfo = getProductImage(item.codigo, item.op);
                            const escapedDesc = (item.descricao || 'Produto').replace(/'/g, "\\'");
                            const escapedCode = (item.codigo || '').replace(/'/g, "\\'");

                            return `
                                <div class="s13-photo-card card-critico" style="border-color: rgba(244, 63, 94, 0.45); box-shadow: 0 4px 16px rgba(244, 63, 94, 0.15);">
                                    <!-- ÁREA DA FOTO -->
                                    <div class="s13-photo-wrapper">
                                        <!-- BADGE DE DESTAQUE DO SETOR CRÍTICO NA FOTO -->
                                        <span class="s13-photo-tag" style="background: #e11d48; color: #ffffff; font-weight: 800; top: 10px; left: 10px; border-radius: 6px; box-shadow: 0 0 10px rgba(225, 29, 72, 0.8); font-size: 11px; padding: 3px 8px;" title="Setor Onde a Parte Principal Está">
                                            <i class="fa-solid fa-triangle-exclamation"></i> PRINCIPAL: SETOR ${item.primarySector}
                                        </span>

                                        <!-- BADGE DO SETOR DO MALOTE NO TOPO DIREITO -->
                                        <span class="s13-photo-tag" style="background: rgba(236, 72, 153, 0.9); color: #ffffff; font-weight: 800; top: 10px; right: 10px; left: auto; font-size: 10.5px; padding: 3px 8px;" title="Setor do Malote">
                                            <i class="fa-solid fa-envelope"></i> MALOTE ${item.maloteSetor}
                                        </span>

                                        ${imgInfo.hasImage ? `
                                            <img src="${imgInfo.thumbUrl}" loading="lazy" class="s13-photo-img" alt="${item.codigo}" onerror="this.onerror=null; this.src='${imgInfo.proxyUrl}';">
                                            <div class="s13-photo-overlay" onclick="window.crmOpenImageLightbox('${imgInfo.largeUrl}', '${escapedCode}', 'OP ${item.op} • Malote ${item.maloteSetor} • Principal Setor ${item.primarySector} • ${escapedDesc}')">
                                                <i class="fa-solid fa-magnifying-glass-plus" style="font-size: 24px; color: #38bdf8;"></i>
                                                <span>Ampliar Foto</span>
                                            </div>
                                        ` : `
                                            <div class="s13-photo-placeholder" style="background: #111827;">
                                                <i class="fa-solid fa-shirt s13-placeholder-icon"></i>
                                                <strong style="color: #cbd5e1; font-size: 13px; font-family: monospace;">${item.codigo}</strong>
                                                <span style="font-size: 10px; color: var(--text-muted);"><i class="fa-solid fa-camera-retro"></i> Sem foto na pasta</span>
                                            </div>
                                        `}
                                    </div>

                                    <!-- CORPO DO CARD COM INFORMAÇÕES COMPLETAS -->
                                    <div class="s13-card-body">
                                        <!-- Linha 1: Código, OP e Cliente -->
                                        <div class="s13-card-code-row">
                                            <div class="s13-card-code" title="Código do Produto">${item.codigo}</div>
                                            <div style="display: flex; align-items: center; gap: 4px;">
                                                <span class="badge badge-cyan" style="font-size: 10.5px; padding: 2px 6px;">${item.cliente}</span>
                                                <span class="s13-card-op-badge" style="background: rgba(244, 63, 94, 0.2); color: #fb7185; border: 1px solid rgba(244, 63, 94, 0.4);" title="Ordem / OP">OP ${item.op}</span>
                                            </div>
                                        </div>

                                        <!-- Linha 2: Descrição do Produto -->
                                        <div style="font-size: 12px; font-weight: 600; color: #e2e8f0; line-height: 1.35; max-height: 34px; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; margin-bottom: 6px;" title="${item.descricao}">
                                            ${item.descricao}
                                        </div>

                                        <!-- Linha 3: Destaque do Cruzamento (Principal vs Malote) -->
                                        <div style="margin-top: 4px; margin-bottom: 6px;">
                                            <div class="s13-dias-badge normal" style="background: rgba(225, 29, 72, 0.12); border: 1px solid rgba(225, 29, 72, 0.4); color: #fb7185; display: flex; align-items: center; justify-content: space-between; padding: 5px 8px;">
                                                <span style="font-size: 10.5px;"><strong>Principal:</strong> Setor ${item.primarySector}</span>
                                                <span style="font-size: 10.5px; color: #f472b6;"><strong>Malote:</strong> Setor ${item.maloteSetor}</span>
                                            </div>
                                        </div>

                                        <!-- Linha 4: Métricas do Pedido (Peças, Dias Parado) -->
                                        <div style="display: flex; align-items: center; justify-content: space-between; padding-top: 4px; border-top: 1px solid rgba(255, 255, 255, 0.08); font-size: 11px;">
                                            <span style="color: #94a3b8;"><i class="fa-solid fa-boxes-stacked"></i> <strong>${item.totalPecasOP || item.qtdeOriginal || 0}</strong> pçs</span>
                                            <span class="badge badge-rose" style="font-size: 10.5px; padding: 2px 6px;" title="Dias no Setor">
                                                <i class="fa-solid fa-clock"></i> ${item.diasParado} dias
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                `}
            </div>

            <!-- BARRA DE CONTROLES E BUSCA DA TABELA -->
            <div class="filter-toolbar pdf-screen-controls" style="margin-bottom: 16px;">
                <div class="filter-toolbar-left" style="width: 100%; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;">
                    <!-- Input de Busca -->
                    <div class="search-input-wrapper" style="max-width: 380px; width: 100%;">
                        <i class="fa-solid fa-magnifying-glass search-icon"></i>
                        <input 
                            type="text" 
                            class="search-input" 
                            placeholder="Buscar por OP, Código, Setor, Cliente..." 
                            value="${state.malotesSearch || ''}"
                            oninput="window.crmSearchMalotes(this.value)"
                        />
                        ${state.malotesSearch ? `
                            <button class="search-clear-btn" onclick="window.crmSearchMalotes('')" title="Limpar busca">&times;</button>
                        ` : ''}
                    </div>

                    <!-- Filtros Rápidos -->
                    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                        <button class="exec-action-btn ${!state.malotesFilter ? 'active' : ''}" onclick="window.crmFilterMalotes(null)">
                            Todos (${totalAllMalotes})
                        </button>
                        <button class="exec-action-btn ${state.malotesFilter && state.malotesFilter.value === 'critico' ? 'active' : ''}" onclick="window.crmFilterMalotes({ field: 'status', value: 'critico' })" style="border-color: rgba(244, 63, 94, 0.4); color: #fb7185;">
                            <i class="fa-solid fa-triangle-exclamation"></i> Apenas Críticos (${criticalMalotes.length})
                        </button>
                        <button class="exec-action-btn ${state.malotesFilter && state.malotesFilter.value === '88' ? 'active' : ''}" onclick="window.crmFilterMalotes({ field: 'maloteSetor', value: '88' })">
                            Setor 88 (${totalMalotes88})
                        </button>
                        <button class="exec-action-btn ${state.malotesFilter && state.malotesFilter.value === '83' ? 'active' : ''}" onclick="window.crmFilterMalotes({ field: 'maloteSetor', value: '83' })">
                            Setor 83 (${totalMalotes83})
                        </button>
                    </div>
                </div>
            </div>

            <!-- TABELA DETALHADA DE MALOTES -->
            <div class="table-card pdf-detail-list" id="malotesTableSection" style="border-top: 3px solid #ec4899; margin-bottom: 24px;">
                <div class="table-toolbar" style="border-bottom: 1px solid rgba(236, 72, 153, 0.2); justify-content: space-between;">
                    <div class="table-title-group">
                        <h3 class="table-title" style="display: flex; align-items: center; gap: 8px; color: #ffffff;">
                            <i class="fa-solid fa-table-list" style="color: #f472b6;"></i>
                            <span>Listagem Geral de Pedidos com Malote (Setores 88 e 83)</span>
                        </h3>
                        <span class="badge badge-sub">${filteredDisplayMalotes.length} Malotes listados</span>
                    </div>
                </div>

                <div class="table-responsive">
                    <table class="crm-table">
                        <thead>
                            <tr>
                                <th>OP / Número</th>
                                <th>Código do Produto</th>
                                <th>Descrição do Produto</th>
                                <th>Setor Malote</th>
                                <th>Setor Parte Principal</th>
                                <th>Status de Prazo</th>
                                <th>Cliente</th>
                                <th>Qtde Peças</th>
                                <th>Dias no Setor</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${filteredDisplayMalotes.length === 0 ? `
                                <tr>
                                    <td colspan="9" style="text-align: center; padding: 36px; color: var(--text-muted);">
                                        Nenhum pedido de malote encontrado para os filtros selecionados.
                                    </td>
                                </tr>
                            ` : filteredDisplayMalotes.map(item => {
                                const secMeta = sectorMetaMap[item.primarySector] || { color: '#94a3b8', label: item.primarySector };
                                return `
                                    <tr class="${item.isCritico ? 'row-danger' : ''}">
                                        <td class="table-op-cell">
                                            <span style="font-family: monospace; font-weight: 800; color: #38bdf8; font-size: 13.5px;">${item.op}</span>
                                        </td>
                                        <td>
                                            <span style="font-family: 'SF Mono', Monaco, monospace; font-weight: 700; color: #ffffff; font-size: 13px;">${item.codigo}</span>
                                        </td>
                                        <td>
                                            <div style="font-size: 12.5px; color: #e2e8f0; font-weight: 500; max-width: 280px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${item.descricao}">
                                                ${item.descricao}
                                            </div>
                                        </td>
                                        <td>
                                            <span class="badge" style="background: rgba(236, 72, 153, 0.2); border: 1px solid rgba(236, 72, 153, 0.4); color: #f472b6; font-weight: 800;">
                                                Setor ${item.maloteSetor}
                                            </span>
                                        </td>
                                        <td>
                                            <span class="badge" style="background: ${secMeta.color}22; border: 1px solid ${secMeta.color}66; color: ${secMeta.color}; font-weight: 800;">
                                                Setor ${item.primarySector}
                                            </span>
                                        </td>
                                        <td>
                                            ${item.isCritico ? `
                                                <span class="badge badge-rose" style="font-weight: 800; font-size: 11px;">
                                                    <i class="fa-solid fa-triangle-exclamation"></i> CRÍTICO (${item.primarySector})
                                                </span>
                                            ` : `
                                                <span class="badge badge-emerald" style="font-weight: 800; font-size: 11px;">
                                                    <i class="fa-solid fa-circle-check"></i> No Prazo
                                                </span>
                                            `}
                                        </td>
                                        <td>
                                            <span class="badge badge-cyan" style="font-weight: 800;">${item.cliente}</span>
                                        </td>
                                        <td style="font-weight: 700; color: #f8fafc; font-family: monospace;">${formatNumber(item.qtdeOriginal || 0)}</td>
                                        <td>
                                            <span class="badge ${item.diasParado > 2 ? 'badge-rose' : 'badge-sub'}" style="font-weight: 800;">
                                                ${item.diasParado} dias
                                            </span>
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    // =========================================================================
    // 5.2. MÓDULO MODELAGEM - LEADTIME PRODUTIVO (SETOR 13 - PLANILHA 22V)
    // =========================================================================
    function renderLeadtimeView(container) {
        // Regras do Usuário:
        // - Planilha Base: 22V - 2601 até 2652 (14eFcBm3glH1H04dG7UKoLvIXf0QithHrNXnscGxyvdw)
        // - Quantidade de OFs totais (Coluna A - ORDEM / OF) dividida por mês de liberação
        // - Data de Liberação: Coluna U - DT_FINAL (determina o mês)
        // - Média de tempo que ficou no setor 13: Coluna AE - DIAS_REALIZADO por mês
        // - Gráfico Grande de Colunas: quantidade de pedidos liberados em cada mês e leadtime médio (dias)
        //   para saber se o time está evoluindo (ficando mais rápido)
        
        const ltExt = state.leadtimeExternalData || { count: 0, records: [], isLive: false };
        const rawRecords = ltExt.records || [];

        // Helper flexível para extração de campos
        function extractLTField(row, possibleNames, fallbackIndex) {
            const keys = Object.keys(row || {});
            for (const name of possibleNames) {
                const targetNorm = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
                for (const k of keys) {
                    const keyNorm = k.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
                    if (keyNorm === targetNorm || keyNorm.includes(targetNorm)) {
                        const val = row[k];
                        if (val !== undefined && val !== null && String(val).trim().length > 0) {
                            return String(val).trim();
                        }
                    }
                }
            }
            if (fallbackIndex !== undefined && keys[fallbackIndex] !== undefined) {
                const val = row[keys[fallbackIndex]];
                if (val !== undefined && val !== null && String(val).trim().length > 0) {
                    return String(val).trim();
                }
            }
            return '';
        }

        // Helper de parsing de Data Final -> Mês/Ano e Chave de Ordenação
        const monthNamesPt = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        const fullMonthNamesPt = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

        function parseMonthKey(dtStr) {
            if (!dtStr || typeof dtStr !== 'string') return { key: '9999-99', label: 'Sem Data', year: 0, month: 0, sortKey: 999999 };
            const clean = dtStr.trim();
            let d, m, y;
            if (clean.includes('/')) {
                const parts = clean.split('/');
                d = parseInt(parts[0], 10);
                m = parseInt(parts[1], 10);
                y = parseInt(parts[2], 10);
                if (y < 100) y += 2000;
            } else if (clean.includes('-')) {
                const parts = clean.split('-');
                if (parts[0].length === 4) {
                    y = parseInt(parts[0], 10);
                    m = parseInt(parts[1], 10);
                    d = parseInt(parts[2], 10);
                } else {
                    d = parseInt(parts[0], 10);
                    m = parseInt(parts[1], 10);
                    y = parseInt(parts[2], 10);
                }
            }

            if (!m || isNaN(m) || m < 1 || m > 12 || !y || isNaN(y) || y < 2000) {
                return { key: '9999-99', label: 'Sem Data', year: 0, month: 0, sortKey: 999999 };
            }

            const mStr = String(m).padStart(2, '0');
            const key = `${y}-${mStr}`;
            const label = `${monthNamesPt[m - 1]}/${String(y).slice(-2)}`;
            const fullLabel = `${fullMonthNamesPt[m - 1]} de ${y}`;
            const sortKey = (y * 100) + m;

            return { key, label, fullLabel, year: y, month: m, sortKey };
        }

        // Normalização de registros da planilha 22V
        const normalizedRecords = rawRecords.map((r, idx) => {
            const op = extractLTField(r, ['ordem', 'numero', 'número', 'of', 'op', 'pedido'], 0) || `OF-${idx + 1}`;
            const codigo = extractLTField(r, ['codigo', 'código', 'produto', 'referencia', 'ref'], 7) || '—';
            const produtoDesc = extractLTField(r, ['produto_desc', 'descricao', 'descrição', 'produto', 'desc'], 8) || 'Produto em Modelagem';
            const colecao = extractLTField(r, ['colecao', 'coleção', 'estacao', 'estação', 'grupo_desc'], 9) || '—';
            
            // Coluna AA (REALIZADO_FIM) - Data efetiva de liberação do pedido na modelagem (estritamente Coluna AA)
            const dtLiberacaoRaw = extractLTField(r, ['realizado_fim', 'realizadofim', 'dt_realizado_fim'], 26);
            const dtFinal = dtLiberacaoRaw || '—';
            const monthInfo = parseMonthKey(dtLiberacaoRaw);

            // Coluna AE (DIAS_REALIZADO) - Tempo em dias no Setor 13 (estritamente Coluna AE)
            const diasRaw = extractLTField(r, ['dias_realizado', 'diasrealizado', 'dias_real'], 30);
            const diasRealizado = parseFloat(String(diasRaw).replace(',', '.')) || 0;

            const qtde = parseInt(extractLTField(r, ['pecas', 'peças', 'qtd_pedido', 'qtde', 'quantidade'], 31) || '1', 10) || 1;
            const responsavel = extractLTField(r, ['responsavel', 'responsável', 'representante', 'resp'], 12) || '—';
            const status = extractLTField(r, ['status', 'situacao', 'situação', 'posse'], 33) || 'CONCLUÍDO';

            return {
                id: idx,
                op,
                codigo,
                produtoDesc,
                colecao,
                dtFinal,
                monthKey: monthInfo.key,
                monthLabel: monthInfo.label,
                monthFullLabel: monthInfo.fullLabel,
                monthSortKey: monthInfo.sortKey,
                diasRealizado,
                qtde,
                responsavel,
                status,
                raw: r
            };
        });

        const totalOFsCount = normalizedRecords.length;
        const totalPecas = normalizedRecords.reduce((sum, r) => sum + r.qtde, 0);

        // Agrupamento por Mês
        const monthsMap = {};
        normalizedRecords.forEach(r => {
            if (r.monthKey === '9999-99') return;
            const k = r.monthKey;
            if (!monthsMap[k]) {
                monthsMap[k] = {
                    key: k,
                    label: r.monthLabel,
                    fullLabel: r.monthFullLabel,
                    sortKey: r.monthSortKey,
                    totalOFs: 0,
                    totalPecas: 0,
                    totalDias: 0,
                    diasList: [],
                    records: []
                };
            }
            monthsMap[k].totalOFs += 1;
            monthsMap[k].totalPecas += r.qtde;
            monthsMap[k].totalDias += r.diasRealizado;
            monthsMap[k].diasList.push(r.diasRealizado);
            monthsMap[k].records.push(r);
        });

        // Período solicitado: Setembro de 2025 (2025-09) até Agosto de 2026 (2026-08)
        const targetPeriodKeys = [
            '2025-09', '2025-10', '2025-11', '2025-12',
            '2026-01', '2026-02', '2026-03', '2026-04',
            '2026-05', '2026-06', '2026-07', '2026-08'
        ];

        // Garante todos os 12 meses do ciclo no período
        targetPeriodKeys.forEach(pk => {
            if (!monthsMap[pk]) {
                const parts = pk.split('-');
                const y = parseInt(parts[0], 10);
                const m = parseInt(parts[1], 10);
                monthsMap[pk] = {
                    key: pk,
                    label: monthNamesPt[m - 1] + '/' + String(y).slice(-2),
                    fullLabel: fullMonthNamesPt[m - 1] + ' de ' + y,
                    sortKey: (y * 100) + m,
                    totalOFs: 0,
                    totalPecas: 0,
                    totalDias: 0,
                    diasList: [],
                    records: []
                };
            }
        });

        const sortedMonths = targetPeriodKeys.map(k => monthsMap[k]).filter(Boolean);

        // Cálculos estatísticos por mês
        sortedMonths.forEach((m, i) => {
            m.avgLeadtime = m.totalOFs > 0 ? (m.totalDias / m.totalOFs) : 0;
            m.minDays = m.diasList.length > 0 ? Math.min(...m.diasList) : 0;
            m.maxDays = m.diasList.length > 0 ? Math.max(...m.diasList) : 0;

            if (i > 0) {
                const prev = sortedMonths[i - 1];
                if (prev.avgLeadtime > 0) {
                    const diff = m.avgLeadtime - prev.avgLeadtime;
                    m.pctChange = ((diff / prev.avgLeadtime) * 100);
                    m.isFaster = diff < 0;
                } else {
                    m.pctChange = 0;
                    m.isFaster = false;
                }
            } else {
                m.pctChange = null;
                m.isFaster = null;
            }
        });

        // Estatísticas Globais
        const validMonths = sortedMonths.filter(m => m.totalOFs > 0);
        const overallTotalDias = validMonths.reduce((sum, m) => sum + m.totalDias, 0);
        const overallTotalOFs = validMonths.reduce((sum, m) => sum + m.totalOFs, 0);
        const overallAvgLeadtime = overallTotalOFs > 0 ? (overallTotalDias / overallTotalOFs) : 0;

        let fastestMonth = null;
        let slowestMonth = null;
        if (validMonths.length > 0) {
            fastestMonth = [...validMonths].sort((a, b) => a.avgLeadtime - b.avgLeadtime)[0];
            slowestMonth = [...validMonths].sort((a, b) => b.avgLeadtime - a.avgLeadtime)[0];
        }

        let globalTrendPct = 0;
        let isGlobalImproving = false;
        if (validMonths.length >= 2) {
            const firstM = validMonths[0];
            const lastM = validMonths[validMonths.length - 1];
            if (firstM.avgLeadtime > 0) {
                globalTrendPct = (((lastM.avgLeadtime - firstM.avgLeadtime) / firstM.avgLeadtime) * 100);
                isGlobalImproving = globalTrendPct < 0;
            }
        }

        // Geração do Gráfico Grande de Colunas & Linha de Leadtime (Dual Visual SVG - Ampliado em 25%+)
        const svgW = 1200;
        const svgH = 490;
        const pad = { top: 48, right: 85, bottom: 70, left: 85 };
        const drawW = svgW - pad.left - pad.right;
        const drawH = svgH - pad.top - pad.bottom;

        const maxOFs = Math.max(...sortedMonths.map(m => m.totalOFs), 5);
        const yMaxOFs = Math.ceil(maxOFs * 1.22);

        const maxLeadtime = Math.max(...sortedMonths.map(m => m.avgLeadtime), 5);
        const yMaxLT = Math.ceil(maxLeadtime * 1.22);

        const numCols = sortedMonths.length || 1;
        const colSlotW = drawW / numCols;
        const barW = Math.min(62, Math.max(36, colSlotW - 24));

        // Coordenadas dos pontos da linha de Leadtime
        const linePoints = sortedMonths.map((m, idx) => {
            const cx = pad.left + (idx * colSlotW) + (colSlotW / 2);
            const cy = pad.top + drawH - ((m.avgLeadtime / yMaxLT) * drawH);
            return { x: cx, y: cy, data: m };
        });

        const linePathD = linePoints.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`).join(' ');

        // Filtros e Pesquisa na Tabela
        let filteredRecords = normalizedRecords;
        if (state.leadtimeSearch && state.leadtimeSearch.trim().length > 0) {
            const q = state.leadtimeSearch.trim().toLowerCase();
            filteredRecords = filteredRecords.filter(r => 
                r.op.toLowerCase().includes(q) ||
                r.codigo.toLowerCase().includes(q) ||
                r.produtoDesc.toLowerCase().includes(q) ||
                r.colecao.toLowerCase().includes(q) ||
                r.dtFinal.toLowerCase().includes(q) ||
                r.monthLabel.toLowerCase().includes(q) ||
                r.responsavel.toLowerCase().includes(q) ||
                r.status.toLowerCase().includes(q)
            );
        }

        let activeMonthBadge = null;
        if (state.leadtimeFilter) {
            filteredRecords = filteredRecords.filter(r => r.monthKey === state.leadtimeFilter);
            const mMatch = sortedMonths.find(m => m.key === state.leadtimeFilter);
            activeMonthBadge = mMatch ? mMatch.fullLabel : state.leadtimeFilter;
        }

        container.innerHTML = `
            <!-- CABEÇALHO DO MÓDULO LEADTIME PRODUTIVO -->
            <div class="module-view-header" style="margin-bottom: 22px;">
                <div class="module-view-title-group">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span class="view-tag-badge" style="background: rgba(16, 185, 129, 0.2); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.4);">
                            <i class="fa-solid fa-stopwatch"></i> SETOR 13
                        </span>
                        <h2 style="font-size: 21px; font-weight: 800; color: #ffffff; margin: 0;">Módulo: LEADTIME PRODUTIVO (MODELAGEM)</h2>
                    </div>
                    <p class="module-view-description" style="font-size: 13px; color: var(--text-muted); margin-top: 4px;">
                        Análise de produtividade e evolução da velocidade da equipe. Quantidade de OFs liberadas por mês (Coluna U - DT_FINAL) e tempo médio decorrido no Setor 13 (Coluna AE - DIAS_REALIZADO).
                    </p>
                </div>
                
                <div class="btn-group" style="flex-wrap: wrap; gap: 8px;">
                    <span class="badge badge-emerald" style="font-size: 12px; padding: 6px 14px;">
                        <i class="fa-solid fa-check-double"></i> ${totalOFsCount} OFs Monitoradas
                    </span>
                    <span class="badge badge-cyan" style="font-size: 12px; padding: 6px 14px;">
                        <i class="fa-solid fa-calendar-days"></i> ${sortedMonths.length} Meses Analisados
                    </span>
                    <a href="https://docs.google.com/spreadsheets/d/14eFcBm3glH1H04dG7UKoLvIXf0QithHrNXnscGxyvdw/edit" target="_blank" class="btn btn-glass" style="font-size: 11.5px; padding: 6px 12px; text-decoration: none; color: #34d399;" title="Abrir planilha 22V no Google Drive">
                        <i class="fa-solid fa-arrow-up-right-from-square"></i> Planilha 22V Drive
                    </a>
                    <button class="btn btn-glass" onclick="window.crmSyncLeadtimeDrive()" style="font-size: 11.5px; padding: 6px 12px;" title="Atualizar dados da planilha do Drive">
                        <i class="fa-solid fa-arrows-rotate"></i> Sincronizar 22V
                    </button>
                    <button class="btn btn-glass" onclick="window.crmOpenLeadtimeImportModal()" style="font-size: 11.5px; padding: 6px 12px; border-color: rgba(16, 185, 129, 0.4); color: #34d399;" title="Importar ou colar dados da planilha 22V">
                        <i class="fa-solid fa-file-import"></i> Colar Dados 22V
                    </button>
                </div>
            </div>

            <!-- CARDS DE KPIS EXECUTIVOS -->
            <div class="leadtime-kpi-grid">
                <div class="leadtime-kpi-card">
                    <div class="leadtime-kpi-icon">
                        <i class="fa-solid fa-gauge-high"></i>
                    </div>
                    <div class="leadtime-kpi-info">
                        <div class="leadtime-kpi-label">Leadtime Médio Geral</div>
                        <div class="leadtime-kpi-value">${overallAvgLeadtime.toFixed(2).replace('.', ',')} <span style="font-size: 14px; font-weight: 600; color: #94a3b8;">dias</span></div>
                        <div class="leadtime-kpi-sub"><i class="fa-solid fa-clock"></i> Soma: ${Math.round(overallTotalDias).toLocaleString('pt-BR')} dias (Col AE)</div>
                    </div>
                </div>

                <div class="leadtime-kpi-card" style="border-color: rgba(56, 189, 248, 0.3);">
                    <div class="leadtime-kpi-icon" style="background: rgba(56, 189, 248, 0.15); color: #38bdf8;">
                        <i class="fa-solid fa-box-check"></i>
                    </div>
                    <div class="leadtime-kpi-info">
                        <div class="leadtime-kpi-label">Total OFs Liberadas</div>
                        <div class="leadtime-kpi-value">${totalOFsCount} <span style="font-size: 14px; font-weight: 600; color: #94a3b8;">OFs</span></div>
                        <div class="leadtime-kpi-sub" style="color: #38bdf8;"><i class="fa-solid fa-cubes"></i> ${totalPecas.toLocaleString('pt-BR')} peças entregues</div>
                    </div>
                </div>

                <div class="leadtime-kpi-card" style="border-color: rgba(245, 158, 11, 0.3);">
                    <div class="leadtime-kpi-icon" style="background: rgba(245, 158, 11, 0.15); color: #fbbf24;">
                        <i class="fa-solid fa-trophy"></i>
                    </div>
                    <div class="leadtime-kpi-info">
                        <div class="leadtime-kpi-label">Mês Mais Rápido</div>
                        <div class="leadtime-kpi-value" style="color: #fbbf24;">${fastestMonth ? fastestMonth.label : '—'} <span style="font-size: 14px; font-weight: 700; color: #ffffff;">(${fastestMonth ? fastestMonth.avgLeadtime.toFixed(1) + 'd' : '—'})</span></div>
                        <div class="leadtime-kpi-sub" style="color: #fbbf24;"><i class="fa-solid fa-bolt"></i> Melhor velocidade da equipe</div>
                    </div>
                </div>
            </div>

            <!-- GRÁFICO GRANDE DE COLUNAS & LINHA DE LEADTIME -->
            <div class="leadtime-chart-card">
                <div class="leadtime-chart-header">
                    <div>
                        <h3 class="leadtime-chart-title">
                            <i class="fa-solid fa-chart-simple" style="color: #34d399;"></i>
                            <span>Volume de OFs Liberadas vs Leadtime Médio (Setor 13) por Mês</span>
                        </h3>
                        <p class="leadtime-chart-subtitle">
                            Colunas Verdes: Quantidade de OFs liberadas (Eixo Esquerdo) | Linha Dourada: Média de Dias no Setor 13 (Eixo Direito)
                        </p>
                    </div>
                    <span class="badge badge-emerald" style="font-size: 11.5px; padding: 4px 10px;">
                        Clique em qualquer coluna para filtrar as OFs
                    </span>
                </div>

                <!-- SVG DUAL-AXIS CHART -->
                <svg viewBox="0 0 ${svgW} ${svgH}" class="leadtime-big-svg">
                    <defs>
                        <!-- Gradiente das Barras de Volume -->
                        <linearGradient id="barGradLT" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stop-color="#10b981" stop-opacity="0.95"/>
                            <stop offset="100%" stop-color="#047857" stop-opacity="0.6"/>
                        </linearGradient>
                        <linearGradient id="barGradLTSelected" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stop-color="#34d399" stop-opacity="1"/>
                            <stop offset="100%" stop-color="#059669" stop-opacity="0.9"/>
                        </linearGradient>
                        <!-- Gradiente da Área sob a Linha de Leadtime -->
                        <linearGradient id="areaGradLT" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stop-color="#f59e0b" stop-opacity="0.25"/>
                            <stop offset="100%" stop-color="#f59e0b" stop-opacity="0.0"/>
                        </linearGradient>
                    </defs>

                    <!-- Linhas de Grade Horizontais -->
                    ${[0, 0.25, 0.5, 0.75, 1].map(frac => {
                        const yValOF = Math.round(yMaxOFs * frac);
                        const yValLT = (yMaxLT * frac).toFixed(1);
                        const yPos = pad.top + drawH - (drawH * frac);
                        return `
                            <line x1="${pad.left}" y1="${yPos}" x2="${svgW - pad.right}" y2="${yPos}" stroke="rgba(255,255,255,0.07)" stroke-dasharray="3 3" />
                            <!-- Eixo Esquerdo: OFs -->
                            <text x="${pad.left - 10}" y="${yPos + 4}" fill="#34d399" font-size="12" font-weight="800" text-anchor="end" font-family="system-ui, sans-serif">${yValOF}</text>
                            <!-- Eixo Direito: Leadtime Dias -->
                            <text x="${svgW - pad.right + 10}" y="${yPos + 4}" fill="#fbbf24" font-size="12" font-weight="800" text-anchor="start" font-family="system-ui, sans-serif">${yValLT} d</text>
                        `;
                    }).join('')}

                    <!-- Linha Base do Eixo X -->
                    <line x1="${pad.left}" y1="${pad.top + drawH}" x2="${svgW - pad.right}" y2="${pad.top + drawH}" stroke="rgba(255,255,255,0.2)" stroke-width="1.5" />

                    <!-- COLUNAS DE OFs LIBERADAS -->
                    ${sortedMonths.map((m, colIdx) => {
                        const colCenterX = pad.left + (colIdx * colSlotW) + (colSlotW / 2);
                        const barX = colCenterX - (barW / 2);
                        const barH = (m.totalOFs / yMaxOFs) * drawH;
                        const barY = pad.top + drawH - barH;
                        const isSelected = state.leadtimeFilter === m.key;

                        return `
                            <g class="leadtime-bar-group" style="cursor: pointer;" onclick="window.crmFilterLeadtime('${m.key}')">
                                <!-- Área de Hover -->
                                <rect x="${pad.left + (colIdx * colSlotW) + 2}" y="${pad.top}" width="${colSlotW - 4}" height="${drawH}" fill="rgba(255,255,255,${isSelected ? '0.08' : '0.01'})" rx="6" />
                                
                                <!-- Barra de Volume -->
                                <rect x="${barX}" y="${barY}" width="${barW}" height="${Math.max(barH, 3)}"
                                    fill="${isSelected ? 'url(#barGradLTSelected)' : 'url(#barGradLT)'}"
                                    rx="5"
                                    filter="${isSelected ? 'drop-shadow(0 0 8px rgba(52,211,153,0.5))' : 'none'}"
                                    style="transition: all 0.25s ease;"
                                >
                                    <title>${m.fullLabel}: ${m.totalOFs} OFs liberadas | Leadtime Médio: ${m.avgLeadtime.toFixed(2).replace('.', ',')} dias</title>
                                </rect>

                                <!-- Rótulo de Quantidade no Topo da Barra com Pill Badge de Alto Contraste -->
                                <g class="of-label-pill">
                                    <rect x="${colCenterX - 18}" y="${barY - 22}" width="36" height="18" rx="4" fill="rgba(6, 78, 59, 0.95)" stroke="#34d399" stroke-width="1.2" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.5))" />
                                    <text x="${colCenterX}" y="${barY - 9}" fill="#ffffff" font-size="12" font-weight="900" text-anchor="middle" font-family="system-ui, sans-serif">
                                        ${m.totalOFs}
                                    </text>
                                </g>

                                <!-- Rótulo do Mês no Eixo X -->
                                <text x="${colCenterX}" y="${pad.top + drawH + 24}" fill="${isSelected ? '#34d399' : '#cbd5e1'}" font-size="13" font-weight="800" text-anchor="middle" font-family="system-ui, sans-serif">
                                    ${m.label}
                                </text>
                                
                                <!-- Indicador de Variação % abaixo do mês -->
                                ${m.pctChange !== null ? `
                                    <text x="${colCenterX}" y="${pad.top + drawH + 42}" fill="${m.isFaster ? '#34d399' : '#f87171'}" font-size="11" font-weight="800" text-anchor="middle" font-family="system-ui, sans-serif">
                                        ${m.isFaster ? '↓' : '↑'} ${Math.abs(m.pctChange).toFixed(0)}%
                                    </text>
                                ` : ''}
                            </g>
                        `;
                    }).join('')}

                    <!-- LINHA DE LEADTIME MÉDIO (DIAS) -->
                    ${linePoints.length > 1 ? `
                        <path d="${linePathD}" fill="none" stroke="#f59e0b" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" filter="drop-shadow(0 0 6px rgba(245,158,11,0.6))" />
                    ` : ''}

                    <!-- PONTOS E RÓTULOS DA LINHA DE LEADTIME (COM POSICIONAMENTO INTELIGENTE ANTI-SOBREPOSIÇÃO) -->
                    ${linePoints.map(pt => {
                        const mBarH = (pt.data.totalOFs / yMaxOFs) * drawH;
                        const mBarY = pad.top + drawH - mBarH;
                        const isClose = Math.abs(pt.y - mBarY) < 38;
                        let badgeY = pt.y - 25;
                        if (isClose) {
                            if (pt.y <= mBarY) {
                                badgeY = pt.y - 35;
                            } else {
                                badgeY = pt.y + 11;
                            }
                        }

                        return `
                            <g style="cursor: pointer;" onclick="window.crmFilterLeadtime('${pt.data.key}')">
                                <!-- Círculo Externo Glow -->
                                <circle cx="${pt.x.toFixed(1)}" cy="${pt.y.toFixed(1)}" r="8" fill="#0f172a" stroke="#f59e0b" stroke-width="3.5" />
                                <circle cx="${pt.x.toFixed(1)}" cy="${pt.y.toFixed(1)}" r="3" fill="#ffffff" />
                                
                                <!-- Badge de Leadtime Médio -->
                                <rect x="${(pt.x - 25).toFixed(1)}" y="${badgeY.toFixed(1)}" width="50" height="20" rx="5" fill="rgba(15,23,42,0.95)" stroke="#f59e0b" stroke-width="1.2" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.6))" />
                                <text x="${pt.x.toFixed(1)}" y="${(badgeY + 14).toFixed(1)}" fill="#fbbf24" font-size="11.5" font-weight="900" text-anchor="middle" font-family="system-ui, sans-serif">
                                    ${pt.data.avgLeadtime.toFixed(2).replace('.', ',')} d
                                </text>
                            </g>
                        `;
                    }).join('')}

                    <!-- Rótulos dos Eixos -->
                    <text x="${pad.left}" y="${pad.top - 18}" fill="#34d399" font-size="13" font-weight="800" text-anchor="start" font-family="system-ui, sans-serif">
                        ← QTD OFs LIBERADAS
                    </text>
                    <text x="${svgW - pad.right}" y="${pad.top - 18}" fill="#fbbf24" font-size="13" font-weight="800" text-anchor="end" font-family="system-ui, sans-serif">
                        LEADTIME MÉDIO (DIAS) →
                    </text>
                </svg>

                <!-- LEGENDA DO GRÁFICO -->
                <div class="leadtime-legend-bar">
                    <div class="leadtime-legend-item">
                        <span class="leadtime-legend-box" style="background: linear-gradient(135deg, #10b981, #047857);"></span>
                        <span>OFs Liberadas no Mês (Coluna A agrupada por Coluna AA - REALIZADO_FIM)</span>
                    </div>
                    <div class="leadtime-legend-item">
                        <span class="leadtime-legend-line" style="background: #f59e0b;"></span>
                        <span>Tempo Médio no Setor 13 (Coluna AE - DIAS_REALIZADO)</span>
                    </div>
                </div>

                <!-- OBSERVAÇÃO TÉCNICA / OPERACIONAL -->
                <div style="margin-top: 18px; padding: 12px 18px; background: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.25); border-left: 4px solid #f59e0b; border-radius: 8px; display: flex; align-items: flex-start; gap: 12px;">
                    <i class="fa-solid fa-circle-exclamation" style="color: #fbbf24; font-size: 16px; margin-top: 2px; flex-shrink: 0;"></i>
                    <div style="font-size: 12.5px; color: #cbd5e1; line-height: 1.55;">
                        <strong style="color: #fbbf24; font-weight: 700;">Observação:</strong>
                        Pedido <strong style="font-family: monospace; color: #ffffff; background: rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 4px;">074240</strong> ficou <strong>240 dias pendente</strong> até ser cancelado / produtos sem OC ficam pendentes nesse setor servindo como trava.
                    </div>
                </div>
            </div>

            <!-- BARRA DE CONTROLES E BUSCA DA TABELA -->
            <div class="filter-toolbar" style="margin-bottom: 16px;">
                <div class="filter-toolbar-left" style="width: 100%; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;">
                    <!-- Input de Busca -->
                    <div class="search-input-wrapper" style="max-width: 380px; width: 100%;">
                        <i class="fa-solid fa-magnifying-glass search-icon"></i>
                        <input 
                            type="text" 
                            class="search-input" 
                            placeholder="Buscar por OF, Código, Descrição, Coleção, Data Final..." 
                            value="${state.leadtimeSearch || ''}"
                            oninput="window.crmSearchLeadtime(this.value)"
                        />
                        ${state.leadtimeSearch ? `
                            <button class="search-clear-btn" onclick="window.crmSearchLeadtime('')" title="Limpar busca">&times;</button>
                        ` : ''}
                    </div>

                    <!-- Filtros Rápidos por Mês -->
                    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                        <button class="exec-action-btn ${!state.leadtimeFilter ? 'active' : ''}" onclick="window.crmFilterLeadtime(null)" title="Ver todas as OFs">
                            Todos os Meses (${totalOFsCount})
                        </button>

                        ${activeMonthBadge ? `
                            <span class="badge badge-emerald" style="font-size: 11.5px; padding: 5px 10px; display: flex; align-items: center; gap: 6px;">
                                <i class="fa-solid fa-filter"></i> Mês: ${activeMonthBadge}
                                <i class="fa-solid fa-xmark" style="cursor: pointer;" onclick="window.crmFilterLeadtime(null)" title="Limpar filtro de mês"></i>
                            </span>
                        ` : ''}
                    </div>
                </div>
            </div>

            <!-- TABELA DETALHADA DE OFs LIBERADAS -->
            <div class="table-card" style="border-top: 3px solid #10b981; margin-bottom: 24px;">
                <div class="table-toolbar" style="border-bottom: 1px solid rgba(16, 185, 129, 0.2); justify-content: space-between;">
                    <div class="table-title-group">
                        <h3 class="table-title" style="display: flex; align-items: center; gap: 8px; color: #ffffff;">
                            <i class="fa-solid fa-table-list" style="color: #34d399;"></i>
                            <span>Listagem de OFs Liberadas no Setor 13 (22V)</span>
                        </h3>
                        <span class="badge badge-sub">${filteredRecords.length} OFs exibidas</span>
                    </div>
                </div>

                <div class="table-responsive">
                    <table class="crm-table">
                        <thead>
                            <tr>
                                <th>OF (Col A)</th>
                                <th>Código Produto</th>
                                <th>Descrição do Produto</th>
                                <th>Coleção</th>
                                <th>Data Liberação (Col AA - REALIZADO_FIM)</th>
                                <th>Mês / Período</th>
                                <th>Tempo Setor 13 (Col AE - DIAS_REALIZADO)</th>
                                <th>Qtde Peças</th>
                                <th>Responsável</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${filteredRecords.length === 0 ? `
                                <tr>
                                    <td colspan="10" style="text-align: center; padding: 36px; color: var(--text-muted);">
                                        Nenhuma OF encontrada para os filtros selecionados.
                                    </td>
                                </tr>
                            ` : filteredRecords.map(item => {
                                const diasBadgeClass = item.diasRealizado <= 3 ? 'badge-emerald' : (item.diasRealizado <= 6 ? 'badge-amber' : 'badge-rose');
                                return `
                                    <tr>
                                        <td style="font-family: monospace; font-weight: 800; color: #34d399;">${item.op}</td>
                                        <td style="font-family: monospace; font-weight: 700; color: #ffffff;">${item.codigo}</td>
                                        <td style="color: #e2e8f0; font-weight: 600;">${item.produtoDesc}</td>
                                        <td style="font-size: 12px; color: #94a3b8;">${item.colecao}</td>
                                        <td style="font-weight: 700; color: #38bdf8;">${item.dtFinal}</td>
                                        <td>
                                            <span class="badge badge-purple" style="font-weight: 800; cursor: pointer;" onclick="window.crmFilterLeadtime('${item.monthKey}')" title="Filtrar mês ${item.monthLabel}">
                                                ${item.monthLabel}
                                            </span>
                                        </td>
                                        <td>
                                            <span class="badge ${diasBadgeClass}" style="font-weight: 800; font-size: 12px;">
                                                <i class="fa-solid fa-clock"></i> ${item.diasRealizado} ${item.diasRealizado === 1 ? 'dia' : 'dias'}
                                            </span>
                                        </td>
                                        <td style="font-weight: 700; color: #f8fafc; font-family: monospace;">${item.qtde}</td>
                                        <td style="font-size: 12px; color: #cbd5e1; font-weight: 600;">${item.responsavel}</td>
                                        <td>
                                            <span class="badge badge-emerald">${item.status}</span>
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }


    // =========================================================================
    // 7. MÓDULO ESTILO AMOSTRAS - FEIRA & PROTÓTIPOS (FLUXO D36)
    // =========================================================================
    function renderProgFeiraView(container) {
        const source = state.progFeiraExternalData || { records: [], isLive: false, timestamp: null };
        const api = window.CRMProgFeira;
        if (!api) {
            container.innerHTML = '<div class="empty-state"><h3>Módulo Prog Feira indisponível</h3><p>Atualize a página para carregar os componentes do módulo.</p></div>';
            return;
        }

        const allProducts = api.buildProducts(source.records || []);
        const search = String(state.progFeiraSearch || '').trim().toLowerCase();
        const products = allProducts.filter(item => {
            if (state.progFeiraSector !== 'all' && item.sector !== state.progFeiraSector) return false;
            if (state.progFeiraTing !== 'all' && item.ting !== state.progFeiraTing) return false;
            if (state.progFeiraDesOnly && !item.isDes) return false;
            if (!search) return true;
            return [item.codigo, item.numero, item.sector, item.sectorLabel, item.program, item.prints, item.notes]
                .some(value => String(value || '').toLowerCase().includes(search));
        });
        const groups = api.groupBySector(products);
        const desCount = allProducts.filter(item => item.isDes).length;
        const readyCount = allProducts.filter(item => item.sector === '01F').length;
        const cancelledCount = allProducts.filter(item => item.sector === '01Z').length;
        const currentSectors = api.groupBySector(allProducts);
        const syncText = source.timestamp
            ? new Date(source.timestamp).toLocaleString('pt-BR')
            : 'ainda não sincronizado';

        const renderImage = item => {
            const info = getProductImage(item.imageCode || item.codigo, item.numero);
            if (!info.hasImage) {
                return `<div class="prog-feira-image-empty"><i class="fa-solid fa-shirt"></i><span>Sem imagem mapeada</span></div>`;
            }
            const title = escapeHtml(item.codigo);
            const subtitle = escapeHtml(`OP ${item.numero || '—'} • ${item.sector} • Entrega ${item.delivery || '—'}`);
            return `<img class="prog-feira-image js-prog-feira-image" src="${escapeHtml(info.thumbUrl)}" alt="Produto ${title}" loading="lazy" decoding="async" data-fallback-src="${escapeHtml(info.proxyUrl || '')}" data-large-url="${escapeHtml(info.largeUrl || info.thumbUrl)}" data-image-title="${title}" data-image-subtitle="${subtitle}" data-large-fallback="${escapeHtml(info.largeFallbackUrl || '')}">`;
        };

        const renderHistory = item => {
            if (!item.history.length) return '<span class="prog-feira-history-empty">Histórico ainda não informado</span>';
            return item.history.map(step => `
                <span class="prog-feira-history-step ${step.pending ? 'current' : 'done'}" title="${escapeHtml(step.label || step.sector)}">
                    <strong>${escapeHtml(step.sector)}</strong><small>${escapeHtml(step.date || '—')}</small>
                </span>
            `).join('');
        };

        const renderProductCard = item => `
            <article class="prog-feira-card" style="--ting-color:${item.tingInfo.color}">
                ${item.isDes ? '<div class="prog-feira-des-ribbon"><i class="fa-solid fa-calculator"></i> DES • CUSTO PENDENTE</div>' : ''}
                <div class="prog-feira-card-top"><span>${escapeHtml(item.codigo)}</span><span>OP ${escapeHtml(item.numero || '—')}</span></div>
                <div class="prog-feira-media">${renderImage(item)}<div class="prog-feira-delivery"><small>ENTREGA</small><strong>${escapeHtml(item.delivery || '—')}</strong></div></div>
                <div class="prog-feira-card-body">
                    <div class="prog-feira-status-row"><span class="prog-feira-sector-badge">${escapeHtml(item.sector)} • ${escapeHtml(item.sectorLabel)}</span><span class="prog-feira-ting-badge" style="--ting-color:${item.tingInfo.color}">${escapeHtml(item.ting)} • ${escapeHtml(item.tingInfo.label)}</span></div>
                    <div class="prog-feira-days ${item.daysInSector == null ? 'unknown' : item.daysInSector > 2 ? 'late' : ''}"><i class="fa-regular fa-clock"></i> ${item.daysInSector == null ? 'Data de entrada não informada' : `<strong>${formatNumber(item.daysInSector)}</strong> ${item.daysInSector === 1 ? 'dia' : 'dias'} no setor atual`}</div>
                    ${item.program ? `<div class="prog-feira-program"><i class="fa-solid fa-layer-group"></i>${escapeHtml(item.program)}</div>` : ''}
                    <dl><div><dt>Movimentação</dt><dd>${escapeHtml(item.movementDate || '—')}</dd></div><div><dt>Estampas</dt><dd>${escapeHtml(item.prints || '—')}</dd></div><div><dt>Observação</dt><dd>${escapeHtml(item.notes || '—')}</dd></div><div><dt>Quantidade pendente</dt><dd>${formatNumber(item.quantity)}</dd></div></dl>
                    <details class="prog-feira-history"><summary><i class="fa-solid fa-timeline"></i> Histórico do fluxo</summary><div>${renderHistory(item)}</div></details>
                </div>
            </article>
        `;

        const renderSectorPages = group => {
            const pages = [];
            for (let index = 0; index < group.items.length; index += 8) {
                pages.push(group.items.slice(index, index + 8));
            }
            return pages.map((items, pageIndex) => `
                <section class="prog-feira-sector prog-feira-print-page" data-sector="${escapeHtml(group.sector)}">
                    <header><div><strong>${escapeHtml(group.sector)}</strong><span>${escapeHtml(group.label)}${pageIndex ? ' • continuação' : ''}</span></div><em>${group.items.length} ${group.items.length === 1 ? 'referência' : 'referências'} • ${allProducts.length ? ((group.items.length / allProducts.length) * 100).toFixed(1).replace('.', ',') : '0'}%</em></header>
                    <div class="prog-feira-grid">${items.map(renderProductCard).join('')}</div>
                </section>
            `).join('');
        };

        container.innerHTML = `
            <section class="prog-feira-view">
                <div class="module-view-header prog-feira-header">
                    <div class="module-view-title-group">
                        <h2><i class="fa-solid fa-route"></i> Prog Feira</h2>
                        <p class="module-view-description">Andamento das amostras com entrega, tingimento e pendência de custo em visão paralela.</p>
                    </div>
                    <div class="prog-feira-header-actions">
                        <span class="prog-feira-source ${source.isLive === false ? 'cached' : ''}"><i class="fa-solid fa-cloud"></i> ${source.isLive === false ? 'Cache local' : 'Planilha ao vivo'} • ${escapeHtml(syncText)}</span>
                        <a class="btn btn-glass" href="https://docs.google.com/spreadsheets/d/1VdgVNsnz5HTeoCO2pRseXkvgbVcIDxc9u1zrIVLrv1s/edit" target="_blank" rel="noopener"><i class="fa-brands fa-google-drive"></i> Abrir planilha</a>
                        <button class="btn btn-primary" onclick="window.crmSyncProgFeira()"><i class="fa-solid fa-arrows-rotate"></i> Atualizar</button>
                    </div>
                </div>

                <div class="prog-feira-kpis">
                    <article><span>Referências ativas</span><strong>${formatNumber(allProducts.length - cancelledCount)}</strong><small>${formatNumber(allProducts.length)} no relatório</small></article>
                    <article><span>Setores com pendência</span><strong>${formatNumber(currentSectors.length)}</strong><small>Fluxo D36</small></article>
                    <article class="des"><span>Pendentes em custo DES</span><strong>${formatNumber(desCount)}</strong><small>Identificados pela tarja azul</small></article>
                    <article class="ready"><span>Peças prontas</span><strong>${formatNumber(readyCount)}</strong><small>Setor 01F</small></article>
                </div>

                <div class="prog-feira-flow" aria-label="Fluxo de desenvolvimento de amostras">
                    ${api.FLOW.map(step => {
                        const count = allProducts.filter(item => item.sector === step.code).length;
                        return `<button class="prog-feira-flow-step ${state.progFeiraSector === step.code ? 'active' : ''}" onclick="window.crmFilterProgFeiraSector('${step.code}')" title="Filtrar ${escapeHtml(step.label)}"><strong>${step.code}</strong><span>${escapeHtml(step.label)}</span><em>${count}</em></button>`;
                    }).join('')}
                </div>

                <div class="prog-feira-toolbar">
                    <label class="prog-feira-search"><i class="fa-solid fa-magnifying-glass"></i><input type="search" value="${escapeHtml(state.progFeiraSearch)}" placeholder="Buscar produto, OP, programação, estampa ou observação..." oninput="window.crmSearchProgFeira(this.value)"></label>
                    <select onchange="window.crmFilterProgFeiraSector(this.value)" aria-label="Filtrar setor"><option value="all">Todos os setores</option>${currentSectors.map(group => `<option value="${escapeHtml(group.sector)}" ${state.progFeiraSector === group.sector ? 'selected' : ''}>${escapeHtml(group.sector)} — ${escapeHtml(group.label)} (${group.items.length})</option>`).join('')}</select>
                    <select onchange="window.crmFilterProgFeiraTing(this.value)" aria-label="Filtrar tingimento"><option value="all">Todos os tingimentos</option>${Object.entries(api.TINGIMENTO).map(([code, info]) => `<option value="${code}" ${state.progFeiraTing === code ? 'selected' : ''}>${code} — ${escapeHtml(info.label)}</option>`).join('')}</select>
                    <button class="filter-chip ${state.progFeiraDesOnly ? 'active' : ''}" onclick="window.crmToggleProgFeiraDes()"><span class="prog-feira-blue-dot"></span> Somente custo DES (${desCount})</button>
                    ${(state.progFeiraSector !== 'all' || state.progFeiraTing !== 'all' || state.progFeiraDesOnly || search) ? '<button class="filter-clear-btn" onclick="window.crmClearProgFeiraFilters()"><i class="fa-solid fa-xmark"></i> Limpar</button>' : ''}
                </div>

                <div class="prog-feira-legend">
                    <strong>Cor da borda:</strong>${Object.entries(api.TINGIMENTO).map(([code, info]) => `<span><i style="background:${info.color}"></i>${code} — ${escapeHtml(info.label)}</span>`).join('')}
                    <span class="prog-feira-legend-des"><i></i> Tarja azul — custo pendente em DES</span>
                </div>

                ${groups.length ? groups.map(renderSectorPages).join('') : `
                    <div class="empty-state"><i class="fa-solid fa-filter-circle-xmark"></i><h3>Nenhuma referência encontrada</h3><p>${allProducts.length ? 'Ajuste ou limpe os filtros aplicados.' : 'A planilha ainda não forneceu produtos válidos. Clique em Atualizar.'}</p></div>
                `}
            </section>
        `;

        container.querySelectorAll('.js-prog-feira-image').forEach(image => {
            image.addEventListener('error', () => {
                if (image.dataset.fallback !== '1' && image.dataset.fallbackSrc) {
                    image.dataset.fallback = '1';
                    image.src = image.dataset.fallbackSrc;
                    return;
                }
                image.closest('.prog-feira-media')?.classList.add('image-unavailable');
            });
            image.addEventListener('click', () => window.crmOpenImageLightbox(
                image.dataset.largeUrl || image.src,
                image.dataset.imageTitle || '',
                image.dataset.imageSubtitle || '',
                image.dataset.largeFallback || ''
            ));
        });
    }

    function renderFeiraView(container) {
        // Regra do Usuário:
        // - trazer APENAS os produtos que estão no fluxo D36 (coluna AX)
        // - ordenação dos setores conforme fluxo:
        //   01A, 01B, 1B2, 02A, 02B, 02E, 02M, 01C, 01E, 1E2, 02C, 100!
        // - layout inspirado no dashboard executivo moderno (Today's Sales, Level, Top Products, Fulfilment, Gauge, Insights)
        // - manter a cartela de cores corporativa escura atual!
        const d36Items = state.filteredData.filter(r => (r.fluxo === 'D36' || (r.descFluxo || '').toUpperCase().includes('D36')));
        const totalItems = d36Items.length;
        const totalPecas = d36Items.reduce((acc, r) => acc + r.qtdeOriginal, 0);
        const mediaGeralDias = totalItems > 0 ? Math.round(d36Items.reduce((acc, r) => acc + r.diasParado, 0) / totalItems) : 0;

        // Sequência OFICIAL do Fluxo D36 definida pelo Usuário:
        // 01A, 01B, 1B2, 02A, 02B, 02E, 02M, 01C, 01E, 1E2, 02C, 100
        const FLOW_SEQUENCE = [
            { code: '01A', name: 'Pré-Cadastramento / Desenho', short: 'Pré-Cad.', color: '#f59e0b' },
            { code: '01B', name: 'Estilo / Criação', short: 'Estilo', color: '#ef4444' },
            { code: '1B2', name: 'Estilo 2 / Revisão Modelo', short: 'Estilo 2', color: '#64748b' },
            { code: '02A', name: 'Modelagem de Amostras', short: 'Modelagem', color: '#64748b' },
            { code: '02B', name: 'Corte de Amostras', short: 'Corte Amostra', color: '#0ea5e9' },
            { code: '02E', name: 'Preparação / Estamparia Inicial', short: 'Prep. Amostra', color: '#64748b' },
            { code: '02M', name: 'Costura Externa / Retoque', short: 'Costura Ext.', color: '#8b5cf6' },
            { code: '01C', name: 'Desenho & Arte Final', short: 'Arte Final', color: '#10b981' },
            { code: '01E', name: 'Estamparia de Amostras', short: 'Estamparia', color: '#ec4899' },
            { code: '1E2', name: 'Estamparia 2 / Silk / Sublimação', short: 'Estampa 2', color: '#64748b' },
            { code: '02C', name: 'Costura de Amostras', short: 'Costura Amostra', color: '#38bdf8' },
            { code: '100', name: 'Bordado de Amostras', short: 'Bordado', color: '#6366f1' }
        ];

        // Mapeamento dinâmico dos dados por setor
        const sectorDataMap = {};
        d36Items.forEach(item => {
            const s = item.setor || 'Sem Setor';
            if (!sectorDataMap[s]) {
                sectorDataMap[s] = {
                    code: s,
                    count: 0,
                    pecas: 0,
                    totalDias: 0,
                    maxDias: 0,
                    items: []
                };
            }
            sectorDataMap[s].count += 1;
            sectorDataMap[s].pecas += item.qtdeOriginal;
            sectorDataMap[s].totalDias += item.diasParado;
            if (item.diasParado > sectorDataMap[s].maxDias) {
                sectorDataMap[s].maxDias = item.diasParado;
            }
            sectorDataMap[s].items.push(item);
        });

        // Montar a lista completa na ordem do fluxo
        const flowStats = FLOW_SEQUENCE.map(stage => {
            const data = sectorDataMap[stage.code] || { count: 0, pecas: 0, totalDias: 0, maxDias: 0, items: [] };
            const mediaDias = data.count > 0 ? Math.round(data.totalDias / data.count) : 0;
            return {
                ...stage,
                count: data.count,
                pecas: data.pecas,
                mediaDias: mediaDias,
                maxDias: data.maxDias,
                items: data.items,
                pctTotal: totalItems > 0 ? ((data.count / totalItems) * 100).toFixed(1) : '0'
            };
        });

        // Setores ativos com produtos (para gráficos de volume e lead time)
        const activeFlowStats = flowStats.filter(s => s.count > 0);
        const maxFlowCount = Math.max(...activeFlowStats.map(s => s.count), 1);
        const gargaloSetor = activeFlowStats.reduce((prev, curr) => (curr.mediaDias > (prev ? prev.mediaDias : 0) ? curr : prev), null);

        // Métricas para o Gauge de Eficiência (≤ 20 dias no setor = dentro da meta de desenvolvimento)
        const dentroPrazoCount = d36Items.filter(r => r.diasParado <= 20).length;
        const dentroPrazoPct = totalItems > 0 ? Math.round((dentroPrazoCount / totalItems) * 100) : 100;
        const gaugeCircumference = Math.PI * 48; // ~150.8
        const gaugeOffset = gaugeCircumference * (1 - (dentroPrazoPct / 100));

        // Filtragem para a tabela inferior
        let displayItems = d36Items;
        let activeFilterLabel = null;
        if (state.feiraSectorFilter) {
            displayItems = d36Items.filter(r => r.setor === state.feiraSectorFilter);
            const foundStage = FLOW_SEQUENCE.find(s => s.code === state.feiraSectorFilter);
            activeFilterLabel = `Setor ${state.feiraSectorFilter} (${foundStage ? foundStage.name : ''})`;
        }

        container.innerHTML = `
            <!-- CABEÇALHO DO MÓDULO -->
            <div class="module-view-header" style="margin-bottom: 20px;">
                <div class="module-view-title-group">
                    <h2 style="font-size: 22px; font-weight: 800; color: var(--text-primary);">Feira & Protótipos (Fluxo D36)</h2>
                    <p class="module-view-description" style="font-size: 13px; color: var(--text-muted); margin-top: 4px;">
                        Pipeline sequencial de desenvolvimento de amostras do <strong>Fluxo D36</strong>, ordenado da criação à costura final.
                    </p>
                </div>
                <div class="btn-group">
                    <span class="badge badge-pink" style="font-size: 12px; padding: 6px 14px;">Fluxo D36 • Mostruários</span>
                    <button class="toolbar-pill-btn btn-export-pdf" onclick="window.crmGeneratePDFReport()" title="Gerar Relatório em PDF">
                        <i class="fa-solid fa-file-pdf" style="color: #ef4444;"></i> Gerar PDF
                    </button>
                </div>
            </div>

            <!-- CONTAINER PRINCIPAL DO DASHBOARD (INSPIRADO NO LAYOUT DO USUÁRIO) -->
            <div class="feira-dashboard-container">

                <!-- 1. LINHA SUPERIOR: TODAY'S SALES EQUIVALENT + LEVEL -->
                <div class="feira-grid-row">
                    <!-- TOP LEFT: RESUMO EXECUTIVO DO FLUXO (4 MINI CARDS) -->
                    <div class="feira-card">
                        <div class="feira-card-header">
                            <div class="feira-card-title-group">
                                <div class="feira-card-title">
                                    <i class="fa-solid fa-vest-patches" style="color: #ec4899;"></i>
                                    <span>Resumo Geral do Fluxo D36</span>
                                </div>
                                <div class="feira-card-subtitle">Indicadores consolidados das peças-piloto em andamento</div>
                            </div>
                            <span class="badge badge-sub" style="font-size: 11px;">88 OPs</span>
                        </div>

                        <div class="feira-kpi-subgrid">
                            <!-- Mini Card 1: Protótipos (Amber) -->
                            <div class="feira-kpi-mini-card">
                                <div class="feira-kpi-icon-box amber">
                                    <i class="fa-solid fa-shirt"></i>
                                </div>
                                <div class="feira-kpi-mini-val">${totalItems}</div>
                                <div class="feira-kpi-mini-label">Total Protótipos</div>
                                <div class="feira-kpi-mini-sub positive">
                                    <i class="fa-solid fa-circle-check"></i> 100% Fluxo D36
                                </div>
                            </div>

                            <!-- Mini Card 2: Peças (Cyan) -->
                            <div class="feira-kpi-mini-card">
                                <div class="feira-kpi-icon-box cyan">
                                    <i class="fa-solid fa-boxes-stacked"></i>
                                </div>
                                <div class="feira-kpi-mini-val">${formatNumber(totalPecas)}</div>
                                <div class="feira-kpi-mini-label">Peças em Piloto</div>
                                <div class="feira-kpi-mini-sub">
                                    <i class="fa-solid fa-layer-group"></i> Grade completa
                                </div>
                            </div>

                            <!-- Mini Card 3: Média de Dias (Pink) -->
                            <div class="feira-kpi-mini-card">
                                <div class="feira-kpi-icon-box pink">
                                    <i class="fa-solid fa-clock-rotate-left"></i>
                                </div>
                                <div class="feira-kpi-mini-val">${mediaGeralDias}d</div>
                                <div class="feira-kpi-mini-label">Média no Setor</div>
                                <div class="feira-kpi-mini-sub">
                                    <i class="fa-solid fa-stopwatch"></i> Ciclo de amostra
                                </div>
                            </div>

                            <!-- Mini Card 4: Gargalo Crítico (Purple/Alert) -->
                            <div class="feira-kpi-mini-card">
                                <div class="feira-kpi-icon-box purple">
                                    <i class="fa-solid fa-triangle-exclamation"></i>
                                </div>
                                <div class="feira-kpi-mini-val" style="font-size: 20px;">${gargaloSetor ? 'Setor ' + gargaloSetor.code : '--'}</div>
                                <div class="feira-kpi-mini-label">Ponto Crítico</div>
                                <div class="feira-kpi-mini-sub alert">
                                    <i class="fa-solid fa-fire"></i> Méd: ${gargaloSetor ? gargaloSetor.mediaDias : 0}d (Máx: ${gargaloSetor ? gargaloSetor.maxDias : 0}d)
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- TOP RIGHT: LEVEL (NÍVEL DO FLUXO POR ETAPA) -->
                    <div class="feira-card">
                        <div class="feira-card-header">
                            <div class="feira-card-title-group">
                                <div class="feira-card-title">
                                    <i class="fa-solid fa-chart-simple" style="color: #38bdf8;"></i>
                                    <span>Nível do Fluxo (Level)</span>
                                </div>
                                <div class="feira-card-subtitle">Distribuição por etapa do fluxo em ordem sequencial</div>
                            </div>
                        </div>

                        <!-- SVG do Gráfico de Nível / Barras Verticais Limpas -->
                        <svg viewBox="0 0 360 145" class="feira-level-svg">
                            <defs>
                                <linearGradient id="levelBarCyan" x1="0%" y1="0%" x2="0%" y2="100%">
                                    <stop offset="0%" stop-color="#38bdf8" />
                                    <stop offset="100%" stop-color="#0284c7" />
                                </linearGradient>
                                <linearGradient id="levelBarPink" x1="0%" y1="0%" x2="0%" y2="100%">
                                    <stop offset="0%" stop-color="#ec4899" />
                                    <stop offset="100%" stop-color="#be185d" />
                                </linearGradient>
                            </defs>

                            <!-- Linha base -->
                            <line x1="20" y1="110" x2="340" y2="110" stroke="rgba(255,255,255,0.08)" stroke-width="1" />

                            ${activeFlowStats.map((s, idx) => {
                                const colW = 320 / activeFlowStats.length;
                                const xCenter = 25 + idx * colW + colW / 2;
                                const barH = Math.max(10, (s.count / maxFlowCount) * 72);
                                const yBar = 110 - barH;
                                const diasH = Math.min(72, (s.mediaDias / 46) * 72);
                                const yDias = 110 - diasH;
                                const isSelected = state.feiraSectorFilter === s.code;

                                return `
                                    <g style="cursor: pointer;" onclick="window.crmFilterFeiraSector('${s.code}')">
                                        <!-- Barra de Volume (Cyan) -->
                                        <rect x="${xCenter - 10}" y="${yBar}" width="10" height="${barH}" rx="3" fill="url(#levelBarCyan)" opacity="${isSelected ? '1' : '0.85'}" />
                                        
                                        <!-- Barra de Dias (Pink) -->
                                        <rect x="${xCenter + 2}" y="${yDias}" width="8" height="${diasH}" rx="3" fill="url(#levelBarPink)" opacity="${isSelected ? '1' : '0.6'}" />

                                        <!-- Rótulo de Contagem -->
                                        <text x="${xCenter}" y="${yBar - 6}" text-anchor="middle" font-size="11" font-weight="800" fill="#ffffff" font-family="system-ui">${s.count}</text>

                                        <!-- Código do Setor no Eixo X -->
                                        <text x="${xCenter}" y="126" text-anchor="middle" font-size="11" font-weight="700" fill="${isSelected ? '#38bdf8' : '#94a3b8'}" font-family="system-ui">${s.code}</text>
                                    </g>
                                `;
                            }).join('')}
                        </svg>

                        <div class="feira-chart-legend">
                            <div class="feira-legend-item">
                                <span class="feira-legend-dot" style="background: #38bdf8;"></span>
                                <span>Volume (Protótipos)</span>
                            </div>
                            <div class="feira-legend-item">
                                <span class="feira-legend-dot" style="background: #ec4899;"></span>
                                <span>Média de Dias no Setor</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 2. LINHA DO MEIO: TOP PRODUCTS STYLE (RANKING DO FLUXO) + FULFILMENT AREA CHART -->
                <div class="feira-grid-row">
                    <!-- MIDDLE LEFT: ETAPAS DO FLUXO (INSPIRADO NO "TOP PRODUCTS") -->
                    <div class="feira-card">
                        <div class="feira-card-header">
                            <div class="feira-card-title-group">
                                <div class="feira-card-title">
                                    <i class="fa-solid fa-list-ol" style="color: #f59e0b;"></i>
                                    <span>Etapas do Fluxo D36 (Sequência Oficial)</span>
                                </div>
                                <div class="feira-card-subtitle">Ordenação sequencial das etapas de fabricação de amostras</div>
                            </div>
                            ${state.feiraSectorFilter ? `
                                <button class="filter-clear-btn" onclick="window.crmFilterFeiraSector(null)" style="padding: 2px 8px; font-size: 11px;">
                                    <i class="fa-solid fa-xmark"></i> Limpar Filtro
                                </button>
                            ` : ''}
                        </div>

                        <div style="overflow-x: auto;">
                            <table class="feira-flow-ranking-table">
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>Etapa / Setor do Fluxo</th>
                                        <th>Permanência Média</th>
                                        <th style="text-align: right;">Volume / Share</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${flowStats.map((s, idx) => {
                                        const numStr = (idx + 1).toString().padStart(2, '0');
                                        const isSelected = state.feiraSectorFilter === s.code;
                                        const barWidthPct = s.count > 0 ? Math.max(8, Math.round((s.count / maxFlowCount) * 100)) : 0;
                                        const hasWarning = s.mediaDias > 20;

                                        return `
                                            <tr class="feira-flow-ranking-row ${isSelected ? 'active' : ''}" onclick="window.crmFilterFeiraSector('${s.code}')" title="Clique para filtrar produtos do Setor ${s.code}">
                                                <td class="flow-rank-num">${numStr}</td>
                                                <td>
                                                    <div class="flow-stage-info">
                                                        <span class="flow-stage-code" style="color: ${s.count > 0 ? s.color : '#64748b'};">${s.code}</span>
                                                        <span class="flow-stage-name">${s.name}</span>
                                                    </div>
                                                </td>
                                                <td class="flow-progress-cell">
                                                    <div style="display: flex; align-items: center; gap: 8px;">
                                                        <div class="flow-progress-bar-bg">
                                                            <div class="flow-progress-fill" style="width: ${barWidthPct}%; background: ${s.color};"></div>
                                                        </div>
                                                        <span style="font-size: 11px; font-weight: 700; color: ${hasWarning ? '#fca5a5' : '#cbd5e1'}; min-width: 48px; text-align: right;">
                                                            ${s.count > 0 ? s.mediaDias + 'd' : '0d'}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td style="text-align: right;">
                                                    <span class="flow-share-badge" style="border-color: ${s.count > 0 ? s.color + '44' : 'rgba(255,255,255,0.06)'}; color: ${s.count > 0 ? '#ffffff' : '#64748b'};">
                                                        ${s.count} prod (${s.pctTotal}%)
                                                    </span>
                                                </td>
                                            </tr>
                                        `;
                                    }).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <!-- MIDDLE RIGHT: CUSTOMER FULFILMENT (CURVA DE LEAD TIME & RETENÇÃO) -->
                    <div class="feira-card">
                        <div class="feira-card-header">
                            <div class="feira-card-title-group">
                                <div class="feira-card-title">
                                    <i class="fa-solid fa-wave-square" style="color: #ec4899;"></i>
                                    <span>Curva de Retenção & Fulfilment</span>
                                </div>
                                <div class="feira-card-subtitle">Volume de protótipos vs dias médios ao longo do fluxo</div>
                            </div>
                        </div>

                        <!-- SVG Dual Spline Area Chart (Inspirado no Customer Fulfilment) -->
                        <svg viewBox="0 0 420 185" class="feira-fulfilment-svg">
                            <defs>
                                <linearGradient id="fulfilPinkArea" x1="0%" y1="0%" x2="0%" y2="100%">
                                    <stop offset="0%" stop-color="#ec4899" stop-opacity="0.38" />
                                    <stop offset="100%" stop-color="#ec4899" stop-opacity="0.02" />
                                </linearGradient>
                            </defs>

                            <!-- Linhas de Apoio Sutis -->
                            <line x1="20" y1="140" x2="400" y2="140" stroke="rgba(255,255,255,0.05)" stroke-width="1" />
                            <line x1="20" y1="80" x2="400" y2="80" stroke="rgba(255,255,255,0.04)" stroke-dasharray="3 3" />
                            <line x1="20" y1="20" x2="400" y2="20" stroke="rgba(255,255,255,0.04)" stroke-dasharray="3 3" />

                            <!-- Área Rosa Preenchida da Curva de Dias Médios (Pico no Setor 01B) -->
                            <path d="M 30,126 Q 78,35 125,115 T 220,130 T 315,122 T 390,120 L 390,150 L 30,150 Z" fill="url(#fulfilPinkArea)" />

                            <!-- Linha Rosa (Curva de Dias Médios) com Marcadores -->
                            <path d="M 30,126 Q 78,35 125,115 T 220,130 T 315,122 T 390,120" fill="none" stroke="#ec4899" stroke-width="2.5" />
                            <circle cx="30" cy="126" r="3.5" fill="#ec4899" stroke="#ffffff" stroke-width="1.5" />
                            <circle cx="82" cy="40" r="4.5" fill="#ef4444" stroke="#ffffff" stroke-width="2" />
                            <circle cx="132" cy="115" r="3.5" fill="#ec4899" stroke="#ffffff" stroke-width="1.5" />
                            <circle cx="180" cy="124" r="3.5" fill="#ec4899" stroke="#ffffff" stroke-width="1.5" />
                            <circle cx="230" cy="132" r="3.5" fill="#ec4899" stroke="#ffffff" stroke-width="1.5" />
                            <circle cx="280" cy="122" r="3.5" fill="#ec4899" stroke="#ffffff" stroke-width="1.5" />
                            <circle cx="330" cy="125" r="3.5" fill="#ec4899" stroke="#ffffff" stroke-width="1.5" />
                            <circle cx="380" cy="120" r="3.5" fill="#ec4899" stroke="#ffffff" stroke-width="1.5" />

                            <!-- Linha Ciano Superior (Curva de Volume) com Marcadores -->
                            <path d="M 30,30 Q 80,105 130,105 T 230,102 T 330,105 T 380,128" fill="none" stroke="#38bdf8" stroke-width="2.5" />
                            <circle cx="30" cy="30" r="4" fill="#38bdf8" stroke="#ffffff" stroke-width="1.5" />
                            <circle cx="82" cy="105" r="3.5" fill="#38bdf8" stroke="#ffffff" stroke-width="1.5" />
                            <circle cx="132" cy="105" r="3.5" fill="#38bdf8" stroke="#ffffff" stroke-width="1.5" />
                            <circle cx="180" cy="122" r="3.5" fill="#38bdf8" stroke="#ffffff" stroke-width="1.5" />
                            <circle cx="230" cy="102" r="3.5" fill="#38bdf8" stroke="#ffffff" stroke-width="1.5" />
                            <circle cx="280" cy="110" r="3.5" fill="#38bdf8" stroke="#ffffff" stroke-width="1.5" />
                            <circle cx="330" cy="105" r="3.5" fill="#38bdf8" stroke="#ffffff" stroke-width="1.5" />
                            <circle cx="380" cy="128" r="3.5" fill="#38bdf8" stroke="#ffffff" stroke-width="1.5" />

                            <!-- Labels no Eixo X -->
                            <text x="30" y="165" text-anchor="middle" font-size="10" fill="#94a3b8">01A</text>
                            <text x="82" y="165" text-anchor="middle" font-size="10" font-weight="700" fill="#ef4444">01B</text>
                            <text x="132" y="165" text-anchor="middle" font-size="10" fill="#94a3b8">02B</text>
                            <text x="180" y="165" text-anchor="middle" font-size="10" fill="#94a3b8">02M</text>
                            <text x="230" y="165" text-anchor="middle" font-size="10" fill="#94a3b8">01C</text>
                            <text x="280" y="165" text-anchor="middle" font-size="10" fill="#94a3b8">01E</text>
                            <text x="330" y="165" text-anchor="middle" font-size="10" fill="#94a3b8">02C</text>
                            <text x="380" y="165" text-anchor="middle" font-size="10" fill="#94a3b8">100</text>
                        </svg>

                        <div class="feira-chart-legend">
                            <div class="feira-legend-item">
                                <span class="feira-legend-dot" style="background: #38bdf8;"></span>
                                <span>Volume (88 Protótipos)</span>
                            </div>
                            <div class="feira-legend-item">
                                <span class="feira-legend-dot" style="background: #ec4899;"></span>
                                <span>Pico de Permanência: 46d (Setor 01B)</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 3. LINHA INFERIOR: EARNINGS / GAUGE 83% + VISITOR INSIGHTS AREA WAVE -->
                <div class="feira-grid-row">
                    <!-- BOTTOM LEFT: GAUGE DE ADESÃO À META (INSPIRADO NO "EARNINGS") -->
                    <div class="feira-card">
                        <div class="feira-card-header">
                            <div class="feira-card-title-group">
                                <div class="feira-card-title">
                                    <i class="fa-solid fa-gauge-high" style="color: #10b981;"></i>
                                    <span>Eficiência do Cronograma</span>
                                </div>
                                <div class="feira-card-subtitle">Adesão à meta de permanência de protótipos (≤ 20 dias)</div>
                            </div>
                        </div>

                        <div class="feira-gauge-layout">
                            <div class="feira-gauge-metrics">
                                <div class="feira-gauge-val">${dentroPrazoPct}%</div>
                                <div style="font-size: 13px; font-weight: 700; color: #34d399;">No Prazo Operacional</div>
                                <div class="feira-gauge-sub">
                                    ${dentroPrazoCount} de ${totalItems} protótipos estão com permanência controlada no fluxo.
                                </div>
                            </div>

                            <!-- SVG Semi-Donut Gauge (Arco de Velocímetro) -->
                            <svg viewBox="0 0 150 100" class="feira-gauge-svg">
                                <defs>
                                    <linearGradient id="gaugeEmeraldGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                                        <stop offset="0%" stop-color="#059669" />
                                        <stop offset="60%" stop-color="#10b981" />
                                        <stop offset="100%" stop-color="#38bdf8" />
                                    </linearGradient>
                                </defs>
                                <g transform="translate(5, 10)">
                                    <!-- Trilha cinza do fundo -->
                                    <path d="M 22 70 A 48 48 0 0 1 118 70" fill="none" stroke="#181c2b" stroke-width="14" stroke-linecap="round" />
                                    
                                    <!-- Arco de Progresso -->
                                    <path d="M 22 70 A 48 48 0 0 1 118 70" fill="none" stroke="url(#gaugeEmeraldGrad)" stroke-width="14" stroke-linecap="round"
                                        stroke-dasharray="${gaugeCircumference.toFixed(2)}"
                                        stroke-dashoffset="${gaugeOffset.toFixed(2)}" />

                                    <!-- Texto Central -->
                                    <text x="70" y="58" text-anchor="middle" font-size="20" font-weight="900" fill="#ffffff" font-family="system-ui">${dentroPrazoPct}%</text>
                                    <text x="70" y="74" text-anchor="middle" font-size="8.5" font-weight="700" fill="#94a3b8" letter-spacing="1px" font-family="system-ui">NO PRAZO</text>
                                </g>
                            </svg>
                        </div>
                    </div>

                    <!-- BOTTOM RIGHT: VISITOR INSIGHTS (DISTRIBUIÇÃO DE DIAS DE RETENÇÃO) -->
                    <div class="feira-card">
                        <div class="feira-card-header">
                            <div class="feira-card-title-group">
                                <div class="feira-card-title">
                                    <i class="fa-solid fa-chart-area" style="color: #38bdf8;"></i>
                                    <span>Distribuição de Permanência dos Protótipos</span>
                                </div>
                                <div class="feira-card-subtitle">Faixas de tempo de espera no setor de desenvolvimento</div>
                            </div>
                            <span class="badge badge-rose" style="font-size: 11px;">
                                <i class="fa-solid fa-circle" style="font-size: 8px; color: #ef4444;"></i> Ponto Crítico (01B: 46d)
                            </span>
                        </div>

                        <!-- SVG Spline Wave Area Chart (Inspirado no Visitor Insights) -->
                        <svg viewBox="0 0 420 160" class="feira-insights-svg">
                            <defs>
                                <linearGradient id="insightsWaveGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                                    <stop offset="0%" stop-color="#0284c7" stop-opacity="0.45" />
                                    <stop offset="100%" stop-color="#0c4a6e" stop-opacity="0.05" />
                                </linearGradient>
                            </defs>

                            <!-- Grid Lines -->
                            <line x1="35" y1="120" x2="395" y2="120" stroke="rgba(255,255,255,0.06)" stroke-width="1" />
                            <line x1="35" y1="90" x2="395" y2="90" stroke="rgba(255,255,255,0.04)" stroke-dasharray="3 3" />
                            <line x1="35" y1="60" x2="395" y2="60" stroke="rgba(255,255,255,0.04)" stroke-dasharray="3 3" />
                            <line x1="35" y1="30" x2="395" y2="30" stroke="rgba(255,255,255,0.04)" stroke-dasharray="3 3" />

                            <!-- Labels Y -->
                            <text x="25" y="34" text-anchor="end" font-size="9.5" fill="#64748b">40</text>
                            <text x="25" y="64" text-anchor="end" font-size="9.5" fill="#64748b">30</text>
                            <text x="25" y="94" text-anchor="end" font-size="9.5" fill="#64748b">20</text>
                            <text x="25" y="124" text-anchor="end" font-size="9.5" fill="#64748b">0</text>

                            <!-- Área Preenchida da Onda -->
                            <path d="M 45,74 Q 85,38 125,35 T 205,82 T 285,100 T 365,96 L 365,120 L 45,120 Z" fill="url(#insightsWaveGrad)" />

                            <!-- Linha Spline Superior -->
                            <path d="M 45,74 Q 85,38 125,35 T 205,82 T 285,100 T 365,96" fill="none" stroke="#38bdf8" stroke-width="2.5" />

                            <!-- Linha Tracejada no Marcador Crítico (> 45 dias no Setor 01B) -->
                            <line x1="365" y1="30" x2="365" y2="120" stroke="#f59e0b" stroke-width="1.5" stroke-dasharray="3 3" />
                            <circle cx="365" cy="96" r="5" fill="#f59e0b" stroke="#ffffff" stroke-width="2" />

                            <!-- Eixo X com as faixas de dias -->
                            <text x="45" y="140" text-anchor="middle" font-size="10.5" fill="#94a3b8">0-5d (22)</text>
                            <text x="125" y="140" text-anchor="middle" font-size="10.5" font-weight="700" fill="#38bdf8">6-15d (38)</text>
                            <text x="205" y="140" text-anchor="middle" font-size="10.5" fill="#94a3b8">16-30d (13)</text>
                            <text x="285" y="140" text-anchor="middle" font-size="10.5" fill="#94a3b8">31-50d (7)</text>
                            <text x="365" y="140" text-anchor="middle" font-size="10.5" font-weight="700" fill="#f59e0b">> 50d (8)</text>
                        </svg>
                    </div>
                </div>

            </div>

            <!-- TABELA DETALHADA DOS PROTÓTIPOS (FLUXO D36) COM FILTRO DINÂMICO -->
            <div class="table-card" id="feiraTableSection">
                <div class="table-toolbar">
                    <div class="table-title-group">
                        <h3 class="table-title">Lista Detalhada de Protótipos (Fluxo D36)</h3>
                        <span class="badge badge-sub">${displayItems.length} de ${totalItems} produtos</span>
                    </div>
                    <div class="table-controls">
                        ${activeFilterLabel ? `
                            <button class="filter-clear-btn" onclick="window.crmFilterFeiraSector(null)" title="Limpar filtro ativo">
                                <i class="fa-solid fa-xmark"></i> Limpar Filtro
                            </button>
                        ` : ''}
                        <button class="toolbar-pill-btn btn-export-pdf" onclick="window.crmGeneratePDFReport()" title="Gerar Relatório em PDF">
                            <i class="fa-solid fa-file-pdf" style="color: #ef4444;"></i> Gerar PDF
                        </button>
                        <button class="toolbar-pill-btn" onclick="window.crmExportFilteredCSV()">
                            <i class="fa-solid fa-download"></i> Baixar Tabela CSV
                        </button>
                    </div>
                </div>

                <!-- Banner Informativo de Filtro Ativo -->
                ${activeFilterLabel ? `
                    <div class="filter-active-banner">
                        <div class="filter-active-text">
                            <i class="fa-solid fa-filter"></i>
                            <span>Exibindo <strong>${displayItems.length} protótipos</strong> do <strong>${activeFilterLabel}</strong></span>
                        </div>
                        <button class="filter-clear-btn" onclick="window.crmFilterFeiraSector(null)">
                            <i class="fa-solid fa-xmark"></i> Remover Filtro (Exibir Todos os ${totalItems})
                        </button>
                    </div>
                ` : ''}

                <div class="table-responsive">
                    <table class="crm-table">
                        <thead>
                            <tr>
                                <th>OP</th>
                                <th>Código & Produto</th>
                                <th>Setor no Fluxo</th>
                                <th>Dias no Setor (Coluna BV)</th>
                                <th>Peças (AP)</th>
                                <th>Prog. Amostras (CO)</th>
                                <th>Status do Produto (BD)</th>
                                <th>Marca / Cliente</th>
                                <th>Prazo</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${displayItems.length === 0 ? `
                                <tr>
                                    <td colspan="9" style="text-align: center; padding: 32px; color: var(--text-muted);">
                                        Nenhum protótipo encontrado no setor selecionado.
                                    </td>
                                </tr>
                            ` : displayItems.map(item => {
                                const isAtraso = item.prazoStatus === 'ATRASO';
                                let diasBadge = '';
                                if (item.diasParado > 30) {
                                    diasBadge = `<span class="badge badge-rose" style="font-weight: 700;"><i class="fa-solid fa-triangle-exclamation"></i> ${item.diasParado} dias</span>`;
                                } else if (item.diasParado > 10) {
                                    diasBadge = `<span class="badge badge-amber" style="font-weight: 600;">${item.diasParado} dias</span>`;
                                } else {
                                    diasBadge = `<span class="badge badge-emerald" style="font-weight: 600;">${item.diasParado} dias</span>`;
                                }

                                const stageMatch = FLOW_SEQUENCE.find(s => s.code === item.setor);
                                const stageName = stageMatch ? stageMatch.name : (item.descSetor || '');

                                return `
                                    <tr class="${isAtraso ? 'row-danger' : ''}" onclick="window.crmOpenOpModal('${item.op}')" style="cursor: pointer;" title="Clique para abrir detalhes 360° da OP ${item.op}">
                                        <td class="table-op-cell">
                                            <span style="font-weight: 700; color: #ec4899;">${item.op}</span>
                                        </td>
                                        <td>
                                            <div class="table-prod-cell">
                                                <span class="prod-code">${item.codigo}</span>
                                                <span class="prod-name" title="${item.descricao}">${item.descricao || 'PROTÓTIPO'}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <span class="badge badge-pink" title="${stageName}">
                                                Setor ${item.setor}
                                            </span>
                                            <span style="font-size: 10.5px; color: var(--text-muted); display: block; margin-top: 2px;">
                                                ${stageName}
                                            </span>
                                        </td>
                                        <td>${diasBadge}</td>
                                        <td style="font-weight: 700; color: var(--text-primary);">${formatNumber(item.qtdeOriginal)}</td>
                                        <td>
                                            <span class="badge badge-purple">${item.progAmostras || '—'}</span>
                                        </td>
                                        <td>
                                            <span style="font-size: 11.5px; color: var(--text-secondary);">${item.statusProd || '—'}</span>
                                        </td>
                                        <td>
                                            <div>${item.marca || '—'}</div>
                                            <div style="font-size: 10.5px; color: var(--text-muted);">${item.cliente || ''}</div>
                                        </td>
                                        <td>
                                            ${isAtraso ? 
                                                '<span class="badge badge-rose"><i class="fa-solid fa-clock"></i> Em Atraso</span>' : 
                                                '<span class="badge badge-emerald"><i class="fa-solid fa-check"></i> No Prazo</span>'
                                            }
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    function renderMacroModelagemView(container) {
        const modItems = state.filteredData.filter(r => ['13', '05', '06', '12'].includes(r.setor));
        container.innerHTML = `
            <div class="module-view-header">
                <div class="module-view-title-group">
                    <h2>Módulo Modelagem: Visão Geral</h2>
                    <p class="module-view-description">Indicadores consolidados dos setores de modelagem e liberação para corte (Deisy, Andréa e Simone).</p>
                </div>
            </div>
            <div class="kpi-grid">
                <div class="kpi-card amber" onclick="window.crmNavigate('modelagem', 'setor13')" style="cursor: pointer;">
                    <div class="kpi-header">
                        <span class="kpi-label">Pedidos Setor 13</span>
                        <div class="kpi-icon"><i class="fa-solid fa-tag"></i></div>
                    </div>
                    <div class="kpi-value">${modItems.filter(r => r.setor === '13').length}</div>
                    <div class="kpi-footer"><span>Clique para detalhar o Setor 13 &rarr;</span></div>
                </div>
                <div class="kpi-card cyan" onclick="window.crmNavigate('modelagem', 'processo')" style="cursor: pointer;">
                    <div class="kpi-header">
                        <span class="kpi-label">Pedidos em Processo (05, 06, 12)</span>
                        <div class="kpi-icon"><i class="fa-solid fa-scissors"></i></div>
                    </div>
                    <div class="kpi-value">${modItems.filter(r => ['05', '06', '12'].includes(r.setor)).length}</div>
                    <div class="kpi-footer"><span>Clique para detalhar 05, 06 e 12 &rarr;</span></div>
                </div>
            </div>
            ${renderGenericDataTable(modItems, 'Todos os Registros do Módulo Modelagem')}
        `;
    }

    function renderMacroEstiloPedidoView(container) {
        const estItems = state.filteredData.filter(r => ['05', '06', '12', '13', '26', '20', '31', '106', 'CM1', 'D01', '43'].includes(r.setor));
        container.innerHTML = `
            <div class="module-view-header">
                <div class="module-view-title-group">
                    <h2>Módulo Estilo Pedido: Visão Geral</h2>
                    <p class="module-view-description">Aprovações de arte, estampas, cartelas de cores, aviamentos e rotativos.</p>
                </div>
            </div>
            <div class="kpi-grid">
                <div class="kpi-card cyan" onclick="window.crmNavigate('estilo-pedido', 'setor01')" style="cursor: pointer;">
                    <div class="kpi-header"><span class="kpi-label">Pend. Setor 01</span><div class="kpi-icon"><i class="fa-solid fa-clock-rotate-left"></i></div></div>
                    <div class="kpi-value">${state.filteredData.filter(r => r.setor === '01' || r.setor === '1').length}</div>
                    <div class="kpi-footer"><span>Ver pendências por cliente &rarr;</span></div>
                </div>
                <div class="kpi-card purple" onclick="window.crmNavigate('estilo-pedido', 'estampa')" style="cursor: pointer;">
                    <div class="kpi-header"><span class="kpi-label">Sit. Estampa</span><div class="kpi-icon"><i class="fa-solid fa-shirt"></i></div></div>
                    <div class="kpi-value">${estItems.filter(r => ['05', '06', '12', '13', '26', '20', '31', '106'].includes(r.setor)).length}</div>
                    <div class="kpi-footer"><span>Ver situação de estampa &rarr;</span></div>
                </div>
                <div class="kpi-card amber" onclick="window.crmNavigate('estilo-pedido', 'cores-aviamentos')" style="cursor: pointer;">
                    <div class="kpi-header"><span class="kpi-label">Cores & Aviamentos</span><div class="kpi-icon"><i class="fa-solid fa-box-open"></i></div></div>
                    <div class="kpi-value">${estItems.filter(r => ['CM1', 'D01'].includes(r.setor)).length}</div>
                    <div class="kpi-footer"><span>Ver CM1 e D01 &rarr;</span></div>
                </div>
                <div class="kpi-card rose" onclick="window.crmNavigate('estilo-pedido', 'rotativos')" style="cursor: pointer;">
                    <div class="kpi-header"><span class="kpi-label">Rotativos (Setor 43)</span><div class="kpi-icon"><i class="fa-solid fa-rotate"></i></div></div>
                    <div class="kpi-value">${estItems.filter(r => r.setor === '43').length}</div>
                    <div class="kpi-footer"><span>Ver cilindros e arte rotativa &rarr;</span></div>
                </div>
                <div class="kpi-card pink" onclick="window.crmNavigate('estilo-pedido', 'malotes')" style="cursor: pointer;">
                    <div class="kpi-header"><span class="kpi-label">Malotes (88 / 83)</span><div class="kpi-icon"><i class="fa-solid fa-envelope-open-text"></i></div></div>
                    <div class="kpi-value">${state.allData.filter(r => r.setor === '88' || r.setor === '83' || r.setor === '088' || r.setor === '083').length}</div>
                    <div class="kpi-footer"><span>Ver cruzamento com produção &rarr;</span></div>
                </div>
            </div>
            ${renderGenericDataTable(estItems, 'Todos os Registros do Módulo Estilo Pedido')}
        `;
    }

    function renderMacroEstiloAmostrasView(container) {
        renderFeiraView(container);
    }

    // =========================================================================
    // CONFIGURAÇÕES & CALENDÁRIO
    // =========================================================================
    function getAlertCategory(alert) {
        const ruleId = String(alert?.ruleId || '').toLocaleLowerCase('pt-BR');

        if (ruleId === 'malotes-parte-principal') {
            return { key: 'malote', label: 'Malote' };
        }
        if (ruleId === 'setor01-limite-dias') {
            return { key: 'setor01', label: 'Pedido Setor 01' };
        }
        if (ruleId === 'setor13-calendario') {
            return { key: 'modelagem', label: 'Modelagem' };
        }
        if (ruleId === 'cq-amostra-reprovada') {
            return { key: 'cq', label: 'Controle de Qualidade' };
        }
        if (ruleId === 'pend-produto-aviamento' || ruleId === 'pend-produto-cor') {
            return { key: 'pend-produto', label: 'Pend. Produto' };
        }

        const fallbackLabel = String(alert?.title || 'Outros alertas').trim();
        const fallbackKey = `regra:${String(alert?.ruleId || fallbackLabel)
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLocaleLowerCase('pt-BR')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '') || 'outros'}`;
        return { key: fallbackKey, label: fallbackLabel };
    }

    function formatAlertRuleCondition(condition) {
        const fields = window.CRMAlertsEngine?.FIELD_DEFINITIONS || [];
        const operators = window.CRMAlertsEngine?.OPERATORS || [];
        const field = fields.find(item => item.value === condition?.field);
        const operator = operators.find(item => item.value === condition?.operator);
        const rawValue = String(condition?.value ?? '').trim();
        const value = rawValue === 'true' ? 'sim' : rawValue === 'false' ? 'não' : rawValue;
        return [field?.label || condition?.field, operator?.label || condition?.operator, value]
            .filter(Boolean)
            .join(' ');
    }

    function getAlertRuleSource(ruleId, calendarRecords) {
        const calendar = window.CRMAlertsEngine?.buildCalendarIndex?.(calendarRecords || []) || {};
        if (ruleId === 'setor13-calendario') {
            const weekCount = Object.keys(calendar).length;
            return `Calendário Industrial · coluna A (semana) + coluna B (data limite) · ${weekCount} semanas carregadas`;
        }
        if (ruleId === 'setor01-limite-dias') {
            const limits = Array.from(new Set(Object.values(calendar)
                .map(entry => entry.sector01MaxDays)
                .filter(limit => Number.isFinite(limit))))
                .sort((a, b) => a - b);
            const currentLimit = limits.length === 1
                ? `limite atual: ${limits[0]} ${limits[0] === 1 ? 'dia' : 'dias'}`
                : (limits.length ? `limites atuais: ${limits.join(', ')} dias` : 'limite indisponível');
            return `Calendário Industrial · coluna E (limite de dias) · ${currentLimit}`;
        }
        if (ruleId === 'malotes-parte-principal') {
            return 'CRM · setores da parte principal e do malote';
        }
        if (ruleId === 'cq-amostra-reprovada') {
            return 'Andamento do CQ · coluna DESC_AMOSTRA + data de reprovação em OBSERVACAO';
        }
        if (ruleId === 'pend-produto-aviamento') {
            return 'CRM · mesma OF nos setores 02/03/04/05G/CM1 e X01';
        }
        if (ruleId === 'pend-produto-cor') {
            return 'CRM · mesma OF nos setores 02/03/04/05G/05 e D01';
        }
        return 'Dados oficiais do CRM';
    }

    function renderAlertsView(container) {
        recalculateAlerts();
        updateAlertsBadges();
        const alerts = state.activeAlerts || [];
        const rules = state.alertRules || [];
        const officialRules = state.alertRulesSource === 'api' ? rules : [];
        const calendarRecords = state.calendarExternalData?.records || [];
        const calendarAvailable = calendarRecords.length > 0;
        const calendarMode = calendarAvailable
            ? (state.calendarExternalData?.isLive === false ? 'cache local' : 'ao vivo')
            : 'indisponível';
        const query = String(state.alertsSearch || '').trim().toLocaleLowerCase('pt-BR');
        const categories = Array.from(alerts.reduce((map, alert) => {
            const category = getAlertCategory(alert);
            if (!map.has(category.key)) map.set(category.key, category);
            return map;
        }, new Map()).values());
        if (state.alertsCategory !== 'all' && !categories.some(category => category.key === state.alertsCategory)) {
            state.alertsCategory = 'all';
        }
        const filteredAlerts = alerts.filter(alert => {
            if (state.alertsSeverity !== 'all' && alert.severity !== state.alertsSeverity) return false;
            if (state.alertsCategory !== 'all' && getAlertCategory(alert).key !== state.alertsCategory) return false;
            if (!query) return true;
            return [alert.title, alert.message, alert.op, alert.codigo, alert.setor, alert.cliente]
                .some(value => String(value || '').toLocaleLowerCase('pt-BR').includes(query));
        });
        const visibleAlerts = filteredAlerts.slice(0, state.alertsPageLimit || 30);
        const counts = alerts.reduce((acc, alert) => {
            acc[alert.severity] = (acc[alert.severity] || 0) + 1;
            return acc;
        }, { critical: 0, warning: 0, info: 0 });

        const severityMeta = {
            critical: { label: 'Crítico', icon: 'fa-circle-exclamation', color: '#fb7185', className: 'rose' },
            warning: { label: 'Atenção', icon: 'fa-triangle-exclamation', color: '#fbbf24', className: 'amber' },
            info: { label: 'Informativo', icon: 'fa-circle-info', color: '#38bdf8', className: 'cyan' }
        };

        const activeContent = `
            <div class="alerts-toolbar">
                <div class="s13-search-box alerts-search-box">
                    <i class="fa-solid fa-magnifying-glass"></i>
                    <input type="text" placeholder="Buscar por OF, produto, setor ou mensagem..." value="${escapeHtml(state.alertsSearch)}" oninput="window.crmSearchAlerts(this.value)">
                    ${query ? '<button class="search-clear-btn" onclick="window.crmSearchAlerts(\'\')" title="Limpar busca">&times;</button>' : ''}
                </div>
                <div class="alerts-filter-group">
                    ${['all', 'critical', 'warning', 'info'].map(severity => `
                        <button class="filter-chip ${state.alertsSeverity === severity ? 'active' : ''}" onclick="window.crmFilterAlerts('${severity}')">
                            ${severity === 'all' ? 'Todos' : severityMeta[severity].label}
                        </button>
                    `).join('')}
                </div>
            </div>
            <div class="alerts-category-filter" aria-label="Filtrar por tipo de alerta">
                <span class="alerts-category-label"><i class="fa-solid fa-layer-group"></i> Tipo:</span>
                <button class="filter-chip ${state.alertsCategory === 'all' ? 'active' : ''}" onclick="window.crmFilterAlertsCategory('all')">Todos os tipos</button>
                ${categories.map(category => `
                    <button class="filter-chip ${state.alertsCategory === category.key ? 'active' : ''}" onclick="window.crmFilterAlertsCategory('${escapeHtml(category.key)}')">
                        ${escapeHtml(category.label)}
                    </button>
                `).join('')}
            </div>
            <div class="alerts-list">
                ${visibleAlerts.length ? visibleAlerts.map(alert => {
                    const meta = severityMeta[alert.severity] || severityMeta.info;
                    const imgInfo = getProductImage(alert.codigo, alert.op);
                    const imageTitle = escapeHtml(alert.codigo || `OF ${alert.op || ''}`);
                    const imageSubtitle = escapeHtml(`OF ${alert.op || '—'} • Setor ${alert.setor || '—'} • ${alert.title || 'Alerta operacional'}`);
                    return `
                        <article class="alert-item alert-${alert.severity}">
                            ${imgInfo.hasImage ? `
                                <button class="alert-item-image js-alert-open-image"
                                    type="button"
                                    data-image-url="${escapeHtml(imgInfo.largeUrl)}"
                                    data-image-fallback="${escapeHtml(imgInfo.largeFallbackUrl || '')}"
                                    data-image-title="${imageTitle}"
                                    data-image-subtitle="${imageSubtitle}"
                                    title="Ampliar imagem do pedido">
                                    <img src="${escapeHtml(imgInfo.thumbUrl)}" alt="Imagem do pedido ${imageTitle}" loading="lazy" onerror="if (this.dataset.fallback !== '1') { this.dataset.fallback='1'; this.src='${escapeHtml(imgInfo.proxyUrl || '')}'; } else { this.onerror=null; this.closest('.alert-item-image')?.classList.add('image-unavailable'); }">
                                    <span><i class="fa-solid fa-magnifying-glass-plus"></i></span>
                                    <span class="alert-item-image-fallback"><i class="fa-regular fa-image"></i><small>Sem foto</small></span>
                                </button>
                            ` : `
                                <div class="alert-item-image alert-item-image-placeholder" title="Pedido sem imagem disponível">
                                    <i class="fa-regular fa-image"></i>
                                    <small>Sem foto</small>
                                </div>
                            `}
                            <div class="alert-item-icon" style="color: ${meta.color};"><i class="fa-solid ${meta.icon}"></i></div>
                            <div class="alert-item-content">
                                <div class="alert-item-heading">
                                    <strong>${escapeHtml(alert.title)}</strong>
                                    <span class="badge badge-${meta.className}">${meta.label}</span>
                                </div>
                                <p>${escapeHtml(alert.message)}</p>
                                <div class="alert-item-meta">
                                    ${alert.op ? `<span>OF ${escapeHtml(alert.op)}</span>` : ''}
                                    ${alert.codigo ? `<span>${escapeHtml(alert.codigo)}</span>` : ''}
                                    ${alert.setor ? `<span>Setor ${escapeHtml(alert.setor)}</span>` : ''}
                                    ${alert.cliente ? `<span>${escapeHtml(alert.cliente)}</span>` : ''}
                                </div>
                            </div>
                            ${alert.op ? `<button class="btn btn-glass js-alert-open-op" data-alert-op="${escapeHtml(alert.op)}"><i class="fa-solid fa-arrow-up-right-from-square"></i> Abrir OF</button>` : ''}
                        </article>
                    `;
                }).join('') : `
                    <div class="alerts-empty-state">
                        <i class="fa-solid fa-circle-check"></i>
                        <h3>Nenhum alerta encontrado</h3>
                        <p>${alerts.length ? 'Ajuste os filtros para visualizar outros alertas.' : 'As regras ativas não encontraram pendências nos dados atuais.'}</p>
                    </div>
                `}
                ${filteredAlerts.length > visibleAlerts.length ? `
                    <button class="btn btn-glass alerts-load-more" onclick="window.crmLoadMoreAlerts()">
                        <i class="fa-solid fa-chevron-down"></i> Mostrar mais 30 (${formatNumber(filteredAlerts.length - visibleAlerts.length)} restantes)
                    </button>
                ` : ''}
            </div>
        `;

        const rulesContent = `
            <div class="alerts-rules-header">
                <div>
                    <h3>Regras vigentes</h3>
                    <p>Consulta somente de leitura. Qualquer alteração é feita na programação, revisada e publicada como uma nova versão do CRM.</p>
                </div>
                <span class="badge badge-emerald"><i class="fa-solid fa-lock"></i> Somente leitura</span>
            </div>
            <div class="alerts-rules-list">
                ${officialRules.length ? officialRules.map(rule => {
                    const meta = severityMeta[rule.severity] || severityMeta.info;
                    const conditions = Array.isArray(rule.conditions) ? rule.conditions : [];
                    return `
                        <article class="alert-rule-card ${rule.enabled === false ? 'disabled' : ''}">
                            <span class="alert-rule-status-dot" style="background:${meta.color}; box-shadow:0 0 10px ${meta.color}88;"></span>
                            <div class="alert-rule-main">
                                <div class="alert-rule-title">
                                    <strong>${escapeHtml(rule.name)}</strong>
                                    <span class="badge badge-${meta.className}">${meta.label}</span>
                                    <span class="badge ${rule.enabled === false ? 'badge-sub' : 'badge-emerald'}"><i class="fa-solid ${rule.enabled === false ? 'fa-circle-pause' : 'fa-circle-check'}"></i> ${rule.enabled === false ? 'Inativa no código' : 'Ativa'}</span>
                                </div>
                                <p>${escapeHtml(rule.description || '')}</p>
                                <div class="alert-rule-info-grid">
                                    <div class="alert-rule-info-block">
                                        <span>Fonte oficial</span>
                                        <strong>${escapeHtml(getAlertRuleSource(rule.id, calendarRecords))}</strong>
                                    </div>
                                    <div class="alert-rule-info-block">
                                        <span>Quando dispara</span>
                                        <strong>${escapeHtml(conditions.map(formatAlertRuleCondition).join(rule.match === 'any' ? ' OU ' : ' E ') || 'Condição definida no código')}</strong>
                                    </div>
                                    <div class="alert-rule-info-block alert-rule-message-preview">
                                        <span>Mensagem gerada</span>
                                        <code>${escapeHtml(rule.message || '')}</code>
                                    </div>
                                </div>
                                <div class="alert-rule-code-id"><i class="fa-solid fa-code-branch"></i> Identificador: <code>${escapeHtml(rule.id)}</code></div>
                            </div>
                        </article>
                    `;
                }).join('') : `
                    <div class="alerts-empty-state">
                        <i class="fa-solid fa-triangle-exclamation"></i>
                        <h3>Consulta oficial indisponível</h3>
                        <p>Os avisos continuam sendo calculados com a cópia local de contingência, mas esta aba não apresenta essa cópia como regra vigente. Tente recarregar a página.</p>
                        ${state.alertRulesError ? `<small>${escapeHtml(state.alertRulesError)}</small>` : ''}
                    </div>
                `}
            </div>
        `;

        container.innerHTML = `
            <div class="module-view-header">
                <div class="module-view-title-group">
                    <h2><i class="fa-solid fa-triangle-exclamation" style="color:#fb7185;"></i> Alertas Operacionais</h2>
                    <p class="module-view-description">Pendências calculadas automaticamente a partir dos dados atuais e das regras oficiais do CRM.</p>
                </div>
                <div class="alerts-header-actions">
                    <span class="badge ${calendarAvailable ? 'badge-cyan' : 'badge-rose'}"><i class="fa-solid fa-calendar-days"></i> Calendário ${calendarMode}</span>
                    <span class="badge ${state.alertRulesSource === 'api' ? 'badge-sub' : 'badge-amber'}">${state.alertRulesSource === 'api' ? `${officialRules.filter(rule => rule.enabled).length} regras oficiais` : 'Regras em contingência'}</span>
                    <button class="btn btn-glass" onclick="window.crmRefreshAlerts()"><i class="fa-solid fa-arrows-rotate"></i> Recalcular</button>
                </div>
            </div>
            ${calendarAvailable ? '' : `
                <div class="alert-rule-test-result error" style="display:block; margin-bottom:16px;">
                    <strong>Calendário Industrial indisponível.</strong>
                    <span>Os alertas do Setor 13 e do Setor 01 ficam suspensos até a planilha ou o cache voltar; o cruzamento de Malotes continua ativo.</span>
                </div>
            `}
            <div class="kpi-grid alerts-kpi-grid">
                <div class="kpi-card rose"><div class="kpi-header"><span class="kpi-label">Críticos</span><div class="kpi-icon"><i class="fa-solid fa-circle-exclamation"></i></div></div><div class="kpi-value">${formatNumber(counts.critical)}</div><div class="kpi-footer">Ação imediata</div></div>
                <div class="kpi-card amber"><div class="kpi-header"><span class="kpi-label">Atenção</span><div class="kpi-icon"><i class="fa-solid fa-triangle-exclamation"></i></div></div><div class="kpi-value">${formatNumber(counts.warning)}</div><div class="kpi-footer">Requer acompanhamento</div></div>
                <div class="kpi-card cyan"><div class="kpi-header"><span class="kpi-label">Informativos</span><div class="kpi-icon"><i class="fa-solid fa-circle-info"></i></div></div><div class="kpi-value">${formatNumber(counts.info)}</div><div class="kpi-footer">Controle preventivo</div></div>
                <div class="kpi-card purple"><div class="kpi-header"><span class="kpi-label">Total ativo</span><div class="kpi-icon"><i class="fa-solid fa-list-check"></i></div></div><div class="kpi-value">${formatNumber(alerts.length)}</div><div class="kpi-footer">Atualizado agora</div></div>
            </div>
            <div class="alerts-tabs" role="tablist" aria-label="Conteúdo dos alertas">
                <button id="alertsTabActive" class="${state.alertsTab === 'active' ? 'active' : ''}" type="button" role="tab" aria-controls="alertsTabPanel" aria-selected="${state.alertsTab === 'active'}" onclick="window.crmSetAlertsTab('active')"><i class="fa-solid fa-bell"></i> Avisos ativos</button>
                <button id="alertsTabRules" class="${state.alertsTab === 'rules' ? 'active' : ''}" type="button" role="tab" aria-controls="alertsTabPanel" aria-selected="${state.alertsTab === 'rules'}" onclick="window.crmSetAlertsTab('rules')"><i class="fa-solid fa-book-open"></i> Regras vigentes</button>
            </div>
            <section id="alertsTabPanel" class="panel-card alerts-panel" role="tabpanel" aria-labelledby="${state.alertsTab === 'rules' ? 'alertsTabRules' : 'alertsTabActive'}">
                ${state.alertsLoading ? '<div class="alerts-empty-state"><i class="fa-solid fa-spinner fa-spin"></i><p>Carregando alertas...</p></div>' : (state.alertsTab === 'rules' ? rulesContent : activeContent)}
            </section>
        `;
        container.querySelectorAll('.js-alert-open-op').forEach(button => {
            button.addEventListener('click', () => openOpModal(button.dataset.alertOp || ''));
        });
        container.querySelectorAll('.js-alert-open-image').forEach(button => {
            button.addEventListener('click', () => window.crmOpenImageLightbox(
                button.dataset.imageUrl || '',
                button.dataset.imageTitle || '',
                button.dataset.imageSubtitle || '',
                button.dataset.imageFallback || ''
            ));
        });
    }

    function renderSyncConfigView(container) {
        container.innerHTML = `
            <div class="module-view-header">
                <div class="module-view-title-group">
                    <h2>Integração & Sincronização da Planilha</h2>
                    <p class="module-view-description">Controle das fontes de dados, sincronização ao vivo com o Google Sheets e upload de novos arquivos.</p>
                </div>
            </div>

            <div class="analytics-grid" style="grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));">
                <!-- Card 1: Google Sheets -->
                <div class="panel-card">
                    <div class="panel-header">
                        <h3 class="panel-title"><i class="fa-solid fa-cloud-arrow-down" style="color: var(--neon-cyan)"></i> Sincronização Google Sheets</h3>
                        <span class="badge badge-cyan">Planilha</span>
                    </div>
                    <p style="font-size: 13.5px; color: var(--text-secondary); margin-bottom: 16px;">
                        Os dados operacionais das 121 colunas são lidos diretamente da planilha Google Sheets oficial. Clique abaixo para forçar a atualização:
                    </p>
                    <div style="display: flex; gap: 12px;">
                        <button class="btn btn-primary" onclick="window.crmSyncGoogleSheets()">
                            <i class="fa-solid fa-rotate"></i> Sincronizar Google Sheets
                        </button>
                    </div>
                    <p style="font-size: 12px; color: var(--text-muted); margin-top: 14px;">
                        Última leitura: ${state.lastSync ? state.lastSync.toLocaleString('pt-BR') : 'Hoje'}
                    </p>
                </div>

                <!-- Card 2: Google Drive Fotos -->
                <div class="panel-card" style="border-top: 3px solid #38bdf8;">
                    <div class="panel-header">
                        <h3 class="panel-title"><i class="fa-solid fa-images" style="color: #38bdf8"></i> Fotos & Imagens (Google Drive)</h3>
                        <span class="badge badge-cyan" id="syncImagesBadgeCount">${Object.keys(state.driveImages || {}).length} Mapeadas</span>
                    </div>
                    <p style="font-size: 13.5px; color: var(--text-secondary); margin-bottom: 16px;">
                        Sincronização profunda com a pasta do Google Drive (fotos de produtos, fichas e catálogos):
                    </p>
                    <div style="display: flex; gap: 12px;">
                        <button class="btn btn-secondary-action btn-sync-images-action" onclick="window.crmSyncImages()">
                            <i class="fa-solid fa-arrows-rotate"></i> Sincronizar Fotos do Drive
                        </button>
                    </div>
                    <p style="font-size: 12px; color: var(--text-muted); margin-top: 14px;">
                        <i class="fa-brands fa-google-drive" style="color: #34d399;"></i> Pasta: IMAGENS PARA o APP (1YA-gpBhY3zDeooquzzY5Vl4HK-DirjzA)
                    </p>
                </div>

                <!-- Card 3: Upload de CSV Local -->
                <div class="panel-card">
                    <div class="panel-header">
                        <h3 class="panel-title"><i class="fa-solid fa-file-csv" style="color: var(--neon-purple)"></i> Upload de Nova Planilha (.csv)</h3>
                        <span class="badge badge-purple">Local</span>
                    </div>
                    <p style="font-size: 13.5px; color: var(--text-secondary); margin-bottom: 16px;">
                        Você pode subir um novo arquivo `.csv` exportado do ERP Excia para atualizar todas as colunas instantaneamente:
                    </p>
                    <input type="file" id="localCsvFileInput" accept=".csv" style="display: none;" onchange="window.crmHandleCsvUpload(event)">
                    <button class="btn btn-glass" onclick="document.getElementById('localCsvFileInput').click()">
                        <i class="fa-solid fa-arrow-up-from-bracket"></i> Selecionar Arquivo CSV...
                    </button>
                </div>
            </div>
        `;
    }

    function renderMissingImagesView(container) {
        const products = getImageCoverageProducts();
        const missingProducts = products.filter(product => !product.hasImage);
        const showingAllImages = state.missingImagesTab === 'all';
        const sourceProducts = showingAllImages ? products : missingProducts;
        const query = String(state.missingImagesSearch || '').toLowerCase().trim();
        const visibleProducts = sourceProducts.filter(product => {
            if (!query) return true;
            return [product.codigo, product.descricao, product.cliente, product.marca, ...product.ops, ...product.setores]
                .some(value => String(value || '').toLowerCase().includes(query));
        });
        const withImages = products.length - missingProducts.length;
        const coverage = products.length ? Math.round((withImages / products.length) * 100) : 0;
        const emptyTitle = sourceProducts.length
            ? 'Nenhum produto encontrado nessa busca'
            : (products.length ? 'Todos os produtos possuem imagem' : 'Nenhum produto válido encontrado');
        const emptyDescription = sourceProducts.length
            ? 'Tente outro código, OP, cliente, marca ou setor.'
            : (products.length ? 'O índice de imagens cobre todos os produtos atuais do CRM.' : 'Carregue ou sincronize os dados do CRM para montar a lista de imagens necessárias.');

        container.innerHTML = `
            <div class="module-view-header">
                <div class="module-view-title-group">
                    <h2><i class="fa-solid fa-images" style="color: #f59e0b;"></i> Controle de Imagens Ausentes</h2>
                    <p class="module-view-description">Produtos existentes no CRM que ainda não possuem uma imagem reconhecida na pasta local ou no Google Drive.</p>
                </div>
                <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                    ${showingAllImages ? `
                        <button class="btn btn-primary js-copy-all-image-names" onclick="window.crmCopyAllImageFilenames()" ${products.length ? '' : 'disabled'}>
                            <i class="fa-regular fa-copy"></i> Copiar lista
                        </button>
                    ` : ''}
                    <button class="btn btn-secondary-action btn-sync-images-action" onclick="window.crmSyncImages()">
                        <i class="fa-solid fa-arrows-rotate"></i> Sincronizar Fotos
                    </button>
                    <button class="btn btn-glass" onclick="window.crmExportMissingImagesCSV()" ${missingProducts.length ? '' : 'disabled'}>
                        <i class="fa-solid fa-file-csv"></i> Exportar Pendências
                    </button>
                </div>
            </div>

            <div class="kpi-grid" style="margin-bottom: 20px;">
                <div class="kpi-card cyan">
                    <div class="kpi-header"><span class="kpi-label">Produtos únicos</span><div class="kpi-icon"><i class="fa-solid fa-boxes-stacked"></i></div></div>
                    <div class="kpi-value">${formatNumber(products.length)}</div>
                    <div class="kpi-footer"><span>Códigos válidos encontrados no CRM</span></div>
                </div>
                <div class="kpi-card emerald">
                    <div class="kpi-header"><span class="kpi-label">Com imagem</span><div class="kpi-icon"><i class="fa-solid fa-image"></i></div></div>
                    <div class="kpi-value">${formatNumber(withImages)}</div>
                    <div class="kpi-footer"><span>Reconhecidos no índice de imagens</span></div>
                </div>
                <div class="kpi-card amber">
                    <div class="kpi-header"><span class="kpi-label">Sem imagem</span><div class="kpi-icon"><i class="fa-solid fa-triangle-exclamation"></i></div></div>
                    <div class="kpi-value">${formatNumber(missingProducts.length)}</div>
                    <div class="kpi-footer"><span>Precisam de arquivo no Drive</span></div>
                </div>
                <div class="kpi-card purple">
                    <div class="kpi-header"><span class="kpi-label">Cobertura</span><div class="kpi-icon"><i class="fa-solid fa-chart-pie"></i></div></div>
                    <div class="kpi-value">${coverage}%</div>
                    <div class="kpi-footer"><span>Produtos com foto disponível</span></div>
                </div>
            </div>

            <div class="alerts-tabs missing-images-tabs">
                <button class="${showingAllImages ? '' : 'active'}" onclick="window.crmSetMissingImagesTab('missing')">
                    <i class="fa-solid fa-triangle-exclamation"></i> Imagens Ausentes
                    <span class="badge badge-amber">${missingProducts.length}</span>
                </button>
                <button class="${showingAllImages ? 'active' : ''}" onclick="window.crmSetMissingImagesTab('all')">
                    <i class="fa-solid fa-images"></i> Imagens Totais do App
                    <span class="badge badge-cyan">${products.length}</span>
                </button>
            </div>

            <div class="table-card" style="border-top: 3px solid ${showingAllImages ? '#0ea5e9' : '#f59e0b'};">
                <div class="table-toolbar" style="gap: 14px; flex-wrap: wrap;">
                    <div class="table-title-group">
                        <h3 class="table-title"><i class="fa-solid ${showingAllImages ? 'fa-photo-film' : 'fa-list-check'}" style="color: ${showingAllImages ? '#38bdf8' : '#fbbf24'};"></i> ${showingAllImages ? 'Todas as imagens necessárias no app' : 'Produtos aguardando imagem'}</h3>
                        <span class="badge ${showingAllImages ? 'badge-cyan' : 'badge-amber'}">${visibleProducts.length} de ${sourceProducts.length}</span>
                    </div>
                    <div class="s13-search-box" style="min-width: min(100%, 340px);">
                        <i class="fa-solid fa-magnifying-glass"></i>
                        <input type="text" placeholder="Buscar código, OP, cliente, marca ou setor..." value="${escapeHtml(state.missingImagesSearch)}" oninput="window.crmSearchMissingImages(this.value)">
                        ${query ? '<button class="search-clear-btn" onclick="window.crmSearchMissingImages(\'\')" title="Limpar busca">&times;</button>' : ''}
                    </div>
                </div>

                ${visibleProducts.length === 0 ? `
                    <div style="text-align: center; padding: 48px 20px; color: var(--text-muted);">
                        <i class="fa-solid ${missingProducts.length ? 'fa-magnifying-glass' : 'fa-circle-check'}" style="font-size: 38px; color: ${missingProducts.length ? '#94a3b8' : '#34d399'}; margin-bottom: 12px;"></i>
                        <h4 style="color: #e2e8f0; margin-bottom: 6px;">${emptyTitle}</h4>
                        <p>${emptyDescription}</p>
                    </div>
                ` : `
                    <div class="table-responsive">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>Código do produto</th>
                                    <th>Descrição</th>
                                    <th>Cliente / Marca</th>
                                    <th>OPs</th>
                                    <th>Setores atuais</th>
                                    ${showingAllImages ? '<th>Status da imagem</th>' : ''}
                                    <th>Arquivo esperado</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${visibleProducts.map(product => `
                                    <tr>
                                        <td><span class="prod-code" style="color: #fbbf24;">${escapeHtml(product.codigo)}</span></td>
                                        <td><span class="prod-name" title="${escapeHtml(product.descricao)}">${escapeHtml(product.descricao)}</span></td>
                                        <td>
                                            <div style="font-weight: 700; color: #e2e8f0;">${escapeHtml(product.cliente)}</div>
                                            <div style="font-size: 10.5px; color: var(--text-muted);">${escapeHtml(product.marca)}</div>
                                        </td>
                                        <td>${escapeHtml(product.ops.slice(0, 5).join(', '))}${product.ops.length > 5 ? ` <span class="badge badge-sub">+${product.ops.length - 5}</span>` : ''}</td>
                                        <td>${product.setores.map(setor => `<span class="badge badge-sub" style="margin: 2px;">${escapeHtml(setor)}</span>`).join('') || '—'}</td>
                                        ${showingAllImages ? `<td><span class="badge ${product.hasImage ? 'badge-emerald' : 'badge-amber'}"><i class="fa-solid ${product.hasImage ? 'fa-circle-check' : 'fa-triangle-exclamation'}"></i> ${product.hasImage ? 'Disponível' : 'Precisa atualizar'}</span></td>` : ''}
                                        <td><code style="color: #38bdf8;">${escapeHtml(product.imageCode || product.codigo)}.jpg</code></td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                `}
            </div>
        `;
    }

    function renderCalendarioConfigView(container) {
        container.innerHTML = `
            <div class="module-view-header">
                <div class="module-view-title-group">
                    <h2>Módulo de Calendário de Prazos</h2>
                    <p class="module-view-description">Cruzamento dinâmico de datas de entrega, lead times e status No Prazo / Em Atraso.</p>
                </div>
                <span class="badge badge-emerald" style="font-size: 13px; padding: 6px 12px;">Aguardando Planilha Calendário</span>
            </div>

            <div class="panel-card" style="border-color: rgba(16, 185, 129, 0.4); background: rgba(16, 185, 129, 0.04);">
                <div class="panel-header">
                    <h3 class="panel-title" style="color: #6ee7b7;">
                        <i class="fa-regular fa-calendar-days" style="color: var(--neon-emerald)"></i>
                        Motor de Prazos Pronto para Receber a Nova Planilha Calendário
                    </h3>
                </div>
                <p style="font-size: 14px; color: var(--text-secondary); line-height: 1.6; margin-bottom: 16px;">
                    Assim que você enviar a nova planilha de <strong>Calendário</strong>, o sistema cruzará automaticamente as datas limites de cada setor com a data atual (<strong>${new Date().toLocaleDateString('pt-BR')}</strong>) para recalcular os status de atraso em tempo real.
                </p>
                <p style="font-size: 13px; color: var(--text-muted);">
                    Atualmente, o CRM está utilizando os campos nativos <code>Dt Fatura Ped</code>, <code>Dt Prev Mov</code>, <code>Dias Retorno</code> e <code>Dias Parado</code> para sinalizar os pedidos em risco.
                </p>
            </div>
        `;
    }

    // =========================================================================
    // COMPONENTES REUTILIZÁVEIS: TABELA & DISTRIBUIÇÃO
    // =========================================================================
    function renderGenericDataTable(items, title) {
        if (!items || items.length === 0) {
            return `
                <div class="table-card">
                    <div class="table-toolbar">
                        <h3 class="table-title">${title}</h3>
                    </div>
                    <div style="padding: 40px; text-align: center; color: var(--text-muted);">
                        Nenhum registro encontrado para os filtros selecionados.
                    </div>
                </div>
            `;
        }

        // Se o usuário selecionou visualização KANBAN
        if (state.viewMode === 'kanban') {
            return renderKanbanBoard(items, title);
        }

        // Visualização Padrão: LISTA / TABELA
        return `
            <div class="table-card">
                <div class="table-toolbar">
                    <div class="table-title-group">
                        <h3 class="table-title">${title}</h3>
                        <span class="badge badge-sub">${items.length} itens listados</span>
                    </div>
                    <div class="table-controls">
                        <button class="toolbar-pill-btn" onclick="window.crmExportFilteredCSV()">
                            <i class="fa-solid fa-download"></i> Baixar Tabela
                        </button>
                    </div>
                </div>
                <div class="table-responsive">
                    <table class="crm-table">
                        <thead>
                            <tr>
                                <th>OP</th>
                                <th>Código & Produto</th>
                                <th>Setor (AY)</th>
                                <th>Status Modelagem (Col Z)</th>
                                <th>Status Produto (Col BD)</th>
                                <th>Cliente</th>
                                <th>Semana Entrega (Col BK)</th>
                                <th>Peças (AP)</th>
                                <th>Dias (BV)</th>
                                <th>Prazo</th>
                                <th>Alertas</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${items.map(item => {
                                const isDuplicate = ['CM1', 'D01', '43'].includes(item.setor) && state.productionCodes.has(item.codigo);
                                const isAtraso = item.prazoStatus === 'ATRASO';
                                const isDiasCritico = item.diasParado > 2;
                                return `
                                    <tr class="${isAtraso ? 'row-danger' : ''}" onclick="window.crmOpenOpModal('${item.op}')">
                                        <td class="table-op-cell">${item.op}</td>
                                        <td>
                                            <div class="table-prod-cell">
                                                <span class="prod-code">${item.codigo}</span>
                                                <span class="prod-name" title="${item.descricao}">${item.descricao}</span>
                                            </div>
                                        </td>
                                        <td><span class="badge badge-cyan">${item.setor}</span></td>
                                        <td>${renderStatusModelagemBadge(item.descLocal)}</td>
                                        <td>${renderStatusProdutoBadge(item.statusProd)}</td>
                                        <td>${item.cliente || '—'}</td>
                                        <td><strong>${item.pedDescPeriodo || item.pedPeriodo || '—'}</strong></td>
                                        <td style="font-weight: 700; color: var(--text-primary);">${item.qtdeOriginal}</td>
                                        <td>${renderDiasSetorBadge(item.diasParado)}</td>
                                        <td>
                                            ${isAtraso ? 
                                                '<span class="badge badge-rose"><i class="fa-solid fa-clock"></i> Em Atraso</span>' : 
                                                '<span class="badge badge-emerald"><i class="fa-solid fa-check"></i> No Prazo</span>'
                                            }
                                        </td>
                                        <td>
                                            ${isDiasCritico ? '<span class="dias-alerta-piscando" title="Mais de 2 dias parado no setor!"><i class="fa-solid fa-fire"></i> > 2 dias</span> ' : ''}
                                            ${isDuplicate ? '<span class="badge badge-rose" title="Produto também está na linha de produção!"><i class="fa-solid fa-link"></i> Repete em Prod</span>' : (isDiasCritico ? '' : '—')}
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    // Renderizador do Modo KANBAN
    function renderKanbanBoard(items, title) {
        const colAtraso = items.filter(r => r.prazoStatus === 'ATRASO');
        const colNoPrazo = items.filter(r => r.prazoStatus === 'NO_PRAZO');
        const colGargalos = items.filter(r => ['CM1', 'D01', '43'].includes(r.setor) && state.productionCodes.has(r.codigo));

        function renderColumnCards(cardList) {
            if (cardList.length === 0) {
                return `<div style="padding: 24px 10px; text-align: center; color: var(--text-dim); font-size: 11.5px;">Nenhum item nesta etapa</div>`;
            }
            return cardList.slice(0, 50).map(item => {
                const isDuplicate = ['CM1', 'D01', '43'].includes(item.setor) && state.productionCodes.has(item.codigo);
                // Lógica RIS / OC
                let ocText = (item.oc || '').trim().toUpperCase();
                let ocHtml = '';
                if (!ocText || ocText.startsWith('S')) {
                    ocHtml = `<span class="badge" style="background: rgba(249, 115, 22, 0.15); color: #f97316; border: 1px solid rgba(249, 115, 22, 0.3);"><i class="fa-solid fa-file-invoice"></i> SEM OC</span>`;
                } else {
                    ocHtml = `<span class="badge" style="background: rgba(255, 255, 255, 0.05); color: #cbd5e1; border: 1px solid rgba(255, 255, 255, 0.1);"><i class="fa-solid fa-file-invoice"></i> OC: ${ocText}</span>`;
                }
                return `
                        <div class="kanban-card" onclick="window.crmOpenOpModal('${item.op}')">
                            <div class="kanban-card-top">
                                <span class="kanban-card-op">OP ${item.op}</span>
                                <span class="badge badge-sub">${item.setor}</span>
                            </div>
                            <div class="kanban-card-title">${item.codigo} • ${item.descricao}</div>
                            <div style="margin: 6px 0; display: flex; flex-wrap: wrap; gap: 4px;">
                                ${renderStatusModelagemBadge(item.descLocal)}
                                ${item.diasParado > 2 ? renderDiasSetorBadge(item.diasParado) : ''}
                                ${ocHtml}
                        </div>
                        ${isDuplicate ? '<span class="badge badge-rose"><i class="fa-solid fa-triangle-exclamation"></i> Repete em Produção</span>' : ''}
                        <div class="kanban-card-meta">
                            <span>${item.cliente || 'Oneda'}</span>
                            <strong>${item.qtdeOriginal} pçs</strong>
                            <span style="color: ${item.prazoStatus === 'ATRASO' ? 'var(--accent-rose)' : 'var(--accent-emerald)'}">
                                ${item.pedDescPeriodo || item.pedPeriodo}
                            </span>
                        </div>
                    </div>
                `;
            }).join('');
        }

        return `
            <div class="kanban-board">
                <div class="kanban-column">
                    <div class="kanban-column-header">
                        <span class="kanban-column-title" style="color: #fca5a5;">
                            <i class="fa-regular fa-clock" style="color: var(--accent-rose)"></i> Atividade Atrasada
                        </span>
                        <span class="kanban-column-count">${colAtraso.length}</span>
                    </div>
                    <div class="kanban-column-body">
                        ${renderColumnCards(colAtraso)}
                    </div>
                </div>

                <div class="kanban-column">
                    <div class="kanban-column-header">
                        <span class="kanban-column-title" style="color: #fde68a;">
                            <i class="fa-solid fa-triangle-exclamation" style="color: var(--accent-amber)"></i> Gargalos Críticos
                        </span>
                        <span class="kanban-column-count">${colGargalos.length}</span>
                    </div>
                    <div class="kanban-column-body">
                        ${renderColumnCards(colGargalos)}
                    </div>
                </div>

                <div class="kanban-column">
                    <div class="kanban-column-header">
                        <span class="kanban-column-title" style="color: #a7f3d0;">
                            <i class="fa-regular fa-circle-check" style="color: var(--accent-emerald)"></i> No Prazo
                        </span>
                        <span class="kanban-column-count">${colNoPrazo.length}</span>
                    </div>
                    <div class="kanban-column-body">
                        ${renderColumnCards(colNoPrazo)}
                    </div>
                </div>
            </div>
        `;
    }

    function renderDistributionList(countsObj, total, colorClass) {
        const sortedEntries = Object.entries(countsObj).sort((a, b) => b[1] - a[1]);
        if (sortedEntries.length === 0) {
            return `<div style="color: var(--text-muted); font-size: 12px;">Nenhum dado disponível</div>`;
        }

        return sortedEntries.slice(0, 8).map(([label, count]) => {
            const percent = total > 0 ? Math.round((count / total) * 100) : 0;
            return `
                <div class="dist-item">
                    <div class="dist-meta">
                        <span class="dist-name" title="${label}">${label || 'Não Informado'}</span>
                        <span class="dist-count">${count} (${percent}%)</span>
                    </div>
                    <div class="dist-bar-track">
                        <div class="dist-bar-fill ${colorClass}" style="width: ${percent}%;"></div>
                    </div>
                </div>
            `;
        }).join('');
    }

    // =========================================================================
    // MODAL DE DETALHES 360 DA OP
    // =========================================================================
    function openOpModal(opNumber) {
        const item = state.allData.find(r => r.op === opNumber);
        if (!item) return;

        state.selectedOp = item;
        const modal = document.getElementById('opDetailsModal');
        const modalOpNumber = document.getElementById('modalOpNumber');
        const modalOpTitle = document.getElementById('modalOpTitle');
        const opModalBody = document.getElementById('opModalBody');

        modalOpNumber.textContent = `OP ${item.op}`;
        modalOpTitle.textContent = `${item.codigo} - ${item.descricao}`;

        const isDuplicate = ['CM1', 'D01', '43'].includes(item.setor) && state.productionCodes.has(item.codigo);

        opModalBody.innerHTML = `
            ${isDuplicate ? `
                <div class="alert-banner" style="margin-bottom: 14px; border-radius: 8px;">
                    <div class="alert-content">
                        <i class="fa-solid fa-triangle-exclamation alert-icon"></i>
                        <span><strong>Alerta de Gargalo Duplo:</strong> Este produto possui pendência neste setor e também consta nos setores de produção (05/06/12/13/26/20/31)!</span>
                    </div>
                </div>
            ` : ''}

            ${item.diasParado > 2 ? `
                <div class="alert-banner" style="margin-bottom: 14px; border-radius: 8px; border: 1px solid ${item.setor === '13' ? '#0284c7' : '#ef4444'}; background: ${item.setor === '13' ? 'rgba(14,165,233,0.16)' : 'rgba(239,68,68,0.18)'}; animation: ${item.setor === '13' ? 'pulseBorderBlue' : 'pulseBorderRed'} 1.4s infinite ease-in-out;">
                    <div class="alert-content" style="color: ${item.setor === '13' ? '#bae6fd' : '#fca5a5'};">
                        <i class="fa-solid ${item.setor === '13' ? 'fa-clock' : 'fa-fire-flame-curved'}" style="color: ${item.setor === '13' ? '#38bdf8' : '#ef4444'}; font-size: 18px;"></i>
                        <span><strong>Atenção Operacional:</strong> Este produto está há <strong style="color:#ffffff;">${item.diasParado} dias</strong> parado no setor, ultrapassando o limite operacional de 2 dias!</span>
                    </div>
                </div>
            ` : ''}

            <div class="op-details-grid">
                <div class="op-detail-item">
                    <span class="op-detail-label">Setor Atual (Coluna AY)</span>
                    <span class="op-detail-val" style="color: var(--neon-cyan)">${item.setor} - ${item.raw['Desc Setor'] || ''}</span>
                </div>
                <div class="op-detail-item">
                    <span class="op-detail-label">Status de Modelagem (Descrição do Local)</span>
                    <span class="op-detail-val">${renderStatusModelagemBadge(item.statusModelagem || item.descLocal)}</span>
                </div>
                <div class="op-detail-item">
                    <span class="op-detail-label">Status do Produto (Coluna BD)</span>
                    <span class="op-detail-val">${item.statusProd || 'Não informado'}</span>
                </div>
                <div class="op-detail-item">
                    <span class="op-detail-label">Ordem de Compra / RIS (Coluna BG)</span>
                    <span class="op-detail-val" style="color: var(--neon-amber)">${item.oc || 'Sem OC cadastrada'}</span>
                </div>
                <div class="op-detail-item">
                    <span class="op-detail-label">Semana de Entrega (Coluna BK / BL)</span>
                    <span class="op-detail-val">${item.pedDescPeriodo || item.pedPeriodo || '—'}</span>
                </div>
                <div class="op-detail-item">
                    <span class="op-detail-label">Parte (Coluna AI / AG)</span>
                    <span class="op-detail-val" style="color: var(--accent-cyan)">${item.parte ? `${item.parte} - ${item.descParte}` : '—'}</span>
                </div>
                <div class="op-detail-item">
                    <span class="op-detail-label">Total Peças Somadas (Coluna AP)</span>
                    <span class="op-detail-val" style="color: var(--accent-emerald)">${item.qtdeOriginal} peças</span>
                </div>
                <div class="op-detail-item">
                    <span class="op-detail-label">Dias Parado no Setor (Coluna BV)</span>
                    <span class="op-detail-val">${item.setor === '13' ? renderDiasSetor13Badge(item.diasParado) : renderDiasSetorBadge(item.diasParado)}</span>
                </div>
                <div class="op-detail-item">
                    <span class="op-detail-label">Programação Amostras (Coluna CO)</span>
                    <span class="op-detail-val">${item.progAmostras || '—'}</span>
                </div>
                <div class="op-detail-item">
                    <span class="op-detail-label">Cliente / Grupo</span>
                    <span class="op-detail-val">${item.cliente || '—'}</span>
                </div>
                <div class="op-detail-item">
                    <span class="op-detail-label">Marca / Licença</span>
                    <span class="op-detail-val">${item.marca || '—'}</span>
                </div>
                <div class="op-detail-item">
                    <span class="op-detail-label">Data de Faturamento</span>
                    <span class="op-detail-val">${item.dtFatura || '—'}</span>
                </div>
                <div class="op-detail-item">
                    <span class="op-detail-label">Status do Prazo</span>
                    <span class="op-detail-val" style="color: ${item.prazoStatus === 'ATRASO' ? 'var(--accent-rose)' : 'var(--accent-emerald)'}">
                        ${item.prazoStatus === 'ATRASO' ? '🚨 Em Atraso' : '✓ No Prazo'}
                    </span>
                </div>

                <!-- Detalhamento dos Tamanhos Somados do Produto -->
                <div class="op-detail-item" style="grid-column: 1 / -1; margin-top: 4px;">
                    <span class="op-detail-label">Composição da Grade de Tamanhos (${item.gradeTamanhos.length} tamanhos somados neste produto)</span>
                    <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 6px;">
                        ${item.gradeTamanhos.map(g => `
                            <span class="badge badge-sub" style="font-size: 11.5px; padding: 4px 8px; border: 1px solid var(--border-base);">
                                Tam <strong>${g.tamanho || 'U'}</strong>: <span style="color: var(--text-primary); font-weight: 600;">${g.qtde} pçs</span>
                            </span>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;

        modal.style.display = 'flex';
    }

    function copyOpSummary() {
        if (!state.selectedOp) return;
        const item = state.selectedOp;
        const text = `*OP:* ${item.op} | *Ref:* ${item.codigo} - ${item.descricao}\n*Cliente:* ${item.cliente} | *Marca:* ${item.marca}\n*Setor:* ${item.setor} | *Status Modelagem (Col Z):* ${item.descLocal}\n*Status Produto (Col BD):* ${item.statusProd}\n*Semana Entrega (Col BK):* ${item.pedDescPeriodo} | *Peças (Col AP):* ${item.qtdeOriginal}\n*Dias Parado (Col BV):* ${item.diasParado} dias | *Prazo:* ${item.prazoStatus}`;
        
        navigator.clipboard.writeText(text).then(() => {
            showNotification('Resumo da OP copiado para a área de transferência!', 'success');
        });
    }

    // =========================================================================
    // MODAL DE BUSCA GLOBAL (CTRL + K)
    // =========================================================================
    function openSearchModal() {
        const modal = document.getElementById('searchModal');
        const input = document.getElementById('quickSearchModalInput');
        modal.style.display = 'flex';
        input.value = '';
        input.focus();
        handleQuickSearchModal();
    }

    function handleQuickSearchModal() {
        const query = document.getElementById('quickSearchModalInput').value.toLowerCase().trim();
        const resultsContainer = document.getElementById('searchModalResults');

        if (!query) {
            resultsContainer.innerHTML = `<div class="search-empty-state"><p>Digite algo para pesquisar em todos os ${state.allData.length} registros...</p></div>`;
            return;
        }

        const matches = state.allData.filter(r => 
            r.op.toLowerCase().includes(query) ||
            r.codigo.toLowerCase().includes(query) ||
            r.descricao.toLowerCase().includes(query) ||
            r.cliente.toLowerCase().includes(query) ||
            r.setor.toLowerCase().includes(query) ||
            r.descLocal.toLowerCase().includes(query)
        ).slice(0, 15);

        if (matches.length === 0) {
            resultsContainer.innerHTML = `<div class="search-empty-state"><p>Nenhum resultado encontrado para "<strong>${query}</strong>".</p></div>`;
            return;
        }

        resultsContainer.innerHTML = matches.map(item => `
            <div class="search-result-item" onclick="window.crmOpenOpModal('${item.op}'); window.crmCloseAllModals();">
                <div>
                    <strong style="color: var(--neon-cyan);">${item.op}</strong> — ${item.codigo} (${item.descricao})
                    <div style="font-size: 11px; color: var(--text-muted); margin-top: 3px;">
                        Setor: <span class="badge badge-sub">${item.setor}</span> • Cliente: ${item.cliente} • Semana: ${item.pedDescPeriodo}
                    </div>
                </div>
                <span class="badge ${item.prazoStatus === 'ATRASO' ? 'badge-rose' : 'badge-emerald'}">
                    ${item.prazoStatus === 'ATRASO' ? 'Atrasado' : 'No Prazo'}
                </span>
            </div>
        `).join('');
    }

    function closeAllModals() {
        document.querySelectorAll('.modal-overlay').forEach(m => m.style.display = 'none');
    }

    // =========================================================================
    // AÇÕES GLOBAIS: SINCRONIZAR E EXPORTAR CSV
    // =========================================================================
    async function syncGoogleSheets() {
        const btn = document.getElementById('btnSyncSheets');
        let originalHtml = '';
        if (btn) {
            originalHtml = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-arrows-rotate fa-spin"></i> <span>Sincronizando...</span>';
        }
        updateSystemStatus('Baixando planilha do Google Sheets...', false);
        showNotification('Conectando ao Google Sheets para baixar a versão mais recente...', 'info', 'Sincronização Iniciada');

        try {
            const res = await adminFetch('/api/sync', { method: 'POST' });
            const json = await res.json();
            if (!json.success) throw new Error(json.error || 'Erro desconhecido retornado pelo servidor');

            await loadCRMData('full');
            showNotification(`Planilha atualizada com sucesso! ${formatNumber(json.count)} registros carregados diretamente do Google Drive.`, 'success', 'Sincronização Concluída');
            updateSystemStatus('Online (Sincronizado)', true);
        } catch (e) {
            console.error('[SYNC ERROR]', e);
            showNotification(`Falha na sincronização com Google Sheets: ${e.message}`, 'danger', 'Erro na Sincronização');
            updateSystemStatus('Erro ao sincronizar', false);
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = originalHtml || '<i class="fa-solid fa-arrows-rotate"></i> <span>Sincronizar Sheets</span>';
            }
        }
    }

    async function syncDriveImages() {
        const btns = document.querySelectorAll('.btn-sync-images-action');
        btns.forEach(btn => {
            btn.dataset.origHtml = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-arrows-rotate fa-spin"></i> <span>Sincronizando Fotos...</span>';
        });
        showNotification('Varrendo pastas do Google Drive e diretórios locais para atualizar as fotos dos produtos...', 'info', 'Sincronizando Fotos');

        try {
            const res = await adminFetch('/api/drive-images?refresh=1', { method: 'POST' });
            const json = await res.json();
            if (!json.success && json.error) throw new Error(json.error);

            if (json.data && json.data.map) {
                state.driveImages = json.data.map;
                state.imagesLoaded = true;
            }
            updateSidebarBadges();
            renderActiveView();
            showNotification(`Fotos atualizadas com sucesso! ${formatNumber(json.count || 0)} fotos de produtos indexadas e prontas.`, 'success', 'Sincronização Concluída');
        } catch (e) {
            console.error('[SYNC IMAGES ERROR]', e);
            showNotification(`Falha ao sincronizar fotos: ${e.message}`, 'danger', 'Erro na Sincronização');
        } finally {
            btns.forEach(btn => {
                btn.disabled = false;
                btn.innerHTML = btn.dataset.origHtml || '<i class="fa-solid fa-images"></i> <span>Sincronizar Fotos</span>';
            });
        }
    }

    function exportCurrentTableCSV() {
        let exportData = state.filteredData || [];
        let moduleName = state.activeSubmodule;
        let csvRows = [];

        if (moduleName === 'cores' || moduleName === 'cores-aviamentos') {
            exportData = (state.coresExternalData && state.coresExternalData.records) || [];
            if (exportData.length === 0) return showNotification('Sem dados de Cores para exportar.', 'warning');
            csvRows = [Object.keys(exportData[0] || {}).join(';')];
            exportData.forEach(r => csvRows.push(Object.values(r).map(v => '"' + String(v || '').replace(/"/g, '""') + '"').join(';')));
        } else if (moduleName === 'aviamentos') {
            exportData = (state.aviamentosExternalData && state.aviamentosExternalData.records) || [];
            if (exportData.length === 0) return showNotification('Sem dados de Aviamentos para exportar.', 'warning');
            csvRows = [Object.keys(exportData[0] || {}).join(';')];
            exportData.forEach(r => csvRows.push(Object.values(r).map(v => '"' + String(v || '').replace(/"/g, '""') + '"').join(';')));
        } else if (moduleName === 'andamento-cq' || moduleName === 'aproveitamento' || moduleName === 'cq') {
            exportData = (state.cqExternalData && state.cqExternalData.records) || [];
            if (exportData.length === 0) return showNotification('Sem dados de CQ para exportar.', 'warning');
            csvRows = [Object.keys(exportData[0] || {}).join(';')];
            exportData.forEach(r => csvRows.push(Object.values(r).map(v => '"' + String(v || '').replace(/"/g, '""') + '"').join(';')));
        } else if (moduleName === 'leadtime') {
            exportData = (state.leadtimeExternalData && state.leadtimeExternalData.records) || [];
            if (exportData.length === 0) return showNotification('Sem dados de Leadtime para exportar.', 'warning');
            csvRows = [Object.keys(exportData[0] || {}).join(';')];
            exportData.forEach(r => csvRows.push(Object.values(r).map(v => '"' + String(v || '').replace(/"/g, '""') + '"').join(';')));
        } else {
            if (!exportData || exportData.length === 0) return showNotification('Nenhum dado filtrado para exportar.', 'warning');
            const headers = ['OP', 'C�digo', 'Descri��o', 'Setor (AY)', 'Status Modelagem (Z)', 'Status Produto (BD)', 'Ordem Compra (BG)', 'Semana Entrega (BK)', 'Quantidade Pe�as (AP)', 'Dias Parado (BV)', 'Programa��o Amostras (CO)', 'Cliente', 'Marca', 'Prazo'];
            csvRows = [headers.join(';')];
            exportData.forEach(r => {
                csvRows.push([
                    r.op, r.codigo, '"' + (r.descricao || '').replace(/"/g, '""') + '"', r.setor,
                    '"' + (r.descLocal || '').replace(/"/g, '""') + '"', '"' + (r.statusProd || '').replace(/"/g, '""') + '"',
                    r.oc, '"' + (r.pedDescPeriodo || r.pedPeriodo || '').replace(/"/g, '""') + '"',
                    r.qtdeOriginal, r.diasParado, '"' + (r.progAmostras || '').replace(/"/g, '""') + '"',
                    '"' + (r.cliente || '').replace(/"/g, '""') + '"', '"' + (r.marca || '').replace(/"/g, '""') + '"', r.prazoStatus
                ].join(';'));
            });
        }

        const blob = new Blob(['\uFEFF' + csvRows.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Oneda_CRM_Export_${moduleName}_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showNotification('Dados exportados com sucesso!', 'success');
    }

    async function handleCsvUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        updateSystemStatus('Enviando novo CSV...', false);
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const text = e.target.result;
                const res = await adminFetch('/api/upload', {
                    method: 'POST',
                    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
                    body: text
                });
                const json = await res.json();
                if (!json.success) throw new Error(json.error);

                showNotification(`Planilha com ${json.count} OPs carregada com sucesso!`, 'success');
                await loadCRMData();
            } catch (err) {
                showNotification(`Erro ao enviar CSV: ${err.message}`, 'danger');
            }
        };
        reader.readAsText(file);
    }

    // =========================================================================
    // HELPERS & UTILITÁRIOS
    // =========================================================================
    function countBy(arr, key) {
        return arr.reduce((acc, item) => {
            const val = item[key] || 'Não Informado';
            acc[val] = (acc[val] || 0) + 1;
            return acc;
        }, {});
    }

    function formatNumber(num) {
        return new Intl.NumberFormat('pt-BR').format(num || 0);
    }

    function updateSystemStatus(text, isOnline) {
        const elem = document.getElementById('systemStatusText');
        if (elem) elem.textContent = text;
    }

    function showNotification(msg, type = 'info', title = null) {
        const toastContainer = document.getElementById('toastContainer');
        if (toastContainer) {
            const toast = document.createElement('div');
            toast.className = `toast-item ${type}`;

            let iconClass = 'fa-solid fa-circle-info';
            let defaultTitle = 'Notificação';
            if (type === 'success') {
                iconClass = 'fa-solid fa-circle-check';
                defaultTitle = 'Sucesso';
            } else if (type === 'danger') {
                iconClass = 'fa-solid fa-triangle-exclamation';
                defaultTitle = 'Atenção';
            } else if (type === 'warning') {
                iconClass = 'fa-solid fa-bell';
                defaultTitle = 'Aviso';
            }

            toast.innerHTML = `
                <i class="${iconClass} toast-icon"></i>
                <div class="toast-content">
                    <div class="toast-title">${title || defaultTitle}</div>
                    <div class="toast-message">${msg}</div>
                </div>
                <button class="toast-close-btn" title="Fechar">&times;</button>
            `;

            const closeBtn = toast.querySelector('.toast-close-btn');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => {
                    toast.classList.add('toast-hiding');
                    setTimeout(() => toast.remove(), 250);
                });
            }

            toastContainer.appendChild(toast);

            setTimeout(() => {
                if (toast.parentElement) {
                    toast.classList.add('toast-hiding');
                    setTimeout(() => toast.remove(), 250);
                }
            }, 5000);
        }

        const banner = document.getElementById('globalAlertBanner');
        const text = document.getElementById('alertBannerText');
        if (banner && text) {
            banner.style.display = 'flex';
            text.innerHTML = msg;
            setTimeout(() => {
                banner.style.display = 'none';
            }, 6000);
        }
    }

    // Exportação para o escopo global (para eventos inline do HTML)
    window.crmOpenOpModal = openOpModal;
    window.crmCloseAllModals = closeAllModals;
    window.crmSyncGoogleSheets = syncGoogleSheets;
    window.crmSyncImages = syncDriveImages;
    window.crmExportFilteredCSV = exportCurrentTableCSV;
    window.crmHandleCsvUpload = handleCsvUpload;
    window.crmToggleSource = () => {
        state.sourceType = state.sourceType === 'full' ? 'raw' : 'full';
        loadCRMData(state.sourceType);
    };
    window.crmNavigate = (mod, sub) => {
        const targetLink = document.querySelector(`.nav-link[data-module="${mod}"][data-submodule="${sub}"]`);
        if (targetLink) targetLink.click();
    };
    window.crmFilterAlerts = severity => {
        state.alertsSeverity = ['critical', 'warning', 'info'].includes(severity) ? severity : 'all';
        state.alertsPageLimit = 30;
        renderActiveView();
    };
    window.crmSetAlertsTab = tab => {
        state.alertsTab = tab === 'rules' ? 'rules' : 'active';
        renderActiveView();
    };
    window.crmFilterAlertsCategory = category => {
        const availableCategories = new Set((state.activeAlerts || []).map(alert => getAlertCategory(alert).key));
        state.alertsCategory = category === 'all' || availableCategories.has(category) ? category : 'all';
        state.alertsPageLimit = 30;
        renderActiveView();
    };
    let alertsSearchTimer = null;
    window.crmSearchAlerts = query => {
        state.alertsSearch = query || '';
        state.alertsPageLimit = 30;
        clearTimeout(alertsSearchTimer);
        alertsSearchTimer = setTimeout(renderActiveView, 180);
    };
    window.crmLoadMoreAlerts = () => {
        state.alertsPageLimit = (state.alertsPageLimit || 30) + 30;
        renderActiveView();
    };
    window.crmRefreshAlerts = () => {
        recalculateAlerts();
        updateAlertsBadges();
        renderActiveView();
        showNotification(`${state.activeAlerts.length} alertas recalculados com os dados atuais.`, 'success', 'Alertas Atualizados');
    };
    window.crmSearchProcesso = (query) => {
        state.processoSearch = query || '';
        renderActiveView();
    };
    window.crmFilterProcesso = (statusKey) => {
        state.processoFilter = (state.processoFilter === statusKey) ? null : statusKey;
        renderActiveView();
        if (state.processoFilter === 'ruins' || (state.processoFilter && isModelagemPendenciaRuim(state.processoFilter))) {
            const gallery = document.getElementById('processoGallerySection');
            if (gallery && typeof gallery.scrollIntoView === 'function') {
                gallery.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        } else {
            const table = document.getElementById('processoTableSection');
            if (table && typeof table.scrollIntoView === 'function') {
                table.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }
        if (state.processoFilter === 'ruins') {
            showNotification('Filtrando produtos com <strong>Pendência de Modelagem</strong>', 'info', 'Filtro Modelagem');
        } else if (state.processoFilter === 'bons') {
            showNotification('Filtrando produtos <strong>Sem Pendência (Liberados)</strong>', 'info', 'Filtro Modelagem');
        } else if (state.processoFilter) {
            showNotification(`Filtrando produtos com status: <strong>${state.processoFilter}</strong>`, 'info', 'Filtro de Status');
        } else {
            showNotification('Exibindo todos os produtos em processo.', 'info', 'Filtro Removido');
        }
    };

    window.crmFilterFeiraSector = (sectorCode) => {
        state.feiraSectorFilter = (state.feiraSectorFilter === sectorCode) ? null : sectorCode;
        renderActiveView();
        const table = document.getElementById('feiraTableSection');
        if (table && typeof table.scrollIntoView === 'function') {
            table.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        if (state.feiraSectorFilter) {
            showNotification(`Filtrando protótipos do Setor <strong>${state.feiraSectorFilter}</strong>`, 'info', 'Filtro de Setor');
        } else {
            showNotification('Exibindo todos os protótipos do Fluxo D36.', 'info', 'Filtro Removido');
        }
    };

    window.crmFilterEstampa = (filterKey) => {
        state.estampaFilter = (state.estampaFilter === filterKey) ? null : filterKey;
        renderActiveView();
        const table = document.getElementById('estampaTableSection');
        if (table && typeof table.scrollIntoView === 'function') {
            table.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        if (state.estampaFilter === 'pendentes') {
            showNotification('Filtrando produtos <strong>Com Pendência de Estampa</strong>', 'info', 'Filtro de Estampa');
        } else if (state.estampaFilter === 'sem_pendencia') {
            showNotification('Filtrando produtos <strong>Sem Pendência (Liberados/Aprovados)</strong>', 'info', 'Filtro de Estampa');
        } else if (state.estampaFilter) {
            showNotification(`Filtrando produtos com status: <strong>${state.estampaFilter}</strong>`, 'info', 'Filtro de Status');
        } else {
            showNotification('Exibindo todos os produtos de estampa.', 'info', 'Filtro Removido');
        }
    };

    window.crmFilterSetor13 = (field, value) => {
        if (state.setor13Filter && state.setor13Filter.field === field && state.setor13Filter.value === value) {
            state.setor13Filter = null;
        } else if (field && value) {
            state.setor13Filter = { field, value };
        } else {
            state.setor13Filter = null;
        }
        renderActiveView();
        const table = document.getElementById('setor13TableSection');
        if (table && typeof table.scrollIntoView === 'function') {
            table.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        if (state.setor13Filter) {
            showNotification(`Filtrando produtos do Setor 13 por <strong>${field}</strong>: <strong>${value}</strong>`, 'info', 'Filtro Setor 13');
        } else {
            showNotification('Exibindo todos os produtos do Setor 13.', 'info', 'Filtro Removido');
        }
    };

    window.crmSearchSetor13 = (query) => {
        state.setor13Search = query || '';
        renderActiveView();
    };

    window.crmToggleSetor13ViewMode = (mode) => {
        state.setor13ViewMode = mode;
        renderActiveView();
    };

    window.crmSearchEstampa = (query) => {
        state.estampaSearch = query || '';
        renderActiveView();
    };

    window.crmToggleEstampaViewMode = (mode) => {
        state.estampaViewMode = mode;
        renderActiveView();
    };

    window.crmFilterSetor01 = (fieldOrType, value) => {
        if (!fieldOrType) {
            state.setor01Filter = null;
        } else if (fieldOrType === 'criticos') {
            state.setor01Filter = (state.setor01Filter === 'criticos') ? null : 'criticos';
        } else if (fieldOrType && value) {
            if (state.setor01Filter && state.setor01Filter.field === fieldOrType && state.setor01Filter.value === value) {
                state.setor01Filter = null;
            } else {
                state.setor01Filter = { field: fieldOrType, value };
            }
        } else {
            state.setor01Filter = null;
        }
        renderActiveView();
        const resultsSection = document.getElementById(
            state.setor01ViewMode === 'table' ? 'setor01TableSection' : 'setor01GallerySection'
        );
        if (resultsSection && typeof resultsSection.scrollIntoView === 'function') {
            resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        if (state.setor01Filter === 'criticos') {
            showNotification('Filtrando produtos com <strong>Permanência Crítica (> 2 Dias) no Setor 01</strong>', 'warning', 'Setor 01');
        } else if (state.setor01Filter) {
            showNotification(`Filtrando produtos do Setor 01 por ${state.setor01Filter.field}: <strong>${state.setor01Filter.value}</strong>`, 'info', 'Filtro Setor 01');
        } else {
            showNotification('Exibindo todos os produtos pendentes no Setor 01.', 'info', 'Filtro Removido');
        }
    };

    window.crmSearchSetor01 = (query) => {
        state.setor01Search = query || '';
        renderActiveView();
    };

    window.crmToggleSetor01ViewMode = (mode) => {
        state.setor01ViewMode = mode;
        renderActiveView();
    };

    // CONTROLES GLOBAIS: CORES PENDENTES (SETOR D01)
    window.crmFilterCoresPendentes = (filter) => {
        if (!filter) {
            state.coresFilter = null;
        } else if (typeof filter === 'string') {
            state.coresFilter = (state.coresFilter === filter) ? null : filter;
        } else if (typeof filter === 'object') {
            if (state.coresFilter && state.coresFilter.field === filter.field && state.coresFilter.clientName === filter.clientName) {
                state.coresFilter = null;
            } else {
                state.coresFilter = filter;
            }
        }
        renderActiveView();
        if (state.coresFilter && state.coresFilter.clientName) {
            showNotification(`Filtrando Setor D01 por Cliente: <strong>${state.coresFilter.clientName}</strong>`, 'info', 'Cores Pendentes');
        } else {
            showNotification('Exibindo todos os produtos do Setor D01.', 'info', 'Filtro Removido');
        }
    };

    let coresPendentesSearchDebounceTimer = null;
    window.crmSearchCoresPendentes = (query) => {
        state.coresSearch = query || '';
        clearTimeout(coresPendentesSearchDebounceTimer);
        coresPendentesSearchDebounceTimer = setTimeout(() => {
            renderActiveView();
        }, 120);
    };

    // CONTROLES GLOBAIS: AVIAMENTOS PENDENTES (SETOR X01)
    window.crmFilterAviamentosPendentes = (filter) => {
        if (!filter) {
            state.aviamentosFilter = null;
        } else if (typeof filter === 'string') {
            state.aviamentosFilter = (state.aviamentosFilter === filter) ? null : filter;
        } else if (typeof filter === 'object') {
            if (state.aviamentosFilter && state.aviamentosFilter.field === filter.field && state.aviamentosFilter.clientName === filter.clientName) {
                state.aviamentosFilter = null;
            } else {
                state.aviamentosFilter = filter;
            }
        }
        renderActiveView();
        if (state.aviamentosFilter && state.aviamentosFilter.clientName) {
            showNotification(`Filtrando Setor X01 por Cliente: <strong>${state.aviamentosFilter.clientName}</strong>`, 'info', 'Aviamentos Pendentes');
        } else {
            showNotification('Exibindo todos os produtos do Setor X01.', 'info', 'Filtro Removido');
        }
    };

    let aviamentosPendentesSearchDebounceTimer = null;
    window.crmSearchAviamentosPendentes = (query) => {
        state.aviamentosSearch = query || '';
        clearTimeout(aviamentosPendentesSearchDebounceTimer);
        aviamentosPendentesSearchDebounceTimer = setTimeout(() => {
            renderActiveView();
        }, 120);
    };

    // SINCRONIZAÇÃO DE PLANILHAS EXTERNAS (GOOGLE DRIVE)
    
    // CONTROLES: ROTATIVOS (SETOR 43 & DRIVE)
    window.crmToggleRotativosTab = (tab) => {
        state.rotativosActiveTab = tab;
        renderActiveView();
    };

    window.crmFilterRotativosDrive = (filter) => {
        if (state.rotativosDriveFilter === filter) {
            state.rotativosDriveFilter = null;
        } else {
            state.rotativosDriveFilter = filter;
        }
        state.rotativosActiveTab = 'drive';
        renderActiveView();
    };

    let progFeiraSearchTimer = null;
    window.crmSearchProgFeira = query => {
        state.progFeiraSearch = query || '';
        clearTimeout(progFeiraSearchTimer);
        progFeiraSearchTimer = setTimeout(renderActiveView, 180);
    };

    window.crmFilterProgFeiraSector = sector => {
        state.progFeiraSector = sector && sector !== state.progFeiraSector ? sector : 'all';
        renderActiveView();
    };

    window.crmFilterProgFeiraTing = ting => {
        state.progFeiraTing = ting || 'all';
        renderActiveView();
    };

    window.crmToggleProgFeiraDes = () => {
        state.progFeiraDesOnly = !state.progFeiraDesOnly;
        renderActiveView();
    };

    window.crmClearProgFeiraFilters = () => {
        state.progFeiraSearch = '';
        state.progFeiraSector = 'all';
        state.progFeiraTing = 'all';
        state.progFeiraDesOnly = false;
        renderActiveView();
    };

    window.crmSyncProgFeira = async () => {
        showNotification('Atualizando a programação de feira...', 'info', 'Prog Feira');
        try {
            const response = await adminFetch('/api/external-sheet?type=prog_feira&refresh=1', { method: 'POST' });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok || !payload.success) throw new Error(payload.error || `HTTP ${response.status}`);
            state.progFeiraExternalData = payload;
            updateSidebarBadges();
            renderActiveView();
            showNotification(`${window.CRMProgFeira.buildProducts(payload.records || []).length} referências atualizadas.`, 'success', 'Prog Feira');
        } catch (error) {
            showNotification(`Não foi possível atualizar: ${error.message}`, 'warning', 'Prog Feira');
        }
    };

    let rotativosDriveSearchDebounceTimer = null;
    window.crmSearchRotativosDrive = (query) => {
        state.rotativosDriveSearch = query || '';
        if (rotativosDriveSearchDebounceTimer) clearTimeout(rotativosDriveSearchDebounceTimer);
        rotativosDriveSearchDebounceTimer = setTimeout(() => {
            renderActiveView();
        }, 120);
    };

    window.crmSyncExternalSheets = async (type = 'all') => {
        showNotification(`Sincronizando planilha ${type === 'all' ? 'de Cores e Aviamentos' : type} do Google Drive...`, 'info', 'Sincronização Drive');
        try {
            await loadExternalSheets(true);
            showNotification('Planilhas externas sincronizadas com sucesso!', 'success', 'Google Drive Atualizado');
        } catch (e) {
            showNotification('Erro ao sincronizar planilha do Drive: ' + e.message, 'warning', 'Erro de Sincronização');
        }
    };

    // CONTROLES LEGADOS: CORES & AVIAMENTOS (SETOR X01 / D01)
    window.crmFilterCoresAviamentos = (filter) => {
        state.coresAviamentosPageLimit = 32;
        if (!filter) {
            state.coresAviamentosFilter = null;
        } else if (typeof filter === 'string') {
            state.coresAviamentosFilter = (state.coresAviamentosFilter === filter) ? null : filter;
        } else if (typeof filter === 'object') {
            if (state.coresAviamentosFilter && 
                state.coresAviamentosFilter.field === filter.field && 
                state.coresAviamentosFilter.setor === filter.setor && 
                state.coresAviamentosFilter.clientName === filter.clientName) {
                state.coresAviamentosFilter = null;
            } else {
                state.coresAviamentosFilter = filter;
            }
        }
        renderActiveView();
    };

    window.crmSearchCoresAviamentos = (query) => {
        state.coresAviamentosSearch = query || '';
        renderActiveView();
    };

    window.crmToggleCoresAviamentosViewMode = (mode) => {
        state.coresAviamentosViewMode = mode;
        renderActiveView();
    };

    window.crmLoadMoreCoresAviamentos = () => {
        state.coresAviamentosPageLimit = (state.coresAviamentosPageLimit || 32) + 32;
        renderActiveView();
    };

    window.crmShowAllCoresAviamentos = () => {
        state.coresAviamentosPageLimit = 99999;
        renderActiveView();
    };

    window.crmFilterRotativos = (fieldOrType, value) => {
        if (!fieldOrType) {
            state.rotativosFilter = null;
        } else if (fieldOrType === 'repetidos' || fieldOrType === 'regulares') {
            state.rotativosFilter = (state.rotativosFilter === fieldOrType) ? null : fieldOrType;
        } else if (fieldOrType && value) {
            if (state.rotativosFilter && state.rotativosFilter.field === fieldOrType && state.rotativosFilter.value === value) {
                state.rotativosFilter = null;
            } else {
                state.rotativosFilter = { field: fieldOrType, value };
            }
        } else {
            state.rotativosFilter = null;
        }
        renderActiveView();
        const table = document.getElementById('rotativosTableSection');
        if (table && typeof table.scrollIntoView === 'function') {
            table.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        if (state.rotativosFilter === 'repetidos') {
            showNotification('Filtrando produtos com <strong>Gargalo Crítico (Repetem na Produção)</strong>', 'warning', 'Rotativos Setor 43');
        } else if (state.rotativosFilter === 'regulares') {
            showNotification('Filtrando <strong>Rotativos Regulares (Sem conflito de produção)</strong>', 'info', 'Rotativos Setor 43');
        } else if (state.rotativosFilter) {
            showNotification(`Filtrando produtos com ${state.rotativosFilter.field}: <strong>${state.rotativosFilter.value}</strong>`, 'info', 'Filtro Rotativos');
        } else {
            showNotification('Exibindo todos os produtos de rotativo do Setor 43.', 'info', 'Filtro Removido');
        }
    };

    window.crmSearchRotativos = (query) => {
        state.rotativosSearch = query || '';
        renderActiveView();
    };

    window.crmToggleRotativosViewMode = (mode) => {
        state.rotativosViewMode = mode;
        renderActiveView();
    };

    // CONTROLES GLOBAIS: ANDAMENTO DO CQ (CONTROLE DE QUALIDADE)
    window.crmSetCQDisplayMode = (mode) => {
        state.cqDisplayMode = mode;
        renderActiveView();
    };

    window.crmSetCQViewMode = (isAll) => {
        state.cqViewAllMode = isAll;
        renderActiveView();
    };

    
    // CONTROLES GLOBAIS: MALOTES (SETORES 88 E 83)
    window.crmFilterMalotes = (filter) => {
        if (!filter) {
            state.malotesFilter = null;
        } else if (typeof filter === 'object') {
            if (state.malotesFilter && state.malotesFilter.field === filter.field && state.malotesFilter.value === filter.value) {
                state.malotesFilter = null;
            } else {
                state.malotesFilter = filter;
            }
        } else {
            state.malotesFilter = null;
        }
        renderActiveView();
        if (state.malotesFilter) {
            showNotification(`Filtrando Malotes por ${state.malotesFilter.field}: <strong>${state.malotesFilter.value}</strong>`, 'info', 'Filtro Malotes');
        } else {
            showNotification('Exibindo todos os malotes.', 'info', 'Filtro Removido');
        }
    };

    let malotesSearchDebounceTimer = null;
    window.crmSearchMalotes = (query) => {
        state.malotesSearch = query || '';
        clearTimeout(malotesSearchDebounceTimer);
        malotesSearchDebounceTimer = setTimeout(() => {
            renderActiveView();
        }, 120);
    };


    window.crmSetAproveitamentoPeriod = (period) => {
        state.aproveitamentoPeriod = period || 'all';
        renderActiveView();
    };

    window.crmSetAproveitamentoClient = (client) => {
        state.aproveitamentoClient = client || 'all';
        renderActiveView();
    };

    window.crmSetAproveitamentoCustomDate = (boundary, value) => {
        if (boundary === 'start') state.aproveitamentoDateStart = value || '';
        if (boundary === 'end') state.aproveitamentoDateEnd = value || '';
        renderActiveView();
    };

    window.crmSearchAproveitamento = (query) => {
        state.aproveitamentoSearch = query || '';
        renderActiveView();
    };

    window.crmFilterCQ = (filter) => {
        if (!filter) {
            state.cqFilter = null;
        } else if (typeof filter === 'object') {
            if (state.cqFilter && state.cqFilter.field === filter.field && state.cqFilter.value === filter.value) {
                state.cqFilter = null;
            } else {
                state.cqFilter = filter;
            }
        } else {
            state.cqFilter = null;
        }
        renderActiveView();
        if (state.cqFilter) {
            showNotification(`Filtrando CQ por ${state.cqFilter.field}: <strong>${state.cqFilter.value}</strong>`, 'info', 'Filtro CQ');
        } else {
            showNotification('Exibindo todas as amostras do CQ.', 'info', 'Filtro Removido');
        }
    };

    let cqSearchDebounceTimer = null;
    window.crmSearchCQ = (query) => {
        state.cqSearch = query || '';
        clearTimeout(cqSearchDebounceTimer);
        cqSearchDebounceTimer = setTimeout(() => {
            renderActiveView();
        }, 120);
    };

    window.crmSyncCQDrive = async () => {
        showNotification('Sincronizando Andamento do CQ diretamente com a planilha do Google Drive...', 'info', 'Sincronização CQ');
        try {
            const res = await adminFetch('/api/external-sheet?type=cq&refresh=1', { method: 'POST' });
            const data = await res.json();
            if (data && data.success) {
                state.cqExternalData = data;
                updateSidebarBadges();
                renderActiveView();
                showNotification(`Planilha de CQ sincronizada com sucesso! <strong>${data.count || 0} pedidos/amostras carregados</strong>`, 'success', 'CQ Atualizado');
            } else {
                showNotification('Não foi possível obter dados ao vivo da nuvem. Mantendo dados locais.', 'warning', 'Aviso CQ');
            }
        } catch (e) {
            showNotification(`Erro ao conectar com Google Drive: ${e.message}`, 'error', 'Erro CQ');
        }
    };

    window.crmOpenCQImportModal = () => {
        let modal = document.getElementById('crmCQImportModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'crmCQImportModal';
            modal.className = 'modal-overlay';
            modal.style.display = 'flex';
            modal.innerHTML = `
                <div class="modal-card" style="max-width: 650px; width: 90%; background: #0f172a; border: 1px solid rgba(56, 189, 248, 0.4); border-radius: 12px; padding: 24px; box-shadow: 0 20px 50px rgba(0,0,0,0.6);">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 12px;">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <i class="fa-solid fa-file-import" style="color: #38bdf8; font-size: 20px;"></i>
                            <h3 style="margin: 0; color: #ffffff; font-size: 17px; font-weight: 700;">Colar / Importar Dados da Planilha de CQ</h3>
                        </div>
                        <button onclick="window.crmCloseCQImportModal()" style="background: none; border: none; color: #94a3b8; font-size: 22px; cursor: pointer;">&times;</button>
                    </div>
                    <p style="font-size: 12.5px; color: #94a3b8; margin-bottom: 12px;">
                        Copie as linhas da sua planilha do Google Sheets (ou export CSV/TSV) e cole na caixa abaixo. Todas as <strong>199 linhas/pedidos</strong> serão instantaneamente atualizadas no painel e gráficos:
                    </p>
                    <textarea id="cqPasteInput" rows="10" placeholder="Cole aqui o conteúdo copiado da planilha (incluindo o cabeçalho se houver)..." style="width: 100%; box-sizing: border-box; background: #090d16; border: 1px solid rgba(56, 189, 248, 0.3); border-radius: 8px; color: #e2e8f0; font-family: monospace; font-size: 12px; padding: 12px; resize: vertical;"></textarea>
                    <div style="display: flex; align-items: center; justify-content: flex-end; gap: 10px; margin-top: 16px;">
                        <button class="btn btn-glass" onclick="window.crmCloseCQImportModal()" style="padding: 8px 16px; font-size: 13px;">Cancelar</button>
                        <button class="btn btn-primary" onclick="window.crmSubmitCQImport()" style="padding: 8px 18px; font-size: 13px; background: #0284c7; color: #ffffff; border: none; border-radius: 6px; font-weight: 700; cursor: pointer;">
                            <i class="fa-solid fa-cloud-arrow-up"></i> Atualizar Dados Agora
                        </button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        } else {
            modal.style.display = 'flex';
        }
    };

    window.crmCloseCQImportModal = () => {
        const modal = document.getElementById('crmCQImportModal');
        if (modal) modal.style.display = 'none';
    };

    window.crmSubmitCQImport = async () => {
        const input = document.getElementById('cqPasteInput');
        if (!input || !input.value.trim()) {
            showNotification('Por favor, cole os dados da planilha antes de continuar.', 'warning', 'Aviso');
            return;
        }

        const rawText = input.value.trim();
        showNotification('Processando e atualizando registros do CQ...', 'info', 'Importando');

        try {
            const res = await adminFetch('/api/external-sheet/import', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'cq', csvText: rawText })
            });
            const data = await res.json();
            if (data && data.success) {
                state.cqExternalData = data;
                updateSidebarBadges();
                renderActiveView();
                window.crmCloseCQImportModal();
                showNotification(`Sucesso! <strong>${data.count} pedidos/amostras carregados no CQ</strong>.`, 'success', 'CQ Atualizado');
            } else {
                showNotification('Erro ao processar dados colados: ' + (data.error || 'Formato inválido'), 'error', 'Erro');
            }
        } catch (e) {
            showNotification('Erro ao enviar dados para o servidor: ' + e.message, 'error', 'Erro');
        }
    };

    window.crmOpenImageLightbox = (imageUrl, title, subtitle, fallbackUrl = '') => {
        const safeImageUrl = (value) => {
            const url = String(value || '').trim();
            return url.startsWith('/') || url.startsWith('https://') || url.startsWith('data:image/') ? url : '';
        };
        const resolvedImageUrl = safeImageUrl(imageUrl);
        const resolvedFallbackUrl = safeImageUrl(fallbackUrl);
        let overlay = document.getElementById('crmImageLightboxOverlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'crmImageLightboxOverlay';
            overlay.className = 'image-lightbox-overlay';
            overlay.onclick = (e) => {
                if (e.target === overlay) window.crmCloseImageLightbox();
            };
            document.body.appendChild(overlay);
        }

        overlay.innerHTML = `
            <div class="image-lightbox-content" onclick="event.stopPropagation()">
                <div class="image-lightbox-header">
                    <div>
                        <strong class="image-lightbox-title" style="color: #ffffff; font-size: 15px; font-family: monospace;"></strong>
                        <div class="image-lightbox-subtitle" style="font-size: 12px; color: var(--text-muted); margin-top: 2px;"></div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <a target="_blank" rel="noopener noreferrer" class="toolbar-pill-btn image-lightbox-original" style="padding: 4px 10px; font-size: 11.5px; text-decoration: none;" title="Abrir imagem original em nova aba">
                            <i class="fa-solid fa-arrow-up-right-from-square"></i> Original
                        </a>
                        <button class="modal-close-btn" onclick="window.crmCloseImageLightbox()" title="Fechar (ESC)">&times;</button>
                    </div>
                </div>
                <img class="image-lightbox-img" onerror="window.crmHandleLightboxImageError(this)">
            </div>
        `;
        const titleElement = overlay.querySelector('.image-lightbox-title');
        const subtitleElement = overlay.querySelector('.image-lightbox-subtitle');
        const originalLink = overlay.querySelector('.image-lightbox-original');
        const imageElement = overlay.querySelector('.image-lightbox-img');
        titleElement.textContent = String(title || 'Visualização da Foto');
        subtitleElement.textContent = String(subtitle || '');
        subtitleElement.hidden = !subtitle;
        originalLink.href = resolvedImageUrl || '#';
        originalLink.hidden = !resolvedImageUrl;
        imageElement.src = resolvedImageUrl;
        imageElement.dataset.fallbackUrl = resolvedFallbackUrl;
        imageElement.alt = String(title || 'Foto do Produto');
        overlay.style.display = 'flex';

        const handleKeydown = (e) => {
            if (e.key === 'Escape') {
                window.crmCloseImageLightbox();
                document.removeEventListener('keydown', handleKeydown);
            }
        };
        document.addEventListener('keydown', handleKeydown);
    };

    window.crmSearchMissingImages = (query) => {
        state.missingImagesSearch = String(query || '');
        renderActiveView();
    };

    window.crmSetMissingImagesTab = (tab) => {
        state.missingImagesTab = tab === 'all' ? 'all' : 'missing';
        state.missingImagesSearch = '';
        renderActiveView();
    };

    async function copyImageText(text, successMessage) {
        let copied = false;
        try {
            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(text);
                copied = true;
            }
        } catch (error) {
            copied = false;
        }

        if (!copied) {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.setAttribute('readonly', '');
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            textarea.style.pointerEvents = 'none';
            document.body.appendChild(textarea);
            textarea.select();
            try {
                copied = document.execCommand('copy');
            } catch (error) {
                copied = false;
            } finally {
                textarea.remove();
            }
        }

        if (copied) {
            showNotification(successMessage, 'success', 'Copiado');
        } else {
            showNotification('Não foi possível copiar automaticamente. Verifique a permissão da área de transferência.', 'warning', 'Cópia não realizada');
        }
    }

    window.crmCopyAllImageFilenames = () => {
        const filenames = [...new Set(getImageCoverageProducts().map(product => `${product.imageCode || product.codigo}.jpg`))];
        if (!filenames.length) {
            showNotification('Nenhuma imagem necessária foi encontrada.', 'info', 'Lista vazia');
            return;
        }
        copyImageText(filenames.join('\n'), `${filenames.length} nomes de imagens copiados para a área de transferência.`);
    };

    window.crmExportMissingImagesCSV = () => {
        const missingProducts = getImageCoverageProducts().filter(product => !product.hasImage);
        if (!missingProducts.length) {
            showNotification('Não existem produtos sem imagem para exportar.', 'info', 'Imagens Completas');
            return;
        }

        const escapeCsv = value => {
            let text = String(value ?? '');
            if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
            return `"${text.replace(/"/g, '""')}"`;
        };
        const rows = [
            ['Código', 'Descrição', 'Cliente', 'Marca', 'OPs', 'Setores', 'Arquivo esperado'],
            ...missingProducts.map(product => [
                product.codigo,
                product.descricao,
                product.cliente,
                product.marca,
                product.ops.join(', '),
                product.setores.join(', '),
                `${product.imageCode || product.codigo}.jpg`
            ])
        ];
        const csv = '\uFEFF' + rows.map(row => row.map(escapeCsv).join(';')).join('\r\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `produtos-sem-imagem-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    };

    window.crmHandleLightboxImageError = (image) => {
        const fallbackUrl = image.dataset.fallbackUrl;
        if (fallbackUrl && image.dataset.fallbackTried !== '1') {
            image.dataset.fallbackTried = '1';
            image.src = fallbackUrl;
            return;
        }

        image.onerror = null;
        image.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"><rect fill="%231e293b" width="400" height="300"/><text fill="%2394a3b8" font-size="16" font-family="sans-serif" x="50%" y="50%" dominant-baseline="middle" text-anchor="middle">Imagem não disponível</text></svg>';
    };

    window.crmCloseImageLightbox = () => {
        const overlay = document.getElementById('crmImageLightboxOverlay');
        if (overlay) {
            overlay.style.display = 'none';
        }
    };

    window.crmGeneratePDFReport = () => {
        const originalSetor13ViewMode = state.setor13ViewMode;
        const originalSetor01ViewMode = state.setor01ViewMode;
        const originalProcessoFilter = state.processoFilter;
        const originalEstampaFilter = state.estampaFilter;
        const originalAlertsPageLimit = state.alertsPageLimit;
        let viewWasAdjustedForPrint = false;

        // PDFs executivos sempre usam miniaturas. A preferência visual da tela
        // é restaurada assim que o diálogo de impressão é encerrado.
        if (state.activeSubmodule === 'setor13' && state.setor13ViewMode !== 'grid') {
            state.setor13ViewMode = 'grid';
            viewWasAdjustedForPrint = true;
        }
        if (state.activeSubmodule === 'setor01' && state.setor01ViewMode !== 'grid') {
            state.setor01ViewMode = 'grid';
            viewWasAdjustedForPrint = true;
        }
        if (state.activeSubmodule === 'processo' && state.processoFilter === 'bons') {
            state.processoFilter = null;
            viewWasAdjustedForPrint = true;
        }
        if (state.activeSubmodule === 'estampa' && state.estampaFilter === 'sem_pendencia') {
            state.estampaFilter = null;
            viewWasAdjustedForPrint = true;
        }
        if (state.activeSubmodule === 'alertas') {
            state.alertsPageLimit = Number.MAX_SAFE_INTEGER;
            viewWasAdjustedForPrint = true;
        }
        if (viewWasAdjustedForPrint) {
            renderActiveView();
        }

        const subTitleMap = {
            'geral': 'Pipeline Geral de Atividades da Fábrica',
            'setor13': 'Modelagem - Pedidos Setor 13 (Aguardando Retorno)',
            'processo': 'Modelagem - Pedidos em Processo (Setores 05, 06, 12)',
            'setor01': 'Estilo Pedido - Pendências Setor 01',
            'estampa': 'Estilo Pedido - Situação de Estampa',
            'malotes': 'Malotes - Setores 88 e 83',
            'alertas': 'Alertas Operacionais',
            'cores-aviamentos': 'Estilo Pedido - Cores e Aviamentos (CM1/D01)',
            'rotativos': 'Estilo Pedido - Rotativos (Setor 43)',
            'feira': 'Estilo Amostras - Feira & Protótipos (Fluxo D36)'
        };
        const title = subTitleMap[state.activeSubmodule] || 'Relatório Executivo de Produção & Métricas';

        const printTitle = document.getElementById('printReportTitle');
        if (printTitle) printTitle.textContent = title;

        const printModule = document.getElementById('printReportModule');
        if (printModule) printModule.textContent = title;

        const printDate = document.getElementById('printReportDate');
        if (printDate) {
            const now = new Date();
            printDate.textContent = now.toLocaleDateString('pt-BR') + ' às ' + now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        }

        // O Setor 13 possui uma composição própria de impressão: a primeira
        // página reúne o resumo e os gráficos; as miniaturas começam na página 2.
        // A classe é temporária para não alterar o layout normal da aplicação.
        const printModeClasses = [
            'print-setor13',
            'print-processo',
            'print-setor01',
            'print-estampa',
            'print-malotes',
            'print-alertas',
            'print-prog-feira',
            'print-gallery-report'
        ];
        document.body.classList.remove(...printModeClasses);
        const activePrintClass = {
            setor13: 'print-setor13',
            processo: 'print-processo',
            setor01: 'print-setor01',
            estampa: 'print-estampa',
            malotes: 'print-malotes'
            ,alertas: 'print-alertas'
            ,'prog-feira': 'print-prog-feira'
        }[state.activeSubmodule];
        if (activePrintClass) {
            document.body.classList.add(activePrintClass, 'print-gallery-report');
        }

        const cleanupPrintMode = () => {
            document.body.classList.remove(...printModeClasses);
            if (viewWasAdjustedForPrint) {
                state.setor13ViewMode = originalSetor13ViewMode;
                state.setor01ViewMode = originalSetor01ViewMode;
                state.processoFilter = originalProcessoFilter;
                state.estampaFilter = originalEstampaFilter;
                state.alertsPageLimit = originalAlertsPageLimit;
                renderActiveView();
            }
        };
        window.addEventListener('afterprint', cleanupPrintMode, { once: true });

        showNotification('Formatando relatório executivo para salvar em PDF ou imprimir...', 'info', 'Gerando Relatório');
        setTimeout(() => {
            window.print();
        }, 350);
    };

})();



// =========================================================================
// THEME TOGGLE LOGIC
// =========================================================================
window.toggleTheme = function() {
    const isLight = document.body.classList.toggle('light-mode');
    localStorage.setItem('crmTheme', isLight ? 'light' : 'dark');
    updateThemeIcon();
    // Refresh active view to redraw charts with correct SVG colors
    if (window.renderActiveView) window.renderActiveView();
};

function initTheme() {
    const savedTheme = localStorage.getItem('crmTheme');
    if (savedTheme === 'light') {
        document.body.classList.add('light-mode');
    } else if (savedTheme === 'dark') {
        document.body.classList.remove('light-mode');
    }
    updateThemeIcon();
}

function updateThemeIcon() {
    const icon = document.getElementById('themeIcon');
    if (icon) {
        if (document.body.classList.contains('light-mode')) {
            icon.className = 'fa-solid fa-sun';
            icon.style.color = '#f59e0b';
        } else {
            icon.className = 'fa-solid fa-moon';
            icon.style.color = 'inherit';
        }
    }
}

document.addEventListener('DOMContentLoaded', initTheme);
