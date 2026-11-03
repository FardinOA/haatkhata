/**
 * Business commands — the only way business data changes.
 *
 * Each command is a pure, deterministic reducer over an Immer draft of the
 * app state. The device applies it immediately (optimistic, works offline)
 * and queues it; the server re-applies the very same function inside a
 * transaction against the rows it loaded. Ids and timestamps come from the
 * context (derived from the command id), so both sides produce identical
 * records and a retried command is recognised by its id (idempotent).
 */
import { can, DEFAULT_MAX_DISCOUNT_PCT, holdsReservation, maxDiscountPct, TRANSITIONS, transitionEffect } from "./domain";
import type {
  Address,
  CartLine,
  Channel,
  Courier,
  Customer,
  Expense,
  MovementReason,
  Notice,
  Order,
  OrderLine,
  OrderStatus,
  Payment,
  Permission,
  Product,
  Purchase,
  ReturnRecord,
  Role,
  Staff,
  Supplier,
} from "./types";
import type { AppState, BusinessProfile, InvoiceSettings, PosSettings } from "./state";
import type { Location, PurchaseOrder, PurchaseOrderStatus, Quote, QuoteStatus, RecurringExpense } from "./types";
import type { ThemeSettings } from "./theme";

export { CommandError, makeCtx, type Actor, type Ctx } from "./command-kit";
import { CommandError, findVariant, type Ctx } from "./command-kit";
import { EXT_COMMANDS, EXT_PERMISSIONS } from "./commands-ext";
import { addToBatch, changeOnHand, consumeFefo, defaultLocationId, qtyAt, restockBatch, stockUnits, syncBundles } from "./stock-ops";

/* ------------------------------------------------------------ helpers */

type S = AppState;

function move(s: S, ctx: Ctx, variantId: string, delta: number, reason: MovementReason, ref?: { label: string; id?: string }, note?: string) {
  const hit = findVariant(s, variantId);
  if (!hit || delta === 0) return;
  s.movements.push({
    id: ctx.id("m_"),
    productId: hit.p.id,
    variantId,
    delta,
    reason,
    refLabel: ref?.label,
    refId: ref?.id,
    balance: hit.v.onHand,
    by: ctx.actor.name,
    at: ctx.now,
    note,
  });
}

/** Stock effect of a status change. Bundles act on their components; sales use FEFO batches. */
function applyLineEffect(s: S, ctx: Ctx, order: Order, from: OrderStatus, to: OrderStatus) {
  for (const l of order.lines)
    for (const u of stockUnits(s, l.variantId, l.qty)) {
      const d = transitionEffect(from, to, u.qty);
      if (d.onHand) {
        changeOnHand(s, u.v, d.onHand, order.locationId);
        if (d.onHand < 0 && u.p.trackBatches) consumeFefo(u.v, -d.onHand);
      }
      u.v.reserved = Math.max(0, u.v.reserved + d.reserved);
      u.v.inTransit = Math.max(0, u.v.inTransit + d.inTransit);
      if (d.onHand) move(s, ctx, u.v.id, d.onHand, "sale", { label: `Order #${order.no}`, id: order.id });
    }
  syncBundles(s);
}

function event(ctx: Ctx, order: Order, e: Omit<Order["events"][number], "id" | "at" | "by">) {
  order.events.push({ id: ctx.id("e_"), at: ctx.now, by: ctx.actor.name, ...e });
}

function issueInvoice(s: S, ctx: Ctx, order: Order) {
  if (order.invoiceNo) return;
  order.invoiceNo = `${s.invoice.prefix}-${ctx.now.slice(0, 4)}-${String(s.nextInvoiceNo++).padStart(6, "0")}`;
}

function toLines(s: S, ctx: Ctx, cart: CartLine[]): OrderLine[] {
  return cart.flatMap((c) => {
    const hit = findVariant(s, c.variantId);
    if (!hit) return [];
    return [
      {
        id: ctx.id("l_"),
        productId: hit.p.id,
        variantId: hit.v.id,
        name: hit.p.name,
        variantLabel: Object.values(hit.v.options).join(" / "),
        sku: hit.v.sku,
        qty: c.qty,
        price: c.price,
        discount: c.discount,
        cost: hit.p.bundle?.length ? stockUnits(s, hit.v.id, 1).reduce((t, u) => t + u.v.cost * u.qty, 0) : hit.v.cost,
        returnedQty: 0,
      },
    ];
  });
}

/** Offline orders are never dropped; overselling is flagged for review instead (NFR-REL-03). */
function flagOversell(s: S, ctx: Ctx, order: Order) {
  if (s.pos.allowNegativeStock) return;
  for (const l of order.lines)
    for (const hit of stockUnits(s, l.variantId, l.qty)) {
    if (hit.v.onHand - hit.v.reserved < 0) {
      s.notices.unshift({
        id: ctx.id("n_"),
        at: ctx.now,
        kind: "low_stock",
        title: `Stock conflict on order #${order.no}`,
        body: `${hit.p.name} ${Object.values(hit.v.options).join(" / ")} is oversold by ${hit.v.reserved - hit.v.onHand}. Review before shipping.`,
        href: `/orders?id=${order.id}`,
        read: false,
      });
    }
    }
}

const requireOrder = (s: S, id: string) => {
  const o = s.orders.find((x) => x.id === id);
  if (!o) throw new CommandError("Order not found", "not_found");
  return o;
};

/* ------------------------------------------------------------ payloads */

