import { requireBusiness } from "@/server/auth/session";
import { HttpError, json, route } from "@/server/http";
import { getSettings, saveSettings, settingsSchema } from "@/server/public/storefront";
import { can } from "@/lib/domain";

export const GET = route(async () => {
  const a = await requireBusiness();
  return getSettings(a.businessId);
});

export const PUT = route(async (req: Request) => {
  const a = await requireBusiness();
  if (!can(a.role, "settings")) throw new HttpError(403, "Only the owner and managers can change the catalogue");
  await saveSettings(a.businessId, await json(req, settingsSchema));
  return getSettings(a.businessId);
});
