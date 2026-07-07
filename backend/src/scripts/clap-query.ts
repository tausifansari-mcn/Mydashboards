import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

async function q() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST, user: process.env.DB_USER,
    password: process.env.DB_PASSWORD, port: Number(process.env.DB_PORT) || 3306
  });
  const [sc] = await conn.execute("SELECT scenario, COUNT(*) c FROM db_audit.call_quality_assessment GROUP BY scenario ORDER BY c DESC");
  console.log('=== SCENARIO DISTRIBUTION ===');
  console.table(sc);

  const [s1] = await conn.execute("SELECT scenario, scenario1, COUNT(*) c FROM db_audit.call_quality_assessment WHERE scenario IN ('Complaint','Request','Query') GROUP BY scenario, scenario1 ORDER BY scenario, c DESC LIMIT 50");
  console.log('=== SCENARIO1 DETAIL ===');
  console.table(s1);

  const [total] = await conn.execute("SELECT COUNT(*) total, ROUND(AVG(quality_percentage),2) avgQ FROM db_audit.call_quality_assessment");
  console.log('=== OVERALL ===');
  console.table(total);

  const [yr] = await conn.execute("SELECT MIN(CallDate) minDate, MAX(CallDate) maxDate FROM db_audit.call_quality_assessment");
  console.table(yr);

  await conn.end();
}
q().catch(e => { console.error(e); process.exit(1); });
