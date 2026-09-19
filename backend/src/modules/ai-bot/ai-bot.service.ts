import { resolveUserScope } from '../call-master/call-master.service';
import { TOOL_DEFS, ScopeError, getCQScore } from './ai-bot.tools';
import { getAIProvider } from './ai-bot.provider';
import type { AIMessage, AIToolResult } from './ai-bot.provider';
import { buildSystemPrompt } from './ai-bot.prompts';
import * as repo from './ai-bot.repository';
import type { ChatRequestBody, ChatResponseBody, ChatSource, RequestScope, ToolCallRecord } from './ai-bot.types';

const MAX_TOOL_ITERATIONS = 4;
const MAX_HISTORY_MESSAGES = 12; // ~6 turns — bounded context window (Rule 13)

async function buildScope(userId: number, tenantClientId: number | null): Promise<RequestScope> {
  const scope = await resolveUserScope(userId, tenantClientId);
  return {
    userId,
    isSuperAdmin: scope.clientIds === null,
    allowedClientIds: scope.clientIds,
  };
}

async function runTool(scope: RequestScope, name: string, args: Record<string, unknown>): Promise<{ result: unknown; error?: string }> {
  const def = TOOL_DEFS.find(t => t.name === name);
  if (!def) return { result: null, error: `Unknown tool: ${name}` };
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (def.run as any)(scope, args);
    return { result };
  } catch (err) {
    if (err instanceof ScopeError) return { result: null, error: err.message };
    const msg = err instanceof Error ? err.message : String(err);
    return { result: null, error: `Tool failed: ${msg}` };
  }
}

function sourcesFromTools(calls: ToolCallRecord[]): ChatSource[] {
  return calls.filter(c => !c.error).map(c => {
    const r = c.result as Record<string, unknown>;
    switch (c.name) {
      case 'getCQScore': {
        const dirLabel = r.direction === 'inbound' ? 'Inbound' : r.direction === 'outbound' ? 'Outbound' : '';
        return { label: `${r.process ?? 'Process'} ${dirLabel} CQ Score`.replace(/\s+/g, ' ').trim(), detail: `${r.totalCalls ?? '?'} calls · ${r.dateFrom} to ${r.dateTo}` };
      }
      case 'getCallCount':
        return { label: 'Call count', detail: `${r.dateFrom} to ${r.dateTo}` };
      case 'getCQScoreDateWise':
        return { label: `Date-wise CQ trend${r.direction ? ` (${r.direction === 'inbound' ? 'Inbound' : 'Outbound'})` : ''}`, detail: `${r.dayCount ?? '?'} days · ${r.dateFrom} to ${r.dateTo}` };
      case 'getObjectionAnalysis':
        return { label: 'Objection analysis', detail: `${r.dateFrom} to ${r.dateTo}` };
      case 'getCallTranscript':
        return { label: `Call #${r.callId} transcript` };
      case 'findCallsByPhone':
        return { label: `Calls for ${c.arguments.phoneNumber}`, detail: r.found ? `${r.matchCount ?? 0} match(es) · ${r.auditStatus}` : String(r.auditStatus ?? 'No match found') };
      case 'searchTranscripts':
        return { label: `Transcript search: "${c.arguments.phrase}"`, detail: `${r.matchCount ?? 0} matches` };
      case 'getSalesKPIs':
        return { label: 'Sales KPIs', detail: `${r.dateFrom} to ${r.dateTo}` };
      case 'getFraudCalls':
        return { label: 'Fraud call check', detail: `${r.dateFrom} to ${r.dateTo}` };
      case 'getAgentPerformance':
        return { label: `${r.process ?? 'Agent'} performance`, detail: `${r.dateFrom} to ${r.dateTo}` };
      default:
        return { label: c.name };
    }
  });
}

