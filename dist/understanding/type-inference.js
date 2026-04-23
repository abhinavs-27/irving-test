/**
 * When regex scoring ties / misses, infer a substantive clause type from SEC filing signals.
 * Exhibit refs, filing headers, signature attestations carry legal semantics (not misc.noise).
 */
export function inferSubstantiveTypeFallback(text) {
    const t = text;
    if (/\bExhibit\s+[A-Z0-9.-]+\b/i.test(t))
        return 'obligations';
    if (/\bPursuant to the requirements of (?:Section\s+\d+(?:\.\d+)?\s+of\s+)?the\s+Securities\s+Exchange\s+Act\b/i.test(t))
        return 'obligations';
    if (/SECURITIES AND EXCHANGE COMMISSION/i.test(t) && t.replace(/\s+/g, ' ').trim().length >= 90)
        return 'obligations';
    if (/\bItem\s+\d+\.\d+/i.test(t) && /\b(?:Agreement|Parties|Company|Registrant)\b/.test(t))
        return 'obligations';
    if (/\b(?:SIGNATURE|Signature)\s*$/im.test(t) || /^SIGNATURES?\s*$/im.test(t))
        return 'obligations';
    return null;
}
//# sourceMappingURL=type-inference.js.map