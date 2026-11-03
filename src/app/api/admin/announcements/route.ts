import { z } from "zod";
import { announce, listAnnouncements, requireSuperAdmin } from "@/server/admin/service";
import { getAuth } from "@/server/auth/session";
import { json, route } from "@/server/http";

export const GET = route(async () => {
  requireSuperAdmin(await getAuth());
  return { announcements: await listAnnouncements() };
});

/** Broadcast a notice to every business. */
export const POST = route(async (req: Request) => {
  const a = await getAuth();
  requireSuperAdmin(a);
  const { title, body, href } = await json(req, z.object({ title: z.string().trim().min(3).max(140), body: z.string().trim().max(500).optional(), href: z.string().trim().max(200).optional() }));
  return announce(a.user.id, title, body || null, href || null);
});
