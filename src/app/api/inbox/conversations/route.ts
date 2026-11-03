import { desc } from "drizzle-orm";
import { requireBusiness } from "@/server/auth/session";
import { withTenant } from "@/server/db";
import { conversations } from "@/server/db/schema-platform";
import { route } from "@/server/http";

export const GET = route(async () => {
  const a = await requireBusiness();
  const rows = await withTenant(a.businessId, (tx) => tx.select().from(conversations).orderBy(desc(conversations.lastMessageAt)).limit(200));
  return { conversations: rows };
});