export interface NewOrderInput {
  channel: Channel;
  customer: { id?: string; name: string; phone: string; address?: Address } | null;
  lines: CartLine[];
  discount: { type: "flat" | "pct"; value: number };
  deliveryCharge: number;
  otherCharges: number;
  payments: Omit<Payment, "id" | "at" | "by">[];
  settlement: "cod" | "due";
  notesInternal?: string;
  notesInvoice?: string;
}

export interface StockInInput {
  supplierId?: string;
  ref?: string;
  date?: string;
  /** Receive into this location (default location when missing). */
  locationId?: string;
  lines: (Purchase["lines"][number] & { batch?: { code: string; expiry?: string } })[];
  paid: number;
  note?: string;
}


export interface ReturnInput {
  orderId: string;
  lines: ReturnRecord["lines"];
  fee: number;
  refund: number;
  refundMethod?: Payment["method"];
}

function stockIn(s: S, p: StockInInput, ctx: Ctx) {
  const id = ctx.id("pur_");
  const ref = p.ref?.trim() || `PUR-${String(s.nextPurchaseNo++).padStart(4, "0")}`;
  const total = p.lines.reduce((t, l) => t + l.qty * l.unitCost, 0);
  for (const l of p.lines) {
    const hit = findVariant(s, l.variantId);
    if (!hit || l.qty <= 0) continue;
    if (hit.p.bundle?.length) throw new CommandError("Bundles don't hold stock — stock the items inside them", "invalid");
    // Weighted average cost (SRS FR-STK-06).
    const prevQty = Math.max(0, hit.v.onHand);
    hit.v.cost = Math.round(((prevQty * hit.v.cost + l.qty * l.unitCost) / (prevQty + l.qty)) * 100) / 100;
    changeOnHand(s, hit.v, l.qty, p.locationId);
    if (l.batch?.code && hit.p.trackBatches) addToBatch(hit.v, l.qty, { id: ctx.id("bt_"), code: l.batch.code, expiry: l.batch.expiry || undefined });
    move(s, ctx, l.variantId, l.qty, "purchase", { label: ref, id });
  }
  s.purchases.unshift({ id, ref, supplierId: p.supplierId, date: p.date ?? ctx.now, lines: p.lines.map(({ variantId, productId, qty, unitCost }) => ({ variantId, productId, qty, unitCost })), total, paid: p.paid, note: p.note });
  const sup = s.suppliers.find((x) => x.id === p.supplierId);
  if (sup) sup.balance += total - p.paid;
  syncBundles(s);
  return id;
}

function createOrder(s: S, p: { input: NewOrderInput; mode: "draft" | "confirm" | "complete" }, ctx: Ctx): Order {
  // Plain copy: callers may build the input from other draft records (quotes, exchanges).
  const input: NewOrderInput = JSON.parse(JSON.stringify(p.input));
  const { mode } = p;
  if (!input.lines.length) throw new CommandError("Add at least one item", "invalid");
  let customerId = input.customer?.id;
  if (input.customer && !customerId && input.customer.phone) {
    const existing = s.customers.find((c) => c.phone === input.customer!.phone);
    if (existing) customerId = existing.id;
    else {
      customerId = ctx.id("c_");
      s.customers.unshift({
        id: customerId,
        name: input.customer.name || "Customer",
        phone: input.customer.phone,
        address: input.customer.address ?? { line: "", area: "", district: "Dhaka" },
        channel: input.channel,
        tags: [],
        risky: false,
        createdAt: ctx.now,
      });
    }
  }
  const order: Order = {
    id: ctx.id("o_"),
    no: s.nextOrderNo++,
    channel: input.channel,
    customerId,
    customer: input.customer ? { name: input.customer.name, phone: input.customer.phone, address: input.customer.address } : null,
    lines: toLines(s, ctx, input.lines),
    discount: input.discount,
    deliveryCharge: input.deliveryCharge,
    otherCharges: input.otherCharges,
    payments: input.payments.filter((x) => x.amount > 0).map((x) => ({ ...x, id: ctx.id("pay_"), at: ctx.now, by: ctx.actor.name })),
    settlement: input.settlement,
    status: "draft",
    events: [{ id: ctx.id("e_"), at: ctx.now, by: ctx.actor.name, type: "created" }],
    returns: [],
    createdAt: ctx.now,
    createdBy: ctx.actor.name,
    notesInternal: input.notesInternal,
    notesInvoice: input.notesInvoice,
  };
  const loc = defaultLocationId(s);
  if (loc) order.locationId = loc;
  s.orders.push(order);
  const live = s.orders[s.orders.length - 1];
  if (mode === "confirm") {
    applyLineEffect(s, ctx, live, "draft", "confirmed");
    live.status = "confirmed";
    issueInvoice(s, ctx, live);
    event(ctx, live, { type: "status", from: "draft", to: "confirmed" });
    flagOversell(s, ctx, live);
  } else if (mode === "complete") {
    for (const l of live.lines)
      for (const u of stockUnits(s, l.variantId, l.qty)) {
        changeOnHand(s, u.v, -u.qty, live.locationId);
        if (u.p.trackBatches) consumeFefo(u.v, u.qty);
        move(s, ctx, u.v.id, -u.qty, "sale", { label: `Order #${live.no}`, id: live.id });
      }
    syncBundles(s);
    live.status = "delivered";
    issueInvoice(s, ctx, live);
    event(ctx, live, { type: "status", from: "draft", to: "delivered", note: "Counter sale" });
  }
  s.pos.lastChannel = input.channel;
  return structuredClone(live);
}

