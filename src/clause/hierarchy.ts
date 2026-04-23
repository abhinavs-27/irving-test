import type { Clause } from './clause.js';
import {
  computeParentId,
  isStructuralClauseId,
  validateClauseId,
} from './clause-id.js';
import { legalDocLog } from '../logging.js';

/**
 * Nest clauses by numbering: `2` → `2.1` → `2.1(a)`.
 * Returns roots only (orphans when parent id is missing become roots with a warning).
 */
export function buildHierarchy(flat: Clause[]): Clause[] {
  const byId = new Map<string, Clause>();
  /** First-seen order of unique ids. */
  const idOrder: string[] = [];

  for (const c of flat) {
    if (!isStructuralClauseId(c.id))
      validateClauseId(c.id, 'hierarchy input');
    if (!byId.has(c.id)) {
      byId.set(c.id, {
        id: c.id,
        title: c.title,
        text: c.text,
        type: c.type,
        children: [],
      });
      idOrder.push(c.id);
    } else {
      legalDocLog.warn('Duplicate clause id when building hierarchy map; merging', {
        id: c.id,
      });
      const prev = byId.get(c.id)!;
      prev.text = `${prev.text}\n\n${c.text}`.trim();
      if (!prev.title && c.title) prev.title = c.title;
    }
  }

  const hasParent = new Set<string>();

  for (const id of idOrder) {
    const node = byId.get(id)!;
    const parentId = computeParentId(id);
    if (parentId && byId.has(parentId)) {
      byId.get(parentId)!.children.push(node);
      hasParent.add(id);
    } else {
      if (parentId && !byId.has(parentId)) {
        legalDocLog.warn('Hierarchy assignment: parent section not found; clause treated as root', {
          id,
          expectedParent: parentId,
        });
      }
    }
  }

  const roots: Clause[] = [];
  for (const id of idOrder) {
    if (hasParent.has(id)) continue;
    roots.push(byId.get(id)!);
  }

  legalDocLog.info('Hierarchy roots', {
    rootIds: roots.map((r) => r.id),
    totalClauses: byId.size,
  });

  return roots;
}
