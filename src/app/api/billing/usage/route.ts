import { requireBusiness } from "@/server/auth/session";
import { getUsage } from "@/server/billing/service";
import { availableMethods } from "@/server/integrations/billing";
import { route } from "@/server/http";

/** Plan, limits and usage for the signed-in business (FR-SUB-01). */
export const GET = route(async () => {
  const a = await requireBusiness();
  return { ...(await getUsage(a.businessId)), methods: availableMethods(), canPay: a.role === "owner" };
});
