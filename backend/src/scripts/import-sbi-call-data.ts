// Imports the SBI "Call Data" export into db_masmis.sbi_quality.
//
// Dates: the export's Call Date is a timestamp in Sept 2026. Per review instructions the dummy data
// is moved into October 2026 — the day of month and the time of day are kept, only the month changes
// (1-Sep 00:00:50 -> 1-Oct 00:00:50). Times are read as local wall-clock time (the xlsx library
// converts Excel's naive local timestamps to Date objects; reading the local getters recovers the
// original wall time, reading UTC would shift every row back a day in India).
//
// Re-runnable: rows are upserted by call_id.
import 'dotenv/config';
import XLSX from 'xlsx';
import { getMasmisPool } from '../lib/masmisDb';
import { getSourcePool } from '../lib/sourceDb';
import { initSbiQualityTable, SBI_QUALITY_COLUMNS, SBI_QUALITY_EXTRA_COLUMNS } from '../modules/sbi-quality/sbi-quality.service';

const FILE = 'C:/Users/MAS60358/Desktop/SBI/Call Data.xlsx';
const TARGET_MONTH = 9; // October (0-based)

const FLAGS = [
  'proper_opening', 'customer_verified', 'call_purpose_explained', 'payment_status_discussed',
  'non_payment_reason_identified', 'appropriate_probing', 'payment_commitment_obtained',
  'commitment_date_captured', 'customer_concern_acknowledged', 'agent_empathy', 'professional_tone',
  'abusive_language_by_agent', 'threatening_behavior', 'coercion_or_pressure', 'otp_requested',
  'pin_requested', 'cvv_requested', 'password_requested', 'unauthorized_payment_instruction',
  'third_party_disclosure', 'payment_information_accuracy', 'dispute_handling', 'objection_handling',
  'callback_handling', 'proper_call_closure',
];

// Excel header -> table column, for everything that isn't a same-named flag.
const HEADER_MAP: Record<string, string> = {
  'Sr No': 'sr_no', 'Call ID': 'call_id', 'Scenario': 'scenario', 'Agent Name': 'agent_name',
  'Dummy Agent Phone': 'agent_phone', 'Dummy Agent ID': 'agent_id', 'Customer Name': 'customer_name',
  'Dummy Customer Phone': 'customer_phone', 'Dummy Customer ID': 'customer_id', 'Bucket': 'bucket',
  'Language': 'language', 'Transcript': 'transcript',
  'Customer Frustration Level': 'frustration_level', 'Customer Frustration Detected': 'frustration_detected',
  'Customer Abusing': 'customer_abusing', 'Abusive / Frustrated Sentence': 'abusive_sentence',
  'Customer Sentiment': 'customer_sentiment', 'Call Outcome': 'call_outcome',
  'Customer Intent': 'customer_intent', 'Customer Validity': 'customer_validity',
  'Genuine / Payable': 'genuine_payable', 'Non-Payable / Invalid Reason': 'non_payable_reason',
  'Payment Status': 'payment_status', 'Payment Made': 'payment_made', 'Call Required': 'call_required',
  'Call Priority': 'call_priority', 'Recommended Next Action': 'recommended_next_action',
  'QA Evidence / Customer Statement': 'qa_statement', 'Primary Emotion': 'primary_emotion',
  'Frustration Reason': 'frustration_reason', 'Anger / Abuse Reason': 'anger_abuse_reason',
};

const pad = (n: number) => String(n).padStart(2, '0');
const toMysqlDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toMysqlDateTime = (d: Date) => `${toMysqlDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
function parseDurationToSeconds(s: unknown): number {
  const m = /(\d+)\s*min\s*(\d+)?\s*sec/.exec(String(s ?? ''));
  return m ? Number(m[1]) * 60 + Number(m[2] || 0) : 0;
}
const flag = (v: unknown) => (Number(v) === 1 ? 1 : 0);
const nullIfEmpty = (v: unknown) => (v === null || v === undefined || v === '' || v === 'null' ? null : v);

async function main() {
  await initSbiQualityTable();

  const wb = XLSX.readFile(FILE, { cellDates: true });
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]], { defval: null, raw: true });
  const headers = Object.keys(rows[0]);
  const mapped = new Set([...headers.filter(h => HEADER_MAP[h]), ...FLAGS.filter(f => headers.includes(f)), 'Call Date', 'Date', 'Approx Duration']);
  const unmapped = headers.filter(h => !mapped.has(h));
  console.log(`Read ${rows.length} rows, ${headers.length} columns.`);
  console.log(`Unmapped source columns (not stored): ${unmapped.length ? unmapped.join(', ') : 'none'}`);

  const pool = getMasmisPool();
  const cols = [...SBI_QUALITY_COLUMNS, ...SBI_QUALITY_EXTRA_COLUMNS.map(([c]) => c)] as string[];
  const dateRange = new Map<string, number>();
  let inserted = 0, updated = 0;

  for (const r of rows) {
    const raw = r['Call Date'];
    const src = raw instanceof Date ? raw : new Date((Number(raw) - 25569) * 86400 * 1000);
    const shifted = new Date(src.getFullYear(), TARGET_MONTH, src.getDate(), src.getHours(), src.getMinutes(), src.getSeconds());
    dateRange.set(toMysqlDate(shifted), (dateRange.get(toMysqlDate(shifted)) ?? 0) + 1);

    const v: Record<string, unknown> = {};
    for (const [h, col] of Object.entries(HEADER_MAP)) v[col] = nullIfEmpty(r[h]);
    for (const f of FLAGS) v[f] = flag(r[f]);
    v.call_date = toMysqlDate(shifted);
    v.call_datetime = toMysqlDateTime(shifted);
    v.duration_sec = parseDurationToSeconds(r['Approx Duration']);

    const placeholders = cols.map(() => '?').join(', ');
    const updateClause = cols.filter(c => c !== 'call_id').map(c => `${c} = VALUES(${c})`).join(', ');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [result] = await pool.execute(
      `INSERT INTO db_masmis.sbi_quality (${cols.join(', ')}) VALUES (${placeholders}) ON DUPLICATE KEY UPDATE ${updateClause}`,
      cols.map(c => (v[c] === undefined ? null : v[c])) as any[],
    );
    const affected = (result as { affectedRows: number }).affectedRows;
    if (affected === 1) inserted++; else updated++;
  }

  console.log(`Upserted: ${inserted} new, ${updated} updated (matched existing call_id).`);
  console.log('New dates (October 2026), rows per day:', Object.fromEntries([...dateRange.entries()].sort()));
  const [countRows] = await pool.query('SELECT COUNT(*) AS n FROM db_masmis.sbi_quality');
  console.log('Rows now in db_masmis.sbi_quality:', (countRows as { n: number }[])[0].n);
}

main()
  .then(async () => { await getMasmisPool().end().catch(() => {}); await getSourcePool().end().catch(() => {}); process.exit(0); })
  .catch(async e => { console.error('FATAL:', e); await getMasmisPool().end().catch(() => {}); await getSourcePool().end().catch(() => {}); process.exit(1); });
