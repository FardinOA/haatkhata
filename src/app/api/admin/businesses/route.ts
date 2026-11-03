import { requireSuperAdmin, searchBusinesses } from "@/server/admin/service";
import { getAuth } from "@/server/auth/session";
import { route } from "@/server/http";

export const GET = route(async (req: Request) => {
  requireSuperAdmin(await getAuth());
  return { businesses: await searchBusinesses(new URL(req.url).searchParams.get("q") ?? "") };
});
