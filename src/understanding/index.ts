export type {
  ClauseUnderstandingDebug,
  ClauseUnderstandingRecord,
  LegalClauseType,
  ResolvedParties,
  SubstantiveClauseType,
} from './types.js';

export {
  understandAtomicClause,
  collectParagraphClauses,
  understandDocument,
} from './understand.js';
