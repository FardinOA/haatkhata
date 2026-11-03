import { requireBusiness } from "@/server/auth/session";
import { HttpError, route } from "@/server/http";
import { notifyUsers } from "@/server/notify/push";

export const POST = route(async () => {
  const a = await requireBusiness();
  const r = await notifyUsers(a.businessId, "test", { title: "BechaKena", body: "Notifications are on for this device.", url: "/dashboard" }, { userIds: [a.user.id] });
  if ("skipped" in r) throw new HttpError(503, "Push isn't set up on this server (VAPID keys missing).");
  return r;
});
