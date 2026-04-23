import type { Clause } from '../clause/clause.js';
import { classificationStrength, classifyDominant } from './classifier.js';
import {
  calibrateConfidence,
  computeUnderstandingConfidence,
  confidenceTier,
  entitiesAreResolved,
  inferFragmentation,
  noiseMisclassifiedSuspicion,
  shouldFlagMissingEntitiesForSection,
} from './confidence.js';
import type { ClauseWork } from './dedupe-merge.js';
import { dedupeUnderstandingRecords } from './dedupe-merge.js';
import { extractEntities } from './entities.js';
import {
  canonicalizeInstrumentsForDocument,
  resolvePartiesToRoles,
} from './entity-resolution.js';
import { extractFieldsForSubstantiveType } from './extract-fields.js';
import {
  buildLowBandFields,
  reduceFieldsForMediumConfidence,
} from './gate-confidence.js';
import {
  collectSignalCodes,
  hasStrongSemanticSignals,
  isLowInformationContent,
  isPureNavigationOrStructuralRepetition,
} from './noise-detection.js';
import { derivePrimaryIntent } from './primary-intent.js';
import { assignSemanticBlocks } from './semantic-block-assign.js';
import { isMaterialDefinitiveItemSection, parseSectionIdFromClauseId } from './section-context.js';
import { inferSubstantiveTypeFallback } from './type-inference.js';
import type {
  ClauseUnderstandingDebug,
  ClauseUnderstandingRecord,
  LegalClauseType,
} from './types.js';
import type { SubstantiveClauseType } from './types.js';

function emptyDebug(): ClauseUnderstandingDebug {
  return {
    why_classified_as_noise: null,
    merged_with: [],
    deduped_from: [],
    block_assignment_reason: null,
  };
}

function collectAllParagraphText(sections: Clause[]): string {
  const parts: string[] = [];
  const walk = (n: Clause): void => {
    if (n.type === 'paragraph') parts.push(n.text);
    for (const c of n.children) walk(c);
  };
  for (const s of sections) walk(s);
  return parts.join('\n');
}

function noiseRecord(
  clause_id: string,
  baseConfidence: number,
  signalCodes: ReturnType<typeof collectSignalCodes>,
  why: string,
  clauseIdForCalibration: string,
  hadSemanticSignals: boolean,
): ClauseUnderstandingRecord {
  const cal = calibrateConfidence(baseConfidence, {
    clauseId: clauseIdForCalibration,
    clauseType: 'misc.noise',
    entitiesResolved: false,
    fragmentedClause: false,
    noiseLikelyMisclassified: noiseMisclassifiedSuspicion(
      'misc.noise',
      clauseIdForCalibration,
      hadSemanticSignals,
    ),
    missingEntitiesForSignificantClause: false,
  });
  return {
    clause_id,
    clause_type: 'misc.noise',
    primary_intent: 'unclassified',
    extracted_fields: buildLowBandFields(signalCodes),
    entities: { parties: null, instruments: null },
    confidence: cal,
    semantic_block_id: `${parseSectionIdFromClauseId(clause_id)}.sb0`,
    debug: {
      ...emptyDebug(),
      why_classified_as_noise: why,
    },
  };
}

/**
 * Exactly one canonical understanding object per paragraph clause node.
 * `semantic_block_id` is a placeholder until `understandDocument` post-processes.
 */
