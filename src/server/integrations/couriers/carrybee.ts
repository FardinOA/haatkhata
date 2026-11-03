import "server-only";
/**
 * Carrybee merchant API. Client-credential token, then store-scoped orders.
 * TODO(carrybee): Carrybee shares its API reference with onboarded
 * merchants; confirm paths and field names below with your account manager.
 */
import { call, requireCreds, type CourierAdapter, type CourierStatus, type Credentials } from "./types";

const BASE = process.env.CARRYBEE_BASE_URL ?? "https://developers.carrybee.com/api/v2";
const tokens = new Map<string, { token: string; until: number }>();

async function token(c: Credentials) {
  requireCreds("carrybee", c, ["clientId", "clientSecret", "storeId"]);
  const hit = tokens.get(c.clientId);
  if (hit && hit.until > Date.now()) return hit.token;
  const res = await call<{ access_token: string; expires_in?: number }>("carrybee", `${BASE}/auth/token`, { method: "POST", body: JSON.stringify({ client_id: c.clientId, client_secret: c.clientSecret }) });
  tokens.set(c.clientId, { token: res.access_token, until: Date.now() + ((res.expires_in ?? 3600) - 300) * 1000 });
  return res.access_token;
}

export function mapCarrybee(s: string): CourierStatus {
  const v = s.toLowerCase();
  if (v.includes("partial")) return "partial";
  if (v === "delivered") return "delivered";
  if (v.includes("return") || v.includes("cancel")) return "returned";
  if (v.includes("hold")) return "hold";
  if (v.includes("pending") || v.includes("created")) return "booked";
  return "in_transit";
}

export const carrybee: CourierAdapter = {
  provider: "carrybee",
  async test(c) {
    await token(c);
  },
  async create(c, r) {
    const res = await call<{ data: { consignment_id: string; delivery_fee?: number } }>("carrybee", `${BASE}/stores/${encodeURIComponent(c.storeId)}/orders`, {
      method: "POST",
      headers: { authorization: `Bearer ${await token(c)}` },
      body: JSON.stringify({ merchant_order_id: r.invoice, recipient_name: r.recipientName, recipient_phone: r.recipientPhone, recipient_address: r.recipientAddress, area: r.area, district: r.district, collectable_amount: Math.round(r.codAmount), item_quantity: r.itemCount, item_weight: r.weightKg ?? 0.5, note: r.note ?? "" }),
    });
    return { consignmentId: res.data.consignment_id, trackingCode: res.data.consignment_id, fee: res.data.delivery_fee, raw: res };
  },
  async status(c, id) {
    const res = await call<{ data: { status: string } }>("carrybee", `${BASE}/orders/${encodeURIComponent(id)}`, { headers: { authorization: `Bearer ${await token(c)}` } });
    return { status: mapCarrybee(res.data.status), raw: res.data.status };
  },
  parseWebhook(body) {
    const b = body as { consignment_id?: string; status?: string };
    if (!b.consignment_id || !b.status) return null;
    return { consignmentId: b.consignment_id, status: mapCarrybee(b.status), raw: b.status };
  },
};
