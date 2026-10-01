// One-time setup for the "SBI Collection" process:
//   1. Creates db_masmis.sbi_quality (if not already there).
//   2. Registers "SBI Collection" as an Inbound process in Call Master (shivamgiri.md_clients +
//      shivamgiri.md_processes), for bookkeeping/consistency with every other process — the
//      dashboard itself reads db_masmis.sbi_quality directly, not through this client/process link.
//   3. Imports every row from the source Excel export into db_masmis.sbi_quality (upsert by
//      call_id, so re-running this script after a corrected export is safe).
//
// Re-runnable: safe to run again after the source Excel file changes.
import 'dotenv/config';
import XLSX from 'xlsx';
import { getSourcePool, querySource } from '../lib/sourceDb';
import { getMasmisPool } from '../lib/masmisDb';
import { initSbiQualityTable, SBI_QUALITY_COLUMNS } from '../modules/sbi-quality/sbi-quality.service';

const EXCEL_PATH = 'C:/Users/MAS60358/Desktop/uploader/sbi_quality.xlsx';
const PROCESS_NAME = 'SBI Collection';
const CLIENT_NAME = 'SBI Collection';
// Highest real VICIdial dialdesk_client_id in use is 498 — 900 is a safe, obviously-placeholder
// value for a process that has no live VICIdial feed of its own.
const PLACEHOLDER_DIALDESK_CLIENT_ID = 900;

async function ensureClientAndProcess(): Promise<void> {
  const existing = await querySource<{ id: number }>(
    'SELECT id FROM shivamgiri.md_processes WHERE process_name = ? LIMIT 1',
    [PROCESS_NAME],
  );
  if (existing.length) {
    console.log(`Process "${PROCESS_NAME}" already registered (id=${existing[0].id}) — skipping.`);
    return;
  }

  let clientId: number;
  const existingClient = await querySource<{ id: number }>(
    'SELECT id FROM shivamgiri.md_clients WHERE name = ? LIMIT 1',
    [CLIENT_NAME],
  );
  if (existingClient.length) {
    clientId = existingClient[0].id;
  } else {
    const res = await querySource(
      'INSERT INTO shivamgiri.md_clients (name, dialdesk_client_id, is_active) VALUES (?, ?, 1)',
      [CLIENT_NAME, PLACEHOLDER_DIALDESK_CLIENT_ID],
    );
    clientId = (res as unknown as { insertId: number }).insertId;
    console.log(`Created client "${CLIENT_NAME}" (id=${clientId}).`);
  }

  const res = await querySource(
    'INSERT INTO shivamgiri.md_processes (client_id, process_name, lob, dialdesk_client_id) VALUES (?, ?, ?, ?)',
    [clientId, PROCESS_NAME, 'Inbound', PLACEHOLDER_DIALDESK_CLIENT_ID],
  );
  const processId = (res as unknown as { insertId: number }).insertId;
  console.log(`Registered process "${PROCESS_NAME}" (id=${processId}, client_id=${clientId}).`);
}

function excelSerialToMysqlDate(serial: number): string {
  // Excel's day-1 epoch is 1899-12-30 in the (correct, non-1900-leap-bug) JS interpretation used by
  // the xlsx library's own date math.
  const ms = Math.round((serial - 25569) * 86400 * 1000);
  return new Date(ms).toISOString().slice(0, 10);
}

function parseDurationToSeconds(s: unknown): number {
  const m = /(\d+)\s*min\s*(\d+)?\s*sec/.exec(String(s ?? ''));
  if (!m) return 0;
  return Number(m[1]) * 60 + Number(m[2] || 0);
}

function flag(v: unknown): number {
  return Number(v) === 1 ? 1 : 0;
}

