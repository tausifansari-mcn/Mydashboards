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

  await show('cdr batch counts', "SELECT upload_batch_id, uploads, COUNT(*) c, COUNT(DISTINCT PhoneNumber) phones FROM (SELECT upload_batch_id, uploaded_at uploads FROM db_masmis.bvo_Repeat_cdr) t GROUP BY upload_batch_id, uploads ORDER BY uploads DESC LIMIT 8");
  await show('distinct cdr phones total', "SELECT COUNT(DISTINCT PhoneNumber) phones, COUNT(*) rows FROM db_masmis.bvo_Repeat_cdr");

  const [batches] = await conn.query("SELECT upload_batch_id, MAX(uploaded_at) u FROM db_masmis.bvo_Repeat_cdr GROUP BY upload_batch_id ORDER BY u DESC LIMIT 1");
  const bid = batches[0] && batches[0].upload_batch_id;

  await show('latest cdr batch phones matched in oe.shipping_phone', `SELECT COUNT(DISTINCT c.PhoneNumber) cdr_phones,
      SUM(CASE WHEN oe.id IS NOT NULL THEN 1 ELSE 0 END) matched_oe FROM (SELECT DISTINCT PhoneNumber FROM db_masmis.bvo_Repeat_cdr WHERE upload_batch_id='${bid}') c
      LEFT JOIN (SELECT DISTINCT shipping_phone FROM db_masmis.bvo_order_export WHERE shipping_phone IS NOT NULL AND shipping_phone<>'') oe ON oe.shipping_phone = c.PhoneNumber`);
  await show('same but vs shipping_phone_2', `SELECT COUNT(DISTINCT c.PhoneNumber) cdr_phones,
      SUM(CASE WHEN oe.id IS NOT NULL THEN 1 ELSE 0 END) matched_oe FROM (SELECT DISTINCT PhoneNumber FROM db_masmis.bvo_Repeat_cdr WHERE upload_batch_id='${bid}') c
      LEFT JOIN (SELECT DISTINCT shipping_phone_2 FROM db_masmis.bvo_order_export WHERE shipping_phone_2 IS NOT NULL AND shipping_phone_2<>'') oe ON oe.shipping_phone_2 = c.PhoneNumber`);
  await show('order dates of matched phones', `SELECT oe.order_date, COUNT(DISTINCT oe.shipping_phone) phones, COUNT(*) rows FROM db_masmis.bvo_order_export oe
      INNER JOIN (SELECT DISTINCT PhoneNumber FROM db_masmis.bvo_Repeat_cdr WHERE upload_batch_id='${bid}') c ON c.PhoneNumber = oe.shipping_phone
      GROUP BY oe.order_date ORDER BY oe.order_date DESC LIMIT 15`);
  await show('empty shipping_phone_2 stats', "SELECT COUNT(*) total, SUM(shipping_phone_2 IS NULL OR shipping_phone_2='') empty_p2 FROM db_masmis.bvo_order_export");
  await show('p2 != p stats', "SELECT COUNT(*) diff FROM db_masmis.bvo_order_export WHERE shipping_phone <> shipping_phone_2");

  await conn.end();
})().catch(e => { console.error(e); process.exit(1); });
