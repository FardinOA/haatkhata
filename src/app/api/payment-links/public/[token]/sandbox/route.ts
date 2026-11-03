import { z } from "zod";
import { completePayment } from "@/server/integrations/payments/service";
import { json, route } from "@/server/http";

/** Test wallet: Approve / Decline from the pay page. */
export const POST = route(async (req: Request, ctx: RouteContext<"/api/payment-links/public/[token]/sandbox">) => {
  const { outcome } = await json(req, z.object({ outcome: z.enum(["approve", "decline"]) }));
  return completePayment((await ctx.params).token, new URLSearchParams({ outcome }));
});
