import type { ClauseBlock } from '../understanding/normalized-clause.js';

/** Dense plain-text representation of a ClauseBlock used for embedding. */
export function summarizeClause(c: ClauseBlock): string {
  const lines: string[] = [
    `Clause ${c.clause_id} [type: ${c.clause_type}, priority: ${c.priority}, confidence: ${c.confidence}]`,
    `Parties: ${c.primary_entity_id} ↔ ${c.counterparty_entity_ids.join(', ') || '(none)'}`,
  ];

  const f = c.extracted_fields;

  if (f.structural) {
    const s = f.structural;
    if (s.agreement_reference_date_iso) lines.push(`Agreement date: ${s.agreement_reference_date_iso}`);
    if (s.execution_date_iso) lines.push(`Execution date: ${s.execution_date_iso}`);
  }

  if (f.pricing) {
    const p = f.pricing;
    lines.push(`Pricing mechanism: ${p.mechanism}, settlement: ${p.settlement_method}`);
    if (p.discount_rate != null) {
      lines.push(`Discount rate: ${(p.discount_rate * 100).toFixed(2)}%`);
    }
    for (const m of p.modes ?? []) {
      const dr = m.discount_rate != null ? `${(m.discount_rate * 100).toFixed(2)}%` : 'n/a';
      lines.push(`  Purchase mode: ${m.purchase_mode}, VWAP session: ${m.vwap_session}, discount: ${dr}`);
    }
  }

  if (f.constraints) {
    for (const r of f.constraints.exchange_issuance ?? []) {
      const rate = r.issuance_cap_rate != null ? `${(r.issuance_cap_rate * 100).toFixed(2)}%` : 'n/a';
      const shares = r.share_cap != null ? `, share cap: ${r.share_cap}` : '';
      lines.push(`Exchange issuance cap: ${rate}${shares}`);
    }
    for (const r of f.constraints.beneficial_ownership ?? []) {
      const rate = r.cap_rate != null ? `${(r.cap_rate * 100).toFixed(2)}%` : 'n/a';
      lines.push(`Beneficial ownership cap: ${rate}`);
    }
    for (const r of f.constraints.other_constraints ?? []) {
      lines.push(`Other constraint: ${r.kind}${r.numeric_value != null ? ` = ${r.numeric_value}` : ''}${r.rate != null ? ` (rate ${r.rate})` : ''}`);
    }
  }

  if (f.termination) {
    const t = f.termination;
    if (t.stated_term_months != null) lines.push(`Term: ${t.stated_term_months} months`);
    if (t.stated_term_days != null) lines.push(`Term: ${t.stated_term_days} days`);
    if (t.termination_notice_days != null) lines.push(`Termination notice: ${t.termination_notice_days} days`);
    if (t.aggregate_purchase_ceiling_usd != null) {
      lines.push(`Aggregate purchase ceiling: $${t.aggregate_purchase_ceiling_usd.toLocaleString()}`);
    }
  }

  if (f.disclosure) {
    if (f.disclosure.financial?.largest_amount_usd != null) {
      lines.push(`Largest disclosed amount: $${f.disclosure.financial.largest_amount_usd.toLocaleString()}`);
    }
    if (f.disclosure.issuance?.largest_share_count != null) {
      lines.push(`Largest share count: ${f.disclosure.issuance.largest_share_count.toLocaleString()}`);
    }
  }

  const refs = [
    ...c.relationships.references,
    ...c.relationships.governs,
    ...c.relationships.constrains,
  ].filter(Boolean);
  if (refs.length > 0) {
    lines.push(`Cross-references: ${refs.join(', ')}`);
  }

  return lines.join('\n');
}

/** Count unique cross-references (governs + constrains + references). */
export function crossReferenceCount(c: ClauseBlock): number {
  const s = new Set([
    ...c.relationships.references,
    ...c.relationships.governs,
    ...c.relationships.constrains,
  ]);
  return s.size;
}
