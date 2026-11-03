/**
 * Report calculations over an arbitrary date interval (the dashboard's
 * analytics module only knows fixed ranges; reports also need custom dates).
 */
import { available, orderProfit, orderTotals } from "@/lib/domain";
import { isSale } from "@/lib/analytics";
import { daysAgo, startOfDay } from "@/lib/format";
import type { Category, Channel, Expense, ExpenseCategory, Order, Product } from "@/lib/types";

export type RangeKey = "today" | "7d" | "30d" | "custom";

export type Interval = {
  start: Date; // inclusive
  end: Date; // exclusive
  prevStart: Date;
  prevEnd: Date;
  days: number;
};

export function makeInterval(key: RangeKey, from: string, to: string, now = new Date()): Interval {
  let start: Date;
  let end: Date;
  if (key === "custom" && from && to) {
    const a = startOfDay(new Date(from));
    const b = startOfDay(new Date(to));
    start = a <= b ? a : b;
    end = new Date((a <= b ? b : a).getTime());
    end.setDate(end.getDate() + 1);
  } else {
    const days = key === "today" ? 1 : key === "30d" ? 30 : 7;
    end = daysAgo(-1, now);
    start = daysAgo(days - 1, now);
  }
  const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000));
  const prevEnd = new Date(start);
  const prevStart = new Date(start);
  prevStart.setDate(prevStart.getDate() - days);
  return { start, end, prevStart, prevEnd, days };
}

export const within = (iso: string, a: Date, b: Date) => {
  const d = new Date(iso);
  return d >= a && d < b;
};

/** Sales value excludes delivery charge (that's pass-through for the courier). */
export const saleValue = (o: Order) => orderTotals(o).total - o.deliveryCharge;

export function salesIn(orders: Order[], a: Date, b: Date) {
  return orders.filter((o) => isSale(o) && within(o.createdAt, a, b));
}

export function totals(orders: Order[], iv: Interval) {
  const sum = (list: Order[]) => {
    const sales = list.reduce((s, o) => s + saleValue(o), 0);
    const finished = list.filter((o) => ["delivered", "returned", "partially_returned"].includes(o.status));
    const returned = list.filter((o) => o.status === "returned" || o.status === "partially_returned").length;
    return {
      sales,
      orders: list.length,
      aov: list.length ? sales / list.length : 0,
      profit: list.reduce((s, o) => s + orderProfit(o), 0),
      units: list.reduce((s, o) => s + orderTotals(o).units, 0),
      returnRate: finished.length ? returned / finished.length : 0,
    };
  };
  const cur = sum(salesIn(orders, iv.start, iv.end));
  const prev = sum(salesIn(orders, iv.prevStart, iv.prevEnd));
  const d = (a: number, b: number) => (b ? (a - b) / Math.abs(b) : null);
  return {
    cur,
    prev,
    delta: { sales: d(cur.sales, prev.sales), orders: d(cur.orders, prev.orders), aov: d(cur.aov, prev.aov), profit: d(cur.profit, prev.profit), returnRate: prev.returnRate ? cur.returnRate - prev.returnRate : null },
  };
}

/** Hourly series for a single day, daily otherwise; with the previous period aligned. */
export function series(orders: Order[], iv: Interval, now = new Date()) {
  const sales = orders.filter(isSale);
  if (iv.days === 1) {
    const out: { date: Date; value: number; compare: number }[] = [];
    const lastHour = iv.end > now ? now.getHours() : 23;
    for (let h = 8; h <= Math.max(8, lastHour); h++) {
      const upTo = (base: Date) => {
        const b = new Date(base);
        b.setHours(h + 1, 0, 0, 0);
        return sales.filter((o) => within(o.createdAt, base, b)).reduce((s, o) => s + saleValue(o), 0);
      };
      out.push({ date: new Date(iv.start.getTime() + h * 3_600_000), value: upTo(iv.start), compare: upTo(iv.prevStart) });
    }
    return { hourly: true, points: out };
  }
  const points = Array.from({ length: iv.days }, (_, i) => {
    const a = new Date(iv.start);
    a.setDate(a.getDate() + i);
    const b = new Date(a);
    b.setDate(b.getDate() + 1);
    const pa = new Date(iv.prevStart);
    pa.setDate(pa.getDate() + i);
    const pb = new Date(pa);
    pb.setDate(pb.getDate() + 1);
    const sum = (x: Date, y: Date) => sales.filter((o) => within(o.createdAt, x, y)).reduce((s, o) => s + saleValue(o), 0);
    return { date: a, value: sum(a, b), compare: sum(pa, pb) };
  });
  return { hourly: false, points };
}

