import "server-only";
import { inArray } from "drizzle-orm";
import { orderTotals } from "@/lib/domain";
import { schema, withTenant } from "@/server/db";

/** Orders in the public API shape: no buying prices, snake_case fields. */
export async function listOrdersPublic(businessId: string, ids: string[]) {
  if (!ids.length) return [];
  return withTenant(businessId, async (tx) => {
    const [os, ls, ps] = await Promise.all([
      tx.select().from(schema.orders).where(inArray(schema.orders.id, ids)),
      tx.select().from(schema.orderLines).where(inArray(schema.orderLines.orderId, ids)),
      tx.select().from(schema.payments).where(inArray(schema.payments.orderId, ids)),
    ]);
    return ids
      .map((id) => os.find((o) => o.id === id))
      .filter((o): o is NonNullable<typeof o> => !!o)
      .map((o) => {
        const lines = ls.filter((l) => l.orderId === o.id).sort((a, b) => a.position - b.position);
        const pays = ps.filter((p) => p.orderId === o.id);
        const t = orderTotals({ lines, discount: o.discount, deliveryCharge: o.deliveryCharge, otherCharges: o.otherCharges, payments: pays, settlement: o.settlement as "cod" | "due" } as never);
        const customer = o.customer as { name: string; phone: string; address?: unknown } | null;
        return {
          id: o.id,
          object: "order",
          number: o.no,
          invoice_no: o.invoiceNo,
          status: o.status,
          channel: o.channel,
          customer: customer ? { name: customer.name, phone: customer.phone, address: customer.address ?? null } : null,
          items: lines.map((l) => ({ variant_id: l.variantId, product_id: l.productId, sku: l.sku, name: l.name, variant: l.variantLabel, qty: l.qty, price: l.price, discount: l.discount, returned_qty: l.returnedQty })),
          totals: { subtotal: t.subtotal, discount: t.discount, delivery: o.deliveryCharge, total: t.total, paid: t.paid, cod: t.cod, due: t.due },
          courier: o.courier ?? null,
          cod_received: o.codReceived ?? null,
          created_at: o.createdAt.toISOString(),
        };
      });
  });
}

export async function loadOrderPublic(businessId: string, id: string) {
  return (await listOrdersPublic(businessId, [id]))[0] ?? null;
}
