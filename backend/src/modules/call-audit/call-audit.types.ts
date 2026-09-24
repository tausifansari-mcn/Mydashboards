export interface CallAuditRequest {
  recordingUrl: string;
  processName: string;
  lob: string;
  agentName: string;
  masId: string;
  prompt: string;
}

export interface CallAuditIssue {
  title: string;
  severity: 'critical' | 'major' | 'minor';
  description: string;
  quote?: string;
}

export interface CallAuditChecklistItem {
  item: string;
  passed: boolean;
  note?: string;
}

// The shape the AI is instructed to return (call-audit.prompts.ts) and that the frontend renders
// as cards/badges — fixed and structured on purpose, per the "very accurate and best, attractive
// summary view" ask, rather than freeform markdown the UI would have to guess how to lay out.
export interface CallAuditResult {
  overallScore: number;
  verdict: 'Excellent' | 'Good' | 'Needs Improvement' | 'Poor';
  summary: string;
  strengths: string[];
  issues: CallAuditIssue[];
  complianceChecklist: CallAuditChecklistItem[];
  customerSentiment: 'Positive' | 'Neutral' | 'Negative' | 'Mixed';
  saleOutcome: string | null;
  coachingRecommendations: string[];
}

export interface CallAuditRecord extends CallAuditRequest {
  id: number;
  transcript: string;
  result: CallAuditResult;
  model: string;
  createdByEmail: string;
  createdAt: string;
}
