/**
 * Deterministic entity cues (no NER): agreements, SEC registrant lines, parties, instruments.
 */

const INSTRUMENT_WORDS =
  /\b(?:Common\s+Stock\s+)?Purchase\s+Agreement|Registration\s+Rights\s+Agreement|Credit\s+Agreement|Indenture|Loan\s+Agreement|Security\s+Agreement|Merger\s+Agreement|Stock\s+Purchase\s+Agreement|Equity\s+Purchase\s+Agreement\b/gi;

/** Extract party-like phrases from common contract phrases (conservative). */
export function extractEntities(text: string): {
  parties: string[] | null;
  instruments: string[] | null;
} {
  const instruments = new Set<string>();
  let m: RegExpExecArray | null;
  const instrRe = new RegExp(INSTRUMENT_WORDS.source, INSTRUMENT_WORDS.flags);
  while ((m = instrRe.exec(text)) !== null) instruments.add(m[0].trim());

  const parties: string[] = [];

  const between = text.match(
    /\b(?:between|among)\s+([^,\n]{5,160}?)\s+(?:and|&)\s+([^.\n]{5,160}?)(?:\.|,|\n)/i,
  );
  if (between) {
    parties.push(between[1].trim(), between[2].trim());
  }

  const registrant = text.match(
    /\(Exact name of Registrant[^)]*\)\s*\n\s*([^\n()]{3,160})/i,
  );
  if (registrant) parties.push(registrant[1].trim());

  const registrantInline = text.match(
    /\((?:Exact\s+)?name\s+of\s+Registrant[^)]*\)\s*:?\s*([A-Z][^\n]{2,160})/i,
  );
  if (registrantInline) parties.push(registrantInline[1].trim());

  const partyDef = text.matchAll(
    /\b(?:Seller|Buyer|Purchaser|Investor|Counterparty|Lender|The\s+Company)\s*[:(]?\s*([A-Z][^\n,.]{2,120})/gi,
  );
  for (const pd of partyDef) parties.push(pd[1].trim());

  const pursuant = text.match(
    /\bbetween\s+([A-Z][^\n,]{3,120}?)\s+and\s+(?:B\.?\s*Riley|the\s+Investor)/i,
  );
  if (pursuant) parties.push(pursuant[1].trim());

  const counterpartyLead = text.match(
    /\b(?:Investor|Purchaser|Seller)\s*,?\s+([A-Z][A-Za-z0-9 &,.'()-]{3,120})/,
  );
  if (counterpartyLead) parties.push(counterpartyLead[1].trim());

  return {
    parties: parties.length > 0 ? [...new Set(parties)] : null,
    instruments: instruments.size > 0 ? [...instruments] : null,
  };
}
