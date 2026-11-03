import "server-only";
/**
 * Things that happen after a command is committed on the server: customer SMS,
 * push to the owner, outbound webhooks. Never throws — a failed notification
 * must not fail the sale.
 *
 * Called from src/server/apply.ts once a command is applied.
 */
import { and, eq, inArray } from "drizzle-orm";
import type { QueuedCommand } from "@/lib/commands";
import { orderTotals } from "@/lib/domain";
import type { Order, OrderStatus, Role } from "@/lib/types";
import { schema, withTenant } from "../db";
import { notifyUsers } from "./push";
import { sendCustomerSms, type SmsKey } from "./sms";
import { enqueueEvent } from "./webhooks";

export type PostApplyContext = { businessId: string; userId: string; userName: string; role: Role; command: QueuedCommand; result: unknown };

async function loadOrder(businessId: string, orderId: string) {
  return withTenant(businessId, async (tx) => {
    const [o] = await tx.select().from(schema.orders).where(eq(schema.orders.id, orderId));
    if (!o) return null;
    const [lines, pays, [biz]] = await Promise.all([
      tx.select().from(schema.orderLines).where(eq(schema.orderLines.orderId, orderId)),
      tx.select().from(schema.payments).where(eq(schema.payments.orderId, orderId)),
      tx.select({ name: schema.businesses.name, phone: schema.businesses.phone }).from(schema.businesses).where(eq(schema.businesses.id, businessId)),
    ]);
    const order = {
      id: o.id,
      no: o.no,
      status: o.status as OrderStatus,
      channel: o.channel,
      customer: o.customer as Order["customer"],
      customerId: o.customerId ?? undefined,
      courier: (o.courier as unknown as Order["courier"]) ?? undefined,
      invoiceNo: o.invoiceNo ?? undefined,
      settlement: o.settlement as Order["settlement"],
      discount: o.discount,
      deliveryCharge: o.deliveryCharge,
      otherCharges: o.otherCharges,
      lines: lines.map((l) => ({ ...l, returnedQty: l.returnedQty })),
      payments: pays.map((p) => ({ id: p.id, method: p.method, amount: p.amount, kind: p.kind, at: p.at.toISOString() })),
      createdAt: o.createdAt.toISOString(),
      createdBy: o.createdBy,
    };
    return { order, shop: biz?.name ?? "", shopPhone: biz?.phone ?? "" };
  });
}

/** Public, cost-free shape used in webhooks and the REST API. */
export function publicOrder(o: NonNullable<Awaited<ReturnType<typeof loadOrder>>>["order"]) {
  const t = orderTotals(o as never);
  return {
    id: o.id,
    number: o.no,
    invoice_no: o.invoiceNo ?? null,
    status: o.status,
    channel: o.channel,
    customer: o.customer ? { name: o.customer.name, phone: o.customer.phone, address: o.customer.address ?? null } : null,
    items: o.lines.map((l) => ({ product_id: l.productId, variant_id: l.variantId, sku: l.sku, name: l.name, variant: l.variantLabel, qty: l.qty, price: l.price, discount: l.discount, returned_qty: l.returnedQty })),
    totals: { subtotal: t.subtotal, discount: t.discount, delivery: o.deliveryCharge, total: t.total, paid: t.paid, cod: t.cod, due: t.due },
    courier: o.courier ?? null,
    created_at: o.createdAt,
  };
}

async function orderSms(businessId: string, key: SmsKey, orderId: string) {
  const loaded = await loadOrder(businessId, orderId);
  if (!loaded?.order.customer?.phone) return;
  const { order, shop, shopPhone } = loaded;
  const t = orderTotals(order as never);
  await sendCustomerSms(businessId, {
    key,
    to: order.customer!.phone,
    orderId,
    customerId: order.customerId,
    vars: { customer: order.customer!.name, shop, shop_phone: shopPhone, order: String(order.no), total: String(t.total), cod: String(t.cod), due: String(t.due), courier: order.courier?.name ?? "", tracking: order.courier?.tracking ?? "" },
  });
}

async function lowStockCheck(businessId: string, variantIds: string[]) {
  if (!variantIds.length) return;
  const low = await withTenant(businessId, (tx) =>
    tx
      .select({ name: schema.products.name, options: schema.variants.options, onHand: schema.variants.onHand, reserved: schema.variants.reserved, lowStock: schema.variants.lowStock })
      .from(schema.variants)
      .innerJoin(schema.products, and(eq(schema.products.id, schema.variants.productId), eq(schema.products.businessId, schema.variants.businessId)))
      .where(inArray(schema.variants.id, variantIds)),
  );
  const hits = low.filter((v) => v.onHand - v.reserved <= v.lowStock);
  if (!hits.length) return;
  const names = hits.map((h) => `${h.name} ${Object.values(h.options).join(" / ")} (${Math.max(0, h.onHand - h.reserved)} left)`.trim());
  await notifyUsers(businessId, "low_stock", { title: hits.length === 1 ? "Running low" : `${hits.length} items running low`, body: names.slice(0, 3).join(", "), url: "/inventory?action=stock-in", tag: "low-stock" });
}

export async function runPostApplyHooks(ctx: PostApplyContext) {
  const { businessId, command, userId, userName, role } = ctx;
  const p = command.payload as Record<string, unknown>;
  try {
    switch (command.type) {
      case "order.create": {
        const order = ctx.result as Order | undefined;
        const mode = (p as { mode: string }).mode;
        if (!order || mode === "draft") return;
        const loaded = await loadOrder(businessId, order.id);
        if (loaded) await enqueueEvent(businessId, "order.created", publicOrder(loaded.order));
        if (mode === "confirm") await orderSms(businessId, "order_confirmed", order.id);
        if (role !== "owner") {
          const total = orderTotals(order).total;
          await notifyUsers(businessId, "new_order", { title: `New order #${order.no}`, body: `${userName} · ${order.customer?.name ?? "Walk-in"} · ৳${total}`, url: `/orders?id=${order.id}`, tag: `order-${order.id}` }, { exceptUserId: userId });
        }
        await lowStockCheck(businessId, order.lines.map((l) => l.variantId));
        return;
      }
      case "order.transition":
      case "order.return": {
        const orderId = p.orderId as string;
        const loaded = await loadOrder(businessId, orderId);
        if (!loaded) return;
        await enqueueEvent(businessId, "order.status_changed", { ...publicOrder(loaded.order), previous_status: null });
        if (loaded.order.status === "shipped") await orderSms(businessId, "order_shipped", orderId);
        if (loaded.order.status === "delivered") await orderSms(businessId, "order_delivered", orderId);
        if (loaded.order.status === "confirmed") await lowStockCheck(businessId, loaded.order.lines.map((l) => l.variantId));
        return;
      }
      case "order.payment":
      case "order.codReceived": {
        const ids = command.type === "order.payment" ? [p.orderId as string] : (p.orderIds as string[]);
        for (const id of ids) {
          const loaded = await loadOrder(businessId, id);
          if (loaded) await enqueueEvent(businessId, "payment.recorded", { order: publicOrder(loaded.order), kind: command.type === "order.payment" ? "payment" : "cod_payout", reference: p.ref ?? null });
        }
        return;
      }
    }
  } catch (e) {
    console.error("post-apply hook failed", command.type, e);
  }
}
