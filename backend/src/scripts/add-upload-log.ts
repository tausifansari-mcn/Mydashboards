import 'dotenv/config';
import { getMasmisPool } from '../lib/masmisDb';

async function main() {
  const pool = getMasmisPool();

  // Upload log table
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS upload_log (
      id            INT AUTO_INCREMENT PRIMARY KEY,
      batch_id      VARCHAR(36)   NOT NULL,
      table_name    VARCHAR(100)  NOT NULL,
      file_name     VARCHAR(255)  DEFAULT NULL,
      row_count     INT           DEFAULT NULL,
      uploaded_by   INT           DEFAULT NULL,
      uploaded_at   DATETIME      DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uk_batch_id (batch_id),
      KEY idx_table (table_name),
      KEY idx_uploaded_at (uploaded_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log('upload_log table created');

  // Add batch_id column to all data tables (check existence first)
  const tables = ['bb_sale', 'bb_apr', 'bb_chat', 'gnc_sale', 'gnc_apr', 'gnc_allocation'];
  for (const t of tables) {
    const [rows] = await pool.execute(
      `SELECT COUNT(*) AS cnt FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='db_masmis' AND TABLE_NAME=? AND COLUMN_NAME='upload_batch_id'`,
      [t]
    );
    const exists = (rows as any[])[0]?.cnt > 0;
    if (!exists) {
      await pool.execute(`ALTER TABLE db_masmis.${t} ADD COLUMN \`upload_batch_id\` VARCHAR(36) DEFAULT NULL AFTER uploaded_by`);
      console.log(`Added upload_batch_id to ${t}`);
    } else {
      console.log(`upload_batch_id already exists in ${t}`);
    }
  }

  await pool.end();
}
main().catch(e => { console.error(e); process.exit(1); });
