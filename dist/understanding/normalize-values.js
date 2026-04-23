/**
 * Deterministic parsers for normalized numeric / symbolic outputs (USD base unit: dollars).
 */
/** Parse `$1,234.56` → 1234.56 */
export function parseUsdScalar(raw) {
    const m = raw.replace(/,/g, '').match(/\d+(?:\.\d{1,4})?/);
    if (!m)
        return null;
    const n = Number.parseFloat(m[0]);
    return Number.isFinite(n) ? Math.round(n * 1e4) / 1e4 : null;
}
/** All dollar amounts in text as USD floats (dedupe close duplicates tolerantly). */
export function extractUsdAmounts(text) {
    const found = [];
    for (const m of text.matchAll(/\$\s*([\d,]+(?:\.\d{2})?)/g)) {
        const n = parseUsdScalar(m[1] ?? m[0]);
        if (n !== null)
            found.push(n);
    }
    return [...new Set(found)];
}
/** Percentage literal → numeric (e.g. 19.99 from "19.99%"). */
export function parsePercentLiteral(text) {
    const m = text.match(/(\d{1,3}(?:\.\d+)?)\s*%/);
    if (!m)
        return null;
    const n = Number.parseFloat(m[1]);
    return Number.isFinite(n) ? Math.round(n * 1e4) / 1e4 : null;
}
/** Collect percentage values when context suggests regulatory / ownership caps. */
export function extractPercentValues(text) {
    const out = [];
    for (const m of text.matchAll(/\b(\d{1,2}(?:\.\d+)?)\s*%/g)) {
        const n = Number.parseFloat(m[1]);
        if (Number.isFinite(n))
            out.push(Math.round(n * 1e4) / 1e4);
    }
    return [...new Set(out)];
}
/**
 * Rudimentary ISO date extraction (SEC filings). Returns null if ambiguous.
 */
export function extractIsoDates(text) {
    const out = [];
    const iso = text.match(/\b(\d{4}-\d{2}-\d{2})\b/g);
    if (iso)
        out.push(...iso);
    const mdY = text.matchAll(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),\s*(\d{4})\b/g);
    const months = {
        January: '01',
        February: '02',
        March: '03',
        April: '04',
        May: '05',
        June: '06',
        July: '07',
        August: '08',
        September: '09',
        October: '10',
        November: '11',
        December: '12',
    };
    for (const m of mdY) {
        const mo = months[m[1]];
        if (!mo)
            continue;
        const day = m[2].padStart(2, '0');
        out.push(`${m[3]}-${mo}-${day}`);
    }
    return [...new Set(out)];
}
//# sourceMappingURL=normalize-values.js.map