import { z } from "zod";
import { createAdminSession, verifyOtp } from "@/server/auth/session";
import { clientIp, HttpError, json, route } from "@/server/http";

export const POST = route(async (req: Request) => {
  const { phone, code } = await json(req, z.object({ phone: z.string().min(10).max(20), code: z.string().length(6) }));
  const user = await verifyOtp(phone, code);
  if (!user.isSuperAdmin) throw new HttpError(403, "This number doesn't have admin access");
  await createAdminSession(user.id, { ip: clientIp(req), userAgent: req.headers.get("user-agent") ?? undefined });
  return { user: { id: user.id, phone: user.phone, name: user.name } };
});
