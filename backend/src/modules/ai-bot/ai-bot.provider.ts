import { TOOL_DEFS } from './ai-bot.tools';

// ─── AI provider abstraction ─────────────────────────────────────────────────────────────────
// Configured via the portal (Profile page, lib/aiSettings.ts, preferred) or env vars as a
// fallback default:
//   AI_PROVIDER      - 'anthropic' | 'openai-compatible' (default 'anthropic')
//   AI_API_KEY       - falls back to ANTHROPIC_API_KEY if set
//   AI_MODEL         - provider-specific default if unset
//   AI_BASE_URL      - required for 'openai-compatible' (e.g. a proxy/aggregator's endpoint)
// With no key configured, chat() returns disabled and the orchestrator (ai-bot.service.ts) falls
// back to running the single most relevant tool directly and presenting its data without LLM
// reasoning — the copilot still answers real questions, just without narration, exactly the "safe
// fallback / mock development mode" the spec calls for.
//
// Message history is a provider-agnostic normalized shape (AIMessage), NOT any one vendor's wire
// format — Anthropic (content blocks, tool_use/tool_result) and OpenAI-compatible (tool_calls,
// role:'tool' messages) represent "assistant called a tool" and "here's the tool's result"
// completely differently. Each provider translates the full normalized history to its own wire
// format on every call; the orchestrator never needs to know which vendor it's talking to.

export interface AIToolCall { id: string; name: string; input: Record<string, unknown> }
export interface AIToolResult { toolCallId: string; content: string }
export interface AIMessage {
  role: 'user' | 'assistant';
  text?: string;
  toolCalls?: AIToolCall[];    // assistant messages only
  toolResults?: AIToolResult[]; // user messages only — the results of a prior assistant tool call
}

export interface ProviderTurn {
  text: string;
  toolUses: AIToolCall[];
  stopReason: string;
}

export interface AIProvider {
  readonly model: string;
  readonly enabled: boolean;
  chat(system: string, messages: AIMessage[]): Promise<ProviderTurn>;
}

const ANTHROPIC_TOOLS = TOOL_DEFS.map(t => ({ name: t.name, description: t.description, input_schema: t.parameters }));
const OPENAI_TOOLS = TOOL_DEFS.map(t => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } }));

class AnthropicProvider implements AIProvider {
  constructor(private apiKey: string, public model: string) {}
  readonly enabled = true;

  async chat(system: string, messages: AIMessage[]): Promise<ProviderTurn> {
    const wireMessages = messages.map(m => {
      if (m.role === 'assistant') {
        const content: unknown[] = [];
        if (m.text) content.push({ type: 'text', text: m.text });
        for (const tc of m.toolCalls ?? []) content.push({ type: 'tool_use', id: tc.id, name: tc.name, input: tc.input });
        return { role: 'assistant', content };
      }
      if (m.toolResults?.length) {
        return { role: 'user', content: m.toolResults.map(tr => ({ type: 'tool_result', tool_use_id: tr.toolCallId, content: tr.content })) };
      }
      return { role: 'user', content: m.text ?? '' };
    });

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': this.apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: this.model, max_tokens: 1500, system, messages: wireMessages, tools: ANTHROPIC_TOOLS }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`AI provider error ${res.status}: ${body.slice(0, 300)}`);
    }
    const data = await res.json() as { content: { type: string; text?: string; id?: string; name?: string; input?: Record<string, unknown> }[]; stop_reason: string };

    let text = '';
    const toolUses: AIToolCall[] = [];
    for (const block of data.content) {
      if (block.type === 'text' && block.text) text += block.text;
      if (block.type === 'tool_use' && block.id && block.name) toolUses.push({ id: block.id, name: block.name, input: block.input ?? {} });
    }
    return { text, toolUses, stopReason: data.stop_reason };
  }
}

// Generic OpenAI Chat Completions-shaped provider — works against api.openai.com and the many
// proxy/aggregator services (Groq, Together, local model servers, "free LLM API" resellers, etc.)
// that expose the same /chat/completions contract under their own base URL. baseUrl is required
// and never guessed/defaulted to a real vendor's domain — the admin supplies it via the portal.
class OpenAICompatibleProvider implements AIProvider {
  constructor(private apiKey: string, public model: string, private baseUrl: string) {}
  readonly enabled = true;

