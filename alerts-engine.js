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
        { value: 'hasImage', label: 'Possui imagem', type: 'boolean' }
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
            id: 'prazo-atrasado',
            name: 'Pedido com prazo em atraso',
            description: 'Avisa quando o cálculo atual do CRM classifica o pedido como atrasado.',
            enabled: true,
            severity: 'critical',
            match: 'all',
            conditions: [{ field: 'prazoStatus', operator: 'equals', value: 'ATRASO' }],
            message: 'OF {op} · produto {codigo} está com prazo em atraso no setor {setor}.',
            system: true
        },
        {
            id: 'modelagem-parada',
            name: 'Modelagem parada há mais de 2 dias',
            description: 'Destaca produtos que permanecem no Setor 13 acima do tempo de atenção.',
            enabled: true,
            severity: 'warning',
            match: 'all',
            conditions: [
                { field: 'setor', operator: 'equals', value: '13' },
                { field: 'diasParado', operator: 'greaterThan', value: '2' }
            ],
            message: 'OF {op} · produto {codigo} está há {diasParado} dias no Setor 13.',
            system: true
        },
        {
            id: 'produto-sem-imagem',
            name: 'Produto sem imagem',
            description: 'Avisa quando um produto atual não possui imagem reconhecida.',
            enabled: true,
            severity: 'info',
            match: 'all',
            conditions: [{ field: 'hasImage', operator: 'equals', value: 'false' }],
            message: 'Produto {codigo} da OF {op} está sem imagem cadastrada.',
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
                const entityKey = `${record.op || 'sem-of'}|${record.codigo || 'sem-codigo'}|${record.setor || 'sem-setor'}`;
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
        compareCondition,
        interpolate,
        validateRules,
        normalizeRules,
        evaluateRecords
    };
});
