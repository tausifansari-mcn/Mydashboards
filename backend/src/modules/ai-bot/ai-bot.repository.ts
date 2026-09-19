import crypto from 'crypto';
import type mysql from 'mysql2';
import { querySource, getSourcePool } from '../../lib/sourceDb';

// Chat history storage. Most feature tables in this backend are plain MySQL tables created lazily
// with CREATE TABLE IF NOT EXISTS (see quality.service.ts's initOutboundDashboardCacheTables,
// sales.service.ts's ENSURE_SALE_BRAND_TABLE, etc.) rather than Prisma models — Prisma here is
// reserved for the small "core" set (users/roles/clients/processes/dashboards). Following that
// same convention rather than adding new Prisma models + a migration for a fast-moving feature.

let ensured = false;
export async function ensureAiBotTables(): Promise<void> {
  if (ensured) return;
  await querySource(`
    CREATE TABLE IF NOT EXISTS shivamgiri.md_ai_chat_sessions (
      id VARCHAR(36) PRIMARY KEY,
      user_id INT NOT NULL,
      title VARCHAR(255),
      client_id INT,
      process_id INT,
      created_at DATETIME DEFAULT NOW(),
      updated_at DATETIME DEFAULT NOW() ON UPDATE NOW(),
      KEY idx_user (user_id)
    )
  `, []);
  await querySource(`
    CREATE TABLE IF NOT EXISTS shivamgiri.md_ai_chat_messages (
      id INT AUTO_INCREMENT PRIMARY KEY,
      session_id VARCHAR(36) NOT NULL,
      role VARCHAR(20) NOT NULL,
      content MEDIUMTEXT NOT NULL,
      tool_name VARCHAR(100),
      tool_arguments JSON,
      tool_result JSON,
      feedback VARCHAR(10),
      created_at DATETIME DEFAULT NOW(),
      KEY idx_session (session_id)
    )
  `, []);
  ensured = true;
}

export function generateSessionId(): string {
  return crypto.randomUUID();
}

export async function ensureSession(sessionId: string, userId: number, context: { clientId?: number; processId?: number; title?: string }): Promise<void> {
  await ensureAiBotTables();
  const rows = await querySource<{ id: string }>(
    'SELECT id FROM shivamgiri.md_ai_chat_sessions WHERE id = ? AND user_id = ?',
    [sessionId, userId],
  );
  if (rows.length > 0) return;
  await querySource(
    'INSERT INTO shivamgiri.md_ai_chat_sessions (id, user_id, title, client_id, process_id) VALUES (?,?,?,?,?)',
    [sessionId, userId, context.title ?? null, context.clientId ?? null, context.processId ?? null],
  );
}

export interface StoredMessage {
  role: 'user' | 'assistant';
  content: string;
  toolName?: string;
  toolArguments?: unknown;
  toolResult?: unknown;
}

export async function appendMessage(sessionId: string, msg: StoredMessage): Promise<number> {
  await ensureAiBotTables();
  // Using the pool directly (not the querySource wrapper) here specifically so the INSERT result
  // destructures the same confirmed way sales.service.ts's upload inserts already do — [result]
  // as a ResultSetHeader with insertId, not the wrapper's rows-array-typed return.
  const [result] = await getSourcePool().execute(
    `INSERT INTO shivamgiri.md_ai_chat_messages (session_id, role, content, tool_name, tool_arguments, tool_result)
     VALUES (?,?,?,?,?,?)`,
    [
      sessionId, msg.role, msg.content,
      msg.toolName ?? null,
      msg.toolArguments ? JSON.stringify(msg.toolArguments) : null,
      msg.toolResult ? JSON.stringify(msg.toolResult) : null,
    ],
  );
  await querySource('UPDATE shivamgiri.md_ai_chat_sessions SET updated_at = NOW() WHERE id = ?', [sessionId]);
  return (result as mysql.ResultSetHeader).insertId;
}

// Recent turns only — kept short deliberately (see ai-bot.service.ts's context-window handling);
// this is NOT the source of truth for "did this session exist", ensureSession is.
export async function getRecentMessages(sessionId: string, limit = 12): Promise<StoredMessage[]> {
  await ensureAiBotTables();
  // LIMIT inlined, not bound as `?` — mysql2's prepared execute() rejects a placeholder there on
  // this server (same reason every LIMIT elsewhere in this codebase, e.g. quality.service.ts's
  // export batching, is a template literal); limit is always an internal constant, never user input.
  const rows = await querySource<{ role: string; content: string }>(
    `SELECT role, content FROM shivamgiri.md_ai_chat_messages
     WHERE session_id = ? ORDER BY id DESC LIMIT ${Number(limit)}`,
    [sessionId],
  );
  return rows.reverse().map(r => ({ role: r.role as 'user' | 'assistant', content: r.content }));
}

export async function listSessions(userId: number): Promise<{ id: string; title: string | null; updatedAt: string }[]> {
  await ensureAiBotTables();
  const rows = await querySource<{ id: string; title: string | null; updated_at: string }>(
    `SELECT id, title, DATE_FORMAT(updated_at, '%Y-%m-%dT%H:%i:%s') AS updated_at
     FROM shivamgiri.md_ai_chat_sessions WHERE user_id = ? ORDER BY updated_at DESC LIMIT 50`,
    [userId],
  );
  return rows.map(r => ({ id: r.id, title: r.title, updatedAt: r.updated_at }));
}

export async function getSessionMessages(sessionId: string, userId: number): Promise<StoredMessage[]> {
  await ensureAiBotTables();
  const owns = await querySource<{ id: string }>(
    'SELECT id FROM shivamgiri.md_ai_chat_sessions WHERE id = ? AND user_id = ?', [sessionId, userId],
  );
  if (owns.length === 0) return [];
  const rows = await querySource<{ role: string; content: string; created_at: string }>(
    `SELECT role, content, DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%s') AS created_at
     FROM shivamgiri.md_ai_chat_messages WHERE session_id = ? ORDER BY id ASC`,
    [sessionId],
  );
  return rows.map(r => ({ role: r.role as 'user' | 'assistant', content: r.content }));
}

export async function setMessageFeedback(sessionId: string, userId: number, messageId: number, feedback: 'up' | 'down'): Promise<boolean> {
  await ensureAiBotTables();
  const owns = await querySource<{ id: string }>(
    'SELECT id FROM shivamgiri.md_ai_chat_sessions WHERE id = ? AND user_id = ?', [sessionId, userId],
  );
  if (owns.length === 0) return false;
  await querySource(
    'UPDATE shivamgiri.md_ai_chat_messages SET feedback = ? WHERE id = ? AND session_id = ?',
    [feedback, messageId, sessionId],
  );
  return true;
}
