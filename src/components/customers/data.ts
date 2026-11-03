import { customerStats, riskLevel, type RiskLevel } from "@/lib/domain";
import type { Customer, Order } from "@/lib/types";

export type CustomerRow = {
  c: Customer;
  stats: ReturnType<typeof customerStats>;
  risk: RiskLevel;
  isRegular: boolean;
  isNew: boolean;
};

/** One pass over orders instead of one per customer. */
export function buildRows(customers: Customer[], orders: Order[], now = new Date()): CustomerRow[] {
  const byCustomer = new Map<string, Order[]>();
  for (const o of orders) {
    if (!o.customerId) continue;
    const list = byCustomer.get(o.customerId);
    if (list) list.push(o);
    else byCustomer.set(o.customerId, [o]);
  }
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  return customers.map((c) => {
    const stats = customerStats(c, byCustomer.get(c.id) ?? []);
    return {
      c,
      stats,
      risk: riskLevel(c, stats),
      isRegular: c.tags.includes("regular") || stats.orders >= 3,
      isNew: new Date(c.createdAt) >= monthStart,
    };
  });
}

export type Segment = "all" | "regular" | "risky" | "due" | "new";
export type SortKey = "spent" | "orders" | "recent" | "returns" | "name";

export function inSegment(r: CustomerRow, s: Segment) {
  if (s === "regular") return r.isRegular;
  if (s === "risky") return r.risk === "risky";
  if (s === "due") return r.stats.due > 0;
  if (s === "new") return r.isNew;
  return true;
}

export function sortRows(rows: CustomerRow[], key: SortKey) {
  const out = [...rows];
  switch (key) {
    case "spent":
      return out.sort((a, b) => b.stats.spent - a.stats.spent);
    case "orders":
      return out.sort((a, b) => b.stats.orders - a.stats.orders);
    case "recent":
      return out.sort((a, b) => (b.stats.lastOrder ?? "").localeCompare(a.stats.lastOrder ?? ""));
    case "returns":
      return out.sort((a, b) => b.stats.returnRate - a.stats.returnRate || b.stats.returned - a.stats.returned);
    case "name":
      return out.sort((a, b) => a.c.name.localeCompare(b.c.name));
  }
}
