import { parsePercentLiteral, parseUsdScalar } from '../understanding/normalize-values.js';
import { extractEntities } from '../understanding/entities.js';
import { canonicalizeInstrument } from '../understanding/entity-resolution.js';
function extractTickers(text) {
    const out = new Set();
    for (const m of text.matchAll(/\(\s*Nasdaq\s*:\s*([A-Z]{1,5})\s*\)/gi))
        out.add(m[1].toUpperCase());
    for (const m of text.matchAll(/\bNYSE\s*:\s*([A-Z]{1,5})\b/gi))
        out.add(m[1].toUpperCase());
    for (const m of text.matchAll(/\bSymbol\s*[:\s]+([A-Z]{1,5})\b/gi))
        out.add(m[1].toUpperCase());
    return [...out];
}
function extractExchanges(text) {
    const ex = new Set();
    if (/\bNYSE\b/i.test(text))
        ex.add('NYSE');
    if (/\bNasdaq\b/i.test(text))
        ex.add('Nasdaq');
    if (/\bNYSE\s+American\b/i.test(text))
        ex.add('NYSE American');
    return [...ex];
}
function extractSecurityTypes(text) {
    const s = new Set();
    if (/\bcommon\s+stock\b/i.test(text))
        s.add('common_stock');
    if (/\bwarrants?\b/i.test(text))
        s.add('warrants');
    if (/\bpreferred\s+stock\b/i.test(text))
        s.add('preferred_stock');
    return [...s];
}
function extractStrikes(text) {
    const out = [];
    for (const m of text.matchAll(/\$\s*([\d,.]+)\s*(?:per\s+share\s+)?strike/gi)) {
        const n = parseUsdScalar(m[1]);
        if (n != null)
            out.push(n);
    }
    return out;
}
/**
 * True when `s` looks like a legal entity / party name, not a mid-clause fragment.
 */