function recordReturn(s: S, p: ReturnInput, ctx: Ctx) {
  const o = requireOrder(s, p.orderId);
  if (o.status !== "shipped" && o.status !== "delivered") throw new CommandError("Only shipped or delivered orders can be returned", "conflict");
  const fromShipped = o.status === "shipped";
  for (const r of p.lines) {
    const l = o.lines.find((x) => x.id === r.lineId);
    if (!l || r.qty <= 0) continue;
    const qty = Math.min(r.qty, l.qty - l.returnedQty);
    l.returnedQty += qty;
    for (const u of stockUnits(s, l.variantId, qty)) {
      if (r.condition === "restock") {
        changeOnHand(s, u.v, u.qty, o.locationId);
        if (u.p.trackBatches) restockBatch(u.v, u.qty);
        move(s, ctx, u.v.id, u.qty, "return", { label: `Order #${o.no}`, id: o.id });
      } else u.v.damaged += u.qty;
    }
  }
  // Whatever was still in transit and not returned counts as delivered.
  if (fromShipped)
    for (const l of o.lines) for (const u of stockUnits(s, l.variantId, l.qty)) u.v.inTransit = Math.max(0, u.v.inTransit - u.qty);
  syncBundles(s);
  const from = o.status;
  o.status = o.lines.every((l) => l.returnedQty >= l.qty) ? "returned" : "partially_returned";
  o.returns.push({ id: ctx.id("r_"), at: ctx.now, lines: p.lines, fee: p.fee, refund: p.refund });
  if (p.fee > 0) s.expenses.unshift({ id: ctx.id("x_"), category: "return_fee", amount: p.fee, date: ctx.now, method: "cash", note: `Return fee · Order #${o.no}`, refOrderId: o.id });
  if (p.refund > 0) o.payments.push({ id: ctx.id("pay_"), method: p.refundMethod ?? "bkash", amount: -p.refund, at: ctx.now, by: ctx.actor.name, kind: "refund" });
  event(ctx, o, { type: "status", from, to: o.status });
  event(ctx, o, { type: "return", note: `${p.lines.reduce((t, r) => t + r.qty, 0)} item(s) back${p.fee ? ` · fee ৳${p.fee}` : ""}${p.refund ? ` · refund ৳${p.refund}` : ""}` });
}

/* ------------------------------------------------------------ commands */

