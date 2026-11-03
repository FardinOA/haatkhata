import { z } from "zod";
import { requireBusiness } from "@/server/auth/session";
import { requireRole } from "@/server/business";
import { json, route } from "@/server/http";
import { saveTemplate, SMS_KEYS } from "@/server/notify/sms";

export const PUT = route(async (req: Request) => {
  const a = await requireBusiness();
  await requireRole(a.role, ["owner", "manager"]);
  const t = await json(req, z.object({ key: z.enum(SMS_KEYS as [string, ...string[]]), lang: z.enum(["en", "bn"]), body: z.string().trim().min(5).max(480), enabled: z.boolean() }));
  await saveTemplate(a.businessId, t as Parameters<typeof saveTemplate>[1]);
  return { ok: true };
});
