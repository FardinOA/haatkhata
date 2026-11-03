import { requireBusiness } from "@/server/auth/session";
import { withTenant } from "@/server/db";
import { route } from "@/server/http";
import { snapshot } from "@/server/state-io";

/** Everything that changed since `?since=` (ISO cursor), or a full snapshot. */
export const GET = route(async (req: Request) => {
  const a = await requireBusiness();
  const since = new URL(req.url).searchParams.get("since");
  const when = since ? new Date(since) : undefined;
  const snap = await withTenant(a.businessId, (tx) => snapshot(tx, a.businessId, a.role, when && !Number.isNaN(when.getTime()) ? when : undefined));
  return { ...snap, businessId: a.businessId, me: { id: a.user.id, name: a.user.name || a.user.phone, role: a.role } };
});
