const XLSX = require('xlsx');
const mysql = require('mysql2/promise');

const FILE = "C:\\Users\\MAS60358\\Downloads\\Dec'24-15.xlsx";
const BATCH_IDS = ['e35866bd-4982-440d-b9c5-b0bda6ec9ee6', 'f80bb7c2-0bbc-45e7-8194-e3eeaf1328f6'];

function excelSerialToDMY(serial) {
  const d = new Date((serial - 25569) * 86400 * 1000);
  const pad = n => String(n).padStart(2, '0');
  return `${pad(d.getUTCDate())}-${pad(d.getUTCMonth() + 1)}-${d.getUTCFullYear()}`;
}
function parseOrderExportDate(val) {
  if (!val) return null;
  const trimmed = String(val).trim();
  if (!trimmed || trimmed === '-') return null;
  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    const serial = parseFloat(trimmed);
    if (serial > 20000 && serial < 80000) return excelSerialToDMY(serial);
  }
  let m = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return `${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}-${m[3]}`;
  m = trimmed.match(/^(\d{2})-(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-(\d{2})$/i);
  if (m) {
    const months = {Jan:'01',Feb:'02',Mar:'03',Apr:'04',May:'05',Jun:'06',Jul:'07',Aug:'08',Sep:'09',Oct:'10',Nov:'11',Dec:'12'};
    const key = m[2][0].toUpperCase() + m[2].slice(1,3).toLowerCase();
    const yr = parseInt(m[3]) < 50 ? `20${m[3]}` : `19${m[3]}`;
    return `${m[1]}-${months[key]}-${yr}`;
  }
  return null;
}

(async () => {
  const wb = XLSX.readFile(FILE);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, blankrows: false });
  const headerIdx = rawRows.findIndex(r => r.some(c => c != null && String(c).trim().toLowerCase() === 'financial status'));
  if (headerIdx === -1) throw new Error('no header');
  const header = rawRows[headerIdx].map(c => String(c ?? '').trim());
  const findCol = (...names) => { const lo = names.map(n => n.toLowerCase()); return header.findIndex(h => lo.includes(h.toLowerCase())); };
  const colZip  = findCol('Shipping Zip', 'Shipping Postal Code');
  const colCity = findCol('Shipping City');
  const colTags = findCol('Tags', 'Order Tags');
  const colProv = findCol('Shipping Province Name', 'Shipping State');
  console.log('header cols: zip=' + colZip + ' city=' + colCity + ' tags=' + colTags + ' prov=' + colProv);
  const dataRows = rawRows.slice(headerIdx + 1);
  const strip = v => String(v ?? '').replace(/^'/, '');
  const addr = (r, col, fb) => col >= 0 ? r[col] : r[fb];
  const rows = dataRows.map(r => [
    String(r[0] ?? '').slice(0,50), String(r[1] ?? '').slice(0,100), String(r[2] ?? '').slice(0,50),
    String(r[3] ?? '').slice(0,255), String(r[4] ?? '').slice(0,50), parseFloat(String(r[5] ?? '0')) || 0,
    String(r[6] ?? '').slice(0,100), String(r[7] ?? '').slice(0,100), parseOrderExportDate(r[8]),
    String(r[9] ?? ''), String(r[10] ?? '').slice(0,255),
    strip(addr(r, colZip, 11)).slice(0,20), String(addr(r, colTags, 12) ?? ''), String(addr(r, colCity, 13) ?? '').slice(0,255),
    String(addr(r, colProv, 14) ?? '').slice(0,255), parseOrderExportDate(r[15]),
  ]);
  console.log('parsed rows:', rows.length);

  const conn = await mysql.createConnection({ host: '122.184.128.90', port: 3306, user: 'root', password: 'vicidialnow', database: 'shivamgiri' });
  try {
    await conn.query('START TRANSACTION');
    const [del] = await conn.query(`DELETE FROM db_masmis.bvo_order_export WHERE upload_batch_id IN (?)`, [BATCH_IDS]);
    console.log('deleted old rows:', del.affectedRows);
    const sql = `INSERT INTO db_masmis.bvo_order_export (
      shipping_phone, name, shipping_phone_2, email, financial_status, total, name_2,
      discount_code, created_at_raw, lineitem_name, shipping_name, shipping_zip, tags,
      shipping_city, shipping_province_name, order_date, uploaded_by, upload_batch_id
    ) VALUES ?`;
    const [ins] = await conn.query(sql, [rows.map(r => [...r, 1, BATCH_IDS[0]])]);
    console.log('inserted rows:', ins.affectedRows);

    const [check] = await conn.query(`SELECT
        COUNT(*) total,
        SUM(shipping_zip REGEXP '^[0-9]{5,6}$') zip_pin,
        SUM(tags LIKE 'containsFreeGift%' OR tags LIKE '%Ecom360%') tags_gift,
        SUM(shipping_city LIKE 'containsFreeGift%') city_gift,
        SUM(shipping_province_name IS NULL OR shipping_province_name='') prov_empty
        FROM db_masmis.bvo_order_export WHERE upload_batch_id=?`, [BATCH_IDS[0]]);
    console.log('after import:', JSON.stringify(check[0]));
    const [sample] = await conn.query(`SELECT shipping_name, shipping_zip, tags, shipping_city, shipping_province_name, order_date
        FROM db_masmis.bvo_order_export WHERE upload_batch_id=? ORDER BY id LIMIT 4`, [BATCH_IDS[0]]);
    console.log('sample:', JSON.stringify(sample, null, 1));

    const ok = check[0].total > 0 && check[0].zip_pin === check[0].total && check[0].tags_gift > 0;
    if (!ok) throw new Error('verification failed');
    await conn.query('COMMIT');
    console.log('COMMITTED');
  } catch (e) {
    console.error('ERROR', e.message);
    try { await conn.query('ROLLBACK'); } catch(_) {}
    process.exit(1);
  }
  await conn.end();
})().catch(e => { console.error(e); process.exit(1); });
