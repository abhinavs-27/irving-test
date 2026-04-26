/**
 * Match gold issues to predicted issues using token Jaccard similarity,
 * boosted when clause_id also matches.
 *
 * Matching is greedy (best-score-first) so each predicted issue is used at most once.
 */
import type { ClauseIssue } from '../layer4/types.js';
import type { GoldDataset, GoldIssue, MatchResult, EvalResult } from './types.js';

// Stop-words that don't carry signal for matching
const STOP = new Set(['a', 'an', 'the', 'is', 'are', 'no', 'not', 'of', 'in', 'for', 'to', 'or']);

function tokenize(s: string): Set<string> {
  return new Set(
    s.toLowerCase()
      .split(/\W+/)
      .filter((t) => t.length > 1 && !STOP.has(t)),
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let intersection = 0;
  for (const t of a) if (b.has(t)) intersection++;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export function pairScore(gold: GoldIssue, predicted: ClauseIssue): number {
  const text = jaccard(tokenize(gold.issue), tokenize(predicted.issue));
  // Boost when both sides agree on the clause responsible
  const clauseBoost =
    gold.clause_id && gold.clause_id === predicted.clause_id ? 0.2 : 0;
  return Math.min(1.0, text + clauseBoost);
}

export function evaluate(
  dataset: GoldDataset,
  predicted: ClauseIssue[],
  threshold = 0.2,
): EvalResult {
  const gold = dataset.issues;
  const usedIdx = new Set<number>();

  const matches: MatchResult[] = gold.map((g) => {
    let bestIdx = -1;
    let bestScore = 0;

    for (let i = 0; i < predicted.length; i++) {
      if (usedIdx.has(i)) continue;
      const s = pairScore(g, predicted[i]!);
      if (s > bestScore) {
        bestScore = s;
        bestIdx = i;
      }
    }

    if (bestScore >= threshold && bestIdx >= 0) {
      usedIdx.add(bestIdx);
      const p = predicted[bestIdx]!;
      return {
        gold: g,
        predicted: p,
        score: bestScore,
        severity_match: g.severity != null ? g.severity === p.severity : null,
      };
    }

    return { gold: g, predicted: null, score: 0, severity_match: null };
  });

  const false_positives = predicted.filter((_, i) => !usedIdx.has(i));

  return { gold_dataset: dataset, matches, false_positives, threshold };
}
