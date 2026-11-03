import { z } from "zod";
import { PROVIDER_IDS } from "@/components/couriers/courier-meta";
import type { CourierProvider } from "@/lib/types";
import { getPrefs, setPrefs } from "@/server/integrations/couriers/service";
import { json, route } from "@/server/http";
import { actor } from "../_auth";

export const GET = route(async () => getPrefs((await actor()).businessId));

export const PATCH = route(async (req: Request) => {
  const a = await actor(["owner", "manager"]);
  const patch = await json(
    req,
    z.object({
      defaultProvider: z.enum(PROVIDER_IDS as [CourierProvider, ...CourierProvider[]]).nullable().optional(),
      pickup: z.object({ name: z.string().max(80).optional(), phone: z.string().max(20).optional(), address: z.string().max(300).optional(), district: z.string().max(40).optional() }).optional(),
      advanceOnHighRisk: z.boolean().optional(),
    }),
  );
  return setPrefs(a.businessId, patch);
});
