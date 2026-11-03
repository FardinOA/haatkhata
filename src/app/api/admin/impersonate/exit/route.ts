import { cookies } from "next/headers";
import { logAdmin } from "@/server/admin/service";
import { getAuth, revokeSession, SESSION_COOKIE } from "@/server/auth/session";
import { HttpError, route } from "@/server/http";

const ADMIN_RETURN_COOKIE = "bk_admin_return";

/** Ends impersonation and restores the admin's own session. */
export const POST = route(async () => {
  const a = await getAuth();
  if (!a?.impersonatedBy) throw new HttpError(400, "You're not impersonating anyone");
  await revokeSession(a.user.id, a.sessionId);
  await logAdmin(a.impersonatedBy, "impersonate.end", a.businessId, null);
  const jar = await cookies();
  const back = jar.get(ADMIN_RETURN_COOKIE)?.value;
  if (back) jar.set(SESSION_COOKIE, back, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 30 * 86_400 });
  else jar.delete(SESSION_COOKIE);
  jar.delete(ADMIN_RETURN_COOKIE);
  return { ok: true, restored: !!back };
});