export function isValidEntityPhrase(s) {
    if (!s)
        return false;
    const t = s.replace(/\s+/g, ' ').trim();
    if (t.length < 3 || t.length > 140)
        return false;
    if (!/[A-Za-z]/.test(t))
        return false;
    if (/\b(?:will|would|shall|must|may|might|could|should|has|have|had|is|are|was|were)\s+(?:the\s+)?(?:right|obligation|no\s+obligation)\b/i.test(t))
        return false;
    if (/\b(?:under\s+no\s+obligation|pursuant\s+to|in\s+accordance\s+with)\b/i.test(t))
        return false;
    if (/\b(?:sell\s+to|sell\s+any\s+securities)\b/i.test(t) && t.split(/\s+/).length > 8)
        return false;
    if (/^[a-z]/.test(t) && !/^mc[A-Z]/i.test(t))
        return false;
    const words = t.split(/\s+/).length;
    if (words > 18)
        return false;
    if (/^[^A-Za-z"]+$/.test(t))
        return false;
    return true;
}
function normalizeAgreementType(raw) {
    if (!raw)
        return null;
    const c = canonicalizeInstrument(raw);
    if (/purchase\s+agreement/i.test(c))
        return 'CSA';
    if (/registration\s+rights/i.test(c))
        return 'RRA';
    if (/credit\s+agreement/i.test(c))
        return 'CREDIT';
    return c.slice(0, 80);
}
export function extractLayer1Signals(text) {
    const signals = {};
    const hasPricing = /\bVWAP\b|purchase\s+price|per\s+share|discount|cap\b/i.test(text);
    if (hasPricing) {
        let vwap_formula = null;
        const vw = text.match(/\bVWAP\b[^.\n]{0,200}/i);
        if (vw)
            vwap_formula = vw[0].replace(/\s+/g, ' ').trim().slice(0, 240);
        const discount_percent = parsePercentLiteral(text);
        const tw = text.match(/\b(\d{1,2})\s+(?:consecutive\s+)?(?:trading\s+)?(?:market\s+)?days?\b/i);
        const valuation_window = tw
            ? `${tw[1]} trading days`
            : /\bfive\s+trading\s+days\b/i.test(text)
                ? '5 trading days'
                : null;
        const exclusions = [];
        if (/\bpre[- ]market\b/i.test(text))
            exclusions.push('pre_market');
        if (/\bafter[- ]hours\b/i.test(text))
            exclusions.push('after_hours');
        signals.pricing = {
            vwap_formula,
            discount_percent,
            valuation_window,
            exclusions: exclusions.length ? exclusions : null,
        };
    }
    if (/\bshares?\b|\$\s*[\d,.]+\s*(?:million|billion)?\b|ownership|beneficial/i.test(text)) {
        let max_shares = null;
        const sm = text.match(/\b(?:up to|not more than)\s+([\d,]+)\s+shares\b/i);
        if (sm)
            max_shares = Number.parseInt(sm[1].replace(/,/g, ''), 10);
        let max_dollar_amount = null;
        const dm = text.match(/\$\s*([\d,.]+)\s*(?:million|M)\b/i);
        if (dm?.[1]) {
            const usd = parseUsdScalar(dm[1]);
            if (usd != null)
                max_dollar_amount = usd * 1e6;
        }
        let exchange_cap = null;
        const ec = text.match(/\bexchange\s+cap\s+(?:of\s+)?\$\s*([\d,.]+)/i);
        if (ec)
            exchange_cap = parseUsdScalar(ec[1]);
        signals.equity = {
            max_shares,
            max_dollar_amount,
            exchange_cap,
            ownership_cap_percent: /\bownership\b/i.test(text)
                ? parsePercentLiteral(text)
                : null,
        };
    }
    if (/\bterminat|bankruptcy|default|expir/i.test(text)) {
        const triggers = [];
        if (/\bbankruptcy\b/i.test(text))
            triggers.push('bankruptcy');
        if (/\binsolvency\b/i.test(text))
            triggers.push('insolvency');
        if (/\bbreach\b|Event of Default/i.test(text))
            triggers.push('breach');
        if (/\bmutual\s+consent\b/i.test(text))
            triggers.push('mutual_consent');
        if (/\bfor\s+convenience\b/i.test(text))
            triggers.push('convenience');
        if (/\bSEC\b|regulator/i.test(text))
            triggers.push('regulatory');
        let termination_type = 'unspecified';
        if (/\bautomatic(?:ally)?\s+terminat/i.test(text))
            termination_type = 'automatic';
        else if (/\b(?:either\s+party\s+may\s+)?terminat/i.test(text))
            termination_type = 'optional';
        else if (/\bmutual\b/i.test(text))
            termination_type = 'mutual';
        else if (/\bregulatory\b/i.test(text))
            termination_type = 'regulatory';
        signals.termination = {
            termination_triggers: triggers.length ? triggers : null,
            termination_type,
        };
    }
    if (/\bpay|wire|escrow|settlement|closing\s+payment/i.test(text)) {
        let timing = null;
        if (/\bupon\s+clos/i.test(text))
            timing = 'upon_closing';
        else if (/\bwithin\s+\d+\s+days?\b/i.test(text)) {
            const w = text.match(/\bwithin\s+(\d+)\s+days?\b/i);
            timing = w ? `within_${w[1]}_days` : null;
        }
        signals.payment = {
            timing,
            settlement_mechanics: /\bDTC\b|\bclearing\b|\bDWAC\b/i.test(text)
                ? 'dtc_style'
                : null,
            wire_instructions_presence: /\bwire\b|\brouting\b|\bABA\b|\bSWIFT\b/i.test(text),
        };
    }
    const rawEnt = extractEntities(text);
    const tickers = extractTickers(text);
    const exchanges = extractExchanges(text);
    const secTypes = extractSecurityTypes(text);
    const strikes = extractStrikes(text);
    let agreement_type_normalized = null;
    if (rawEnt.instruments?.[0])
        agreement_type_normalized = normalizeAgreementType(rawEnt.instruments[0]);
    const issuerRaw = rawEnt.parties?.[0] ?? null;
    const counterRaw = rawEnt.parties?.[1] ?? null;
    const ent = {
        ticker_symbols: tickers.length ? tickers : null,
        exchanges: exchanges.length ? exchanges : null,
        security_types: secTypes.length ? secTypes : null,
        strike_prices: strikes.length ? strikes : null,
        issuer: isValidEntityPhrase(issuerRaw) ? issuerRaw : null,
        counterparty: isValidEntityPhrase(counterRaw) ? counterRaw : null,
        agreement_type_normalized,
    };
    const entHas = agreement_type_normalized != null ||
        ent.ticker_symbols != null ||
        ent.exchanges != null ||
        ent.security_types != null ||
        ent.strike_prices != null ||
        ent.issuer != null ||
        ent.counterparty != null;
    if (entHas)
        signals.entities = ent;
    return signals;
}
function nestedHasContent(v) {
    if (v == null || v === false)
        return false;
    if (Array.isArray(v))
        return v.length > 0;
    if (typeof v === 'object')
        return Object.values(v).some(nestedHasContent);
    return true;
}
/** Drop empty buckets so JSON omits meaningless fields. */
export function pruneLayer1Signals(s) {
    const next = {};
    for (const key of Object.keys(s)) {
        const v = s[key];
        if (nestedHasContent(v))
            next[key] = v;
    }
    return Object.keys(next).length > 0 ? next : undefined;
}
//# sourceMappingURL=clause-signals.js.map