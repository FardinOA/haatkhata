import "server-only";
import { and, eq, gt, lt, sql } from "drizzle-orm";
import { db } from "../db";
import { publicRateLimits } from "../db/schema-channels";
import { HttpError } from "../http";

/**
 * Sliding-window limit for anonymous endpoints. Counts hits per bucket in the
 * last `windowMs`; throws 429 once `max` is reached. Owner connection only —
 * this table is never exposed to tenant transactions.
 */
export async function rateLimit(bucket: string, max: number, windowMs: number, message = "Too many requests. Please wait a little and try again.") {
  const since = new Date(Date.now() - windowMs);
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(publicRateLimits).where(and(eq(publicRateLimits.bucket, bucket), gt(publicRateLimits.createdAt, since)));
  if (n >= max) throw new HttpError(429, message, "rate_limited");
  await db.insert(publicRateLimits).values({ bucket });
  // Opportunistic cleanup keeps the table small.
  if (Math.random() < 0.02) await db.delete(publicRateLimits).where(lt(publicRateLimits.createdAt, new Date(Date.now() - 86_400_000)));
}
