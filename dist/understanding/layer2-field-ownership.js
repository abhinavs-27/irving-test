import { pruneEmptyExtractedFields } from './layer2-extracted-build.js';
/** Maps clause_type → the sole key allowed in `extracted_fields` (undefined → must be `{}`). */
export const DOMAIN_BY_CLAUSE_TYPE = {
    structural: 'structural',
    pricing_terms: 'pricing',
    constraint: 'constraints',
    termination: 'termination',
    disclosure: 'disclosure',
    obligation: 'obligations',
    indemnity: 'obligations',
    payment: 'obligations',
    other: undefined,
};
export const PRIORITY_BY_TYPE = {
    structural: 'low',
    pricing_terms: 'high',
    constraint: 'high',
    termination: 'high',
    disclosure: 'medium',
    obligation: 'medium',
    indemnity: 'medium',
    payment: 'medium',
    other: 'low',
};
const STRUCTURAL_ALLOWED = new Set([
    'agreement_reference_date_iso',
    'execution_date_iso',
]);
const TERMINATION_ALLOWED = new Set([
    'stated_term_days',
    'stated_term_months',
    'termination_notice_days',
    'aggregate_purchase_ceiling_usd',
]);
const PRICING_MODE_ALLOWED = new Set([
    'purchase_mode',
    'vwap_session',
    'discount_rate',
    'volume_adjusted',
    'excludes_open_close',
    'multi_segment_intraday',
]);
const EXCHANGE_ROW_ALLOWED = new Set([
    'share_cap',
    'issuance_cap_rate',
]);
const BENEFICIAL_ROW_ALLOWED = new Set([
    'cap_rate',
]);
const GENERIC_ROW_ALLOWED = new Set([
    'kind',
    'numeric_value',
    'rate',
]);
function pickStructural(s) {
    const o = {};
    for (const k of STRUCTURAL_ALLOWED) {
        const v = s[k];
        if (v !== undefined)
            o[k] = v;
    }
    return o;
}
function pickTermination(t) {
    const o = {};
    for (const k of TERMINATION_ALLOWED) {
        const v = t[k];
        if (v !== undefined)
            o[k] = v;
    }
    return o;
}
function pickPricingMode(m) {
    const o = {};
    for (const k of PRICING_MODE_ALLOWED) {
        const v = m[k];
        if (v !== undefined)
            o[k] = v;
    }
    return o;
}
function pickPricing(p) {
    const o = {
        mechanism: p.mechanism,
        settlement_method: p.settlement_method,
    };
    if (p.discount_rate !== undefined)
        o.discount_rate = p.discount_rate;
    if (p.modes !== undefined)
        o.modes = p.modes.map(pickPricingMode);
    return o;
}
function pickExchangeRow(r) {
    const o = {};
    for (const k of EXCHANGE_ROW_ALLOWED) {
        const v = r[k];
        if (v !== undefined)
            o[k] = v;
    }
    return o;
}
function pickBeneficialRow(r) {
    const o = {};
    for (const k of BENEFICIAL_ROW_ALLOWED) {
        const v = r[k];
        if (v !== undefined)
            o[k] = v;
    }
    return o;
}
function pickGenericRow(r) {
    const o = { kind: r.kind };
    for (const k of GENERIC_ROW_ALLOWED) {
        if (k === 'kind')
            continue;
        const v = r[k];
        if (v !== undefined)
            o[k] = v;
    }
    return o;
}
function pickConstraints(c) {
    const o = {};
    if (c.exchange_issuance !== undefined) {
        const rows = c.exchange_issuance.map(pickExchangeRow).filter((r) => Object.keys(r).length > 0);
        if (rows.length > 0)
            o.exchange_issuance = rows;
    }
    if (c.beneficial_ownership !== undefined) {
        const rows = c.beneficial_ownership.map(pickBeneficialRow).filter((r) => Object.keys(r).length > 0);
        if (rows.length > 0)
            o.beneficial_ownership = rows;
    }
    if (c.other_constraints !== undefined) {
        const rows = c.other_constraints.map(pickGenericRow);
        if (rows.length > 0)
            o.other_constraints = rows;
    }
    return o;
}
function pickDisclosure(d) {
    const o = {};
    if (d.financial?.largest_amount_usd !== undefined) {
        o.financial = { largest_amount_usd: d.financial.largest_amount_usd };
    }
    if (d.issuance?.largest_share_count !== undefined) {
        o.issuance = { largest_share_count: d.issuance.largest_share_count };
    }
    return o;
}
/**
 * Keep only allowlisted keys for the payload under a domain key
 * (strips e.g. economic keys mistakenly present on structural).
 */
function enforceFieldOwnershipOnDomain(dom, payload) {
    switch (dom) {
        case 'structural':
            return pickStructural(payload);
        case 'termination':
            return pickTermination(payload);
        case 'pricing':
            return pickPricing(payload);
        case 'constraints':
            return pickConstraints(payload);
        case 'disclosure':
            return pickDisclosure(payload);
        case 'obligations': {
            return {};
        }
        default: {
            const _e = dom;
            return _e;
        }
    }
}
/**
 * Retain a single domain per `clause_type`, allowlist keys, omit empty domain objects.
 */
export function applyStrictExtractedFields(ef, clause_type) {
    const dom = DOMAIN_BY_CLAUSE_TYPE[clause_type];
    if (dom === undefined) {
        return {};
    }
    const raw = ef[dom];
    if (raw === undefined) {
        return {};
    }
    const cleaned = enforceFieldOwnershipOnDomain(dom, raw);
    if (typeof cleaned === 'object' &&
        cleaned !== null &&
        !Array.isArray(cleaned) &&
        Object.keys(cleaned).length === 0) {
        return {};
    }
    const out = { [dom]: cleaned };
    return pruneEmptyExtractedFields(out);
}
//# sourceMappingURL=layer2-field-ownership.js.map