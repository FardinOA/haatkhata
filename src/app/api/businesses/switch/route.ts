import { z } from "zod";
import { requireAuth, switchBusiness } from "@/server/auth/session";
import { json, route } from "@/server/http";

/** Switch between businesses on one account (FR-AUTH-03). */
export const POST = route(async (req: Request) => {
  const a = await requireAuth();
  const { businessId } = await json(req, z.object({ businessId: z.string() }));
  await switchBusiness(a.sessionId, a.user.id, businessId);
  return { ok: true };
});
