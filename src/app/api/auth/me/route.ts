import { eq } from "drizzle-orm";
import { z } from "zod";
import { requireAuth } from "@/server/auth/session";
import { listBusinesses } from "@/server/business";
import { db, schema } from "@/server/db";
import { json, route } from "@/server/http";

export const GET = route(async () => {
  const a = await requireAuth();
  return {
    user: { id: a.user.id, phone: a.user.phone, name: a.user.name, lang: a.user.lang, numerals: a.user.numerals, isSuperAdmin: a.user.isSuperAdmin },
    businessId: a.businessId,
    role: a.role,
    impersonatedBy: a.impersonatedBy,
    businesses: await listBusinesses(a.user.id),
  };
});

export const PATCH = route(async (req: Request) => {
  const a = await requireAuth();
  const patch = await json(req, z.object({ name: z.string().trim().min(1).max(80).optional(), lang: z.enum(["en", "bn"]).optional(), numerals: z.enum(["latin", "bangla"]).optional() }));
  await db.update(schema.users).set(patch).where(eq(schema.users.id, a.user.id));
  return { ok: true };
});
