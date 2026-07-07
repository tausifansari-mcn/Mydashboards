import 'dotenv/config';
import { querySource } from '../lib/sourceDb';
async function go() {
  const scens = await querySource<{scenario:string;cnt:number}>(
    `SELECT scenario, COUNT(*) as cnt FROM db_audit.call_quality_assessment WHERE CallDate BETWEEN '2026-01-01' AND '2026-07-07' AND ClientId=375 AND quality_percentage IS NOT NULL GROUP BY scenario ORDER BY cnt DESC LIMIT 20`, []
  );
  console.log('Scenarios:', JSON.stringify(scens));

  const ov = await querySource<{total:number;pos:number;neg:number}>(
    `SELECT COUNT(*) as total, SUM(CASE WHEN top_positive_words IS NOT NULL AND top_positive_words != '' THEN 1 ELSE 0 END) as pos, SUM(CASE WHEN top_negative_words IS NOT NULL AND top_negative_words != '' THEN 1 ELSE 0 END) as neg FROM db_audit.call_quality_assessment WHERE CallDate BETWEEN '2026-01-01' AND '2026-07-07' AND ClientId=375 AND quality_percentage IS NOT NULL`, []
  );
  console.log('Overall:', JSON.stringify(ov));

  // Check Transcribe_Text for product mentions
  const tx = await querySource<{txt:string; pos:string; neg:string}>(
    `SELECT Transcribe_Text as txt, top_positive_words as pos, top_negative_words as neg FROM db_audit.call_quality_assessment WHERE CallDate BETWEEN '2026-06-01' AND '2026-07-07' AND ClientId=375 AND quality_percentage IS NOT NULL AND Transcribe_Text IS NOT NULL AND Transcribe_Text != '' LIMIT 3`, []
  );
  console.log('Transcript sample:', JSON.stringify(tx));
  process.exit(0);
}
go().catch(e => { console.error(e.message); process.exit(1); });
