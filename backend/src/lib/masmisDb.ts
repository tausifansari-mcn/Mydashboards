import mysql from 'mysql2/promise';

let pool: mysql.Pool | null = null;

export function getMasmisPool(): mysql.Pool {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.MYSQL_MASMIS_HOST || process.env.DB_HOST,
      user: process.env.MYSQL_MASMIS_USER || process.env.DB_USER,
      password: process.env.MYSQL_MASMIS_PASSWORD || process.env.DB_PASSWORD,
      port: Number(process.env.MYSQL_MASMIS_PORT || process.env.DB_PORT) || 3306,
      database: process.env.MYSQL_MASMIS_DATABASE || 'db_masmis',
      waitForConnections: true,
      connectionLimit: 10,
    });
  }
  return pool;
}
