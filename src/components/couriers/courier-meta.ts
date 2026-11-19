/**
 * Courier facts shared by the device and the server: provider metadata, the
 * normalised status vocabulary, the deterministic sandbox courier and the
 * "best courier for this district" scoring. Pure — no network, no secrets.
 */
import { orderTotals } from "@/lib/domain";
import type { CourierProvider, Order } from "@/lib/types";

export type CourierStatus = "booked" | "in_transit" | "hold" | "delivered" | "partial" | "returned" | "cancelled";

export const OPEN_STATUSES: CourierStatus[] = ["booked", "in_transit", "hold"];

export type CredentialField = { key: string; en: string; bn: string; secret?: boolean; placeholder?: string };

export const PROVIDERS: Record<CourierProvider, { name: string; color: string; site: string; fields: CredentialField[]; note: string; noteBn: string }> = {
  steadfast: {
    name: "Steadfast",
    color: "#0F7B5F",
    site: "steadfast.com.bd",
    fields: [
      { key: "apiKey", en: "API key", bn: "API কী" },
      { key: "secretKey", en: "Secret key", bn: "সিক্রেট কী", secret: true },
    ],
    note: "Find both keys in the Steadfast merchant panel under API.",
    noteBn: "স্টেডফাস্ট মার্চেন্ট প্যানেলের API অংশে দুটি কী পাবেন।",
  },
  pathao: {
    name: "Pathao",
    color: "#E2232A",
    site: "merchant.pathao.com",
    fields: [
      { key: "clientId", en: "Client ID", bn: "ক্লায়েন্ট আইডি" },
      { key: "clientSecret", en: "Client secret", bn: "ক্লায়েন্ট সিক্রেট", secret: true },
      { key: "username", en: "Merchant email", bn: "মার্চেন্ট ইমেইল" },
      { key: "password", en: "Merchant password", bn: "মার্চেন্ট পাসওয়ার্ড", secret: true },
      { key: "storeId", en: "Store ID", bn: "স্টোর আইডি" },
    ],
    note: "Ask Pathao for API access, then copy the client credentials and your store ID.",
    noteBn: "পাঠাও থেকে API অ্যাক্সেস নিন, তারপর ক্লায়েন্ট তথ্য ও স্টোর আইডি দিন।",
  },
  redx: {
    name: "RedX",
    color: "#D7262C",
    site: "redx.com.bd",
    fields: [{ key: "accessToken", en: "API access token", bn: "API অ্যাক্সেস টোকেন", secret: true }],
    note: "Generate a token from the RedX merchant panel → Developer API.",
    noteBn: "রেডএক্স মার্চেন্ট প্যানেল → Developer API থেকে টোকেন নিন।",
  },
  paperfly: {
    name: "Paperfly",
    color: "#1C64B1",
    site: "paperfly.com.bd",
    fields: [
      { key: "username", en: "Username", bn: "ইউজারনেম" },
      { key: "password", en: "Password", bn: "পাসওয়ার্ড", secret: true },
      { key: "apiKey", en: "Paperfly key", bn: "পেপারফ্লাই কী", secret: true },
      { key: "storeName", en: "Store name (as registered with Paperfly)", bn: "স্টোরের নাম (পেপারফ্লাইতে যেমন)" },
    ],
    note: "Paperfly shares API credentials with registered merchants on request.",
    noteBn: "অনুরোধ করলে পেপারফ্লাই নিবন্ধিত মার্চেন্টকে API তথ্য দেয়।",
  },
  carrybee: {
    name: "Carrybee",
    color: "#F2A900",
    site: "carrybee.com",
    fields: [
      { key: "clientId", en: "Client ID", bn: "ক্লায়েন্ট আইডি" },
      { key: "clientSecret", en: "Client secret", bn: "ক্লায়েন্ট সিক্রেট", secret: true },
      { key: "clientContext", en: "Client context", bn: "ক্লায়েন্ট কনটেক্সট", secret: true },
      { key: "storeId", en: "Store ID", bn: "স্টোর আইডি" },
    ],
    note: "Request API access from your Carrybee account manager.",
    noteBn: "কেরিবি অ্যাকাউন্ট ম্যানেজারের কাছে API অ্যাক্সেস চান।",
  },
  sandbox: {
    name: "Test courier",
    color: "#7A45C2",
    site: "",
    fields: [],
    note: "Simulates booking and delivery so you can try the flow without a courier account.",
    noteBn: "কুরিয়ার অ্যাকাউন্ট ছাড়াই বুকিং ও ডেলিভারি পরীক্ষা করুন।",
  },
};

