export interface InsightRow {
  category: string;
  name: string;
  detects: string;
  action: string;
  tat: string;
  priority: string;
  team: string;
}

export const INSIGHTS_DATA: InsightRow[] = [
  // Quality Performance
  { category: 'Quality Performance', name: 'CQ Score Below Target (<85%)', detects: 'Overall quality score below threshold across 19 parameters', action: '1:1 coaching, review recordings, targeted training', tat: '24h', priority: 'High', team: 'QA Team + Team Lead' },
  { category: 'Quality Performance', name: 'CQ Score Declining Trend', detects: 'Quality score declining 3+ consecutive days', action: 'Escalate to Ops Manager, schedule team refresher', tat: '48h', priority: 'High', team: 'Operations Manager' },
  { category: 'Quality Performance', name: 'Opening Skill <90%', detects: 'Agents failing greeting protocol within 5 seconds', action: 'Retrain on opening script, monitor first 5 calls daily', tat: '24h', priority: 'High', team: 'Team Lead + QA' },
  { category: 'Quality Performance', name: 'Soft Skill <90%', detects: 'Poor empathy, professionalism, active listening', action: 'Soft-skill workshop, peer mentoring', tat: '48h', priority: 'High', team: 'Training Team' },
  { category: 'Quality Performance', name: 'Hold Procedure <90%', detects: 'Not following hold/transfer protocol', action: 'Retrain on hold SOP, monitor hold duration', tat: '24h', priority: 'Medium', team: 'Team Lead' },
  { category: 'Quality Performance', name: 'Resolution <90%', detects: 'Calls ending without proper resolution', action: 'Create knowledge base, implement post-call verification', tat: '48h', priority: 'High', team: 'QA Team + Training' },
  { category: 'Quality Performance', name: 'Closing <90%', detects: 'Poor call closure, skipping summary', action: 'Retrain on closing checklist, audit last 2 min of calls', tat: '24h', priority: 'Medium', team: 'Team Lead' },
  { category: 'Quality Performance', name: 'Dead Air >10 Seconds', detects: 'Extended silence indicating agent hesitation', action: 'Provide quick-reference cards, whisper coaching', tat: '24h', priority: 'Medium', team: 'Team Lead + Training' },
  { category: 'Quality Performance', name: 'Upselling Low', detects: 'Agents not suggesting offers during calls', action: 'Share upselling playbook, role-play sessions', tat: '48h', priority: 'Low', team: 'Team Lead' },

  // Fatal Analysis
  { category: 'Fatal Analysis', name: 'Fatal Calls (CQ=0)', detects: 'Zero quality score, complete process breakdown', action: 'IMMEDIATE intervention, review recording within 24h, mandatory retraining', tat: '4h', priority: 'Critical', team: 'QA Manager + Operations' },
  { category: 'Fatal Analysis', name: 'Fatal Rate >5%', detects: 'Fatal calls exceeding acceptable threshold', action: 'Emergency team meeting, analyze scenario/shift clusters', tat: '8h', priority: 'Critical', team: 'Operations Manager' },
  { category: 'Fatal Analysis', name: 'Query Fatal', detects: 'Fatal calls from query handling scenario', action: 'Review query SOP, create decision trees', tat: '24h', priority: 'High', team: 'QA Team + Training' },
  { category: 'Fatal Analysis', name: 'Complaint Fatal', detects: 'Fatal calls from complaint resolution', action: 'Escalate to complaint team, implement quality checklist', tat: '12h', priority: 'Critical', team: 'Complaint Manager + QA' },
  { category: 'Fatal Analysis', name: 'Request Fatal', detects: 'Fatal calls from service request scenario', action: 'Review workflow, create processing checklist', tat: '24h', priority: 'High', team: 'Team Lead + QA' },
  { category: 'Fatal Analysis', name: 'Sale Done Fatal', detects: 'Sale completed with zero quality - compliance risk', action: 'IMMEDIATE compliance review, verify order accuracy', tat: '4h', priority: 'Critical', team: 'Compliance + QA Manager' },
  { category: 'Fatal Analysis', name: 'Fatal Cluster by Agent', detects: 'Single agent with disproportionate fatal calls', action: 'PIP, daily monitoring for 2 weeks, assign mentor', tat: '24h', priority: 'Critical', team: 'Operations Manager' },

  // Potential Scam
  { category: 'Potential Scam', name: 'Financial Fraud Detected', detects: 'AI detected financial fraud indicators', action: 'IMMEDIATE suspension, lock credentials, escalate to compliance', tat: '2h', priority: 'Critical', team: 'Compliance + Security' },
  { category: 'Potential Scam', name: 'Scam Words Detected', detects: 'Scam/fraud keywords in conversation', action: 'Review transcript immediately, escalate to compliance', tat: '4h', priority: 'Critical', team: 'Fraud Investigation Team' },
  { category: 'Potential Scam', name: 'Scam Spike (>2x baseline)', detects: 'Sudden increase in scam-flagged calls', action: 'Security alert, audit suspected agents, review access logs', tat: '2h', priority: 'Critical', team: 'Security + Compliance' },
  { category: 'Potential Scam', name: 'Social Media Threat', detects: 'Customer threatening negative social media posts', action: 'Acknowledge concern, offer resolution, escalate to social media team', tat: '1h', priority: 'High', team: 'CX + Social Media' },
  { category: 'Potential Scam', name: 'Consumer Court Threat', detects: 'Customer mentioning legal action or consumer forum', action: 'IMMEDIATE escalation to legal, document statement, goodwill resolution', tat: '2h', priority: 'Critical', team: 'Legal + Compliance' },
  { category: 'Potential Scam', name: 'Police Complaint Threat', detects: 'Customer threatening police complaint or FIR', action: 'Escalate to senior mgmt, document exact words, prepare case file', tat: '1h', priority: 'Critical', team: 'Senior Mgmt + Legal' },

  // Critical Signals
  { category: 'Critical Signals', name: 'Threat Category', detects: 'Customer expressing threats - legal, social media, police', action: 'Callback within 1h, assign senior agent, document threats', tat: '1h', priority: 'Critical', team: 'Team Lead + Compliance' },
  { category: 'Critical Signals', name: 'Frustration Category', detects: 'Customer showing frustration - delays, repeated issues', action: 'Immediate callback, concrete resolution with timeline', tat: '4h', priority: 'High', team: 'Team Lead' },
  { category: 'Critical Signals', name: 'Abuse Category', detects: 'Customer using abusive language or reporting misbehavior', action: 'Record incident, review context, de-escalation protocol', tat: '2h', priority: 'High', team: 'QA Manager' },
  { category: 'Critical Signals', name: 'Agent Abuse Detected', detects: 'Agent using abusive/rude language toward customer', action: 'IMMEDIATE suspension, review recording, formal warning', tat: '2h', priority: 'Critical', team: 'HR + QA Manager' },
  { category: 'Critical Signals', name: 'Sarcasm/Slang Signals', detects: 'Customer using sarcastic expressions indicating impatience', action: 'Review handling approach, professionalism coaching', tat: '24h', priority: 'Medium', team: 'Team Lead' },

  // Fraud & Data Security
  { category: 'Fraud & Data Security', name: 'Data Security Breach Risk', detects: 'Agent sharing/requesting sensitive data outside process', action: 'IMMEDIATE investigation, review access logs, escalate to DPO', tat: '1h', priority: 'Critical', team: 'DPO + CISO + HR' },
  { category: 'Fraud & Data Security', name: 'Unauthorized Recording', detects: 'Agent recording calls without consent', action: 'Investigate device logs, enforce data handling policies', tat: '4h', priority: 'Critical', team: 'IT Security + HR' },
  { category: 'Fraud & Data Security', name: 'Payment Info Mishandling', detects: 'Agent handling payment details outside PCI-DSS', action: 'Halt payment access, retrain on PCI-DSS, audit recent calls', tat: '2h', priority: 'Critical', team: 'Compliance + Finance' },
  { category: 'Fraud & Data Security', name: 'Customer PII Leak Risk', detects: 'Potential exposure of personal identifiable information', action: 'Review recording and screen captures, implement data masking', tat: '4h', priority: 'High', team: 'DPO + IT Security' },
  { category: 'Fraud & Data Security', name: 'Social Engineering Attempt', detects: 'Caller attempting to bypass security through manipulation', action: 'Flag caller profile, alert security, retrain agent', tat: '2h', priority: 'Critical', team: 'Security Team' },

  // CLAP Analysis
  { category: 'CLAP Analysis', name: 'Customer CLAP Negative Spike', detects: 'Sudden increase in negative customer feedback', action: 'Analyze root cause, share with product/logistics teams', tat: '48h', priority: 'High', team: 'CX Team + Product + Logistics' },
  { category: 'CLAP Analysis', name: 'Logistic CLAP Complaints', detects: 'High volume of delivery/damage/wrong product complaints', action: 'Coordinate with logistics partner, implement quality tracking', tat: '48h', priority: 'High', team: 'Logistics + Operations' },
  { category: 'CLAP Analysis', name: 'Agent Behavior CLAP Issues', detects: 'Negative feedback about agent attitude/communication', action: 'Review call quality, behavioral coaching', tat: '24h', priority: 'High', team: 'Team Lead + Training' },
  { category: 'CLAP Analysis', name: 'Product CLAP Negative Trend', detects: 'Increasing negative feedback about product quality', action: 'Share feedback report with product team, feed into improvement cycle', tat: '72h', priority: 'Medium', team: 'Product Team + CX' },

  // TNI Detection
  { category: 'TNI Detection', name: 'TNI Score <70', detects: 'Training Need Index below threshold', action: 'Mandatory remedial training, personalized learning path, 30-day monitoring', tat: '24h', priority: 'High', team: 'Training Team' },
  { category: 'TNI Detection', name: 'Soft Skills Below Average', detects: 'Agent soft skills below team average', action: 'Assign soft-skill coach, role-play exercises', tat: '48h', priority: 'High', team: 'Training Team' },
  { category: 'TNI Detection', name: 'Process Knowledge Gap', detects: 'Agent lacking product/process knowledge', action: 'Product knowledge assessment, buddy system for 1 week', tat: '24h', priority: 'High', team: 'Training + Product Team' },
  { category: 'TNI Detection', name: 'TNI Declining Trend', detects: 'Agent TNI scores declining over consecutive weeks', action: 'Formal PIP, weekly review meetings, consider reassignment', tat: '24h', priority: 'Critical', team: 'Operations Manager + HR' },
];
