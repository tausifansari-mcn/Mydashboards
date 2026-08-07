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

  await show('DATABASES', "SHOW DATABASES LIKE '%masmis%'");

  await show('allocation schema', "SHOW CREATE TABLE db_masmis.bvo_Repeat_allocation");
  await show('cdr schema', "SHOW CREATE TABLE db_masmis.bvo_Repeat_cdr");

  await show('allocation sample', "SELECT * FROM db_masmis.bvo_Repeat_allocation ORDER BY id DESC LIMIT 5");
  await show('cdr sample', "SELECT PhoneNumber, CallStatus, Agent, upload_batch_id FROM db_masmis.bvo_Repeat_cdr ORDER BY id DESC LIMIT 10");
  await show('oe sample', "SELECT id, shipping_phone, shipping_phone_2, order_date FROM db_masmis.bvo_order_export ORDER BY id DESC LIMIT 10");
  await show('oe dates', "SELECT order_date, COUNT(*) c FROM db_masmis.bvo_order_export GROUP BY order_date ORDER BY order_date DESC LIMIT 20");
  await show('cdr phone formats', "SELECT PhoneNumber, LENGTH(PhoneNumber) len, COUNT(*) c FROM db_masmis.bvo_Repeat_cdr GROUP BY PhoneNumber ORDER BY c DESC LIMIT 25");
  await show('oe phone2 formats', "SELECT shipping_phone_2, LENGTH(shipping_phone_2) len, COUNT(*) c FROM db_masmis.bvo_order_export WHERE shipping_phone_2 IS NOT NULL AND shipping_phone_2 <> '' GROUP BY shipping_phone_2 ORDER BY c DESC LIMIT 25");
  await show('oe phone formats', "SELECT shipping_phone, LENGTH(shipping_phone) len, COUNT(*) c FROM db_masmis.bvo_order_export WHERE shipping_phone IS NOT NULL AND shipping_phone <> '' GROUP BY shipping_phone ORDER BY c DESC LIMIT 25");
  await show('allocation phones', "SELECT phone_number, COUNT(*) c FROM db_masmis.bvo_Repeat_allocation GROUP BY phone_number ORDER BY c DESC LIMIT 25");

  await conn.end();
})().catch(e => { console.error(e); process.exit(1); });