export const PROVIDER_IDS = Object.keys(PROVIDERS) as CourierProvider[];

export const STATUS_TEXT: Record<CourierStatus, [string, string]> = {
  booked: ["Booked", "বুক হয়েছে"],
  in_transit: ["On the way", "পথে আছে"],
  hold: ["On hold", "আটকে আছে"],
  delivered: ["Delivered", "ডেলিভারি হয়েছে"],
  partial: ["Partly delivered", "আংশিক ডেলিভারি"],
  returned: ["Returning", "ফেরত আসছে"],
  cancelled: ["Cancelled", "বাতিল"],
};

/** Provider name as stored on the order, back to its id. */
export function providerFromName(name?: string): CourierProvider | null {
  if (!name) return null;
  const n = name.toLowerCase();
  return (PROVIDER_IDS.find((p) => PROVIDERS[p].name.toLowerCase() === n || p === n) as CourierProvider) ?? null;
}

/* ------------------------------------------------------------ sandbox */

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return h;
}

/** Deterministic test booking. The booking time is encoded in the id, so status needs no storage. */
export function sandboxBook(orderId: string, codAmount: number, district: string, now = Date.now()) {
  const h = hash(orderId).toString(36).padStart(5, "0").slice(0, 5).toUpperCase();
  const consignmentId = `SB${now.toString(36).toUpperCase()}${h}`;
  return { consignmentId, trackingCode: `TST-${h}${(now % 1000).toString().padStart(3, "0")}`, fee: district.trim().toLowerCase() === "dhaka" ? 60 : 110, codAmount };
}

/**
 * Status of a sandbox parcel: booked for 1 minute, in transit until 3
 * minutes, then delivered — except roughly one in seven, which is returned.
 */
export function sandboxStatus(consignmentId: string, now = Date.now()): CourierStatus {
  const t = parseInt(consignmentId.slice(2, consignmentId.length - 5), 36);
  if (!Number.isFinite(t)) return "in_transit";
  const mins = (now - t) / 60_000;
  if (mins < 1) return "booked";
  if (mins < 3) return "in_transit";
  return hash(consignmentId) % 7 === 0 ? "returned" : "delivered";
}

/* ------------------------------------------------------------ smart pick */

export type CourierScore = { provider: CourierProvider; name: string; delivered: number; returned: number; successRate: number | null; avgFee: number | null; source: "yours" | "network" | "none" };

/**
 * Success rate and average fee per courier for one district, from this
 * shop's own finished parcels; network numbers (if given) fill the gaps.
 */
export function scoreCouriers(
  orders: Order[],
  district: string,
  connected: CourierProvider[],
  network: { courier: string; delivered: number; returned: number; avgFee: number | null }[] = [],
): CourierScore[] {
  const d = district.trim().toLowerCase();
  const rows = connected.map<CourierScore>((p) => {
    const name = PROVIDERS[p].name;
    const mine = orders.filter((o) => (o.courier?.provider === p || o.courier?.name?.toLowerCase() === name.toLowerCase()) && o.customer?.address?.district?.toLowerCase() === d);
    const delivered = mine.filter((o) => o.status === "delivered" || o.status === "partially_returned").length;
    const returned = mine.filter((o) => o.status === "returned").length;
    const fees = mine.map((o) => o.courier?.fee).filter((x): x is number => typeof x === "number");
    if (delivered + returned >= 3)
      return { provider: p, name, delivered, returned, successRate: delivered / (delivered + returned), avgFee: fees.length ? Math.round(fees.reduce((a, b) => a + b, 0) / fees.length) : null, source: "yours" };
    const net = network.find((n) => n.courier.toLowerCase() === name.toLowerCase());
    if (net && net.delivered + net.returned > 0) return { provider: p, name, delivered: net.delivered, returned: net.returned, successRate: net.delivered / (net.delivered + net.returned), avgFee: net.avgFee, source: "network" };
    return { provider: p, name, delivered, returned, successRate: null, avgFee: null, source: "none" };
  });
  // Best success first; among equals, the cheaper one.
  return rows.sort((a, b) => (b.successRate ?? -1) - (a.successRate ?? -1) || (a.avgFee ?? 9999) - (b.avgFee ?? 9999));
}

/** What the courier should collect for an order. */
export const codFor = (o: Order) => (o.settlement === "cod" ? orderTotals(o).cod : 0);
