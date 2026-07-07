const mysql = require('mysql2/promise');
require('dotenv').config();

(async () => {
  const c = await mysql.createConnection({
    host: process.env.DB_HOST, user: process.env.DB_USER,
    password: process.env.DB_PASSWORD, port: Number(process.env.DB_PORT) || 3306,
    connectTimeout: 10000
  });
  const [sc] = await c.execute("SELECT scenario, COUNT(*) c FROM db_audit.call_quality_assessment GROUP BY scenario ORDER BY c DESC");
  console.log('=== SCENARIO DISTRIBUTION ===');
  console.table(sc);
  const [s1] = await c.execute("SELECT scenario, scenario1, COUNT(*) c FROM db_audit.call_quality_assessment WHERE scenario IN ('Complaint','Request','Query') GROUP BY scenario, scenario1 ORDER BY scenario, c DESC LIMIT 50");
  console.log('=== SCENARIO1 DETAIL ===');
  console.table(s1);
  const [t] = await c.execute("SELECT COUNT(*) total FROM db_audit.call_quality_assessment");
  console.log('TOTAL:', t[0].total);
  await c.end();
})();
