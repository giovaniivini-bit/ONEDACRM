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
        { value: 'deadlineSetor13', label: 'Data limite do Setor 13', type: 'date' },
        { value: 'setor01LimitDays', label: 'Limite de dias do Setor 01', type: 'number' },
        { value: 'primarySector', label: 'Setor da parte principal', type: 'text' },
        { value: 'maloteSetor', label: 'Setor do malote', type: 'text' }
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
        }
    ]);

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
        const index = {};
        (calendarRecords || []).forEach(row => {
            const week = normalizeWeek(getCalendarCell(row, ['SEMANA'], 0));
            if (!week) return;
            const sector13Raw = getCalendarCell(row, ['Data limite para setor 13'], 1);
            const sector13Date = parseIndustrialDate(sector13Raw, week);
            const limitRaw = getCalendarCell(row, ['quantidade dias aceitaveis para ficar pendente setor 01'], 4);
            const limitMatch = limitRaw.match(/\d+/);
            index[week] = {
                week,
                sector13Date,
                sector13Deadline: formatPtBrDate(sector13Date),
                sector01MaxDays: limitMatch ? Number(limitMatch[0]) : null
            };
        });
        return index;
    }

    function normalizeSector(value) {
        const raw = String(value ?? '').trim();
        if (/^\d$/.test(raw)) return `0${raw}`;
        if (raw === '083') return '83';
        if (raw === '088') return '88';
        return raw;
    }

    function buildOperationalAlertRecords(records, calendarRecords, options = {}) {
        const now = options.now instanceof Date ? options.now : new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const calendar = buildCalendarIndex(calendarRecords);
        const source = Array.isArray(records) ? records : [];
        const enriched = source.map((record, index) => {
            const setor = normalizeSector(record.setor);
            const week = normalizeWeek(record.semanaPedido || record.pedDescPeriodo);
            const calendarEntry = calendar[week] || null;
            const days = parseNumber(record.diasParado);
            const limit = calendarEntry?.sector01MaxDays;
            return {
                ...record,
                setor,
                semanaPedido: week || record.semanaPedido || record.pedDescPeriodo || '',
                deadlineSetor13: calendarEntry?.sector13Deadline || '',
                setor01LimitDays: limit ?? '',
                setor13CalendarLate: setor === '13' && Boolean(calendarEntry?.sector13Date && today > calendarEntry.sector13Date),
                setor01DaysLate: setor === '01' && limit !== null && limit !== undefined && days !== null && days > limit,
                maloteCrossAlert: false,
                alertEntityKey: record.alertEntityKey || `registro:${record.op || index}:${record.codigo || ''}:${setor}`
            };
        });

        const mainSectorsByOp = new Map();
        enriched.forEach(record => {
            if (!record.op || !['20', '26'].includes(record.setor)) return;
            if (!mainSectorsByOp.has(record.op)) mainSectorsByOp.set(record.op, new Set());
            mainSectorsByOp.get(record.op).add(record.setor);
        });

        return enriched.map(record => {
            if (!record.op || !['83', '88'].includes(record.setor)) return record;
            const primarySectors = Array.from(mainSectorsByOp.get(record.op) || []).sort();
            if (primarySectors.length === 0) return record;
            return {
                ...record,
                primarySector: primarySectors.join('/'),
                maloteSetor: record.setor,
                maloteCrossAlert: true
            };
        });
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

    return {
        FIELD_DEFINITIONS,
        OPERATORS,
        DEFAULT_RULES,
        cloneDefaults,
        normalizeWeek,
        parseIndustrialDate,
        buildCalendarIndex,
        buildOperationalAlertRecords,
        compareCondition,
        interpolate,
        validateRules,
        normalizeRules,
        evaluateRecords
    };
});
