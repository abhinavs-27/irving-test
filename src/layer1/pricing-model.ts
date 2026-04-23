import type { Clause, SemanticBlock } from '../clause/clause.js';
import type {
  BlockPricingModel,
  BlockPricingModelMode,
  VwapModeName,
  VwapModeWindow,
} from './types.js';
import { extractExplicitClausePricing } from './explicit-pricing.js';

function modeFromParagraph(
  text: string,
): { name: VwapModeName; window: VwapModeWindow } | null {
  const t = text;
  const hasIntraday = /\bintraday\b/i.test(t);
  const hasRegular =
    /\bregular\s+Purchase\b/i.test(t) ||
    (!hasIntraday && /\bVWAP\b/i.test(t) && /full|primary|session/i.test(t));

  if (hasIntraday) {
    const multi =
      /\b(?:two|2|each|per)\s+.*\bsegment/i.test(t) ||
      /\bmultiple\b.*\b(?:window|segment|period)/i.test(t) ||
      /(?:valuations?|VWAP).*(?:;|and).*(?:valuations?|VWAP)/i.test(t);
    return {
      name: 'intraday_purchase',
      window: multi ? 'intraday_segments' : 'intraday',
    };
  }
  if (hasRegular) {
    return { name: 'regular_purchase', window: 'full_session' };
  }
  if (/\bVWAP\b/i.test(t)) {
    if (/\bintraday\b/i.test(t)) {
      return { name: 'intraday_purchase', window: 'intraday' };
    }
    return { name: 'regular_purchase', window: 'full_session' };
  }
  return null;
}

/**
 * Block-level `pricing_model`: literal fields from cited paragraphs (no free-text formula).
 */
export function buildPricingModelForBlock(
  _sectionId: string,
  block: SemanticBlock,
  paragraphById: Map<string, Clause>,
): BlockPricingModel | undefined {
  if (block.type !== 'pricing_mechanism') return undefined;

  const paras = block.paragraph_ids
    .map((id) => paragraphById.get(id))
    .filter((c): c is Clause => c != null);

  const byKey = new Map<string, BlockPricingModelMode>();
  for (const p of paras) {
    const t = p.text;
    const pr = extractExplicitClausePricing(t);
    if (pr?.method && pr.method !== 'VWAP' && pr.method !== 'FORMULA') {
      continue;
    }
    if (
      !/\bVWAP\b/i.test(t) &&
      (pr == null || (pr.discount_rate == null && pr.valuation_window == null))
    ) {
      continue;
    }
    const m = modeFromParagraph(t);
    if (!m) continue;
    const key = `${m.name}|${m.window}`;
    const mode: BlockPricingModelMode = {
      name: m.name,
      vwap_window: m.window,
    };
    if (pr?.discount_rate != null) {
      mode.discount_percent = pr.discount_rate;
    }
    if (/\bvolume\s+threshold\b|\btrun(?:c|cat)/i.test(t)) {
      mode.volume_threshold_truncation = true;
    }
    if (/\bopen(?:ing)?\b.*\bclose|exclude.*open|exclude.*close|first.*last.*(?:minute|min)/i.test(
      t,
    )) {
      mode.excludes_open_close = true;
    }
    if (m.name === 'intraday_purchase' && m.window === 'intraday_segments') {
      mode.multi_window = true;
    }
    if (!byKey.has(key)) {
      byKey.set(key, mode);
    } else {
      const ex = byKey.get(key)!;
      if (mode.discount_percent != null) ex.discount_percent = mode.discount_percent;
      if (mode.volume_threshold_truncation) {
        ex.volume_threshold_truncation = true;
      }
      if (mode.excludes_open_close) ex.excludes_open_close = true;
      if (mode.multi_window) ex.multi_window = true;
    }
  }

  if (byKey.size === 0) {
    const collected: BlockPricingModelMode[] = [];
    for (const p of paras) {
      const t = p.text;
      if (!/\bVWAP\b/i.test(t)) continue;
      const pr = extractExplicitClausePricing(t);
      const w: VwapModeWindow = /\bintraday\b/i.test(t)
        ? 'intraday'
        : 'full_session';
      const name: VwapModeName = w === 'intraday'
        ? 'intraday_purchase'
        : 'regular_purchase';
      const m: BlockPricingModelMode = {
        name,
        vwap_window: w,
        ...(pr?.discount_rate != null
          ? { discount_percent: pr.discount_rate }
          : {}),
      };
      collected.push(m);
    }
    if (collected.length === 0) return undefined;
    return applyBlockDiscount(
      { type: 'vwap_discount', method: 'VWAP', modes: mergeModes(collected) },
      paras,
    );
  }

  return applyBlockDiscount(
    {
      type: 'vwap_discount',
      method: 'VWAP',
      modes: mergeModes([...byKey.values()]),
    },
    paras,
  );
}

function applyBlockDiscount(
  model: BlockPricingModel,
  paras: Clause[],
): BlockPricingModel {
  const allText = paras.map((p) => p.text).join('\n');
  const disc = extractExplicitClausePricing(allText);
  if (disc?.discount_rate == null) {
    return { ...model, method: 'VWAP' };
  }
  const modes = model.modes.map((m) => ({
    ...m,
    discount_percent: m.discount_percent ?? disc.discount_rate,
  }));
  return { ...model, method: 'VWAP', modes };
}

function mergeModes(
  modes: BlockPricingModelMode[],
): BlockPricingModelMode[] {
  const m = new Map<string, BlockPricingModelMode>();
  for (const x of modes) {
    const k = `${x.name}|${x.vwap_window}`;
    if (!m.has(k)) m.set(k, { ...x });
  }
  return [...m.values()];
}

export function buildBlockPricingModelMap(
  sectionId: string,
  section: Clause,
  paragraphById: Map<string, Clause>,
): Map<string, BlockPricingModel> {
  const map = new Map<string, BlockPricingModel>();
  for (const b of section.blocks ?? []) {
    const pm = buildPricingModelForBlock(sectionId, b, paragraphById);
    if (pm) map.set(b.id, pm);
  }
  return map;
}
