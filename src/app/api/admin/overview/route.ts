import { listAnnouncements, overview, requireSuperAdmin, segmentCounts } from "@/server/admin/service";
import { getAdminAuth } from "@/server/auth/session";
import { route } from "@/server/http";

export const GET = route(async () => {
  requireSuperAdmin(await getAdminAuth());
  const [o, segments, announcements] = await Promise.all([overview(), segmentCounts(), listAnnouncements()]);
  return { ...o, segments, announcements };
});
