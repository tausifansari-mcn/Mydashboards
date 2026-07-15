import mysql from 'mysql2/promise';

let pool: mysql.Pool | null = null;

export function getSourcePool(): mysql.Pool {
  if (!pool) {
    pool = mysql.createPool({
      host:             process.env.DB_HOST,
      user:             process.env.DB_USER,
      password:         process.env.DB_PASSWORD,
      port:             Number(process.env.DB_PORT) || 3306,
      waitForConnections: true,
      connectionLimit:  3,       // conservative — shares server with VICIdial
      queueLimit:       50,
      idleTimeout:      30000,
      connectTimeout:   20000,
    });
  }
  return pool;
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

const RETRYABLE = ['ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', 'PROTOCOL_CONNECTION_LOST', 'ER_CON_COUNT_ERROR'];

export async function querySource<T = Record<string, unknown>>(
  sql: string,
  params: (string | number | null)[] = [],
  retries = 3,
): Promise<T[]> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const [rows] = await getSourcePool().execute(sql, params);
      return rows as T[];
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? '';
      if (RETRYABLE.includes(code) && attempt < retries) {
        pool = null; // force fresh pool on next attempt
        await sleep(attempt * 800);
        continue;
      }
      throw err;
    }
  }
  return [];
}
