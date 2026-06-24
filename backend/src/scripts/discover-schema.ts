import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

async function discover() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: Number(process.env.DB_PORT) || 3306,
  });

  console.log('\n=== db_audit.call_quality_assessment ===');
  const [cols1] = await conn.execute(`
    SELECT COLUMN_NAME, DATA_TYPE, COLUMN_TYPE
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = 'db_audit' AND TABLE_NAME = 'call_quality_assessment'
    ORDER BY ORDINAL_POSITION
  `);
  console.table(cols1);

  console.log('\n=== Sample row from call_quality_assessment ===');
  try {
    const [rows1] = await conn.execute('SELECT * FROM db_audit.call_quality_assessment LIMIT 1');
    console.log(JSON.stringify(rows1, null, 2));
  } catch (e) { console.log('Error:', e); }

  console.log('\n=== db_external.CallDetails ===');
  const [cols2] = await conn.execute(`
    SELECT COLUMN_NAME, DATA_TYPE, COLUMN_TYPE
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = 'db_external' AND TABLE_NAME = 'CallDetails'
    ORDER BY ORDINAL_POSITION
  `);
  console.table(cols2);

  console.log('\n=== Sample row from CallDetails ===');
  try {
    const [rows2] = await conn.execute('SELECT * FROM db_external.CallDetails LIMIT 1');
    console.log(JSON.stringify(rows2, null, 2));
  } catch (e) { console.log('Error:', e); }

  await conn.end();
}

discover().catch(console.error);
