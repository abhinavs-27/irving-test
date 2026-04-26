import type { EvalResult } from './types.js';

export type Metrics = {
  tp: number;           // gold issues the system found
  fn: number;           // gold issues the system missed
  fp: number;           // predicted issues with no gold match (hallucinations)
  precision: number;    // tp / (tp + fp)  — how trustworthy are the predictions?
  recall: number;       // tp / (tp + fn)  — how much of the gold did we find?
  f1: number;
  severity_accuracy: number | null;  // among matched pairs with gold severity, % correct
};

export function computeMetrics(result: EvalResult): Metrics {
  const tp = result.matches.filter((m) => m.predicted !== null).length;
  const fn = result.matches.filter((m) => m.predicted === null).length;
  const fp = result.false_positives.length;

  const precision = tp + fp === 0 ? 0 : tp / (tp + fp);
  const recall    = tp + fn === 0 ? 0 : tp / (tp + fn);
  const f1        = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);

  const gradedPairs = result.matches.filter(
    (m) => m.predicted !== null && m.severity_match !== null,
  );
  const severity_accuracy =
    gradedPairs.length === 0
      ? null
      : gradedPairs.filter((m) => m.severity_match).length / gradedPairs.length;

  return { tp, fn, fp, precision, recall, f1, severity_accuracy };
}
