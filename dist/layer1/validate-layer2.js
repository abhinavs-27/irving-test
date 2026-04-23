import { buildSignalsWithEntityRegistry } from './entity-registry.js';
import { ENTITY_ID_PREFIX, EVENT_ID_PREFIX, KGRAPH_RELATIONSHIP_TYPES, atomicKindForLayer1BlockType, } from './types.js';
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const REL2 = new Set(KGRAPH_RELATIONSHIP_TYPES);
function isUsd(x) {
    if (typeof x !== 'object' || x == null)
        return false;
    const o = x;
    return (typeof o.value === 'number' &&
        Number.isFinite(o.value) &&
        o.currency === 'USD');
}
function isTw(x) {
    if (typeof x !== 'object' || x == null)
        return false;
    const o = x;
    if (typeof o.value !== 'number' || !Number.isFinite(o.value))
        return false;
    return o.unit === 'day' || o.unit === 'month' || o.unit === 'year';
}
function buildGraphIndex(sections, entityRegistry, blockRegistry) {
    const blockIds = new Set();
    const paragraphIds = new Set();
    if (blockRegistry) {
        for (const k of Object.keys(blockRegistry)) {
            blockIds.add(k);
        }
        for (const b of Object.values(blockRegistry)) {
            for (const pid of b.paragraph_ids) {
                paragraphIds.add(pid);
            }
        }
    }
    for (const s of sections) {
        for (const p of s.children) {
            if (p.type === 'paragraph')
                paragraphIds.add(p.id);
        }
        if (!blockRegistry) {
            for (const b of s.blocks ?? []) {
                blockIds.add(b.id);
            }
        }
    }
    const orgIds = new Set(Object.keys(entityRegistry));
    return { blockIds, paragraphIds, orgIds };
}
function assertSignalsNotDropped(path, text, stored, entityRegistry, issues) {
    if (!text.trim())
        return;
    const expected = buildSignalsWithEntityRegistry(text, entityRegistry);
    const s = stored;
    if (JSON.stringify(expected) !== JSON.stringify(s)) {
        issues.push({
            path: `${path}/signals`,
            code: 'signal_dropped',
            message: 'paragraph signals must match buildSignalsWithEntityRegistry (no dropped fields vs extract + entity ids)',
        });
    }
}
/**
 * Invariants: relationships (grounded targets only), mixed blocks, use_of_proceeds, facts, signals.
 */
export function validateLayer2Tree(sections, relationships, entityRegistry = {}, eventIds = new Set(), blockRegistry) {
    const issues = [];
    const g = buildGraphIndex(sections, entityRegistry, blockRegistry);
    for (const r of relationships) {
        const path = `relationships/${r.type}/${r.source}->${r.target}`;
        if (!REL2.has(r.type)) {
            issues.push({
                path,
                code: 'relationship_type_enum',
                message: `type must be one of: ${[...REL2].join(', ')}`,
            });
        }
        if (!g.blockIds.has(r.source)) {
            issues.push({
                path,
                code: 'relationship_source_missing',
                message: `source is not a known block id: ${r.source}`,
            });
        }
        const t = r.target;
        if (g.paragraphIds.has(t) || g.blockIds.has(t)) {
            // ok
        }
        else if (t.startsWith(ENTITY_ID_PREFIX) && g.orgIds.has(t)) {
            // ok
        }
        else if (t.startsWith(EVENT_ID_PREFIX) && eventIds.has(t)) {
            // ok
        }
        else {
            issues.push({
                path,
                code: 'relationship_target_missing',
                message: `target is not a known block, paragraph, org id, or event id: ${t}`,
            });
        }
    }
    for (const s of sections) {
        for (const p of s.children) {
            if (p.type !== 'paragraph')
                continue;
            const sp = `sections/${p.id}`;
            if (/\buse\s+of\s+proceeds\b/i.test(p.text) && p.atomicKind === 'pricing') {
                issues.push({
                    path: sp,
                    code: 'use_of_proceeds_pricing',
                    message: 'paragraphs mentioning use of proceeds must not be atomicKind pricing',
                });
            }
            if (p.facts) {
                const f = p.facts;
                for (const d of f.dates) {
                    if (typeof d !== 'string' || !ISO_DATE.test(d)) {
                        issues.push({
                            path: `${sp}/facts/dates`,
                            code: 'fact_date_iso',
                            message: 'all dates must be YYYY-MM-DD',
                        });
                        break;
                    }
                }
                for (const x of f.dollar_amounts) {
                    if (!isUsd(x)) {
                        issues.push({
                            path: `${sp}/facts/dollar_amounts`,
                            code: 'fact_dollar_shape',
                            message: 'dollar amounts must be { value, currency: "USD" }',
                        });
                        break;
                    }
                }
                for (const x of f.price_thresholds) {
                    if (!isUsd(x)) {
                        issues.push({
                            path: `${sp}/facts/price_thresholds`,
                            code: 'fact_price_shape',
                            message: 'price_thresholds must be { value, currency: "USD" }',
                        });
                        break;
                    }
                }
                for (const x of f.time_windows) {
                    if (!isTw(x)) {
                        issues.push({
                            path: `${sp}/facts/time_windows`,
                            code: 'fact_time_window',
                            message: 'time windows must be { value, unit: day|month|year }',
                        });
                        break;
                    }
                }
            }
            assertSignalsNotDropped(sp, p.text, p.signals, entityRegistry, issues);
        }
        for (const b of s.blocks ?? []) {
            const expect = atomicKindForLayer1BlockType(b.type);
            const kinds = [];
            for (const pid of b.paragraph_ids) {
                const para = s.children.find((c) => c.id === pid);
                if (para?.atomicKind)
                    kinds.push(para.atomicKind);
            }
            const uniq = new Set(kinds);
            if (uniq.size > 1) {
                issues.push({
                    path: `sections/${s.id}/blocks/${b.id}`,
                    code: 'block_mixed_atomic_kind',
                    message: `block contains mixed atomicKind values: ${[...uniq].join(', ')}`,
                });
            }
            else {
                for (const ak of uniq) {
                    if (ak !== expect) {
                        issues.push({
                            path: `sections/${s.id}/blocks/${b.id}`,
                            code: 'block_atomic_mismatch',
                            message: `block type ${b.type} implies ${expect}, found ${ak}`,
                        });
                        break;
                    }
                }
            }
        }
    }
    return { ok: issues.length === 0, issues };
}
//# sourceMappingURL=validate-layer2.js.map