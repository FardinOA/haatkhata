import { z } from "zod";
import { applyCommand } from "@/server/apply";
import { requireBusiness } from "@/server/auth/session";
import { json, route } from "@/server/http";

/** Devices send queued commands here, oldest first. Each is applied once (idempotent by id). */
export const POST = route(async (req: Request) => {
  const a = await requireBusiness();
  const { commands } = await json(req, z.object({ commands: z.array(z.unknown()).max(200) }));
  const results = [];
  for (const c of commands) results.push(await applyCommand({ businessId: a.businessId, userId: a.user.id, userName: a.user.name || a.user.phone, role: a.role }, c));
  return { results };
});
