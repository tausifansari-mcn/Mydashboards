const mysql = require('mysql2/promise');
(async () => {
  const conn = await mysql.createConnection({ host: '122.184.128.90', port: 3306, user: 'root', password: 'vicidialnow', database: 'shivamgiri' });
  const [r1] = await conn.query(`SELECT upload_batch_id, COUNT(*) c, SUM(shipping_zip REGEXP '^[0-9]{5,6}$') zip_pin,
    SUM(tags LIKE 'containsFreeGift%' OR tags LIKE '%Ecom360%') tags_gift,
    SUM(shipping_city LIKE 'containsFreeGift%') city_gift
    FROM db_masmis.bvo_order_export
    WHERE upload_batch_id IN ('e35866bd-4982-440d-b9c5-b0bda6ec9ee6','f80bb7c2-0bbc-45e7-8194-e3eeaf1328f6')
    GROUP BY upload_batch_id`);
  console.log(JSON.stringify(r1, null, 1));
  const [r2] = await conn.query(`SELECT COUNT(*) open FROM information_schema.INNODB_TRX`);
  console.log('open trx:', JSON.stringify(r2));
  await conn.end();
})().catch(e => { console.error(e.message); process.exit(1); });
