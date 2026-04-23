import type { Layer1ClauseSignals, LegalCounterpartyRole } from './types.js';

/** Exchange names only when the token appears as such in text (explicit). */
function extractExchangeLiteral(text: string): string | null {
  if (/\bNYSE\s+American\b/i.test(text)) return 'NYSE American';
  if (/\bNYSE\b/i.test(text)) return 'NYSE';
  if (/\bNasdaq\b/i.test(text)) return 'Nasdaq';
  return null;
}

/** Security phrases copied from explicit wording (normalized slug). */
function extractSecurityTypeLiteral(text: string): string | null {
  const lower = text.toLowerCase();
  if (/\bpre[- ]funded\s+warrants?\b/i.test(lower)) return 'pre_funded_warrants';
  if (/\bcommon\s+stock\b/i.test(lower)) return 'common_stock';
  if (/\bpreferred\s+stock\b/i.test(lower)) return 'preferred_stock';
  if (/\bwarrants?\b/i.test(lower)) return 'warrants';
  return null;
}

/**
 * Agreement title only when it appears verbatim (quoted title or known full phrase).
 */
function extractAgreementTypeLiteral(text: string): string | null {
  const quoted = text.match(
    /"([^"]*(?:Agreement|Indenture|Guarantee)[^"]*)"/i,
  );
  if (quoted?.[1]) {
    const inner = quoted[1].replace(/\s+/g, ' ').trim();
    if (inner.length >= 8 && inner.length <= 200) return inner;
  }

  const known =
    /\b(Common\s+Stock\s+Purchase\s+Agreement|Security\s+Purchase\s+Agreement|Securities\s+Purchase\s+Agreement|Registration\s+Rights\s+Agreement|Equity\s+Distribution\s+Agreement)\b/i.exec(
      text,
    );
  if (known?.[1]) return known[1].trim();

  return null;
}

/**
 * "between X and Y", "by and among", or "with [Org]." — literal substrings.
 */
