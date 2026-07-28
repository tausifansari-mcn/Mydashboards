import 'dotenv/config';
import { getMasmisPool } from '../lib/masmisDb';

// "OrderExport For Repeat" — Bellavita Shopify order-export upload. The source file has two
// genuinely duplicate columns (Shipping Phone appears twice, Name appears twice, confirmed against
// real sample rows) so this is mapped positionally by column index, not by header name.
async function main() {
  const pool = getMasmisPool();
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS bvo_order_export (
      id                      INT AUTO_INCREMENT PRIMARY KEY,
      shipping_phone          VARCHAR(50)    DEFAULT NULL,
      name                    VARCHAR(100)   DEFAULT NULL,
      shipping_phone_2        VARCHAR(50)    DEFAULT NULL,
      email                   VARCHAR(255)   DEFAULT NULL,
      financial_status        VARCHAR(50)    DEFAULT NULL,
      total                   DECIMAL(12,2)  DEFAULT NULL,
      name_2                  VARCHAR(100)   DEFAULT NULL,
      discount_code           VARCHAR(100)   DEFAULT NULL,
      created_at_raw          VARCHAR(50)    DEFAULT NULL,
      lineitem_name           TEXT           DEFAULT NULL,
      shipping_name           VARCHAR(255)   DEFAULT NULL,
      shipping_zip            VARCHAR(20)    DEFAULT NULL,
      tags                    TEXT           DEFAULT NULL,
      shipping_city           VARCHAR(255)   DEFAULT NULL,
      shipping_province_name  VARCHAR(255)   DEFAULT NULL,
      order_date              VARCHAR(20)    DEFAULT NULL,
      uploaded_at             DATETIME       DEFAULT CURRENT_TIMESTAMP,
      uploaded_by             INT            DEFAULT NULL,
      upload_batch_id         VARCHAR(36)    DEFAULT NULL,
      KEY idx_upload_batch_id (upload_batch_id),
      KEY idx_uploaded_at (uploaded_at),
      KEY idx_shipping_phone (shipping_phone),
      KEY idx_name (name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log('bvo_order_export table created/verified successfully');
  await pool.end();
}

main().catch(err => {
  console.error('Failed to create bvo_order_export table:', err);
  process.exit(1);
});
