import 'dotenv/config';
import { getMasmisPool } from '../lib/masmisDb';

async function main() {
  const pool = getMasmisPool();
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS bb_cart (
      id                  INT AUTO_INCREMENT PRIMARY KEY,
      cc                  VARCHAR(50)    DEFAULT NULL,
      source              VARCHAR(255)   DEFAULT NULL,
      sno                 INT            DEFAULT NULL,
      cart_id             VARCHAR(50)    DEFAULT NULL,
      created_at          VARCHAR(50)    DEFAULT NULL,
      updated_at          VARCHAR(50)    DEFAULT NULL,
      customer_name       VARCHAR(255)   DEFAULT NULL,
      customer_address    TEXT           DEFAULT NULL,
      phone_number        VARCHAR(50)    DEFAULT NULL,
      email_id            VARCHAR(255)   DEFAULT NULL,
      line_items          TEXT           DEFAULT NULL,
      variant_title       TEXT           DEFAULT NULL,
      abandoned_cart_link TEXT           DEFAULT NULL,
      amount              DECIMAL(12,2)  DEFAULT NULL,
      phone_10_digit      VARCHAR(20)    DEFAULT NULL,
      dates               VARCHAR(50)    DEFAULT NULL,
      agent               VARCHAR(100)   DEFAULT NULL,
      disposition         VARCHAR(255)   DEFAULT NULL,
      sub_disposition     VARCHAR(255)   DEFAULT NULL,
      call_date           VARCHAR(50)    DEFAULT NULL,
      same_day_connect    VARCHAR(50)    DEFAULT NULL,
      status              VARCHAR(100)   DEFAULT NULL,
      uploaded_at         DATETIME       DEFAULT CURRENT_TIMESTAMP,
      uploaded_by         INT            DEFAULT NULL,
      upload_batch_id     VARCHAR(36)    DEFAULT NULL,
      KEY idx_upload_batch_id (upload_batch_id),
      KEY idx_uploaded_at (uploaded_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log('bb_cart table created/verified successfully');
  await pool.end();
}

main().catch(err => {
  console.error('Failed to create bb_cart table:', err);
  process.exit(1);
});
