import { z } from "zod";
import { createSession, verifyOtp } from "@/server/auth/session";
import { listBusinesses } from "@/server/business";
import { clientIp, json, route } from "@/server/http";

export const POST = route(async (req: Request) => {
  const { phone, code } = await json(req, z.object({ phone: z.string().min(10).max(20), code: z.string().length(6) }));
  const user = await verifyOtp(phone, code);
  await createSession(user.id, { ip: clientIp(req), userAgent: req.headers.get("user-agent") ?? undefined });
  return { user: { id: user.id, phone: user.phone, name: user.name }, businesses: await listBusinesses(user.id) };
});
