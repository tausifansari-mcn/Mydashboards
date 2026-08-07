const mysql = require('mysql2/promise');
(async () => {
  const conn = await mysql.createConnection({
    host: '122.184.128.90', port: 3306, user: 'root', password: 'vicidialnow', database: 'shivamgiri',
  });
  const show = async (label, sql) => {
    try {
      const [rows] = await conn.query(sql);
      console.log('\n=== ' + label + ' ===');
      console.log(JSON.stringify(rows, null, 1));
    } catch (e) { console.log('\n=== ' + label + ' ERROR: ' + e.message + ' ==='); }
  };

  await show('recent oe batches', `SELECT upload_batch_id, COUNT(*) total_rows, COUNT(DISTINCT order_date) dates, MAX(uploaded_at) last_upload
      FROM db_masmis.bvo_order_export GROUP BY upload_batch_id ORDER BY last_upload DESC LIMIT 6`);

  const [b] = await conn.query(`SELECT upload_batch_id FROM db_masmis.bvo_order_export GROUP BY upload_batch_id ORDER BY MAX(uploaded_at) DESC LIMIT 1`);
  const bid = b[0] && b[0].upload_batch_id;
  console.log('\nnewest oe batch: ' + bid);
  await show('dates in newest batch', `SELECT order_date, COUNT(*) c FROM db_masmis.bvo_order_export WHERE upload_batch_id='${bid}' GROUP BY order_date ORDER BY c DESC LIMIT 20`);
  await show('cdr status mix', "SELECT CallStatus, COUNT(*) c FROM db_masmis.bvo_Repeat_cdr GROUP BY CallStatus ORDER BY c DESC LIMIT 15");

  await conn.end();
})().catch(e => { console.error(e); process.exit(1); });
