# Layer 2 Semantic Schema (v2)

## Core Principles

- Deterministic projection from Layer 1
- Schema-stable across documents
- No raw paragraph fact arrays
- No schema drift (no ad hoc nesting)

---

## Strict Domain Ownership Rule

Each `ClauseBlock` may **only** populate the domain that corresponds to its `clause_type`. **Cross-domain population is forbidden** (e.g. `structural` must not carry `termination` or pricing keys).

`clause_type` → `extracted_fields` key (exactly one when non-empty, see implementation `DOMAIN_BY_CLAUSE_TYPE`):

- `structural` → `structural`
- `pricing_terms` → `pricing`
- `constraint` → `constraints`
- `termination` → `termination`
- `disclosure` → `disclosure`
- `obligation` | `indemnity` | `payment` → `obligations` (empty until explicitly modeled)
- `other` → `{}` only (no domain keys)

---

## No Empty Objects Rule

- `extracted_fields` must **not** contain **empty** domain objects (e.g. `structural: {}`).
- If no fields exist under any allowed domain, **`extracted_fields` is `{}`**.

---

## Deterministic Priority Rule

- `priority` is derived **solely** from `clause_type` via a fixed table (`PRIORITY_BY_TYPE` in code).
- It is **not** inferred from content, confidence, or heuristics in projection or export.

---

## No New Fields (Layer 2 lock)

- **No** new properties may be introduced in Layer 2 `extracted_fields` (or within domain payloads) without updating this document and the allowlists in `validate-layer2` / `layer2-field-ownership`.
- Removed fields: row-level `applies_to` on constraints is **not** in the Layer 2 schema (use clause-level entity ids and graph relationships instead).

---

## ClauseBlock (strict shape)

```ts
{
  clause_id: string,
  clause_type: ClauseType,
  source_block_id: string,
  source_paragraph_ids: string[],

  primary_entity_id: string,           // "" if unknown
  counterparty_entity_ids: string[],

  event_ids: string[],
  event_kinds: string[],

  relationships: {
    governs: string[],
    constrains: string[],
    references: string[]
  },

  extracted_fields: ExtractedFields,   // ALWAYS PRESENT

  confidence: number,                  // [0,1]
  priority: "low" | "medium" | "high"
}
```

---

## Clause Types

```
structural | pricing_terms | constraint | termination | disclosure
| obligation | indemnity | payment | other
```

---

## ExtractedFields (fixed domains)

```ts
type ExtractedFields = {
  pricing?: PricingSchema;
  constraints?: ConstraintSchema;
  termination?: TerminationSchema;
  disclosure?: DisclosureSchema;
  structural?: StructuralSchema;
  obligations?: ObligationSchema;
};
```

---

## PricingSchema

```ts
{
  mechanism: "vwap_discount" | "fixed_price" | "other",
  settlement_method: string,
  discount_rate?: number,              // [0,1]

  modes?: {
    purchase_mode: string,
    vwap_session: string,
    discount_rate?: number,
    volume_adjusted?: boolean,
    excludes_open_close?: boolean,
    multi_segment_intraday?: boolean
  }[]
}
```

---

## ConstraintSchema

Entity scoping is implied by the parent `ClauseBlock`’s `primary_entity_id` / `counterparty_entity_ids` and relationship slices — **not** row-level `applies_to` in Layer 2 (field removed for strict, drift-free output).

```ts
{
  exchange_issuance?: {
    share_cap?: number,
    issuance_cap_rate?: number         // [0,1]
  }[],

  beneficial_ownership?: {
    cap_rate?: number                  // [0,1]
  }[],

  other_constraints?: {
    kind: string,
    numeric_value?: number,
    rate?: number
  }[]
}
```

---

## TerminationSchema (STRICT — FLAT)

```ts
{
  stated_term_days?: number,
  stated_term_months?: number,
  termination_notice_days?: number,
  aggregate_purchase_ceiling_usd?: number
}
```

❗ No nesting allowed.

**Safe inference (30-day window):** when `stated_term_months` is set from facts and there is exactly one day time-window with value `30`, and all other day windows share at most one distinct non-30 value, set `stated_term_days = 30` and, when that lone non-30 value exists, set `termination_notice_days` to it. If multiple distinct non-30 day values appear (ambiguous), **do not** apply this rule.

---

## StructuralSchema (STRICT — dates only)

```ts
{
  agreement_reference_date_iso?: string,
  execution_date_iso?: string
}
```

**Dates:**

