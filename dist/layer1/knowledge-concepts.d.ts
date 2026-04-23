import type { DocumentRelationship, GraphConceptRecord } from './types.js';
/**
 * All `concept:*` ids referenced in relationships, with definitions, hierarchy, and supporting paragraphs.
 */
export declare function buildConceptRegistry(relationships: DocumentRelationship[], sourceByConcept: ReadonlyMap<string, readonly string[]>): {
    concepts: Record<string, GraphConceptRecord>;
    undefinedConceptRefs: string[];
};
//# sourceMappingURL=knowledge-concepts.d.ts.map