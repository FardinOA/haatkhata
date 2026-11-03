import { orderTotals } from "@/lib/domain";
import type { Order, Purchase } from "@/lib/types";

const DAY = 86_400_000;

export const OVERDUE_DAYS = 5;

export function deliveredAt(o: Order) {
  return [...o.events].reverse().find((e) => e.type === "status" && e.to === "delivered")?.at ?? o.createdAt;
}

export type CodOrder = { order: Order; amount: number; deliveredAt: string; days: number };

/** Delivered COD orders whose cash the courier still holds (FR-PAY-02). */
export function codOrders(orders: Order[], now = new Date()): CodOrder[] {
  return orders
    .filter((o) => o.status === "delivered" && o.settlement === "cod" && !o.codReceived)
    .map((o) => {
      const at = deliveredAt(o);
      return { order: o, amount: orderTotals(o).cod, deliveredAt: at, days: Math.floor((now.getTime() - new Date(at).getTime()) / DAY) };
    })
    .filter((x) => x.amount > 0)
    .sort((a, b) => b.days - a.days);
}

export type CodGroup = { courier: string; items: CodOrder[]; amount: number; oldest: number; overdue: number };

export function groupByCourier(items: CodOrder[]): CodGroup[] {
  const map = new Map<string, CodGroup>();
  for (const it of items) {
    const key = it.order.courier?.name ?? "Unassigned";
    const g = map.get(key) ?? { courier: key, items: [], amount: 0, oldest: 0, overdue: 0 };
    g.items.push(it);
    g.amount += it.amount;
    g.oldest = Math.max(g.oldest, it.days);
    if (it.days > OVERDUE_DAYS) g.overdue++;
    map.set(key, g);
  }
  return [...map.values()].sort((a, b) => b.amount - a.amount);
}

export type Payout = { key: string; ref?: string; courier: string; at: string; count: number; amount: number };

/** COD payouts already received, grouped by payout reference. */
export function payouts(orders: Order[]): Payout[] {
  const map = new Map<string, Payout>();
  for (const o of orders) {
    if (!o.codReceived) continue;
    const owed = Math.max(0, orderTotals(o).total - o.payments.filter((x) => x.amount > 0).reduce((s, x) => s + x.amount, 0));
    if (owed <= 0) continue;
    const courier = o.courier?.name ?? "—";
    const key = o.codReceived.ref ?? `${courier}-${o.codReceived.at.slice(0, 10)}`;
    const p = map.get(key) ?? { key, ref: o.codReceived.ref, courier, at: o.codReceived.at, count: 0, amount: 0 };
    p.count++;
    // The order's COD amount is whatever wasn't prepaid.
    p.amount += owed;
    if (o.codReceived.at > p.at) p.at = o.codReceived.at;
    map.set(key, p);
  }
  return [...map.values()].sort((a, b) => b.at.localeCompare(a.at));
}

/** Money that actually reached the shop in the last 7 days. */
export function collectedThisWeek(orders: Order[], now = new Date()) {
  const from = new Date(now);
  from.setHours(0, 0, 0, 0);
  from.setDate(from.getDate() - 6);
  let direct = 0;
  let mfs = 0;
  let cod = 0;
  for (const o of orders) {
    for (const p of o.payments) {
      if (p.amount <= 0 || new Date(p.at) < from) continue;
      if (p.method === "bkash" || p.method === "nagad" || p.method === "rocket") mfs += p.amount;
      else direct += p.amount;
    }
    if (o.codReceived && new Date(o.codReceived.at) >= from) {
      cod += Math.max(0, orderTotals(o).total - o.payments.filter((x) => x.amount > 0).reduce((s, x) => s + x.amount, 0));
    }
  }
  return { total: direct + mfs + cod, direct, mfs, cod };
}

export function supplierActivity(purchases: Purchase[], supplierId: string) {
  const list = purchases.filter((p) => p.supplierId === supplierId);
  return {
    count: list.length,
    total: list.reduce((s, p) => s + p.total, 0),
    last: list.reduce<string | null>((m, p) => (!m || p.date > m ? p.date : m), null),
    list,
  };
}

export const daysBetween = (iso: string, now = new Date()) => Math.floor((now.getTime() - new Date(iso).getTime()) / DAY);

/** English plural; Bangla doesn't inflect. */
export const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);
