import { querySource } from '../../lib/sourceDb';

const PROC_SELECT = `
  SELECT p.id, p.client_id, p.process_name, p.lob, p.dialdesk_client_id, p.is_active,
         c.id AS c_id, c.name AS c_name
  FROM shivamgiri.md_processes p
  JOIN shivamgiri.md_clients c ON c.id = p.client_id
`;

function rowToProcess(r: Record<string, unknown>) {
  return {
    id: r.id as number,
    client_id: r.client_id as number,
    process_name: r.process_name as string,
    lob: r.lob as string,
    dialdesk_client_id: r.dialdesk_client_id as number,
    is_active: Boolean(r.is_active),
    client: { id: r.c_id as number, name: r.c_name as string },
  };
}

export async function getAllProcesses(clientId?: number) {
  const sql = clientId
    ? PROC_SELECT + ' WHERE p.client_id = ? ORDER BY c.name ASC, p.process_name ASC'
    : PROC_SELECT + ' ORDER BY c.name ASC, p.process_name ASC';
  const rows = await querySource<Record<string, unknown>>(sql, clientId ? [clientId] : []);
  return rows.map(rowToProcess);
}

export async function getProcessById(id: number) {
  const rows = await querySource<Record<string, unknown>>(
    `SELECT p.id, p.client_id, p.process_name, p.lob, p.dialdesk_client_id, p.is_active,
            c.id AS c_id, c.name AS c_name, c.dialdesk_client_id AS c_dialdesk_client_id,
            c.logo_url AS c_logo_url, c.is_active AS c_is_active, c.created_at AS c_created_at
       FROM shivamgiri.md_processes p
       JOIN shivamgiri.md_clients c ON c.id = p.client_id
      WHERE p.id = ?`,
    [id],
  );
  if (!rows.length) return null;
  const r = rows[0];
  return {
    id: r.id,
    client_id: r.client_id,
    process_name: r.process_name,
    lob: r.lob,
    dialdesk_client_id: r.dialdesk_client_id,
    is_active: Boolean(r.is_active),
    client: {
      id: r.c_id,
      name: r.c_name,
      dialdesk_client_id: r.c_dialdesk_client_id,
      logo_url: r.c_logo_url,
      is_active: Boolean(r.c_is_active),
      created_at: r.c_created_at,
    },
  };
}

export async function createProcess(data: { client_id: number; process_name: string; lob: string; dialdesk_client_id: number }) {
  const res = await querySource(
    `INSERT INTO shivamgiri.md_processes (client_id, process_name, lob, dialdesk_client_id) VALUES (?, ?, ?, ?)`,
    [data.client_id, data.process_name, data.lob, data.dialdesk_client_id],
  );
  const newId = (res as unknown as { insertId: number }).insertId;
  const rows = await querySource<Record<string, unknown>>(
    PROC_SELECT + ' WHERE p.id = ?',
    [newId],
  );
  return rowToProcess(rows[0]);
}

export async function updateProcess(id: number, data: Partial<{ process_name: string; lob: string; dialdesk_client_id: number; is_active: boolean }>) {
  const sets: string[] = [];
  const params: (string | number | null)[] = [];
  if (data.process_name !== undefined) { sets.push('process_name = ?'); params.push(data.process_name); }
  if (data.lob !== undefined) { sets.push('lob = ?'); params.push(data.lob); }
  if (data.dialdesk_client_id !== undefined) { sets.push('dialdesk_client_id = ?'); params.push(data.dialdesk_client_id); }
  if (data.is_active !== undefined) { sets.push('is_active = ?'); params.push(data.is_active ? 1 : 0); }
  if (sets.length) {
    await querySource(`UPDATE shivamgiri.md_processes SET ${sets.join(', ')} WHERE id = ?`, [...params, id]);
  }
  const rows = await querySource<Record<string, unknown>>(PROC_SELECT + ' WHERE p.id = ?', [id]);
  return rowToProcess(rows[0]);
}

export async function deleteProcess(id: number) {
  return querySource(`UPDATE shivamgiri.md_processes SET is_active = 0 WHERE id = ?`, [id]);
}

export async function assignUserToProcess(userId: number, processId: number) {
  return querySource(
    `INSERT INTO shivamgiri.md_user_process_mapping (user_id, process_id) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE user_id = user_id`,
    [userId, processId],
  );
}

export async function unassignUserFromProcess(userId: number, processId: number) {
  return querySource(
    `DELETE FROM shivamgiri.md_user_process_mapping WHERE user_id = ? AND process_id = ?`,
    [userId, processId],
  );
}

export async function getUserProcesses(userId: number) {
  const rows = await querySource<Record<string, unknown>>(
    `SELECT m.id, m.user_id, m.process_id, m.assigned_at,
            p.id AS p_id, p.client_id AS p_client_id, p.process_name, p.lob,
            p.dialdesk_client_id AS p_dialdesk_client_id, p.is_active AS p_is_active,
            c.id AS c_id, c.name AS c_name
       FROM shivamgiri.md_user_process_mapping m
       JOIN shivamgiri.md_processes p ON p.id = m.process_id
       JOIN shivamgiri.md_clients c ON c.id = p.client_id
      WHERE m.user_id = ?`,
    [userId],
  );
  return rows.map((r) => ({
    id: r.id,
    user_id: r.user_id,
    process_id: r.process_id,
    assigned_at: r.assigned_at,
    process: {
      id: r.p_id,
      client_id: r.p_client_id,
      process_name: r.process_name,
      lob: r.lob,
      dialdesk_client_id: r.p_dialdesk_client_id,
      is_active: Boolean(r.p_is_active),
      client: { id: r.c_id, name: r.c_name },
    },
  }));
}
