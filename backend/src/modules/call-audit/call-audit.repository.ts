import type mysql from 'mysql2';
import { querySource, getSourcePool } from '../../lib/sourceDb';
import type { CallAuditRequest, CallAuditResult, CallAuditRecord } from './call-audit.types';

// Same lazy CREATE TABLE IF NOT EXISTS convention as every other fast-moving feature table in this
// backend (see ai-bot.repository.ts) rather than a Prisma model + migration.
let ensured = false;
export async function ensureCallAuditTable(): Promise<void> {
  if (ensured) return;
  await querySource(`
    CREATE TABLE IF NOT EXISTS shivamgiri.md_call_audits (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      user_email VARCHAR(150),
      process_name VARCHAR(150),
      lob VARCHAR(100),
      agent_name VARCHAR(150),
      mas_id VARCHAR(50),
      recording_url VARCHAR(1024),
      prompt MEDIUMTEXT,
      transcript MEDIUMTEXT,
      result JSON,
      model VARCHAR(100),
      created_at DATETIME DEFAULT NOW(),
      KEY idx_user (user_id)
    )
  `, []);
  ensured = true;
}

export async function saveAudit(
  userId: number, userEmail: string, req: CallAuditRequest, transcript: string, result: CallAuditResult, model: string,
): Promise<number> {
  await ensureCallAuditTable();
  // Direct pool access (not the querySource wrapper) for the same reason as ai-bot.repository.ts's
  // appendMessage — a reliable ResultSetHeader.insertId, not the wrapper's rows-array typing.
  const [insertResult] = await getSourcePool().execute(
    `INSERT INTO shivamgiri.md_call_audits
     (user_id, user_email, process_name, lob, agent_name, mas_id, recording_url, prompt, transcript, result, model)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    [
      userId, userEmail, req.processName, req.lob, req.agentName, req.masId, req.recordingUrl, req.prompt,
      transcript, JSON.stringify(result), model,
    ],
  );
  return (insertResult as mysql.ResultSetHeader).insertId;
}

export async function listAudits(userId: number, isSuperAdmin: boolean): Promise<(Omit<CallAuditRecord, 'transcript' | 'result'> & { overallScore: number | null; verdict: string | null })[]> {
  await ensureCallAuditTable();
  // Everyone sees only their own runs, except super_admin who can review any manager's instant
  // audits — same "own work vs. oversight" split as every other per-user history list in this app.
  // Score/verdict pulled straight out of the stored result JSON so the list is scannable without
  // opening each entry.
  const rows = await querySource<{
    id: number; process_name: string; lob: string; agent_name: string; mas_id: string; recording_url: string;
    prompt: string; model: string; user_email: string; created_at: string;
    overall_score: number | null; verdict: string | null;
  }>(
    `SELECT id, process_name, lob, agent_name, mas_id, recording_url, prompt, model, user_email,
            DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%s') AS created_at,
            JSON_EXTRACT(result, '$.overallScore') AS overall_score,
            JSON_UNQUOTE(JSON_EXTRACT(result, '$.verdict')) AS verdict
     FROM shivamgiri.md_call_audits
     ${isSuperAdmin ? '' : 'WHERE user_id = ?'}
     ORDER BY id DESC LIMIT 50`,
    isSuperAdmin ? [] : [userId],
  );
  return rows.map(r => ({
    id: r.id, processName: r.process_name, lob: r.lob, agentName: r.agent_name, masId: r.mas_id,
    recordingUrl: r.recording_url, prompt: r.prompt, model: r.model, createdByEmail: r.user_email, createdAt: r.created_at,
    overallScore: r.overall_score !== null ? Number(r.overall_score) : null, verdict: r.verdict,
  }));
}

export async function getAudit(id: number, userId: number, isSuperAdmin: boolean): Promise<CallAuditRecord | null> {
  await ensureCallAuditTable();
  const rows = await querySource<{
    id: number; process_name: string; lob: string; agent_name: string; mas_id: string; recording_url: string;
    prompt: string; transcript: string; result: string | CallAuditResult; model: string; user_email: string; user_id: number; created_at: string;
  }>(
    `SELECT id, process_name, lob, agent_name, mas_id, recording_url, prompt, transcript, result, model, user_email, user_id,
            DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%s') AS created_at
     FROM shivamgiri.md_call_audits WHERE id = ? LIMIT 1`,
    [id],
  );
  const r = rows[0];
  if (!r) return null;
  if (!isSuperAdmin && r.user_id !== userId) return null;
  // mysql2 auto-parses a JSON-typed column into a real object already — JSON.parse()'ing it again
  // (the original bug: `JSON.parse(r.result)` where r.result was already an object) coerces it to
  // the string "[object Object]" first, which then fails to parse. Only parse if it's still a string.
  const result = typeof r.result === 'string' ? (JSON.parse(r.result) as CallAuditResult) : r.result;
  return {
    id: r.id, processName: r.process_name, lob: r.lob, agentName: r.agent_name, masId: r.mas_id,
    recordingUrl: r.recording_url, prompt: r.prompt, transcript: r.transcript,
    result, model: r.model, createdByEmail: r.user_email, createdAt: r.created_at,
  };
}
