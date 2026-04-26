/**
 * Layer 4 pipeline — runs four steps in sequence per clause, then aggregates and ranks.
 *
 *   for each clause:
 *     1. classify  — what risks to look for; should we skip?
 *     2. check     — find specific issues
 *   3. aggregate  — dedup + find agreement-level gaps
 *   4. rank       — deterministic sort by severity + category
 *
 * Everything is logged with timing so the run is fully observable.
 */
import type { ClauseBlock } from '../understanding/normalized-clause.js';
import type { Agreement } from '../understanding/layer3-agreement.js';
import type { ClauseIssue, IssueReport, PipelineLogEntry } from './types.js';
import { summarizeClause } from '../rag/summarize-clause.js';
import { classifyClause } from './classify.js';
import { checkClause } from './check.js';
import { aggregateIssues } from './aggregate.js';
import { rankIssues } from './rank.js';
import { logStep } from './log.js';

export async function runPipeline(
  clauses: ClauseBlock[],
  agreement: Agreement,
): Promise<IssueReport> {
  const log: PipelineLogEntry[] = [];
  const allIssues: ClauseIssue[] = [];

  for (const clause of clauses) {
    const summary = summarizeClause(clause);

    // Step 1: classify
    let t = Date.now();
    let classification;
    try {
      classification = await classifyClause(clause, summary);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log.push(logStep('classify', clause.clause_id, t, `ERROR: ${msg}`));
      continue;
    }
    log.push(
      logStep(
        'classify',
        clause.clause_id,
        t,
        classification.skip
          ? 'skip'
          : `focus: ${classification.risk_focus.slice(0, 2).join(', ') || '(general)'}`,
      ),
    );

    if (classification.skip) continue;

    // Step 2: check
    t = Date.now();
    let issues: ClauseIssue[] = [];
    try {
      issues = await checkClause(clause, summary, classification);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log.push(logStep('check', clause.clause_id, t, `ERROR: ${msg}`));
      continue;
    }
    log.push(logStep('check', clause.clause_id, t, `${issues.length} issue(s)`));

    allIssues.push(...issues);
  }

  // Step 3: aggregate
  let t = Date.now();
  let aggregated: ClauseIssue[] = allIssues;
  try {
    aggregated = await aggregateIssues(allIssues, clauses, agreement);
    log.push(
      logStep('aggregate', undefined, t, `${aggregated.length} after dedup + agreement gaps`),
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.push(logStep('aggregate', undefined, t, `ERROR: ${msg} — using clause-level issues only`));
  }

  // Step 4: rank
  t = Date.now();
  const ranked = rankIssues(aggregated);
  log.push(logStep('rank', undefined, t, `${ranked.length} issues ranked`));

  const counts = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const issue of ranked) {
    const s = issue.severity as keyof typeof counts;
    if (s in counts) counts[s]++;
  }

  return {
    agreement_id: agreement.agreement_id,
    clause_count: clauses.length,
    total_issues: ranked.length,
    ...counts,
    issues: ranked,
    log,
  };
}
