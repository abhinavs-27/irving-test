import type { EntityRegistry } from './types.js';
import type { FactsV2, UsdAmount } from './types.js';
import { resolveNameToEntityId } from './entity-registry.js';
import type { FilingSectionNode } from './filing-types.js';

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Convert percent points (e.g. 19.99) to decimal fraction (0.1999). */
export function percentagePointsToDecimal(points: number): number {
  return points / 100;
}

/** Normalize facts: add `percentage_decimals` parallel to percentages; coerce money shape. */
export function normalizeFactsDecimals(facts: FactsV2): FactsV2 & {
  percentage_decimals?: number[];
} {
  const percentage_decimals = facts.percentages.map((p) =>
    percentagePointsToDecimal(p),
  );
  return {
    ...facts,
    ...(percentage_decimals.some((x) => Number.isFinite(x))
      ? { percentage_decimals }
      : {}),
  };
}

/** Ensure USD amounts use { value, currency: 'USD' }. */
export function normalizeUsdAmount(u: Partial<UsdAmount>): UsdAmount | null {
  if (typeof u?.value !== 'number' || !Number.isFinite(u.value)) return null;
  return { value: u.value, currency: 'USD' };
}

/** Normalize date strings to ISO YYYY-MM-DD when parseable. */
export function normalizeIsoDate(raw: string): string | null {
  const t = raw.trim();
  if (ISO.test(t)) return t;
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Resolve alias / fragment to canonical org id when possible. */
export function resolveAliasToEntityId(
  phrase: string,
  registry: EntityRegistry,
): string | undefined {
  return resolveNameToEntityId(phrase, registry);
}

/** Walk section tree and attach normalized facts copy on paragraph nodes (immutable input safe if caller clones). */
export function applyNormalizedFactsToSections(
  nodes: FilingSectionNode[] | undefined,
): FilingSectionNode[] | undefined {
  if (!nodes) return undefined;
  return nodes.map((n) => {
    let next: FilingSectionNode = { ...n };
    if (n.type === 'paragraph' && n.facts) {
      next = {
        ...next,
        facts: normalizeFactsDecimals(n.facts),
      };
    }
    if (n.children?.length) {
      next = { ...next, children: applyNormalizedFactsToSections(n.children) };
    }
    return next;
  });
}
