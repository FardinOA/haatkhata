import { z } from "zod";
import { can } from "@/lib/domain";
import { requireBusiness } from "@/server/auth/session";
import { startCheckout } from "@/server/billing/service";
import { HttpError, json, route } from "@/server/http";
import { GatewayError } from "@/server/integrations/billing";

export const POST = route(async (req: Request) => {
  const a = await requireBusiness();
  if (!can(a.role, "billing")) throw new HttpError(403, "Only the owner can change the plan");
  const body = await json(req, z.object({ plan: z.enum(["starter", "business", "pro"]), term: z.enum(["month", "quarter", "year"]), method: z.enum(["bkash", "nagad", "card", "rocket", "bank"]) }));
  try {
    return await startCheckout({ businessId: a.businessId, userId: a.user.id, ...body, origin: new URL(req.url).origin });
  } catch (e) {
    if (e instanceof GatewayError) throw new HttpError(502, e.message);
    throw e;
  }
});
