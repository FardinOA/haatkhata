// Applies pending migrations in the production image, before the server starts.
// Plain JS on purpose: the standalone build carries drizzle-orm and pg, not tsx.
import path from "node:path";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  await migrate(drizzle(pool), { migrationsFolder: path.join(process.cwd(), "src/server/db/migrations") });
  console.log("migrations applied");
} finally {
  await pool.end();
}
