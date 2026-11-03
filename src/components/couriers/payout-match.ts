/**
 * COD payout statement import (FR-PAY-06). Parses a courier's CSV, works
 * out which column is which, and matches each row to an order by
 * consignment id → tracking code → invoice/order number → phone + amount.
 * Pure, so it runs on the device (offline) and is unit tested.
 */
import { normalizePhone, orderTotals } from "@/lib/domain";
import type { Order } from "@/lib/types";

export type Field = "consignment" | "tracking" | "invoice" | "phone" | "collected" | "fee" | "payout";

export const FIELDS: { key: Field; en: string; bn: string; required?: boolean }[] = [
  { key: "consignment", en: "Consignment ID", bn: "কনসাইনমেন্ট আইডি" },
  { key: "tracking", en: "Tracking code", bn: "ট্র্যাকিং কোড" },
  { key: "invoice", en: "Invoice / order no.", bn: "ইনভয়েস / অর্ডার নং" },
  { key: "phone", en: "Customer phone", bn: "কাস্টমারের ফোন" },
  { key: "collected", en: "Cash collected", bn: "আদায় হওয়া টাকা", required: true },
  { key: "fee", en: "Delivery charge", bn: "ডেলিভারি চার্জ" },
  { key: "payout", en: "Paid to you", bn: "আপনাকে পরিশোধ" },
];

const ALIASES: Record<Field, string[]> = {
  consignment: ["consignment id", "consignment_id", "consignment", "cid", "parcel id"],
  tracking: ["tracking code", "tracking_code", "tracking id", "tracking_id", "tracking number", "tracking no"],
  invoice: ["invoice", "invoice id", "invoice no", "merchant invoice id", "merchant_invoice_id", "merchant order id", "merchant_order_id", "order id", "reference", "order no"],
  phone: ["recipient phone", "recipient_phone", "customer phone", "customer_phone", "phone", "mobile", "receiver phone"],
  collected: ["cod amount", "cod_amount", "collected amount", "cash collected", "cash collection", "cash collection amount", "collected", "amount to collect", "amount_to_collect", "cod"],
  fee: ["delivery charge", "delivery fee", "delivery_charge", "charge", "shipping charge", "total charge"],
  payout: ["payable amount", "payable", "payout", "payout amount", "net amount", "paid amount", "net payable"],
};

export type Layout = "steadfast" | "pathao" | "redx" | "generic";

/** RFC-4180-ish CSV: quotes, escaped quotes, CRLF, BOM, comma or semicolon. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const firstLine = src.split(/\r?\n/, 1)[0] ?? "";
  const delim = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let q = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (q) {
      if (c === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === delim) {
      row.push(cell.trim());
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(cell.trim());
      if (row.some((x) => x !== "")) rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  row.push(cell.trim());
  if (row.some((x) => x !== "")) rows.push(row);
  return rows;
}

const norm = (s: string) => s.toLowerCase().replace(/[_\-.]/g, " ").replace(/\s+/g, " ").trim();

export function detect(headers: string[]): { layout: Layout; mapping: Partial<Record<Field, number>> } {
  const h = headers.map(norm);
  const mapping: Partial<Record<Field, number>> = {};
  for (const f of Object.keys(ALIASES) as Field[]) {
    const i = h.findIndex((x) => ALIASES[f].map(norm).includes(x));
    if (i >= 0) mapping[f] = i;
  }
  const has = (s: string) => h.includes(norm(s));
  const layout: Layout = has("merchant order id") ? "pathao" : has("consignment id") && has("invoice") ? "steadfast" : has("tracking id") && (has("cash collection") || has("cash collection amount")) ? "redx" : "generic";
  return { layout, mapping };
}

export const money = (s: string | undefined) => {
  if (!s) return 0;
  const n = Number(s.replace(/[০-৯]/g, (d) => String("০১২৩৪৫৬৭৮৯".indexOf(d))).replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

export type MatchKind = "matched" | "short" | "already" | "not_delivered" | "unmatched";

export type MatchRow = {
  index: number;
  raw: string[];
  collected: number;
  fee: number;
  payout: number | null;
  order: Order | null;
  expected: number;
  kind: MatchKind;
  via: "consignment" | "tracking" | "invoice" | "phone" | null;
};

export function matchRows(rows: string[][], mapping: Partial<Record<Field, number>>, orders: Order[]): MatchRow[] {
  const get = (r: string[], f: Field) => (mapping[f] === undefined ? "" : (r[mapping[f]!] ?? "").trim());
  const byCid = new Map<string, Order>();
  const byTracking = new Map<string, Order>();
  const byInvoice = new Map<string, Order>();
  for (const o of orders) {
    if (o.courier?.consignmentId) byCid.set(o.courier.consignmentId.toLowerCase(), o);
    if (o.courier?.tracking) byTracking.set(o.courier.tracking.toLowerCase(), o);
    if (o.invoiceNo) byInvoice.set(o.invoiceNo.toLowerCase(), o);
    byInvoice.set(`#${o.no}`, o);
    byInvoice.set(String(o.no), o);
    byInvoice.set(`ord-${o.no}`, o);
  }
  const used = new Set<string>();
  return rows.map((r, index) => {
    const collected = money(get(r, "collected"));
    const fee = money(get(r, "fee"));
    const payoutRaw = get(r, "payout");
    let order: Order | null = null;
    let via: MatchRow["via"] = null;
    const tryKey = (map: Map<string, Order>, key: string, how: MatchRow["via"]) => {
      if (order || !key) return;
      const hit = map.get(key.toLowerCase());
      if (hit && !used.has(hit.id)) {
        order = hit;
        via = how;
      }
    };
    tryKey(byCid, get(r, "consignment"), "consignment");
    tryKey(byTracking, get(r, "tracking"), "tracking");
    tryKey(byInvoice, get(r, "invoice").replace(/^#/, "#"), "invoice");
    if (!order) {
      const phone = normalizePhone(get(r, "phone"));
      if (phone) {
        // Same phone and the amount the courier should have collected (± ৳1).
        const hit = orders.find((o) => !used.has(o.id) && o.customer?.phone === phone && Math.abs(orderTotals(o).cod - collected) <= 1 && (o.status === "delivered" || o.status === "partially_returned") && !o.codReceived);
        if (hit) {
          order = hit;
          via = "phone";
        }
      }
    }
    const o = order as Order | null;
    if (o) used.add(o.id);
    const expected = o ? orderTotals(o).cod : 0;
    const kind: MatchKind = !o ? "unmatched" : o.codReceived ? "already" : o.status !== "delivered" && o.status !== "partially_returned" ? "not_delivered" : collected + 1 < expected ? "short" : "matched";
    return { index, raw: r, collected, fee, payout: payoutRaw ? money(payoutRaw) : null, order: o, expected, kind, via };
  });
}

export function summarize(rows: MatchRow[]) {
  const by = (k: MatchKind) => rows.filter((r) => r.kind === k);
  return {
    rows: rows.length,
    matched: by("matched").length,
    short: by("short").length,
    already: by("already").length,
    notDelivered: by("not_delivered").length,
    unmatched: by("unmatched").length,
    collected: rows.reduce((s, r) => s + r.collected, 0),
    fees: rows.reduce((s, r) => s + r.fee, 0),
    shortBy: by("short").reduce((s, r) => s + (r.expected - r.collected), 0),
  };
}
