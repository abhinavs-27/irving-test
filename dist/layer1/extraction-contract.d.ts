import type { Clause } from '../clause/clause.js';
import type { BlockRegistryEntry } from './block-registry.js';
import type { DocumentRelationship, EntityRegistry, GraphEvent } from './types.js';
export type ContractViolation = {
    code: string;
    path: string;
    message: string;
};
/**
 * Validates output against `specs/extraction_contract.md`.
 */
export declare function validateExtractionContract(sections: Clause[], entity_registry: EntityRegistry, block_registry: Record<string, BlockRegistryEntry>, events: GraphEvent[], relationships: DocumentRelationship[]): ContractViolation[];
//# sourceMappingURL=extraction-contract.d.ts.map