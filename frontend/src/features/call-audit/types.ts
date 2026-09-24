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

export interface CallAuditRecord {
  id: number;
  recordingUrl: string;
  processName: string;
  lob: string;
  agentName: string;
  masId: string;
  prompt: string;
  transcript: string;
  result: CallAuditResult;
  model: string;
  createdByEmail: string;
  createdAt: string;
}

export type CallAuditHistoryItem = Omit<CallAuditRecord, 'transcript' | 'result'> & {
  overallScore: number | null;
  verdict: string | null;
};

export interface CallAuditFormValues {
  recordingUrl: string;
  processName: string;
  lob: string;
  agentName: string;
  masId: string;
  prompt: string;
}
