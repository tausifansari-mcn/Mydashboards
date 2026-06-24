import 'dotenv/config';
import { querySource } from '../lib/sourceDb';

async function run() {
  const start = '2025-01-01';
  const end = '2025-03-31';

  console.log('\n=== quality assessment day query ===');
  try {
    const r = await querySource<{ dow: unknown; cnt: unknown }>(`
      SELECT DAYOFWEEK(CallDate) - 1 AS dow, COUNT(*) AS cnt
      FROM db_audit.call_quality_assessment
      WHERE CallDate BETWEEN ? AND ?
      GROUP BY DAYOFWEEK(CallDate)
    `, [start, end]);
    console.log('Rows:', JSON.stringify(r));
    console.log('Types:', r.map(row => ({ dow: typeof row.dow, cnt: typeof row.cnt, dowVal: row.dow })));
  } catch (e: any) { console.error('FAIL:', e.message, e.code); }

  console.log('\n=== CallDetails day query ===');
  try {
    const r = await querySource<{ dow: unknown; cnt: unknown }>(`
      SELECT DAYOFWEEK(CallDate) - 1 AS dow, COUNT(*) AS cnt
      FROM db_external.CallDetails
      WHERE CallDate BETWEEN ? AND ?
      GROUP BY DAYOFWEEK(CallDate)
    `, [start, end]);
    console.log('Rows:', JSON.stringify(r));
    console.log('Types:', r.map(row => ({ dow: typeof row.dow, cnt: typeof row.cnt, dowVal: row.dow })));
  } catch (e: any) { console.error('FAIL:', e.message, e.code); }

  console.log('\n=== Simulating forEach ===');
  try {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const results: Record<number, { day: string; inbound: number; outbound: number }> = {};
    days.forEach((d, i) => { results[i] = { day: d, inbound: 0, outbound: 0 }; });

    const qRows = await querySource<{ dow: any; cnt: any }>(`
      SELECT DAYOFWEEK(CallDate) - 1 AS dow, COUNT(*) AS cnt
      FROM db_audit.call_quality_assessment
      WHERE CallDate BETWEEN ? AND ?
      GROUP BY DAYOFWEEK(CallDate)
    `, [start, end]);

    console.log('qRows:', JSON.stringify(qRows));
    qRows.forEach((r) => {
      console.log(`Processing r.dow=${r.dow} (${typeof r.dow}), results[r.dow]=${JSON.stringify(results[r.dow])}`);
      if (results[r.dow] === undefined) {
        console.error('BUG: results[r.dow] is undefined! r.dow =', r.dow, 'type:', typeof r.dow);
      } else {
        results[r.dow].inbound = Number(r.cnt);
      }
    });

    const oRows = await querySource<{ dow: any; cnt: any }>(`
      SELECT DAYOFWEEK(CallDate) - 1 AS dow, COUNT(*) AS cnt
      FROM db_external.CallDetails
      WHERE CallDate BETWEEN ? AND ?
      GROUP BY DAYOFWEEK(CallDate)
    `, [start, end]);

    console.log('oRows:', JSON.stringify(oRows));
    oRows.forEach((r) => {
      console.log(`Processing r.dow=${r.dow} (${typeof r.dow}), results[r.dow]=${JSON.stringify(results[r.dow])}`);
      if (results[r.dow] === undefined) {
        console.error('BUG: results[r.dow] is undefined! r.dow =', r.dow, 'type:', typeof r.dow);
      } else {
        results[r.dow].outbound = Number(r.cnt);
      }
    });

    console.log('Final:', JSON.stringify(Object.values(results)));
  } catch (e: any) { console.error('Simulation FAIL:', e.message, e.stack); }

  process.exit(0);
}

run().catch((e) => { console.error('Fatal:', e); process.exit(1); });
