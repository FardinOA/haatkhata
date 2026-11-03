import { runBillingHousekeeping } from "@/server/billing/service";
import { HttpError, route } from "@/server/http";

/** Daily: renewal reminders and lapsed-plan downgrades. Call with `Authorization: Bearer $CRON_SECRET`. */
export const POST = route(async (req: Request) => {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) throw new HttpError(401, "Unauthorized");
  return runBillingHousekeeping();
});