- `agreement_reference_date_iso` — earliest agreement-related ISO date from paragraph facts in the block (when present).
- `execution_date_iso` — from linked `agreement_execution` graph event `as_of_date` when present.
- Both are emitted whenever their respective sources exist; **if they resolve to the same calendar day, both fields are still set** (no collapsing).

**Economic / term / pricing signals** do **not** appear on `StructuralSchema` — only the two ISO date fields above.

---

## Canonical Field Ownership

Each semantic domain has **one canonical `ClauseBlock` per filing** for overlapping machine-readable facts, so graph output stays acyclic and duplicate-free.

| Domain        | Allowed `clause_type` | Rule |
|---------------|------------------------|------|
| `termination` | `termination` only     | `extracted_fields.termination` MUST NOT appear on any other clause type. |
| `pricing`     | `pricing_terms` only   | `extracted_fields.pricing` only on pricing blocks. |
| `constraints` | `constraint` only      | `extracted_fields.constraints` only on constraint blocks. |

**Aggregation:** when multiple Layer 1 blocks of type `termination` would emit overlapping termination economics, values are **merged** (deterministic numeric combine) into the **canonical** termination row — the `termination` clause with the **lexicographically smallest `clause_id`**. Other termination rows **drop** their `termination` domain after merge so each scalar field is owned once.

**Validation:** reject unknown keys in `extracted_fields`; reject termination payloads outside `termination` clauses; reject the same termination field value appearing on more than one `ClauseBlock` after merge.

**Structural confidence:** without strong enrichment (e.g. two or more linked events, or one linked event plus both agreement and execution dates on `structural`), **confidence is capped at ~0.6**; otherwise the cap is relaxed toward the global ceiling.

---

## DisclosureSchema

```ts
{
  financial?: {
    largest_amount_usd?: number
  },
  issuance?: {
    largest_share_count?: number
  }
}
```

---

## Rules

### 1. No Schema Drift

- No nested reshaping (e.g. `termination.term.months`)
- Only defined fields allowed

### 2. Always include `extracted_fields`

`extracted_fields` is always an object on every `ClauseBlock` (may be `{}`).

### 2b. Omit empty domains

- If a domain object would be `{}` (e.g. `structural: {}`), **omit that key** from `extracted_fields`.
- If every domain is omitted, **`extracted_fields` is `{}`**.

### 3. Governing domains (economic fields)

- **Ceiling / commitment USD** and **stated term / notice / day** fields → **`TerminationSchema`** on **`clause_type: "termination"`** blocks only (see **Canonical Field Ownership**).
- Do not place economic, term, or pricing fields on `StructuralSchema`.

### 4. Prefer Lossless Projection

- If Layer 1 has the signal → preserve it

### 5. Normalize

- Percent → decimal
- USD → number (scalar `number` in JSON — never `{ value, currency }` in Layer 2 output)
- Dates → ISO

### 6. Serialization & validation (production)

- **ClauseBlock JSON key order** (stable stringify / snapshots):

  `clause_id`, `clause_type`, `source_block_id`, `source_paragraph_ids`, `primary_entity_id`, `counterparty_entity_ids`, `event_ids`, `event_kinds`, `relationships`, `extracted_fields`, `confidence`, `priority`

- String arrays on the block (`source_paragraph_ids`, `counterparty_entity_ids`, `event_ids`, `event_kinds`, and relationship targets) are **sorted** for deterministic diffs.
- **Per clause, at most one domain key** in `extracted_fields`, matching `clause_type` (see **Strict Domain Ownership Rule**). Never unknown keys under `extracted_fields` or under domain objects.
- **Validation:** reject unknown keys inside each domain object; **`extracted_fields.termination` only if `clause_type === "termination"`**; reject duplicate ownership of the same termination field value across multiple `ClauseBlock`s (after canonical merge); `StructuralSchema` only allows the two ISO date keys; percentage-like fields must lie in `[0, 1]`; USD amounts in Layer 2 must be finite **numbers**. Constraint **exchange_issuance** rows must include `share_cap` and/or `issuance_cap_rate`; **beneficial_ownership** rows must include `cap_rate`.

### 7. Priority (fixed table — not dynamic)

- Deterministic **`PRIORITY_BY_TYPE`**: `pricing_terms`, `constraint`, `termination` → **`high`**; `disclosure`, `obligation`, `indemnity`, `payment` → **`medium`**; `structural`, `other` → **`low`**. Content does not change priority.

### 8. Canonical field ownership (summary)

See **Canonical Field Ownership** (top-level section): termination / pricing / constraints are confined to their clause types; termination economics merge into one canonical row per filing.

---

## Output Goals

- Graph-ready
- Deterministic
- Deduplicated
- Schema-stable
