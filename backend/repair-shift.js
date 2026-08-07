const mysql = require('mysql2/promise');
(async () => {
  const conn = await mysql.createConnection({
    host: '122.184.128.90', port: 3306, user: 'root', password: 'vicidialnow', database: 'shivamgiri',
  });
  const BATCHES = [
    'e35866bd-4982-440d-b9c5-b0bda6ec9ee6',
    'f80bb7c2-0bbc-45e7-8194-e3eeaf1328f6',
    '8f7a1767-0508-41bd-ad7c-87528baf0ac9',
    '22593835-f506-4bd6-98af-d876790279a4',
  ];
  const IN = BATCHES.map(b => `'${b}'`).join(',');
  const sanity = async (label) => {
    const [rows] = await conn.query(`SELECT
        COUNT(*) total,
        SUM(shipping_zip REGEXP '^[0-9]{5,6}$') zip_is_pin,
        SUM(tags REGEXP '^[0-9]{5,6}$') tags_is_pin,
        SUM(shipping_city LIKE 'containsFreeGift%') city_is_tags
        FROM db_masmis.bvo_order_export WHERE upload_batch_id IN (${IN})`);
    console.log(`${label}:`, JSON.stringify(rows[0]));
    return rows[0];
  };

  try {
    await conn.query('START TRANSACTION');
    await sanity('BEFORE');

    const [res] = await conn.query(`
      UPDATE db_masmis.bvo_order_export
      SET shipping_city = shipping_zip,
          shipping_zip  = tags,
          tags          = shipping_city
      WHERE upload_batch_id IN (${IN})
    `);
    console.log('UPDATE affected rows:', res.affectedRows);

    const after = await sanity('AFTER');
    const ok = after.total > 0 && after.zip_is_pin >= after.total - 5;
    if (!ok) { throw new Error('Verification failed - rolling back'); }

    const [samples] = await conn.query(`SELECT shipping_name, shipping_zip, shipping_city, tags, shipping_province_name
        FROM db_masmis.bvo_order_export WHERE upload_batch_id IN (${IN}) AND shipping_zip REGEXP '^[0-9]{5,6}$' LIMIT 3`);
    console.log('sample repaired:', JSON.stringify(samples, null, 1));

    await conn.query('COMMIT');
    console.log('\nCOMMITTED');
  } catch (e) {
    console.error('ERROR:', e.message);
    try { await conn.query('ROLLBACK'); } catch (_) {}
    process.exit(1);
  }
  await conn.end();
})().catch(e => { console.error(e); process.exit(1); });