// Fallback path when no AI_API_KEY is configured: still answer the highest-value deterministic
// questions (CQ score) directly from tools, no LLM narration. Everything else gets an honest
// "reasoning needs an API key" message rather than a fabricated answer.
async function noProviderFallback(scope: RequestScope, context: ChatRequestBody['context']): Promise<{ text: string; toolCalls: ToolCallRecord[] }> {
  if (context?.clientId) {
    const { result, error } = await runTool(scope, 'getCQScore', { clientId: context.clientId, dateFrom: context.dateFrom, dateTo: context.dateTo });
    // A scope denial must reach the user as a denial, never fall through to a generic message —
    // that's the difference between "access denied" and silently looking like a data gap.
    if (error) {
      return { text: error, toolCalls: [{ name: 'getCQScore', arguments: { clientId: context.clientId }, result: null, error }] };
    }
    const r = result as Awaited<ReturnType<typeof getCQScore>>;
    if (r?.available) {
      const agentLine = r.direction === 'outbound'
        ? `Top agents: ${r.topAgents.slice(0, 3).map(a => `${a.agentName} (${a.avgScore}%)`).join(', ') || 'none'}.\n\n`
        : '';
      const text = `${r.process} ${r.direction === 'inbound' ? 'Inbound' : 'Outbound'} CQ Score is ${r.overallScore}% across ${r.totalCalls.toLocaleString()} calls (${r.dateFrom} to ${r.dateTo}).\n\n`
        + agentLine
        + `No AI_API_KEY is configured, so this is raw data only — set AI_API_KEY (or ANTHROPIC_API_KEY) in the backend .env to enable full reasoning, follow-up questions, and transcript analysis.`;
      return { text, toolCalls: [{ name: 'getCQScore', arguments: { clientId: context.clientId }, result }] };
    }
  }
  return {
    text: 'AI reasoning is not available yet — no AI_API_KEY (or ANTHROPIC_API_KEY) is configured on the server, so I can only answer if you open me from a process with a defined CQ score (Housing Owner, Housing Premium, Bellavita, or GNC). Ask your admin to set the environment variable to enable full natural-language answers.',
    toolCalls: [],
  };
}

export async function handleChat(
  userId: number, tenantClientId: number | null, body: ChatRequestBody,
): Promise<ChatResponseBody> {
  const scope = await buildScope(userId, tenantClientId);
  const sessionId = body.sessionId || repo.generateSessionId();
  await repo.ensureSession(sessionId, userId, {
    clientId: body.context?.clientId,
    processId: body.context?.processId,
    title: body.message.slice(0, 80),
  });
  await repo.appendMessage(sessionId, { role: 'user', content: body.message });

  const provider = getAIProvider();
  const toolCalls: ToolCallRecord[] = [];
  let finalText = '';

  if (!provider.enabled) {
    const fallback = await noProviderFallback(scope, body.context);
    finalText = fallback.text;
    toolCalls.push(...fallback.toolCalls);
  } else {
    const history = await repo.getRecentMessages(sessionId, MAX_HISTORY_MESSAGES);
    const messages: AIMessage[] = history.map(h => ({ role: h.role, text: h.content }));
    const system = buildSystemPrompt(body.context);

    for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
      const turn = await provider.chat(system, messages);
      if (turn.text) finalText = turn.text;
      if (turn.toolUses.length === 0) break;

      // Echo back a normalized assistant turn (text + tool calls), then a user turn carrying the
      // tool results keyed by call id — each provider translates this into its own wire format
      // (Anthropic tool_use/tool_result blocks vs OpenAI tool_calls/role:'tool' messages) on its
      // next call; the orchestrator itself stays vendor-agnostic.
      messages.push({ role: 'assistant', text: turn.text, toolCalls: turn.toolUses });

      const toolResults: AIToolResult[] = [];
      for (const use of turn.toolUses) {
        const { result, error } = await runTool(scope, use.name, use.input);
        toolCalls.push({ name: use.name, arguments: use.input, result, error });
        toolResults.push({ toolCallId: use.id, content: JSON.stringify(error ? { error } : result) });
      }
      messages.push({ role: 'user', toolResults });
    }

    if (!finalText) {
      finalText = toolCalls.length > 0
        ? 'I gathered the data but had trouble putting together a final answer — please try rephrasing your question.'
        : "I'm not sure how to answer that with the data I have access to. Try asking about CQ score, call counts, agent performance, or a specific call ID.";
    }
  }

  const messageId = await repo.appendMessage(sessionId, { role: 'assistant', content: finalText });

  return {
    success: true,
    message: finalText,
    sessionId,
    messageId,
    sources: sourcesFromTools(toolCalls),
    toolsUsed: [...new Set(toolCalls.map(t => t.name))],
    metadata: {
      model: provider.model,
      aiEnabled: provider.enabled,
      resolvedClientId: body.context?.clientId,
      resolvedClientName: body.context?.clientName,
      dateFrom: body.context?.dateFrom,
      dateTo: body.context?.dateTo,
    },
  };
}

export async function listSessions(userId: number) {
  return repo.listSessions(userId);
}

export async function getSessionMessages(sessionId: string, userId: number) {
  return repo.getSessionMessages(sessionId, userId);
}

export async function setFeedback(sessionId: string, userId: number, messageId: number, feedback: 'up' | 'down') {
  return repo.setMessageFeedback(sessionId, userId, messageId, feedback);
}
