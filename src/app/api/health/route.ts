import { sql } from "drizzle-orm";
import { connection } from "next/server";
import { db } from "@/server/db";

/** Liveness + database check for uptime monitoring (NFR-MNT-03). */
export async function GET() {
  await connection(); // always answer at request time, never from the build
  const started = Date.now();
  try {
    await db.execute(sql`select 1`);
    return Response.json({ ok: true, db: "up", ms: Date.now() - started }, { headers: { "cache-control": "no-store" } });
  } catch {
    return Response.json({ ok: false, db: "down" }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
