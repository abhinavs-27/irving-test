import type { LegalClauseType, SubstantiveClauseType } from './types.js';
import {
  isMaterialDefinitiveItemSection,
  isStructuredItemSection,
  parseSectionIdFromClauseId,
  sectionSuggestsClauseTypes,
} from './section-context.js';

/**
 * Field-fill ratio: non-null meaningful values / total keys.
 */
export function computeFieldFillRatio(fields: Record<string, unknown>): number {
  const keys = Object.keys(fields);
  if (keys.length === 0) return 0;

  let filled = 0;
  for (const k of keys) {
    const v = fields[k];
    if (v === null || v === undefined) continue;
    if (Array.isArray(v) && v.length === 0) continue;
    if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
      if (Object.keys(v as object).length === 0) continue;
    }
    if (typeof v === 'boolean' && v === false) continue;
    filled += 1;
  }

  return filled / keys.length;
}

export function blendConfidence(
  fieldRatio: number,
  separationStrength: number,
): number {
  const v = fieldRatio * 0.55 + separationStrength * 0.45;
  return Math.round(Math.min(1, Math.max(0, v)) * 100) / 100;
}

/** Short paragraphs are inherently lower confidence for semantic typing. */
export function lengthPrior(text: string): number {
  const n = text.replace(/\s+/g, ' ').trim().length;
  if (n >= 400) return 1;
  if (n >= 200) return 0.85;
  if (n >= 80) return 0.65;
  return 0.35;
}

export function computeUnderstandingConfidence(
  substantiveType: SubstantiveClauseType | null,
  fullFields: Record<string, unknown>,
  separationStrength: number,
  text: string,
): number {
  const fill = computeFieldFillRatio(fullFields);
  const blended = blendConfidence(fill, separationStrength);
  const len = lengthPrior(text);
  let score = blended * 0.72 + len * 0.28;
  if (substantiveType === null) score *= 0.52;
  return Math.round(Math.min(1, Math.max(0, score)) * 100) / 100;
}

export function confidenceTier(conf: number): 'low' | 'medium' | 'high' {
  if (conf < 0.3) return 'low';
  if (conf < 0.6) return 'medium';
  return 'high';
}

export type CalibrationInput = {
  clauseId: string;
  clauseType: LegalClauseType;
  entitiesResolved: boolean;
  /** Short paragraph split artifact / duplicate fragment heuristic. */
  fragmentedClause: boolean;
  /** misc.noise inside Item 1.01 body despite semantic cues — penalize certainty. */
  noiseLikelyMisclassified: boolean;
  /** §1.01-style Items where parties matter for pricing / termination. */
  missingEntitiesForSignificantClause: boolean;
};

/** Context-aware calibration after base classifier scoring. */
export function calibrateConfidence(
  base: number,
  opts: CalibrationInput,
): number {
  let s = base;
  const sectionId = parseSectionIdFromClauseId(opts.clauseId);
  const hints = sectionSuggestsClauseTypes(sectionId);

  if (
    opts.clauseType !== 'misc.noise' &&
    hints.some((h) => h === opts.clauseType)
  ) {
    s += 0.06;
  }

  if (opts.entitiesResolved) s += 0.05;

  if (opts.fragmentedClause) s -= 0.06;

  if (opts.noiseLikelyMisclassified) s -= 0.12;

  if (opts.missingEntitiesForSignificantClause) s -= 0.07;

  return Math.round(Math.min(1, Math.max(0, s)) * 100) / 100;
}

export function inferFragmentation(text: string): boolean {
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length > 0 && t.length < 35 && !/\.$/.test(t);
}

export function entitiesAreResolved(parties: {
  company: string | null;
  counterparty: string | null;
}, instruments: string[] | null): boolean {
  const p = Boolean(parties.company || parties.counterparty);
  const i = Boolean(instruments && instruments.length > 0);
  return p || i;
}

export function shouldFlagMissingEntitiesForSection(
  clauseType: LegalClauseType,
  clauseId: string,
  entitiesResolved: boolean,
): boolean {
  if (entitiesResolved) return false;
  const sid = parseSectionIdFromClauseId(clauseId);
  if (!isMaterialDefinitiveItemSection(sid)) return false;
  return (
    clauseType === 'pricing_terms' ||
    clauseType === 'termination' ||
    clauseType === 'payment'
  );
}

export function noiseMisclassifiedSuspicion(
  clauseType: LegalClauseType,
  clauseId: string,
  hadSemanticSignals: boolean,
): boolean {
  return (
    clauseType === 'misc.noise' &&
    isStructuredItemSection(parseSectionIdFromClauseId(clauseId)) &&
    hadSemanticSignals
  );
}
