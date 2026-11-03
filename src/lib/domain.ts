import type {
  Channel,
  Customer,
  Order,
  OrderLine,
  OrderStatus,
  PayMethod,
  BuiltinRole,
  CustomRoleDef,
  CustomRoleKey,
  Permission,
  Role,
  Variant,
} from "./types";

/* ------------------------------------------------------------------ money */

export function lineTotal(l: Pick<OrderLine, "qty" | "price" | "discount">) {
  return Math.max(0, l.qty * l.price - l.discount);
}

export function orderTotals(o: Pick<Order, "lines" | "discount" | "deliveryCharge" | "otherCharges" | "payments" | "settlement">) {
  const subtotal = o.lines.reduce((s, l) => s + lineTotal(l), 0);
  const discount =
    o.discount.type === "pct" ? Math.round((subtotal * Math.min(100, o.discount.value)) / 100) : Math.min(subtotal, o.discount.value);
  const total = Math.max(0, subtotal - discount + o.deliveryCharge + o.otherCharges);
  const paid = o.payments.reduce((s, p) => s + p.amount, 0);
  const remaining = Math.max(0, total - paid);
  const cod = o.settlement === "cod" ? remaining : 0;
  const due = o.settlement === "due" ? remaining : 0;
  const cogs = o.lines.reduce((s, l) => s + l.cost * (l.qty - l.returnedQty), 0);
  const units = o.lines.reduce((s, l) => s + l.qty, 0);
  return { subtotal, discount, total, paid, remaining, cod, due, cogs, units };
}

/** Gross profit on goods actually sold (returns excluded). */
export function orderProfit(o: Order) {
  const t = orderTotals(o);
  if (o.status === "cancelled" || o.status === "draft") return 0;
  const keptRevenue = o.lines.reduce((s, l) => {
    const unitNet = l.qty ? lineTotal(l) / l.qty : 0;
    return s + unitNet * (l.qty - l.returnedQty);
  }, 0);
  const share = t.subtotal ? keptRevenue / t.subtotal : 0;
  return Math.round(keptRevenue - t.discount * share - t.cogs);
}

/* --------------------------------------------------------- order lifecycle */

export const STATUS_FLOW: OrderStatus[] = ["draft", "confirmed", "packed", "shipped", "delivered"];

export const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  draft: ["confirmed", "cancelled"],
  confirmed: ["packed", "shipped", "cancelled"],
  packed: ["shipped", "cancelled"],
  shipped: ["delivered", "returned"],
  delivered: ["returned"],
  returned: [],
  partially_returned: [],
  cancelled: [],
};

const TRANSITION_PERMISSION: Partial<Record<OrderStatus, Permission>> = {
  confirmed: "create_order",
  packed: "pack_ship",
  shipped: "pack_ship",
  delivered: "deliver_return",
  returned: "deliver_return",
  cancelled: "create_order",
};

export function canTransition(from: OrderStatus, to: OrderStatus, role: Role) {
  if (!TRANSITIONS[from].includes(to)) return false;
  const perm = TRANSITION_PERMISSION[to];
  return perm ? can(role, perm) : true;
}

export function isOpen(s: OrderStatus) {
  return s === "draft" || s === "confirmed" || s === "packed" || s === "shipped";
}

export function isEditable(s: OrderStatus) {
  return s === "draft" || s === "confirmed" || s === "packed";
}

/** Holds reserved stock. */
export function holdsReservation(s: OrderStatus) {
  return s === "confirmed" || s === "packed";
}

export type StockDelta = Pick<Variant, "onHand" | "reserved" | "inTransit" | "damaged">;

/**
 * Stock effect of moving one order line between states (SRS §3.5 table).
 * Returns per-field deltas for the line's variant.
 */
export function transitionEffect(from: OrderStatus, to: OrderStatus, qty: number): StockDelta {
  const d: StockDelta = { onHand: 0, reserved: 0, inTransit: 0, damaged: 0 };
  if (from === "draft" && to === "confirmed") d.reserved += qty;
  else if (holdsReservation(from) && to === "shipped") {
    d.reserved -= qty;
    d.onHand -= qty;
    d.inTransit += qty;
  } else if (from === "shipped" && to === "delivered") d.inTransit -= qty;
  else if (holdsReservation(from) && to === "cancelled") d.reserved -= qty;
  // draft -> cancelled and confirmed -> packed have no stock effect.
  return d;
}

/** A walk-in "complete sale" goes straight to delivered. */
export function walkInEffect(qty: number): StockDelta {
  return { onHand: -qty, reserved: 0, inTransit: 0, damaged: 0 };
}

export function available(v: Pick<Variant, "onHand" | "reserved">) {
  return v.onHand - v.reserved;
}

export function stockLevel(v: Pick<Variant, "onHand" | "reserved" | "lowStock">): "out" | "low" | "ok" {
  const a = available(v);
  if (a <= 0) return "out";
  if (a <= v.lowStock) return "low";
  return "ok";
}

/* ------------------------------------------------------------- permissions */

const ROLE_PERMS: Record<BuiltinRole, Permission[]> = {
  owner: ["view_cost", "edit_price", "edit_stock", "delete_order", "big_discount", "settings", "billing", "reports", "pack_ship", "deliver_return", "create_order"],
  manager: ["view_cost", "edit_price", "edit_stock", "delete_order", "big_discount", "settings", "reports", "pack_ship", "deliver_return", "create_order"],
  sales: ["create_order"],
  packer: ["pack_ship", "edit_stock"],
  accountant: ["view_cost", "reports"],
};

