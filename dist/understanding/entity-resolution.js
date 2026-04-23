/**
 * Cross-clause entity normalization: canonical instrument labels and structured parties.
 */
/** Order matters: first match wins for canonical label. */
const INSTRUMENT_CANONICAL = [
    {
        pattern: /Common\s+Stock\s+Purchase\s+Agreement|Purchase\s+Agreement[^.\n]{0,80}B\.?\s*Riley/i,
        canonical: 'Common Stock Purchase Agreement (B. Riley Principal Capital II)',
    },
    {
        pattern: /Registration\s+Rights\s+Agreement/i,
        canonical: 'Registration Rights Agreement',
    },
    {
        pattern: /\bPurchase\s+Agreement\b/i,
        canonical: 'Purchase Agreement',
    },
    {
        pattern: /\bCredit\s+Agreement\b/i,
        canonical: 'Credit Agreement',
    },
    {
        pattern: /\bIndenture\b/i,
        canonical: 'Indenture',
    },
];
export function canonicalizeInstrument(raw) {
    const t = raw.trim();
    for (const { pattern, canonical } of INSTRUMENT_CANONICAL) {
        if (pattern.test(t))
            return canonical;
    }
    return t;
}
/** When the document references B. Riley, collapse generic Purchase Agreement to the CSPAs. */
export function canonicalizeInstrumentsForDocument(list, documentText) {
    const resolved = resolveInstruments(list);
    if (!resolved)
        return null;
    if (!/B\.?\s*Riley/i.test(documentText))
        return resolved;
    return resolved.map((inst) => inst === 'Purchase Agreement' ||
        /^Purchase\s+Agreement$/i.test(inst.trim())
        ? 'Common Stock Purchase Agreement (B. Riley Principal Capital II)'
        : inst);
}
/** Normalize whitespace and dedupe case-insensitively (keep first canonical casing). */
export function canonicalizeParty(raw) {
    return raw.replace(/\s+/g, ' ').trim();
}
export function resolveInstruments(list) {
    if (!list || list.length === 0)
        return null;
    const seen = new Set();
    const out = [];
    for (const r of list) {
        const c = canonicalizeInstrument(r);
        const key = c.toLowerCase();
        if (seen.has(key))
            continue;
        seen.add(key);
        out.push(c);
    }
    return out.length ? out : null;
}
/**
 * Map raw party phrases to `{ company, counterparty }`; null if insufficient signal.
 */
export function resolvePartiesToRoles(list, text) {
    if (!list || list.length === 0)
        return null;
    const normalized = [...new Map(list.map((p) => [canonicalizeParty(p).toLowerCase(), p])).values()].map(canonicalizeParty);
    if (normalized.length >= 2) {
        return {
            company: normalized[0],
            counterparty: normalized[1],
        };
    }
    const sole = normalized[0];
    if (/\b(?:Purchaser|Investor|Buyer)\b/i.test(sole))
        return { company: null, counterparty: sole };
    if (/\bthe\s+Company\b/i.test(text) ||
        /,\s*Inc\.?\s*$/i.test(sole) ||
        /\bRegistrant\b/i.test(text))
        return { company: sole, counterparty: null };
    return { company: sole, counterparty: null };
}
export function mergeEntities(a, b) {
    const parties = [...(a.parties ?? []), ...(b.parties ?? [])];
    const instruments = [...(a.instruments ?? []), ...(b.instruments ?? [])];
    return {
        parties: parties.length ? [...new Set(parties)] : null,
        instruments: instruments.length ? [...new Set(instruments)] : null,
    };
}
//# sourceMappingURL=entity-resolution.js.map