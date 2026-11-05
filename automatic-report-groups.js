(function(root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.CRMAutomaticReportGroups = api;
})(typeof window !== 'undefined' ? window : globalThis, function() {
    function groupReportItems(report) {
        if (report.type === 'malotes') return ['88','83'].map(sector => ({
            key:sector, title:`Setor ${sector} - Malotes`,
            items:report.items.filter(item => String(item.sector).replace(/^0(?=\d{2}$)/,'') === sector)
        }));
        if (!report.grouping) return [{ key:'all', title:'', items:report.items }];
        const groups = new Map();
        for (const item of report.items) {
            const key = item.groupKey || 'other';
            if (!groups.has(key)) groups.set(key, { key, title:item.groupLabel || key, items:[] });
            groups.get(key).items.push(item);
        }
        return [...groups.values()];
    }
    return { groupReportItems };
});
