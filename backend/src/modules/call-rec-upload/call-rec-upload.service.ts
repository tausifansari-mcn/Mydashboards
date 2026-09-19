import * as XLSX from 'xlsx';
import type mysql from 'mysql2';
import { getMasmisPool } from '../../lib/masmisDb';

// Ports the 5 Excel uploaders that used to live in the standalone "Call Rec UI" app (a separate
// Node/Sequelize server on port 5050, embedded here via a now-removed iframe) directly into this
// backend. That app already wrote into these exact db_masmis.CR_* tables on the same MySQL server
// Mydashboards already connects to — so this is a same-database port, not a data migration: the
// parsing logic below is ported verbatim from that app's ingest scripts, verified column-for-column
// against the live table schemas before writing a line of SQL (client_id/campaign_id column-name
// mismatches have bitten this exact class of port twice already elsewhere in this codebase).

const CR_TABLES = [
  'CR_housing_owner', 'CR_housing_premium', 'CR_lp_feedback', 'CR_lp_regional', 'CR_lp_non_regional',
] as const;

// The old app's tables have no upload_batch_id column (it tracked uploads via its own crp_uploads
// FK instead) — add it once, lazily, so this module can use the same batch-upload/revert
// convention as every other uploader in this app (see sales.service.ts's upload_log pattern).
// Purely additive: existing rows just get NULL here and simply aren't batch-revertible.
let batchColumnsEnsured = false;
export async function ensureBatchColumns(): Promise<void> {
  if (batchColumnsEnsured) return;
  for (const table of CR_TABLES) {
    const [rows] = await getMasmisPool().execute(
      `SELECT COLUMN_NAME FROM information_schema.columns
       WHERE table_schema = 'db_masmis' AND table_name = ? AND COLUMN_NAME = 'upload_batch_id'`,
      [table],
    );
    if ((rows as unknown[]).length === 0) {
      await getMasmisPool().query(
        `ALTER TABLE db_masmis.${table} ADD COLUMN upload_batch_id VARCHAR(36) NULL, ADD INDEX idx_upload_batch_id (upload_batch_id)`,
      );
    }
  }
  batchColumnsEnsured = true;
}

function toIntOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = parseInt(String(v), 10);
  return Number.isNaN(n) ? null : n;
}

// "H:MM:SS" (e.g. "0:00:50") -> total seconds. Falls back to plain int parsing for values that
// aren't in that shape (some exports use a bare minute count instead).
function toSecondsFromHms(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const match = String(v).match(/^(\d+):(\d{2}):(\d{2})$/);
  if (!match) return toIntOrNull(v);
  const [, h, m, s] = match;
  return Number(h) * 3600 + Number(m) * 60 + Number(s);
}

// Source cells read as Excel-formatted display strings (raw:false), e.g. "8/24/26 10:27" (M/D/YY)
// or "8/24/2026 10:27" (4-digit year) — handle both, output MySQL DATETIME text.
function mdyToMysqlDatetime(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null;
  if (v instanceof Date) return v.toISOString().slice(0, 19).replace('T', ' ');
  const mdy = String(v).match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (mdy) {
    const [, m, d, yRaw, h, min, s] = mdy;
    const y = yRaw.length === 2 ? `20${yRaw}` : yRaw;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')} ${h.padStart(2, '0')}:${min}:${s || '00'}`;
  }
  return String(v);
}

// dd-mm-yyyy -> yyyy-mm-dd (MySQL DATE/DATETIME text); Date objects (cellDates:true) pass through.
function ddmmyyyyToMysql(v: unknown): string | Date | null {
  if (v === null || v === undefined || v === '') return null;
  if (v instanceof Date) return v;
  const ddmmyyyy = String(v).match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (ddmmyyyy) return `${ddmmyyyy[3]}-${ddmmyyyy[2]}-${ddmmyyyy[1]}`;
  return String(v);
}

// Phone numbers can arrive as Excel numbers rendered in scientific notation (e.g. 9.18E+11).
function toPhoneString(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return String(Math.round(v));
  return String(v);
}

async function bulkInsert(table: string, cols: string[], rows: unknown[][], batchId: string, uploadedBy: number): Promise<number> {
  if (rows.length === 0) return 0;
  const allCols = [...cols, 'upload_batch_id'];
  const values = rows.map(r => [...r, batchId]);
  const sql = `INSERT INTO db_masmis.${table} (${allCols.join(', ')}) VALUES ?`;
  const [result] = await getMasmisPool().query(sql, [values]);
  void uploadedBy; // kept in signature for symmetry with the rest of the app's upload functions
  return (result as mysql.ResultSetHeader).affectedRows;
}

// ─── Housing Owner (client_id 496) — positional, 30 columns ───────────────────────────────────

