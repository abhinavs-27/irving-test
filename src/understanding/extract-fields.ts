import type { SubstantiveClauseType } from './types.js';
import {
  extractIsoDates,
  extractPercentValues,
  extractUsdAmounts,
  parsePercentLiteral,
  parseUsdScalar,
} from './normalize-values.js';

type TriggerCode =
  | 'bankruptcy'
  | 'material_breach'
  | 'listing_failure'
  | 'mutual_consent'
  | 'insolvency';

function extractTermination(text: string): Record<string, unknown> {
  const notice =
    text.match(
      /\b(\d{1,3})\s*(?:calendar\s+)?(?:business\s+)?days?\s+(?:'|’|')?(?:advance\s+)?notice\b/i,
    ) ?? text.match(/\b(\d{1,3})\s*(?:business\s+)?days?\b/i);
  const notice_period_days = notice
    ? Number.parseInt(notice[1]!, 10)
    : null;

  const triggers: TriggerCode[] = [];
  if (/\bbankruptcy\b/i.test(text)) triggers.push('bankruptcy');
  if (/\b(?:material|MAC)\s+breach\b/i.test(text)) triggers.push('material_breach');
  if (/\blicen[sc]e(?:\s+\w+)?\s+(?:failure|revocation)\b/i.test(text))
    triggers.push('listing_failure');
  if (/\bmutual\s+consent\b/i.test(text)) triggers.push('mutual_consent');
  if (/\binsolvency\b/i.test(text)) triggers.push('insolvency');

  const mutual_termination_allowed =
    /\bmutual\b/i.test(text) && /\bterminat/i.test(text)
      ? true
      : /\bby\s+mutual\b/i.test(text)
        ? true
        : null;

  return {
    notice_period_days,
    termination_trigger_codes: triggers.length > 0 ? triggers : null,
    mutual_termination_allowed,
    termination_for_convenience: /\bfor\s+convenience\b/i.test(text)
      ? true
      : null,
    termination_for_cause: /\bfor\s+cause\b/i.test(text) ? true : null,
    references_automatic_termination: /\bautomatic(?:ally)?\s+terminat/i.test(
      text,
    )
      ? true
      : null,
    material_dates_iso:
      extractIsoDates(text).length > 0 ? extractIsoDates(text) : null,
  };
}

/** Semantic pricing: models, discount rows bound to VWAP/trading context, caps. */
function extractPricingTerms(text: string): Record<string, unknown> {
  let pricing_model:
    | 'volume_weighted_average_price'
    | 'fixed_price'
    | 'per_share'
    | null = null;
  const hasVwap = /\bVWAP\b/i.test(text);
  if (hasVwap) pricing_model = 'volume_weighted_average_price';
  else if (/\bfixed\s+price\b/i.test(text)) pricing_model = 'fixed_price';
  else if (/\bper\s+share\b/i.test(text)) pricing_model = 'per_share';

  const pct = parsePercentLiteral(text);
  const hasDiscountCue =
    /\bdiscount\b/i.test(text) ||
    /\b\d+(?:\.\d+)?\s*%\s*(?:below|discount|off)/i.test(text);

  const tradingSession =
    /\bregular\s+trading\s+(?:session|hours)\b/i.test(text) ||
    /\b(?:market|trading)\s+session\b/i.test(text);
  const tradingDaysMention =
    /\b(?:trading|intraday)\s+days?\b/i.test(text) ||
    /\bfive\s+trading\s+days\b/i.test(text);

  const discount_terms: Record<string, unknown>[] = [];
  if (pct != null || (hasDiscountCue && hasVwap)) {
    let applies_to:
      | 'volume_weighted_average_price'
      | 'purchase_price'
      | null = null;
    if (hasVwap) applies_to = 'volume_weighted_average_price';
    else if (/\bpurchase\s+price\b/i.test(text)) applies_to = 'purchase_price';

    let condition:
      | 'regular_trading_session'
      | 'trading_days_window'
      | 'unspecified'
      | null = null;
    if (tradingSession) condition = 'regular_trading_session';
    else if (tradingDaysMention) condition = 'trading_days_window';
    else if (hasVwap || pct != null) condition = 'unspecified';

    discount_terms.push({
      mechanism: 'discount',
      value_percent: pct,
      applies_to,
      condition,
    });
  }

  let cap_usd: number | null = null;
  const capM = text.match(
    /\b(?:cap|ceiling|limit)(?:ed|s)?\s+(?:of|at)?\s*\$\s*([\d,.]+)/i,
  );
  if (capM) cap_usd = parseUsdScalar(capM[1] ?? capM[0]);

  const WORD_NUM: Record<string, number> = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
  };
  const wm = text.match(
    /\b(one|two|three|four|five|six|seven|eight|nine|ten)\s+trading\s+days?\b/i,
  );
  let trading_days_window: number | null = wm
    ? WORD_NUM[wm[1]!.toLowerCase()] ?? null
    : null;
  if (trading_days_window === null) {
    const td = text.match(/\b(\d{1,2})\s+(?:trading\s+)?(?:day|days)\b/i);
    trading_days_window = td ? Number.parseInt(td[1]!, 10) : null;
  }

  return {
    pricing_model,
    discount_terms: discount_terms.length > 0 ? discount_terms : null,
    cap_usd,
    trading_days_window,
    material_dates_iso:
      extractIsoDates(text).length > 0 ? extractIsoDates(text) : null,
  };
}