function extractCounterpartyLiteral(text: string): string | null {
  const m = text.match(
    /\bbetween\s+([^,]{2,120}?)\s+and\s+([^,]{2,120}?)(?:\s*[,(]|\s+under|\s+dated|\s+pursuant|\s+entered|\s+effective|\s+of\s+which|$)/i,
  );
  if (m?.[1] && m[2]) {
    const a = m[1].replace(/\s+/g, ' ').trim();
    const b = m[2].replace(/\s+/g, ' ').trim();
    if (a.length >= 2 && b.length >= 2) return `${a} | ${b}`;
  }
  const among = text.match(
    /\bby\s+and\s+among\s+([^.;\n]{6,200}?)(?:[.;]|\n|$)/i,
  );
  if (among?.[1]) {
    return among[1].replace(/\s+/g, ' ').trim();
  }
  const w = text.match(
    /(?:^|[.;]\s+)(?:together\s+with|with|from)\s+((?:(?:[A-Z0-9][A-Za-z&.'\u00ae-]*\s+){0,4}(?:LLC|L\.L\.C\.|Inc|Corp|Ltd|L\.P\.|LP)))\b/gi,
  );
  if (w?.[1]) {
    return w[1].replace(/\s+/g, ' ').trim();
  }
  return null;
}

/**
 * B. Riley org names through LLC (do not require a period after the final C — e.g. "… LLC (" ).
 */
function extractBrRileyOrg(text: string): string | null {
  const m =
    text.match(/\bB\.\s*Riley[^.;]{0,100}LLC\b/gi)?.[0] ??
    text.match(/\bB\.\s*Riley[^.;]{0,100}L\.?L\.?C\.\b/gi)?.[0] ??
    text.match(/\bB\.\s*Riley[^.;]{0,100}L\.?P\.\b/gi)?.[0] ??
    null;
  if (m) {
    return m.replace(/\s+/g, ' ').trim();
  }
  if (/\bB\.\s*Riley\b/i.test(text)) {
    return 'B. Riley';
  }
  return null;
}

function extractLegalRole(
  text: string,
  hasBr: boolean,
): LegalCounterpartyRole | undefined {
  if (
    hasBr &&
    /\b(?:purchas|Capital|Lender|invest|as\s+buyer|counterparty|Principal\s+Capital|Commitment|Notes?)\b/i.test(
      text,
    )
  ) {
    return 'purchaser';
  }
  if (
    /\b(?:as\s+)?issuer|issuing\s+the\s+securities|issuable\s+hereunder|issuable\s+under|registrant|the\s+Company[\s,]+as\s+issuer/i.test(
      text,
    )
  ) {
    return 'issuer';
  }
  if (/\bthe\s+Counterparty[,)]|\bcounterparty\s+means|Counterparty shall\b/i.test(text)) {
    return 'counterparty';
  }
  return undefined;
}

/**
 * Stated only — no inference. Used for v2 validation “no drop vs extract”.
 */
function buildLegalSignals(
  text: string,
  agr: string | null,
  rawCp: string | null,
  br: string | null,
): {
  agreement_type?: string;
  counterparty?: string;
  counterparty_raw?: string;
  role?: LegalCounterpartyRole;
} | null {
  let counterparty: string | undefined;
  let counterparty_raw: string | undefined;
  if (br) {
    counterparty = br;
    if (rawCp && rawCp.replace(/\s+/g, ' ') !== br.replace(/\s+/g, ' ')) {
      counterparty_raw = rawCp;
    }
  } else {
    counterparty = rawCp ?? undefined;
  }

  const hasBr = Boolean(br) || (counterparty != null && /Riley/i.test(counterparty));
  const role = extractLegalRole(text, hasBr);

  const o: {
    agreement_type?: string;
    counterparty?: string;
    counterparty_raw?: string;
    role?: LegalCounterpartyRole;
  } = {};
  if (agr) o.agreement_type = agr;
  if (counterparty) o.counterparty = counterparty;
  if (counterparty_raw) o.counterparty_raw = counterparty_raw;
  if (role) o.role = role;

  if (Object.keys(o).length) return o;
  return null;
}

export function extractLayer1Signals(text: string): Layer1ClauseSignals {
  const signals: Layer1ClauseSignals = {};

  const exchange = extractExchangeLiteral(text);
  if (exchange) signals.market_signals = { exchange };

  const sec = extractSecurityTypeLiteral(text);
  if (sec) signals.security_signals = { security_type: sec };

  const agr = extractAgreementTypeLiteral(text);
  const rawCp = extractCounterpartyLiteral(text);
  const br = extractBrRileyOrg(text);
  const legal = buildLegalSignals(text, agr, rawCp, br);
  if (legal) {
    signals.legal_signals = legal;
  } else if (agr) {
    signals.legal_signals = { agreement_type: agr };
  }

  return signals;
}

/** Remove buckets where every leaf is null / empty; omit entirely if nothing left. */
export function pruneLayer1Signals(
  s: Layer1ClauseSignals,
): Layer1ClauseSignals | undefined {
  const out: Layer1ClauseSignals = {};

  if (s.market_signals?.exchange) {
    out.market_signals = { exchange: s.market_signals.exchange };
  }

  if (s.security_signals?.security_type) {
    out.security_signals = { security_type: s.security_signals.security_type };
  }

  if (s.legal_signals) {
    const o: {
      agreement_type?: string;
      counterparty?: string;
      counterparty_raw?: string;
      role?: LegalCounterpartyRole;
    } = {};
    if (s.legal_signals.agreement_type) {
      o.agreement_type = s.legal_signals.agreement_type;
    }
    if (s.legal_signals.counterparty) o.counterparty = s.legal_signals.counterparty;
    if (s.legal_signals.counterparty_raw) {
      o.counterparty_raw = s.legal_signals.counterparty_raw;
    }
    if (s.legal_signals.role) o.role = s.legal_signals.role;
    if (Object.keys(o).length) out.legal_signals = o;
  }

  return Object.keys(out).length > 0 ? out : undefined;
}
