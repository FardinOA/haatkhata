import { v1 } from "@/server/api-keys/v1";
import { HttpError } from "@/server/http";
import { loadOrderPublic } from "../shared";

/** GET /api/v1/orders/:id */
export const GET = v1("read", async (auth, _req, ctx: RouteContext<"/api/v1/orders/[id]">) => {
  const { id } = await ctx.params;
  const order = await loadOrderPublic(auth.businessId, id);
  if (!order) throw new HttpError(404, "No such order", "not_found");
  return order;
});