export function understandAtomicClause(
  clause: Clause,
  documentContextText?: string,
): ClauseUnderstandingRecord | null {
  if (clause.type !== 'paragraph') return null;

  const text = clause.text;
  const signalCodes = collectSignalCodes(text);
  const hadSemanticSignals = hasStrongSemanticSignals(text);
  const sep = classificationStrength(text);

  const dominant = classifyDominant(text);
  const inferred = inferSubstantiveTypeFallback(text);
  const substantiveType: SubstantiveClauseType | null = dominant ?? inferred ?? null;

  const fullFields =
    substantiveType !== null
      ? extractFieldsForSubstantiveType(substantiveType, text)
      : {};

  let confidenceRaw = computeUnderstandingConfidence(
    substantiveType,
    fullFields,
    sep,
    text,
  );

  const ctx = documentContextText ?? text;
  const rawEnt = extractEntities(text);
  const entities = {
    parties: resolvePartiesToRoles(rawEnt.parties, text),
    instruments: canonicalizeInstrumentsForDocument(rawEnt.instruments, ctx),
  };

  const entitiesResolved = entitiesAreResolved(
    entities.parties ?? { company: null, counterparty: null },
    entities.instruments,
  );

  const fragmented = inferFragmentation(text);
  const sec = parseSectionIdFromClauseId(clause.id);

  if (isPureNavigationOrStructuralRepetition(text)) {
    return noiseRecord(
      clause.id,
      confidenceRaw,
      signalCodes,
      'pure_navigation_or_structural_repetition',
      clause.id,
      hadSemanticSignals,
    );
  }

  if (substantiveType === null && !hadSemanticSignals && isLowInformationContent(text)) {
    return noiseRecord(
      clause.id,
      confidenceRaw,
      signalCodes,
      'no_classifier_match_low_information',
      clause.id,
      hadSemanticSignals,
    );
  }

  if (substantiveType === null) {
    return noiseRecord(
      clause.id,
      confidenceRaw,
      signalCodes,
      'no_substantive_clause_type_inferred',
      clause.id,
      hadSemanticSignals,
    );
  }

  let confidence = calibrateConfidence(confidenceRaw, {
    clauseId: clause.id,
    clauseType: substantiveType,
    entitiesResolved,
    fragmentedClause: fragmented,
    noiseLikelyMisclassified: false,
    missingEntitiesForSignificantClause: shouldFlagMissingEntitiesForSection(
      substantiveType,
      clause.id,
      entitiesResolved,
    ),
  });

  if (isMaterialDefinitiveItemSection(sec) && substantiveType && hadSemanticSignals) {
    confidence = Math.max(confidence, 0.31);
  }

  const noiseFloor = 0.23;
  if (confidence < noiseFloor && !hadSemanticSignals) {
    return noiseRecord(
      clause.id,
      confidenceRaw,
      signalCodes,
      'confidence_below_floor_without_semantic_signals',
      clause.id,
      hadSemanticSignals,
    );
  }

  const tier = confidenceTier(confidence);
  const clause_type: LegalClauseType = substantiveType;
  let extracted_fields: Record<string, unknown> = fullFields;

  if (confidence < 0.6) {
    extracted_fields = reduceFieldsForMediumConfidence(substantiveType, fullFields);
  }

  const semantic_block_id = `${sec}.sb1`;

  return {
    clause_id: clause.id,
    clause_type,
    primary_intent: derivePrimaryIntent(clause_type, text, tier),
    extracted_fields,
    entities,
    confidence,
    semantic_block_id,
    debug: {
      ...emptyDebug(),
      block_assignment_reason: 'atomic_clause:use_understandDocument_for_block_runs',
    },
  };
}

export function collectParagraphClauses(sections: Clause[]): Clause[] {
  const out: Clause[] = [];
  const walk = (n: Clause): void => {
    if (n.type === 'paragraph') out.push(n);
    for (const c of n.children) walk(c);
  };
  for (const s of sections) walk(s);
  return out;
}

/**
 * One JSON object per unique `clause_id` (deduped; first occurrence wins),
 * then duplicate-merge and semantic block assignment.
 */
export function understandDocument(
  sections: Clause[],
): ClauseUnderstandingRecord[] {
  const docText = collectAllParagraphText(sections);
  const seen = new Set<string>();
  const works: ClauseWork[] = [];

  for (const p of collectParagraphClauses(sections)) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    const r = understandAtomicClause(p, docText);
    if (r) works.push({ record: r, text: p.text });
  }

  const deduped = dedupeUnderstandingRecords(works);
  return assignSemanticBlocks(deduped);
}
