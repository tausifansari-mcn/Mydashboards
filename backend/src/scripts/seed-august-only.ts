import 'dotenv/config';
import { querySource } from '../lib/sourceDb';
import { queryMasmis } from '../lib/masmisDb';
import { VIDEO_PHRASES } from '../modules/inbound-quality/inbound-quality.service';

function matchesVideoPhrase(text: string, patterns: readonly string[]): { matched: boolean; context: string } {
  const lower = text.toLowerCase();
  for (const p of patterns) {
    const idx = lower.indexOf(p);
    if (idx !== -1) {
      const start = Math.max(0, idx - 80);
      const end = Math.min(text.length, idx + p.length + 80);
      return { matched: true, context: text.substring(start, end).trim() };
    }
  }
  return { matched: false, context: '' };
}

async function go() {
  const CID = '375';
  const TABLE = 'db_masmis.video_phrase_cache';

  // Do NOT truncate — only ADD August data
  console.log('Scanning August 2026 only (no truncation)...\n');

  const rows = await querySource<{ lead_id: string }>(
    `SELECT DISTINCT lead_id FROM db_audit.call_quality_assessment WHERE ClientId = '${CID}' AND CallDate >= '2026-08-01' AND CallDate < '2026-09-01'`, []
  );
  console.log(`Found ${rows.length} unique August leads.\n`);

  let inserted = 0;
  let scanned = 0;

  for (const { lead_id } of rows) {
    try {
      const meta = await querySource<{ CallDate: string; User: string; scenario: string }>(
        `SELECT DATE_FORMAT(CallDate, '%Y-%m-%d %H:%i:%s') AS CallDate, User, scenario
         FROM db_audit.call_quality_assessment WHERE lead_id = '${lead_id}' LIMIT 1`, []
      );
      if (!meta.length) continue;

      const textRows = await querySource<{ t: string }>(
        `SELECT Transcribe_Text AS t FROM db_audit.call_quality_assessment WHERE lead_id = '${lead_id}' LIMIT 1`, []
      );
      if (!textRows.length || !textRows[0].t) continue;
      scanned++;

      const text = textRows[0].t;

      for (const phrase of VIDEO_PHRASES) {
        const { matched, context } = matchesVideoPhrase(text, phrase.patterns);
        if (matched) {
          try {
            await queryMasmis(
              `INSERT IGNORE INTO ${TABLE} (lead_id, client_id, call_date, agent, scenario, phrase_id, context)
               VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [lead_id, CID, meta[0].CallDate, meta[0].User ?? null, meta[0].scenario ?? null, phrase.id, context]
            );
            inserted++;
          } catch { }
        }
      }
      process.stdout.write(`  ${scanned}..`);
    } catch { }
  }

  console.log(`\n\nScanned: ${scanned}, Phrase hits inserted: ${inserted}`);

  const cache = await queryMasmis<{ cnt: number }>(`SELECT COUNT(*) AS cnt FROM ${TABLE}`, []);
  console.log(`Cache now has ${cache[0]?.cnt} rows`);

  const byPhrase = await queryMasmis<{ phrase_id: string; cnt: number }>(
    `SELECT phrase_id, COUNT(DISTINCT lead_id) AS cnt FROM ${TABLE} GROUP BY phrase_id ORDER BY cnt DESC`, []
  );
  console.log(`\nBy phrase:`);
  for (const r of byPhrase) console.log(`  ${r.phrase_id}: ${r.cnt}`);

  process.exit(0);
}
go().catch(e => { console.error('ERR:', e.message); process.exit(1); });
