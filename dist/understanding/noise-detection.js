/**
 * misc.noise only when there is **no** extractable legal/SEC semantic content worth classifying.
 * Exhibit references, signatures, filing headers are **signals**, not noise bucket triggers.
 */
const MIN_CHARS_DEFAULT = 80;
/** Tokens / patterns indicating non-noise semantics (even in short paragraphs). */
export function hasStrongSemanticSignals(text) {
    const t = text;
    if (/\bExhibit\s+[A-Z0-9.-]+\b/i.test(t))
        return true;
    if (/\bVWAP\b|purchase\s+price|per\s+share|\$\s*[\d,.]+/i.test(t))
        return true;
    if (/\b(?:shall|must|will)\b.*\b(?:file|pay|deliver|terminate|purchase)\b/i.test(t))
        return true;
    if (/\b(?:Company|Registrant|Seller|Investor|Purchaser|Counterparty)\b/i.test(t))
        return true;
    if (/\b(?:Agreement|Indenture|Purchase Agreement)\b/i.test(t))
        return true;
    if (/\bterminat(?:e|ion)|Event of Default|bankruptcy\b/i.test(t))
        return true;
    if (/SECURITIES AND EXCHANGE COMMISSION/i.test(t) && t.length >= 60)
        return true;
    if (/\bPursuant to the requirements of .{0,120}Exchange Act\b/i.test(t))
        return true;
    if (/\bItem\s+\d+\.\d+/i.test(t))
        return true;
    return false;
}
/**
 * Boilerplate / exhibit / signature — still **signal** for classification (not misc.noise by default).
 */
export function collectSignalCodes(text) {
    const codes = [];
    if (/SECURITIES AND EXCHANGE COMMISSION/i.test(text))
        codes.push('form_header');
    if (/\bExhibit\s+\d/i.test(text))
        codes.push('exhibit_reference');
    if (/^SIGNATURES?$/im.test(text) ||
        /\bPursuant to the requirements of the Securities Exchange Act\b/i.test(text))
        codes.push('signature_block');
    const compact = text.replace(/\s+/g, ' ').trim();
    if (compact.length > 0 &&
        compact.length < MIN_CHARS_DEFAULT &&
        !hasStrongSemanticSignals(text))
        codes.push('low_character_count');
    return codes;
}
/** Repeated navigation crumbs / duplicate Item line only (no body). */
export function isPureNavigationOrStructuralRepetition(text) {
    const t = text.replace(/\s+/g, ' ').trim();
    if (t.length === 0)
        return true;
    if (/^(?:☐|\d+\.)+\s*$/.test(t))
        return true;
    const itemOnly = /^Item\s+\d+\.\d+[^\n]{0,120}$/i.test(t) &&
        !/\b(?:Agreement|entered|material|party|Company)\b/i.test(t);
    if (itemOnly && t.length < 160)
        return true;
    return false;
}
export function isLowInformationContent(text) {
    const t = text.replace(/\s+/g, ' ').trim();
    if (hasStrongSemanticSignals(text))
        return false;
    if (t.length < MIN_CHARS_DEFAULT)
        return true;
    if (/^☐|^\d+\.\s*$/m.test(t) && t.length < 200)
        return true;
    return false;
}
//# sourceMappingURL=noise-detection.js.map