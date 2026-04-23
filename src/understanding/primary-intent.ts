import type {
  ConfidenceTier,
  LegalClauseType,
  SubstantiveClauseType,
} from './types.js';

function tierAllowsSubtype(tier: ConfidenceTier): boolean {
  return tier === 'high';
}

export function derivePrimaryIntent(
  clauseType: LegalClauseType,
  text: string,
  tier: ConfidenceTier,
): string {
  const t = text.replace(/\s+/g, ' ');
  const allowSubtype = tierAllowsSubtype(tier);

  if (clauseType === 'misc.noise') return 'unclassified';

  const base = clauseType as SubstantiveClauseType;

  switch (base) {
    case 'pricing_terms': {
      if (!allowSubtype) return 'pricing_terms.general';
      const hasVwap = /\bVWAP\b/i.test(t);
      const hasDiscount =
        /\bdiscount\b/i.test(t) ||
        /\b\d+(?:\.\d+)?\s*%\s*(?:discount|below)/i.test(t);
      const hasFixedCap = /\bcap\b/i.test(t) && /\$\d/.test(t);
      if (hasVwap && hasDiscount) return 'pricing_terms.vwap_discount';
      if (hasVwap) return 'pricing_terms.vwap';
      if (hasDiscount && !hasVwap) return 'pricing_terms.fixed_discount';
      if (hasFixedCap) return 'pricing_terms.price_cap';
      return 'pricing_terms.general';
    }
    case 'payment':
      return allowSubtype && /\bwire\b/i.test(t)
        ? 'payment.wire_transfer'
        : 'payment.general';
    case 'obligations':
      if (!allowSubtype) return 'obligations.general';
      if (/\bfile\b/i.test(t) && /\bForm\s+8[- ]K\b/i.test(t))
        return 'obligations.sec_filing';
      if (/\bdeliver(?:y|ies)?\b/i.test(t)) return 'obligations.delivery';
      if (/\bcommercially reasonable efforts\b/i.test(t))
        return 'obligations.performance';
      return 'obligations.general';
    case 'termination':
      if (!allowSubtype) return 'termination.general';
      if (/\bbankruptcy\b/i.test(t)) return 'termination.bankruptcy';
      if (/\bEvent of Default\b/i.test(t)) return 'termination.default';
      if (/\bMAE\b|material adverse effect/i.test(t))
        return 'termination.material_adverse_effect';
      return 'termination.general';
    case 'indemnity':
      return allowSubtype && /\bbasket\b/i.test(t)
        ? 'indemnity.basket'
        : 'indemnity.general';
    case 'constraints':
      return allowSubtype && /\bstandstill\b/i.test(t)
        ? 'constraints.standstill'
        : 'constraints.general';
    case 'confidentiality':
      return 'confidentiality.general';
    default:
      return 'unclassified';
  }
}
