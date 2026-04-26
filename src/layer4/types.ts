export type ClauseClassification = {
  clause_id: string;
  clause_type: string;
  risk_focus: string[];  // specific concerns to check in the next step
  skip: boolean;         // true when clause has no analyzable content
};

export type ClauseIssue = {
  issue: string;
  clause_id: string;
  clause_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  reason: string;
  recommendation: string;
  category:
    | 'missing_protection'
    | 'risky_term'
    | 'inconsistency'
    | 'vague_language'
    | 'asymmetric_obligation'
    | 'other';
};

export type PipelineLogEntry = {
  step: string;
  clause_id?: string;
  duration_ms: number;
  result: string;
};

export type IssueReport = {
  agreement_id: string;
  clause_count: number;
  total_issues: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  issues: ClauseIssue[];
  log: PipelineLogEntry[];
};
