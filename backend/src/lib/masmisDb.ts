import mysql from 'mysql2/promise';

let pool: mysql.Pool | null = null;

export function getMasmisPool(): mysql.Pool {
  if (!pool) {
    pool = mysql.createPool({
      host:             process.env.MYSQL_MASMIS_HOST || process.env.DB_HOST,
      user:             process.env.MYSQL_MASMIS_USER || process.env.DB_USER,
      password:         process.env.MYSQL_MASMIS_PASSWORD || process.env.DB_PASSWORD,
      port:             Number(process.env.MYSQL_MASMIS_PORT || process.env.DB_PORT) || 3306,
      database:         process.env.MYSQL_MASMIS_DATABASE || 'db_masmis',
      waitForConnections: true,
      connectionLimit:  10,
      connectTimeout:   60000,
      idleTimeout:      30000,
      enableKeepAlive:  true,
      keepAliveInitialDelay: 10000,
    });
  }
  return pool;
}

// Execute a single query with one retry on connection-related errors.
export async function queryMasmis<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const [rows] = await (getMasmisPool() as any).execute(sql, params);
      return rows as T[];
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? '';
      const retryable = ['ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', 'PROTOCOL_CONNECTION_LOST'].includes(code);
      if (retryable && attempt < 2) {
        await new Promise(r => setTimeout(r, 1000));
        pool = null; // force new pool on retry
        continue;
      }
      throw err;
    }
  }
  return [];
}
