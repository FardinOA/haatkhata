import { z } from "zod";
import { requireSuperAdmin, startImpersonation } from "@/server/admin/service";
import { getAdminAuth } from "@/server/auth/session";
import { json, route } from "@/server/http";

/**
 * Opens a shop as its owner, with a mandatory, logged reason. Returns a
 * one-minute link into the shop app; the admin console keeps its own session.
 */
export const POST = route(async (req: Request) => {
  const a = await getAdminAuth();
  requireSuperAdmin(a);
  const { businessId, reason } = await json(req, z.object({ businessId: z.string(), reason: z.string().trim().min(5, "Say why you need access").max(300) }));
  const ticket = await startImpersonation(a.user.id, businessId, reason);
  const app = process.env.APP_URL || new URL(req.url).origin;
  return { url: `${app.replace(/\/$/, "")}/api/auth/handoff?t=${encodeURIComponent(ticket)}` };
});
