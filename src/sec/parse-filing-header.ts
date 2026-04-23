import type {
  FilingCheckbox,
  FilingHeaderStructured,
  FilingInfo,
  FilingSecurityRow,
} from './filing-header-types.js';

const FORM_LINE = /\bFORM\s+([0-9-KQ]+)\b/i;
const DATE_LINE =
  /(?:Date\s+of\s+Report|Date\s+of\s+earliest\s+event\s+reported)\s*[:\s]*(\d{1,2}\/\d{1,2}\/\d{2,4})/i;

function parseIsoishDate(m: string | undefined): string | null {
  if (!m) return null;
  const d = new Date(m);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  const us = m.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (us) {
    const [, mo, da, y] = us;
    return `${y}-${mo!.padStart(2, '0')}-${da!.padStart(2, '0')}`;
  }
  return null;
}

/** Strip SEC label noise from a captured value line. */
function cleanFieldValue(s: string): string {
  return s
    .replace(/\s+/g, ' ')
    .replace(/\s*\([^)]*\)\s*$/g, '')
    .trim();
}

/** Reject lines that are clearly not a company legal name. */
function isPlausibleCompanyName(s: string): boolean {
  const t = cleanFieldValue(s);
  if (t.length < 2 || t.length > 180) return false;
  if (/^\d[\d\s.-]+$/.test(t)) return false;
  if (/^\d{3}-\d{7}-\d{2}$/.test(t)) return false;
  if (/^\d{2}-\d{7}$/.test(t)) return false;
  if (/^\d{10}$/.test(t.replace(/\D/g, '')) && t.replace(/\D/g, '').length >= 8)
    return false;
  if (/^\([A-Za-z\s]+\)$/.test(t)) return false;
  return /[A-Za-z]{2,}/.test(t);
}

/** Drop concatenated registry / label junk from registrant name. */
function sanitizeCompanyName(name: string | null): string | null {
  if (!name) return null;
  let t = cleanFieldValue(name);
  if (/\d{3}-\d{2}-\d{4}|\d{3}-\d{7}-\d{2}/.test(t)) return null;
  if (/\(State\s+or\s+Other\s+Jurisdiction/i.test(t)) return null;
  if (
    /Commission\s+File|IRS\s+Employer|Central\s+Index\s+Key|\bCIK\b/i.test(t)
  )
    return null;
  if (/^\s*Delaware\s+\d/.test(t)) return null;
  t = t.replace(/\s*\([^)]*(?:Incorporation|Jurisdiction|charter)[^)]*\)\s*/gi, ' ').trim();
  if (!isPlausibleCompanyName(t)) return null;
  return t.length > 180 ? t.slice(0, 180).trim() : t;
}

function isPlausibleStateOrJurisdiction(s: string): boolean {
  const t = cleanFieldValue(s);
  if (t.length < 2 || t.length > 80) return false;
  if (/^\d[\d\s.-]+$/.test(t)) return false;
  return /^[A-Za-z][A-Za-z\s.()-]+$/.test(t);
}

function sanitizeJurisdictionValue(s: string | null): string | null {
  if (!s) return null;
  const t = cleanFieldValue(s);
  if (
    /identification|employer|irs|commission|index\s*key|central\s*index|no\.\s*\)\s*$/i.test(
      t,
    )
  )
    return null;
  if (/\(/.test(t) && /\bidentification|employer|incorporation\s+no/i.test(t))
    return null;
  if (/\bIdentification\s+No\.?\b/i.test(t)) return null;
  if (!isPlausibleStateOrJurisdiction(t)) return null;
  return t;
}

/** Extract value on same line after anchor in parentheses. */
function inlineAfterParenLabel(
  text: string,
  labelPattern: RegExp,
): string | null {
  const m = text.match(
    new RegExp(labelPattern.source + String.raw`\s*[:\s]*([^\n(]+?)(?:\n|$)`, 'im'),
  );
  if (!m?.[1]) return null;
  const v = cleanFieldValue(m[1]);
  return v.length > 0 ? v : null;
}

/** Next non-empty line after line matching `anchorTest`. */
function lineAfterAnchor(
  lines: string[],
  anchorTest: (line: string) => boolean,
): string | null {
  for (let i = 0; i < lines.length; i++) {
    if (anchorTest(lines[i]!)) {
      for (let j = i + 1; j < lines.length; j++) {
        const next = lines[j]!.trim();
        if (!next) continue;
        if (/^\([^)]+\)\s*$/.test(next)) continue;
        return next;
      }
    }
  }
  return null;
}