function extractConstraints(text: string): Record<string, unknown> {
  const regulatory_threshold_percents =
    extractPercentValues(text).length > 0
      ? extractPercentValues(text)
      : null;

  const ownership_cap_percent =
    /\b(?:ownership|beneficial|voting)\b/i.test(text)
      ? parsePercentLiteral(text)
      : null;

  return {
    regulatory_threshold_percents,
    ownership_cap_percent,
    issuance_restriction_referenced: /\bissuance\s+(?:limit|cap|restriction)\b/i.test(
      text,
    )
      ? true
      : null,
    shall_not_exceed_referenced: /\bshall not exceed\b/i.test(text)
      ? true
      : null,
  };
}

function extractPayment(text: string): Record<string, unknown> {
  const amounts_usd =
    extractUsdAmounts(text).length > 0 ? extractUsdAmounts(text) : null;

  const wd = text.match(/\bwithin\s+(\d{1,3})\s+days?\b/i);
  const within_days = wd ? Number.parseInt(wd[1]!, 10) : null;

  let timing_code: 'upon_closing' | 'within_days' | 'unspecified' | null =
    null;
  if (/\bupon\s+(?:closing|delivery|receipt)\b/i.test(text))
    timing_code = 'upon_closing';
  else if (within_days !== null) timing_code = 'within_days';
  else timing_code = 'unspecified';

  let frequency_code: 'monthly' | 'quarterly' | 'annual' | null = null;
  if (/\bmonthly\b/i.test(text)) frequency_code = 'monthly';
  else if (/\bquarterly\b/i.test(text)) frequency_code = 'quarterly';
  else if (/\bannually\b|\bannual\b/i.test(text)) frequency_code = 'annual';

  let calculation_basis:
    | 'volume_weighted_average_price'
    | 'pro_rata'
    | 'net_proceeds'
    | null = null;
  if (/\bVWAP\b/i.test(text))
    calculation_basis = 'volume_weighted_average_price';
  else if (/\bpro rata\b/i.test(text)) calculation_basis = 'pro_rata';
  else if (/\bnet\s+proceeds\b/i.test(text))
    calculation_basis = 'net_proceeds';

  const wire_instructions = /\bwire\s+transfer\b/i.test(text)
    ? true
    : /\bABA\b|\brouting\b|\bSWIFT\b/i.test(text)
      ? true
      : null;

  return {
    amounts_usd,
    timing_code,
    within_days,
    frequency_code,
    calculation_basis,
    wire_instructions,
    material_dates_iso:
      extractIsoDates(text).length > 0 ? extractIsoDates(text) : null,
  };
}

