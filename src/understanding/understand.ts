/**
 * Layer 2: deterministic projection from Layer 1 blocks.
 */
import type { Clause } from '../clause/clause.js';

export function collectParagraphClauses(sections: Clause[]): Clause[] {
  const out: Clause[] = [];
  const walk = (n: Clause): void => {
    if (n.type === 'paragraph') out.push(n);
    for (const c of n.children) walk(c);
  };
  for (const s of sections) walk(s);
  return out;
}

export {
  buildLayer1FilingInput,
  projectNormalizedClausesFromLayer1,
} from './layer2-from-layer1.js';