/**
 * Unpack a single corrupted cover line that concatenated state + file no + EIN + CIK.
 * Example: "Delaware 001-39362 84-4730610 0001847351"
 */
function unpackPackedMetadataLine(line: string): {
  jurisdiction: string | null;
  file_number: string | null;
  ein: string | null;
  cik: string | null;
} {
  const t = line.trim();
  const out = {
    jurisdiction: null as string | null,
    file_number: null as string | null,
    ein: null as string | null,
    cik: null as string | null,
  };

  const fn = t.match(/\b(\d{3}-\d{7}-\d{2})\b/);
  if (fn) out.file_number = fn[1]!;

  const fnAlt = t.match(/\b(\d{3}-\d{2}-\d{4})\b/);
  if (!out.file_number && fnAlt) out.file_number = fnAlt[1]!;

  const ein = t.match(/\b(\d{2}-\d{7})\b/);
  if (ein) out.ein = ein[1]!;

  const cik = t.match(/\b(\d{10})\b|\b(?:CIK|0)(\d{10})\b/i);
  if (cik) out.cik = (cik[1] ?? cik[2] ?? '').replace(/\D/g, '').padStart(10, '0');

  const withoutNums = t
    .replace(/\b\d{3}-\d{7}-\d{2}\b/g, ' ')
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, ' ')
    .replace(/\b\d{2}-\d{7}\b/g, ' ')
    .replace(/\b\d{10}\b/g, ' ')
    .trim();

  const stateLike = withoutNums.match(
    /^(Delaware|Maryland|Nevada|California|New York|Texas|Florida|Massachusetts)\b/i,
  );
  if (stateLike && withoutNums.length < 60) out.jurisdiction = stateLike[0];

  return out;
}

