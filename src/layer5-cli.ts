/**
 * Layer 5 — eval: compare a Layer 4 issues report against a gold dataset.
 *
 *   npm run eval -- --gold=./evals/gold/gelesis-brpc.json --predicted=./out/issues.json
 *   npm run eval -- --gold=./evals/gold/gelesis-brpc.json --predicted=./out/issues.json --threshold=0.25
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { IssueReport } from './layer4/types.js';
import type { GoldDataset } from './layer5/types.js';
import { evaluate } from './layer5/match.js';
import { computeMetrics } from './layer5/metrics.js';
import { printReport } from './layer5/report.js';

function parseArgs(argv: string[]): {
  goldPath: string;
  predictedPath: string;
  threshold: number;
  outPath?: string;
} {
  let goldPath: string | undefined;
  let predictedPath: string | undefined;
  let threshold = 0.2;
  let outPath: string | undefined;

  for (const a of argv) {
    if (a.startsWith('--gold=')) goldPath = a.slice('--gold='.length);
    else if (a.startsWith('--predicted=')) predictedPath = a.slice('--predicted='.length);
    else if (a.startsWith('--threshold=')) threshold = parseFloat(a.slice('--threshold='.length)) || 0.2;
    else if (a.startsWith('--out=')) outPath = a.slice('--out='.length);
  }

  if (!goldPath || !predictedPath) {
    console.error(`
Usage:
  npm run eval -- --gold=<path> --predicted=<path> [--threshold=0.2] [--out=<path>]

  --gold        Gold dataset JSON (evals/gold/*.json)
  --predicted   Layer 4 issues.json output
  --threshold   Match similarity threshold, 0–1 (default: 0.2)
  --out         Optional: write eval result JSON to this path
`);
    process.exit(1);
  }

  return { goldPath, predictedPath, threshold, outPath };
}

const { goldPath, predictedPath, threshold, outPath } = parseArgs(process.argv.slice(2));

// Load gold dataset
let gold: GoldDataset;
try {
  gold = JSON.parse(readFileSync(resolve(goldPath), 'utf8')) as GoldDataset;
  if (!Array.isArray(gold.issues)) throw new Error('missing issues array');
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`eval: cannot load gold dataset: ${msg}`);
  process.exit(1);
}

// Load predicted issues
let report: IssueReport;
try {
  report = JSON.parse(readFileSync(resolve(predictedPath), 'utf8')) as IssueReport;
  if (!Array.isArray(report.issues)) throw new Error('missing issues array');
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`eval: cannot load predicted issues: ${msg}`);
  process.exit(1);
}

// Run eval
const result = evaluate(gold, report.issues, threshold);
const metrics = computeMetrics(result);

// Print report to stdout
printReport(result, metrics);

// Optionally write JSON result
if (outPath) {
  const json = {
    gold_description: gold.description,
    agreement_id: gold.agreement_id,
    threshold,
    metrics,
    matches: result.matches.map((m) => ({
      gold_issue: m.gold.issue,
      predicted_issue: m.predicted?.issue ?? null,
      score: m.score,
      severity_match: m.severity_match,
      status: m.predicted ? 'found' : 'missed',
    })),
    false_positives: result.false_positives.map((p) => ({
      issue: p.issue,
      clause_id: p.clause_id,
      severity: p.severity,
      reason: p.reason,
    })),
  };
  writeFileSync(resolve(outPath), `${JSON.stringify(json, null, 2)}\n`, 'utf8');
  process.stderr.write(`eval: results written to ${resolve(outPath)}\n`);
}
