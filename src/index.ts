export type {
  Clause,
  ClauseType,
  SemanticBlock,
  SemanticBlockCategory,
} from './clause/clause.js';
export type {
  FilingCheckbox,
  FilingCompany,
  FilingHeaderStructured,
  FilingInfo,
  FilingMetadata,
  FilingSecurityRow,
} from './sec/filing-header-types.js';

export type {
  AtomicClauseKind,
  ClausePricingLayer1,
  DocumentRelationship,
  EntityRegistry,
  FactsV2,
  GraphConceptRecord,
  BlockPricingModel,
  BlockPricingModelMode,
  GraphEvent,
  GraphEventKind,
  GraphMetadata,
  KgraphRelationshipType,
  Layer1BlockType,
  Layer1ClauseSignals,
  ParagraphFacts,
  SectionConstraintEntry,
  SectionEntities,
} from './layer1/types.js';
export { KGRAPH_RELATIONSHIP_TYPES } from './layer1/types.js';

export { atomicKindForLayer1BlockType } from './layer1/types.js';
export { inferAtomicKind } from './layer1/atomic-kind.js';
export { buildNormalizedFactsForParagraph } from './layer1/facts-pipeline.js';
export { buildDocumentRelationships } from './layer1/relationships.js';
export type {
  BlockRegistryEntry,
  Layer1SemanticRole,
} from './layer1/block-registry.js';
export {
  buildBlockRegistry,
  findBlockIdContainingParagraph,
  paragraphToBlockMap,
} from './layer1/block-registry.js';
export type { Layer1GraphPayload } from './layer1/layer1-graph-compile.js';
export {
  normalizeLayer1Graph,
  validateLayer1Graph,
} from './layer1/layer1-graph-compile.js';
export type { ContractViolation } from './layer1/extraction-contract.js';
export { validateExtractionContract } from './layer1/extraction-contract.js';
export { applyExtractionContractFixes } from './layer1/extraction-contract-fix.js';
export { extractAgreementTypesFromText } from './layer1/document-events.js';
export {
  applyEntityIdsToParagraphs,
  buildEntityRegistry,
  buildSignalsWithEntityRegistry,
  resolveIssuerEntityId,
} from './layer1/entity-registry.js';
export { buildConceptRegistry } from './layer1/knowledge-concepts.js';
export { buildDocumentEvents } from './layer1/document-events.js';
export { buildBlockPricingModelMap, buildPricingModelForBlock } from './layer1/pricing-model.js';
export { buildSectionConstraints } from './layer1/section-constraints.js';
export {
  buildFullSignalsForParagraph,
  expandLayer1SignalBuckets,
} from './layer1/signal-shape.js';
export type { FullSignalShape } from './layer1/signal-shape.js';

export type {
  Layer1ValidationIssue,
  Layer1ValidationResult,
} from './layer1/validate.js';
export { validateLayer1Tree } from './layer1/validate.js';
export type {
  Layer2ValidationIssue,
  Layer2ValidationResult,
} from './layer1/validate-layer2.js';
export { validateLayer2Tree } from './layer1/validate-layer2.js';

export type {
  Layer1Filing,
  FilingSectionNode,
} from './layer1/filing-types.js';
export {
  LAYER1_FILING_SCHEMA_ID,
  SCHEMA_ENUM_BLOCK_TYPE,
  SCHEMA_ENUM_RELATIONSHIP_TYPE,
} from './layer1/filing-types.js';
export type {
  FilingValidationIssue,
  FilingValidationResult,
} from './layer1/filing-validate.js';
export {
  validateFilingSchemaShape,
  validateFilingRules,
  validateFiling,
} from './layer1/filing-validate.js';
export type {
  AgreementLifecycle,
} from './layer1/filing-graph.js';
export {
  agreementLifecycleChain,
  blocksLinkedToEntity,
  constraintsAffectingEntity,
  eventsForBlock,
  eventsTriggeredByBlock,
  paragraphsLinkedToEntity,
} from './layer1/filing-graph.js';
export type {
  CompletenessFinding,
  CompletenessReport,
  CompletenessSeverity,
} from './layer1/filing-completeness.js';
export { checkCompleteness } from './layer1/filing-completeness.js';
export {
  applyNormalizedFactsToSections,
  normalizeFactsDecimals,
  normalizeIsoDate,
  normalizeUsdAmount,
  percentagePointsToDecimal,
  resolveAliasToEntityId,
} from './layer1/filing-normalize.js';

export { isValidEntityPhrase } from './sec/entity-phrase.js';
export { splitAtomicParagraphUnits } from './sec/atomic-segmentation.js';
export { parseFilingHeader } from './sec/parse-filing-header.js';

export { loadDocument, setDefaultDocumentLoader } from './document/load-document.js';
export type { DocumentTextLoader } from './document/document-loader.js';
export { createPdfParseLoader } from './document/pdf-parse-loader.js';
export type { PdfParseLoaderOptions } from './document/pdf-parse-loader.js';

export { extractClauses, type ClauseMatch } from './clause/extract.js';
export { buildHierarchy } from './clause/hierarchy.js';
export {
  extractSections,
  parseSectionInnerClauses,
} from './sec/extract-sections.js';
export {
  splitIntoParagraphs,
  segmentSectionsIntoParagraphs,
  withParagraphChildren,
} from './sec/split-paragraphs.js';
export { normalizeParagraphText } from './text/normalize-paragraph.js';
export { groupParagraphsIntoBlocks } from './semantic/semantic-blocks.js';
export { normalizeParagraphNodesAndGroupBlocks } from './pipeline/enrich-segments.js';
export { printClauseTree } from './clause/print.js';

export {
  normalizeClauseId,
  computeParentId,
  isWellFormedClauseId,
  isProbableClauseNumbering,
  isStructuralClauseId,
  CLAUSE_ID_PATTERN,
} from './clause/clause-id.js';

export { legalDocLog, setLogLevel } from './logging.js';
export type { LogLevel } from './logging.js';

export type {
  ClauseUnderstandingDebug,
  ClauseUnderstandingRecord,
  LegalClauseType,
  ResolvedParties,
  SubstantiveClauseType,
} from './understanding/types.js';
export {
  understandAtomicClause,
  collectParagraphClauses,
  understandDocument,
} from './understanding/understand.js';
