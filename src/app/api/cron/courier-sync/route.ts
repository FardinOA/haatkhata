import { timingSafeEqual } from "node:crypto";
import { syncOpenConsignments } from "@/server/integrations/couriers/service";
import { HttpError, route } from "@/server/http";

/** Polls couriers for open parcels. Call every 15–30 min with `Authorization: Bearer $CRON_SECRET`. */
export const GET = route(async (req: Request) => {
  const secret = process.env.CRON_SECRET ?? "";
  const got = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!secret || got.length !== secret.length || !timingSafeEqual(Buffer.from(got), Buffer.from(secret))) throw new HttpError(401, "Unauthorized");
  return syncOpenConsignments();
});
