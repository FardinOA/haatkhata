import { requireBusiness } from "@/server/auth/session";
import { route } from "@/server/http";
import { newPairToken, phoneOrigin } from "@/server/scan-relay";

/** Where a phone should open scanner links from this computer. */
export const GET = route(async (req: Request) => {
  await requireBusiness();
  return { base: phoneOrigin(req) };
});

/** A new phone-scanner link for this shop (also how a leaked link is replaced). */
export const POST = route(async (req: Request) => {
  const a = await requireBusiness();
  return { token: newPairToken(a.businessId), base: phoneOrigin(req) };
});
