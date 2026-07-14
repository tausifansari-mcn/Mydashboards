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
      const code = (err as { code?: string }).code;
      if ((code === 'ER_CON_COUNT_ERROR' || code === 'ECONNREFUSED') && attempt < retries) {
        await sleep(attempt * 800); // 800ms, 1600ms back-off
        continue;
      }
      throw err;
    }
  }
  return [];
}
