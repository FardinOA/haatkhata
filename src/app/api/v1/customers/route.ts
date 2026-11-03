import { desc, lt } from "drizzle-orm";
import { v1, pageParams } from "@/server/api-keys/v1";
import { schema, withTenant } from "@/server/db";

/** GET /api/v1/customers?limit=&created_before= */
export const GET = v1("read", async (auth, req) => {
  const { limit, before } = pageParams(req);
  const rows = await withTenant(auth.businessId, (tx) =>
    tx
      .select()
      .from(schema.customers)
      .where(before ? lt(schema.customers.createdAt, before) : undefined)
      .orderBy(desc(schema.customers.createdAt))
      .limit(limit + 1),
  );
  return {
    object: "list",
    has_more: rows.length > limit,
    data: rows.slice(0, limit).map((c) => ({ id: c.id, name: c.name, phone: c.phone, address: c.address, channel: c.channel, tags: c.tags, created_at: c.createdAt.toISOString() })),
  };
});
