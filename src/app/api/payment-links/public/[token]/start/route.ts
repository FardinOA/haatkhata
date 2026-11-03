import { startPayment } from "@/server/integrations/payments/service";
import { route } from "@/server/http";

export const POST = route(async (req: Request, ctx: RouteContext<"/api/payment-links/public/[token]/start">) => startPayment((await ctx.params).token, new URL(req.url).origin));
