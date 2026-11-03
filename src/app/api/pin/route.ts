import { z } from "zod";
import { clearPin, hasPin, setPin } from "@/server/auth/pin";
import { requireAuth } from "@/server/auth/session";
import { json, route } from "@/server/http";

/** Quick-unlock PIN for this device (FR-AUTH-08). */
export const GET = route(async () => {
  const a = await requireAuth();
  return { hasPin: await hasPin(a.sessionId) };
});

export const POST = route(async (req: Request) => {
  const a = await requireAuth();
  const { pin } = await json(req, z.object({ pin: z.string() }));
  await setPin(a.sessionId, a.user.id, pin);
  return { ok: true };
});

export const DELETE = route(async () => {
  const a = await requireAuth();
  await clearPin(a.sessionId);
  return { ok: true };
});
