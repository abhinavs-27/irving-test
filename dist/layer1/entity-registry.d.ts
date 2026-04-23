import type { Clause } from '../clause/clause.js';
import { type FullSignalShape } from './signal-shape.js';
import type { EntityRegistry } from './types.js';
/**
 * All named orgs from `entities` + `legal_signals.counterparty` (split on |) + counterparty string.
 */
export declare function collectEntityNames(sections: Clause[]): string[];
/**
 * Deduplicate by normalized key; first canonical wins.
 */
export declare function buildEntityRegistry(sections: Clause[]): EntityRegistry;
/** Every transactional counterparty to this 8-K program. Short names are aliases only. */
export declare const B_RILEY_PRINCIPAL_CANONICAL: "B. Riley Principal Capital II, LLC";
export declare const B_RILEY_PRINCIPAL_ID: "org:b_riley_principal_capital_ii_llc";
/**
 * Merges all B. Riley–related org rows into one, full legal name as canonical, short forms as aliases.
 */
export declare function consolidateBRileyPrincipalEntity(registry: EntityRegistry): {
    registry: EntityRegistry;
    idRemap: ReadonlyMap<string, string>;
};
/**
 * Map counterparty / fragment text to entity id (longest alias match first).
 */
export declare function resolveNameToEntityId(name: string | undefined, registry: EntityRegistry): string | undefined;
/**
 * Deterministic issuer / registrant org id (excludes consolidated B. Riley counterparty row).
 */
export declare function resolveIssuerEntityId(sections: Clause[], registry: EntityRegistry): string | undefined;
/**
 * Re-run signal extraction and attach `counterparty_id` / `counterparty_raw` (machine-executable; preserves legacy fields).
 */
export declare function applyEntityIdsToParagraphs(sections: Clause[], registry: EntityRegistry): Clause[];
/**
 * Full signal buckets + `counterparty_id` (no cycle: lives next to `resolveNameToEntityId`).
 */
export declare function buildSignalsWithEntityRegistry(text: string, registry: EntityRegistry): FullSignalShape;
//# sourceMappingURL=entity-registry.d.ts.map