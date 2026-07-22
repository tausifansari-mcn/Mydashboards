import 'dotenv/config';
import { getSourcePool } from '../lib/sourceDb';

(async () => {
  const pool = getSourcePool();

  const [existing]: any = await pool.query(`SHOW INDEX FROM db_external.CallDetails WHERE Key_name = 'idx_transcribe_ft'`);
  if (existing.length > 0) {
    console.log('FULLTEXT index already exists, skipping.');
    process.exit(0);
  }

  console.log('Creating FULLTEXT index on db_external.CallDetails.TranscribeText...');
  const start = Date.now();
  await pool.query(`ALTER TABLE db_external.CallDetails ADD FULLTEXT INDEX idx_transcribe_ft (TranscribeText)`);
  console.log(`Done in ${((Date.now() - start) / 1000).toFixed(1)}s`);
  process.exit(0);
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
