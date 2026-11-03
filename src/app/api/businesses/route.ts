import { requireAuth, switchBusiness } from "@/server/auth/session";
import { createBusiness, listBusinesses, onboardingSchema } from "@/server/business";
import { json, route } from "@/server/http";

export const GET = route(async () => {
  const a = await requireAuth();
  return { businesses: await listBusinesses(a.user.id) };
});

/** Onboarding wizard (FR-AUTH-02). */
export const POST = route(async (req: Request) => {
  const a = await requireAuth();
  const input = await json(req, onboardingSchema);
  const id = await createBusiness(a.user.id, input);
  await switchBusiness(a.sessionId, a.user.id, id);
  return { businessId: id };
});