const HOUSING_OWNER_COLS = [
  'direction', 'status', 'call_date', 'call_id', 'client_number', 'my_number', 'call_flow', 'ivr',
  'auto_attendant', 'department', 'voicemail', 'time_group', 'answered', 'not_answered', 'call_duration',
  'inbound_duration', 'outbound_duration', 'hangup_cause', 'notes', 'dtmf', 'recording', 'agent_ring_duration',
  'circle', 'operator', 'reason_key', 'agent_disposition', 'agent_disposition_name', 'agent_name',
  'agent_on_call', 'sip_response',
];
const HOUSING_OWNER_PHONE_IDX = new Set([HOUSING_OWNER_COLS.indexOf('client_number'), HOUSING_OWNER_COLS.indexOf('my_number')]);
const HOUSING_OWNER_DATE_IDX = new Set([HOUSING_OWNER_COLS.indexOf('call_date')]);
const HOUSING_OWNER_INT_IDX = new Set(['call_duration', 'inbound_duration', 'outbound_duration'].map(c => HOUSING_OWNER_COLS.indexOf(c)));

export async function uploadHousingOwner(buffer: Buffer, uploadedBy: number, batchId: string): Promise<{ inserted: number; total: number }> {
  await ensureBatchColumns();
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null, blankrows: false });
  const dataRows = rows.slice(1);

  const mapped = dataRows.map(row => HOUSING_OWNER_COLS.map((_, idx) => {
    const raw = row[idx] !== undefined ? row[idx] : null;
    if (HOUSING_OWNER_PHONE_IDX.has(idx)) return toPhoneString(raw);
    if (HOUSING_OWNER_DATE_IDX.has(idx)) return ddmmyyyyToMysql(raw);
    if (HOUSING_OWNER_INT_IDX.has(idx)) return toIntOrNull(raw);
    return raw === null ? null : String(raw);
  }));
  const inserted = await bulkInsert('CR_housing_owner', [...HOUSING_OWNER_COLS, 'client_id', 'uploaded_by'],
    mapped.map(r => [...r, '496', null]), batchId, uploadedBy);
  return { inserted, total: mapped.length };
}

// ─── Housing Premium (client_id 419) — positional, 34 columns ─────────────────────────────────

const HOUSING_PREMIUM_COLS = [
  'call_phone', 'call_center', 'member_no', 'call_group', 'call_group_2', 'end_time', 'call_date', 'duration',
  'call_time', 'partner_name', 'circle', 'member', 'file_url', 'routing_numbers', 'routing_status', 'call_result',
  'key_coins', 'leg_details', 'caller', 'routing_error_code', 'cparty_numbers', 'cparty_name', 'cparty_call_status',
  'channel', 'talk_duration', 'ringing_duration', 'caller_name_comment', 'start_time', 'leg_a_picked_time',
  'leg_b_start_time', 'leg_b_picked_time', 'call_sid', 'sms_coins', 'time_only',
];
const HOUSING_PREMIUM_CALLDATE_IDX = HOUSING_PREMIUM_COLS.indexOf('call_date');
const HOUSING_PREMIUM_DATE_IDX = new Set(
  ['end_time', 'start_time', 'leg_a_picked_time', 'leg_b_start_time', 'leg_b_picked_time'].map(c => HOUSING_PREMIUM_COLS.indexOf(c)),
);
const HOUSING_PREMIUM_INT_IDX = new Set(
  ['duration', 'key_coins', 'talk_duration', 'ringing_duration', 'sms_coins'].map(c => HOUSING_PREMIUM_COLS.indexOf(c)),
);

function toCallDateOnly(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const ddmmyyyy = String(v).match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (ddmmyyyy) return `${ddmmyyyy[3]}-${ddmmyyyy[2]}-${ddmmyyyy[1]}`;
  return String(v);
}

export async function uploadHousingPremium(buffer: Buffer, uploadedBy: number, batchId: string): Promise<{ inserted: number; total: number }> {
  await ensureBatchColumns();
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null, blankrows: false });
  const dataRows = rows.slice(1);

  const mapped = dataRows.map(row => HOUSING_PREMIUM_COLS.map((_, idx) => {
    const raw = row[idx] !== undefined ? row[idx] : null;
    if (idx === HOUSING_PREMIUM_CALLDATE_IDX) return toCallDateOnly(raw);
    if (HOUSING_PREMIUM_DATE_IDX.has(idx)) return ddmmyyyyToMysql(raw);
    if (HOUSING_PREMIUM_INT_IDX.has(idx)) return toIntOrNull(raw);
    return raw === null ? null : String(raw);
  }));
  const inserted = await bulkInsert('CR_housing_premium', [...HOUSING_PREMIUM_COLS, 'client_id', 'uploaded_by'],
    mapped.map(r => [...r, '419', null]), batchId, uploadedBy);
  return { inserted, total: mapped.length };
}

// ─── LP Feedback (client_id 498, campaign 'Feedback') — header-name based, 16 fields ──────────
// Header-name (not positional) because this export's layout has changed at least once already —
// see the original ingest script's note. Reading by header name survives column reordering.

