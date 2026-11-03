import { listAnnouncements, overview, requireSuperAdmin } from "@/server/admin/service";
import { getAuth } from "@/server/auth/session";
import { route } from "@/server/http";

export const GET = route(async () => {
  requireSuperAdmin(await getAuth());
  return { ...(await overview()), announcements: await listAnnouncements() };
});
