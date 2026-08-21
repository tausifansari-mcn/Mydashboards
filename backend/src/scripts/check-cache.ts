import 'dotenv/config';
import { queryMasmis } from '../lib/masmisDb';

(async () => {
  const rows = await queryMasmis<{ phrase_id: string; call_date: string; lead_id: string; context: string }>(
    'SELECT phrase_id, DATE_FORMAT(call_date, "%Y-%m-%d") AS call_date, lead_id, LEFT(context, 120) AS context FROM db_masmis.video_phrase_cache ORDER BY phrase_id, call_date', []
  );
  console.log('All cache entries:\n');
  for (const r of rows) console.log(`  ${r.phrase_id} | ${r.call_date} | ${r.lead_id} | ${r.context}`);

  console.log(`\nTotal: ${rows.length}`);

  const byPhrase = await queryMasmis<{ phrase_id: string; cnt: number }>(
    'SELECT phrase_id, COUNT(*) AS cnt FROM db_masmis.video_phrase_cache GROUP BY phrase_id ORDER BY cnt DESC', []
  );
  console.log('\nBy phrase:');
  for (const r of byPhrase) console.log(`  ${r.phrase_id}: ${r.cnt}`);

  process.exit(0);
})();