const CORE_COMMANDS = {
  /* ---------- business settings */
  "business.update": (s: S, p: Partial<BusinessProfile>) => void Object.assign(s.business, p),
  "theme.update": (s: S, p: Partial<ThemeSettings>) => void Object.assign(s.theme, p),
  "invoice.update": (s: S, p: Partial<InvoiceSettings>) => void Object.assign(s.invoice, p),
  "pos.update": (s: S, p: Partial<PosSettings>) => void Object.assign(s.pos, p),
  "goal.set": (s: S, p: { amount: number }) => void (s.monthlyGoal = Math.max(0, p.amount)),

  /* ---------- team */
  "staff.add": (s: S, p: Omit<Staff, "id" | "color">, ctx: Ctx) => {
    if (p.role === "owner") throw new CommandError("A business has exactly one owner", "invalid");
    if (s.staff.some((x) => x.phone === p.phone)) throw new CommandError("Someone with this phone is already on the team", "conflict");
    const palette = ["#0A7CA8", "#7A45C2", "#B4531F", "#1F8A70", "#A0315A"];
    const id = ctx.id("st_");
    s.staff.push({ ...p, id, color: palette[s.staff.length % palette.length] });
    return id;
  },
  "staff.update": (s: S, p: { id: string; patch: Partial<Omit<Staff, "id">> }) => {
    const st = s.staff.find((x) => x.id === p.id);
    if (!st) throw new CommandError("Team member not found", "not_found");
    if (st.role === "owner" && p.patch.role && p.patch.role !== "owner") throw new CommandError("The owner's role can't be changed", "forbidden");
    if (p.patch.role === "owner" && st.role !== "owner") throw new CommandError("Transfer ownership from Settings instead", "forbidden");
    Object.assign(st, p.patch);
  },
  "staff.remove": (s: S, p: { id: string }) => {
    if (s.staff.find((x) => x.id === p.id)?.role === "owner") throw new CommandError("The owner can't be removed", "forbidden");
    s.staff = s.staff.filter((x) => x.id !== p.id);
    if (s.currentUserId === p.id) s.currentUserId = s.staff[0].id;
  },

  /* ---------- catalogue */
  "category.add": (s: S, p: { name: string; nameBn?: string }, ctx: Ctx) => {
    const id = ctx.id("cat_");
    s.categories.push({ id, name: p.name, nameBn: p.nameBn ?? p.name });
    return id;
  },
  "product.save": (s: S, p: { product: Product; opening?: Record<string, number> }, ctx: Ctx) => {
    const product = structuredClone(p.product);
    const skus = new Set(product.variants.map((v) => v.sku));
    if (skus.size !== product.variants.length) throw new CommandError("Two variants share a SKU", "invalid");
    for (const other of s.products)
      if (other.id !== product.id) for (const v of other.variants) if (skus.has(v.sku)) throw new CommandError(`SKU ${v.sku} is already used by ${other.name}`, "conflict");
    const idx = s.products.findIndex((x) => x.id === product.id);
    if (idx >= 0) {
      // Live stock counters only change through movements.
      const prev = s.products[idx];
      product.variants = product.variants.map((v) => {
        const old = prev.variants.find((o) => o.id === v.id);
        return old
          ? { ...v, onHand: old.onHand, reserved: old.reserved, inTransit: old.inTransit, damaged: old.damaged, stockByLocation: old.stockByLocation, batches: old.batches }
          : { ...v, onHand: 0, reserved: 0, inTransit: 0, damaged: 0, stockByLocation: undefined, batches: undefined };
      });
      s.products[idx] = product;
    } else {
      s.products.unshift({ ...product, variants: product.variants.map((v) => ({ ...v, onHand: 0, reserved: 0, inTransit: 0, damaged: 0, stockByLocation: undefined, batches: undefined })) });
    }
    if (product.bundle?.some((c) => product.variants.some((v) => v.id === c.variantId))) throw new CommandError("A bundle can't contain itself", "invalid");
    if (product.bundle?.length && p.opening && Object.values(p.opening).some(Boolean)) throw new CommandError("Bundles don't hold stock — stock the items inside them", "invalid");
    if (p.opening)
      for (const [vid, qty] of Object.entries(p.opening)) {
        if (!qty) continue;
        const hit = findVariant(s, vid);
        if (!hit) continue;
        changeOnHand(s, hit.v, qty);
        move(s, ctx, vid, qty, "opening", { label: "Opening stock" });
      }
    syncBundles(s);
  },
  "product.delete": (s: S, p: { id: string }) => {
    const prod = s.products.find((x) => x.id === p.id);
    if (prod?.variants.some((v) => v.reserved > 0 || v.inTransit > 0)) throw new CommandError("This product has orders in progress. Deactivate it instead.", "conflict");
    s.products = s.products.filter((x) => x.id !== p.id);
  },
  "product.duplicate": (s: S, p: { id: string }, ctx: Ctx) => {
    const src = s.products.find((x) => x.id === p.id);
    if (!src) throw new CommandError("Product not found", "not_found");
    const nid = ctx.id("p_");
    s.products.unshift({
      ...structuredClone(src),
      id: nid,
      name: `${src.name} (copy)`,
      createdAt: ctx.now,
      variants: src.variants.map((v) => ({ ...structuredClone(v), id: ctx.id("v_"), sku: `${v.sku}-C`, onHand: 0, reserved: 0, inTransit: 0, damaged: 0 })),
    });
    return nid;
  },

  /* ---------- stock */
  "stock.in": (s: S, p: StockInInput, ctx: Ctx) => stockIn(s, p, ctx),
  "stock.adjust": (s: S, p: { variantId: string; newOnHand: number; reason: Extract<MovementReason, "adjust" | "damage">; note?: string; locationId?: string }, ctx: Ctx) => {
    const hit = findVariant(s, p.variantId);
    if (!hit) throw new CommandError("Variant not found", "not_found");
    if (hit.p.bundle?.length) throw new CommandError("Bundles don't hold stock — adjust the items inside them", "invalid");
    const def = defaultLocationId(s);
    // With a location, the count is for that location; otherwise it's the total.
    const current = p.locationId && def ? qtyAt(hit.v, p.locationId, def) : hit.v.onHand;
    const delta = p.newOnHand - current;
    if (!delta) return;
    changeOnHand(s, hit.v, delta, p.locationId);
    if (delta < 0 && hit.p.trackBatches) consumeFefo(hit.v, -delta);
    if (p.reason === "damage" && delta < 0) hit.v.damaged += -delta;
    move(s, ctx, p.variantId, delta, p.reason, { label: p.reason === "damage" ? "Damage write-off" : "Stock count" }, p.note);
    syncBundles(s);
  },
  "stock.transfer": (s: S, p: { from: string; to: string; lines: { variantId: string; qty: number }[]; note?: string }, ctx: Ctx) => {
    const def = defaultLocationId(s);
    const from = s.locations.find((l) => l.id === p.from);
    const to = s.locations.find((l) => l.id === p.to);
    if (!def || !from || !to) throw new CommandError("Pick two stock locations", "invalid");
    if (from.id === to.id) throw new CommandError("Choose a different destination", "invalid");
    const id = ctx.id("tr_");
    const label = `Transfer · ${from.name} → ${to.name}`;
    for (const l of p.lines) {
      const hit = findVariant(s, l.variantId);
      if (!hit || l.qty <= 0) continue;
      const have = qtyAt(hit.v, from.id, def);
      if (l.qty > have) throw new CommandError(`Only ${have} of ${hit.v.sku} at ${from.name}`, "conflict");
      // Two ledger lines that cancel out: the total never changes.
      changeOnHand(s, hit.v, -l.qty, from.id);
      move(s, ctx, hit.v.id, -l.qty, "transfer", { label, id }, p.note);
      changeOnHand(s, hit.v, l.qty, to.id);
      move(s, ctx, hit.v.id, l.qty, "transfer", { label, id }, p.note);
    }
    return id;
  },
  "supplier.add": (s: S, p: Omit<Supplier, "id" | "balance">, ctx: Ctx) => {
    const id = ctx.id("sup_");
    s.suppliers.push({ ...p, id, balance: 0 });
    return id;
  },
  "supplier.pay": (s: S, p: { supplierId: string; amount: number }) => {
    const sup = s.suppliers.find((x) => x.id === p.supplierId);
    if (!sup) throw new CommandError("Supplier not found", "not_found");
    sup.balance = Math.max(0, sup.balance - p.amount);
  },

  /* ---------- orders */
  "order.create": (s: S, p: { input: NewOrderInput; mode: "draft" | "confirm" | "complete" }, ctx: Ctx): Order => createOrder(s, p, ctx),

  "order.updateLines": (s: S, p: { orderId: string; lines: CartLine[] }, ctx: Ctx) => {
    const o = requireOrder(s, p.orderId);
    if (!["draft", "confirmed", "packed"].includes(o.status)) throw new CommandError("Shipped orders can't change items", "conflict");
    const reserving = holdsReservation(o.status);
    if (reserving) for (const l of o.lines) for (const u of stockUnits(s, l.variantId, l.qty)) u.v.reserved = Math.max(0, u.v.reserved - u.qty);
    o.lines = toLines(s, ctx, p.lines);
    if (reserving) for (const l of o.lines) for (const u of stockUnits(s, l.variantId, l.qty)) u.v.reserved += u.qty;
    syncBundles(s);
    event(ctx, o, { type: "edit", note: "Items updated" });
  },

  "order.transition": (s: S, p: { orderId: string; to: OrderStatus; courier?: Courier; note?: string }, ctx: Ctx) => {
    const o = requireOrder(s, p.orderId);
    if (!TRANSITIONS[o.status].includes(p.to) || p.to === "returned") throw new CommandError(`Can't move an order from ${o.status} to ${p.to}`, "conflict");
    const from = o.status;
    applyLineEffect(s, ctx, o, from, p.to);
    o.status = p.to;
    if (p.to === "confirmed") issueInvoice(s, ctx, o);
    if (p.courier) o.courier = { ...o.courier, ...p.courier };
    event(ctx, o, { type: "status", from, to: p.to, note: p.note });
    return true;
  },

  "order.return": (s: S, p: ReturnInput, ctx: Ctx) => recordReturn(s, p, ctx),

  "order.payment": (s: S, p: { orderId: string; payment: Omit<Payment, "id" | "at" | "by"> }, ctx: Ctx) => {
    const o = requireOrder(s, p.orderId);
    if (!(p.payment.amount > 0)) throw new CommandError("Payment must be more than zero", "invalid");
    o.payments.push({ ...p.payment, id: ctx.id("pay_"), at: ctx.now, by: ctx.actor.name });
    event(ctx, o, { type: "payment", note: `৳${p.payment.amount} via ${p.payment.method}` });
  },

  "order.codReceived": (s: S, p: { orderIds: string[]; ref?: string }, ctx: Ctx) => {
    for (const id of p.orderIds) {
      const o = s.orders.find((x) => x.id === id);
      if (!o || o.codReceived) continue;
      o.codReceived = { at: ctx.now, ref: p.ref };
      event(ctx, o, { type: "cod", note: `COD received${p.ref ? ` · ${p.ref}` : ""}` });
    }
  },

  "order.courier": (s: S, p: { orderId: string; courier: Courier }) => {
    requireOrder(s, p.orderId).courier = p.courier;
  },

  "order.note": (s: S, p: { orderId: string; note: string }, ctx: Ctx) => {
    event(ctx, requireOrder(s, p.orderId), { type: "note", note: p.note });
  },

  "order.print": (s: S, p: { orderIds: string[]; what: string }, ctx: Ctx) => {
    for (const id of p.orderIds) {
      const o = s.orders.find((x) => x.id === id);
      if (o) event(ctx, o, { type: "print", note: p.what });
    }
  },

  "order.deleteDraft": (s: S, p: { orderId: string }) => {
    s.orders = s.orders.filter((o) => !(o.id === p.orderId && o.status === "draft"));
  },

  /* ---------- customers */
  "customer.upsert": (s: S, p: Partial<Customer> & { name: string; phone: string }, ctx: Ctx) => {
    const existing = s.customers.find((x) => (p.id ? x.id === p.id : x.phone === p.phone));
    if (existing) {
      if (p.phone !== existing.phone && s.customers.some((x) => x.phone === p.phone && x.id !== existing.id)) throw new CommandError("Another customer has this phone", "conflict");
      Object.assign(existing, p);
      return existing.id;
    }
    const id = p.id ?? ctx.id("c_");
    s.customers.unshift({
      id,
      name: p.name,
      phone: p.phone,
      altPhone: p.altPhone,
      address: p.address ?? { line: "", area: "", district: "Dhaka" },
      channel: p.channel ?? "facebook",
      tags: p.tags ?? [],
      notes: p.notes,
      risky: p.risky ?? false,
      fbLink: p.fbLink,
      createdAt: ctx.now,
    });
    return id;
  },
  "customer.risk": (s: S, p: { id: string; risky: boolean; note?: string }) => {
    const c = s.customers.find((x) => x.id === p.id);
    if (!c) throw new CommandError("Customer not found", "not_found");
    c.risky = p.risky;
    if (p.note !== undefined) c.notes = p.note;
  },

  /* ---------- money */
  "expense.add": (s: S, p: Omit<Expense, "id">, ctx: Ctx) => {
    if (!(p.amount > 0)) throw new CommandError("Amount must be more than zero", "invalid");
    s.expenses.unshift({ ...p, id: ctx.id("x_") });
  },
  "expense.delete": (s: S, p: { id: string }) => {
    s.expenses = s.expenses.filter((e) => e.id !== p.id);
  },


  /* ---------- locations (FR-STK-10) */
  "location.save": (s: S, p: { location: Partial<Location> & { name: string } }, ctx: Ctx) => {
    const isFirst = !s.locations.length;
    const existing = p.location.id ? s.locations.find((l) => l.id === p.location.id) : undefined;
    const loc: Location = existing ?? { id: p.location.id ?? ctx.id("loc_"), name: p.location.name, nameBn: p.location.nameBn ?? p.location.name, isDefault: isFirst, active: true };
    Object.assign(loc, { name: p.location.name.trim(), nameBn: (p.location.nameBn ?? loc.nameBn).trim(), active: p.location.active ?? loc.active });
    if (!existing) {
      // Before the first split, everything implicitly sits at the default location — pin it there.
      if (isFirst) loc.isDefault = true;
      s.locations.push(loc);
    }
    if (p.location.isDefault && !loc.isDefault) {
      // Pin current stock to the old default before the default moves.
      const oldDef = defaultLocationId(s);
      if (oldDef) for (const prod of s.products) for (const v of prod.variants) if (!v.stockByLocation && !prod.bundle?.length) v.stockByLocation = { [oldDef]: v.onHand };
      for (const l of s.locations) l.isDefault = l.id === loc.id;
      s.pos.defaultLocationId = loc.id;
    }
    return loc.id;
  },
  "location.delete": (s: S, p: { id: string }) => {
    const loc = s.locations.find((l) => l.id === p.id);
    if (!loc) throw new CommandError("Location not found", "not_found");
    if (loc.isDefault) throw new CommandError("Make another location the default first", "conflict");
    const def = defaultLocationId(s);
    const held = s.products.reduce((t, prod) => t + prod.variants.reduce((u, v) => u + qtyAt(v, loc.id, def), 0), 0);
    if (held) throw new CommandError(`${loc.name} still holds ${held} units. Transfer them out first.`, "conflict");
    s.locations = s.locations.filter((l) => l.id !== p.id);
  },

  /* ---------- purchase orders (FR-STK-11) */
  "po.save": (s: S, p: { po: Pick<PurchaseOrder, "supplierId" | "lines" | "expectedAt" | "note" | "locationId"> & { id?: string } }, ctx: Ctx) => {
    if (!p.po.lines.length) throw new CommandError("Add at least one item", "invalid");
    const existing = p.po.id ? s.purchaseOrders.find((x) => x.id === p.po.id) : undefined;
    if (existing) {
      if (!["draft", "ordered"].includes(existing.status)) throw new CommandError("Received purchase orders can't be edited", "conflict");
      Object.assign(existing, { supplierId: p.po.supplierId, expectedAt: p.po.expectedAt, note: p.po.note, locationId: p.po.locationId, lines: p.po.lines.map((l) => ({ ...l, received: 0 })) });
      existing.history.push({ at: ctx.now, by: ctx.actor.name, note: "Edited" });
      return existing.id;
    }
    const n = s.purchaseOrders.reduce((m, x) => Math.max(m, Number(x.no.replace(/\D/g, "")) || 0), 0) + 1;
    const po: PurchaseOrder = { id: ctx.id("po_"), no: `PO-${String(n).padStart(4, "0")}`, status: "draft", supplierId: p.po.supplierId, expectedAt: p.po.expectedAt, note: p.po.note, locationId: p.po.locationId, lines: p.po.lines.map((l) => ({ ...l, received: 0 })), createdAt: ctx.now, createdBy: ctx.actor.name, history: [{ at: ctx.now, by: ctx.actor.name, note: "Created" }] };
    s.purchaseOrders.unshift(po);
    return po.id;
  },
  "po.status": (s: S, p: { id: string; status: Extract<PurchaseOrderStatus, "ordered" | "closed" | "cancelled"> }, ctx: Ctx) => {
    const po = s.purchaseOrders.find((x) => x.id === p.id);
    if (!po) throw new CommandError("Purchase order not found", "not_found");
    const ok = { ordered: ["draft"], closed: ["partial", "received", "ordered"], cancelled: ["draft", "ordered"] }[p.status];
    if (!ok.includes(po.status)) throw new CommandError(`Can't mark a ${po.status} purchase order as ${p.status}`, "conflict");
    po.status = p.status;
    po.history.push({ at: ctx.now, by: ctx.actor.name, note: { ordered: "Sent to supplier", closed: "Closed", cancelled: "Cancelled" }[p.status] });
  },
  "po.receive": (s: S, p: { id: string; lines: { variantId: string; qty: number; unitCost?: number; batch?: { code: string; expiry?: string } }[]; paid: number; locationId?: string }, ctx: Ctx) => {
    const po = s.purchaseOrders.find((x) => x.id === p.id);
    if (!po) throw new CommandError("Purchase order not found", "not_found");
    if (!["ordered", "partial", "draft"].includes(po.status)) throw new CommandError("This purchase order is already closed", "conflict");
    const lines = p.lines
      .filter((r) => r.qty > 0)
      .map((r) => {
        const l = po.lines.find((x) => x.variantId === r.variantId);
        if (!l) throw new CommandError("That item isn't on this purchase order", "invalid");
        l.received += r.qty;
        return { variantId: l.variantId, productId: l.productId, qty: r.qty, unitCost: r.unitCost ?? l.unitCost, batch: r.batch };
      });
    if (!lines.length) throw new CommandError("Enter what arrived", "invalid");
    const purchaseId = stockIn(s, { supplierId: po.supplierId, ref: po.no, lines, paid: p.paid, locationId: p.locationId ?? po.locationId, note: `Received against ${po.no}` }, ctx);
    po.status = po.lines.every((l) => l.received >= l.qty) ? "received" : "partial";
    po.history.push({ at: ctx.now, by: ctx.actor.name, note: `Received ${lines.reduce((t, l) => t + l.qty, 0)} units` });
    return purchaseId;
  },

  /* ---------- quotations (FR-INV-11) */
  "quote.save": (s: S, p: { quote: Omit<Quote, "id" | "no" | "status" | "createdAt" | "createdBy" | "orderId"> & { id?: string } }, ctx: Ctx) => {
    if (!p.quote.lines.length) throw new CommandError("Add at least one item", "invalid");
    const existing = p.quote.id ? s.quotes.find((q) => q.id === p.quote.id) : undefined;
    if (existing) {
      if (existing.status === "converted") throw new CommandError("This quotation is already an order", "conflict");
      Object.assign(existing, p.quote);
      return existing.id;
    }
    const n = s.quotes.reduce((m, x) => Math.max(m, Number(x.no.replace(/\D/g, "")) || 0), 0) + 1;
    const q: Quote = { ...p.quote, id: ctx.id("q_"), no: `Q-${String(n).padStart(4, "0")}`, status: "draft", createdAt: ctx.now, createdBy: ctx.actor.name };
    s.quotes.unshift(q);
    return q.id;
  },
  "quote.status": (s: S, p: { id: string; status: Extract<QuoteStatus, "sent" | "accepted" | "expired" | "draft"> }) => {
    const q = s.quotes.find((x) => x.id === p.id);
    if (!q) throw new CommandError("Quotation not found", "not_found");
    if (q.status === "converted") throw new CommandError("This quotation is already an order", "conflict");
    q.status = p.status;
  },
  "quote.convert": (s: S, p: { id: string; mode: "draft" | "confirm" }, ctx: Ctx): Order => {
    const q = s.quotes.find((x) => x.id === p.id);
    if (!q) throw new CommandError("Quotation not found", "not_found");
    if (q.status === "converted") throw new CommandError("This quotation is already an order", "conflict");
    const order = createOrder(
      s,
      {
        mode: p.mode,
        input: {
          channel: q.channel,
          customer: q.customer,
          lines: q.lines.map((l, i) => ({ key: `q${i}`, productId: l.productId, variantId: l.variantId, qty: l.qty, price: l.price, discount: l.discount })),
          discount: q.discount,
          deliveryCharge: q.deliveryCharge,
          otherCharges: 0,
          payments: [],
          settlement: q.channel === "walkin" ? "due" : "cod",
          notesInvoice: q.notes,
          notesInternal: `From quotation ${q.no}`,
        },
      },
      ctx,
    );
    const live = s.orders.find((o) => o.id === order.id)!;
    live.quoteId = q.id;
    q.status = "converted";
    q.orderId = order.id;
    return structuredClone(live);
  },

  /* ---------- exchange (FR-ORD-06) */
  "order.exchange": (s: S, p: { orderId: string; returnLines: ReturnRecord["lines"]; fee: number; newLines: CartLine[]; deliveryCharge: number; mode: "confirm" | "draft"; credit?: number }, ctx: Ctx): Order => {
    const o = requireOrder(s, p.orderId);
    if (!p.newLines.length) throw new CommandError("Pick what to send instead", "invalid");
    recordReturn(s, { orderId: o.id, lines: p.returnLines, fee: p.fee, refund: 0 }, ctx);
    const next = createOrder(
      s,
      {
        mode: p.mode,
        input: {
          channel: o.channel,
          customer: o.customer ? { id: o.customerId, ...o.customer } : null,
          lines: p.newLines,
          // Value of what came back is credited, so the courier only collects the difference.
          discount: { type: "flat", value: Math.max(0, p.credit ?? 0) },
          deliveryCharge: p.deliveryCharge,
          otherCharges: 0,
          payments: [],
          settlement: "cod",
          notesInternal: `Exchange for order #${o.no}`,
        },
      },
      ctx,
    );
    const live = s.orders.find((x) => x.id === next.id)!;
    live.exchangeOf = o.id;
    o.exchangedTo = live.id;
    event(ctx, o, { type: "note", note: `Exchanged — new order #${live.no}` });
    return structuredClone(live);
  },

  /* ---------- customer merge (FR-CUS-05) */
  "customer.merge": (s: S, p: { keepId: string; mergeIds: string[] }) => {
    const keep = s.customers.find((c) => c.id === p.keepId);
    if (!keep) throw new CommandError("Customer not found", "not_found");
    const others = s.customers.filter((c) => p.mergeIds.includes(c.id) && c.id !== keep.id);
    if (!others.length) throw new CommandError("Pick at least one duplicate to merge", "invalid");
    for (const c of others) {
      keep.tags = [...new Set([...keep.tags, ...c.tags])];
      keep.risky = keep.risky || c.risky;
      if (!keep.altPhone && c.phone !== keep.phone) keep.altPhone = c.phone;
      if (c.notes) keep.notes = keep.notes ? `${keep.notes}\n${c.notes}` : c.notes;
      if (!keep.fbLink && c.fbLink) keep.fbLink = c.fbLink;
      if (c.createdAt < keep.createdAt) keep.createdAt = c.createdAt;
    }
    const ids = new Set(others.map((c) => c.id));
    for (const o of s.orders) if (o.customerId && ids.has(o.customerId)) o.customerId = keep.id;
    s.customers = s.customers.filter((c) => !ids.has(c.id));
    return keep.id;
  },

  /* ---------- recurring expenses (FR-EXP-02) */
  "recurring.save": (s: S, p: { template: Omit<RecurringExpense, "id" | "lastRun"> & { id?: string } }, ctx: Ctx) => {
    if (!(p.template.amount > 0)) throw new CommandError("Amount must be more than zero", "invalid");
    const day = Math.min(28, Math.max(1, Math.round(p.template.dayOfMonth)));
    const existing = p.template.id ? s.recurring.find((r) => r.id === p.template.id) : undefined;
    if (existing) {
      Object.assign(existing, { ...p.template, dayOfMonth: day });
      return existing.id;
    }
    const id = ctx.id("rx_");
    // Start next time it's due: don't back-fill this month if the day has passed.
    const today = ctx.now.slice(0, 10);
    const thisMonth = today.slice(0, 7);
    s.recurring.push({ ...p.template, id, dayOfMonth: day, lastRun: Number(today.slice(8, 10)) >= day ? thisMonth : undefined });
    return id;
  },
  "recurring.delete": (s: S, p: { id: string }) => {
    s.recurring = s.recurring.filter((r) => r.id !== p.id);
  },
  /** Creates this month's expenses for due templates. Ids are derived from template + month, so every device agrees. */
  "recurring.run": (s: S, p: { today: string }) => {
    const month = p.today.slice(0, 7);
    const day = Number(p.today.slice(8, 10));
    let created = 0;
    for (const r of s.recurring) {
      if (!r.active || (r.lastRun && r.lastRun >= month) || day < r.dayOfMonth) continue;
      const id = `x_rec_${r.id}_${month.replace("-", "")}`;
      if (!s.expenses.some((e) => e.id === id)) {
        s.expenses.unshift({ id, category: r.category, amount: r.amount, date: `${month}-${String(r.dayOfMonth).padStart(2, "0")}T06:00:00.000Z`, method: r.method, note: r.note ? `${r.note} (monthly)` : "Monthly" });
        created++;
      }
      r.lastRun = month;
    }
    return created;
  },

  /* ---------- notices */
  "notice.push": (s: S, p: Omit<Notice, "id" | "at" | "read">, ctx: Ctx) => {
    s.notices.unshift({ ...p, id: ctx.id("n_"), at: ctx.now, read: false });
  },
  "notice.readAll": (s: S) => {
    s.notices.forEach((n) => (n.read = true));
  },
} satisfies Record<string, (s: S, p: never, ctx: Ctx) => unknown>;

