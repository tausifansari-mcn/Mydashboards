import 'dotenv/config';
import { queryMasmis } from '../lib/masmisDb';

(async () => {
  // Check what Bellavita transcript data exists for August 2026
  const rows = await queryMasmis<{ lead_id: string; call_date: string; status: string; has_transcript: number }>(
    `SELECT l.lead_id, DATE_FORMAT(l.created_at, '%Y-%m-%d') AS call_date,
            l.status,
            (CASE WHEN ct.lead_id IS NOT NULL THEN 1 ELSE 0 END) AS has_transcript
     FROM leads l
     LEFT JOIN db_masmis.lead_call_transcript ct ON ct.lead_id = l.lead_id
     WHERE l.brand = 'Bellavita'
       AND YEAR(l.created_at) = 2026
       AND MONTH(l.created_at) = 8
     ORDER BY l.created_at DESC
     LIMIT 30`, []
  );
  console.log('August 2026 Bellavita leads:');
  if (rows.length === 0) console.log('  NONE');
  for (const r of rows) console.log(`  ${r.lead_id} | ${r.call_date} | status=${r.status} | transcript=${r.has_transcript}`);
  console.log('Total:', rows.length);

  // Count transcripts specifically
  const counts = await queryMasmis<{ cnt: number }>(
    `SELECT COUNT(*) AS cnt FROM db_masmis.lead_call_transcript ct
     JOIN leads l ON l.lead_id = ct.lead_id
     WHERE l.brand = 'Bellavita' AND YEAR(l.created_at) = 2026 AND MONTH(l.created_at) = 8`, []
  );
  console.log('\nAugust 2026 Bellavita transcripts:', counts[0].cnt);

  // Check all brands in August
  const allBrands = await queryMasmis<{ brand: string; cnt: number }>(
    `SELECT l.brand, COUNT(*) AS cnt FROM leads l
     WHERE YEAR(l.created_at) = 2026 AND MONTH(l.created_at) = 8
     GROUP BY l.brand ORDER BY cnt DESC`, []
  );
  console.log('\nAll brands in August 2026:');
  for (const r of allBrands) console.log(`  ${r.brand}: ${r.cnt}`);

  process.exit(0);
})();
