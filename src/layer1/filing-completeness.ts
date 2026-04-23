import type { Layer1Filing, FilingSectionNode } from './filing-types.js';

export type CompletenessSeverity = 'info' | 'warn' | 'missing';

export type CompletenessFinding = {
  code: string;
  severity: CompletenessSeverity;
  message: string;
};

export type CompletenessReport = {
  ok: boolean;
  findings: CompletenessFinding[];
};

function flattenParagraphText(nodes: FilingSectionNode[] | undefined): string {
  if (!nodes?.length) return '';
  const parts: string[] = [];
  const walk = (n: FilingSectionNode): void => {
    if (n.type === 'paragraph' && n.text) parts.push(n.text);
    for (const c of n.children ?? []) walk(c);
  };
  for (const n of nodes) walk(n);
  return parts.join('\n');
}

export function checkCompleteness(filing: Layer1Filing): CompletenessReport {
  const findings: CompletenessFinding[] = [];
  const corpus = flattenParagraphText(filing.sections).toLowerCase();

  const enteredInto =
    /\bentered\s+into\b|\bentry\s+into\b|\bsigned\b.*\bagreement\b/i.test(corpus);
  const hasExec = filing.events.some((e) => e.kind === 'agreement_execution');

  const hasVwap =
    /\bvwap\b/i.test(corpus) ||
    /\bdiscount\b.*%|\d+\s*%\s*(discount|off)/i.test(corpus);
  const pricingBlocks = Object.entries(filing.block_registry).filter(
    ([, b]) => b.type === 'pricing_mechanism',
  );
  const pricingComplete = pricingBlocks.every(([, b]) => Boolean(b.pricing_model));

  const hasCaps =
    /\b19\.99\b|\b4\.99\b|beneficial\s+own|exchange\s+cap|aggregate.*ownership/i.test(
      corpus,
    );
  const constraintBlocks = Object.entries(filing.block_registry).filter(
    ([, b]) => b.type === 'constraint',
  );

  const hasTerminationLang =
    /\bterminat(?:e|ion|ed)\b|\bexpir(?:e|ation|es)\b/i.test(corpus);
  const terminationBlocks = Object.entries(filing.block_registry).filter(
    ([, b]) => b.type === 'termination',
  );
  const hasTermEvent = filing.events.some(
    (e) => e.kind === 'agreement_termination',
  );

  if (enteredInto && !hasExec) {
    findings.push({
      code: 'expected_agreement_execution',
      severity: 'missing',
      message:
        'Text suggests agreement execution ("entered into") but no agreement_execution event',
    });
  }

  if (hasVwap && pricingBlocks.length === 0) {
    findings.push({
      code: 'expected_pricing_block',
      severity: 'missing',
      message:
        'VWAP/discount language present but no pricing_mechanism block in block_registry',
    });
  }
  if (pricingBlocks.length > 0 && !pricingComplete) {
    findings.push({
      code: 'expected_pricing_model',
      severity: 'warn',
      message:
        'pricing_mechanism block present but pricing_model missing or incomplete',
    });
  }

  if (hasCaps && constraintBlocks.length === 0) {
    findings.push({
      code: 'expected_constraint_block',
      severity: 'missing',
      message:
        'Percentage cap / ownership language present but no constraint block',
    });
  }

  if (hasTerminationLang && terminationBlocks.length === 0) {
    findings.push({
      code: 'expected_termination_block',
      severity: 'missing',
      message: 'Termination / expiration language present but no termination block',
    });
  }
  if (terminationBlocks.length > 0 && !hasTermEvent) {
    findings.push({
      code: 'expected_termination_event',
      severity: 'warn',
      message: 'Termination block exists but no agreement_termination event',
    });
  }

  const blocking = findings.filter((f) => f.severity === 'missing');
  return {
    ok: blocking.length === 0,
    findings,
  };
}
