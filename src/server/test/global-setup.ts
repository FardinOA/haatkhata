import { Client } from "pg";
import { runMigrations } from "../db/migrate";

/** Parallel workers set BK_TEST_DB to get their own database. */
export const TEST_DB = process.env.BK_TEST_DB ?? "bechakena_test";
const ADMIN = "postgres://bechakena:bechakena@localhost:55433/bechakena";

/** Recreates a clean test database and applies all migrations. */
export default async function setup() {
  const c = new Client({ connectionString: ADMIN });
  await c.connect();
  await c.query(`drop database if exists ${TEST_DB} with (force)`);
  await c.query(`create database ${TEST_DB}`);
  await c.end();
  await runMigrations(ADMIN.replace(/\/bechakena$/, `/${TEST_DB}`));
}
