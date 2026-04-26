import type { EvalResult } from './types.js';
import type { Metrics } from './metrics.js';

const SEV: Record<string, string> = {
  critical: 'CRIT',
  high:     'HIGH',
  medium:   'MED ',
  low:      'LOW ',
};

function pct(n: number): string {
  return `${(n * 100).toFixed(0)}%`;
}

function bar(n: number, width = 20): string {
  const filled = Math.round(n * width);
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}

export function printReport(result: EvalResult, metrics: Metrics): void {
  const { matches, false_positives, gold_dataset, threshold } = result;

  console.log('\n' + '═'.repeat(60));
  console.log('  LAYER 5 EVAL REPORT');
  console.log('═'.repeat(60));
  console.log(`  Dataset : ${gold_dataset.description}`);
  console.log(`  Threshold: ${threshold} (token Jaccard + clause_id boost)`);
  console.log('─'.repeat(60));

  console.log(`\n  Gold issues    : ${gold_dataset.issues.length}`);
  console.log(`  Predicted      : ${matches.filter(m => m.predicted).length + false_positives.length}`);
  console.log(`\n  True positives : ${metrics.tp}  (found)`);
  console.log(`  False negatives: ${metrics.fn}  (missed)`);
  console.log(`  False positives: ${metrics.fp}  (hallucinated)`);

  console.log('\n' + '─'.repeat(60));
  console.log('  SCORES');
  console.log('─'.repeat(60));
  console.log(`  Precision  ${bar(metrics.precision)} ${pct(metrics.precision)}`);
  console.log(`  Recall     ${bar(metrics.recall)}    ${pct(metrics.recall)}`);
  console.log(`  F1         ${bar(metrics.f1)}    ${pct(metrics.f1)}`);
  if (metrics.severity_accuracy !== null) {
    console.log(`  Sev. acc.  ${bar(metrics.severity_accuracy)} ${pct(metrics.severity_accuracy)}`);
  }

  // --- Matched / missed ---
  console.log('\n' + '─'.repeat(60));
  console.log('  GOLD ISSUES');
  console.log('─'.repeat(60));
  for (const m of matches) {
    const g = m.gold;
    const sev = g.severity ? `[${SEV[g.severity] ?? g.severity}]` : '      ';
    if (m.predicted) {
      const sevOk = m.severity_match === null ? '' : m.severity_match ? ' ✓ sev' : ` ✗ sev(got ${m.predicted.severity})`;
      const scoreStr = `(sim ${m.score.toFixed(2)})`;
      console.log(`  ✓ ${sev} ${g.issue}`);
      console.log(`       → ${m.predicted.issue} ${scoreStr}${sevOk}`);
    } else {
      console.log(`  ✗ ${sev} ${g.issue}  ← MISSED`);
      if (g.notes) console.log(`       note: ${g.notes}`);
    }
  }

  // --- False positives ---
  if (false_positives.length > 0) {
    console.log('\n' + '─'.repeat(60));
    console.log('  HALLUCINATIONS (predicted but not in gold)');
    console.log('─'.repeat(60));
    for (const p of false_positives) {
      const sev = `[${SEV[p.severity] ?? p.severity}]`;
      console.log(`  ! ${sev} ${p.issue}  (${p.clause_id})`);
      console.log(`       ${p.reason}`);
    }
  }

  console.log('\n' + '═'.repeat(60) + '\n');
}
