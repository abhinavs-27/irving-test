import type { FilingHeaderStructured } from '../sec/filing-header-types.js';
import type {
  AtomicClauseKind,
  ClausePricingLayer1,
  Layer1BlockType,
  Layer1ClauseSignals,
  ParagraphFacts,
  SectionEntities,
} from '../layer1/types.js';

export type ClauseType = 'metadata' | 'section' | 'paragraph' | 'footer';

export type Clause = {
  id: string;
  title: string;
  /**
   * Body text for this node. For sections with `children`, this is **cleared** (`''`) —
   * paragraph leaves under `children` are the source of truth.
   */
  text: string;
  type: ClauseType;
  children: Clause[];
  filingHeader?: FilingHeaderStructured;
  signals?: Layer1ClauseSignals;
  /** Explicit literals only — see `extractExplicitClausePricing`. */
  pricing?: ClausePricingLayer1;
  atomicKind?: AtomicClauseKind;
  /** Stated numbers / time phrases (paragraph nodes). */
  facts?: ParagraphFacts;
  /** Registrant + named orgs / signatories (Item sections). */
  entities?: SectionEntities;
  /**
   * Section-level mechanism partition (one block per mechanism class; every paragraph in exactly one).
   */
  blocks?: SemanticBlock[];
};

/** Layer 1 block partition — no narrative `intent` / summary fields. */
export type SemanticBlock = {
  id: string;
  type: Layer1BlockType;
  paragraph_ids: string[];
};

export type { Layer1BlockType as SemanticBlockCategory };
