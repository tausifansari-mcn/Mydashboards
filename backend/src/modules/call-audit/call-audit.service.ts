import { getAIProvider } from '../ai-bot/ai-bot.provider';
import { getActiveDeepgramKey } from '../../lib/deepgramSettings';
import { buildCallAuditSystemPrompt, buildCallAuditUserMessage } from './call-audit.prompts';
import * as repo from './call-audit.repository';
import type { CallAuditRequest, CallAuditResult, CallAuditRecord } from './call-audit.types';

const MAX_AUDIO_BYTES = 30 * 1024 * 1024; // 30MB — comfortably covers a long call at typical compressed bitrates
const DOWNLOAD_TIMEOUT_MS = 60_000;
const TRANSCRIBE_TIMEOUT_MS = 120_000;

// Node's fetch wraps every underlying network failure (ECONNREFUSED, DNS failure, TLS error, etc.)
// in a generic "fetch failed" TypeError with the real reason nested one level down in `.cause` —
// surfacing only `err.message` here would tell an admin nothing when this service is unreachable.
function describeFetchError(err: unknown): string {
  if (err instanceof Error) {
    const cause = (err as { cause?: unknown }).cause;
    const causeMsg = cause instanceof Error ? cause.message : (typeof cause === 'string' ? cause : undefined);
    return causeMsg ? `${err.message}: ${causeMsg}` : err.message;
  }
  return String(err);
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// Deepgram is used for speech-to-text instead of the CAM BOT provider's Whisper endpoint (Anthropic
// has no audio support anyway, and Deepgram's nova-3 is a better fit for long Hindi/Hinglish calls).
// The key is never hardcoded here — it's read live from deepgramSettings.ts (DB-stored via the
// Profile page, falling back to .env's DEEPGRAM_API_KEY), same pattern as CAM BOT's own AI key, so
// it can be rotated from the portal without a code change or redeploy.
// language=multi enables Deepgram's code-switching mode — these calls are routinely Hindi/English
// mixed mid-sentence ("Very good afternoon, main Bellavita se bol rahi hoon"), and nova-3 with a
// single fixed language would either garble or silently drop the non-English portions.
const DEEPGRAM_STT_URL = 'https://api.deepgram.com/v1/listen?language=multi&model=nova-3';

export async function transcribeRecording(recordingUrl: string): Promise<string> {
  const deepgramApiKey = getActiveDeepgramKey();
  if (!deepgramApiKey) {
    throw new Error('Deepgram is not configured — set a Deepgram API key from the Profile page (Call Audit Transcription Key) before running an audit.');
  }

  let audioResp: Response;
  try {
    audioResp = await fetchWithTimeout(recordingUrl, { method: 'GET' }, DOWNLOAD_TIMEOUT_MS);
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError';
    throw new Error(aborted ? 'Timed out downloading the recording — check the URL is reachable.' : `Could not reach the recording URL: ${describeFetchError(err)}`);
  }
  if (!audioResp.ok) {
    throw new Error(`Could not download the recording (HTTP ${audioResp.status}). Check the URL is correct and publicly reachable from this server.`);
  }
  const contentType = audioResp.headers.get('content-type') || 'audio/mpeg';
  const buf = Buffer.from(await audioResp.arrayBuffer());
  if (buf.length === 0) throw new Error('The recording URL returned an empty file.');
  if (buf.length > MAX_AUDIO_BYTES) {
    throw new Error(`Recording is too large (${(buf.length / 1e6).toFixed(1)}MB) — max supported is ${MAX_AUDIO_BYTES / 1e6}MB.`);
  }

  let sttResp: Response;
  try {
    sttResp = await fetchWithTimeout(DEEPGRAM_STT_URL, {
      method: 'POST',
      headers: {
        authorization: `Token ${deepgramApiKey}`,
        'content-type': contentType,
      },
      body: buf,
    }, TRANSCRIBE_TIMEOUT_MS);
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError';
    throw new Error(aborted ? 'Transcription timed out — the recording may be too long or the service is slow right now.' : `Transcription request failed: ${describeFetchError(err)}`);
  }
  if (!sttResp.ok) {
    const body = await sttResp.text().catch(() => '');
    throw new Error(`Transcription service error ${sttResp.status}: ${body.slice(0, 300)}`);
  }
  // Deepgram shape: { results: { channels: [{ alternatives: [{ transcript }] }] } }
  const data = await sttResp.json().catch(() => null) as { results?: { channels?: { alternatives?: { transcript?: string }[] }[] } } | null;
  const text = data?.results?.channels?.[0]?.alternatives?.[0]?.transcript?.trim();
  if (!text) throw new Error('Transcription returned no text — the recording may be silent, corrupted, or in an unsupported format.');
  return text;
}

function parseAuditResult(raw: string): CallAuditResult {
  // Models occasionally wrap JSON in a markdown fence despite being told not to — strip it before
  // parsing rather than failing the whole audit over formatting.
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    // Logged server-side only (never shown to the user) — without this, "did not return valid
    // audit data" gives no way to tell a genuinely malformed response apart from a model that
    // ignored the JSON-only instruction and wrote prose instead.
    console.error('[call-audit] JSON.parse failed on model output:', err instanceof Error ? err.message : err, '\nRaw (first 500 chars):', raw.slice(0, 500));
    throw new Error('The AI did not return valid audit data. Please try running the audit again.');
  }
  const p = parsed as Partial<CallAuditResult>;
  if (typeof p.overallScore !== 'number' || typeof p.summary !== 'string') {
    console.error('[call-audit] Parsed JSON missing required fields. Parsed:', JSON.stringify(parsed).slice(0, 500));
    throw new Error('The AI response was missing required audit fields. Please try running the audit again.');
  }
  return {
    overallScore: Math.max(0, Math.min(100, Math.round(p.overallScore))),
    verdict: p.verdict ?? 'Needs Improvement',
    summary: p.summary,
    strengths: Array.isArray(p.strengths) ? p.strengths.filter(s => typeof s === 'string') : [],
    issues: Array.isArray(p.issues) ? p.issues.filter(i => i && typeof i.title === 'string') : [],
    complianceChecklist: Array.isArray(p.complianceChecklist) ? p.complianceChecklist.filter(c => c && typeof c.item === 'string') : [],
    customerSentiment: p.customerSentiment ?? 'Neutral',
    saleOutcome: p.saleOutcome ?? null,
    coachingRecommendations: Array.isArray(p.coachingRecommendations) ? p.coachingRecommendations.filter(s => typeof s === 'string') : [],
  };
}

