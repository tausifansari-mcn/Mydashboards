import mysql from 'mysql2/promise';

let pool: mysql.Pool | null = null;

export function getMasmisPool(): mysql.Pool {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      port: Number(process.env.DB_PORT) || 3306,
      database: 'db_masmis',
      waitForConnections: true,
      connectionLimit: 10,
    });
  }
  return pool;
}

export async function queryMasmis<T = Record<string, unknown>>(
  sql: string,
  params: (string | number | null)[] = [],
): Promise<T[]> {
  const [rows] = await getMasmisPool().execute(sql, params);
  return rows as T[];
}
