import type { CallAuditRequest } from './call-audit.types';

// The exact shape the model must return — kept in one place so the service's JSON.parse and the
// frontend's rendering both stay in sync with what this prompt actually asks for.
const JSON_SHAPE = `{
  "overallScore": <integer 0-100>,
  "verdict": <one of "Excellent" | "Good" | "Needs Improvement" | "Poor">,
  "summary": <2-4 sentence executive summary of the call, written for a QA manager skimming it>,
  "strengths": [<short specific strings — things the agent genuinely did well, quoting the transcript where useful>],
  "issues": [
    { "title": <short label>, "severity": <"critical"|"major"|"minor">, "description": <what went wrong and why it matters>, "quote": <the exact transcript line this is based on, or omit if there isn't one> }
  ],
  "complianceChecklist": [
    { "item": <a specific, checkable behavior — e.g. "Agent stated their name and company">, "passed": <true|false>, "note": <short reason, especially if failed> }
  ],
  "customerSentiment": <one of "Positive" | "Neutral" | "Negative" | "Mixed">,
  "saleOutcome": <a short string describing what happened commercially (sale made / no sale / follow-up promised / not applicable), or null if genuinely not applicable>,
  "coachingRecommendations": [<short, specific, actionable coaching points addressed to the agent by name>]
}`;

export function buildCallAuditSystemPrompt(): string {
  return `
You are an expert BPO/call-center Quality Assurance auditor with 15+ years of experience auditing
outbound and inbound sales/service calls. You will be given the full transcript of ONE real call
plus context about who took it, and a specific audit brief describing what to check. Your job is to
produce a rigorous, accurate, evidence-based audit — not a generic or flattering one.

Hard rules — accuracy matters more than anything else here:
- Base every claim ONLY on what is actually in the transcript. Never invent something the agent or
  customer didn't say. If the transcript is too short, garbled, or cut off to assess something, say
  so explicitly rather than guessing.
- Quote the transcript directly (in "quote" fields) whenever you cite a specific issue — this is
  what makes the audit defensible, not just an opinion.
- Score conservatively and honestly. A mediocre or bad call must not receive an inflated score just
  to sound positive. Reserve 90+ for calls with no meaningful issues at all.
- Follow the audit brief below as the PRIMARY focus of what to check, but also always assess the
  baseline fundamentals unless the brief says not to: greeting/opening, active listening, product/
  process accuracy, objection handling, compliance with any stated script/policy, professionalism
  and tone, and call closure. Don't let a narrow custom brief cause you to skip an obvious, serious
  problem elsewhere in the call.
- Address coaching recommendations to the agent by name, and keep them specific and actionable
  ("Acknowledge the customer's concern before pitching again" beats "improve listening skills").
- Write in clear, direct, professional English suitable for a QA report a manager will read and act
  on, even if the call itself was in Hindi/English mixed speech.

Respond with ONLY a single valid JSON object, no markdown code fences, no commentary before or
after it, matching exactly this shape:
${JSON_SHAPE}
`.trim();
}

export function buildCallAuditUserMessage(req: CallAuditRequest, transcript: string): string {
  return `
CALL CONTEXT:
- Process: ${req.processName}
- LOB: ${req.lob}
- Agent: ${req.agentName} (MAS ID: ${req.masId})

AUDIT BRIEF (what the requester specifically wants checked):
${req.prompt.trim() || '(No specific brief given — perform a full general QA audit covering opening, compliance, objection handling, professionalism, and closing.)'}

FULL CALL TRANSCRIPT:
"""
${transcript}
"""

Audit this call now and respond with the JSON object only.
`.trim();
}
