import 'dotenv/config';
import { querySource } from '../lib/sourceDb';

(async () => {
  const CID = '375';

  // Count Bellavita August transcripts
  const augCount = await querySource<{ cnt: number }>(
    `SELECT COUNT(*) AS cnt FROM db_audit.call_quality_assessment WHERE ClientId = '${CID}' AND CallDate >= '2026-08-01' AND CallDate < '2026-09-01'`, []
  );
  console.log(`Bellavita August 2026 transcripts: ${augCount[0].cnt}`);

  // Count with actual transcripts
  const augWithTx = await querySource<{ cnt: number }>(
    `SELECT COUNT(*) AS cnt FROM db_audit.call_quality_assessment WHERE ClientId = '${CID}' AND CallDate >= '2026-08-01' AND CallDate < '2026-09-01' AND Transcribe_Text IS NOT NULL AND Transcribe_Text != ''`, []
  );
  console.log(`Bellavita August 2026 with transcript text: ${augWithTx[0].cnt}`);

  // Sample a few
  const sample = await querySource<{ lead_id: string; CallDate: string; scenario: string; has_tx: number }>(
    `SELECT lead_id, DATE_FORMAT(CallDate, '%Y-%m-%d') AS CallDate, scenario,
            (CASE WHEN Transcribe_Text IS NOT NULL AND Transcribe_Text != '' THEN 1 ELSE 0 END) AS has_tx
     FROM db_audit.call_quality_assessment WHERE ClientId = '${CID}' AND CallDate >= '2026-08-01' AND CallDate < '2026-09-01'
     ORDER BY CallDate DESC LIMIT 10`, []
  );
  console.log('\nSample August leads:');
  for (const r of sample) console.log(`  ${r.lead_id} | ${r.CallDate} | ${r.scenario} | has_tx=${r.has_tx}`);

  // Monthly breakdown for Bellavita 2026
  const monthly = await querySource<{ month: string; cnt: number; with_tx: number }>(
    `SELECT DATE_FORMAT(CallDate, '%Y-%m') AS month,
            COUNT(*) AS cnt,
            SUM(CASE WHEN Transcribe_Text IS NOT NULL AND Transcribe_Text != '' THEN 1 ELSE 0 END) AS with_tx
     FROM db_audit.call_quality_assessment WHERE ClientId = '${CID}' AND YEAR(CallDate) = 2026
     GROUP BY month ORDER BY month`, []
  );
  console.log('\nBellavita 2026 monthly breakdown:');
  for (const r of monthly) console.log(`  ${r.month}: ${r.cnt} total, ${r.with_tx} with transcript`);

  process.exit(0);
})();
