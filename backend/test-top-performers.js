require('dotenv').config();
const mysql = require('mysql2/promise');
async function test() {
  try {
    const pool = mysql.createPool({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      port: Number(process.env.DB_PORT) || 3306,
      connectionLimit: 2,
      connectTimeout: 10000,
    });
    
    const [rows] = await pool.execute(
      'SELECT COALESCE(am.AgentName, q.User) AS user, COUNT(*) AS audit_count, ROUND(AVG(q.quality_percentage), 1) AS avg_score ' +
      'FROM db_audit.call_quality_assessment q ' +
      'LEFT JOIN Shivamgiri.AgentMaster am ON am.MasId = q.User COLLATE utf8mb4_unicode_ci ' +
      'WHERE q.CallDate BETWEEN ? AND ? ' +
      'AND q.quality_percentage IS NOT NULL ' +
      'AND q.User IS NOT NULL ' +
      "AND TRIM(q.User) != '' " +
      'AND q.ClientId = ? ' +
      'GROUP BY q.User ' +
      'ORDER BY avg_score DESC LIMIT 5',
      ['2026-06-01', '2026-07-03', 1]
    );
    
    console.log('Count:', rows.length);
    console.log('Results:', JSON.stringify(rows, null, 2));
    
    await pool.end();
  } catch(e) {
    console.error('ERROR:', e.code, e.message);
    console.error('SQLSTATE:', e.sqlState);
  }
}
test();