export type Row = { key: string; label: string; sales: number; orders: number; units: number; extra?: string };

function group(list: Order[], keyOf: (o: Order) => { key: string; label: string } | null): Row[] {
  const map = new Map<string, Row>();
  for (const o of list) {
    const k = keyOf(o);
    if (!k) continue;
    const r = map.get(k.key) ?? { key: k.key, label: k.label, sales: 0, orders: 0, units: 0 };
    r.sales += saleValue(o);
    r.orders++;
    r.units += orderTotals(o).units;
    map.set(k.key, r);
  }
  return [...map.values()].sort((a, b) => b.sales - a.sales);
}

export function byChannel(list: Order[]) {
  return group(list, (o) => ({ key: o.channel, label: o.channel })) as (Row & { key: Channel })[];
}

export function byStaff(list: Order[]) {
  return group(list, (o) => ({ key: o.createdBy, label: o.createdBy }));
}

export function byDistrict(list: Order[], walkIn: string) {
  return group(list, (o) => {
    const d = o.customer?.address?.district || (o.channel === "walkin" ? walkIn : "");
    return d ? { key: d, label: d } : null;
  });
}

/** Line-level revenue by product (returns deducted). */
export function byProduct(list: Order[], products: Product[], lang: "en" | "bn") {
  const map = new Map<string, Row>();
  for (const o of list)
    for (const l of o.lines) {
      const p = products.find((x) => x.id === l.productId);
      const label = p ? (lang === "bn" ? (p.nameBn ?? p.name) : p.name) : l.name;
      const r = map.get(l.productId) ?? { key: l.productId, label, sales: 0, orders: 0, units: 0 };
      const kept = l.qty - l.returnedQty;
      r.sales += kept * l.price - (l.qty ? (l.discount * kept) / l.qty : 0);
      r.units += kept;
      r.orders++;
      map.set(l.productId, r);
    }
  return [...map.values()].sort((a, b) => b.sales - a.sales);
}

export function byCategory(list: Order[], products: Product[], categories: Category[], lang: "en" | "bn") {
  const rows = byProduct(list, products, lang);
  const map = new Map<string, Row>();
  for (const r of rows) {
    const p = products.find((x) => x.id === r.key);
    const c = categories.find((x) => x.id === p?.categoryId);
    const key = c?.id ?? "none";
    const label = c ? (lang === "bn" ? c.nameBn : c.name) : lang === "bn" ? "অন্যান্য" : "Uncategorised";
    const g = map.get(key) ?? { key, label, sales: 0, orders: 0, units: 0 };
    g.sales += r.sales;
    g.orders += r.orders;
    g.units += r.units;
    map.set(key, g);
  }
  return [...map.values()].sort((a, b) => b.sales - a.sales);
}

/* ------------------------------------------------------------ profit */

export type ProfitStep = { key: string; en: string; bn: string; value: number; kind: "total" | "delta" };

export function profitSteps(orders: Order[], expenses: Expense[], iv: Interval): ProfitStep[] {
  const list = salesIn(orders, iv.start, iv.end);
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
  const exp = expenses.filter((e) => within(e.date, iv.start, iv.end));
  const sumCat = (pred: (c: ExpenseCategory) => boolean) => exp.filter((e) => pred(e.category)).reduce((s, e) => s + e.amount, 0);
  const returnFees = sumCat((c) => c === "return_fee");
  const ads = sumCat((c) => c === "ads");
  const other = sumCat((c) => c !== "return_fee" && c !== "ads");
  const deliveryNet = deliveryCollected - courier;
  const net = revenue - returnsValue - discounts - cogs + deliveryNet - returnFees - ads - other;
  return [
    { key: "revenue", en: "Product sales", bn: "পণ্য বিক্রি", value: revenue, kind: "total" },
    { key: "returns", en: "Returned goods", bn: "ফেরত পণ্য", value: -returnsValue, kind: "delta" },
    { key: "discounts", en: "Discounts", bn: "ছাড়", value: -discounts, kind: "delta" },
    { key: "cogs", en: "Cost of goods", bn: "পণ্যের খরচ", value: -cogs, kind: "delta" },
    { key: "delivery", en: "Delivery margin", bn: "ডেলিভারি থেকে লাভ", value: deliveryNet, kind: "delta" },
    { key: "returnFees", en: "Return fees", bn: "ফেরত চার্জ", value: -returnFees, kind: "delta" },
    { key: "ads", en: "Ads", bn: "বিজ্ঞাপন", value: -ads, kind: "delta" },
    { key: "other", en: "Rent, salary & other", bn: "ভাড়া, বেতন ও অন্যান্য", value: -other, kind: "delta" },
    { key: "net", en: "Net profit", bn: "নিট লাভ", value: net, kind: "total" },
  ];
}

