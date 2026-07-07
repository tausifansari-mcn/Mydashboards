import 'dotenv/config';
import * as XLSX from 'xlsx';
import { getSourcePool } from '../lib/sourceDb';

const EXCEL_PATH = 'C:\\Users\\MAS60358\\Desktop\\Product List.xlsx';

function fixEncoding(s: string): string {
  // Fix garbled Windows-1252 → UTF-8 sequences (e.g. â€" → –, â€™ → ')
  return s
    .replace(/â€"/g,  '–')
    .replace(/â€"/g,  '—')
    .replace(/â€™/g,  "'")
    .replace(/Â /g,   ' ')
    .replace(/Â/g,    '')
    .trim();
}

function isValidName(raw: unknown): boolean {
  if (raw === null || raw === undefined) return false;
  const s = String(raw).trim();
  // Skip blanks, single-char noise, pure numbers, known junk
  if (s.length <= 1) return false;
  if (/^\d+$/.test(s)) return false;
  const junk = new Set(['-', '.', 'upb', 'Na', 'ssc', 'slk', 'flash', 'supreme', 'combo',
    'DEO', 'FACEWASH', 'deodrant', 'bodywash', 'perfume', 'face wash', 'sunscreen',
    'attars', 'roll on', 'MODE', 'BEAST MODE', 'OPCEAN BLU', 'blu man', 'gift set',
    'soup face wash', 'taaj attar set', 'FANTASY HER', 'black magic hair powder']);
  return !junk.has(s);
}

async function run() {
  const pool = getSourcePool();

  // 1. Create schema
  await pool.execute(
    `CREATE DATABASE IF NOT EXISTS db_masmis CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  );
  console.log('Database db_masmis ready.');

  // 2. Create table
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS db_masmis.md_products (
      id             INT           AUTO_INCREMENT PRIMARY KEY,
      client_id      INT           NOT NULL COMMENT 'dialdesk_client_id',
      line_item_name VARCHAR(500)  NOT NULL,
      process        VARCHAR(100)  NOT NULL,
      is_active      TINYINT(1)    NOT NULL DEFAULT 1,
      display_order  INT           NOT NULL DEFAULT 0,
      created_at     TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at     TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_client (client_id),
      INDEX idx_process (process)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log('Table db_masmis.md_products ready.');

  // 3. Read Excel
  const wb = XLSX.readFile(EXCEL_PATH);
  const ws = wb.Sheets['Sheet1'];
  const rows = XLSX.utils.sheet_to_json<{ client_id: number; 'Line Item Name': unknown; Process: string }>(ws);

  let inserted = 0;
  let skipped  = 0;

  for (const row of rows) {
    const rawName = row['Line Item Name'];
    if (!isValidName(rawName)) { skipped++; continue; }

    const name      = fixEncoding(String(rawName));
    const clientId  = Number(row.client_id) || 375;
    const process   = (row.Process ?? 'Bellavita').toString().trim();

    await pool.execute(
      `INSERT INTO db_masmis.md_products (client_id, line_item_name, process)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE line_item_name = VALUES(line_item_name)`,
      [clientId, name, process]
    );
    inserted++;
  }

  console.log(`Done — inserted/updated: ${inserted}  |  skipped (junk): ${skipped}`);
  await pool.end();
}

run().catch(err => { console.error(err); process.exit(1); });
