/**
 * Read-side calculations for the dashboard and reports. Pure functions over
 * store slices, so they can be memoised in components and unit tested.
 */
import { available, orderProfit, orderTotals } from "./domain";
import { daysAgo, sameDay, startOfDay } from "./format";
import type { Channel, Expense, Order, OrderStatus, Product } from "./types";

export type Range = "today" | "7d" | "30d";

export const RANGE_DAYS: Record<Range, number> = { today: 1, "7d": 7, "30d": 30 };

/** Orders that count as a sale (not draft, not cancelled). */
export const isSale = (o: Order) => o.status !== "draft" && o.status !== "cancelled";

export function inRange(iso: string, range: Range, now = new Date(), offsetPeriods = 0) {
  const days = RANGE_DAYS[range];
  const end = daysAgo(days * offsetPeriods - 1, now); // exclusive end (tomorrow 00:00 for current period)
  const start = daysAgo(days * (offsetPeriods + 1) - 1, now);
  const d = new Date(iso);
  return d >= start && d < end;
}

export function summarize(orders: Order[], range: Range, now = new Date(), offsetPeriods = 0) {
  const list = orders.filter((o) => isSale(o) && inRange(o.createdAt, range, now, offsetPeriods));
  let sales = 0;
  let profit = 0;
  let units = 0;
  for (const o of list) {
    const t = orderTotals(o);
    sales += t.total - o.deliveryCharge;
    profit += orderProfit(o);
    units += t.units;
  }
  return { orders: list.length, sales, profit, units, aov: list.length ? sales / list.length : 0 };
}

export function kpis(orders: Order[], range: Range, now = new Date()) {
  const cur = summarize(orders, range, now, 0);
  const prev = summarize(orders, range, now, 1);
  const delta = (a: number, b: number) => (b ? (a - b) / b : null);
  return {
    cur,
    prev,
    delta: {
      sales: delta(cur.sales, prev.sales),
      orders: delta(cur.orders, prev.orders),
      aov: delta(cur.aov, prev.aov),
      profit: delta(cur.profit, prev.profit),
    },
  };
}

/** Daily (or hourly for "today") sales series with the previous period for comparison. */
export function salesSeries(orders: Order[], range: Range, now = new Date()) {
  const sales = orders.filter(isSale);
  if (range === "today") {
    const today = startOfDay(now);
    const yest = daysAgo(1, now);
    const hours = Array.from({ length: 24 }, (_, h) => h).filter((h) => h >= 8);
    return hours.map((h) => {
      const sum = (day: Date) =>
        sales
          .filter((o) => {
            const d = new Date(o.createdAt);
            return sameDay(d, day) && d.getHours() <= h;
          })
          .reduce((s, o) => s + orderTotals(o).total - o.deliveryCharge, 0);
      return { date: new Date(today.getTime() + h * 3_600_000), value: h <= now.getHours() ? sum(today) : NaN, compare: sum(yest) };
    }).filter((p) => !Number.isNaN(p.value));
  }
  const days = RANGE_DAYS[range];
  return Array.from({ length: days }, (_, i) => {
    const day = daysAgo(days - 1 - i, now);
    const prevDay = daysAgo(days - 1 - i + days, now);
    const sum = (d: Date) => sales.filter((o) => sameDay(new Date(o.createdAt), d)).reduce((s, o) => s + orderTotals(o).total - o.deliveryCharge, 0);
    return { date: day, value: sum(day), compare: sum(prevDay) };
  });
}

export type JourneyStage = { status: OrderStatus; count: number; value: number };

/** Live pipeline: every open order, plus last 7 days of outcomes. */
export function journey(orders: Order[], now = new Date()) {
  const stages: OrderStatus[] = ["draft", "confirmed", "packed", "shipped"];
  const open = stages.map<JourneyStage>((status) => {
    const list = orders.filter((o) => o.status === status);
    return { status, count: list.length, value: list.reduce((s, o) => s + orderTotals(o).total, 0) };
  });
  const week = orders.filter((o) => inRange(o.createdAt, "7d", now));
  const delivered = week.filter((o) => o.status === "delivered" || o.status === "partially_returned");
  const returned = week.filter((o) => o.status === "returned");
  const finished = delivered.length + returned.length;
  return {
    open,
    delivered: { count: delivered.length, value: delivered.reduce((s, o) => s + orderTotals(o).total, 0) },
    returned: { count: returned.length, value: returned.reduce((s, o) => s + orderTotals(o).total, 0) },
    returnRate: finished ? returned.length / finished : 0,
  };
}

/** COD money still with couriers (delivered, not yet paid out). */
export function codByCourier(orders: Order[], now = new Date()) {
  const map = new Map<string, { courier: string; amount: number; count: number; oldest: string }>();
  for (const o of orders) {
    if (o.status !== "delivered" || o.codReceived || o.settlement !== "cod") continue;
    const amt = orderTotals(o).cod;
    if (amt <= 0) continue;
    const key = o.courier?.name ?? "Unassigned";
    const deliveredAt = [...o.events].reverse().find((e) => e.to === "delivered")?.at ?? o.createdAt;
    const cur = map.get(key) ?? { courier: key, amount: 0, count: 0, oldest: deliveredAt };
    cur.amount += amt;
    cur.count++;
    if (deliveredAt < cur.oldest) cur.oldest = deliveredAt;
    map.set(key, cur);
  }
  const rows = [...map.values()].sort((a, b) => b.amount - a.amount);
  const total = rows.reduce((s, r) => s + r.amount, 0);
  const overdue = rows.filter((r) => (now.getTime() - new Date(r.oldest).getTime()) / 86_400_000 > 5);
  return { rows, total, overdueCount: overdue.length };
}

