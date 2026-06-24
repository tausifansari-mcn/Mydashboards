import 'dotenv/config';
import { querySource } from '../lib/sourceDb';

async function run() {
  const start = '2024-01-01';
  const end = '2026-12-31';

  console.log('\n1. Testing basic connection...');
  try {
    const r = await querySource('SELECT 1 AS ok');
    console.log('OK:', r);
  } catch (e: any) { console.error('FAIL:', e.message); }

  console.log('\n2. Testing db_audit.call_quality_assessment count...');
  try {
    const r = await querySource<{ cnt: number }>('SELECT COUNT(*) AS cnt FROM db_audit.call_quality_assessment');
    console.log('Rows:', r[0]);
  } catch (e: any) { console.error('FAIL:', e.message); }

  console.log('\n3. Testing db_external.CallDetails count...');
  try {
    const r = await querySource<{ cnt: number }>('SELECT COUNT(*) AS cnt FROM db_external.CallDetails');
    console.log('Rows:', r[0]);
  } catch (e: any) { console.error('FAIL:', e.message); }

  console.log('\n4. Testing cross-DB join (shivamgiri.md_clients)...');
  try {
    const r = await querySource<{ client_name: string; cnt: number }>(`
      SELECT
        COALESCE(c.name, CONCAT('Client ', q.ClientId)) AS client_name,
        COUNT(*) AS cnt
      FROM db_audit.call_quality_assessment q
      LEFT JOIN shivamgiri.md_clients c ON c.dialdesk_client_id = CAST(q.ClientId AS UNSIGNED)
      WHERE q.CallDate BETWEEN ? AND ?
      GROUP BY q.ClientId, c.name
      LIMIT 5
    `, [start, end]);
    console.log('Cross-DB join result:', r);
  } catch (e: any) { console.error('FAIL:', e.message); }

  console.log('\n5. Testing KPI query...');
  try {
    const r = await querySource<{ total: number; avg_quality: number }>(`
      SELECT
        COUNT(*) AS total,
        ROUND(AVG(quality_percentage), 2) AS avg_quality
      FROM db_audit.call_quality_assessment
      WHERE CallDate BETWEEN ? AND ?
    `, [start, end]);
    console.log('KPI result:', r[0]);
  } catch (e: any) { console.error('FAIL:', e.message); }

  console.log('\n6. Testing sales funnel query...');
  try {
    const r = await querySource<{ total: number; sold: number }>(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN SaleDone = '1' OR SaleDone = 1 THEN 1 ELSE 0 END) AS sold
      FROM db_external.CallDetails
      WHERE CallDate BETWEEN ? AND ?
    `, [start, end]);
    console.log('Funnel result:', r[0]);
  } catch (e: any) { console.error('FAIL:', e.message); }

  console.log('\n7. Sample row from call_quality_assessment...');
  try {
    const r = await querySource(`SELECT * FROM db_audit.call_quality_assessment LIMIT 1`);
    console.log('Sample:', JSON.stringify(r[0], null, 2));
  } catch (e: any) { console.error('FAIL:', e.message); }

  console.log('\n8. Sample row from CallDetails...');
  try {
    const r = await querySource(`SELECT * FROM db_external.CallDetails LIMIT 1`);
    console.log('Sample:', JSON.stringify(r[0], null, 2));
  } catch (e: any) { console.error('FAIL:', e.message); }

  process.exit(0);
}

run().catch((e) => { console.error('Fatal:', e); process.exit(1); });
