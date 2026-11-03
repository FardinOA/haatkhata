import { publicInfo } from "@/server/integrations/payments/service";
import { route } from "@/server/http";

/** Public: only what the buyer's pay page needs. */
export const GET = route(async (_req: Request, ctx: RouteContext<"/api/payment-links/public/[token]">) => publicInfo((await ctx.params).token));
