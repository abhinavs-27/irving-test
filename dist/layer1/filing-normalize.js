import { resolveNameToEntityId } from './entity-registry.js';
const ISO = /^\d{4}-\d{2}-\d{2}$/;
/** Convert percent points (e.g. 19.99) to decimal fraction (0.1999). */
export function percentagePointsToDecimal(points) {
    return points / 100;
}
/** Normalize facts: add `percentage_decimals` parallel to percentages; coerce money shape. */
export function normalizeFactsDecimals(facts) {
    const percentage_decimals = facts.percentages.map((p) => percentagePointsToDecimal(p));
    return {
        ...facts,
        ...(percentage_decimals.some((x) => Number.isFinite(x))
            ? { percentage_decimals }
            : {}),
    };
}
/** Ensure USD amounts use { value, currency: 'USD' }. */
export function normalizeUsdAmount(u) {
    if (typeof u?.value !== 'number' || !Number.isFinite(u.value))
        return null;
    return { value: u.value, currency: 'USD' };
}
/** Normalize date strings to ISO YYYY-MM-DD when parseable. */
export function normalizeIsoDate(raw) {
    const t = raw.trim();
    if (ISO.test(t))
        return t;
    const d = new Date(t);
    if (Number.isNaN(d.getTime()))
        return null;
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}
/** Resolve alias / fragment to canonical org id when possible. */
export function resolveAliasToEntityId(phrase, registry) {
    return resolveNameToEntityId(phrase, registry);
}
/** Walk section tree and attach normalized facts copy on paragraph nodes (immutable input safe if caller clones). */
export function applyNormalizedFactsToSections(nodes) {
    if (!nodes)
        return undefined;
    return nodes.map((n) => {
        let next = { ...n };
        if (n.type === 'paragraph' && n.facts) {
            next = {
                ...next,
                facts: normalizeFactsDecimals(n.facts),
            };
        }
        if (n.children?.length) {
            next = { ...next, children: applyNormalizedFactsToSections(n.children) };
        }
        return next;
    });
}
//# sourceMappingURL=filing-normalize.js.map