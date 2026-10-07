(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.CRMAlertsEngine = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
    'use strict';

    const FIELD_DEFINITIONS = Object.freeze([
        { value: 'op', label: 'OF / OP', type: 'text' },
        { value: 'codigo', label: 'Código do produto', type: 'text' },
        { value: 'descricao', label: 'Descrição', type: 'text' },
        { value: 'setor', label: 'Setor atual', type: 'text' },
        { value: 'cliente', label: 'Cliente', type: 'text' },
        { value: 'marca', label: 'Marca', type: 'text' },
        { value: 'semanaPedido', label: 'Semana do pedido', type: 'text' },
        { value: 'statusModelagem', label: 'Status da modelagem', type: 'text' },
        { value: 'statusProd', label: 'Status do produto', type: 'text' },
        { value: 'prazoStatus', label: 'Situação do prazo', type: 'text' },
        { value: 'diasParado', label: 'Dias parado', type: 'number' },
        { value: 'qtdeOriginal', label: 'Quantidade de peças', type: 'number' },
        { value: 'dtFatura', label: 'Data de faturamento', type: 'date' },
        { value: 'dtPrevMov', label: 'Data prevista de movimentação', type: 'date' },
        { value: 'hasImage', label: 'Possui imagem', type: 'boolean' },
        { value: 'setor13CalendarLate', label: 'Setor 13 fora do calendário', type: 'boolean' },
        { value: 'setor01DaysLate', label: 'Setor 01 acima do limite de dias', type: 'boolean' },
        { value: 'maloteCrossAlert', label: 'Malote com parte principal em 20/26', type: 'boolean' },
        { value: 'setorCQReprovado', label: 'Amostra reprovada no CQ', type: 'boolean' },
        { value: 'productionAviamentoAlert', label: 'Produção com pendência de aviamento', type: 'boolean' },
        { value: 'productionCorAlert', label: 'Produção com pendência de cor', type: 'boolean' },
        { value: 'progFeiraSectorLate', label: 'Feira / Amostras acima do limite do setor', type: 'boolean' },
        { value: 'diasReprovado', label: 'Dias com amostra reprovada', type: 'number' },
        { value: 'deadlineSetor13', label: 'Data limite do Setor 13', type: 'date' },
        { value: 'setor01LimitDays', label: 'Limite de dias do Setor 01', type: 'number' },
        { value: 'primarySector', label: 'Setor da parte principal', type: 'text' },
        { value: 'maloteSetor', label: 'Setor do malote', type: 'text' },
        { value: 'productionSector', label: 'Setor atual da produção', type: 'text' },
        { value: 'pendencySector', label: 'Setor da pendência', type: 'text' },
        { value: 'colorForecast', label: 'Previsão da cor', type: 'text' },
        { value: 'flowSectorLimitDays', label: 'Limite de dias do setor de Feira / Amostras', type: 'number' }
    ]);

    const OPERATORS = Object.freeze([
        { value: 'equals', label: 'é igual a' },
        { value: 'notEquals', label: 'é diferente de' },
        { value: 'contains', label: 'contém' },
        { value: 'notContains', label: 'não contém' },
        { value: 'greaterThan', label: 'é maior que' },
        { value: 'lessThan', label: 'é menor que' },
        { value: 'empty', label: 'está vazio' },
        { value: 'notEmpty', label: 'não está vazio' },
        { value: 'beforeToday', label: 'é anterior a hoje' },
        { value: 'afterToday', label: 'é posterior a hoje' }
    ]);

    const DEFAULT_RULES = Object.freeze([
        {
            id: 'setor13-calendario',
            name: 'Setor 13 fora do calendário',
            description: 'Cruza a semana do pedido com a data limite da coluna B do Calendário Industrial.',
            enabled: true,
            severity: 'critical',
            match: 'all',
            conditions: [{ field: 'setor13CalendarLate', operator: 'equals', value: 'true' }],
            message: 'SETOR 13, OF {op} está em atraso, pertence à semana {semanaPedido}; data limite era {deadlineSetor13}.',
            system: true
        },
        {
            id: 'setor01-limite-dias',
            name: 'Setor 01 acima do limite de dias',
            description: 'Compara os dias pendentes com o limite da coluna E do Calendário Industrial.',
            enabled: true,
            severity: 'warning',
            match: 'all',
            conditions: [{ field: 'setor01DaysLate', operator: 'equals', value: 'true' }],
            message: 'SETOR 01, produto {codigo} está há {diasParado} dias; limite é {setor01LimitDays} dias.',
            system: true
        },
        {
            id: 'malotes-parte-principal',
            name: 'Malote pendente com parte principal em 20/26',
            description: 'Cruza pedidos com malote nos setores 83/88 e parte principal nos setores 20/26.',
            enabled: true,
            severity: 'critical',
            match: 'all',
            conditions: [{ field: 'maloteCrossAlert', operator: 'equals', value: 'true' }],
            message: 'MALOTES, pedido {op}: parte principal no setor {primarySector}, malote no setor {maloteSetor}.',
            system: true
        },
        {
            id: 'cq-amostra-reprovada',
            name: 'Amostra reprovada no CQ',
            description: 'Identifica na coluna DESC_AMOSTRA as OFs com situação REPROVADO e calcula o tempo desde a reprovação.',
            enabled: true,
            severity: 'critical',
            match: 'all',
            conditions: [{ field: 'setorCQReprovado', operator: 'equals', value: 'true' }],
            message: 'SETOR CQ, OF {op} está com SIT AMOSTRA REPROVADA, pertence à semana {semanaPedido}, está reprovado há {diasReprovado} dias.',
            system: true
        },
        {
            id: 'pend-produto-aviamento',
            name: 'PEND. PRODUTO — Aviamento',
            description: 'Cruza OFs na produção (02, 03, 04, 05G ou CM1) com pendência simultânea no setor X01.',
            enabled: true,
            severity: 'critical',
            match: 'all',
            conditions: [{ field: 'productionAviamentoAlert', operator: 'equals', value: 'true' }],
            message: 'PEND AVIAMENTO na produção, OF {op} está no setor {productionSector}, pertence à semana {semanaPedido}; precisa resolver o aviamento com urgência.',
            system: true
        },
        {
            id: 'pend-produto-cor',
            name: 'PEND. PRODUTO — Cor',
            description: 'Cruza OFs na produção (02, 03, 04, 05G ou 05) com pendência simultânea no setor D01.',
            enabled: true,
            severity: 'critical',
            match: 'all',
            conditions: [{ field: 'productionCorAlert', operator: 'equals', value: 'true' }],
            message: 'PEND COR na produção, Produto {codigo} está no setor {productionSector}, pertence à semana {semanaPedido}; previsão COR {colorForecast}.',
            system: true
        },
        {
            id: 'prog-feira-limite-setor',
            name: 'PEND. PRODUTO — Feira / Amostras',
            description: 'Compara os dias no setor atual do Prog Feira com o limite oficial do Calendário Industrial.',
            enabled: true,
            severity: 'warning',
            match: 'all',
            conditions: [{ field: 'progFeiraSectorLate', operator: 'equals', value: 'true' }],
            message: 'Produto {codigo} no fluxo de FEIRA / AMOSTRAS está pendente no setor {setor}, acima da quantidade de dias desejada, que é de {flowSectorLimitDays} dias.',
            system: true
        }
    ]);

    const PROG_FEIRA_LIMIT_SECTORS = Object.freeze(['01A', '01B', '1B2', '02M', '02B', '01C', '01E', '1E2', '02C']);
    const CALENDAR_LIMIT_SECTORS = Object.freeze(['01', ...PROG_FEIRA_LIMIT_SECTORS]);

    const ALLOWED_FIELDS = new Set(FIELD_DEFINITIONS.map(field => field.value));
    const ALLOWED_OPERATORS = new Set(OPERATORS.map(operator => operator.value));
    const ALLOWED_SEVERITIES = new Set(['critical', 'warning', 'info']);

    function cloneDefaults() {
        return DEFAULT_RULES.map(rule => ({
            ...rule,
            conditions: rule.conditions.map(condition => ({ ...condition }))
        }));
    }

    function normalizeText(value) {
        return String(value ?? '').trim().toLocaleLowerCase('pt-BR');
    }

    function parseNumber(value) {
        if (typeof value === 'number') return Number.isFinite(value) ? value : null;
        const normalized = String(value ?? '').trim().replace(/\./g, '').replace(',', '.').replace(/[^0-9.-]/g, '');
        if (!normalized) return null;
        const parsed = Number(normalized);
        return Number.isFinite(parsed) ? parsed : null;
    }

    function parseDate(value) {
        if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
        const raw = String(value ?? '').trim();
        if (!raw) return null;
        const br = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
        if (br) {
            const year = Number(br[3].length === 2 ? `20${br[3]}` : br[3]);
            const month = Number(br[2]);
            const day = Number(br[1]);
            const date = new Date(year, month - 1, day);
            return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
        }
        const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
        if (iso) {
            const year = Number(iso[1]);
            const month = Number(iso[2]);
            const day = Number(iso[3]);
            const date = new Date(year, month - 1, day);
            return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
        }
        const parsed = new Date(raw);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    function normalizeKey(value) {
        return String(value ?? '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '');
    }

    function normalizeWeek(value) {
        const raw = String(value ?? '').trim();
        if (!raw) return '';

        const normalized = raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
        const describedWeek = normalized.match(/\bSEM(?:ANA)?\s*0?(\d{1,2})\b.*?\b(20\d{2})\b/);
        if (describedWeek) {
            return `${describedWeek[2].slice(-2)}${describedWeek[1].padStart(2, '0')}`;
        }

        const weekThenYear = normalized.match(/(?:^|\D)0?(\d{1,2})\s*[\/-]\s*(20\d{2})(?:\D|$)/);
        if (weekThenYear) {
            return `${weekThenYear[2].slice(-2)}${weekThenYear[1].padStart(2, '0')}`;
        }

        const compact = normalized.match(/(?:^|\D)((?!20\d{2})\d{4})(?:\D|$)/) || normalized.match(/^((?!20\d{2})\d{4})$/);
        return compact ? compact[1] : '';
    }

    function getCalendarCell(row, names, fallbackIndex) {
        if (!row || typeof row !== 'object') return '';
        const wanted = new Set(names.map(normalizeKey));
        for (const [key, value] of Object.entries(row)) {
            if (wanted.has(normalizeKey(key))) return String(value ?? '').trim();
        }
        return String(Object.values(row)[fallbackIndex] ?? '').trim();
    }

    function parseIndustrialDate(value, week) {
        const raw = String(value ?? '').trim().toLowerCase();
        if (!raw) return null;
        const withYear = parseDate(raw.replace(/\.$/, ''));
        if (/\d{4}/.test(raw) && withYear) return withYear;

        const match = raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '').match(/^(\d{1,2})[\/.-]([a-z]{3,})\.?$/i);
        if (!match || !/^\d{4}$/.test(week)) return null;
        const months = { jan: 0, fev: 1, mar: 2, abr: 3, mai: 4, jun: 5, jul: 6, ago: 7, set: 8, out: 9, nov: 10, dez: 11 };
        const month = months[match[2].slice(0, 3)];
        if (month === undefined) return null;
        const weekNumber = Number(week.slice(2));
        const scheduleYear = 2000 + Number(week.slice(0, 2));
        // O calendário industrial começa antes do ano civil: as primeiras
        // semanas da coleção ficam em novembro/dezembro do ano anterior.
        const year = month >= 10 && weekNumber <= 10 ? scheduleYear - 1 : scheduleYear;
        const day = Number(match[1]);
        const date = new Date(year, month, day);
        return date.getFullYear() === year && date.getMonth() === month && date.getDate() === day ? date : null;
    }

    function formatPtBrDate(date) {
        if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
        const pad = number => String(number).padStart(2, '0');
        return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
    }

    function buildCalendarIndex(calendarRecords) {
        const sectorLimits = buildSectorLimitIndex(calendarRecords);
        const index = {};
        (calendarRecords || []).forEach(row => {
            const week = normalizeWeek(getCalendarCell(row, ['SEMANA'], 0));
            if (!week) return;
            const sector13Raw = getCalendarCell(row, ['Data limite para setor 13'], 1);
            const sector13Date = parseIndustrialDate(sector13Raw, week);
            const limitRaw = getCalendarCell(row, ['quantidade dias aceitaveis para ficar pendente setor 01'], 4);
            const rowLimit = parseLimitDays(limitRaw);
            index[week] = {
                week,
                sector13Date,
                sector13Deadline: formatPtBrDate(sector13Date),
                sector01MaxDays: rowLimit ?? sectorLimits['01'] ?? null
            };
        });
        return index;
    }

    function parseLimitDays(value) {
        const match = String(value ?? '').trim().match(/^(\d{1,2})\s*(?:dias?)?$/i);
        const limit = match ? Number(match[1]) : NaN;
        return Number.isInteger(limit) && limit >= 0 && limit <= 30 ? limit : null;
    }

    function buildSectorLimitIndex(calendarRecords) {
        const valuesBySector = new Map();
        (Array.isArray(calendarRecords) ? calendarRecords : []).forEach(row => {
            Object.entries(row || {}).forEach(([header, rawValue]) => {
                const normalizedHeader = normalizeKey(header);
                let sector = '';
                if (normalizedHeader === 'quantidadediasaceitaveisparaficarpendentesetor01') {
                    sector = '01';
                } else {
                    const match = normalizedHeader.match(/^quantidadediassetor(01a|01b|1b2|02m|02b|01c|01e|1e2|02c|m00|m02)$/i);
                    sector = match ? match[1].toUpperCase() : '';
                }
                if (!sector) return;
                const limit = parseLimitDays(rawValue);
                if (limit === null) return;
                if (!valuesBySector.has(sector)) valuesBySector.set(sector, new Set());
                valuesBySector.get(sector).add(limit);
            });
        });
        const limits = {};
        valuesBySector.forEach((values, sector) => {
            if (values.size === 1) limits[sector] = Array.from(values)[0];
        });
        return limits;
    }

    function buildProgFeiraAlertRecords(products, calendarRecords) {
        const sectorLimits = buildSectorLimitIndex(calendarRecords);
        const eligibleSectors = new Set(PROG_FEIRA_LIMIT_SECTORS);
        return (Array.isArray(products) ? products : []).flatMap((product, index) => {
            const setor = normalizeSector(product?.sector);
            const days = parseNumber(product?.daysInSector);
            const limit = sectorLimits[setor];
            if (!eligibleSectors.has(setor) || days === null || !Number.isFinite(limit) || days <= limit) return [];
            const codigo = String(product?.codigo || '').trim();
            const op = String(product?.numero || '').trim();
            return [{
                op,
                codigo,
                descricao: product?.sectorLabel || '',
                setor,
                diasParado: days,
                flowSectorLimitDays: limit,
                progFeiraSectorLate: true,
                alertEntityKey: `prog-feira-limite:${product?.key || `${op}:${codigo}:${setor}:${index}`}`
            }];
        });
    }

    function normalizeSector(value) {
        const raw = String(value ?? '').trim().toUpperCase();
        if (/^\d$/.test(raw)) return `0${raw}`;
        if (raw === '083') return '83';
        if (raw === '088') return '88';
        return raw;
    }

    function normalizeCQStatus(value) {
        const normalized = String(value ?? '').trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        if (normalized === 'REPROVADO') return 'REPROVADO';
        if (normalized.includes('REENVIADO')) return 'REENVIADO CQ';
        if (normalized === 'ENVIADO') return 'ENVIADO';
        if (normalized.includes('EXPIRANDO')) return 'EXPIRANDO VIGÊNCIA';
        if (normalized.includes('PRODUCAO') || normalized.includes('PRODUC')) return 'AMOSTRAS EM PRODUÇÃO';
        return null;
    }

    function getRecordField(record, names, fallbackIndex) {
        if (!record || typeof record !== 'object') return '';
        const wanted = new Set(names.map(normalizeKey));
        for (const [key, value] of Object.entries(record)) {
            const text = String(value ?? '').trim();
            if (wanted.has(normalizeKey(key)) && text) return text;
        }
        if (fallbackIndex === undefined) return '';
        return String(Object.values(record)[fallbackIndex] ?? '').trim();
    }

    function getCQRejectionDate(observation) {
        const text = String(observation ?? '');
        const matches = text.matchAll(/reprovad[oa][^\r\n]*?(?:dia\s*:?[\s-]*|em\s*:?[\s-]*)?(\d{1,2}\/\d{1,2}\/\d{2,4})/gi);
        const validDates = Array.from(matches, match => parseDate(match[1])).filter(Boolean);
        if (!validDates.length) return null;
        return validDates.reduce((latest, date) => date > latest ? date : latest);
    }

    function calculateElapsedDays(date, now = new Date()) {
        if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
        const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 86400000));
    }

    function normalizeProductCode(value) {
        return String(value ?? '')
            .trim()
            .toUpperCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^A-Z0-9]/g, '');
    }

    function buildColorForecastIndex(records) {
        const forecastsByProduct = new Map();
        (Array.isArray(records) ? records : []).forEach(record => {
            const product = getRecordField(record, ['PRODUTO', 'PRODUTO / REF', 'PRODUTO_REF', 'REFERENCIA', 'CÓDIGO', 'CODIGO'], 2);
            const forecast = getRecordField(record, ['PREVISÃO', 'PREVISAO', 'DATA PREVISÃO', 'DATA PREVISAO'], 10);
            const productKey = normalizeProductCode(product);
            const normalizedForecast = String(forecast ?? '').trim();
            const hasStrictDateFormat = /^(?:\d{1,2}\/\d{1,2}\/\d{2,4}|\d{4}-\d{1,2}-\d{1,2})$/.test(normalizedForecast);
            if (!hasStrictDateFormat) return;
            const forecastDate = parseDate(normalizedForecast);
            if (!productKey || !forecastDate) return;
            if (!forecastsByProduct.has(productKey)) forecastsByProduct.set(productKey, new Set());
            forecastsByProduct.get(productKey).add(formatPtBrDate(forecastDate));
        });

        const index = new Map();
        forecastsByProduct.forEach((values, productKey) => {
            index.set(productKey, Array.from(values).sort((left, right) => {
                const leftDate = parseDate(left);
                const rightDate = parseDate(right);
                if (leftDate && rightDate) return leftDate - rightDate;
                if (leftDate) return -1;
                if (rightDate) return 1;
                return left.localeCompare(right, 'pt-BR', { numeric: true });
            }));
        });
        return index;
    }

    function buildCQAlertRecords(records, options = {}) {
        const now = options.now instanceof Date ? options.now : new Date();
        return (Array.isArray(records) ? records : []).flatMap((record, index) => {
            const descAmostra = getRecordField(record, ['DESC_AMOSTRA', 'SITUACAO', 'SITUAÇÃO', 'AMOSTRA'], 8);
            if (normalizeCQStatus(descAmostra) !== 'REPROVADO') return [];
            const op = getRecordField(record, ['NUMERO', 'OF', 'OP', 'PEDIDO'], 1) || `CQ-${index + 1}`;
            const codigo = getRecordField(record, ['CODIGO', 'CÓDIGO', 'PRODUTO', 'REFERENCIA'], 4);
            const semanaPedido = normalizeWeek(getRecordField(record, ['PERIODO', 'SEMANA', 'SEM'], 13))
                || getRecordField(record, ['PERIODO', 'DESC_PERIODO', 'SEMANA'], 13);
            const observation = getRecordField(record, ['OBSERVACAO', 'OBSERVAÇÃO', 'OBS'], 9);
            const rejectionDate = getCQRejectionDate(observation);
            const calculatedDays = calculateElapsedDays(rejectionDate, now);
            const rawDays = parseNumber(getRecordField(record, ['DIAS', 'DIAS_CQ', 'TEMPO'], 21));
            const diasReprovado = calculatedDays ?? (rawDays !== null && rawDays >= 0 ? rawDays : null);
            return [{
                op,
                codigo,
                descricao: getRecordField(record, ['PRODUTO_DESC', 'DESCRICAO', 'DESCRIÇÃO', 'ART_CLI'], 3),
                setor: 'CQ',
                semanaPedido,
                statusCQ: 'REPROVADO',
                setorCQReprovado: true,
                diasReprovado: diasReprovado ?? '—',
                diasParado: diasReprovado ?? '',
                dataReprovacao: formatPtBrDate(rejectionDate),
                alertEntityKey: `cq-reprovado:${op}:${codigo || index}`
            }];
        });
    }

    function buildOperationalAlertRecords(records, calendarRecords, options = {}) {
        const now = options.now instanceof Date ? options.now : new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const calendar = buildCalendarIndex(calendarRecords);
        const colorForecasts = buildColorForecastIndex(options.colorRecords);
        const calendarLimits = Array.from(new Set(
            Object.values(calendar)
                .map(entry => entry.sector01MaxDays)
                .filter(limit => Number.isFinite(limit))
        ));
        // O limite do Setor 01 vem da coluna E e, no calendário oficial, é
        // único para todo o ciclo. Alguns pedidos chegam sem semana preenchida;
        // nesse caso ainda é seguro usar o limite global quando todas as linhas
        // válidas concordam. Se o calendário passar a ter limites diferentes,
        // o fallback é desativado para não gerar alertas incorretos.
        const sector01FallbackLimit = calendarLimits.length === 1 ? calendarLimits[0] : null;
        const source = Array.isArray(records) ? records : [];
        const enriched = source.map((record, index) => {
            const setor = normalizeSector(record.setor);
            const week = normalizeWeek(record.semanaPedido || record.pedDescPeriodo || record.pedPeriodo);
            const calendarEntry = calendar[week] || null;
            const days = parseNumber(record.diasParado);
            const limit = calendarEntry?.sector01MaxDays ?? sector01FallbackLimit;
            return {
                ...record,
                setor,
                semanaPedido: week || record.semanaPedido || record.pedDescPeriodo || '',
                deadlineSetor13: calendarEntry?.sector13Deadline || '',
                setor01LimitDays: limit ?? '',
                setor13CalendarLate: setor === '13' && Boolean(calendarEntry?.sector13Date && today > calendarEntry.sector13Date),
                setor01DaysLate: setor === '01' && limit !== null && limit !== undefined && days !== null && days > limit,
                maloteCrossAlert: false,
                productionAviamentoAlert: false,
                productionCorAlert: false,
                alertEntityKey: record.alertEntityKey || `registro:${record.op || index}:${record.codigo || ''}:${setor}`
            };
        });

        const mainSectorsByOp = new Map();
        enriched.forEach(record => {
            if (!record.op || !['20', '26'].includes(record.setor)) return;
            if (!mainSectorsByOp.has(record.op)) mainSectorsByOp.set(record.op, new Set());
            mainSectorsByOp.get(record.op).add(record.setor);
        });

        const resultRecords = enriched.map(record => {
            let result = record;
            if (record.op && ['83', '88'].includes(record.setor)) {
                const primarySectors = Array.from(mainSectorsByOp.get(record.op) || []).sort();
                if (primarySectors.length > 0) {
                    result = {
                        ...result,
                        primarySector: primarySectors.join('/'),
                        maloteSetor: record.setor,
                        maloteCrossAlert: true
                    };
                }
            }
            return result;
        });

        const normalizeOrderKey = value => String(value ?? '').trim().toUpperCase();
        const productionAlertConfigs = [
            {
                pendingSector: 'X01',
                productionSectors: new Set(['02', '03', '04', '05G', 'CM1']),
                flag: 'productionAviamentoAlert',
                entityPrefix: 'pend-produto-aviamento',
                matchByProduct: false
            },
            {
                pendingSector: 'D01',
                productionSectors: new Set(['02', '03', '04', '05G', '05']),
                flag: 'productionCorAlert',
                entityPrefix: 'pend-produto-cor',
                matchByProduct: true
            }
        ];

        productionAlertConfigs.forEach(config => {
            const productionByOrder = new Map();
            const pendingIndexesByOrder = new Map();

            enriched.forEach((record, index) => {
                const orderKey = normalizeOrderKey(record.op);
                if (!orderKey) return;
                if (config.productionSectors.has(record.setor)) {
                    if (!productionByOrder.has(orderKey)) productionByOrder.set(orderKey, []);
                    productionByOrder.get(orderKey).push(record);
                }
                if (record.setor === config.pendingSector) {
                    if (!pendingIndexesByOrder.has(orderKey)) pendingIndexesByOrder.set(orderKey, []);
                    pendingIndexesByOrder.get(orderKey).push(index);
                }
            });

            pendingIndexesByOrder.forEach((pendingIndexes, orderKey) => {
                const productionRecords = productionByOrder.get(orderKey) || [];
                if (!productionRecords.length) return;

                if (!config.matchByProduct) {
                    const targetIndex = pendingIndexes[0];
                    const pendingRecord = resultRecords[targetIndex];
                    const productionSectors = Array.from(new Set(productionRecords.map(record => record.setor))).sort();
                    const productionWeeks = Array.from(new Set(
                        productionRecords.map(record => normalizeWeek(record.semanaPedido)).filter(Boolean)
                    )).sort();
                    const representative = productionRecords[0];
                    resultRecords[targetIndex] = {
                        ...pendingRecord,
                        op: String(representative.op || pendingRecord.op || '').trim(),
                        codigo: representative.codigo || pendingRecord.codigo || '',
                        descricao: representative.descricao || pendingRecord.descricao,
                        cliente: representative.cliente || pendingRecord.cliente,
                        setor: productionSectors.join('/'),
                        productionSector: productionSectors.join('/'),
                        pendencySector: config.pendingSector,
                        semanaPedido: productionWeeks.join('/') || '—',
                        colorForecast: '',
                        [config.flag]: true,
                        alertEntityKey: `${config.entityPrefix}:${orderKey}`
                    };
                    return;
                }

                const productionByProduct = new Map();
                const productionWithoutCode = [];
                productionRecords.forEach(record => {
                    const productKey = normalizeProductCode(record.codigo);
                    if (!productKey) {
                        productionWithoutCode.push(record);
                        return;
                    }
                    if (!productionByProduct.has(productKey)) productionByProduct.set(productKey, []);
                    productionByProduct.get(productKey).push(record);
                });
                const pendingByProduct = new Map();
                pendingIndexes.forEach(index => {
                    const productKey = normalizeProductCode(enriched[index].codigo);
                    if (!productKey) return;
                    if (!pendingByProduct.has(productKey)) pendingByProduct.set(productKey, []);
                    pendingByProduct.get(productKey).push(index);
                });

                // Fallback simétrico e inequívoco: se a produção não informou código,
                // mas D01 possui exatamente um produto completo, usamos esse código.
                if (productionByProduct.size === 0 && productionWithoutCode.length && pendingByProduct.size === 1) {
                    const [onlyPendingProductKey] = pendingByProduct.keys();
                    productionByProduct.set(onlyPendingProductKey, productionWithoutCode);
                }

                productionByProduct.forEach((productRecords, productKey) => {
                    let matchingPendingIndexes = pendingByProduct.get(productKey) || [];
                    // Compatibilidade com fontes antigas: quando a OF possui um único
                    // produto, uma linha pendente sem código ainda pode ser cruzada com
                    // segurança. Com vários produtos, não fazemos associação por palpite.
                    const onlyPendingHasNoCode = pendingIndexes.length === 1
                        && !normalizeProductCode(enriched[pendingIndexes[0]].codigo);
                    if (!matchingPendingIndexes.length && productionByProduct.size === 1 && onlyPendingHasNoCode) {
                        matchingPendingIndexes = pendingIndexes;
                    }
                    if (!matchingPendingIndexes.length) return;

                    const targetIndex = matchingPendingIndexes[0];
                    const pendingRecord = resultRecords[targetIndex];
                    const productionSectors = Array.from(new Set(productRecords.map(record => record.setor))).sort();
                    const productionWeeks = Array.from(new Set(
                        productRecords.map(record => normalizeWeek(record.semanaPedido)).filter(Boolean)
                    )).sort();
                    const representative = productRecords[0];
                    const productCode = representative.codigo || pendingRecord.codigo || '';
                    const colorForecast = config.flag === 'productionCorAlert'
                        ? (colorForecasts.get(productKey) || []).join(' / ') || 'não informada'
                        : '';

                    resultRecords[targetIndex] = {
                        ...pendingRecord,
                        op: String(representative.op || pendingRecord.op || '').trim(),
                        codigo: productCode,
                        descricao: representative.descricao || pendingRecord.descricao,
                        cliente: representative.cliente || pendingRecord.cliente,
                        setor: productionSectors.join('/'),
                        productionSector: productionSectors.join('/'),
                        pendencySector: config.pendingSector,
                        semanaPedido: productionWeeks.join('/') || '—',
                        colorForecast,
                        [config.flag]: true,
                        alertEntityKey: `${config.entityPrefix}:${orderKey}:${productKey}`
                    };
                });
            });
        });

        return resultRecords;
    }

    function compareCondition(record, condition, now = new Date()) {
        const current = record?.[condition.field];
        const expected = condition.value;
        switch (condition.operator) {
            case 'equals': return normalizeText(current) === normalizeText(expected);
            case 'notEquals': return normalizeText(current) !== normalizeText(expected);
            case 'contains': return normalizeText(current).includes(normalizeText(expected));
            case 'notContains': return !normalizeText(current).includes(normalizeText(expected));
            case 'greaterThan': {
                const left = parseNumber(current); const right = parseNumber(expected);
                return left !== null && right !== null && left > right;
            }
            case 'lessThan': {
                const left = parseNumber(current); const right = parseNumber(expected);
                return left !== null && right !== null && left < right;
            }
            case 'empty': return normalizeText(current) === '';
            case 'notEmpty': return normalizeText(current) !== '';
            case 'beforeToday': {
                const date = parseDate(current);
                const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                return Boolean(date && date < today);
            }
            case 'afterToday': {
                const date = parseDate(current);
                const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                return Boolean(date && date > today);
            }
            default: return false;
        }
    }

    function interpolate(template, record) {
        return String(template || '').replace(/\{([A-Za-z0-9_]+)\}/g, (_, key) => {
            const value = record?.[key];
            return value === undefined || value === null || value === '' ? '—' : String(value);
        });
    }

    function validateRules(input) {
        if (!Array.isArray(input)) return { valid: false, error: 'A lista de regras deve ser um array.' };
        if (input.length > 50) return { valid: false, error: 'O limite é de 50 regras.' };
        const ids = new Set();
        for (const rawRule of input) {
            if (!rawRule || typeof rawRule !== 'object') return { valid: false, error: 'Regra inválida.' };
            const id = String(rawRule.id || '').trim();
            const name = String(rawRule.name || '').trim();
            if (!/^[a-z0-9-]{3,80}$/i.test(id)) return { valid: false, error: `ID de regra inválido: ${id || '(vazio)'}.` };
            if (ids.has(id)) return { valid: false, error: `ID de regra duplicado: ${id}.` };
            ids.add(id);
            if (!name || name.length > 120) return { valid: false, error: `Nome inválido na regra ${id}.` };
            if (!ALLOWED_SEVERITIES.has(rawRule.severity)) return { valid: false, error: `Prioridade inválida na regra ${id}.` };
            if (!['all', 'any'].includes(rawRule.match)) return { valid: false, error: `Combinação inválida na regra ${id}.` };
            if (!Array.isArray(rawRule.conditions) || rawRule.conditions.length < 1 || rawRule.conditions.length > 8) {
                return { valid: false, error: `A regra ${id} deve possuir entre 1 e 8 condições.` };
            }
            for (const condition of rawRule.conditions) {
                if (!ALLOWED_FIELDS.has(condition.field)) return { valid: false, error: `Campo inválido na regra ${id}.` };
                if (!ALLOWED_OPERATORS.has(condition.operator)) return { valid: false, error: `Operador inválido na regra ${id}.` };
                if (String(condition.value ?? '').length > 200) return { valid: false, error: `Valor muito longo na regra ${id}.` };
            }
            if (String(rawRule.message || '').length > 400) return { valid: false, error: `Mensagem muito longa na regra ${id}.` };
        }
        return { valid: true };
    }

    function normalizeRules(input) {
        const validation = validateRules(input);
        if (!validation.valid) throw new Error(validation.error);
        return input.map(rule => ({
            id: String(rule.id).trim(),
            name: String(rule.name).trim(),
            description: String(rule.description || '').trim().slice(0, 300),
            enabled: rule.enabled !== false,
            severity: rule.severity,
            match: rule.match,
            conditions: rule.conditions.map(condition => ({
                field: condition.field,
                operator: condition.operator,
                value: String(condition.value ?? '').slice(0, 200)
            })),
            message: String(rule.message || '{op} · {codigo} requer atenção.').trim().slice(0, 400),
            system: rule.system === true,
            updatedAt: new Date().toISOString()
        }));
    }

    function evaluateRecords(records, rules, options = {}) {
        const now = options.now instanceof Date ? options.now : new Date();
        const alerts = [];
        const seen = new Set();
        (rules || []).filter(rule => rule.enabled !== false).forEach(rule => {
            (records || []).forEach(record => {
                const results = rule.conditions.map(condition => compareCondition(record, condition, now));
                const matched = rule.match === 'any' ? results.some(Boolean) : results.every(Boolean);
                if (!matched) return;
                const entityKey = record.alertEntityKey || `${record.op || 'sem-of'}|${record.codigo || 'sem-codigo'}|${record.setor || 'sem-setor'}`;
                const id = `${rule.id}|${entityKey}`;
                if (seen.has(id)) return;
                seen.add(id);
                alerts.push({
                    id,
                    ruleId: rule.id,
                    title: rule.name,
                    severity: rule.severity,
                    message: interpolate(rule.message, record),
                    op: record.op || '',
                    codigo: record.codigo || '',
                    setor: record.setor || '',
                    cliente: record.cliente || '',
                    record
                });
            });
        });
        const weight = { critical: 0, warning: 1, info: 2 };
        return alerts.sort((a, b) => (weight[a.severity] ?? 9) - (weight[b.severity] ?? 9) || a.title.localeCompare(b.title, 'pt-BR'));
    }

    function getAlertCategory(alert) {
        const ruleId = String(alert?.ruleId || '').toLocaleLowerCase('pt-BR');
        if (ruleId === 'malotes-parte-principal') return { key: 'malote', label: 'Malote' };
        if (ruleId === 'setor01-limite-dias') return { key: 'setor01', label: 'Pedido Setor 01' };
        if (ruleId === 'setor13-calendario') return { key: 'modelagem', label: 'Modelagem' };
        if (ruleId === 'cq-amostra-reprovada') return { key: 'cq', label: 'Controle de Qualidade' };
        if (ruleId === 'pend-produto-aviamento' || ruleId === 'pend-produto-cor') {
            return { key: 'pend-produto', label: 'Pend. Produto' };
        }
        if (ruleId === 'prog-feira-limite-setor') return { key: 'prog-feira', label: 'Feira / Amostras' };

        const fallbackLabel = String(alert?.title || 'Outros alertas').trim();
        const fallbackKey = `regra:${String(alert?.ruleId || fallbackLabel)
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLocaleLowerCase('pt-BR')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '') || 'outros'}`;
        return { key: fallbackKey, label: fallbackLabel };
    }

    return {
        FIELD_DEFINITIONS,
        OPERATORS,
        DEFAULT_RULES,
        PROG_FEIRA_LIMIT_SECTORS,
        CALENDAR_LIMIT_SECTORS,
        cloneDefaults,
        normalizeWeek,
        normalizeCQStatus,
        getCQRejectionDate,
        calculateElapsedDays,
        normalizeProductCode,
        buildColorForecastIndex,
        buildCQAlertRecords,
        parseIndustrialDate,
        buildCalendarIndex,
        buildSectorLimitIndex,
        buildProgFeiraAlertRecords,
        buildOperationalAlertRecords,
        compareCondition,
        interpolate,
        validateRules,
        normalizeRules,
        evaluateRecords,
        getAlertCategory
    };
});
