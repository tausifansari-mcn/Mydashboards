import 'dotenv/config';
import { querySource } from '../lib/sourceDb';
import { queryMasmis } from '../lib/masmisDb';
import { VIDEO_PHRASES } from '../modules/inbound-quality/inbound-quality.service';
import { createHash } from 'crypto';

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

  // Clear old cache
  await queryMasmis(`TRUNCATE TABLE ${TABLE}`, []);
  console.log('Cache cleared.');

  // Update version hash
  const raw = VIDEO_PHRASES.map(p => `${p.id}:${p.patterns.length}`).join('|');
  const versionHash = createHash('sha256').update(raw).digest('hex').slice(0, 64);
  await queryMasmis(
    `INSERT INTO db_masmis.video_phrase_version (id, version) VALUES (1, ?) ON DUPLICATE KEY UPDATE version = VALUES(version)`,
    [versionHash]
  );
  console.log('Version hash updated.');

  // Scan August 2026 transcripts
  const b1 = await querySource<{ lead_id: string }>(
    `SELECT lead_id FROM db_audit.call_quality_assessment WHERE ClientId = '${CID}' AND CallDate >= '2026-08-01' AND CallDate < '2026-09-01' AND scenario = 'Complaint' LIMIT 100`, []
  );
  const b2 = await querySource<{ lead_id: string }>(
    `SELECT lead_id FROM db_audit.call_quality_assessment WHERE ClientId = '${CID}' AND CallDate >= '2026-08-01' AND CallDate < '2026-09-01' AND scenario = 'Query' LIMIT 100`, []
  );
  const b3 = await querySource<{ lead_id: string }>(
    `SELECT lead_id FROM db_audit.call_quality_assessment WHERE ClientId = '${CID}' AND CallDate >= '2026-08-01' AND CallDate < '2026-09-01' AND scenario = 'Repeat' LIMIT 100`, []
  );

  const allIds = [...b1, ...b2, ...b3];
  const seen = new Set<string>();
  const unique = allIds.filter(r => { if (seen.has(r.lead_id)) return false; seen.add(r.lead_id); return true; });
  console.log(`Scanning ${unique.length} August 2026 transcripts with ${VIDEO_PHRASES.length} phrase categories...\n`);

  let inserted = 0;
  let scanned = 0;

  for (const { lead_id } of unique) {
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

  // Set cursor past all processed records
  await queryMasmis(`INSERT INTO db_masmis.video_phrase_cursor (id, last_qa_id) VALUES (1, 999999999) ON DUPLICATE KEY UPDATE last_qa_id = 999999999`, []).catch(() => {});

  // Verify
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
