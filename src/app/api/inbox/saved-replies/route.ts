import { randomBytes } from "node:crypto";
import { desc } from "drizzle-orm";
import { z } from "zod";
import { requireBusiness } from "@/server/auth/session";
import { withTenant } from "@/server/db";
import { savedReplies } from "@/server/db/schema-platform";
import { json, route } from "@/server/http";

export const GET = route(async () => {
  const a = await requireBusiness();
  return { replies: await withTenant(a.businessId, (tx) => tx.select().from(savedReplies).orderBy(desc(savedReplies.createdAt))) };
});

export const POST = route(async (req: Request) => {
  const a = await requireBusiness();
  const input = await json(req, z.object({ title: z.string().trim().min(1).max(60), text: z.string().trim().min(1).max(1000) }));
  const id = `sr_${randomBytes(8).toString("base64url")}`;
  await withTenant(a.businessId, (tx) => tx.insert(savedReplies).values({ businessId: a.businessId, id, ...input }));
  return { id };
});
