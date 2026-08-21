import 'dotenv/config';
import { queryMasmis } from '../lib/masmisDb';

(async () => {
  const rows = await queryMasmis<{ phrase_id: string; call_date: string; lead_id: string }>(
    `SELECT phrase_id, DATE_FORMAT(call_date, '%Y-%m-%d') AS call_date, lead_id 
     FROM db_masmis.video_phrase_cache 
     WHERE MONTH(call_date) = 8 AND YEAR(call_date) = 2026 
     ORDER BY phrase_id, call_date`, []
  );
  console.log('August 2026 entries (current month):');
  if (rows.length === 0) console.log('  NONE');
  for (const r of rows) console.log('  ' + r.phrase_id + ' | ' + r.call_date + ' | ' + r.lead_id);
  console.log('Total:', rows.length);

  const byPhrase = await queryMasmis<{ phrase_id: string; cnt: number }>(
    `SELECT phrase_id, COUNT(*) AS cnt 
     FROM db_masmis.video_phrase_cache 
     WHERE MONTH(call_date) = 8 AND YEAR(call_date) = 2026 
     GROUP BY phrase_id ORDER BY cnt DESC`, []
  );
  console.log('\nAugust 2026 by phrase:');
  for (const r of byPhrase) console.log('  ' + r.phrase_id + ': ' + r.cnt);

  process.exit(0);
})();
