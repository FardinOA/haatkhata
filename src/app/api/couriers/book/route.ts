import { z } from "zod";
import { PROVIDER_IDS } from "@/components/couriers/courier-meta";
import type { CourierProvider } from "@/lib/types";
import { bookOrders } from "@/server/integrations/couriers/service";
import { json, route } from "@/server/http";
import { actor } from "../_auth";

/** Books one or many orders with a courier and marks them shipped. */
export const POST = route(async (req: Request) => {
  const a = await actor();
  const { orderIds, provider } = await json(req, z.object({ orderIds: z.array(z.string()).min(1).max(200), provider: z.enum(PROVIDER_IDS as [CourierProvider, ...CourierProvider[]]) }));
  return { results: await bookOrders(a, orderIds, provider) };
});
