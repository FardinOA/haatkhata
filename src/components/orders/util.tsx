"use client";

import { cn } from "../ui/core";
import { orderTotals } from "@/lib/domain";
import { useFmt, useT } from "@/lib/hooks";
import type { Channel, Order, OrderStatus } from "@/lib/types";

/* ------------------------------------------------------------ payment state */

export type PayState = "paid" | "cod_pending" | "cod_with_courier" | "cod_received" | "due" | "none";

/** Where the order's money stands — the question sellers actually ask. */
export function payState(o: Order): PayState {
  if (o.status === "cancelled" || o.status === "draft") return "none";
  const t = orderTotals(o);
  if (o.settlement === "cod" && t.cod > 0) {
    if (o.codReceived) return "cod_received";
    if (o.status === "returned") return "none";
    if (o.status === "delivered" || o.status === "partially_returned") return "cod_with_courier";
    return "cod_pending";
  }
  if (t.due > 0) return "due";
  return "paid";
}

export function PayChip({ order, className }: { order: Order; className?: string }) {
  const t = useT();
  const f = useFmt();
  const s = payState(order);
  const amt = orderTotals(order).remaining;
  const cfg: Record<PayState, { label: string; cls: string } | null> = {
    paid: { label: t("Paid", "পরিশোধিত"), cls: "bg-ok-soft text-ok" },
    cod_pending: { label: `COD ${f.money(amt)}`, cls: "bg-cash-soft text-cash-ink" },
    cod_with_courier: { label: t(`${f.money(amt)} with courier`, `${f.money(amt)} কুরিয়ারের কাছে`), cls: "bg-cash text-[#2b1a00]" },
    cod_received: { label: t("COD received", "COD পাওয়া গেছে"), cls: "bg-ok-soft text-ok" },
    due: { label: t(`Due ${f.money(amt)}`, `বাকি ${f.money(amt)}`), cls: "bg-cash-soft text-cash-ink" },
    none: null,
  };
  const c = cfg[s];
  if (!c) return <span className="text-xs text-ink-4">—</span>;
  return <span className={cn("tnum inline-flex h-[22px] items-center whitespace-nowrap rounded-full px-2 text-xs font-medium", c.cls, className)}>{c.label}</span>;
}

/* ------------------------------------------------------------ filters */

export type DateRange = "today" | "7d" | "30d" | "all";
export type PayFilter = "all" | "cod_pending" | "due" | "paid";

export interface OrderFilters {
  q: string;
  status: OrderStatus | "all" | "open";
  channel: Channel | "all";
  range: DateRange;
  pay: PayFilter;
  staff: string; // name or "all"
}

export const DEFAULT_FILTERS: OrderFilters = { q: "", status: "all", channel: "all", range: "30d", pay: "all", staff: "all" };

export function rangeStart(range: DateRange, now = new Date()) {
  if (range === "all") return null;
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  if (range === "7d") d.setDate(d.getDate() - 6);
  if (range === "30d") d.setDate(d.getDate() - 29);
  return d;
}

/** Everything except status — the journey strip counts from this. */
export function filterBase(orders: Order[], f: OrderFilters, now = new Date()) {
  const start = rangeStart(f.range, now);
  const q = f.q.trim().toLowerCase().replace(/^#/, "");
  const digits = q.replace(/\D/g, "");
  return orders.filter((o) => {
    if (start && new Date(o.createdAt) < start) return false;
    if (f.channel !== "all" && o.channel !== f.channel) return false;
    if (f.staff !== "all" && o.createdBy !== f.staff) return false;
    if (f.pay !== "all") {
      const s = payState(o);
      if (f.pay === "cod_pending" && s !== "cod_pending" && s !== "cod_with_courier") return false;
      if (f.pay === "due" && s !== "due") return false;
      if (f.pay === "paid" && s !== "paid" && s !== "cod_received") return false;
    }
    if (q) {
      const hay = `${o.no} ${o.invoiceNo ?? ""} ${o.customer?.name ?? ""} ${o.customer?.address?.area ?? ""}`.toLowerCase();
      const phoneHit = digits.length >= 3 && (o.customer?.phone ?? "").includes(digits);
      if (!hay.includes(q) && !phoneHit) return false;
    }
    return true;
  });
}

export function matchStatus(o: Order, s: OrderFilters["status"]) {
  if (s === "all") return true;
  if (s === "open") return o.status === "confirmed" || o.status === "packed";
  if (s === "returned") return o.status === "returned" || o.status === "partially_returned";
  return o.status === s;
}

/* ------------------------------------------------------------ csv */

export function toCsv(rows: (string | number | undefined | null)[][]) {
  return rows
    .map((r) =>
      r
        .map((c) => {
          const s = c === undefined || c === null ? "" : String(c);
          return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(","),
    )
    .join("\n");
}

export function downloadText(filename: string, text: string, type = "text/csv;charset=utf-8") {
  // BOM so Excel opens Bangla text correctly.
  const blob = new Blob(["﻿" + text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ordersCsv(orders: Order[]) {
  const head = ["Order", "Invoice", "Date", "Status", "Channel", "Customer", "Phone", "District", "Items", "Subtotal", "Discount", "Delivery", "Total", "Paid", "COD", "Due", "Courier", "Tracking", "Created by"];
  const rows = orders.map((o) => {
    const t = orderTotals(o);
    return [
      o.no,
      o.invoiceNo,
      new Date(o.createdAt).toISOString().slice(0, 16).replace("T", " "),
      o.status,
      o.channel,
      o.customer?.name ?? "Walk-in",
      o.customer?.phone,
      o.customer?.address?.district,
      o.lines.map((l) => `${l.name}${l.variantLabel ? ` (${l.variantLabel})` : ""} x${l.qty}`).join("; "),
      t.subtotal,
      t.discount,
      o.deliveryCharge,
      t.total,
      t.paid,
      t.cod,
      t.due,
      o.courier?.name,
      o.courier?.tracking,
      o.createdBy,
    ];
  });
  return toCsv([head, ...rows]);
}

export const stamp = () => new Date().toISOString().slice(0, 10);
