EXTRACTION COMPLETENESS CONTRACT

The model MUST NOT return a final answer unless ALL conditions are satisfied.

1. ENTITY COVERAGE
   Every organization mentioned in text MUST:
   exist in entity_registry
   have a stable canonical name
   be referenced via ID everywhere else
2. PARAGRAPH COVERAGE
   Every paragraph must have:
   exactly ONE atomicKind
   included in EXACTLY ONE block
   No paragraph may be unassigned
3. BLOCK COVERAGE
   Every block must:
   map to real paragraph_ids
   have a valid type
   have a consistent semantic role
4. EVENT COMPLETENESS

Each event MUST include:

primary_entity_id
counterparty_entity_ids
agreement_types
source_block_ids
as_of_date (if present in text) 5. RELATIONSHIP INTEGRITY
Every relationship:
must reference valid IDs
must not be dangling
Required edges:
block → paragraphs (governs)
block → events (triggers)
constraints → entities (constrains) 6. PRICING NORMALIZATION

If pricing exists:

MUST include:
method (VWAP)
discount
valuation window
MUST NOT be partially specified 7. CONSTRAINT EXTRACTION
All % limits must appear in:
paragraph facts
AND section-level constraints
Types required:
exchange cap
beneficial ownership cap 8. TERMINATION STRUCTURE

Termination must:

be its own block
trigger an event
include conditions (not just label) 9. NO PARTIAL STATES

The output is INVALID if:

any section is missing structure
any paragraph lacks classification
any entity is referenced but not defined
FINAL RULE

Before finishing, the model MUST:

Run a full validation pass
List ANY violations
Fix them
Only then return output

If validation fails → DO NOT RETURN
