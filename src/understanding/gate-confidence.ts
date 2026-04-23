import type { SubstantiveClauseType } from './types.js';
import type { SignalCode } from './noise-detection.js';

/**
 * Low band: only signal_codes in extracted_fields (or empty object).
 */
export function buildLowBandFields(
  signalCodes: SignalCode[],
): Record<string, unknown> {
  if (signalCodes.length === 0) return {};
  return { signal_codes: signalCodes };
}

/**
 * Mid band: drop nested / derived / optional fields per type.
 */
export function reduceFieldsForMediumConfidence(
  clauseType: SubstantiveClauseType,
  fields: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  switch (clauseType) {
    case 'pricing_terms': {
      if (fields.pricing_model != null)
        out.pricing_model = fields.pricing_model;
      if (Array.isArray(fields.discount_terms)) {
        out.discount_terms = (fields.discount_terms as Record<string, unknown>[]).map(
          (d) => {
            const o: Record<string, unknown> = {};
            if (d.mechanism != null) o.mechanism = d.mechanism;
            if (d.value_percent != null) o.value_percent = d.value_percent;
            if (d.applies_to != null) o.applies_to = d.applies_to;
            return o;
          },
        );
      }
      break;
    }
    case 'payment':
      if (fields.amounts_usd != null) out.amounts_usd = fields.amounts_usd;
      if (fields.timing_code != null) out.timing_code = fields.timing_code;
      if (fields.wire_instructions !== undefined)
        out.wire_instructions = fields.wire_instructions;
      break;
    case 'obligations':
      if (fields.within_days_deadlines != null)
        out.within_days_deadlines = fields.within_days_deadlines;
      else if (fields.performance_due_iso != null)
        out.performance_due_iso = fields.performance_due_iso;
      break;
    case 'termination':
      if (fields.notice_period_days != null)
        out.notice_period_days = fields.notice_period_days;
      if (fields.termination_trigger_codes != null)
        out.termination_trigger_codes = fields.termination_trigger_codes;
      break;
    case 'indemnity':
      if (fields.basket_threshold_usd != null)
        out.basket_threshold_usd = fields.basket_threshold_usd;
      else if (fields.indemnity_scope_code != null)
        out.indemnity_scope_code = fields.indemnity_scope_code;
      break;
    case 'constraints':
      if (fields.ownership_cap_percent != null)
        out.ownership_cap_percent = fields.ownership_cap_percent;
      break;
    case 'confidentiality':
      if (fields.scope_codes != null) out.scope_codes = fields.scope_codes;
      break;
    default:
      break;
  }
  return out;
}
