/**
 * v2 atomic kind — five values; aligned with block semantics.
 */
export function inferAtomicKind(text, pricing) {
    const t = text.trim();
    if (!t)
        return 'disclosure';
    const lower = t.toLowerCase();
    if (/^[☐☑□]|^exhibit\s+\d/im.test(t)) {
        return 'structural';
    }
    if (/^item\s+\d+\.\d+/im.test(t)) {
        if (!/\bVWAP\b|volume weighted average|per share purchase price that/i.test(t)) {
            return 'structural';
        }
    }
    if (/\bterminat(?:e|es|ing|ion)(?:\s+of)?\b/.test(lower) &&
        /\b(?:agreement|purchase agreement|arrangement|facility|plan|understanding|registration rights)\b/.test(lower)) {
        return 'termination';
    }
    if (/\b(?:event\s+of\s+default|bankruptcy|assignment for the benefit of creditors)\b/.test(lower) &&
        /\b(?:agreement|commence|custodian)\b/.test(lower)) {
        return 'termination';
    }
    if (pricing &&
        (pricing.method != null ||
            pricing.discount_rate != null ||
            pricing.valuation_window != null)) {
        return 'pricing';
    }
    if (/\bVWAP\b/i.test(t) ||
        /\b(?:discount|(?:purchase|closing|exercise)\s+price|price\s+per|per\s+share|fixed\s+price|redemption\s+price)\b/i.test(lower)) {
        return 'pricing';
    }
    if (/\b(?:cap|ceiling|limit|maximum|minimum|exchange cap|ownership|beneficially|shall not issue|shall not exceed|may not|4\.99%|19\.99%)\b/i.test(lower) &&
        /\b(?:shares?|securities?|common stock|%\b|listed)/i.test(t)) {
        return 'constraint';
    }
    if (/\b(?:standstill|restriction|prohibited|not applicable to)\b/i.test(lower)) {
        return 'constraint';
    }
    if (/\bSecurities\s+and\s+Exchange\s+Commission\b|17\s*CFR|filed\s+pursuant|furnished\s+pursuant|Rule\s+\d|safe\s+harbor|securities laws of any such state/i.test(t) ||
        /[""''].{0,200}[""'']\s+(?:means|shall\s+mean|has\s+the\s+meaning)\b/i.test(t) ||
        /\brepresentations,?\s+warranties\b/i.test(lower)) {
        return 'disclosure';
    }
    return 'disclosure';
}
//# sourceMappingURL=atomic-kind.js.map