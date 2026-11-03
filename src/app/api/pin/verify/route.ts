import { z } from "zod";
import { verifyPin } from "@/server/auth/pin";
import { clearSessionCookie, requireAuth } from "@/server/auth/session";
import { json, route } from "@/server/http";

export const POST = route(async (req: Request) => {
  const a = await requireAuth();
  const { pin } = await json(req, z.object({ pin: z.string().max(8) }));
  const r = await verifyPin(a.sessionId, pin);
  if (!r.ok && r.locked) await clearSessionCookie();
  return r;
});
