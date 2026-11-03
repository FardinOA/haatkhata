import { consignmentsFor } from "@/server/integrations/couriers/service";
import { route } from "@/server/http";
import { actor } from "../_auth";

export const GET = route(async (req: Request) => {
  const a = await actor();
  const orderId = new URL(req.url).searchParams.get("orderId") ?? "";
  return { consignments: orderId ? await consignmentsFor(a.businessId, orderId) : [] };
});
