import "server-only";
/**
 * Paperfly merchant API. Basic auth + `paperflykey` header.
 * TODO(paperfly): endpoint paths and field names below follow Paperfly's
 * merchant API v1 documentation shared with merchants on request — confirm
 * against the copy Paperfly sends with your credentials before going live.
 */
import { call, requireCreds, type CourierAdapter, type CourierStatus, type Credentials } from "./types";

const BASE = process.env.PAPERFLY_BASE_URL ?? "https://api.paperfly.com.bd";
const h = (c: Credentials) => ({ authorization: `Basic ${Buffer.from(`${c.username}:${c.password}`).toString("base64")}`, paperflykey: c.apiKey });

export function mapPaperfly(s: string): CourierStatus {
  const v = s.toLowerCase();
  if (v.includes("partial")) return "partial";
  if (v.includes("deliver") && !v.includes("undeliver")) return "delivered";
  if (v.includes("return") || v.includes("cancel") || v.includes("undeliver")) return "returned";
  if (v.includes("hold")) return "hold";
  if (v.includes("pick") && v.includes("pending")) return "booked";
  return "in_transit";
}

export const paperfly: CourierAdapter = {
  provider: "paperfly",
  async test(c) {
    requireCreds("paperfly", c, ["username", "password", "apiKey"]);
    await call("paperfly", `${BASE}/merchant/api/service/area_list`, { headers: h(c) });
  },
  async create(c, r) {
    requireCreds("paperfly", c, ["username", "password", "apiKey"]);
    const res = await call<{ success?: { tracking_number?: string; message?: string } }>("paperfly", `${BASE}/OrderPlacement`, {
      method: "POST",
      headers: h(c),
      body: JSON.stringify({
        merOrderRef: r.invoice,
        pickMerchantName: "",
        custname: r.recipientName,
        custaddress: r.recipientAddress,
        customerThana: r.area,
        customerDistrict: r.district,
        custPhone: r.recipientPhone,
        max_weight: String(r.weightKg ?? 0.5),
        packagePrice: String(Math.round(r.codAmount)),
        deliveryOption: "regular",
        productBrief: r.itemDescription.slice(0, 120),
      }),
    });
    const tn = res.success?.tracking_number ?? "";
    return { consignmentId: tn, trackingCode: tn, raw: res };
  },
  async status(c, id) {
    const res = await call<{ success?: { trackingStatus?: { status?: string }[] } }>("paperfly", `${BASE}/API-Order-Tracking`, { method: "POST", headers: h(c), body: JSON.stringify({ ReferenceNumber: id }) });
    const raw = res.success?.trackingStatus?.at(-1)?.status ?? "in transit";
    return { status: mapPaperfly(raw), raw };
  },
  parseWebhook(body) {
    const b = body as { tracking_number?: string; status?: string };
    if (!b.tracking_number || !b.status) return null;
    return { consignmentId: b.tracking_number, status: mapPaperfly(b.status), raw: b.status };
  },
};
