import { z } from "zod";
import { requireBusiness } from "@/server/auth/session";
import { requireRole } from "@/server/business";
import { HttpError, json, route } from "@/server/http";
import { addSmsCredits } from "@/server/notify/sms";

/**
 * Development/sandbox top-up. In production, credits are added by billing after
 * a successful payment (addSmsCredits in src/server/notify/sms.ts).
 */
export const POST = route(async (req: Request) => {
  const a = await requireBusiness();
  await requireRole(a.role, ["owner"]);
  if (process.env.NODE_ENV === "production" && process.env.SMS_SANDBOX_TOPUP !== "1") throw new HttpError(403, "Buy SMS credits from Plan & billing.");
  const { credits } = await json(req, z.object({ credits: z.number().int().min(1).max(5000) }));
  await addSmsCredits(a.businessId, credits, "grant", "sandbox top-up");
  return { ok: true };
});
