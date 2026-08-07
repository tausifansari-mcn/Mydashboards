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

  await show('cdr batches', "SELECT upload_batch_id, COUNT(*) total_rows, COUNT(DISTINCT PhoneNumber) phones, MAX(uploaded_at) last_upload FROM db_masmis.bvo_Repeat_cdr GROUP BY upload_batch_id ORDER BY last_upload DESC LIMIT 10");
  await show('cdr distinct phones', "SELECT COUNT(DISTINCT PhoneNumber) phones FROM db_masmis.bvo_Repeat_cdr");

  const [batches] = await conn.query("SELECT upload_batch_id, MAX(uploaded_at) u FROM db_masmis.bvo_Repeat_cdr GROUP BY upload_batch_id ORDER BY u DESC LIMIT 1");
  const bid = batches[0] && batches[0].upload_batch_id;
  console.log('\nlatest cdr batch: ' + bid);

  await show('cdr phones matched in oe.shipping_phone', `SELECT COUNT(DISTINCT c.PhoneNumber) cdr_phones,
      SUM(CASE WHEN oe.id IS NOT NULL THEN 1 ELSE 0 END) matched_oe
      FROM (SELECT DISTINCT PhoneNumber FROM db_masmis.bvo_Repeat_cdr WHERE upload_batch_id='${bid}') c
      LEFT JOIN db_masmis.bvo_order_export oe ON oe.shipping_phone = c.PhoneNumber`);
  await show('order dates of matched phones (top 15)', `SELECT oe.order_date, COUNT(DISTINCT oe.shipping_phone) phones, COUNT(*) oe_rows
      FROM db_masmis.bvo_order_export oe
      INNER JOIN (SELECT DISTINCT PhoneNumber FROM db_masmis.bvo_Repeat_cdr WHERE upload_batch_id='${bid}') c ON c.PhoneNumber = oe.shipping_phone
      GROUP BY oe.order_date ORDER BY oe.order_date DESC LIMIT 15`);
  await show('allocation rows by RawDate (top 10)', "SELECT RawDate, COUNT(*) total_rows FROM db_masmis.bvo_Repeat_allocation GROUP BY RawDate ORDER BY RawDate DESC LIMIT 10");
  await show('allocation total', "SELECT COUNT(*) total_rows, COUNT(DISTINCT phone_number) phones FROM db_masmis.bvo_Repeat_allocation");

  await conn.end();
})().catch(e => { console.error(e); process.exit(1); });