async function importExcel(): Promise<void> {
  const wb = XLSX.readFile(EXCEL_PATH);
  const sheetName = wb.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[sheetName], { defval: null });
  console.log(`Read ${rows.length} rows from ${EXCEL_PATH} (sheet "${sheetName}").`);

  const pool = getMasmisPool();
  let inserted = 0, updated = 0;

  for (const r of rows) {
    const values: Record<(typeof SBI_QUALITY_COLUMNS)[number], unknown> = {
      sr_no: r['Sr No'] ?? null,
      call_date: excelSerialToMysqlDate(Number(r['Date'])),
      call_id: r['Call ID'],
      scenario: r['Scenario'],
      agent_name: r['Agent Name'],
      agent_phone: r['Dummy Agent Phone'],
      agent_id: r['Dummy Agent ID'],
      customer_name: r['Customer Name'],
      customer_phone: r['Dummy Customer Phone'],
      customer_id: r['Dummy Customer ID'],
      bucket: r['Bucket'],
      language: r['Language'],
      duration_sec: parseDurationToSeconds(r['Approx Duration']),
      transcript: r['Transcript'],
      proper_opening: flag(r['proper_opening']),
      customer_verified: flag(r['customer_verified']),
      call_purpose_explained: flag(r['call_purpose_explained']),
      payment_status_discussed: flag(r['payment_status_discussed']),
      non_payment_reason_identified: flag(r['non_payment_reason_identified']),
      appropriate_probing: flag(r['appropriate_probing']),
      payment_commitment_obtained: flag(r['payment_commitment_obtained']),
      commitment_date_captured: flag(r['commitment_date_captured']),
      customer_concern_acknowledged: flag(r['customer_concern_acknowledged']),
      agent_empathy: flag(r['agent_empathy']),
      professional_tone: flag(r['professional_tone']),
      abusive_language_by_agent: flag(r['abusive_language_by_agent']),
      threatening_behavior: flag(r['threatening_behavior']),
      coercion_or_pressure: flag(r['coercion_or_pressure']),
      otp_requested: flag(r['otp_requested']),
      pin_requested: flag(r['pin_requested']),
      cvv_requested: flag(r['cvv_requested']),
      password_requested: flag(r['password_requested']),
      unauthorized_payment_instruction: flag(r['unauthorized_payment_instruction']),
      third_party_disclosure: flag(r['third_party_disclosure']),
      payment_information_accuracy: flag(r['payment_information_accuracy']),
      dispute_handling: flag(r['dispute_handling']),
      objection_handling: flag(r['objection_handling']),
      callback_handling: flag(r['callback_handling']),
      proper_call_closure: flag(r['proper_call_closure']),
      frustration_level: r['Customer Frustration Level'],
      frustration_detected: flag(r['Customer Frustration Detected']),
      customer_abusing: flag(r['Customer Abusing']),
      abusive_sentence: r['Abusive / Frustrated Sentence'],
      customer_sentiment: r['Customer Sentiment'],
      call_outcome: r['Call Outcome'],
    };

    const cols = SBI_QUALITY_COLUMNS;
    const placeholders = cols.map(() => '?').join(', ');
    const updateClause = cols.filter(c => c !== 'call_id').map(c => `${c} = VALUES(${c})`).join(', ');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [result] = await pool.execute(
      `INSERT INTO db_masmis.sbi_quality (${cols.join(', ')}) VALUES (${placeholders})
       ON DUPLICATE KEY UPDATE ${updateClause}`,
      cols.map(c => values[c]) as any[],
    );
    const affected = (result as { affectedRows: number }).affectedRows;
    if (affected === 1) inserted++; else updated++;
  }

  console.log(`Import complete: ${inserted} new row(s), ${updated} updated/unchanged row(s).`);
}

async function main() {
  await initSbiQualityTable();
  await ensureClientAndProcess();
  await importExcel();
}

main()
  .then(async () => {
    await getSourcePool().end().catch(() => {});
    await getMasmisPool().end().catch(() => {});
    process.exit(0);
  })
  .catch(async (e) => {
    console.error(e);
    await getSourcePool().end().catch(() => {});
    await getMasmisPool().end().catch(() => {});
    process.exit(1);
  });