/* ------------------------------------------------------------ stock */

export type StockRow = {
  key: string;
  product: Product;
  label: string;
  onHand: number;
  reserved: number;
  available: number;
  inTransit: number;
  costValue: number;
  saleValue: number;
  lastSold: string | null;
  daysSinceSale: number | null;
};

export function stockRows(products: Product[], orders: Order[], lang: "en" | "bn", now = new Date()): StockRow[] {
  const last = new Map<string, string>();
  for (const o of orders) {
    if (!isSale(o)) continue;
    for (const l of o.lines) {
      const cur = last.get(l.productId);
      if (!cur || o.createdAt > cur) last.set(l.productId, o.createdAt);
    }
  }
  return products
    .map((p) => {
      const onHand = p.variants.reduce((s, v) => s + Math.max(0, v.onHand), 0);
      const reserved = p.variants.reduce((s, v) => s + v.reserved, 0);
      const lastSold = last.get(p.id) ?? null;
      return {
        key: p.id,
        product: p,
        label: lang === "bn" ? (p.nameBn ?? p.name) : p.name,
        onHand,
        reserved,
        available: p.variants.reduce((s, v) => s + Math.max(0, available(v)), 0),
        inTransit: p.variants.reduce((s, v) => s + v.inTransit, 0),
        costValue: p.variants.reduce((s, v) => s + Math.max(0, v.onHand) * v.cost, 0),
        saleValue: p.variants.reduce((s, v) => s + Math.max(0, v.onHand) * v.price, 0),
        lastSold,
        daysSinceSale: lastSold ? Math.floor((now.getTime() - new Date(lastSold).getTime()) / 86_400_000) : null,
      };
    })
    .sort((a, b) => b.costValue - a.costValue);
}

/* ------------------------------------------------------------ returns */

export type ReturnRow = { key: string; label: string; finished: number; returned: number; rate: number };

export function returnRows(list: Order[], keyOf: (o: Order) => { key: string; label: string }[] | null): ReturnRow[] {
  const map = new Map<string, ReturnRow>();
  for (const o of list) {
    if (!["delivered", "returned", "partially_returned"].includes(o.status)) continue;
    const ret = o.status === "returned" || o.status === "partially_returned";
    for (const k of keyOf(o) ?? []) {
      const r = map.get(k.key) ?? { key: k.key, label: k.label, finished: 0, returned: 0, rate: 0 };
      r.finished++;
      if (ret) r.returned++;
      map.set(k.key, r);
    }
  }
  return [...map.values()].map((r) => ({ ...r, rate: r.finished ? r.returned / r.finished : 0 })).sort((a, b) => b.rate - a.rate || b.returned - a.returned);
}

/* ------------------------------------------------------------ staff */

export type StaffRow = { name: string; created: number; confirmed: number; sales: number; returned: number; finished: number; returnRate: number };

export function staffRows(orders: Order[], iv: Interval, staffNames: string[]): StaffRow[] {
  return staffNames
    .map((name) => {
      const created = orders.filter((o) => o.createdBy === name && within(o.createdAt, iv.start, iv.end));
      const sales = created.filter(isSale);
      const confirmed = orders.filter((o) => o.events.some((e) => e.type === "status" && e.to === "confirmed" && e.by === name && within(e.at, iv.start, iv.end))).length;
      const finished = sales.filter((o) => ["delivered", "returned", "partially_returned"].includes(o.status));
      const returned = finished.filter((o) => o.status !== "delivered").length;
      return {
        name,
        created: created.length,
        confirmed,
        sales: sales.reduce((s, o) => s + saleValue(o), 0),
        returned,
        finished: finished.length,
        returnRate: finished.length ? returned / finished.length : 0,
      };
    })
    .sort((a, b) => b.sales - a.sales);
}
