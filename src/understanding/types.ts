/**
 * Strict single label per clause (includes noise bucket).
 */
export type LegalClauseType =
  | 'obligations'
  | 'payment'
  | 'pricing_terms'
  | 'termination'
  | 'indemnity'
  | 'constraints'
  | 'confidentiality'
  | 'misc.noise';

/** Non-noise clause types used by the classifier + full extractors. */
export type SubstantiveClauseType = Exclude<LegalClauseType, 'misc.noise'>;

export type ResolvedParties = {
  company: string | null;
  counterparty: string | null;
};

/**
 * Evaluation / debugging — populated on every row (empty arrays / null when unused).
 */
export type ClauseUnderstandingDebug = {
  /** Human-readable reason when `clause_type === misc.noise`; otherwise null. */
  why_classified_as_noise: string | null;
  /** Clause ids absorbed into this row during deduplication (survivor only). */
  merged_with: string[];
  /** Clause ids merged into this row (mirrors `merged_with` for evaluation exports). */
  deduped_from: string[];
  /** Why this clause landed in its semantic block. */
  block_assignment_reason: string | null;
};

/**
 * Layer 2 JSON contract (production + evaluation fields).
 */
export type ClauseUnderstandingRecord = {
  clause_id: string;
  clause_type: LegalClauseType;
  primary_intent: string;
  extracted_fields: Record<string, unknown>;
  entities: {
    parties: ResolvedParties | null;
    instruments: string[] | null;
  };
  confidence: number;
  /** Stable id for the semantic block run this clause belongs to (one block per clause). */
  semantic_block_id: string;
  debug: ClauseUnderstandingDebug;
};

export type ConfidenceTier = 'low' | 'medium' | 'high';
