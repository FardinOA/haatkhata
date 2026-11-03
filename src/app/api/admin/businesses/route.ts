import { requireSuperAdmin, searchBusinesses, SEGMENTS, type Segment } from "@/server/admin/service";
import { getAdminAuth } from "@/server/auth/session";
import { route } from "@/server/http";

export const GET = route(async (req: Request) => {
  requireSuperAdmin(await getAdminAuth());
  const params = new URL(req.url).searchParams;
  const segment = params.get("segment") as Segment;
  return { businesses: await searchBusinesses(params.get("q") ?? "", SEGMENTS.includes(segment) ? segment : "all") };
});