export const COMMANDS = { ...CORE_COMMANDS, ...EXT_COMMANDS };

export type CommandType = keyof typeof COMMANDS;
export type CommandPayload<T extends CommandType> = Parameters<(typeof COMMANDS)[T]>[1];
export type CommandResult<T extends CommandType> = ReturnType<(typeof COMMANDS)[T]>;

export interface QueuedCommand<T extends CommandType = CommandType> {
  id: string;
  type: T;
  payload: CommandPayload<T>;
  at: string;
}

/** Who may run each command (checked again on the server — never trust the device). */
export const COMMAND_PERMISSION: Record<CommandType, Permission | null> = {
  ...EXT_PERMISSIONS,
  "business.update": "settings",
  "theme.update": "settings",
  "invoice.update": "settings",
  "pos.update": "settings",
  "goal.set": "settings",
  "staff.add": "settings",
  "staff.update": "settings",
  "staff.remove": "settings",
  "category.add": "edit_price",
  "product.save": "edit_price",
  "product.delete": "edit_price",
  "product.duplicate": "edit_price",
  "stock.in": "edit_stock",
  "stock.adjust": "edit_stock",
  "supplier.add": "edit_stock",
  "supplier.pay": "view_cost",
  "order.create": "create_order",
  "order.updateLines": "create_order",
  "order.transition": null, // checked per target status below
  "order.return": "deliver_return",
  "order.payment": "create_order",
  "order.codReceived": "deliver_return",
  "order.courier": "pack_ship",
  "order.note": null,
  "order.print": null,
  "order.deleteDraft": "create_order",
  "customer.upsert": "create_order",
  "customer.risk": "create_order",
  "expense.add": "view_cost",
  "expense.delete": "view_cost",
  "notice.push": null,
  "notice.readAll": null,
  "stock.transfer": "edit_stock",
  "location.save": "settings",
  "location.delete": "settings",
  "po.save": "edit_stock",
  "po.status": "edit_stock",
  "po.receive": "edit_stock",
  "quote.save": "create_order",
  "quote.status": "create_order",
  "quote.convert": "create_order",
  "order.exchange": "deliver_return",
  "customer.merge": "delete_order",
  "recurring.save": "view_cost",
  "recurring.delete": "view_cost",
  "recurring.run": null,
};

