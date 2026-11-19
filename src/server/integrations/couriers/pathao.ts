import "server-only";
/**
 * Pathao Courier merchant API ("Aladdin"). OAuth password grant →
 * bearer token; orders need Pathao's numeric city and zone ids, which we
 * resolve from the district/area names and cache.
 * Sandbox base: https://courier-api-sandbox.pathao.com
 */
import { call, CourierError, requireCreds, type CourierAdapter, type CourierStatus, type Credentials } from "./types";

const BASE = process.env.PATHAO_BASE_URL ?? "https://api-hermes.pathao.com";
const tokens = new Map<string, { token: string; until: number }>();
const geo = new Map<string, number>();

async function token(c: Credentials) {
  requireCreds("pathao", c, ["clientId", "clientSecret", "username", "password", "storeId"]);
  const hit = tokens.get(c.clientId);
  if (hit && hit.until > Date.now()) return hit.token;
  const res = await call<{ access_token: string; expires_in: number }>("pathao", `${BASE}/aladdin/api/v1/issue-token`, {
    method: "POST",
    body: JSON.stringify({ client_id: c.clientId, client_secret: c.clientSecret, username: c.username, password: c.password, grant_type: "password" }),
  });
  tokens.set(c.clientId, { token: res.access_token, until: Date.now() + (res.expires_in - 300) * 1000 });
  return res.access_token;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

async function cityZone(c: Credentials, district: string, area: string) {
  const auth = { authorization: `Bearer ${await token(c)}` };
  const ck = `city:${norm(district)}`;
  let cityId = geo.get(ck);
  if (!cityId) {
    const cities = await call<{ data: { data: { city_id: number; city_name: string }[] } }>("pathao", `${BASE}/aladdin/api/v1/city-list`, { headers: auth });
    for (const x of cities.data.data) geo.set(`city:${norm(x.city_name)}`, x.city_id);
    cityId = geo.get(ck);
  }
  if (!cityId) throw new CourierError(`pathao: no city matches “${district}”`, "pathao", 422);
  const zk = `zone:${cityId}:${norm(area)}`;
  let zoneId = geo.get(zk);
  if (!zoneId) {
    const zones = await call<{ data: { data: { zone_id: number; zone_name: string }[] } }>("pathao", `${BASE}/aladdin/api/v1/cities/${cityId}/zone-list`, { headers: auth });
    for (const z of zones.data.data) geo.set(`zone:${cityId}:${norm(z.zone_name)}`, z.zone_id);
    // Fall back to the first zone whose name contains the area (e.g. "Mirpur 10" → "Mirpur").
    zoneId = geo.get(zk) ?? zones.data.data.find((z) => norm(area).includes(norm(z.zone_name)) || norm(z.zone_name).includes(norm(area)))?.zone_id;
  }
  if (!zoneId) throw new CourierError(`pathao: no zone matches “${area}” in ${district}`, "pathao", 422);
  return { cityId, zoneId };
}

/** Pathao names statuses three ways ("Pickup_Requested", "pickup-requested", "Pickup Requested"); all normalise to spaces. */
export function mapPathao(s: string): CourierStatus {
  const v = s.toLowerCase().replace(/[_-]+/g, " ").trim();
  if (v.includes("partial")) return "partial";
  // Payment and exchange events arrive after delivery; they must not reopen the parcel.
  if (v === "delivered" || v === "paid" || v === "payment invoice" || v === "exchanged") return "delivered";
  if (v.includes("return") || v.includes("cancel") || v === "delivery failed") return "returned";
  if (v.includes("hold")) return "hold";
  if (v === "pending" || v === "created" || v === "pickup failed" || v.includes("pickup requested")) return "booked";
  return "in_transit";
}

export const pathao: CourierAdapter = {
  provider: "pathao",
  async test(c) {
    await token(c);
  },
  async create(c, r) {
    const { cityId, zoneId } = await cityZone(c, r.district, r.area);
    const res = await call<{ data: { consignment_id: string; order_status: string; delivery_fee: number } }>("pathao", `${BASE}/aladdin/api/v1/orders`, {
      method: "POST",
      headers: { authorization: `Bearer ${await token(c)}` },
      body: JSON.stringify({
        store_id: Number(c.storeId),
        merchant_order_id: r.invoice,
        recipient_name: r.recipientName,
        recipient_phone: r.recipientPhone,
        recipient_address: r.recipientAddress,
        recipient_city: cityId,
        recipient_zone: zoneId,
        delivery_type: 48, // normal delivery
        item_type: 2, // parcel
        item_quantity: r.itemCount,
        item_weight: r.weightKg ?? 0.5,
        amount_to_collect: Math.round(r.codAmount),
        item_description: r.itemDescription.slice(0, 250),
        special_instruction: r.note ?? "",
      }),
    });
    return { consignmentId: res.data.consignment_id, trackingCode: res.data.consignment_id, fee: res.data.delivery_fee, raw: res };
  },
  async status(c, id) {
    const res = await call<{ data: { order_status: string } }>("pathao", `${BASE}/aladdin/api/v1/orders/${encodeURIComponent(id)}/info`, { headers: { authorization: `Bearer ${await token(c)}` } });
    return { status: mapPathao(res.data.order_status), raw: res.data.order_status };
  },
  parseWebhook(body) {
    // Pathao also sends the merchant's dashboard secret as X-PATHAO-Signature
    // (a plain string, not an HMAC). The per-account key in the callback URL
    // already authenticates the sender, so we don't require it. The
    // "webhook_integration" handshake is answered in the webhook route.
    const b = body as { consignment_id?: string; event?: string; order_status?: string };
    if (b.event === "order.updated") return null;
    const raw = b.order_status ?? b.event?.replace(/^order\./, "").replace(/[_-]/g, " ");
    if (!b.consignment_id || !raw) return null;
    return { consignmentId: b.consignment_id, status: mapPathao(raw), raw };
  },
};
