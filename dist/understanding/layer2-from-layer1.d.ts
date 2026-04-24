import type { Clause } from '../clause/clause.js';
import type { Layer1Filing, FilingSectionNode } from '../layer1/filing-types.js';
import type { BlockRegistryEntry } from '../layer1/block-registry.js';
import type { DocumentRelationship, EntityRegistry, GraphEvent } from '../layer1/types.js';
import type { NormalizedClauseRecord } from './normalized-clause.js';
export type BuildLayer1FilingInput = {
    entity_registry: EntityRegistry;
    block_registry: Record<string, BlockRegistryEntry>;
    events: GraphEvent[];
    relationships: DocumentRelationship[];
    sections: Clause[] | FilingSectionNode[];
};
export declare function buildLayer1FilingInput(input: BuildLayer1FilingInput): Layer1Filing;
export declare function projectNormalizedClausesFromLayer1(filing: Layer1Filing): NormalizedClauseRecord[];
//# sourceMappingURL=layer2-from-layer1.d.ts.map