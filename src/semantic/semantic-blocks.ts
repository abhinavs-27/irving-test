import type { Clause, SemanticBlock } from '../clause/clause.js';
import type { Layer1BlockType } from '../layer1/types.js';
import { legalDocLog } from '../logging.js';

type MechT =
  | 'termination'
  | 'pricing_mechanism'
  | 'constraint'
  | 'regulatory_disclosure'
  | 'structural';

function paraOrderIndex(sectionId: string, id: string): number {
  const p = id.match(
    new RegExp(`^${escapeRe(sectionId)}\\.p(\\d+)$`),
  );
  if (p) return parseInt(p[1]!, 10);
  const q = id.match(/\.p(\d+)$/);
  return q ? parseInt(q[1]!, 10) : 0;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
}

/** Single semantic dimension per bucket; `process` folded into pricing or regulatory. */
function assignMechanism(text: string): MechT {
  const low = text.toLowerCase();

  if (/^[☐☑□]|^exhibit\s+\d/im.test(text)) {
    return 'structural';
  }
  if (
    /^item\s+\d+\.\d+/im.test(text) &&
    !/\bVWAP\b|volume weighted average|per share purchase price that/i.test(
      text,
    )
  ) {
    return 'structural';
  }

  if (/\buse\s+of\s+proceeds\b/i.test(low)) {
    return 'regulatory_disclosure';
  }

  if (
    /\bterminat(?:e|es|ing|ion)(?:\s+of)?\b/.test(low) &&
    /\b(?:agreement|arrangement|purchase agreement|registration rights|facility|plan|understanding)\b/.test(
      low,
    )
  ) {
    return 'termination';
  }
  if (
    /\b(?:event\s+of\s+default|bankruptcy|assignment for the benefit of creditors)\b/.test(
      low,
    ) &&
    /\b(?:agreement|commence|custodian|dismissed)\b/.test(low)
  ) {
    return 'termination';
  }
  if (
    /\bVWAP\b/i.test(text) ||
    /\b(?:true[-\s]?up|discount|(?:purchase|closing|exercise|redemption)\s+price|per\s+share|fixed\s+price|price\s+calculation|intraday purchase|int raday|valuation period)\b/i.test(
      low,
    ) ||
    /\bvolume weighted/i.test(low)
  ) {
    return 'pricing_mechanism';
  }
  if (
    /\b(?:cap|ceiling|limit|maximum|minimum|exchange cap|ownership|beneficial|shall not issue|shall not exceed|may not|4\.99%|19\.99%|aggregate|standstill|restriction|prohibited)\b/.test(
      low,
    )
  ) {
    return 'constraint';
  }
  if (
    /\bsec\b|securities\s+and\s+exchange\s+commission|exchange\s+act|furnish(?:ed|ing)\s+pursuant|filed\s+pursuant|17\s*cf?r|exhibit|rule\s+42[45]|regulation\s+sk|regulation\s+fd|incorporated by reference|current report on form|safe\s+harbor/i.test(
      text,
    )
  ) {
    return 'regulatory_disclosure';
  }
  if (
    /\bintraday|trading\s+day|(?:business|calendar)\s+days?|put notice|irrevocable written purchase|each\s+purchase date|3:30\s*p\.?m\./i.test(
      text,
    ) &&
    !/\bVWAP|discount|purchase price per/i.test(low)
  ) {
    return 'regulatory_disclosure';
  }
  if (
    /by and between|exhibit index|signatures|cover page interactive/i.test(low)
  ) {
    return 'structural';
  }
  return 'structural';
}

export function groupParagraphsIntoBlocks(
  section: Clause,
  paragraphs: Clause[],
): SemanticBlock[] {
  if (paragraphs.length === 0) return [];

  if (section.type === 'metadata' || section.type === 'footer') {
    return [
      {
        id: `${section.id}.block.0`,
        type: 'structural',
        paragraph_ids: [...paragraphs].map((p) => p.id),
      },
    ];
  }

  const byMech = new Map<MechT, string[]>();
  for (const p of paragraphs) {
    const m = assignMechanism(p.text);
    if (!byMech.has(m)) byMech.set(m, []);
    byMech.get(m)!.push(p.id);
  }

  const entries = [...byMech.entries()]
    .filter(([, ids]) => ids.length > 0)
    .map(([ty, ids]) => {
      const sorted = [...ids].sort(
        (a, b) =>
          paraOrderIndex(section.id, a) - paraOrderIndex(section.id, b),
      );
      return {
        type: ty as Layer1BlockType,
        paragraph_ids: sorted,
        first: paraOrderIndex(section.id, sorted[0]!),
      };
    })
    .sort((a, b) => a.first - b.first);

  const blocks: SemanticBlock[] = entries.map((e, i) => ({
    id: `${section.id}.block.${i}`,
    type: e.type,
    paragraph_ids: e.paragraph_ids,
  }));

  legalDocLog.info('Semantic block grouping', {
    sectionId: section.id,
    blockCount: blocks.length,
    blockTypes: blocks.map((b) => b.type),
    paragraphsPerBlock: blocks.map((b) => b.paragraph_ids.length),
  });

  return blocks;
}
