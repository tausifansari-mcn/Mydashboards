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

  await show('zip-like (5-6 digits) in each col', `SELECT
      SUM(shipping_zip REGEXP '^[0-9]{5,6}$') zip_col_is_pin,
      SUM(tags REGEXP '^[0-9]{5,6}$') tags_col_is_pin,
      SUM(shipping_city REGEXP '^[0-9]{5,6}$') city_col_is_pin,
      SUM(shipping_province_name REGEXP '^[0-9]{5,6}$') prov_col_is_pin,
      COUNT(*) total
      FROM db_masmis.bvo_order_export`);
  await show('tags-look (free gift/Prepaid) in each col', `SELECT
      SUM(shipping_city LIKE 'containsFreeGift%' OR shipping_city LIKE '%Ecom360%') city_col_has_tags,
      SUM(tags LIKE 'containsFreeGift%' OR tags LIKE '%Ecom360%') tags_col_has_tags,
      SUM(shipping_zip LIKE 'containsFreeGift%' OR shipping_zip LIKE '%Ecom360%') zip_col_has_tags
      FROM db_masmis.bvo_order_export`);
  await show('sample wide', `SELECT shipping_name, shipping_zip, shipping_city, tags, shipping_province_name
      FROM db_masmis.bvo_order_export WHERE shipping_zip REGEXP '^[0-9]{5,6}$' LIMIT 3`);
  await show('sample shifted', `SELECT shipping_name, shipping_zip, shipping_city, tags, shipping_province_name
      FROM db_masmis.bvo_order_export WHERE tags REGEXP '^[0-9]{5,6}$' AND shipping_city LIKE 'containsFreeGift%' LIMIT 5`);

  await conn.end();
})().catch(e => { console.error(e); process.exit(1); });
