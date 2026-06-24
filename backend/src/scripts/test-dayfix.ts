import 'dotenv/config';
import { querySource } from '../lib/sourceDb';

async function run() {
  const start = '2025-01-01';
  const end = '2025-03-31';

  console.log('\n=== Fixed quality DOW query ===');
  try {
    const r = await querySource<{ dow: number; cnt: number }>(`
      SELECT (DAYOFWEEK(CallDate) - 1) AS dow, COUNT(*) AS cnt
      FROM db_audit.call_quality_assessment
      WHERE CallDate BETWEEN ? AND ?
      GROUP BY (DAYOFWEEK(CallDate) - 1)
    `, [start, end]);
    console.log('OK:', JSON.stringify(r));
  } catch (e: any) { console.error('FAIL:', e.message); }

  console.log('\n=== Fixed CallDetails DOW query ===');
  try {
    const r = await querySource<{ dow: number; cnt: number }>(`
      SELECT (DAYOFWEEK(CallDate) - 1) AS dow, COUNT(*) AS cnt
      FROM db_external.CallDetails
      WHERE CallDate BETWEEN ? AND ?
      GROUP BY (DAYOFWEEK(CallDate) - 1)
    `, [start, end]);
    console.log('OK:', JSON.stringify(r));
  } catch (e: any) { console.error('FAIL:', e.message); }

  console.log('\n=== Quality trend DATE_FORMAT daily ===');
  try {
    const r = await querySource<{ period: string; quality: number; calls: number }>(`
      SELECT DATE_FORMAT(CallDate, '%Y-%m-%d') AS period, ROUND(AVG(quality_percentage), 2) AS quality, COUNT(*) AS calls
      FROM db_audit.call_quality_assessment
      WHERE CallDate BETWEEN ? AND ?
      GROUP BY DATE_FORMAT(CallDate, '%Y-%m-%d')
      ORDER BY period ASC LIMIT 5
    `, [start, end]);
    console.log('OK (first 5):', JSON.stringify(r));
  } catch (e: any) { console.error('FAIL:', e.message); }

  process.exit(0);
}

run().catch((e) => { console.error(e); process.exit(1); });
