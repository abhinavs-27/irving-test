Layer 3: Agreement Schema (v1)
Overview

Layer 3 transforms multiple ClauseBlocks into a single normalized Agreement object.

It is a cross-clause synthesis layer:

merges facts across blocks
resolves duplication
computes derived fields
enables querying at the agreement level
Core Principle
Input: Array of Layer 2 ClauseBlock
Output: One Agreement object per logical agreement
Rules:
deterministic aggregation
no new arbitrary fields
conflicts must be resolved or surfaced
Agreement Object
type Agreement = {
agreement_id: string

primary_entity_id: string
counterparty_entity_ids: string[]

clause_ids: string[]

agreement: AgreementTerms
pricing?: PricingTerms
constraints?: ConstraintTerms
termination?: TerminationTerms
disclosure?: DisclosureTerms

risk_flags: RiskFlag[]

metadata: {
clause_count: number
high_priority_clause_count: number
confidence: number
}
}
AgreementTerms
type AgreementTerms = {
agreement_date?: string
execution_date?: string
}
Rules
Take earliest agreement_reference_date_iso
Execution date from agreement_execution event if present
PricingTerms
type PricingTerms = {
mechanism: string
settlement_method: string
discount_rate?: number
has_variable_pricing: boolean
}
Rules
Merge across all pricing_terms clauses
discount_rate = max observed
has_variable_pricing = true if multiple modes differ
ConstraintTerms
type ConstraintTerms = {
exchange_issuance_cap_rate?: number
beneficial_ownership_cap_rate?: number
}
Rules
Take minimum cap rates (most restrictive)
Deduplicate across clauses
TerminationTerms
type TerminationTerms = {
stated_term_months?: number
termination_notice_days?: number
aggregate_purchase_ceiling_usd?: number
}
Rules
Merge all termination + structural leaks
Prefer:
explicit termination block > inferred values
DisclosureTerms
type DisclosureTerms = {
largest_amount_usd?: number
largest_share_count?: number
}
Risk Flags (CRITICAL)

This is where Layer 3 becomes useful.

type RiskFlag = {
type: string
severity: "low" | "medium" | "high"
message: string
clause_ids: string[]
}
Built-in Risk Rules (v1)

1. High Dilution Risk
   if (discount_rate >= 0.03 && has_variable_pricing)

→ "high_dilution_risk"

2. Weak Ownership Protection
   if (beneficial_ownership_cap_rate >= 0.0499)

→ "weak_ownership_protection"

3. Short Notice Termination
   if (termination_notice_days <= 5)

→ "short_notice_termination"

4. Missing Constraints
   if (!constraints)

→ "missing_constraints"

5. Conflicting Terms
   if (multiple different values for same field)

→ "conflicting_terms"

Aggregation Rules (IMPORTANT)

1. Clause grouping

Group by:

(primary_entity_id, counterparty_entity_ids) 2. Deduplication
Numeric → max or min depending on semantics
Dates → earliest
Arrays → union 3. Conflict handling

If conflict:

store best guess

- emit RiskFlag("conflicting_terms")

4. Confidence
   confidence = avg(clause.confidence)
   🔍 Retrieval Strategy (Layer 3-aware)

Now your retrieval becomes:

Step 1: Structured filter
WHERE clause_type IN ('termination', 'constraint')
Step 2: Semantic rerank (pgvector)
embed:
clause summaries
agreement summary
Step 3: Boost
clauses referenced by others
high priority clauses
clauses contributing to risk_flags

Query Decomposition (Agent-lite)
Example: “Find issues”

Decompose into:

[
"analyze termination terms",
"check pricing dilution risk",
"verify ownership protections",
"detect missing constraints",
"detect inconsistencies"
]

Each maps to:

structured filters
risk flag evaluation