const LP_FEEDBACK_HEADER_TO_COL: Record<string, string> = {
  recordstotalcount: 'records_total_count',
  clientname: 'ClientName',
  agentname: 'AgentName',
  phone: 'Phone',
  allocatedon: 'AllocatedOn',
  campaignid: 'CampaignId',
  disposition: 'Disposition',
  callnumber: 'CallNumber',
  task: 'Task',
  leadsubstatusfeedback: 'LeadSubStatusFeedback',
  connectedtime: 'ConnectedTime',
  disconnectedtime: 'DisConnectedTime',
  leadsubstatus: 'LeadSubStatus',
  leadstatus: 'LeadStatus',
  calldurationminutes: 'CallDurationMinutes',
  recordingurl: 'RecordingUrl',
};
const LP_FEEDBACK_INT_COLS = new Set(['records_total_count']);
const LP_FEEDBACK_DATE_COLS = new Set(['AllocatedOn', 'ConnectedTime', 'DisConnectedTime']);
const LP_FEEDBACK_DURATION_COLS = new Set(['CallDurationMinutes']);

function normalizeHeader(h: unknown): string {
  return String(h ?? '').trim().toLowerCase().replace(/[\s_-]+/g, '');
}

export async function uploadLPFeedback(buffer: Buffer, uploadedBy: number, batchId: string): Promise<{ inserted: number; total: number }> {
  await ensureBatchColumns();
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null, blankrows: false, raw: false });
  const headerRow = (rows[0] ?? []) as unknown[];
  const dataRows = rows.slice(1);
  const colByIndex = headerRow.map(h => LP_FEEDBACK_HEADER_TO_COL[normalizeHeader(h)] ?? null);

  const outCols = Object.values(LP_FEEDBACK_HEADER_TO_COL);
  const mapped = dataRows.map(row => {
    const byCol: Record<string, unknown> = {};
    colByIndex.forEach((col, idx) => {
      if (!col) return;
      const raw = row[idx] !== undefined ? row[idx] : null;
      if (LP_FEEDBACK_DATE_COLS.has(col)) byCol[col] = mdyToMysqlDatetime(raw);
      else if (LP_FEEDBACK_INT_COLS.has(col)) byCol[col] = toIntOrNull(raw);
      else if (LP_FEEDBACK_DURATION_COLS.has(col)) byCol[col] = toSecondsFromHms(raw);
      else byCol[col] = raw === null ? null : String(raw);
    });
    return outCols.map(c => byCol[c] ?? null);
  });
  const inserted = await bulkInsert('CR_lp_feedback', [...outCols, 'client_id', 'campaign', 'uploaded_by'],
    mapped.map(r => [...r, '498', 'Feedback', null]), batchId, uploadedBy);
  return { inserted, total: mapped.length };
}

// ─── LP Regional / LP Non Regional (client_id 498) — positional, 15 columns each ──────────────

const LP_REGIONAL_SHAPE_COLS = [
  'records_total_count', 'client_name', 'agent_name', 'allocated_on', 'campaign_id', 'disposition',
  'call_number', 'task', 'lead_sub_status_feedback', 'connected_time', 'disconnected_time',
  'lead_sub_status', 'lead_status', 'call_duration', 'recording_url',
];
const LP_REGIONAL_INT_IDX = new Set([LP_REGIONAL_SHAPE_COLS.indexOf('records_total_count')]);
const LP_REGIONAL_DATE_IDX = new Set(
  ['allocated_on', 'connected_time', 'disconnected_time'].map(c => LP_REGIONAL_SHAPE_COLS.indexOf(c)),
);
const LP_REGIONAL_DURATION_IDX = new Set([LP_REGIONAL_SHAPE_COLS.indexOf('call_duration')]);

async function uploadLPRegionalShape(
  buffer: Buffer, table: 'CR_lp_regional' | 'CR_lp_non_regional', campaign: 'regional' | 'non_regional',
  uploadedBy: number, batchId: string,
): Promise<{ inserted: number; total: number }> {
  await ensureBatchColumns();
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null, blankrows: false, raw: false });
  const dataRows = rows.slice(1);

  const mapped = dataRows.map(row => LP_REGIONAL_SHAPE_COLS.map((_, idx) => {
    const raw = row[idx] !== undefined ? row[idx] : null;
    if (LP_REGIONAL_DATE_IDX.has(idx)) return mdyToMysqlDatetime(raw);
    if (LP_REGIONAL_INT_IDX.has(idx)) return toIntOrNull(raw);
    if (LP_REGIONAL_DURATION_IDX.has(idx)) return toSecondsFromHms(raw);
    return raw === null ? null : String(raw);
  }));
  const inserted = await bulkInsert(table, [...LP_REGIONAL_SHAPE_COLS, 'client_id', 'campaign', 'uploaded_by'],
    mapped.map(r => [...r, '498', campaign, null]), batchId, uploadedBy);
  return { inserted, total: mapped.length };
}

export function uploadLPRegional(buffer: Buffer, uploadedBy: number, batchId: string) {
  return uploadLPRegionalShape(buffer, 'CR_lp_regional', 'regional', uploadedBy, batchId);
}
export function uploadLPNonRegional(buffer: Buffer, uploadedBy: number, batchId: string) {
  return uploadLPRegionalShape(buffer, 'CR_lp_non_regional', 'non_regional', uploadedBy, batchId);
}
