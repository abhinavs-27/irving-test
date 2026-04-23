/**
 * Deterministic summary strings assembled only from extracted fields (no free-form reasoning).
 */
export function buildSummary(clauseType, fields) {
    const parts = [];
    switch (clauseType) {
        case 'termination': {
            const d = fields.notice_period_days;
            if (typeof d === 'number')
                parts.push(`Notice period ${d} days (if stated).`);
            const tr = fields.termination_triggers;
            if (Array.isArray(tr) && tr.length)
                parts.push(`Triggers: ${tr.join('; ')}.`);
            if (fields.termination_for_convenience === true)
                parts.push('Termination for convenience referenced.');
            if (fields.termination_for_cause === true)
                parts.push('Termination for cause referenced.');
            break;
        }
        case 'pricing_terms': {
            if (fields.price_formula != null)
                parts.push(`Price basis: ${String(fields.price_formula)}.`);
            if (fields.discounts_percent != null)
                parts.push(`Discount % noted: ${String(fields.discounts_percent)}.`);
            break;
        }
        case 'payment': {
            const a = fields.amounts;
            if (Array.isArray(a) && a.length)
                parts.push(`Monetary amounts present: ${a.slice(0, 4).join(', ')}.`);
            if (fields.timing != null)
                parts.push(`Timing: ${String(fields.timing)}.`);
            break;
        }
        case 'constraints': {
            if (fields.regulatory_thresholds != null)
                parts.push('Percentage thresholds referenced.');
            break;
        }
        case 'confidentiality': {
            if (fields.scope != null)
                parts.push('Confidentiality scope referenced.');
            break;
        }
        case 'definitions': {
            const dt = fields.defined_terms;
            if (Array.isArray(dt) && dt.length)
                parts.push(`${dt.length} defined term pattern(s) detected.`);
            break;
        }
        default:
            break;
    }
    if (parts.length === 0)
        return null;
    return parts.join(' ');
}
//# sourceMappingURL=summary.js.map