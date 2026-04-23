/**
 * Literal pricing / valuation window only (v2 schema).
 */
export function extractExplicitClausePricing(text) {
    const t = text.replace(/\s+/g, ' ').trim();
    if (!t)
        return undefined;
    let method;
    if (/\bVWAP\b/i.test(t))
        method = 'VWAP';
    else if (/\bfixed\s+(?:purchase\s+)?price\b/i.test(t) ||
        /\bat\s+a\s+fixed\s+(?:price|rate)\b/i.test(t) ||
        /\bfixed\s+price\b/i.test(t))
        method = 'FIXED';
    else if (/\bcalculated in accordance|equitably adjusted|volume\s+weighted|formula/i.test(t) &&
        /\bprice|VWAP|per share/i.test(t))
        method = 'FORMULA';
    let discount_rate;
    const discOf = t.match(/\bdiscount(?:\s+rate|\s+of)?\s*(?:of|is|=|:)?\s*(\d+(?:\.\d+)?)\s*%/i);
    const discPctFirst = t.match(/(\d+(?:\.\d+)?)\s*%\s*(?:discount|off\s+the)/i);
    const m = discOf ?? discPctFirst;
    if (m?.[1]) {
        const n = Number.parseFloat(m[1]);
        if (Number.isFinite(n))
            discount_rate = n;
    }
    let valuation_window;
    if (/\bintraday\b/i.test(t))
        valuation_window = 'intraday';
    else if (/\bfull\s+primary|regular\)?\s*trading\s+session|primary\s+trading\s+session|full_session/i.test(t))
        valuation_window = 'full_session';
    if (method == null && discount_rate == null && valuation_window == null) {
        return undefined;
    }
    const o = {};
    if (method)
        o.method = method;
    if (discount_rate != null)
        o.discount_rate = discount_rate;
    if (valuation_window)
        o.valuation_window = valuation_window;
    return o;
}
//# sourceMappingURL=explicit-pricing.js.map