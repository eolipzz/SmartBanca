import { Pool, type PoolClient, type QueryResultRow } from "pg";

const globalForDb = globalThis as unknown as { smartBancaPool?: Pool };
export const pool = globalForDb.smartBancaPool ?? new Pool({ connectionString: process.env.DATABASE_URL, user: process.env.DATABASE_APP_USER ?? "smartbanca_app", max: 10, idleTimeoutMillis: 30_000, statement_timeout: 8_000 });
if (process.env.NODE_ENV !== "production") globalForDb.smartBancaPool = pool;

export async function withUser<T>(userId: string, operation: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.current_user_id', $1, true)", [userId]);
    if (process.env.FIELD_ENCRYPTION_KEY) await client.query("SELECT set_config('app.field_encryption_key', $1, true)", [process.env.FIELD_ENCRYPTION_KEY]);
    const result = await operation(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}

export async function queryOne<T extends QueryResultRow>(sql: string, params: unknown[] = []) {
  const result = await pool.query<T>(sql, params);
  return result.rows[0] ?? null;
}
