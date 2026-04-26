/**
 * Step 4 — Rank issues deterministically.
 * Order: severity (critical → high → medium → low), then category, then clause_id.
 * No LLM call — ranking is a pure sort.
 */
import type { ClauseIssue } from './types.js';

const SEVERITY_RANK: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const CATEGORY_RANK: Record<string, number> = {
  missing_protection: 0,
  asymmetric_obligation: 1,
  risky_term: 2,
  inconsistency: 3,
  vague_language: 4,
  other: 5,
};

export function rankIssues(issues: ClauseIssue[]): ClauseIssue[] {
  return [...issues].sort((a, b) => {
    const s = (SEVERITY_RANK[a.severity] ?? 9) - (SEVERITY_RANK[b.severity] ?? 9);
    if (s !== 0) return s;
    const c = (CATEGORY_RANK[a.category] ?? 9) - (CATEGORY_RANK[b.category] ?? 9);
    if (c !== 0) return c;
    return a.clause_id.localeCompare(b.clause_id);
  });
}
