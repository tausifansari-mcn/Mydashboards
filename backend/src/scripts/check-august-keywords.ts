import 'dotenv/config';
import { querySource } from '../lib/sourceDb';

(async () => {
  const CID = '375';

  // Check if August transcripts contain any of the video phrase keywords
  const keywords = [
    'unboxing', 'unboxing video', 'empty box', 'empty parcel', 'empty daba',
    'video share', 'video bhej', 'short video', 'video bana',
    'mail par', 'email par', 'email bhej', 'mail bhej', 'video send',
    'complaint raise', 'complaint nahin', 'complaint nahi',
    'chaubis', 'adtaalis', '48 hours', '24 hours',
    'whatsapp kar', 'whatsapp par'
  ];

  console.log('Checking August 2026 Bellavita transcripts for phrase keywords:\n');
  for (const kw of keywords) {
    const rows = await querySource<{ cnt: number }>(
      `SELECT COUNT(*) AS cnt FROM db_audit.call_quality_assessment 
       WHERE ClientId = '${CID}' 
       AND CallDate >= '2026-08-01' AND CallDate < '2026-09-01'
       AND LOWER(Transcribe_Text) LIKE '%${kw.toLowerCase()}%'`, []
    );
    if (rows[0].cnt > 0) {
      console.log(`  "${kw}": ${rows[0].cnt} hits`);
    }
  }

  // Check total unique lead_ids for August Bellavita
  const count = await querySource<{ cnt: number }>(
    `SELECT COUNT(DISTINCT lead_id) AS cnt FROM db_audit.call_quality_assessment 
     WHERE ClientId = '${CID}' AND CallDate >= '2026-08-01' AND CallDate < '2026-09-01'`, []
  );
  console.log(`\nTotal unique lead_ids in August: ${count[0].cnt}`);

  // Show some sample transcripts with keywords
  const sample = await querySource<{ lead_id: string; CallDate: string; snippet: string }>(
    `SELECT lead_id, DATE_FORMAT(CallDate, '%Y-%m-%d') AS CallDate,
            LEFT(LOWER(Transcribe_Text), 300) AS snippet
     FROM db_audit.call_quality_assessment 
     WHERE ClientId = '${CID}' AND CallDate >= '2026-08-01' AND CallDate < '2026-09-01'
     AND LOWER(Transcribe_Text) LIKE '%unboxing%'
     LIMIT 5`, []
  );
  console.log('\nAugust transcripts mentioning "unboxing":');
  for (const r of sample) console.log(`  ${r.lead_id} | ${r.CallDate} | ${r.snippet}`);

  const sample2 = await querySource<{ lead_id: string; CallDate: string; snippet: string }>(
    `SELECT lead_id, DATE_FORMAT(CallDate, '%Y-%m-%d') AS CallDate,
            LEFT(LOWER(Transcribe_Text), 300) AS snippet
     FROM db_audit.call_quality_assessment 
     WHERE ClientId = '${CID}' AND CallDate >= '2026-08-01' AND CallDate < '2026-09-01'
     AND (LOWER(Transcribe_Text) LIKE '%empty box%' OR LOWER(Transcribe_Text) LIKE '%empty parcel%')
     LIMIT 5`, []
  );
  console.log('\nAugust transcripts mentioning "empty box" or "empty parcel":');
  for (const r of sample2) console.log(`  ${r.lead_id} | ${r.CallDate} | ${r.snippet}`);

  const sample3 = await querySource<{ lead_id: string; CallDate: string; snippet: string }>(
    `SELECT lead_id, DATE_FORMAT(CallDate, '%Y-%m-%d') AS CallDate,
            LEFT(LOWER(Transcribe_Text), 300) AS snippet
     FROM db_audit.call_quality_assessment 
     WHERE ClientId = '${CID}' AND CallDate >= '2026-08-01' AND CallDate < '2026-09-01'
     AND (LOWER(Transcribe_Text) LIKE '%short video%' OR LOWER(Transcribe_Text) LIKE '%video share%')
     LIMIT 5`, []
  );
  console.log('\nAugust transcripts mentioning "short video" or "video share":');
  for (const r of sample3) console.log(`  ${r.lead_id} | ${r.CallDate} | ${r.snippet}`);

  process.exit(0);
})();
