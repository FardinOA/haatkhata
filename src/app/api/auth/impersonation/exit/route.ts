import { logAdmin } from "@/server/admin/service";
import { clearSessionCookie, getAuth, revokeSession } from "@/server/auth/session";
import { HttpError, route } from "@/server/http";

/** Ends an admin's owner session in the shop app. The admin console's own session was never touched. */
export const POST = route(async () => {
  const a = await getAuth();
  if (!a?.impersonatedBy) throw new HttpError(400, "You're not impersonating anyone");
  await revokeSession(a.user.id, a.sessionId);
  await logAdmin(a.impersonatedBy, "impersonate.end", a.businessId, null);
  await clearSessionCookie();
  return { ok: true, adminUrl: process.env.NEXT_PUBLIC_ADMIN_URL || (process.env.NODE_ENV === "production" ? null : "http://localhost:5173") };
});