  async chat(system: string, messages: AIMessage[]): Promise<ProviderTurn> {
    const wireMessages: unknown[] = [{ role: 'system', content: system }];
    for (const m of messages) {
      if (m.role === 'assistant') {
        wireMessages.push({
          role: 'assistant',
          content: m.text ?? null,
          ...(m.toolCalls?.length ? { tool_calls: m.toolCalls.map(tc => ({ id: tc.id, type: 'function', function: { name: tc.name, arguments: JSON.stringify(tc.input) } })) } : {}),
        });
        continue;
      }
      if (m.toolResults?.length) {
        for (const tr of m.toolResults) wireMessages.push({ role: 'tool', tool_call_id: tr.toolCallId, content: tr.content });
        continue;
      }
      wireMessages.push({ role: 'user', content: m.text ?? '' });
    }

    const url = `${this.baseUrl.replace(/\/+$/, '')}/chat/completions`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({ model: this.model, max_tokens: 1500, messages: wireMessages, tools: OPENAI_TOOLS }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`AI provider error ${res.status}: ${body.slice(0, 300)}`);
    }
    const data = await res.json() as {
      choices: { message: { content: string | null; tool_calls?: { id: string; function: { name: string; arguments: string } }[] }; finish_reason: string }[];
    };
    const choice = data.choices?.[0];
    const toolUses: AIToolCall[] = (choice?.message.tool_calls ?? []).map(tc => {
      let input: Record<string, unknown> = {};
      try { input = JSON.parse(tc.function.arguments); } catch { /* malformed args from the model — leave empty */ }
      return { id: tc.id, name: tc.function.name, input };
    });
    return { text: choice?.message.content ?? '', toolUses, stopReason: choice?.finish_reason ?? 'unknown' };
  }
}

// No key configured — the endpoint stays usable (deterministic tool answers only, no LLM
// reasoning) instead of the whole feature 500ing because a secret isn't set yet.
class NoKeyProvider implements AIProvider {
  readonly model = 'none';
  readonly enabled = false;
  async chat(): Promise<ProviderTurn> {
    return { text: '', toolUses: [], stopReason: 'no_provider' };
  }
}

export interface ProviderConfig { provider: string; apiKey: string | undefined; model: string | undefined; baseUrl?: string | undefined }

// Pure construction, no caching/side effects — used both for the live singleton below and for
// throwaway "does this key actually work" verification instances (lib/aiSettings.ts) that must
// never become the active provider until they've proven they connect.
export function buildProvider(cfg: ProviderConfig): AIProvider {
  if (!cfg.apiKey) return new NoKeyProvider();
  if (cfg.provider === 'openai-compatible') {
    if (!cfg.baseUrl) return new NoKeyProvider();
    return new OpenAICompatibleProvider(cfg.apiKey, cfg.model || 'gpt-4o-mini', cfg.baseUrl);
  }
  const resolvedModel = cfg.model || process.env.AI_MODEL || 'claude-haiku-4-5-20251001';
  return new AnthropicProvider(cfg.apiKey, resolvedModel);
}

let cached: AIProvider | null = null;
// Last 4 chars only — enough for an admin to recognize "yes that's the key I just pasted"
// without this status ever being able to leak the actual secret back out over the API.
let activeKeyPreview: string | null = null;
let activeSource: 'stored' | 'env' | 'none' = 'none';
let activeProviderName = 'anthropic';
let activeBaseUrl: string | undefined;

export function getAIProvider(): AIProvider {
  if (cached) return cached;
  const providerName = process.env.AI_PROVIDER || 'anthropic';
  const apiKey = process.env.AI_API_KEY || process.env.ANTHROPIC_API_KEY;
  const baseUrl = process.env.AI_BASE_URL;
  cached = buildProvider({ provider: providerName, apiKey, model: process.env.AI_MODEL, baseUrl });
  activeKeyPreview = apiKey ? apiKey.slice(-4) : null;
  activeSource = apiKey ? 'env' : 'none';
  activeProviderName = providerName;
  activeBaseUrl = baseUrl;
  return cached;
}

// Called once at startup if a key was saved via the portal (lib/aiSettings.ts), and again
// immediately after a successful save — swaps the live provider in without a restart, same as
// mailer.ts's updateSmtpPassword swapping its transporter.
export function setActiveProvider(provider: AIProvider, cfg: ProviderConfig, source: 'stored' | 'env'): void {
  cached = provider;
  activeKeyPreview = cfg.apiKey ? cfg.apiKey.slice(-4) : null;
  activeSource = source;
  activeProviderName = cfg.provider;
  activeBaseUrl = cfg.baseUrl;
}

export function getAIProviderStatus(): {
  provider: string; model: string; enabled: boolean; keySource: 'stored' | 'env' | 'none'; keyPreview: string | null; baseUrl: string | null;
} {
  const provider = getAIProvider();
  return {
    provider: activeProviderName,
    model: provider.model,
    enabled: provider.enabled,
    keySource: activeSource,
    keyPreview: activeKeyPreview,
    baseUrl: activeBaseUrl ?? null,
  };
}
