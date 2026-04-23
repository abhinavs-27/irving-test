import type { Clause } from '../clause/clause.js';
import type { DocumentRelationship, EntityRegistry, GraphEvent } from './types.js';
import type { BlockRegistryEntry } from './block-registry.js';
export type Layer1GraphPayload = {
    entity_registry: EntityRegistry;
    block_registry: Record<string, BlockRegistryEntry>;
    events: GraphEvent[];
    relationships: DocumentRelationship[];
};
/**
 * Enforce graph invariants (entity coverage, event fields, termination triggers).
 * Mutates `relationships` and `events` in place until stable or max passes.
 */
export declare function normalizeLayer1Graph(payload: Layer1GraphPayload, sections: Clause[]): void;
export declare function validateLayer1Graph(payload: Layer1GraphPayload, sections: Clause[]): {
    ok: boolean;
    issues: {
        path: string;
        code: string;
        message: string;
    }[];
};
//# sourceMappingURL=layer1-graph-compile.d.ts.map