const TRANSITION_PERMISSION: Partial<Record<OrderStatus, Permission>> = {
  confirmed: "create_order",
  packed: "pack_ship",
  shipped: "pack_ship",
  delivered: "deliver_return",
  cancelled: "create_order",
};

/** Sales staff may give up to this much order discount without approval (FR-AUTH-06). */
export const MAX_DISCOUNT_WITHOUT_APPROVAL = DEFAULT_MAX_DISCOUNT_PCT;

/**
 * Permission and field-level checks that need the payload and current state:
 * price edits, large discounts, status-specific roles.
 */
export function authorize(type: CommandType, payload: unknown, role: Role, s: S) {
  const perm = COMMAND_PERMISSION[type];
  if (perm && !can(role, perm)) throw new CommandError("You don't have permission to do this", "forbidden");
  if (type === "order.transition") {
    const p = payload as CommandPayload<"order.transition">;
    const need = TRANSITION_PERMISSION[p.to];
    if (need && !can(role, need)) throw new CommandError("Your role can't make this change", "forbidden");
  }
  if (type === "order.create" || type === "order.updateLines") {
    const lines = type === "order.create" ? (payload as CommandPayload<"order.create">).input.lines : (payload as CommandPayload<"order.updateLines">).lines;
    if (!can(role, "edit_price"))
      for (const l of lines) {
        const hit = findVariant(s, l.variantId);
        if (hit && l.price !== hit.v.price) throw new CommandError("Only managers can change prices", "forbidden");
      }
    if (type === "order.create" && !can(role, "big_discount")) {
      const { discount } = (payload as CommandPayload<"order.create">).input;
      const subtotal = lines.reduce((t, l) => t + l.qty * l.price - l.discount, 0);
      const pct = discount.type === "pct" ? discount.value : subtotal ? (discount.value / subtotal) * 100 : 0;
      const cap = maxDiscountPct(role);
      if (pct > cap + 0.001) throw new CommandError(`Discounts above ${cap}% need a manager`, "forbidden");
    }
  }
}
