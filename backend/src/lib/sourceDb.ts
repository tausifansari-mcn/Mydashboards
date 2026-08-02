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

// The pool only has 3 connections (shared with VICIdial), and mysql2's queue has no built-in
// wait timeout — a query that can't get a connection (pool saturated by the periodic background
// batch jobs, or a slow query holding a connection) queues silently and hangs forever, taking the
// whole HTTP request down with it and giving the caller no error to react to. This wraps every
// query in a hard deadline so callers fail fast with a clear error instead of hanging indefinitely.
const QUERY_TIMEOUT_MS = 20_000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Query timed out after ${ms}ms: ${label}`)), ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}

export async function querySource<T = Record<string, unknown>>(
  sql: string,
  params: (string | number | null)[] = [],
  retries = 3,
): Promise<T[]> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const [rows] = await withTimeout(getSourcePool().execute(sql, params), QUERY_TIMEOUT_MS, sql.trim().slice(0, 100));
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
