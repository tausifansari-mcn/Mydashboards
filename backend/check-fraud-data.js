const mysql = require('mysql2/promise');
(async () => {
  const conn = await mysql.createConnection({ host: '122.184.128.90', port: 3306, user: 'root', password: 'vicidialnow', database: 'shivamgiri', connectTimeout: 20000 });
  const [dist] = await conn.query(`SELECT fraud_and_data_security_compliance, COUNT(*) c FROM db_audit.call_quality_assessment GROUP BY fraud_and_data_security_compliance`);
  console.log('distribution:', JSON.stringify(dist));
  const [total] = await conn.query(`SELECT COUNT(*) c FROM db_audit.call_quality_assessment`);
  console.log('total rows:', JSON.stringify(total[0]));
  const [s] = await conn.query(`SELECT id, ClientId, CallDate, MobileNo, User, lead_id, campaign, fraud_and_data_security_compliance, fraud_detected_sentence
    FROM db_audit.call_quality_assessment WHERE fraud_and_data_security_compliance IS NOT NULL AND fraud_detected_sentence IS NOT NULL
    LIMIT 10`);
  console.log('sample:', JSON.stringify(s, null, 1));
  const [s1] = await conn.query(`SELECT id, ClientId, CallDate, MobileNo, User, fraud_and_data_security_compliance, LEFT(fraud_detected_sentence, 300) sentence
    FROM db_audit.call_quality_assessment WHERE fraud_and_data_security_compliance = 1 LIMIT 5`);
  console.log('fraud=1 sample:', JSON.stringify(s1, null, 1));
  await conn.end();
})().catch(e => { console.error(e.message); process.exit(1); });
