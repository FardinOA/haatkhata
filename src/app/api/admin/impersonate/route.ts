import { cookies } from "next/headers";
import { z } from "zod";
import { impersonationTarget, requireSuperAdmin } from "@/server/admin/service";
import { createSession, getAuth, SESSION_COOKIE } from "@/server/auth/session";
import { clientIp, json, route } from "@/server/http";

const ADMIN_RETURN_COOKIE = "bk_admin_return";

/** Sign in as a shop's owner to help them, with a mandatory, logged reason. */
export const POST = route(async (req: Request) => {
  const a = await getAuth();
  requireSuperAdmin(a);
  const { businessId, reason } = await json(req, z.object({ businessId: z.string(), reason: z.string().trim().min(5, "Say why you need access").max(300) }));
  const ownerId = await impersonationTarget(a.user.id, businessId, reason);
  const jar = await cookies();
  const adminToken = jar.get(SESSION_COOKIE)?.value;
  if (adminToken) jar.set(ADMIN_RETURN_COOKIE, adminToken, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 8 * 3600 });
  await createSession(ownerId, { businessId, impersonatedBy: a.user.id, ip: clientIp(req), userAgent: req.headers.get("user-agent") ?? undefined });
  return { ownerUserId: ownerId };
});
