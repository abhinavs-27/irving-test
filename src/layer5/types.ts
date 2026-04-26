import type { ClauseIssue } from '../layer4/types.js';

export type GoldIssue = {
  issue: string;
  clause_id?: string;
  severity?: ClauseIssue['severity'];
  category?: ClauseIssue['category'];
  notes?: string;
};

export type GoldDataset = {
  description: string;
  agreement_id: string;
  notes?: string;
  issues: GoldIssue[];
};

export type MatchResult = {
  gold: GoldIssue;
  predicted: ClauseIssue | null;  // null = missed (false negative)
  score: number;                   // 0–1 similarity score
  severity_match: boolean | null;  // null when gold has no severity
};

export type EvalResult = {
  gold_dataset: GoldDataset;
  matches: MatchResult[];
  false_positives: ClauseIssue[];  // predicted with no gold match
  threshold: number;
};
