# Layer 1 filing schema

This document describes the **structured SEC 8-K intermediate representation** used by Irving: TypeScript types, JSON Schema, validation, graph helpers, completeness checks, and normalization.

## Artifacts

| Artifact | Path |
|----------|------|
| JSON Schema (draft 2020-12) | [`schemas/layer1-filing.schema.json`](../schemas/layer1-filing.schema.json) |
| TypeScript root type | [`src/layer1/filing-types.ts`](../src/layer1/filing-types.ts) `Layer1Filing` |
| Schema-shape validation (no AJV) | [`src/layer1/filing-validate.ts`](../src/layer1/filing-validate.ts) `validateFilingSchemaShape` |
| Graph / business rules | `validateFilingRules` |
| Combined | `validateFiling` |
| Traversals & lifecycle | [`src/layer1/filing-graph.ts`](../src/layer1/filing-graph.ts) |
| Heuristic completeness | [`src/layer1/filing-completeness.ts`](../src/layer1/filing-completeness.ts) `checkCompleteness` |
| Normalization utilities | [`src/layer1/filing-normalize.ts`](../src/layer1/filing-normalize.ts) |
| Extraction contract (stricter) | [`specs/extraction_contract.md`](extraction_contract.md) + `extraction-contract.ts` |

## Top-level shape

```json
{
  "entity_registry": { "org:…": { "kind", "canonical_name", "aliases" } },
  "block_registry": { "…blockId": { "id", "type", "semantic_role", "paragraph_ids", "pricing_model?" } },
  "events": [ { "id", "kind", "label", "primary_entity_id", "counterparty_entity_ids", "agreement_types", "source_block_ids", "as_of_date?" } ],
  "relationships": [ { "type", "source", "target" } ],
  "sections": [ … rich tree … ]
}
```

`sections` is optional in the JSON Schema (for graph-only consumers) but is **required** for full pipeline validation that ties every paragraph to `block_registry`.

## Enums

### `block_registry.*.type`

`structural` | `pricing_mechanism` | `constraint` | `termination` | `regulatory_disclosure`

> **Note:** User-facing “disclosure” corresponds to `regulatory_disclosure` in the machine type; `semantic_role` on the same block is `disclosure`.

### `relationships.*.type`

`defines` | `constrains` | `governs` | `references` | `triggers`

- `governs`: block → paragraph  
- `defines` / `constrains`: block → `org:…`  
- `triggers`: block → `event:…`  
- `references`: block → paragraph (cross-reference)

### `events.*.kind`

`agreement_execution` | `agreement_termination` | `commencement`

## Validation layers

1. **JSON Schema** (`validateFilingSchemaShape`): required fields for entities, blocks, events, relationships; enums; regex for `event:` / `org:` ids where applicable.
2. **Rules** (`validateFilingRules`): paragraph ↔ block coverage, edge targets, pricing block `pricing_model`, constraint block numeric facts, entity registry closure, semantic role consistency per paragraph.
3. **Extraction contract** (`validateExtractionContract`): stricter checklist in [`extraction_contract.md`](extraction_contract.md).

## Derived graph

- **`blocksLinkedToEntity` / `paragraphsLinkedToEntity`**: via `defines`, `constrains`, and `governs` + paragraph `counterparty_id`.
- **`eventsForBlock`**: events whose `source_block_ids` include the block.
- **`eventsTriggeredByBlock`**: `triggers` edges from block to event id.
- **`constraintsAffectingEntity`**: section-level `constraints` rows tied to paragraphs mentioning the entity.
- **`agreementLifecycleChain`**: execution → pricing → constraint → termination ordering summary.

## Completeness (`checkCompleteness`)

Heuristic expectations from **flattened paragraph text**:

- “Entered into” → `agreement_execution` event  
- VWAP / discount → `pricing_mechanism` + `pricing_model`  
- % caps / ownership → `constraint` block  
- Termination language → `termination` block (+ termination event)

Findings use severity `missing` | `warn` | `info`; `ok` is false if any `missing`.

## Normalization

- **`percentagePointsToDecimal`**: 19.99 → 0.1999  
- **`normalizeFactsDecimals`**: adds optional `percentage_decimals[]` alongside `percentages[]`  
- **`normalizeUsdAmount`**: `{ value, currency: 'USD' }`  
- **`normalizeIsoDate`**: best-effort ISO date  
- **`resolveAliasToEntityId`**: wraps `resolveNameToEntityId`  
- **`applyNormalizedFactsToSections`**: deep-copy attach normalized facts on paragraphs

## Tests

[`src/layer1/filing.test.ts`](../src/layer1/filing.test.ts) — negative cases for unassigned paragraphs, dangling relationships, missing `pricing_model`; fixture validation using [`src/layer1/fixtures/sample-filing.json`](../src/layer1/fixtures/sample-filing.json).

## External validation

Validate JSON with any Draft 2020-12 validator, e.g.:

```bash
npx ajv-cli validate -s schemas/layer1-filing.schema.json -d out/layer1.json
```

(Requires `ajv-cli` / `ajv-formats` if formats are tightened later.)
