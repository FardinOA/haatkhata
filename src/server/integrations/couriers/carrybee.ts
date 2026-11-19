import "server-only";
/**
 * Carrybee merchant API. Every request carries Client-ID, Client-Secret and
 * Client-Context headers; there is no token step.
 * TODO(carrybee): built from three independent open-source integrations,
 * because Carrybee shares its reference only with onboarded merchants.
 * Confirm with your account manager: the status path (/orders/{id}/details
 * here; one source uses /orders/track/{id}) and the webhook auth header
 * (the callback URL key authenticates meanwhile).
 */
import { call, requireCreds, type CourierAdapter, type CourierStatus, type Credentials } from "./types";

const BASE = process.env.CARRYBEE_BASE_URL ?? "https://developers.carrybee.com/api/v2";

function h(c: Credentials) {
  requireCreds("carrybee", c, ["clientId", "clientSecret", "clientContext", "storeId"]);
  return { "Client-ID": c.clientId, "Client-Secret": c.clientSecret, "Client-Context": c.clientContext };
}

export function mapCarrybee(s: string): CourierStatus {
  const v = s.toLowerCase().replace(/[_-]+/g, " ").trim();
  if (v.includes("partial")) return "partial";
  // "paid" comes after delivery and must not reopen the parcel.
  if (v === "delivered" || v === "paid") return "delivered";
  if (v.includes("return") || v.includes("cancel") || v === "delivery failed") return "returned";
  if (v.includes("hold")) return "hold";
  if (v.includes("pending") || v.includes("created") || v.includes("pickup requested")) return "booked";
  return "in_transit";
}

export const carrybee: CourierAdapter = {
  provider: "carrybee",
  async test(c) {
    await call("carrybee", `${BASE}/stores`, { headers: h(c) });
  },
  async create(c, r) {
    // Carrybee resolves city and zone from the address when their ids are left out.
    const res = await call<{ data: { order: { consignment_id: string; delivery_fee?: number } } }>("carrybee", `${BASE}/orders`, {
      method: "POST",
      headers: h(c),
      body: JSON.stringify({
        store_id: c.storeId,
        merchant_order_id: r.invoice,
        delivery_type: 1,
        product_type: 1,
        recipient_name: r.recipientName,
        recipient_phone: r.recipientPhone,
        recipient_address: `${r.recipientAddress}, ${r.area}, ${r.district}`,
        item_weight: Math.round((r.weightKg ?? 0.5) * 1000), // grams
        item_quantity: r.itemCount,
        collectable_amount: Math.round(r.codAmount),
        product_description: r.itemDescription.slice(0, 250),
        special_instruction: r.note ?? "",
      }),
    });
    const o = res.data.order;
    return { consignmentId: o.consignment_id, trackingCode: o.consignment_id, fee: o.delivery_fee, raw: res };
  },
  async status(c, id) {
    const res = await call<{ data: { transfer_status: string } }>("carrybee", `${BASE}/orders/${encodeURIComponent(id)}/details`, { headers: h(c) });
    return { status: mapCarrybee(res.data.transfer_status), raw: res.data.transfer_status };
  },
  parseWebhook(body) {
    const b = body as { consignment_id?: string; event?: string; order_status?: string };
    const raw = b.order_status ?? b.event?.replace(/^order\./, "");
    if (!b.consignment_id || !raw) return null;
    return { consignmentId: b.consignment_id, status: mapCarrybee(raw), raw };
  },
};
