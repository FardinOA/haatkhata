import { requireSuperAdmin } from "@/server/admin/service";
import { getAdminAuth } from "@/server/auth/session";
import { route } from "@/server/http";

export const GET = route(async () => {
  const a = await getAdminAuth();
  requireSuperAdmin(a);
  return { user: { id: a.user.id, phone: a.user.phone, name: a.user.name } };
});