function extractConfidentiality(text: string): Record<string, unknown> {
  const scope_codes: ('confidential_information' | 'proprietary')[] = [];
  if (/\bconfidential\s+information\b/i.test(text))
    scope_codes.push('confidential_information');
  if (/\bproprietary\b/i.test(text)) scope_codes.push('proprietary');

  const dm = text.match(
    /\b(?:for|after)\s+(?:a\s+period\s+of\s+)?(\d+)\s*(year|month)s?\b/i,
  );
  let duration_months: number | null = null;
  if (dm?.[2]) {
    const n = Number.parseInt(dm[1]!, 10);
    if (dm[2].toLowerCase().startsWith('year')) duration_months = n * 12;
    else duration_months = n;
  }

  const exception_codes: ('public_domain' | 'legal_requirement')[] = [];
  if (/\bpublic(?:ly)?\s+available\b/i.test(text))
    exception_codes.push('public_domain');
  if (/\brequired\s+by\s+law\b/i.test(text))
    exception_codes.push('legal_requirement');

  return {
    scope_codes: scope_codes.length > 0 ? scope_codes : null,
    duration_months,
    exception_codes: exception_codes.length > 0 ? exception_codes : null,
  };
}

function extractIndemnity(text: string): Record<string, unknown> {
  let indemnity_scope_code: 'third_party_claims' | 'general' | null = null;
  if (/\bthird[\s-]?party\s+claims?\b/i.test(text))
    indemnity_scope_code = 'third_party_claims';
  else if (/\bindemnif/i.test(text)) indemnity_scope_code = 'general';

  const surv = text.match(
    /\bsurviv(?:e|al)\s+(?:for|until)(?:\s+a\s+period\s+of)?\s+(\d+)\s*(year|month)s?\b/i,
  );
  let survival_months: number | null = null;
  let survival_years: number | null = null;
  if (surv?.[2]) {
    const n = Number.parseInt(surv[1]!, 10);
    if (surv[2].toLowerCase().startsWith('year')) survival_years = n;
    else survival_months = n;
  }

  const indemnitor_role_codes: ('company' | 'seller' | 'parent')[] = [];
  if (/\bCompany\b/.test(text)) indemnitor_role_codes.push('company');
  if (/\bSeller\b/.test(text)) indemnitor_role_codes.push('seller');
  if (/\bParent\b/.test(text)) indemnitor_role_codes.push('parent');

  let basket_threshold_usd: number | null = null;
  const basketM = text.match(
    /\bbasket\b[^.$]{0,120}?\$\s*([\d,.]+)/i,
  );
  if (basketM) basket_threshold_usd = parseUsdScalar(basketM[1]!);
  else {
    const nearBasket = /\bbasket\b/i.test(text);
    if (nearBasket) {
      const first = extractUsdAmounts(text);
      if (first.length > 0) basket_threshold_usd = first[0]!;
    }
  }

  return {
    indemnity_scope_code,
    survival_months,
    survival_years,
    basket_threshold_usd,
    indemnitor_role_codes:
      indemnitor_role_codes.length > 0 ? indemnitor_role_codes : null,
  };
}

function extractObligations(text: string): Record<string, unknown> {
  const shall_count = [...text.matchAll(/\bshall\b/gi)].length;
  const must_count = [...text.matchAll(/\bmust\b/gi)].length;
  const deadlines: number[] = [];
  for (const m of text.matchAll(/\bwithin\s+(\d{1,3})\s+days?\b/gi)) {
    deadlines.push(Number.parseInt(m[1]!, 10));
  }

  const dates = extractIsoDates(text);
  const performance_due_iso =
    dates.length === 1 ? dates[0]! : dates.length > 1 ? dates[0]! : null;

  return {
    shall_count: shall_count > 0 ? shall_count : null,
    must_count: must_count > 0 ? must_count : null,
    within_days_deadlines:
      deadlines.length > 0 ? [...new Set(deadlines)] : null,
    performance_due_iso,
    board_vote_referenced: /\bboard of directors\b/i.test(text) ? true : null,
    shareholder_approval_referenced: /\bshareholder\s+approval\b/i.test(text)
      ? true
      : null,
    governing_law_code: /\bDelaware\b/i.test(text)
      ? 'delaware'
      : /\bNew York\b/i.test(text)
        ? 'new_york'
        : null,
  };
}

export function extractFieldsForSubstantiveType(
  t: SubstantiveClauseType,
  text: string,
): Record<string, unknown> {
  switch (t) {
    case 'termination':
      return extractTermination(text);
    case 'pricing_terms':
      return extractPricingTerms(text);
    case 'constraints':
      return extractConstraints(text);
    case 'payment':
      return extractPayment(text);
    case 'confidentiality':
      return extractConfidentiality(text);
    case 'indemnity':
      return extractIndemnity(text);
    case 'obligations':
      return extractObligations(text);
    default:
      return {};
  }
}
