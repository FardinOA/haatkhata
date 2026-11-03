import { clearSessionCookie, getAuth, revokeSession } from "@/server/auth/session";
import { route } from "@/server/http";

export const POST = route(async () => {
  const a = await getAuth();
  if (a) await revokeSession(a.user.id, a.sessionId);
  await clearSessionCookie();
  return { ok: true };
});
