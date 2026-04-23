import type { Clause } from '../clause/clause.js';
import type { DocumentRelationship, EntityRegistry } from './types.js';
export type BuildRelationshipsContext = {
    entityRegistry: EntityRegistry;
    eventIdByBlock: ReadonlyMap<string, string>;
};
/**
 * Block → paragraph (`governs`), block → entity (`defines` / `constrains`), block → event (`triggers`).
 */
export declare function buildDocumentRelationships(sections: Clause[], ctx: BuildRelationshipsContext): {
    relationships: DocumentRelationship[];
};
//# sourceMappingURL=relationships.d.ts.map