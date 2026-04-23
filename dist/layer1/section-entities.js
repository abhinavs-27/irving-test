function cleanOrg(s) {
    return s
        .replace(/^\s*(?:with|by and between|from|to)\s+/i, '')
        .replace(/\s+/g, ' ')
        .trim();
}
/** Punctuation-stripped, single-spaced, for display after dedupe. */
function normalizeEntity(s) {
    return s
        .replace(/[^\p{L}\p{N}\s&'-]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}
function dedupeNormalized(list) {
    const seen = new Set();
    const out = [];
    for (const raw of list) {
        const c = cleanOrg(raw);
        const n = normalizeEntity(c);
        if (n.length < 3)
            continue;
        if (/^(the|a|an)\s+company$/i.test(n))
            continue;
        const key = n.toLowerCase();
        if (seen.has(key))
            continue;
        seen.add(key);
        out.push(n);
    }
    return out.sort((a, b) => a.localeCompare(b));
}
const ORG_RE = /\b([A-Z0-9][A-Za-z0-9&.'\u00ae-]*(?:\s+[A-Z0-9][A-Za-z0-9&.'-]*)*)\s*,?\s*(?:LLC|L\.L\.C\.|Inc\.?|Corp\.?|Ltd\.?|L\.P\.?|LP)\b/gi;
const NAMED = /\b(Gelesis(?:\s+Holdings,?\s+Inc\.?)?|B\.\s*Riley Principal Capital II,?\s+LLC?|B\.\s*Riley)(?![A-Za-z])/gi;
/**
 * Registrant + named orgs + counterparty(s) from signals; deduped and normalized.
 */
export function buildSectionEntities(children, registrantName) {
    const organizations = [];
    if (registrantName)
        organizations.push(registrantName);
    const all = children.map((c) => c.text).join('\n');
    for (const m of all.matchAll(NAMED)) {
        if (m[1])
            organizations.push(m[1].replace(/\s+/g, ' ').trim());
    }
    for (const m of all.matchAll(ORG_RE)) {
        if (m[0] && m[0].length > 3 && m[0].length < 90) {
            const o = m[0].replace(/\s+/g, ' ').trim();
            if (!/^(with|by and|from)\b/i.test(o))
                organizations.push(o);
        }
    }
    for (const p of children) {
        const cp = p.signals?.legal_signals?.counterparty;
        if (cp) {
            for (const part of cp.split(/\s*\|\s*/)) {
                if (part.trim().length > 2)
                    organizations.push(part.trim());
            }
        }
    }
    const people = [];
    for (const m of all.matchAll(/\/s\/\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/g)) {
        const line = m[1].split(/\s+(?:Chief|Principal|Officer|Director|Financial|Accounting|President)\b/)[0];
        if (line)
            people.push(line.replace(/\s+/g, ' ').trim());
    }
    for (const m of all.matchAll(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3}),\s+(?:Chief|President|Principal|Senior|CFO|CEO|COO|Secretary|Treasurer|Officer|Director|Accounting)\b/gi)) {
        if (m[1])
            people.push(m[1].replace(/\s+/g, ' ').trim());
    }
    return {
        organizations: dedupeNormalized(organizations),
        people: dedupeNormalized(people),
    };
}
//# sourceMappingURL=section-entities.js.map