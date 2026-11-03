import { networkInsights } from "@/server/integrations/couriers/service";
import { route } from "@/server/http";
import { actor } from "../_auth";

/** Courier success by district across the network (only when 3+ shops contribute). */
export const GET = route(async (req: Request) => {
  const a = await actor();
  const district = (new URL(req.url).searchParams.get("district") ?? "").slice(0, 40);
  return { district, couriers: district ? await networkInsights(a.businessId, district) : [] };
});
