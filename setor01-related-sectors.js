(function initSetor01RelatedSectors(root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.CRMSetor01RelatedSectors = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function createSetor01RelatedSectors() {
    function normalize(value) {
        return String(value || '').trim().toUpperCase();
    }

    function buildMap(records) {
        const sectorsByOp = new Map();
        (records || []).forEach(record => {
            const op = normalize(record && record.op);
            const setor = normalize(record && record.setor);
            if (!op || !setor) return;
            if (!sectorsByOp.has(op)) sectorsByOp.set(op, new Set());
            sectorsByOp.get(op).add(setor);
        });
        return sectorsByOp;
    }

    function resolve(item, sectorsByOp) {
        const sectors = sectorsByOp.get(normalize(item && item.op)) || new Set();
        return {
            setoresAviamento: ['X01', 'X02'].filter(setor => sectors.has(setor)),
            setoresCor: ['D01', 'D02'].filter(setor => sectors.has(setor))
        };
    }

    function matchesPending(item, filter, includeCombined = false) {
        const cor = (item.setoresCor || []).includes('D01');
        const aviamento = (item.setoresAviamento || []).includes('X01');
        switch (filter) {
            case 'cor': return cor && (includeCombined || !aviamento);
            case 'aviamento': return aviamento && (includeCombined || !cor);
            case 'ambas': return cor && aviamento;
            case 'nenhuma': return !cor && !aviamento;
            default: return true;
        }
    }

    function styleStatusGroup(value) {
        const status = normalize(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').replace(/\s*\/\s*/g, '/');
        if (['PENDENTE DESENVOLVIMENTO', 'AGUAR. APROV. LIC./CONCEITO', 'AGUAR. APROV. LIC./PP SAMPLE', 'PEDIDO CANCELADO'].includes(status)) return 'pendentes';
        if (['PP SAMPL APROVADA', 'PP SAMPLE APROVADA', 'LIBERADO PARA PRODUCAO'].includes(status)) return 'liberados';
        return 'outros';
    }

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

    return { buildMap, resolve, matchesPending, styleStatusGroup, isEstampaStatusPendente };
}));
