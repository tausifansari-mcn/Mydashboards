import 'dotenv/config';
import { getMasmisPool } from '../lib/masmisDb';

async function main() {
  const pool = getMasmisPool();
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS bb_sale (
      id                    INT AUTO_INCREMENT PRIMARY KEY,
      week                  VARCHAR(20)   DEFAULT NULL,
      sale_date             DATE          DEFAULT NULL,
      emp_id                VARCHAR(50)   DEFAULT NULL,
      emp_name              VARCHAR(255)  DEFAULT NULL,
      tl                    VARCHAR(255)  DEFAULT NULL,
      t1                    VARCHAR(100)  DEFAULT NULL,
      t2                    VARCHAR(100)  DEFAULT NULL,
      fhd                   DATE          DEFAULT NULL,
      days                  INT           DEFAULT NULL,
      phone_number          VARCHAR(50)   DEFAULT NULL,
      email_id              VARCHAR(255)  DEFAULT NULL,
      payment_status        VARCHAR(100)  DEFAULT NULL,
      amount                DECIMAL(12,2) DEFAULT NULL,
      bella_vita_order_id   VARCHAR(100)  DEFAULT NULL,
      campaign              VARCHAR(255)  DEFAULT NULL,
      calling_status        VARCHAR(255)  DEFAULT NULL,
      discount_code         VARCHAR(255)  DEFAULT NULL,
      sale_count            INT           DEFAULT NULL,
      current_status        VARCHAR(255)  DEFAULT NULL,
      final_status          VARCHAR(255)  DEFAULT NULL,
      order_datetime        DATETIME      DEFAULT NULL,
      state                 VARCHAR(255)  DEFAULT NULL,
      line_item_name        TEXT          DEFAULT NULL,
      pincode               VARCHAR(50)   DEFAULT NULL,
      order_date            DATE          DEFAULT NULL,
      hrs_24_48             VARCHAR(100)  DEFAULT NULL,
      crazy_deal            VARCHAR(255)  DEFAULT NULL,
      perfume               VARCHAR(255)  DEFAULT NULL,
      size                  VARCHAR(100)  DEFAULT NULL,
      order_pickup_datetime DATETIME      DEFAULT NULL,
      rto_initiated_datetime DATETIME     DEFAULT NULL,
      diff_hour             INT           DEFAULT NULL,
      lob                   VARCHAR(255)  DEFAULT NULL,
      pincode_relevent      VARCHAR(255)  DEFAULT NULL,
      rto_status            VARCHAR(255)  DEFAULT NULL,
      draft_order           VARCHAR(255)  DEFAULT NULL,
      time_1608             VARCHAR(100)  DEFAULT NULL,
      sale_source_name      VARCHAR(255)  DEFAULT NULL,
      shift                 VARCHAR(100)  DEFAULT NULL,
      uploaded_at           DATETIME      DEFAULT CURRENT_TIMESTAMP,
      uploaded_by           INT           DEFAULT NULL,
      KEY idx_emp_id (emp_id),
      KEY idx_order_id (bella_vita_order_id),
      KEY idx_sale_date (sale_date),
      KEY idx_uploaded_at (uploaded_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log('bb_sale table created/verified successfully');
  await pool.end();
}

main().catch(err => {
  console.error('Failed to create bb_sale table:', err);
  process.exit(1);
});
