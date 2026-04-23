import { ATOMIC_KIND_VALUES, atomicKindForLayer1BlockType, isAtomicKind, isLayer1BlockType, } from './types.js';
const TIME_UNITS = new Set(['day', 'month', 'year']);
const PRICING_METHODS = new Set(['VWAP', 'FIXED', 'FORMULA']);
const VALUATION_WINDOWS = new Set(['intraday', 'full_session']);
function isFactDollarObject(x) {
    if (typeof x !== 'object' || x == null)
        return false;
    const o = x;
    return (typeof o.value === 'number' &&
        Number.isFinite(o.value) &&
        o.currency === 'USD');
}
function isFactTimeWindow(x) {
    if (typeof x !== 'object' || x == null)
        return false;
    const o = x;
    return (typeof o.value === 'number' &&
        Number.isFinite(o.value) &&
        o.value >= 0 &&
        typeof o.unit === 'string' &&
        TIME_UNITS.has(o.unit));
}
function validateFactsV2(path, facts, issues) {
    if (typeof facts !== 'object' || facts == null) {
        issues.push({
            path: `${path}/facts`,
            code: 'facts_shape',
            message: 'paragraph facts must be a FactsV2 object',
        });
        return;
    }
    const f = facts;
    for (const k of [
        'percentages',
        'dollar_amounts',
        'share_counts',
        'price_thresholds',
        'dates',
        'time_windows',
    ]) {
        if (!(k in f)) {
            issues.push({
                path: `${path}/facts`,
                code: 'facts_incomplete',
                message: `facts must include key: ${k}`,
            });
        }
    }
    if (f['other_numbers'] != null) {
        issues.push({
            path: `${path}/facts`,
            code: 'facts_legacy_other_numbers',
            message: 'facts.other_numbers is not allowed in v2',
        });
    }
    if (Array.isArray(f['percentages'])) {
        for (const p of f['percentages']) {
            if (typeof p !== 'number' || !Number.isFinite(p)) {
                issues.push({
                    path: `${path}/facts/percentages`,
                    code: 'fact_percentage_numeric',
                    message: 'each percentage must be a finite number',
                });
            }
        }
    }
    for (const key of ['dollar_amounts', 'price_thresholds']) {
        const arr = f[key];
        if (!Array.isArray(arr))
            continue;
        for (const x of arr) {
            if (!isFactDollarObject(x)) {
                issues.push({
                    path: `${path}/facts/${key}`,
                    code: 'fact_dollar_object',
                    message: 'amounts must be { value, currency: "USD" }',
                });
                break;
            }
        }
    }
    if (Array.isArray(f['time_windows'])) {
        for (const tw of f['time_windows']) {
            if (!isFactTimeWindow(tw)) {
                issues.push({
                    path: `${path}/facts/time_windows`,
                    code: 'fact_time_window_shape',
                    message: 'time_windows must be { value, unit: day|month|year }',
                });
                break;
            }
        }
    }
}
function validateEntities(path, e, issues) {
    for (const field of ['organizations', 'people']) {
        const a = e[field];
        if (!Array.isArray(a))
            continue;
        const seen = new Set();
        for (const s of a) {
            if (typeof s !== 'string' || !s.trim()) {
                issues.push({
                    path: `${path}/entities/${field}`,
                    code: 'entity_string',
                    message: 'each entity must be a non-empty string',
                });
                continue;
            }
            const k = s
                .replace(/[^\p{L}\p{N}\s&'-]/gu, ' ')
                .replace(/\s+/g, ' ')
                .trim()
                .toLowerCase();
            if (seen.has(k)) {
                issues.push({
                    path: `${path}/entities/${field}`,
                    code: 'entity_duplicate',
                    message: 'duplicate entity after canonical normalization',
                });
                return;
            }
            seen.add(k);
        }
    }
}
function validatePricing(path, p, issues) {
    if (p.method != null &&
        !PRICING_METHODS.has(p.method)) {
        issues.push({
            path: `${path}/pricing`,
            code: 'pricing_method_enum',
            message: 'pricing.method must be VWAP, FIXED, FORMULA, or omitted',
        });
    }
    if (p.valuation_window != null &&
        !VALUATION_WINDOWS.has(p.valuation_window)) {
        issues.push({
            path: `${path}/pricing`,
            code: 'pricing_valuation_window_enum',
            message: 'valuation_window must be intraday or full_session or omitted',
        });
    }
    if (p.discount_rate != null &&
        (!Number.isFinite(p.discount_rate) || p.discount_rate < 0)) {
        issues.push({
            path: `${path}/pricing`,
            code: 'pricing_discount_numeric',
            message: 'discount_rate must be a non-negative finite number or null',
        });
    }
}
function blockAtomicMismatch(blockType, atomic) {
    return atomicKindForLayer1BlockType(blockType) !== atomic;
}
function walk(clauses, basePath, issues) {
    for (let i = 0; i < clauses.length; i++) {
        const c = clauses[i];
        const path = `${basePath}[${i}]/${c.id}`;
        if (c.type === 'paragraph' && c.facts != null) {
            validateFactsV2(path, c.facts, issues);
        }
        else if (c.type === 'paragraph' && c.facts == null) {
            issues.push({
                path,
                code: 'paragraph_facts_required',
                message: 'v2 requires facts on every paragraph node',
            });
        }
        if (c.atomicKind != null && !isAtomicKind(c.atomicKind)) {
            issues.push({
                path,
                code: 'atomic_kind_enum',
                message: `atomicKind must be one of ${ATOMIC_KIND_VALUES.join(', ')} or omitted`,
            });
        }
        if (c.pricing)
            validatePricing(path, c.pricing, issues);
        if (c.signals && typeof c.signals === 'object') {
            const sig = c.signals;
            if ('pricing' in sig) {
                issues.push({
                    path,
                    code: 'signals_pricing_forbidden',
                    message: 'signals must not contain pricing (Layer 1 purity)',
                });
            }
            if ('market' in sig || 'security' in sig || 'agreement' in sig) {
                issues.push({
                    path,
                    code: 'signals_legacy_shape',
                    message: 'signals must use market_signals, legal_signals, security_signals only',
                });
            }
        }
        if (c.entities)
            validateEntities(path, c.entities, issues);
        if (c.blocks) {
            for (const b of c.blocks) {
                if (!isLayer1BlockType(b.type)) {
                    issues.push({
                        path: `${path}/blocks/${b.id}`,
                        code: 'block_type_enum',
                        message: `Invalid blocks.type: ${String(b.type)}`,
                    });
                }
                if ('intent' in b && b.intent != null) {
                    issues.push({
                        path: `${path}/blocks/${b.id}`,
                        code: 'intent_forbidden',
                        message: 'structured intent/summary fields are not allowed on Layer 1 blocks',
                    });
                }
            }
            const seen = new Set();
            for (const b of c.blocks) {
                for (const pid of b.paragraph_ids) {
                    if (seen.has(pid)) {
                        issues.push({
                            path: `${path}/blocks/${b.id}`,
                            code: 'paragraph_duplicate',
                            message: `paragraph id appears in multiple blocks: ${pid}`,
                        });
                    }
                    seen.add(pid);
                }
                if (isLayer1BlockType(b.type) && c.children.length > 0) {
                    for (const pid of b.paragraph_ids) {
                        const para = c.children.find((ch) => ch.id === pid);
                        if (para &&
                            para.type === 'paragraph' &&
                            para.atomicKind != null &&
                            blockAtomicMismatch(b.type, para.atomicKind)) {
                            issues.push({
                                path: `${path}/blocks/${b.id}`,
                                code: 'block_atomic_kind_mismatch',
                                message: `paragraph ${pid} atomicKind does not match block type ${b.type}`,
                            });
                        }
                    }
                }
            }
            if ((c.type === 'section' ||
                c.type === 'metadata' ||
                c.type === 'footer') &&
                c.children.length > 0) {
                const childIds = new Set(c.children
                    .filter((ch) => ch.type === 'paragraph')
                    .map((ch) => ch.id));
                const outIds = new Set(c.blocks.flatMap((bl) => bl.paragraph_ids));
                for (const id of childIds) {
                    if (!outIds.has(id)) {
                        issues.push({
                            path,
                            code: 'block_paragraph_incomplete',
                            message: `paragraph not assigned to a block: ${id}`,
                        });
                        break;
                    }
                }
                for (const id of outIds) {
                    if (!childIds.has(id)) {
                        issues.push({
                            path,
                            code: 'block_unknown_paragraph',
                            message: `block references non-child paragraph: ${id}`,
                        });
                        break;
                    }
                }
            }
        }
        if (c.children.length)
            walk(c.children, `${path}/children`, issues);
    }
}
export function validateLayer1Tree(clauses) {
    const issues = [];
    walk(clauses, 'sections', issues);
    return { ok: issues.length === 0, issues };
}
//# sourceMappingURL=validate.js.map