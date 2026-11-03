import { createHash, randomBytes } from "node:crypto";
import { and, desc, eq, inArray, lt } from "drizzle-orm";
import { z } from "zod";
import { CHANNELS, normalizePhone } from "@/lib/domain";
import { applyCommand } from "@/server/apply";
import { v1, pageParams } from "@/server/api-keys/v1";
import { schema, withTenant } from "@/server/db";
import { HttpError } from "@/server/http";
import { loadOrderPublic, listOrdersPublic } from "./shared";

/** GET /api/v1/orders?status=&limit=&created_before= */
export const GET = v1("read", async (auth, req) => {
  const { limit, before, url } = pageParams(req);
  const status = url.searchParams.get("status");
  const rows = await withTenant(auth.businessId, (tx) =>
    tx
      .select({ id: schema.orders.id })
      .from(schema.orders)
      .where(and(status ? eq(schema.orders.status, status) : undefined, before ? lt(schema.orders.createdAt, before) : undefined))
      .orderBy(desc(schema.orders.createdAt))
      .limit(limit + 1),
  );
  const data = await listOrdersPublic(auth.businessId, rows.slice(0, limit).map((r) => r.id));
  return { object: "list", has_more: rows.length > limit, data };
});

const createBody = z.object({
  channel: z.enum(CHANNELS as [string, ...string[]]).default("website"),
  status: z.enum(["draft", "confirmed"]).default("confirmed"),
  customer: z.object({ name: z.string().min(1).max(80), phone: z.string(), address: z.object({ line: z.string().max(200), area: z.string().max(80), district: z.string().max(40) }).optional() }).optional(),
  items: z.array(z.object({ variant_id: z.string(), qty: z.number().int().min(1).max(1000) })).min(1).max(100),
  discount: z.number().min(0).default(0),
  delivery_charge: z.number().min(0).default(0),
  advance_paid: z.object({ method: z.enum(["bkash", "nagad", "rocket", "bank", "card", "cash"]), amount: z.number().positive(), txn_id: z.string().max(60).optional() }).optional(),
  settlement: z.enum(["cod", "due"]).default("cod"),
  note: z.string().max(500).optional(),
});

/**
 * POST /api/v1/orders — creates an order through the same command path as the
 * app, so stock is reserved and limits/permissions apply. Send an
 * `Idempotency-Key` header to make retries safe.
 */
export const POST = v1("write", async (auth, req) => {
  const body = createBody.parse(await req.json().catch(() => ({})));
  const phone = body.customer ? normalizePhone(body.customer.phone) : null;
  if (body.customer && !phone) throw new HttpError(400, "customer.phone must be a Bangladeshi mobile number.");
  const variants = await withTenant(auth.businessId, (tx) => tx.select().from(schema.variants).where(inArray(schema.variants.id, body.items.map((i) => i.variant_id))));
  const lines = body.items.map((i) => {
    const v = variants.find((x) => x.id === i.variant_id);
    if (!v) throw new HttpError(400, `Unknown variant_id ${i.variant_id}`);
    return { key: i.variant_id, productId: v.productId, variantId: v.id, qty: i.qty, price: v.price, discount: 0 };
  });
  const idem = req.headers.get("idempotency-key");
  const commandId = idem ? `api${createHash("sha256").update(`${auth.keyId}:${idem}`).digest("hex").slice(0, 24)}` : `api${randomBytes(12).toString("hex")}`;
  const outcome = await applyCommand(
    { businessId: auth.businessId, userId: `api:${auth.keyId}`, userName: `API · ${auth.name}`, role: "manager" },
    {
      id: commandId,
      type: "order.create",
      at: new Date().toISOString(),
      payload: {
        mode: body.status === "draft" ? "draft" : "confirm",
        input: {
          channel: body.channel,
          customer: body.customer ? { name: body.customer.name, phone: phone!, address: body.customer.address } : null,
          lines,
          discount: { type: "flat", value: body.discount },
          deliveryCharge: body.delivery_charge,
          otherCharges: 0,
          payments: body.advance_paid ? [{ method: body.advance_paid.method, amount: body.advance_paid.amount, txnId: body.advance_paid.txn_id, kind: "advance" }] : [],
          settlement: body.settlement,
          notesInvoice: body.note,
        },
      },
    },
  );
  if (outcome.status === "rejected") throw new HttpError(outcome.code === "limit" ? 402 : outcome.code === "forbidden" ? 403 : 422, outcome.error ?? "Order rejected", outcome.code);
  const orderId = (outcome.result as { id: string } | undefined)?.id;
  const order = orderId ? await loadOrderPublic(auth.businessId, orderId) : null;
  return Response.json({ ...(order ?? {}), idempotent_replay: outcome.status === "duplicate" }, { status: outcome.status === "duplicate" ? 200 : 201 });
});
