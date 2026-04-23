import type { Clause } from '../clause/clause.js';
import type { EntityRegistry, GraphEvent } from './types.js';
/**
 * Explicit agreement titles appearing in `text` (stable order, deduped).
 */
export declare function extractAgreementTypesFromText(text: string): string[];
/**
 * Agreement execution + termination events with full normalized fields.
 */
export declare function buildDocumentEvents(sections: Clause[], entityRegistry: EntityRegistry): {
    events: GraphEvent[];
    eventIdByBlock: ReadonlyMap<string, string>;
};
export declare function eventKindToLabel(k: 'agreement_execution' | 'agreement_termination' | 'commencement'): string;
//# sourceMappingURL=document-events.d.ts.map