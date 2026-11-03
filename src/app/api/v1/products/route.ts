import { asc } from "drizzle-orm";
import { v1, pageParams } from "@/server/api-keys/v1";
import { schema, withTenant } from "@/server/db";

/** GET /api/v1/products — catalogue with variants and live availability. Buying prices are never exposed. */
export const GET = v1("read", async (auth, req) => {
  const { limit } = pageParams(req);
  return withTenant(auth.businessId, async (tx) => {
    const ps = await tx.select().from(schema.products).orderBy(asc(schema.products.createdAt)).limit(limit);
    const vs = await tx.select().from(schema.variants);
    return {
      object: "list",
      data: ps.map((p) => ({
        id: p.id,
        name: p.name,
        name_bn: p.nameBn,
        category_id: p.categoryId,
        status: p.status,
        images: p.images,
        variants: vs
          .filter((v) => v.productId === p.id)
          .sort((a, b) => a.position - b.position)
          .map((v) => ({ id: v.id, sku: v.sku, barcode: v.barcode, options: v.options, price: v.price, mrp: v.mrp, available: v.onHand - v.reserved, active: v.active })),
      })),
    };
  });
});