export function topProducts(orders: Order[], products: Product[], range: Range, now = new Date(), limit = 5) {
  const map = new Map<string, { productId: string; units: number; revenue: number }>();
  for (const o of orders) {
    if (!isSale(o) || !inRange(o.createdAt, range, now)) continue;
    for (const l of o.lines) {
      const cur = map.get(l.productId) ?? { productId: l.productId, units: 0, revenue: 0 };
      cur.units += l.qty - l.returnedQty;
      cur.revenue += (l.qty - l.returnedQty) * l.price - l.discount;
      map.set(l.productId, cur);
    }
  }
  return [...map.values()]
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit)
    .map((r) => ({ ...r, product: products.find((p) => p.id === r.productId)! }))
    .filter((r) => r.product);
}

export function channelMix(orders: Order[], range: Range, now = new Date()) {
  const map = new Map<Channel, { channel: Channel; orders: number; sales: number }>();
  for (const o of orders) {
    if (!isSale(o) || !inRange(o.createdAt, range, now)) continue;
    const cur = map.get(o.channel) ?? { channel: o.channel, orders: 0, sales: 0 };
    cur.orders++;
    cur.sales += orderTotals(o).total - o.deliveryCharge;
    map.set(o.channel, cur);
  }
  return [...map.values()].sort((a, b) => b.sales - a.sales);
}

export function lowStock(products: Product[]) {
  return products
    .filter((p) => p.status === "active")
    .flatMap((p) => p.variants.filter((v) => v.active && available(v) <= v.lowStock).map((v) => ({ p, v, avail: available(v) })))
    .sort((a, b) => a.avail - b.avail);
}

/** Orders by weekday × 3-hour block over the last 4 weeks. */
export function orderHeatmap(orders: Order[], now = new Date()) {
  const blocks = [8, 11, 14, 17, 20, 23];
  const grid = Array.from({ length: 7 }, () => blocks.map(() => 0));
  const from = daysAgo(27, now);
  for (const o of orders) {
    const d = new Date(o.createdAt);
    if (d < from || o.status === "draft") continue;
    const h = d.getHours();
    let b = blocks.findIndex((x, i) => h >= x && h < (blocks[i + 1] ?? 24 + 8));
    if (h < 8) b = blocks.length - 1;
    if (b < 0) continue;
    grid[d.getDay()][b]++;
  }
  return { blocks, grid };
}

export function monthToDate(orders: Order[], now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const list = orders.filter((o) => isSale(o) && new Date(o.createdAt) >= start);
  const sales = list.reduce((s, o) => s + orderTotals(o).total - o.deliveryCharge, 0);
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dayOfMonth = now.getDate();
  const pace = (sales / Math.max(1, dayOfMonth)) * daysInMonth;
  return { sales, orders: list.length, daysInMonth, dayOfMonth, pace };
}

/** Revenue → net profit, step by step (SRS FR-RPT-03). */
export function profitBreakdown(orders: Order[], expenses: Expense[], range: Range, now = new Date()) {
  const list = orders.filter((o) => isSale(o) && inRange(o.createdAt, range, now));
  let revenue = 0;
  let discounts = 0;
  let cogs = 0;
  let returnsValue = 0;
  let courier = 0;
  let deliveryCollected = 0;
  for (const o of list) {
    const t = orderTotals(o);
    revenue += t.subtotal;
    discounts += t.discount;
    deliveryCollected += o.deliveryCharge;
    courier += o.courier?.fee ?? 0;
    for (const l of o.lines) {
      cogs += l.cost * (l.qty - l.returnedQty);
      returnsValue += l.returnedQty * (l.qty ? (l.qty * l.price - l.discount) / l.qty : 0);
    }
  }
  const exp = expenses.filter((e) => inRange(e.date, range, now));
  const returnFees = exp.filter((e) => e.category === "return_fee").reduce((s, e) => s + e.amount, 0);
  const ads = exp.filter((e) => e.category === "ads").reduce((s, e) => s + e.amount, 0);
  const other = exp.filter((e) => e.category !== "return_fee" && e.category !== "ads").reduce((s, e) => s + e.amount, 0);
  const deliveryNet = deliveryCollected - courier;
  const net = revenue - returnsValue - discounts - cogs + deliveryNet - returnFees - ads - other;
  return { revenue, returnsValue, discounts, cogs, deliveryNet, returnFees, ads, other, net };
}

export function dueCustomers(orders: Order[]) {
  const map = new Map<string, { customerId: string; name: string; phone: string; due: number; orders: number }>();
  for (const o of orders) {
    if (!isSale(o) || !o.customer) continue;
    const due = orderTotals(o).due;
    if (due <= 0) continue;
    const key = o.customerId ?? o.customer.phone;
    const cur = map.get(key) ?? { customerId: key, name: o.customer.name, phone: o.customer.phone, due: 0, orders: 0 };
    cur.due += due;
    cur.orders++;
    map.set(key, cur);
  }
  return [...map.values()].sort((a, b) => b.due - a.due);
}
