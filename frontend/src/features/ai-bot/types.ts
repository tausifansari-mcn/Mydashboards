export interface ChatSource {
  label: string;
  detail?: string;
  href?: string;
}

export interface ChatMessageData {
  id: string;
  dbMessageId?: number; // real md_ai_chat_messages.id, needed for feedback — absent for user turns
  role: 'user' | 'assistant';
  content: string;
  createdAt: number; // client-side timestamp (Date.now()), for the time shown under each bubble
  sources?: ChatSource[];
  toolsUsed?: string[];
  feedback?: 'up' | 'down' | null;
  pending?: boolean;
}

export interface DashboardContext {
  clientId?: number;
  clientName?: string;
  processId?: number;
  campaignId?: string;
  dateFrom?: string;
  dateTo?: string;
  dashboard?: string;
}
