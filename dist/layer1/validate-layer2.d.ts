import type { Clause } from '../clause/clause.js';
import type { BlockRegistryEntry } from './block-registry.js';
import type { DocumentRelationship, EntityRegistry } from './types.js';
export type Layer2ValidationIssue = {
    path: string;
    code: string;
    message: string;
};
export type Layer2ValidationResult = {
    ok: boolean;
    issues: Layer2ValidationIssue[];
};
/**
 * Invariants: relationships (grounded targets only), mixed blocks, use_of_proceeds, facts, signals.
 */
export declare function validateLayer2Tree(sections: Clause[], relationships: DocumentRelationship[], entityRegistry?: EntityRegistry, eventIds?: ReadonlySet<string>, blockRegistry?: Record<string, BlockRegistryEntry>): Layer2ValidationResult;
//# sourceMappingURL=validate-layer2.d.ts.map