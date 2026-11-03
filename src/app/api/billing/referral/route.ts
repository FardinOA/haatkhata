import { z } from "zod";
import { requireBusiness } from "@/server/auth/session";
import { applyReferral } from "@/server/billing/service";
import { HttpError, json, route } from "@/server/http";

/** Add a friend's referral code after sign-up (FR-SUB-05). */
export const POST = route(async (req: Request) => {
  const a = await requireBusiness();
  if (a.role !== "owner") throw new HttpError(403, "Only the owner can add a referral code");
  const { code } = await json(req, z.object({ code: z.string().trim().min(4).max(20) }));
  return applyReferral(a.businessId, code);
});
