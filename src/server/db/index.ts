import "server-only";
import { sql } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

export type DB = NodePgDatabase<typeof schema>;
export type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];

const globalForDb = globalThis as unknown as { __bkPool?: Pool };

function pool() {
  if (!globalForDb.__bkPool) {
    globalForDb.__bkPool = new Pool({
      connectionString: process.env.DATABASE_URL ?? "postgres://bechakena:bechakena@localhost:55433/bechakena",
      max: Number(process.env.DB_POOL_MAX ?? 10),
    });
  }
  return globalForDb.__bkPool;
}

/** Owner connection — only for global tables (users, sessions, OTP) and admin work. */
export const db: DB = drizzle(pool(), { schema });

/**
 * Runs `fn` in a transaction that can only see one business's rows: the
 * connection drops to the non-owner role `bk_app` and Postgres row-level
 * security filters every tenant table by `app.business_id`.
 */
export async function withTenant<T>(businessId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.business_id', ${businessId}, true)`);
    await tx.execute(sql`set local role bk_app`);
    return fn(tx);
  });
}

export { schema };
