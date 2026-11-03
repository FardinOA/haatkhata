import { requireBusiness } from "@/server/auth/session";
import { requireRole } from "@/server/business";
import { route } from "@/server/http";
import { smsOverview } from "@/server/notify/sms";

/** Credits balance, templates, ledger and send log (FR-NOT-03). */
export const GET = route(async () => {
  const a = await requireBusiness();
  await requireRole(a.role, ["owner", "manager", "accountant"]);
  return smsOverview(a.businessId);
});
