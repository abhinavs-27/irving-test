/**
 * Standalone Layer 3: read Layer 2 `understanding.json` → write agreements JSON.
 *
 *   npm run agreements -- --in=./out/understanding.json --out=./out/agreements.json
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import type { ClauseBlock } from './understanding/normalized-clause.js';
import { buildAgreements } from './understanding/layer3-agreement.js';

function parseArgs(argv: string[]): { inPath: string; outPath: string } {
  let inPath: string | undefined;
  let outPath: string | undefined;
  for (const a of argv) {
    if (a.startsWith('--in=')) inPath = a.slice('--in='.length);
    else if (a.startsWith('--out=')) outPath = a.slice('--out='.length);
  }
  if (!inPath?.trim() || !outPath?.trim()) {
    console.error(`
Usage:
  npm run agreements -- --in=<path/to/understanding.json> --out=<path/to/agreements.json>

Reads a Layer 2 JSON array (ClauseBlocks) and writes Layer 3 agreements JSON.
`);
    process.exit(1);
  }
  return { inPath: inPath.trim(), outPath: outPath.trim() };
}

const { inPath, outPath } = parseArgs(process.argv.slice(2));

let raw: string;
try {
  raw = readFileSync(resolve(inPath), 'utf8');
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`layer3-cli: cannot read input file: ${msg}`);
  process.exit(1);
}

let clauses: ClauseBlock[];
try {
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    console.error('layer3-cli: input must be a JSON array of ClauseBlocks');
    process.exit(1);
  }
  // Minimal shape check — catch obviously wrong input early
  for (let i = 0; i < parsed.length; i++) {
    const item = parsed[i] as Record<string, unknown>;
    if (typeof item?.clause_id !== 'string' || typeof item?.clause_type !== 'string') {
      console.error(
        `layer3-cli: item at index ${i} is missing required fields clause_id or clause_type`,
      );
      process.exit(1);
    }
  }
  clauses = parsed as ClauseBlock[];
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`layer3-cli: failed to parse input JSON: ${msg}`);
  process.exit(1);
}

const agreements = buildAgreements(clauses);
const d = dirname(resolve(outPath));
if (d && d !== '.') mkdirSync(d, { recursive: true });

try {
  writeFileSync(resolve(outPath), `${JSON.stringify(agreements, null, 2)}\n`, 'utf8');
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`layer3-cli: failed to write output: ${msg}`);
  process.exit(1);
}

console.error(
  `[agreements] wrote ${agreements.length} agreement(s) → ${resolve(outPath)}`,
);
