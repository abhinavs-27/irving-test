/** Machine-parseable SEC cover page / header (8-K / 10-K style). */

export type FilingCheckbox = {
  id: string;
  label: string;
  checked: boolean;
};

export type FilingSecurityRow = {
  title_class: string | null;
  trading_symbol: string | null;
  exchange: string | null;
  registration_status: string | null;
};

/** Registrant identity — no concatenated EDGAR blobs; each field stands alone. */
export type FilingCompany = {
  name: string | null;
  jurisdiction: string | null;
  commission_file_number: string | null;
  cik: string | null;
  irs_employer_id: string | null;
};

export type FilingMetadata = {
  commission_form_version: string | null;
};

/** Filing instrument metadata only (not registrant registry numbers — those live under `company`). */
export type FilingInfo = {
  form_type: string | null;
  filing_date_iso: string | null;
};

export type FilingHeaderStructured = {
  metadata: FilingMetadata;
  company: FilingCompany;
  filing_info: FilingInfo;
  securities: FilingSecurityRow[];
  checkboxes: FilingCheckbox[];
  address: string | null;
  contact_info: string | null;
  other_filing_notes: string | null;
};