export async function runCallAudit(userId: number, userEmail: string, req: CallAuditRequest): Promise<CallAuditRecord> {
  const transcript = await transcribeRecording(req.recordingUrl);

  const provider = getAIProvider();
  if (!provider.enabled) {
    throw new Error('No AI provider is configured — set one up from the Profile page before running an audit.');
  }
  const system = buildCallAuditSystemPrompt();
  const userMessage = buildCallAuditUserMessage(req, transcript);
  // Bug fix: chat() defaults to CAM BOT's tool-calling setup (its data-query tools passed in, 1500
  // token cap) — wrong on both counts here. Call Audit has no handler for a tool_use it can't
  // execute (this would previously either strand the turn or return empty text), and the requested
  // JSON (score, issues, checklist, coaching notes, quoted transcript lines) routinely needs more
  // than 1500 tokens, which was silently truncating longer audits into invalid JSON.
  const turn = await provider.chat(system, [{ role: 'user', text: userMessage }], { maxTokens: 4000, includeTools: false });
  if (!turn.text.trim()) {
    throw new Error('The AI did not return an audit. Please try again.');
  }
  const result = parseAuditResult(turn.text);

  const id = await repo.saveAudit(userId, userEmail, req, transcript, result, provider.model);
  return {
    id, ...req, transcript, result, model: provider.model, createdByEmail: userEmail, createdAt: new Date().toISOString(),
  };
}

export async function listAudits(userId: number, isSuperAdmin: boolean) {
  return repo.listAudits(userId, isSuperAdmin);
}

export interface BulkAuditItemResult {
  index: number;
  recordingUrl: string;
  record?: CallAuditRecord;
  error?: string;
}

// Runs each audit completely independently — a slow/failed transcription or AI call in one row must
// never block the rest of the batch (e.g. one dead recording URL would otherwise sink 20 audits).
// Sequential, not parallel: every row pays for a Deepgram call + an LLM call, and parallel bursts
// trip the per-minute rate limiter that both of those providers enforce.
export async function runBulkAudits(userId: number, userEmail: string, requests: CallAuditRequest[]): Promise<BulkAuditItemResult[]> {
  const results: BulkAuditItemResult[] = [];
  for (let i = 0; i < requests.length; i++) {
    const req = requests[i];
    try {
      const record = await runCallAudit(userId, userEmail, req);
      results.push({ index: i, recordingUrl: req.recordingUrl, record });
    } catch (err) {
      results.push({ index: i, recordingUrl: req.recordingUrl, error: err instanceof Error ? err.message : 'Audit failed' });
    }
  }
  return results;
}

export async function getAudit(id: number, userId: number, isSuperAdmin: boolean) {
  return repo.getAudit(id, userId, isSuperAdmin);
}