export const BUILTIN_ROLES = Object.keys(ROLE_PERMS) as BuiltinRole[];
export const isBuiltinRole = (r: string): r is BuiltinRole => r in ROLE_PERMS;
export const isCustomRole = (r: string): r is CustomRoleKey => r.startsWith("custom:");
export const builtinPermissions = (r: BuiltinRole) => [...ROLE_PERMS[r]];

/** Sales-style roles may give up to this much order discount without approval. */
export const DEFAULT_MAX_DISCOUNT_PCT = 15;

/*
 * Custom role registry (FR-AUTH-06). Definitions are registered from the
 * database on the server (per request, scoped to the session's business) and
 * from /api/roles on devices. Keys embed the business id, so a role from one
 * business can never grant anything in another. Unknown keys get no access.
 */
const customRoles = new Map<string, CustomRoleDef>();
const roleListeners = new Set<() => void>();
let rolesVersion = 0;

export function registerCustomRoles(defs: CustomRoleDef[], opts: { businessId?: string; replace?: boolean } = {}) {
  if (opts.replace && opts.businessId) for (const k of [...customRoles.keys()]) if (k.startsWith(`custom:${opts.businessId}:`)) customRoles.delete(k);
  for (const d of defs) customRoles.set(d.key, d);
  rolesVersion++;
  roleListeners.forEach((l) => l());
}
export const customRoleDef = (key: string) => customRoles.get(key);
export const customRolesFor = (businessId: string) => [...customRoles.values()].filter((d) => d.businessId === businessId);
export const subscribeCustomRoles = (fn: () => void) => {
  roleListeners.add(fn);
  return () => void roleListeners.delete(fn);
};
export const customRolesVersion = () => rolesVersion;

export function can(role: Role, perm: Permission) {
  if (isBuiltinRole(role)) return ROLE_PERMS[role].includes(perm);
  return customRoles.get(role)?.permissions.includes(perm) ?? false;
}

/** Biggest order discount (%) this role can give on its own. */
export function maxDiscountPct(role: Role) {
  if (can(role, "big_discount")) return 100;
  if (isCustomRole(role)) return customRoles.get(role)?.maxDiscountPct ?? 0;
  return DEFAULT_MAX_DISCOUNT_PCT;
}

/* ---------------------------------------------------------------- customers */

export function customerStats(c: Customer, orders: Order[]) {
  const mine = orders.filter((o) => o.customerId === c.id && o.status !== "draft" && o.status !== "cancelled");
  const delivered = mine.filter((o) => o.status === "delivered" || o.status === "partially_returned").length;
  const returned = mine.filter((o) => o.status === "returned" || o.status === "partially_returned").length;
  const finished = delivered + mine.filter((o) => o.status === "returned").length;
  const spent = mine
    .filter((o) => o.status !== "returned")
    .reduce((s, o) => s + orderTotals(o).total, 0);
  const due = mine.reduce((s, o) => s + orderTotals(o).due, 0);
  const last = mine.reduce<string | null>((m, o) => (!m || o.createdAt > m ? o.createdAt : m), null);
  return {
    orders: mine.length,
    delivered,
    returned,
    returnRate: finished ? returned / finished : 0,
    spent,
    due,
    lastOrder: last,
  };
}

export type RiskLevel = "new" | "trusted" | "watch" | "risky";

export function riskLevel(c: Customer, stats: ReturnType<typeof customerStats>): RiskLevel {
  if (c.risky) return "risky";
  if (stats.orders === 0) return "new";
  if (stats.returnRate >= 0.4 && stats.returned >= 2) return "risky";
  if (stats.returnRate >= 0.2) return "watch";
  return "trusted";
}

/* ------------------------------------------------------------------ phones */

/** Normalises any BD mobile input to 01XXXXXXXXX, or null if invalid. */
export function normalizePhone(input: string): string | null {
  const bnDigits = "০১২৩৪৫৬৭৮৯";
  const ascii = input.replace(/[০-৯]/g, (d) => String(bnDigits.indexOf(d)));
  let d = ascii.replace(/\D/g, "");
  if (d.startsWith("880")) d = d.slice(2);
  else if (d.startsWith("88")) d = d.slice(2);
  if (d.length === 10 && d.startsWith("1")) d = "0" + d;
  return /^01[3-9]\d{8}$/.test(d) ? d : null;
}

export function formatPhone(p: string) {
  return p.length === 11 ? `${p.slice(0, 5)}-${p.slice(5)}` : p;
}

/* -------------------------------------------------------------- reference */

// Order validated for colour-vision-deficiency separation of CHANNEL_COLOR — keep it.
export const CHANNELS: Channel[] = ["facebook", "instagram", "whatsapp", "tiktok", "walkin", "website", "phone", "other"];

export const PAY_METHODS: PayMethod[] = ["cash", "bkash", "nagad", "rocket", "bank", "card"];

export const COURIERS = ["Steadfast", "Pathao", "RedX", "Paperfly", "Carrybee", "Sundarban", "Own rider"];

export const ROLES: BuiltinRole[] = ["owner", "manager", "sales", "packer", "accountant"];
