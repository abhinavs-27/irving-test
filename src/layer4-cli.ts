/**
 * Layer 4: analyze a Layer 2 understanding file and write a structured issues report.
 *
 *   npm run layer4 -- --clauses=./out/understanding.json --out=./out/issues.json
 *   npm run layer4 -- --clauses=./out/understanding.json --out=./out/issues.json --agreement=1
 */
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

import type { ClauseBlock } from './understanding/normalized-clause.js';
import { buildAgreements } from './understanding/layer3-agreement.js';
import { runPipeline } from './layer4/pipeline.js';
import { model } from './layer4/llm.js';

function parseArgs(argv: string[]): {
  clausesPath: string;
  outPath: string;
  agreementIdx: number;
} {
  let clausesPath: string | undefined;
  let outPath: string | undefined;
  let agreementIdx = 0;
  for (const a of argv) {
    if (a.startsWith('--clauses=')) clausesPath = a.slice('--clauses='.length);
    else if (a.startsWith('--out=')) outPath = a.slice('--out='.length);
    else if (a.startsWith('--agreement='))
      agreementIdx = parseInt(a.slice('--agreement='.length), 10) || 0;
  }
  if (!clausesPath || !outPath) {
    console.error(`
Usage:
  npm run layer4 -- --clauses=<path> --out=<path> [--agreement=<index>]

  --clauses     Path to Layer 2 understanding.json (ClauseBlock[])
  --out         Where to write the issues report JSON
  --agreement   Index of agreement to analyze (default: 0)
`);
    process.exit(1);
  }
  return { clausesPath, outPath, agreementIdx };
}

const { clausesPath, outPath, agreementIdx } = parseArgs(process.argv.slice(2));

// Load clauses
let clauses: ClauseBlock[];
try {
  const raw = readFileSync(resolve(clausesPath), 'utf8');
  clauses = JSON.parse(raw) as ClauseBlock[];
  if (!Array.isArray(clauses)) throw new Error('not an array');
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`layer4: cannot load clauses: ${msg}`);
  process.exit(1);
}

// Build agreements and pick target
const agreements = buildAgreements(clauses);
if (agreements.length === 0) {
  console.error('layer4: no agreements found');
  process.exit(1);
}
const agreement = agreements[agreementIdx];
if (!agreement) {
  console.error(
    `layer4: no agreement at index ${agreementIdx} (found ${agreements.length}: ${agreements.map((a) => a.agreement_id).join(', ')})`,
  );
  process.exit(1);
}

// Filter to clauses belonging to this agreement
const agreementClauses = clauses.filter((c) => agreement.clause_ids.includes(c.clause_id));

process.stderr.write(
  `\n[layer4] model: ${model()}\n` +
  `[layer4] agreement: ${agreement.agreement_id}\n` +
  `[layer4] clauses: ${agreementClauses.length}\n` +
  `[layer4] existing risk flags: ${agreement.risk_flags.map((f) => f.code).join(', ')}\n\n`,
);

// Run pipeline
const report = await runPipeline(agreementClauses, agreement);

// Write output
const d = dirname(resolve(outPath));
if (d && d !== '.') mkdirSync(d, { recursive: true });
try {
  writeFileSync(resolve(outPath), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`layer4: failed to write output: ${msg}`);
  process.exit(1);
}

// Print summary to stderr
const lines: string[] = [
  `\n[layer4] done — ${report.total_issues} issue(s) → ${resolve(outPath)}`,
  `  critical: ${report.critical}  high: ${report.high}  medium: ${report.medium}  low: ${report.low}`,
];
if (report.issues.length > 0) {
  lines.push('\nTop issues:');
  for (const issue of report.issues.slice(0, 5)) {
    lines.push(`  [${issue.severity.toUpperCase()}] ${issue.issue} (${issue.clause_id})`);
  }
}
process.stderr.write(lines.join('\n') + '\n');