function extractCompanyNameStructured(
  rawText: string,
  lines: string[],
): string | null {
  const inline = inlineAfterParenLabel(
    rawText,
    /\(Exact\s+name\s+of\s+registrant(?:\s+as\s+specified\s+in\s+its\s+charter)?\)/i,
  );
  if (inline && isPlausibleCompanyName(inline)) return cleanFieldValue(inline);

  const next = lineAfterAnchor(
    lines,
    (ln) =>
      /\(Exact\s+name\s+of\s+registrant/i.test(ln) ||
      /Exact\s+name\s+of\s+registrant/i.test(ln),
  );
  if (next && isPlausibleCompanyName(next)) return cleanFieldValue(next);

  return null;
}

function extractJurisdictionStructured(
  rawText: string,
  lines: string[],
): string | null {
  const inline = inlineAfterParenLabel(
    rawText,
    /\(State\s+or\s+other\s+jurisdiction\s+of\s+incorporation\)/i,
  );
  if (inline) return sanitizeJurisdictionValue(cleanFieldValue(inline));

  const next = lineAfterAnchor(
    lines,
    (ln) => /\(State\s+or\s+other\s+jurisdiction\s+of\s+incorporation/i.test(ln),
  );
  if (next) return sanitizeJurisdictionValue(cleanFieldValue(next));

  return null;
}

function extractCommissionFileNumber(
  rawText: string,
  lines: string[],
): string | null {
  const inline = inlineAfterParenLabel(
    rawText,
    /\(Commission\s+File\s+Number\)/i,
  );
  if (inline && /^\d{3}-\d{2}-\d{4}$|^\d{3}-\d{7}-\d{2}$/.test(inline.trim()))
    return inline.trim();

  const next = lineAfterAnchor(lines, (ln) =>
    /\(Commission\s+File\s+Number/i.test(ln),
  );
  if (next && /^\d[\d-]+$/.test(next.replace(/\s/g, ''))) {
    const m = next.match(/(\d{3}-\d{2}-\d{4}|\d{3}-\d{7}-\d{2})/);
    if (m) return m[1]!;
  }

  const loose = rawText.match(
    /Commission\s+File\s+(?:Number|No\.?)\s*[:\s#]*([0-9-]{7,14})/i,
  );
  return loose?.[1]?.trim() ?? null;
}

function extractIrsEin(rawText: string, lines: string[]): string | null {
  const inline = inlineAfterParenLabel(
    rawText,
    /\(IRS\s+Employer\s+Identification\s+No\.?\)/i,
  );
  if (inline && /^\d{2}-\d{7}$/.test(inline.trim())) return inline.trim();

  const next = lineAfterAnchor(lines, (ln) =>
    /\(IRS\s+Employer/i.test(ln),
  );
  if (next) {
    const m = next.match(/\b(\d{2}-\d{7})\b/);
    if (m) return m[1]!;
  }

  const loose = rawText.match(/\(E\.?I\.?N\.?\)|Employer\s+Identification[^)]*\)/i);
  if (loose) {
    const m = rawText.slice(loose.index!).match(/\b(\d{2}-\d{7})\b/);
    if (m) return m[1]!;
  }

  return null;
}

function extractCikStructured(rawText: string): string | null {
  const m = rawText.match(
    /\(Central\s+Index\s+Key\)\s*[:\s]*(\d{10})|\(\s*CIK\s*\)\s*[:\s]*(\d{10})|\bCIK\s*[:\s]+\s*(\d{10})\b/i,
  );
  const digits = (m?.[1] ?? m?.[2] ?? m?.[3] ?? '').replace(/\D/g, '');
  if (digits.length >= 10) return digits.padStart(10, '0').slice(-10);
  const loose = rawText.match(/\b(\d{10})\b/);
  if (loose?.[1]) {
    const idx = loose.index ?? rawText.indexOf(loose[0]!);
    const ctx = rawText.slice(Math.max(0, idx - 80), idx + 80);
    if (/Central\s+Index\s+Key|CIK/i.test(ctx))
      return loose[1].padStart(10, '0');
  }
  return null;
}

/** Lines between `(Mark One)` / form title and first Item / securities table — checkbox UI only. */
function checkboxSectionBounds(lines: string[]): { start: number; end: number } {
  let start = 0;
  for (let i = 0; i < lines.length; i++) {
    if (
      /\(Mark\s+One\)/i.test(lines[i]!) ||
      /^FORM\s+[0-9-KQ]+/i.test(lines[i]!.trim())
    ) {
      start = i;
      break;
    }
  }
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (
      /^Item\s+\d+\.\d+/i.test(lines[i]!.trim()) ||
      /Title\s+of\s+each\s+class/i.test(lines[i]!)
    ) {
      end = i;
      break;
    }
  }
  return { start, end };
}

function extractCheckboxesFromRegion(lines: string[]): FilingCheckbox[] {
  const { start, end } = checkboxSectionBounds(lines);
  const region = lines.slice(start, end).join('\n');
  const out: FilingCheckbox[] = [];
  let i = 0;
  for (const line of region.split(/\n/)) {
    const t = line.trim();
    const box = /^(☐|☑|✓|\[ ?x?\]|□)\s*(.+)$/i.exec(t);
    if (box) {
      const checked = /☑|✓|\[x\]/i.test(box[1]!);
      out.push({
        id: `cb_${i++}`,
        label: box[2]!.trim(),
        checked,
      });
    }
  }
  return out;
}

const CHECKBOX_LINE =
  /^(☐|☑|✓|\[ ?x?\]|□)\s*|Written\s+communications\s+pursuant\s+to\s+Rule/i;

/** Lines under “Title of each class” / Section 12(b) tables. */
function extractSecuritiesTable(lines: string[]): FilingSecurityRow[] {
  const rows: FilingSecurityRow[] = [];
  let inTable = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (/Title\s+of\s+each\s+class/i.test(line)) {
      inTable = true;
      continue;
    }
    if (/Securities\s+registered\s+pursuant\s+to\s+Section\s+12\(g\)/i.test(line))
      break;
    if (!inTable || line.length < 3) continue;
    if (/^Name\s+of\s+each\s+exchange/i.test(line)) continue;

    const cells = line.split(/\t|\s{2,}/).map((c) => c.trim()).filter(Boolean);
    if (cells.length >= 2) {
      rows.push({
        title_class: cells[0] ?? null,
        trading_symbol: cells[1] ?? null,
        exchange: cells[2] ?? null,
        registration_status: cells[3] ?? null,
      });
    } else if (cells[0] && /^[A-Z]{1,5}(?:\.[A-Z])?$/.test(cells[0]) && rows.length > 0) {
      rows[rows.length - 1]!.trading_symbol = cells[0];
    }
  }
  return rows;
}

function extractAddressContactNotes(
  lines: string[],
  checkboxLabels: Set<string>,
): { address: string | null; contact_info: string | null; notes: string | null } {
  const addrIdx = lines.findIndex((l) =>
    /\(Address\s+of\s+principal\s+executive\s+offices/i.test(l),
  );
  if (addrIdx < 0)
    return { address: null, contact_info: null, notes: null };

  const buf: string[] = [];
  const contact: string[] = [];
  const notes: string[] = [];

  for (let i = addrIdx; i < Math.min(lines.length, addrIdx + 25); i++) {
    const raw = lines[i]!.trim();
    if (!raw) continue;
    if (CHECKBOX_LINE.test(raw)) continue;
    if (checkboxLabels.has(raw.slice(0, 120))) continue;
    if (/Check\s+the\s+appropriate\s+box/i.test(raw)) break;
    if (/^ITEM\s+\d+\.\d+/i.test(raw)) break;

    if (
      /Telephone|Phone|Area\s+Code|Fax|E-mail|Email/i.test(raw) ||
      /\(\d{3}\)\s*[\d-]{7,}/.test(raw)
    ) {
      contact.push(raw);
      continue;
    }
    if (
      /\(Former\s+Name|Changed\s+Since\s+Last\s+Report\)/i.test(raw) ||
      /Check\s+the\s+appropriate/i.test(raw)
    ) {
      notes.push(raw);
      continue;
    }
    if (
      /\(Zip\s+Code\)/i.test(raw) ||
      /^[A-Za-z][A-Za-z\s,]+,?\s+[A-Z]{2}\s+\d{5}(-\d{4})?$/.test(raw)
    ) {
      buf.push(raw);
      continue;
    }
    if (buf.length > 0 && buf.length < 6 && !/Rule\s+\d+/i.test(raw))
      buf.push(raw);
  }

  const address = buf.length ? buf.join('\n').trim() : null;
  const contact_info = contact.length ? contact.join('\n').trim() : null;
  const other = notes.length ? notes.join('\n').trim() : null;

  return {
    address,
    contact_info,
    notes: other,
  };
}

/**
 * Deterministic SEC-style header parse (no NLP). Anchored fields — no concatenated junk strings.
 */
export function parseFilingHeader(rawText: string): FilingHeaderStructured {
  const lines = rawText.split(/\n/).map((l) => l.replace(/\r$/, '').trimEnd());

  let form_type: string | null = null;
  const fm = rawText.match(FORM_LINE);
  if (fm) form_type = fm[1]!.toUpperCase();

  let filing_date_iso: string | null = null;
  const dt = rawText.match(DATE_LINE);
  if (dt) filing_date_iso = parseIsoishDate(dt[1]);

  let companyName = extractCompanyNameStructured(rawText, lines);
  let jurisdiction = extractJurisdictionStructured(rawText, lines);
  let file_number =
    extractCommissionFileNumber(rawText, lines);
  let irs_employer_id = extractIrsEin(rawText, lines);
  let cik = extractCikStructured(rawText);

  const checkboxes = extractCheckboxesFromRegion(lines);
  const checkboxLabelSet = new Set(checkboxes.map((c) => c.label.slice(0, 120)));

  const { address, contact_info, notes } = extractAddressContactNotes(
    lines,
    checkboxLabelSet,
  );

  // Repair packed single-line corruption (state + file + EIN + CIK).
  for (const ln of lines) {
    if (!companyName && /Exact\s+name\s+of\s+registrant/i.test(ln)) continue;
    const packed = unpackPackedMetadataLine(ln);
    if (!jurisdiction && packed.jurisdiction) jurisdiction = packed.jurisdiction;
    if (!file_number && packed.file_number) file_number = packed.file_number;
    if (!irs_employer_id && packed.ein) irs_employer_id = packed.ein;
    if (!cik && packed.cik) cik = packed.cik;
  }

  if (companyName && /^\d/.test(companyName)) companyName = null;

  const filing_info: FilingInfo = {
    form_type,
    filing_date_iso,
  };

  return {
    metadata: {
      commission_form_version: null,
    },
    company: {
      name: sanitizeCompanyName(companyName),
      jurisdiction,
      commission_file_number: file_number,
      cik,
      irs_employer_id,
    },
    filing_info,
    securities: extractSecuritiesTable(lines),
    checkboxes,
    address,
    contact_info,
    other_filing_notes: notes,
  };
}
