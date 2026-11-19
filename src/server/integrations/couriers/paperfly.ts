import "server-only";
/**
 * Paperfly merchant API: Basic auth plus a `paperflykey` header (one shared
 * value shown on the merchant panel's API Docs page).
 * TODO(paperfly): built from third-party integrations (a .NET SDK that says
 * it was checked against the live API, and a Dart package), because
 * Paperfly's own docs sit behind the merchant login. Before going live,
 * check against them:
 *  - the "Test connection" path (area_list appears in no source);
 *  - whether tracking accepts the tracking number, or only the merchant order reference;
 *  - which header carries Paperfly's webhook secret (the callback URL key authenticates meanwhile).
 */
import { call, requireCreds, type CourierAdapter, type CourierStatus, type Credentials } from "./types";

const BASE = process.env.PAPERFLY_BASE_URL ?? "https://api.paperfly.com.bd";
const h = (c: Credentials) => ({ authorization: `Basic ${Buffer.from(`${c.username}:${c.password}`).toString("base64")}`, paperflykey: c.apiKey });

export function mapPaperfly(s: string): CourierStatus {
  const v = s.toLowerCase().replace(/[_-]+/g, " ").trim();
  if (v.includes("partial")) return "partial";
  // "invoiced" (COD settled) and "exchange" come after delivery and must not reopen the parcel.
  if (v === "delivered" || v === "invoiced" || v === "exchange") return "delivered";
  if (v.includes("return") || v.includes("cancel") || v.includes("undeliver")) return "returned";
  if (v.includes("hold")) return "hold";
  if (v === "created" || (v.includes("pick") && v.includes("pending"))) return "booked";
  return "in_transit";
}

/** Tracking returns milestone flags ("Y" or "") rather than one status; the latest one reached wins. */
type Milestones = Partial<Record<"Pick" | "Delivered" | "Partial" | "Returned" | "onHoldSchedule", string>>;

export const paperfly: CourierAdapter = {
  provider: "paperfly",
  async test(c) {
    requireCreds("paperfly", c, ["username", "password", "apiKey", "storeName"]);
    await call("paperfly", `${BASE}/merchant/api/service/area_list`, { headers: h(c) });
  },
  async create(c, r) {
    requireCreds("paperfly", c, ["username", "password", "apiKey", "storeName"]);
    const res = await call<{ success?: { tracking_number?: string; message?: string } }>("paperfly", `${BASE}/merchant/api/service/new_order_v2.php`, {
      method: "POST",
      headers: h(c),
      body: JSON.stringify({
        merchantOrderReference: r.invoice,
        storeName: c.storeName,
        customerName: r.recipientName,
        customerAddress: `${r.recipientAddress}, ${r.area}, ${r.district}`,
        customerPhone: r.recipientPhone,
        max_weight: String(r.weightKg ?? 0.5),
        packagePrice: String(Math.round(r.codAmount)),
        productBrief: r.itemDescription.slice(0, 120),
      }),
    });
    const tn = res.success?.tracking_number ?? "";
    return { consignmentId: tn, trackingCode: tn, raw: res };
  },
  async status(c, id) {
    const res = await call<{ success?: { trackingStatus?: Milestones[] } }>("paperfly", `${BASE}/API-Order-Tracking`, { method: "POST", headers: h(c), body: JSON.stringify({ ReferenceNumber: id }) });
    const t = res.success?.trackingStatus?.[0] ?? {};
    const raw = t.Returned ? "returned" : t.Partial ? "partial" : t.Delivered ? "delivered" : t.onHoldSchedule ? "on hold" : t.Pick ? "in transit" : "pick pending";
    return { status: mapPaperfly(raw), raw };
  },
  parseWebhook(body) {
    // { event: "parcel.delivered", timestamp, data: { order_number, merchant_order_reference, ... } }
    const b = body as { event?: string; data?: { order_number?: string } };
    const id = b.data?.order_number;
    const raw = b.event?.replace(/^parcel\./, "").replace(/_/g, " ");
    if (!id || !raw) return null;
    return { consignmentId: id, status: mapPaperfly(raw), raw };
  },
};
