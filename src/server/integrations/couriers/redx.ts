import "server-only";
/**
 * RedX Open API. Auth: `API-ACCESS-TOKEN: Bearer <token>`. Parcels need a
 * RedX delivery area id, resolved from the area/district name.
 * Sandbox base: https://sandbox.redx.com.bd/v1.0.0-beta
 */
import { call, CourierError, requireCreds, type CourierAdapter, type CourierStatus, type Credentials } from "./types";

const BASE = process.env.REDX_BASE_URL ?? "https://openapi.redx.com.bd/v1.0.0-beta";
const areas = new Map<string, { id: number; name: string }[]>();
const h = (c: Credentials) => ({ "API-ACCESS-TOKEN": `Bearer ${c.accessToken}` });
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

async function area(c: Credentials, district: string, areaName: string) {
  let list = areas.get(district);
  if (!list) {
    const res = await call<{ areas: { id: number; name: string }[] }>("redx", `${BASE}/areas?district_name=${encodeURIComponent(district)}`, { headers: h(c) });
    list = res.areas;
    areas.set(district, list);
  }
  const hit = list.find((a) => norm(a.name) === norm(areaName)) ?? list.find((a) => norm(a.name).includes(norm(areaName)) || norm(areaName).includes(norm(a.name))) ?? list[0];
  if (!hit) throw new CourierError(`redx: no delivery area found for ${areaName}, ${district}`, "redx", 422);
  return hit;
}

export function mapRedx(s: string): CourierStatus {
  const v = s.toLowerCase();
  if (v.includes("partial")) return "partial";
  // "paid" (COD settled) comes after delivery and must not reopen the parcel.
  if (v === "delivered" || v === "delivery-success" || v === "paid") return "delivered";
  if (v.includes("return") || v.includes("cancel")) return "returned";
  if (v.includes("hold")) return "hold";
  if (v.includes("pickup-pending") || v === "ready-for-delivery-pending") return "booked";
  return "in_transit";
}

export const redx: CourierAdapter = {
  provider: "redx",
  async test(c) {
    requireCreds("redx", c, ["accessToken"]);
    await call("redx", `${BASE}/areas?district_name=Dhaka`, { headers: h(c) });
  },
  async create(c, r) {
    requireCreds("redx", c, ["accessToken"]);
    const a = await area(c, r.district, r.area);
    const res = await call<{ tracking_id: string }>("redx", `${BASE}/parcel`, {
      method: "POST",
      headers: h(c),
      body: JSON.stringify({
        customer_name: r.recipientName,
        customer_phone: r.recipientPhone,
        delivery_area: a.name,
        delivery_area_id: a.id,
        customer_address: r.recipientAddress,
        merchant_invoice_id: r.invoice,
        cash_collection_amount: String(Math.round(r.codAmount)),
        parcel_weight: String(Math.round((r.weightKg ?? 0.5) * 1000)),
        instruction: r.note ?? "",
        value: String(Math.round(r.codAmount)),
      }),
    });
    return { consignmentId: res.tracking_id, trackingCode: res.tracking_id, raw: res };
  },
  async status(c, id) {
    const res = await call<{ parcel: { status: string } }>("redx", `${BASE}/parcel/info/${encodeURIComponent(id)}`, { headers: h(c) });
    return { status: mapRedx(res.parcel.status), raw: res.parcel.status };
  },
  parseWebhook(body) {
    // RedX posts { tracking_number, status, timestamp, message_en, message_bn, invoice_number }.
    // It signs nothing: its docs say to put credentials in the callback URL, as ours does.
    const b = body as { tracking_number?: string; status?: string };
    if (!b.tracking_number || !b.status) return null;
    return { consignmentId: b.tracking_number, status: mapRedx(b.status), raw: b.status };
  },
};
