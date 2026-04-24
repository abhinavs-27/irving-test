/** Remove empty domain objects and partially empty disclosure branches (v1.1). */
export function omitEmptyExtractedFields(fields) {
    const o = {};
    if (fields.pricing)
        o.pricing = fields.pricing;
    if (fields.constraints) {
        const c = fields.constraints;
        const n = (c.exchange_issuance?.length ?? 0) +
            (c.beneficial_ownership?.length ?? 0) +
            (c.other_constraints?.length ?? 0);
        if (n > 0)
            o.constraints = c;
    }
    if (fields.termination) {
        const t = fields.termination;
        const hasTerm = t.term && Object.keys(t.term).length > 0;
        const hasNotice = t.notice && Object.keys(t.notice).length > 0;
        const hasEcon = t.economic_limits &&
            Object.keys(t.economic_limits).length > 0 &&
            t.economic_limits.aggregate_purchase_ceiling_usd !== undefined;
        if (hasTerm || hasNotice || hasEcon)
            o.termination = t;
    }
    if (fields.disclosure) {
        const d = fields.disclosure;
        const outD = {};
        if (d.financial?.largest_amount_usd !== undefined) {
            outD.financial = { largest_amount_usd: d.financial.largest_amount_usd };
        }
        if (d.issuance?.largest_share_count !== undefined) {
            outD.issuance = { largest_share_count: d.issuance.largest_share_count };
        }
        if (outD.financial || outD.issuance)
            o.disclosure = outD;
    }
    if (fields.structural) {
        const s = fields.structural;
        if (s.execution_date_iso || s.agreement_reference_date_iso) {
            o.structural = s;
        }
    }
    if (fields.obligations && Object.keys(fields.obligations).length > 0) {
        o.obligations = fields.obligations;
    }
    return o;
}
function validatePricing(p, path, issues) {
    const hasTop = p.discount_rate !== undefined;
    const modes = p.modes ?? [];
    const perModeRates = modes.map((m) => m.discount_rate);
    const anyPer = perModeRates.some((r) => r !== undefined);
    if (hasTop && anyPer) {
        issues.push({
            code: 'pricing_duplicate_discount',
            path: `${path}/pricing`,
            message: 'block-level discount_rate must be omitted when per-mode discount_rate is present',
        });
    }
}
function validateConstraints(ef, path, issues) {
    const c = ef.constraints;
    if (!c)
        return;
    let i = 0;
    for (const row of c.exchange_issuance ?? []) {
        if (!row.applies_to?.trim()) {
            issues.push({
                code: 'constraint_missing_applies_to',
                path: `${path}/constraints/exchange_issuance/${i}`,
                message: 'exchange_issuance constraint requires applies_to (issuer org id)',
            });
        }
        i += 1;
    }
    i = 0;
    for (const row of c.beneficial_ownership ?? []) {
        if (!row.applies_to?.trim()) {
            issues.push({
                code: 'constraint_missing_applies_to',
                path: `${path}/constraints/beneficial_ownership/${i}`,
                message: 'beneficial_ownership constraint requires applies_to (counterparty org id)',
            });
        }
        i += 1;
    }
}
function validateStructural(ef, path, issues) {
    const s = ef.structural;
    if (!s)
        return;
    if (s.execution_date_iso &&
        s.agreement_reference_date_iso &&
        s.execution_date_iso === s.agreement_reference_date_iso) {
        issues.push({
            code: 'structural_duplicate_dates',
            path: `${path}/structural`,
            message: 'agreement_reference_date_iso must be omitted when identical to execution_date_iso',
        });
    }
}
function validateNoEmptyDomains(ef, path, issues) {
    for (const key of Object.keys(ef)) {
        const v = ef[key];
        if (v !== undefined && typeof v === 'object' && v !== null && !Array.isArray(v)) {
            if (Object.keys(v).length === 0) {
                issues.push({
                    code: 'empty_domain_object',
                    path: `${path}/extracted_fields/${String(key)}`,
                    message: 'empty domain object must be omitted',
                });
            }
        }
    }
}
/**
 * Validate a single Layer 2 {@link ClauseBlock}. Non-conformant rows produce issues;
 * callers may log or throw based on severity.
 */
export function validateClauseBlock(record) {
    const issues = [];
    const path = `clause/${record.clause_id}`;
    validateNoEmptyDomains(record.extracted_fields, path, issues);
    if (record.extracted_fields.pricing) {
        validatePricing(record.extracted_fields.pricing, path, issues);
    }
    validateConstraints(record.extracted_fields, path, issues);
    validateStructural(record.extracted_fields, path, issues);
    return { ok: issues.length === 0, issues };
}
//# sourceMappingURL=layer2-validate.js.map