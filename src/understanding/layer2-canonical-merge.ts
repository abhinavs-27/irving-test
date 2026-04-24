import type { ClauseBlock, TerminationSchema } from './normalized-clause.js';

function cloneBlock(c: ClauseBlock): ClauseBlock {
  return {
    ...c,
    extracted_fields: { ...c.extracted_fields },
    relationships: { ...c.relationships },
  };
}

/** Merge numeric termination fields from all termination clauses (deterministic rules). */
function mergeTerminationUnion(blocks: readonly ClauseBlock[]): TerminationSchema {
  const m: TerminationSchema = {};
  let agg: number | undefined;
  let months: number | undefined;
  let days: number | undefined;
  let notice: number | undefined;

  for (const c of blocks) {
    if (c.clause_type !== 'termination') continue;
    const t = c.extracted_fields.termination;
    if (!t) continue;
    if (t.aggregate_purchase_ceiling_usd !== undefined) {
      agg = Math.max(agg ?? t.aggregate_purchase_ceiling_usd, t.aggregate_purchase_ceiling_usd);
    }
    if (t.stated_term_months !== undefined) {
      months = Math.max(months ?? t.stated_term_months, t.stated_term_months);
    }
    if (t.stated_term_days !== undefined) {
      days = Math.max(days ?? t.stated_term_days, t.stated_term_days);
    }
    if (t.termination_notice_days !== undefined) {
      notice =
        notice === undefined
          ? t.termination_notice_days
          : Math.min(notice, t.termination_notice_days);
    }
  }

  if (agg !== undefined) m.aggregate_purchase_ceiling_usd = agg;
  if (months !== undefined) m.stated_term_months = months;
  if (days !== undefined) m.stated_term_days = days;
  if (notice !== undefined) m.termination_notice_days = notice;
  return m;
}

/**
 * Collapse termination economics to a single canonical `clause_type === 'termination'` row
 * (first by `clause_id`) so overlapping facts are not duplicated across ClauseBlocks.
 */
function terminationPayloadNonEmpty(c: ClauseBlock): boolean {
  const t = c.extracted_fields.termination;
  return !!t && Object.keys(t).length > 0;
}

export function mergeTerminationDomainIntoCanonical(clauses: readonly ClauseBlock[]): ClauseBlock[] {
  const terminationRows = clauses.filter(
    (c) => c.clause_type === 'termination' && terminationPayloadNonEmpty(c),
  );
  if (terminationRows.length <= 1) return clauses.map(cloneBlock);

  const merged = mergeTerminationUnion(clauses);
  if (Object.keys(merged).length === 0) return clauses.map(cloneBlock);

  const canonicalId = [...terminationRows]
    .map((c) => c.clause_id)
    .sort((a, b) => a.localeCompare(b))[0]!;

  return clauses.map((c) => {
    const next = cloneBlock(c);
    if (c.clause_type !== 'termination') return next;
    if (c.clause_id === canonicalId) {
      next.extracted_fields = {
        ...next.extracted_fields,
        termination: merged,
      };
      return next;
    }
    const { termination: _t, ...rest } = next.extracted_fields;
    next.extracted_fields = { ...rest };
    return next;
  });
}
