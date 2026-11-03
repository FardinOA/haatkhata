import { timingSafeEqual } from "node:crypto";
import { route, HttpError } from "@/server/http";
import { runDailySummaries } from "@/server/notify/summary";
import { processDueDeliveries } from "@/server/notify/webhooks";

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  const got = (req.headers.get("authorization") ?? "").replace(/^Bearer /, "");
  return got.length === secret.length && timingSafeEqual(Buffer.from(got), Buffer.from(secret));
}

/**
 * Scheduled jobs. Call hourly for daily summaries (each user gets theirs at
 * their chosen Dhaka hour) and every minute with ?job=webhooks for retries.
 * Auth: `Authorization: Bearer $CRON_SECRET`.
 */
export const GET = route(async (req: Request) => {
  if (!authorized(req)) throw new HttpError(401, "Unauthorized");
  const job = new URL(req.url).searchParams.get("job") ?? "all";
  const out: Record<string, unknown> = {};
  if (job === "all" || job === "summary") out.summary = await runDailySummaries();
  if (job === "all" || job === "webhooks") out.webhooks = await processDueDeliveries(100);
  return out;
});
