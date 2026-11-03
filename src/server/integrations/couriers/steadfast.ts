import "server-only";
/**
 * Steadfast Courier merchant API (portal.packzy.com/api/v1).
 * Auth: Api-Key + Secret-Key headers. Webhooks: Steadfast posts to the
 * callback URL you set in the merchant panel with `Authorization: Bearer <token>`;
 * we use the account's webhook key as that token.
 */
import { timingSafeEqual } from "node:crypto";
import { call, CourierError, requireCreds, type CourierAdapter, type CourierStatus, type Credentials } from "./types";

const BASE = process.env.STEADFAST_BASE_URL ?? "https://portal.packzy.com/api/v1";

const headers = (c: Credentials) => ({ "Api-Key": c.apiKey, "Secret-Key": c.secretKey });

export function mapSteadfast(s: string): CourierStatus {
  switch (s) {
    case "delivered":
    case "delivered_approval_pending":
      return "delivered";
    case "partial_delivered":
    case "partial_delivered_approval_pending":
      return "partial";
    case "cancelled":
    case "cancelled_approval_pending":
      return "returned"; // Steadfast "cancelled" after pickup means the parcel is coming back
    case "hold":
    case "unknown":
    case "unknown_approval_pending":
      return "hold";
    case "pending":
    case "in_review":
      return "in_transit";
    default:
      return "in_transit";
  }
}

type CreateRes = { status: number; message?: string; consignment?: { consignment_id: number | string; tracking_code: string; status: string } };

export const steadfast: CourierAdapter = {
  provider: "steadfast",
  async test(c) {
    requireCreds("steadfast", c, ["apiKey", "secretKey"]);
    await call("steadfast", `${BASE}/get_balance`, { headers: headers(c) });
  },
  async create(c, r) {
    requireCreds("steadfast", c, ["apiKey", "secretKey"]);
    const res = await call<CreateRes>("steadfast", `${BASE}/create_order`, {
      method: "POST",
      headers: headers(c),
      body: JSON.stringify({ invoice: r.invoice, recipient_name: r.recipientName, recipient_phone: r.recipientPhone, recipient_address: `${r.recipientAddress}, ${r.area}, ${r.district}`, cod_amount: Math.round(r.codAmount), note: r.note ?? "" }),
    });
    if (res.status !== 200 || !res.consignment) throw new CourierError(`steadfast: ${res.message ?? "booking was refused"}`, "steadfast");
    return { consignmentId: String(res.consignment.consignment_id), trackingCode: res.consignment.tracking_code, raw: res };
  },
  async bulkCreate(c, reqs) {
    requireCreds("steadfast", c, ["apiKey", "secretKey"]);
    // Bulk endpoint takes up to 500 orders; `data` is a JSON string.
    const res = await call<{ data?: { invoice: string; consignment_id?: number; tracking_code?: string; status: string; error?: string }[] }>("steadfast", `${BASE}/create_order/bulk-order`, {
      method: "POST",
      headers: headers(c),
      body: JSON.stringify({ data: JSON.stringify(reqs.map((r) => ({ invoice: r.invoice, recipient_name: r.recipientName, recipient_phone: r.recipientPhone, recipient_address: `${r.recipientAddress}, ${r.area}, ${r.district}`, cod_amount: Math.round(r.codAmount), note: r.note ?? "" }))) }),
      timeoutMs: 60_000,
    });
    return reqs.map((r) => {
      const row = res.data?.find((d) => d.invoice === r.invoice);
      return row?.consignment_id ? { consignmentId: String(row.consignment_id), trackingCode: row.tracking_code ?? "" } : new CourierError(`steadfast: ${row?.error ?? "not booked"}`, "steadfast");
    });
  },
  async status(c, id) {
    const res = await call<{ status: number; delivery_status: string }>("steadfast", `${BASE}/status_by_cid/${encodeURIComponent(id)}`, { headers: headers(c) });
    return { status: mapSteadfast(res.delivery_status), raw: res.delivery_status };
  },
  parseWebhook(body, h, c) {
    const auth = h.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
    if (!c.__webhookKey || auth.length !== c.__webhookKey.length || !timingSafeEqual(Buffer.from(auth), Buffer.from(c.__webhookKey))) throw new CourierError("steadfast: bad webhook token", "steadfast", 401);
    const b = body as { notification_type?: string; consignment_id?: number | string; status?: string };
    if (b.notification_type !== "delivery_status" || !b.consignment_id || !b.status) return null;
    return { consignmentId: String(b.consignment_id), status: mapSteadfast(b.status), raw: b.status };
  },
};
