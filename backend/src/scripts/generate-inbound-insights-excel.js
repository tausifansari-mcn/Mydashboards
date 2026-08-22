const XLSX = require('xlsx');
const path = require('path');

const rows = [
  // ── Headers ──
  ['Process Name', 'LOB', 'Insight Name', 'What It Detects', 'Recommended Action', 'TAT (Turnaround Time)', 'Priority', 'Responsible Team'],

  // ── CQ Score (Quality Performance) ──
  ['AI Quality Inbound', 'Inbound', 'CQ Score Below Target (<85%)', 'Overall quality score falling below acceptable threshold across 19 call parameters', 'Conduct immediate 1:1 coaching session with low-scoring agents. Review call recordings for specific parameter failures. Create targeted training plan for weak parameters.', '24 hours', 'High', 'QA Team + Team Lead'],
  ['AI Quality Inbound', 'Inbound', 'CQ Score Declining Trend (3+ days)', 'Quality score showing consecutive day-over-day decline', 'Escalate to Operations Manager. Analyze if new batch of agents joined. Schedule team-wide refresher training on weak parameters.', '48 hours', 'High', 'Operations Manager'],
  ['AI Quality Inbound', 'Inbound', 'Opening Skill <90%', 'Agents failing greeting protocol — not answering within 5 seconds or missing professional opening', 'Retrain agents on standard opening script. Add opening skill checklist to QA scorecard. Monitor first 5 calls of each agent daily.', '24 hours', 'High', 'Team Lead + QA'],
  ['AI Quality Inbound', 'Inbound', 'Soft Skill <90%', 'Poor empathy, professionalism, active listening, or politeness detected', 'Schedule soft-skill workshop. Share positive call examples. Implement peer mentoring for low-scoring agents.', '48 hours', 'High', 'Training Team'],
  ['AI Quality Inbound', 'Inbound', 'Hold Procedure <90%', 'Agents not following proper hold protocol — transferring without consent or leaving customer on hold too long', 'Retrain on hold/transfer SOP. Add hold procedure checklist. Monitor hold duration per agent.', '24 hours', 'Medium', 'Team Lead'],
  ['AI Quality Inbound', 'Inbound', 'Resolution <90%', 'Calls ending without proper issue resolution or correct information provided', 'Review unresolved case patterns. Create knowledge base for common issues. Implement post-call verification step.', '48 hours', 'High', 'QA Team + Training'],
  ['AI Quality Inbound', 'Inbound', 'Closing <90%', 'Poor call closure — not offering further assistance, skipping summary, or unprofessional goodbye', 'Retrain on proper closing checklist. Share closing best practices. Audit last 2 minutes of calls.', '24 hours', 'Medium', 'Team Lead'],
  ['AI Quality Inbound', 'Inbound', 'Dead Air >10 Seconds', 'Extended silence during calls indicating agent hesitation or lack of product knowledge', 'Identify product/FAQ gaps causing hesitation. Provide quick-reference cards to agents. Implement whisper coaching for live calls.', '24 hours', 'Medium', 'Team Lead + Training'],
  ['AI Quality Inbound', 'Inbound', 'Upselling/Offer Suggestion Low', 'Agents not suggesting offers or upselling opportunities during calls', 'Share upselling playbook. Conduct role-play sessions for offer presentations. Track offer mention rate per agent.', '48 hours', 'Low', 'Team Lead'],

  // ── Fatal Analysis ──
  ['AI Quality Inbound', 'Inbound', 'Fatal Calls (CQ Score = 0)', 'Calls with zero quality score — all 19 parameters failed, indicating complete process breakdown', 'IMMEDIATE intervention required. Review call recording with agent within 24 hours. Document root cause. Assign mandatory retraining. Flag agent for monitoring.', '4 hours', 'Critical', 'QA Manager + Operations'],
  ['AI Quality Inbound', 'Inbound', 'Fatal Rate >5%', 'Percentage of fatal calls exceeding acceptable threshold', 'Emergency team meeting. Analyze if specific scenario or shift is causing cluster of fatals. Consider temporary staffing changes.', '8 hours', 'Critical', 'Operations Manager'],
  ['AI Quality Inbound', 'Inbound', 'Query Fatal Calls', 'Fatal calls originating from customer query/query handling scenario', 'Review query-handling SOP. Create decision trees for common queries. Implement supervisor review for complex queries.', '24 hours', 'High', 'QA Team + Training'],
  ['AI Quality Inbound', 'Inbound', 'Complaint Fatal Calls', 'Fatal calls from complaint resolution scenario — customer complaint not addressed at all', 'Escalate to complaint resolution team. Review complaint handling matrix. Implement complaint call quality checklist.', '12 hours', 'Critical', 'Complaint Manager + QA'],
  ['AI Quality Inbound', 'Inbound', 'Request Fatal Calls', 'Fatal calls from service request scenario — request not processed or acknowledged', 'Review request handling workflow. Create request processing checklist. Implement confirmation step before call close.', '24 hours', 'High', 'Team Lead + QA'],
  ['AI Quality Inbound', 'Inbound', 'Sale Done Fatal Calls', 'Fatal calls where sale was completed but quality was zero — potential compliance risk', 'IMMEDIATE compliance review. Verify order details accuracy. Check for potential fraud or mis-selling. Document and escalate.', '4 hours', 'Critical', 'Compliance + QA Manager'],
  ['AI Quality Inbound', 'Inbound', 'Fatal Cluster by Agent', 'Single agent contributing disproportionate number of fatal calls', 'Personal performance improvement plan (PIP). Daily call monitoring for 2 weeks. Assign mentor/coach.', '24 hours', 'Critical', 'Operations Manager'],

  // ── Potential Scam ──
  ['AI Quality Inbound', 'Inbound', 'Financial Fraud Detected', 'AI detected financial fraud indicators in call — agent may be involved in unauthorized transactions', 'IMMEDIATE suspension of agent pending investigation. Lock agent credentials. Escalate to compliance and security team. File internal incident report.', '2 hours', 'Critical', 'Compliance + Security'],
  ['AI Quality Inbound', 'Inbound', 'Scam Words Detected', 'Call contained scam/fraud-related keywords suggesting potential fraudulent activity', 'Review call transcript immediately. If agent-initiated, escalate to compliance. If customer-reported, log for fraud investigation team.', '4 hours', 'Critical', 'Fraud Investigation Team'],
  ['AI Quality Inbound', 'Inbound', 'Scam Spike (>2x baseline)', 'Sudden increase in scam-flagged calls above normal baseline', 'Security team alert. Audit all calls from suspected agents. Review access logs for suspicious activity. Consider temporary call monitoring.', '2 hours', 'Critical', 'Security + Compliance'],
  ['AI Quality Inbound', 'Inbound', 'Social Media Threat', 'Customer threatening to post negative reviews on social media or damage brand reputation', 'Acknowledge customer concern immediately. Offer resolution/replacement. Document threat and resolution. Escalate to social media monitoring team.', '1 hour', 'High', 'Customer Experience + Social Media Team'],
  ['AI Quality Inbound', 'Inbound', 'Consumer Court Threat', 'Customer mentioning legal action, consumer forum, or lawyer involvement', 'IMMEDIATE escalation to legal/compliance team. Document exact customer statement. Initiate goodwill resolution process. Do NOT make promises without approval.', '2 hours', 'Critical', 'Legal + Compliance'],
  ['AI Quality Inbound', 'Inbound', 'Police Complaint Threat', 'Customer threatening police complaint or FIR', 'Escalate immediately to senior management. Document exact words used. Initiate high-priority resolution. Prepare case file with call recording.', '1 hour', 'Critical', 'Senior Management + Legal'],

  // ── Critical Signals (Negative Sentiment) ──
  ['AI Quality Inbound', 'Inbound', 'Threat Category Signals', 'Customer expressing threats — legal action, social media exposure, fraud accusations, police complaints', 'Prioritize call back within 1 hour. Assign to senior agent. Document all threats. Initiate proactive resolution. Log for compliance tracking.', '1 hour', 'Critical', 'Team Lead + Compliance'],
  ['AI Quality Inbound', 'Inbound', 'Frustration Category Signals', 'Customer showing frustration — delays, repeated issues, dissatisfaction with resolution', 'Immediate callback with senior agent. Offer concrete resolution with timeline. Follow up within 24 hours to confirm satisfaction.', '4 hours', 'High', 'Team Lead'],
  ['AI Quality Inbound', 'Inbound', 'Abuse Category Signals', 'Customer using abusive language or reporting agent misbehavior', 'Record incident. Review call for context. If agent provoked, counsel agent immediately. If customer is abusive, follow de-escalation protocol.', '2 hours', 'High', 'QA Manager'],
  ['AI Quality Inbound', 'Inbound', 'Agent Abuse Detected', 'Agent detected using abusive, rude, or unprofessional language toward customer', 'IMMEDIATE agent suspension from calls. Review call recording. Issue formal warning. Mandatory behavioral training.', '2 hours', 'Critical', 'HR + QA Manager'],
  ['AI Quality Inbound', 'Inbound', 'Sarcasm/Slang Signals', 'Customer using sarcastic or slang expressions indicating loss of patience', 'Review call handling approach. Agent may need coaching on maintaining professionalism under pressure.', '24 hours', 'Medium', 'Team Lead'],

  // ── Fraud & Data Security Compliance ──
  ['AI Quality Inbound', 'Inbound', 'Data Security Breach Risk', 'Agent sharing or requesting sensitive customer data (payment info, Aadhaar, passwords) outside approved process', 'IMMEDIATE investigation. Review agent access logs. Check for data exfiltration. Escalate to DPO and CISO.', '1 hour', 'Critical', 'DPO + CISO + HR'],
  ['AI Quality Inbound', 'Inbound', 'Unauthorized Recording/Screen Capture', 'Agent potentially recording calls or capturing screen without consent or authorization', 'Investigate device access logs. Review agent workstation activity. Enforce data handling policies.', '4 hours', 'Critical', 'IT Security + HR'],
  ['AI Quality Inbound', 'Inbound', 'Payment Information Mishandling', 'Agent handling payment/card details outside PCI-DSS compliant process', 'Halt agent payment processing access immediately. Retrain on PCI-DSS compliance. Audit recent payment-handling calls.', '2 hours', 'Critical', 'Compliance + Finance'],
  ['AI Quality Inbound', 'Inbound', 'Customer PII Leak Risk', 'Potential exposure of personally identifiable information during call handling', 'Review call recording and screen captures. Check for shared personal data. Implement additional data masking controls.', '4 hours', 'High', 'DPO + IT Security'],
  ['AI Quality Inbound', 'Inbound', 'Social Engineering Attempt', 'Caller attempting to extract information or manipulate agent into bypassing security', 'Flag caller profile. Alert security team. Add to watchlist. Retrain agent on social engineering red flags.', '2 hours', 'Critical', 'Security Team'],

  // ── CLAP Analysis ──
  ['AI Quality Inbound', 'Inbound', 'Customer CLAP Negative Spike', 'Sudden increase in negative customer feedback across CLAP branches', 'Analyze root cause by branch and scenario. Share customer voice with product/logistics teams. Create action items for resolution.', '48 hours', 'High', 'CX Team + Product + Logistics'],
  ['AI Quality Inbound', 'Inbound', 'Logistic CLAP Complaints', 'High volume of logistics-related complaints (delivery delay, damaged, wrong product)', 'Coordinate with logistics partner. Implement delivery quality tracking. Escalate chronic issue patterns to operations.', '48 hours', 'High', 'Logistics + Operations'],
  ['AI Quality Inbound', 'Inbound', 'Agent Behavior CLAP Issues', 'Negative feedback about agent behavior — attitude, communication, unhelpfulness', 'Review agent call quality. Conduct behavioral coaching. Implement customer satisfaction feedback loop.', '24 hours', 'High', 'Team Lead + Training'],
  ['AI Quality Inbound', 'Inbound', 'Product CLAP Negative Trend', 'Increasing negative feedback about product quality, features, or expectations mismatch', 'Share product feedback report with product team. Identify top complaint categories. Feed into product improvement cycle.', '72 hours', 'Medium', 'Product Team + CX'],
  ['AI Quality Inbound', 'Inbound', 'CLAP Positive Quote Opportunity', 'Positive customer feedback that can be leveraged for testimonials or training', 'Share positive quotes with agents for motivation. Use as training examples. Consider for marketing (with consent).', '1 week', 'Low', 'Marketing + Training'],

  // ── TNI Detection (incl. Agent Guidance) ──
  ['AI Quality Inbound', 'Inbound', 'TNI Score <70', 'Training Need Index below threshold — agent lacks required soft skills, process knowledge, or communication', 'Mandatory remedial training program. Create personalized learning path. Daily monitoring for 30 days.', '24 hours', 'High', 'Training Team'],
  ['AI Quality Inbound', 'Inbound', 'Soft Skills Below Team Average', 'Agent soft skills score significantly below team average — empathy, active listening, tone', 'Assign soft-skill coach. Role-play exercises. Customer empathy workshops. Monitor via call scoring.', '48 hours', 'High', 'Training Team'],
  ['AI Quality Inbound', 'Inbound', 'Process Knowledge Gap', 'Agent lacking product/process knowledge — incorrect information, incomplete resolution', 'Product knowledge assessment. Create quick-reference guides. Buddy system with experienced agent for 1 week.', '24 hours', 'High', 'Training + Product Team'],
  ['AI Quality Inbound', 'Inbound', 'Communication Score Drop', 'Agent communication skills declining — grammar, clarity, pronunciation issues', 'Language and communication workshop. Pronunciation practice sessions. Written/verbal communication drills.', '48 hours', 'Medium', 'Training Team'],
  ['AI Quality Inbound', 'Inbound', 'TNI Agent Declining Trend (3+ weeks)', 'Agent TNI scores declining over consecutive weeks — deteriorating performance', 'Formal performance improvement plan (PIP). Weekly review meetings with manager. Consider reassignment if no improvement in 30 days.', '24 hours', 'Critical', 'Operations Manager + HR'],
  ['AI Quality Inbound', 'Inbound', 'Agent Parameter Focus — Worst Parameter', 'Specific CQ parameter consistently failing for an agent (e.g., always failing "hold procedure")', 'Targeted micro-training on that specific parameter. Watch 5 recent calls for that parameter. Set improvement goal.', '24 hours', 'High', 'Team Lead'],
  ['AI Quality Inbound', 'Inbound', 'Team Average Parameter Drop', 'Team-wide drop in a specific CQ parameter score', 'Identify root cause (process change, new campaign, system issue). Conduct team-wide refresher on that parameter.', '48 hours', 'High', 'Training + Operations'],

  // ── Repeat Analysis ──
  ['AI Quality Inbound', 'Inbound', 'High Repeat Call Rate', 'Customers calling back multiple times for same issue — indicates first-call resolution failure', 'Analyze top repeat call categories. Improve first-call resolution scripts. Implement call-back verification process.', '48 hours', 'High', 'Team Lead + QA'],
  ['AI Quality Inbound', 'Inbound', 'Repeat Call by Agent', 'Specific agent generating disproportionate repeat calls', 'Review agent resolution quality. Provide additional training on issue resolution. Implement call verification step.', '24 hours', 'High', 'Team Lead'],

  // ── Proof Collection Analysis (Bellavita) ──
  ['AI Quality Inbound', 'Inbound', 'Low Proof Collection Rate', 'Insufficient proof/evidence collected during calls for order verification or complaint resolution', 'Retrain agents on proof collection requirements. Create collection checklist. Implement mandatory proof verification.', '48 hours', 'High', 'Team Lead + QA'],
  ['AI Quality Inbound', 'Inbound', 'Missing Call Recording', 'Calls without proper recording or recording quality issues', 'Investigate recording system. Check agent compliance with recording requirements. Implement recording quality checks.', '24 hours', 'High', 'IT + QA'],

  // ── Video Phrase Analysis (Bellavita) ──
  ['AI Quality Inbound', 'Inbound', 'Video Phrase Non-Compliance', 'Agents not using required product video phrases during calls', 'Retrain on video phrase requirements. Implement phrase reminder tool. Daily monitoring of phrase usage rate.', '48 hours', 'Medium', 'Training + Team Lead'],
  ['AI Quality Inbound', 'Inbound', 'Video Phrase Usage Decline', 'Decreasing trend in required video phrase mentions over time', 'Share video phrase dashboard with agents. Incentivize proper usage. Conduct refresher on brand messaging.', '1 week', 'Medium', 'Training + Marketing'],

  // ── Fraud Call ──
  ['AI Quality Inbound', 'Inbound', 'Suspected Fraudulent Call', 'Call flagged as potentially fraudulent — fake identity, suspicious intent, scam indicators', 'Block caller if confirmed fraud. Report to fraud investigation team. Update fraud database. Review similar call patterns.', '2 hours', 'Critical', 'Fraud Team + Security'],
];

const wb = XLSX.utils.book_new();
const ws = XLSX.utils.aoa_to_sheet(rows);

// Set column widths
ws['!cols'] = [
  { wch: 22 },  // Process Name
  { wch: 12 },  // LOB
  { wch: 40 },  // Insight Name
  { wch: 65 },  // What It Detects
  { wch: 80 },  // Recommended Action
  { wch: 22 },  // TAT
  { wch: 12 },  // Priority
  { wch: 30 },  // Responsible Team
];

XLSX.utils.book_append_sheet(wb, ws, 'Actionable Insights');

const outPath = path.join(__dirname, '..', '..', 'Inbound_Quality_Actionable_Insights.xlsx');
XLSX.writeFile(wb, outPath);
console.log(`Excel created: ${outPath}`);
console.log(`Total rows: ${rows.length - 1} insights`);
