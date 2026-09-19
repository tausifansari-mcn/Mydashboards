export interface DashboardContext {
  clientId?: number;
  clientName?: string;
  processId?: number;
  campaignId?: string;
  dateFrom?: string;
  dateTo?: string;
  dashboard?: string;
}

export interface ChatRequestBody {
  message: string;
  sessionId?: string;
  context?: DashboardContext;
}

export interface ToolCallRecord {
  name: string;
  arguments: Record<string, unknown>;
  result: unknown;
  error?: string;
}

export interface ChatSource {
  label: string;
  detail?: string;
  href?: string;
}

export interface ChatResponseBody {
  success: boolean;
  message: string;
  sessionId: string;
  messageId: number;
  sources: ChatSource[];
  toolsUsed: string[];
  metadata: {
    model: string;
    aiEnabled: boolean;
    resolvedClientId?: number;
    resolvedClientName?: string;
    dateFrom?: string;
    dateTo?: string;
  };
}

// The scope a request is allowed to touch, derived server-side from the authenticated user via
// resolveUserScope — never from anything the client (or the LLM) sends. Every tool call is
// filtered through this before it runs; see enforceScope in ai-bot.tools.ts.
export interface RequestScope {
  userId: number;
  isSuperAdmin: boolean;
  allowedClientIds: number[] | null; // null = unrestricted (super_admin)
}
