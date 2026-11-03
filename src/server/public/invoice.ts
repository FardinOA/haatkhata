import "server-only";
/**
 * Public, read-only invoice links (SRS FR-INV-04, NFR-SEC-05).
 *
 * Tokens are 192-bit random (base64url, 32 chars) and stored on the order.
 * Revoking clears the token, so the old link stops working immediately.
 *
 * RLS stays intact: the owner connection is used for exactly one thing —
 * resolving a token to its (business_id, order_id) with an indexed equality
 * lookup. Every byte of order data is then read inside withTenant(), i.e. as
 * bk_app under the business's row-level security policy, and the result is
 * reduced to a public DTO: no buying prices, internal notes, staff names or
 * full customer phone numbers.
 */
import { randomBytes } from "node:crypto";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { orderTotals } from "@/lib/domain";
import type { OrderStatus } from "@/lib/types";
import { isPaidPlan } from "../billing/plans";
import { db, schema, withTenant } from "../db";

const { orders, orderLines, orderEvents, payments, businesses } = schema;

export const TOKEN_RE = /^[A-Za-z0-9_-]{32}$/;
export const newPublicToken = () => randomBytes(24).toString("base64url");

/** Returns the order's link token, creating one if needed. */
export async function ensurePublicToken(businessId: string, orderId: string): Promise<string | null> {
  return withTenant(businessId, async (tx) => {
    const fresh = newPublicToken();
    await tx.update(orders).set({ publicToken: fresh }).where(and(eq(orders.id, orderId), isNull(orders.publicToken)));
    const [row] = await tx.select({ token: orders.publicToken }).from(orders).where(eq(orders.id, orderId));
    return row?.token ?? null;
  });
}

export async function getPublicTokens(businessId: string, orderIds: string[]) {
  if (!orderIds.length) return {};
  const rows = await withTenant(businessId, (tx) => tx.select({ id: orders.id, token: orders.publicToken }).from(orders).where(inArray(orders.id, orderIds)));
  return Object.fromEntries(rows.filter((r) => r.token).map((r) => [r.id, r.token as string]));
}

export async function revokePublicToken(businessId: string, orderId: string) {
  return withTenant(businessId, async (tx) => {
    const res = await tx.update(orders).set({ publicToken: null }).where(eq(orders.id, orderId)).returning({ id: orders.id });
    return res.length > 0;
  });
}

const maskPhone = (p?: string) => (p && p.length >= 8 ? `${p.slice(0, 3)}••••${p.slice(-4)}` : "");

export type PublicInvoice = Awaited<ReturnType<typeof getPublicInvoice>>;

export async function getPublicInvoice(token: string) {
  if (!TOKEN_RE.test(token)) return null;
  // Owner connection: token → tenant only. No order data is read here.
  const [hit] = await db.select({ businessId: orders.businessId, id: orders.id }).from(orders).where(eq(orders.publicToken, token)).limit(1);
  if (!hit) return null;

  return withTenant(hit.businessId, async (tx) => {
    const [[o], [b], lines, events, pays] = await Promise.all([
      tx.select().from(orders).where(and(eq(orders.id, hit.id), eq(orders.publicToken, token))),
      tx.select().from(businesses).where(eq(businesses.id, hit.businessId)),
      tx.select().from(orderLines).where(eq(orderLines.orderId, hit.id)).orderBy(asc(orderLines.position)),
      tx.select().from(orderEvents).where(eq(orderEvents.orderId, hit.id)).orderBy(asc(orderEvents.at)),
      tx.select().from(payments).where(eq(payments.orderId, hit.id)),
    ]);
    if (!o || !b) return null;
    const shaped = {
      lines: lines.map((l) => ({ qty: l.qty, price: l.price, discount: l.discount, returnedQty: l.returnedQty, cost: 0 })),
      discount: o.discount,
      deliveryCharge: o.deliveryCharge,
      otherCharges: o.otherCharges,
      payments: pays.map((p) => ({ amount: p.amount })),
      settlement: o.settlement as "cod" | "due",
    };
    const t = orderTotals(shaped as never);
    const customer = (o.customer ?? null) as { name?: string; phone?: string; address?: { line: string; area: string; district: string } } | null;
    const inv = (b.invoice ?? {}) as Record<string, unknown>;
    const theme = (b.theme ?? {}) as Record<string, unknown>;
    const courier = (o.courier ?? null) as { name?: string; tracking?: string } | null;
    return {
      business: {
        name: b.name,
        nameBn: b.nameBn,
        tagline: b.tagline,
        phone: b.phone,
        address: b.address,
        facebook: b.facebook,
        logo: b.logo,
        logoShape: b.logoShape,
        accent: typeof theme.accent === "string" ? theme.accent : "#0E6B53",
        lang: inv.lang === "bn" ? "bn" : "en",
        numerals: inv.numerals === "bangla" ? "bangla" : "latin",
        thanks: String(inv.thanks ?? ""),
        footer: String(inv.footer ?? ""),
        terms: String(inv.terms ?? ""),
        // No paid plan: the customer still gets the invoice, stamped as a trial (print-quota.ts covers the seller's own printing).
        trial: !isPaidPlan(b.plan),
      },
      order: {
        no: o.no,
        invoiceNo: o.invoiceNo,
        status: o.status as OrderStatus,
        channel: o.channel,
        createdAt: o.createdAt.toISOString(),
        customer: customer ? { name: customer.name ?? "", phone: maskPhone(customer.phone), address: customer.address ?? null } : null,
        lines: lines.map((l) => ({ name: l.name, variantLabel: l.variantLabel, qty: l.qty, price: l.price, discount: l.discount, returnedQty: l.returnedQty })),
        totals: { subtotal: t.subtotal, discount: t.discount, delivery: o.deliveryCharge, other: o.otherCharges, total: t.total, paid: t.paid, cod: t.cod, due: t.due },
        settlement: o.settlement,
        codReceived: !!o.codReceived,
        courier: courier?.name ? { name: courier.name, tracking: courier.tracking ?? null } : null,
        noteForCustomer: o.notesInvoice ?? null,
        // Status changes only; who did it stays private.
        timeline: events.filter((e) => e.type === "status" || e.type === "created").map((e) => ({ status: (e.type === "created" ? "draft" : e.toStatus) as OrderStatus, at: e.at.toISOString() })),
      },
    };
  });
}
