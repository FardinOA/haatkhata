import "server-only";
/**
 * Bridges the relational schema and the app-state shape the commands use.
 *
 * - `loadWorkingSet` reads just the rows a command needs (plus the business
 *   row, locked FOR UPDATE so counters and stock stay consistent).
 * - `persistChanges` diffs the state before/after the command and writes only
 *   what changed.
 * - `snapshot` builds what a device pulls, stripping cost data for roles that
 *   may not see it (SRS NFR-SEC-04 / AC-5).
 */
import { and, eq, gt, inArray, sql } from "drizzle-orm";
import type { CommandPayload, CommandType } from "@/lib/commands";
import { can, orderTotals } from "@/lib/domain";
import { initialState, type AppState } from "@/lib/state";
import type { Customer, Expense, Location, Notice, Order, Product, Purchase, PurchaseOrder, Quote, RecurringExpense, Role, Staff, StockMovement, Supplier, Variant } from "@/lib/types";
import { schema, type Tx } from "./db";
import { locations as locationsT, purchaseOrders as poT, quotes as quotesT, recurringExpenses as recurringT } from "./db/schema-inventory";
import { storeDataUrl } from "./storage";

const { businesses, memberships, users, categories, products, variants, stockMovements, suppliers, purchases, customers, orders, orderLines, payments, orderEvents, expenses, notices, tombstones } = schema;

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : undefined);
const date = (s: string | undefined | null) => (s ? new Date(s) : new Date());
const undef = <T,>(v: T | null | undefined) => (v === null ? undefined : v);

/* ------------------------------------------------------------ row → state */

type BusinessRow = typeof businesses.$inferSelect;

export function businessToState(b: BusinessRow, s: AppState) {
  s.business = { name: b.name, nameBn: b.nameBn, tagline: b.tagline, phone: b.phone, email: b.email, address: b.address, facebook: b.facebook, logo: b.logo, logoShape: b.logoShape as AppState["business"]["logoShape"] };
  Object.assign(s.theme, b.theme);
  Object.assign(s.invoice, b.invoice);
  Object.assign(s.pos, b.pos);
  s.monthlyGoal = b.monthlyGoal;
  s.plan = { name: planLabel(b.plan), orderLimit: b.planOrderLimit, renewsAt: iso(b.planRenewsAt ?? b.trialEndsAt) ?? "" };
  s.nextOrderNo = b.nextOrderNo;
  s.nextInvoiceNo = b.nextInvoiceNo;
  s.nextPurchaseNo = b.nextPurchaseNo;
}

export function planLabel(plan: string) {
  return { trial: "Business", expired: "No plan", starter: "Starter", business: "Business", pro: "Pro" }[plan] ?? plan;
}

function toProduct(p: typeof products.$inferSelect, vs: (typeof variants.$inferSelect)[]): Product {
  return {
    id: p.id,
    name: p.name,
    nameBn: undef(p.nameBn),
    categoryId: p.categoryId,
    unit: p.unit,
    description: undef(p.description),
    images: p.images,
    art: p.art as Product["art"],
    optionTypes: p.optionTypes,
    status: p.status as Product["status"],
    tags: p.tags,
    createdAt: p.createdAt.toISOString(),
    ...(p.extra ?? {}),
    variants: vs
      .filter((v) => v.productId === p.id)
      .sort((a, b) => a.position - b.position)
      .map<Variant>((v) => ({
        id: v.id,
        sku: v.sku,
        barcode: undef(v.barcode),
        options: v.options,
        price: v.price,
        cost: v.cost,
        mrp: undef(v.mrp),
        onHand: v.onHand,
        reserved: v.reserved,
        inTransit: v.inTransit,
        damaged: v.damaged,
        lowStock: v.lowStock,
        active: v.active,
        ...(v.extra ?? {}),
      })),
  };
}

function toOrder(o: typeof orders.$inferSelect, ls: (typeof orderLines.$inferSelect)[], ps: (typeof payments.$inferSelect)[], es: (typeof orderEvents.$inferSelect)[]): Order {
  return {
    id: o.id,
    no: o.no,
    invoiceNo: undef(o.invoiceNo),
    channel: o.channel as Order["channel"],
    customerId: undef(o.customerId),
    customer: (o.customer as Order["customer"]) ?? null,
    discount: o.discount,
    deliveryCharge: o.deliveryCharge,
    otherCharges: o.otherCharges,
    settlement: o.settlement as Order["settlement"],
    status: o.status as Order["status"],
    courier: (o.courier as unknown as Order["courier"]) ?? undefined,
    codReceived: o.codReceived ?? undefined,
    notesInternal: undef(o.notesInternal),
    notesInvoice: undef(o.notesInvoice),
    returns: o.returns as Order["returns"],
    createdAt: o.createdAt.toISOString(),
    createdBy: o.createdBy,
    ...(o.extra ?? {}),
    lines: ls
      .filter((l) => l.orderId === o.id)
      .sort((a, b) => a.position - b.position)
      .map((l) => ({ id: l.id, productId: l.productId, variantId: l.variantId, name: l.name, variantLabel: l.variantLabel, sku: l.sku, qty: l.qty, price: l.price, discount: l.discount, cost: l.cost, returnedQty: l.returnedQty })),
    payments: ps
      .filter((p) => p.orderId === o.id)
      .sort((a, b) => a.at.getTime() - b.at.getTime())
      .map((p) => ({ id: p.id, method: p.method as never, amount: p.amount, txnId: undef(p.txnId), at: p.at.toISOString(), by: p.byName, kind: p.kind as never })),
    events: es
      .filter((e) => e.orderId === o.id)
      .sort((a, b) => a.at.getTime() - b.at.getTime() || a.id.localeCompare(b.id))
      .map((e) => ({ id: e.id, at: e.at.toISOString(), by: e.byName, type: e.type as never, from: undef(e.fromStatus) as never, to: undef(e.toStatus) as never, note: undef(e.note) })),
  };
}

const toCustomer = (c: typeof customers.$inferSelect): Customer => ({
  id: c.id,
  name: c.name,
  phone: c.phone,
  altPhone: undef(c.altPhone),
  address: c.address,
  channel: c.channel as Customer["channel"],
  tags: c.tags,
  notes: undef(c.notes),
  risky: c.risky,
  fbLink: undef(c.fbLink),
  createdAt: c.createdAt.toISOString(),
  ...(c.extra ?? {}),
});

const toMovement = (m: typeof stockMovements.$inferSelect): StockMovement => ({
  id: m.id,
  productId: m.productId,
  variantId: m.variantId,
  delta: m.delta,
  reason: m.reason as StockMovement["reason"],
  refLabel: undef(m.refLabel),
  refId: undef(m.refId),
  balance: m.balance,
  by: m.byName,
  at: m.at.toISOString(),
  note: undef(m.note),
});

const toExpense = (e: typeof expenses.$inferSelect): Expense => ({ id: e.id, category: e.category as Expense["category"], amount: e.amount, date: e.date.toISOString(), method: e.method as Expense["method"], note: undef(e.note), refOrderId: undef(e.refOrderId) });
const toSupplier = (s: typeof suppliers.$inferSelect): Supplier => ({ id: s.id, name: s.name, phone: s.phone, address: undef(s.address), balance: s.balance });
const toPurchase = (p: typeof purchases.$inferSelect): Purchase => ({ id: p.id, ref: p.ref, supplierId: undef(p.supplierId), date: p.date.toISOString(), lines: p.lines, total: p.total, paid: p.paid, note: undef(p.note) });
const toNotice = (n: typeof notices.$inferSelect): Notice => ({ id: n.id, at: n.at.toISOString(), kind: n.kind as Notice["kind"], title: n.title, body: undef(n.body), href: undef(n.href), read: n.read });

const toLocation = (l: typeof locationsT.$inferSelect): Location => ({ id: l.id, name: l.name, nameBn: l.nameBn, isDefault: l.isDefault, active: l.active });
const toPO = (p: typeof poT.$inferSelect): PurchaseOrder => ({
  id: p.id,
  no: p.no,
  supplierId: undef(p.supplierId),
  status: p.status as PurchaseOrder["status"],
  lines: p.lines,
  expectedAt: iso(p.expectedAt),
  locationId: undef(p.locationId),
  note: undef(p.note),
  history: p.history,
  createdAt: p.createdAt.toISOString(),
  createdBy: p.createdBy,
});
const toQuote = (q: typeof quotesT.$inferSelect): Quote => ({
  id: q.id,
  no: q.no,
  status: q.status as Quote["status"],
  customer: (q.customer as Quote["customer"]) ?? null,
  channel: q.channel as Quote["channel"],
  lines: q.lines as Quote["lines"],
  discount: q.discount,
  deliveryCharge: q.deliveryCharge,
  validUntil: q.validUntil,
  notes: undef(q.notes),
  orderId: undef(q.orderId),
  createdAt: q.createdAt.toISOString(),
  createdBy: q.createdBy,
});
const toRecurring = (r: typeof recurringT.$inferSelect): RecurringExpense => ({ id: r.id, category: r.category as RecurringExpense["category"], amount: r.amount, method: r.method as RecurringExpense["method"], note: undef(r.note), dayOfMonth: r.dayOfMonth, lastRun: undef(r.lastRun), active: r.active });

async function loadStaff(tx: Tx): Promise<Staff[]> {
  const rows = await tx
    .select({ userId: memberships.userId, role: memberships.role, color: memberships.color, status: memberships.status, name: users.name, phone: users.phone })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(inArray(memberships.status, ["active", "invited"]));
  const order = { owner: 0, manager: 1, sales: 2, packer: 3, accountant: 4 } as Record<string, number>;
  return rows.sort((a, b) => (order[a.role] ?? 9) - (order[b.role] ?? 9)).map((r) => ({ id: r.userId, name: r.name || r.phone, phone: r.phone, role: r.role as Role, color: r.color }));
}

async function loadProducts(tx: Tx, ids: string[] | "all") {
  const ps = ids === "all" ? await tx.select().from(products) : ids.length ? await tx.select().from(products).where(inArray(products.id, ids)) : [];
  if (!ps.length) return [];
  const vs = await tx.select().from(variants).where(inArray(variants.productId, ps.map((p) => p.id)));
  return ps.map((p) => toProduct(p, vs));
}

async function loadOrders(tx: Tx, ids: string[]) {
  if (!ids.length) return [];
  const os = await tx.select().from(orders).where(inArray(orders.id, ids));
  if (!os.length) return [];
  const oid = os.map((o) => o.id);
  const [ls, ps, es] = await Promise.all([
    tx.select().from(orderLines).where(inArray(orderLines.orderId, oid)),
    tx.select().from(payments).where(inArray(payments.orderId, oid)),
    tx.select().from(orderEvents).where(inArray(orderEvents.orderId, oid)),
  ]);
  return os.map((o) => toOrder(o, ls, ps, es));
}

/* ------------------------------------------------------------ working set */

type Needs = { variantIds: string[]; productIds: string[] | "all"; orderIds: string[]; customerIds: string[]; customerPhones: string[]; expenseIds: string[]; unreadNotices: boolean; purchaseOrders?: boolean; quotes?: boolean; recurring?: boolean; ordersOfCustomers?: boolean };

function needsFor(type: CommandType, payload: unknown): Needs {
  const n: Needs = { variantIds: [], productIds: [], orderIds: [], customerIds: [], customerPhones: [], expenseIds: [], unreadNotices: false };
  const p = payload as Record<string, unknown>;
  switch (type) {
    case "order.create": {
      const { input } = payload as CommandPayload<"order.create">;
      n.variantIds = input.lines.map((l) => l.variantId);
      if (input.customer?.id) n.customerIds.push(input.customer.id);
      if (input.customer?.phone) n.customerPhones.push(input.customer.phone);
      break;
    }
    case "order.updateLines":
      n.orderIds = [p.orderId as string];
      n.variantIds = (payload as CommandPayload<"order.updateLines">).lines.map((l) => l.variantId);
      break;
    case "order.codReceived":
    case "order.print":
      n.orderIds = p.orderIds as string[];
      break;
    case "order.transition":
    case "order.return":
    case "order.payment":
    case "order.courier":
    case "order.note":
    case "order.deleteDraft":
      n.orderIds = [p.orderId as string];
      break;
    case "stock.in":
      n.variantIds = (payload as CommandPayload<"stock.in">).lines.map((l) => l.variantId);
      break;
    case "stock.adjust":
      n.variantIds = [p.variantId as string];
      break;
    case "product.save":
    case "product.duplicate":
      n.productIds = "all"; // SKU uniqueness spans the catalogue
      break;
    case "product.delete":
      n.productIds = [p.id as string];
      break;
    case "customer.upsert":
      if (p.id) n.customerIds.push(p.id as string);
      if (p.phone) n.customerPhones.push(p.phone as string);
      break;
    case "customer.risk":
      n.customerIds = [p.id as string];
      break;
    case "expense.delete":
      n.expenseIds = [p.id as string];
      break;
    case "notice.readAll":
      n.unreadNotices = true;
      break;
    case "stock.transfer":
      n.variantIds = (payload as CommandPayload<"stock.transfer">).lines.map((l) => l.variantId);
      break;
    case "location.save":
    case "location.delete":
      n.productIds = "all"; // changing the default pins stock across the catalogue
      break;
    case "po.save":
    case "po.status":
    case "po.receive":
      n.purchaseOrders = true;
      break;
    case "quote.save":
    case "quote.status":
    case "quote.convert":
      n.quotes = true;
      break;
    case "order.exchange":
      n.orderIds = [p.orderId as string];
      n.variantIds = (payload as CommandPayload<"order.exchange">).newLines.map((l) => l.variantId);
      break;
    case "customer.merge": {
      const m = payload as CommandPayload<"customer.merge">;
      n.customerIds = [m.keepId, ...m.mergeIds];
      n.ordersOfCustomers = true;
      break;
    }
    case "recurring.save":
    case "recurring.delete":
    case "recurring.run":
      n.recurring = true;
      break;
  }
  return n;
}

export async function loadWorkingSet(tx: Tx, businessId: string, type: CommandType, payload: unknown) {
  const [b] = await tx.select().from(businesses).where(eq(businesses.id, businessId)).for("update");
  if (!b) throw new Error("Business not found");
  const s = initialState();
  s.seeded = true;
  s.sync.mode = "account";
  businessToState(b, s);
  const needs = needsFor(type, payload);

  const [staff, cats, sups] = await Promise.all([loadStaff(tx), tx.select().from(categories), tx.select().from(suppliers)]);
  s.staff = staff;
  s.categories = cats.map((c) => ({ id: c.id, name: c.name, nameBn: c.nameBn }));
  s.suppliers = sups.map(toSupplier);

  s.locations = (await tx.select().from(locationsT)).map(toLocation);
  if (needs.recurring) s.recurring = (await tx.select().from(recurringT)).map(toRecurring);
  if (needs.purchaseOrders) {
    s.purchaseOrders = (await tx.select().from(poT)).map(toPO);
    if (type === "po.receive") needs.variantIds.push(...(s.purchaseOrders.find((x) => x.id === (payload as { id: string }).id)?.lines.map((l) => l.variantId) ?? []));
  }
  if (needs.quotes) {
    s.quotes = (await tx.select().from(quotesT)).map(toQuote);
    const q = type === "quote.convert" ? s.quotes.find((x) => x.id === (payload as { id: string }).id) : undefined;
    if (q) {
      needs.variantIds.push(...q.lines.map((l) => l.variantId));
      if (q.customer?.phone) needs.customerPhones.push(q.customer.phone);
    }
  }
  if (needs.ordersOfCustomers && needs.customerIds.length) {
    const rows = await tx.select({ id: orders.id }).from(orders).where(inArray(orders.customerId, needs.customerIds));
    needs.orderIds.push(...rows.map((r) => r.id));
  }

  s.orders = await loadOrders(tx, needs.orderIds);
  if (type === "order.exchange")
    for (const o of s.orders) {
      if (o.customerId) needs.customerIds.push(o.customerId);
      if (o.customer?.phone) needs.customerPhones.push(o.customer.phone);
    }
  const lineVariantIds = s.orders.flatMap((o) => o.lines.map((l) => l.variantId));
  const variantIds = [...new Set([...needs.variantIds, ...lineVariantIds])];
  let productIds = needs.productIds;
  if (productIds !== "all" && variantIds.length) {
    const rows = await tx.selectDistinct({ productId: variants.productId }).from(variants).where(inArray(variants.id, variantIds));
    productIds = [...new Set([...productIds, ...rows.map((r) => r.productId)])];
  }
  // Bundles mirror their components, so whenever stock is touched load every bundle and its parts.
  if (productIds !== "all" && productIds.length) {
    const bundleRows = await tx.select({ id: products.id, extra: products.extra }).from(products).where(sql`jsonb_array_length(coalesce(${products.extra}->'bundle', '[]'::jsonb)) > 0`);
    const compVariantIds = bundleRows.flatMap((r) => ((r.extra as { bundle?: { variantId: string }[] }).bundle ?? []).map((c) => c.variantId));
    const compProducts = compVariantIds.length ? await tx.selectDistinct({ productId: variants.productId }).from(variants).where(inArray(variants.id, compVariantIds)) : [];
    productIds = [...new Set([...productIds, ...bundleRows.map((r) => r.id), ...compProducts.map((r) => r.productId)])];
  }
  s.products = await loadProducts(tx, productIds);

  if (needs.customerIds.length || needs.customerPhones.length) {
    const conds = [needs.customerIds.length ? inArray(customers.id, needs.customerIds) : undefined, needs.customerPhones.length ? inArray(customers.phone, needs.customerPhones) : undefined].filter(Boolean);
    const rows = await tx.select().from(customers).where(conds.length === 2 ? sql`${conds[0]} or ${conds[1]}` : conds[0]!);
    s.customers = rows.map(toCustomer);
  } else s.customers = [];

  s.expenses = needs.expenseIds.length ? (await tx.select().from(expenses).where(inArray(expenses.id, needs.expenseIds))).map(toExpense) : [];
  s.notices = needs.unreadNotices ? (await tx.select().from(notices).where(eq(notices.read, false))).map(toNotice) : [];
  s.movements = [];
  s.purchases = [];
  return s;
}

/* ------------------------------------------------------------ persist */

const byId = <T extends { id: string }>(xs: T[]) => new Map(xs.map((x) => [x.id, x]));
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

async function storeImages(businessId: string, values: string[]) {
  return Promise.all(values.map((v) => (v.startsWith("data:") ? storeDataUrl(businessId, v) : v)));
}

export async function persistChanges(tx: Tx, businessId: string, before: AppState, after: AppState) {
  const now = new Date();
  const B = businessId;

  /* business row */
  const bPatch: Partial<BusinessRow> = {};
  if (!same(before.business, after.business)) {
    const { logo, ...rest } = after.business;
    Object.assign(bPatch, rest, { logo: logo?.startsWith("data:") ? await storeDataUrl(B, logo) : logo });
  }
  if (!same(before.theme, after.theme)) bPatch.theme = after.theme;
  if (!same(before.invoice, after.invoice)) bPatch.invoice = { ...after.invoice };
  if (!same(before.pos, after.pos)) bPatch.pos = { ...after.pos };
  if (before.monthlyGoal !== after.monthlyGoal) bPatch.monthlyGoal = after.monthlyGoal;
  if (before.nextOrderNo !== after.nextOrderNo) bPatch.nextOrderNo = after.nextOrderNo;
  if (before.nextInvoiceNo !== after.nextInvoiceNo) bPatch.nextInvoiceNo = after.nextInvoiceNo;
  if (before.nextPurchaseNo !== after.nextPurchaseNo) bPatch.nextPurchaseNo = after.nextPurchaseNo;
  if (Object.keys(bPatch).length) await tx.update(businesses).set({ ...bPatch, updatedAt: now }).where(eq(businesses.id, B));

  /* team */
  const staffBefore = byId(before.staff);
  for (const st of after.staff) {
    const old = staffBefore.get(st.id);
    if (!old) {
      // Invited by phone: find or create the user, then add a pending membership.
      const [u] = await tx.select({ id: users.id }).from(users).where(eq(users.phone, st.phone));
      let userId = u?.id;
      if (!userId) {
        userId = st.id;
        await tx.execute(sql`insert into users (id, phone, name) values (${userId}, ${st.phone}, ${st.name}) on conflict (phone) do nothing`);
      }
      await tx.insert(memberships).values({ businessId: B, userId, role: st.role, color: st.color, status: "invited" }).onConflictDoUpdate({ target: [memberships.businessId, memberships.userId], set: { role: st.role, status: "invited", updatedAt: now } });
    } else if (!same(old, st)) {
      await tx.update(memberships).set({ role: st.role, color: st.color, updatedAt: now }).where(and(eq(memberships.businessId, B), eq(memberships.userId, st.id)));
    }
  }
  for (const old of before.staff) if (!after.staff.some((x) => x.id === old.id)) await tx.update(memberships).set({ status: "removed", updatedAt: now }).where(and(eq(memberships.businessId, B), eq(memberships.userId, old.id)));

  /* categories */
  const catBefore = byId(before.categories);
  for (const c of after.categories) if (!same(catBefore.get(c.id), c)) await tx.insert(categories).values({ businessId: B, ...c, updatedAt: now }).onConflictDoUpdate({ target: [categories.businessId, categories.id], set: { name: c.name, nameBn: c.nameBn, updatedAt: now } });

  /* products & variants */
  const prodBefore = byId(before.products);
  for (const p of after.products) {
    const old = prodBefore.get(p.id);
    if (old && same(old, p)) continue;
    const { variants: vs, id, name, nameBn, categoryId, unit, description, images, art, optionTypes, status, tags, createdAt, ...extra } = p;
    const row = { businessId: B, id, name, nameBn: nameBn ?? null, categoryId, unit, description: description ?? null, images: await storeImages(B, images), art, optionTypes, status, tags, extra, createdAt: date(createdAt), updatedAt: now };
    await tx.insert(products).values(row).onConflictDoUpdate({ target: [products.businessId, products.id], set: { ...row, businessId: undefined, id: undefined } as never });
    const oldVs = byId(old?.variants ?? []);
    for (const [i, v] of vs.entries()) {
      if (same(oldVs.get(v.id), v) && old?.variants.findIndex((x) => x.id === v.id) === i) continue;
      const { id: vid, sku, barcode, options, price, cost, mrp, onHand, reserved, inTransit, damaged, lowStock, active, ...vextra } = v;
      const vrow = { businessId: B, id: vid, productId: id, position: i, sku, barcode: barcode ?? null, options, price, cost, mrp: mrp ?? null, onHand, reserved, inTransit, damaged, lowStock, active, extra: vextra, updatedAt: now };
      await tx.insert(variants).values(vrow).onConflictDoUpdate({ target: [variants.businessId, variants.id], set: { ...vrow, businessId: undefined, id: undefined } as never });
    }
    for (const ov of old?.variants ?? []) if (!vs.some((v) => v.id === ov.id)) await tx.delete(variants).where(eq(variants.id, ov.id));
  }
  for (const old of before.products)
    if (!after.products.some((p) => p.id === old.id)) {
      await tx.delete(variants).where(eq(variants.productId, old.id));
      await tx.delete(products).where(eq(products.id, old.id));
      await tx.insert(tombstones).values({ businessId: B, entity: "product", id: old.id }).onConflictDoNothing();
    }

  /* customers & suppliers */
  const custBefore = byId(before.customers);
  for (const c of after.customers) {
    if (same(custBefore.get(c.id), c)) continue;
    const { id: cid, name, phone, altPhone, address, channel, tags, notes, risky, fbLink, createdAt, ...cextra } = c;
    const row = { businessId: B, id: cid, name, phone, altPhone: altPhone ?? null, address, channel, tags, notes: notes ?? null, risky, fbLink: fbLink ?? null, extra: cextra, createdAt: date(createdAt), updatedAt: now };
    await tx.insert(customers).values(row).onConflictDoUpdate({ target: [customers.businessId, customers.id], set: { ...row, businessId: undefined, id: undefined, createdAt: undefined } as never });
  }
  for (const old of before.customers)
    if (!after.customers.some((c) => c.id === old.id)) {
      await tx.delete(customers).where(eq(customers.id, old.id));
      await tx.insert(tombstones).values({ businessId: B, entity: "customer", id: old.id }).onConflictDoNothing();
    }
  const supBefore = byId(before.suppliers);
  for (const sp of after.suppliers) {
    if (same(supBefore.get(sp.id), sp)) continue;
    const row = { businessId: B, id: sp.id, name: sp.name, phone: sp.phone, address: sp.address ?? null, balance: sp.balance, updatedAt: now };
    await tx.insert(suppliers).values(row).onConflictDoUpdate({ target: [suppliers.businessId, suppliers.id], set: { ...row, businessId: undefined, id: undefined } as never });
  }

  /* orders */
  const ordBefore = byId(before.orders);
  for (const o of after.orders) {
    const old = ordBefore.get(o.id);
    if (old && same(old, o)) continue;
    const { lines, payments: ps, events: es, id, no, invoiceNo, channel, customerId, customer, discount, deliveryCharge, otherCharges, settlement, status, courier, codReceived, notesInternal, notesInvoice, returns, createdAt, createdBy, ...extra } = o;
    const row = {
      businessId: B,
      id,
      no,
      invoiceNo: invoiceNo ?? null,
      channel,
      customerId: customerId ?? null,
      customer: (customer as Record<string, unknown> | null) ?? null,
      discount,
      deliveryCharge,
      otherCharges,
      settlement,
      status,
      courier: (courier as unknown as Record<string, unknown>) ?? null,
      codReceived: codReceived ?? null,
      notesInternal: notesInternal ?? null,
      notesInvoice: notesInvoice ?? null,
      returns,
      extra,
      total: orderTotals(o).total,
      createdAt: date(createdAt),
      createdBy,
      updatedAt: now,
    };
    await tx.insert(orders).values(row).onConflictDoUpdate({ target: [orders.businessId, orders.id], set: { ...row, businessId: undefined, id: undefined, createdAt: undefined } as never });
    const oldLines = byId(old?.lines ?? []);
    for (const [i, l] of lines.entries()) {
      if (same(oldLines.get(l.id), l)) continue;
      const lrow = { businessId: B, orderId: id, position: i, ...l };
      await tx.insert(orderLines).values(lrow).onConflictDoUpdate({ target: [orderLines.businessId, orderLines.id], set: { ...lrow, businessId: undefined, id: undefined } as never });
    }
    for (const ol of old?.lines ?? []) if (!lines.some((l) => l.id === ol.id)) await tx.delete(orderLines).where(eq(orderLines.id, ol.id));
    const oldPays = new Set(old?.payments.map((p) => p.id));
    const newPays = ps.filter((p) => !oldPays.has(p.id));
    if (newPays.length) await tx.insert(payments).values(newPays.map((p) => ({ businessId: B, orderId: id, id: p.id, method: p.method, amount: p.amount, txnId: p.txnId ?? null, kind: p.kind, byName: p.by, at: date(p.at) }))).onConflictDoNothing();
    const oldEvents = new Set(old?.events.map((e) => e.id));
    const newEvents = es.filter((e) => !oldEvents.has(e.id));
    if (newEvents.length) await tx.insert(orderEvents).values(newEvents.map((e) => ({ businessId: B, orderId: id, id: e.id, type: e.type, fromStatus: e.from ?? null, toStatus: e.to ?? null, note: e.note ?? null, byName: e.by, at: date(e.at) }))).onConflictDoNothing();
  }
  for (const old of before.orders)
    if (!after.orders.some((o) => o.id === old.id)) {
      await tx.delete(orderLines).where(eq(orderLines.orderId, old.id));
      await tx.delete(payments).where(eq(payments.orderId, old.id));
      await tx.delete(orderEvents).where(eq(orderEvents.orderId, old.id));
      await tx.delete(orders).where(eq(orders.id, old.id));
      await tx.insert(tombstones).values({ businessId: B, entity: "order", id: old.id }).onConflictDoNothing();
    }

  /* append-only and simple collections */
  const movIds = new Set(before.movements.map((m) => m.id));
  const newMoves = after.movements.filter((m) => !movIds.has(m.id));
  if (newMoves.length) await tx.insert(stockMovements).values(newMoves.map((m) => ({ businessId: B, id: m.id, productId: m.productId, variantId: m.variantId, delta: m.delta, reason: m.reason, refLabel: m.refLabel ?? null, refId: m.refId ?? null, balance: m.balance, byName: m.by, at: date(m.at), note: m.note ?? null, updatedAt: now }))).onConflictDoNothing();

  const purIds = new Set(before.purchases.map((p) => p.id));
  const newPurs = after.purchases.filter((p) => !purIds.has(p.id));
  if (newPurs.length) await tx.insert(purchases).values(newPurs.map((p) => ({ businessId: B, id: p.id, ref: p.ref, supplierId: p.supplierId ?? null, date: date(p.date), lines: p.lines, total: p.total, paid: p.paid, note: p.note ?? null, updatedAt: now }))).onConflictDoNothing();

  const expBefore = byId(before.expenses);
  for (const e of after.expenses) {
    if (same(expBefore.get(e.id), e)) continue;
    const row = { businessId: B, id: e.id, category: e.category, amount: e.amount, date: date(e.date), method: e.method, note: e.note ?? null, refOrderId: e.refOrderId ?? null, updatedAt: now };
    await tx.insert(expenses).values(row).onConflictDoUpdate({ target: [expenses.businessId, expenses.id], set: { ...row, businessId: undefined, id: undefined } as never });
  }
  for (const old of before.expenses)
    if (!after.expenses.some((e) => e.id === old.id)) {
      await tx.delete(expenses).where(eq(expenses.id, old.id));
      await tx.insert(tombstones).values({ businessId: B, entity: "expense", id: old.id }).onConflictDoNothing();
    }

  /* locations, purchase orders, quotations, recurring templates */
  let docsChanged = false;
  const locBefore = byId(before.locations);
  for (const l of after.locations) {
    if (same(locBefore.get(l.id), l)) continue;
    docsChanged = true;
    const row = { businessId: B, id: l.id, name: l.name, nameBn: l.nameBn, isDefault: l.isDefault, active: l.active, updatedAt: now };
    await tx.insert(locationsT).values(row).onConflictDoUpdate({ target: [locationsT.businessId, locationsT.id], set: { ...row, businessId: undefined, id: undefined } as never });
  }
  for (const old of before.locations)
    if (!after.locations.some((l) => l.id === old.id)) {
      docsChanged = true;
      await tx.delete(locationsT).where(eq(locationsT.id, old.id));
    }
  const poBefore = byId(before.purchaseOrders);
  for (const po of after.purchaseOrders) {
    if (same(poBefore.get(po.id), po)) continue;
    docsChanged = true;
    const row = { businessId: B, id: po.id, no: po.no, supplierId: po.supplierId ?? null, status: po.status, lines: po.lines, expectedAt: po.expectedAt ? date(po.expectedAt) : null, locationId: po.locationId ?? null, note: po.note ?? null, history: po.history, createdBy: po.createdBy, createdAt: date(po.createdAt), updatedAt: now };
    await tx.insert(poT).values(row).onConflictDoUpdate({ target: [poT.businessId, poT.id], set: { ...row, businessId: undefined, id: undefined } as never });
  }
  const qBefore = byId(before.quotes);
  for (const q of after.quotes) {
    if (same(qBefore.get(q.id), q)) continue;
    docsChanged = true;
    const row = { businessId: B, id: q.id, no: q.no, status: q.status, customer: (q.customer as Record<string, unknown> | null) ?? null, channel: q.channel, lines: q.lines, discount: q.discount, deliveryCharge: q.deliveryCharge, validUntil: q.validUntil, notes: q.notes ?? null, orderId: q.orderId ?? null, createdBy: q.createdBy, createdAt: date(q.createdAt), updatedAt: now };
    await tx.insert(quotesT).values(row).onConflictDoUpdate({ target: [quotesT.businessId, quotesT.id], set: { ...row, businessId: undefined, id: undefined } as never });
  }
  const recBefore = byId(before.recurring);
  for (const r of after.recurring) {
    if (same(recBefore.get(r.id), r)) continue;
    docsChanged = true;
    const row = { businessId: B, id: r.id, category: r.category, amount: r.amount, method: r.method, note: r.note ?? null, dayOfMonth: r.dayOfMonth, lastRun: r.lastRun ?? null, active: r.active, updatedAt: now };
    await tx.insert(recurringT).values(row).onConflictDoUpdate({ target: [recurringT.businessId, recurringT.id], set: { ...row, businessId: undefined, id: undefined } as never });
  }
  for (const old of before.recurring)
    if (!after.recurring.some((r) => r.id === old.id)) {
      docsChanged = true;
      await tx.delete(recurringT).where(eq(recurringT.id, old.id));
    }
  // These small lists travel with the business record on pull, so mark it changed.
  if (docsChanged && !Object.keys(bPatch).length) await tx.update(businesses).set({ updatedAt: now }).where(eq(businesses.id, B));

  const notBefore = byId(before.notices);
  for (const n of after.notices) {
    if (same(notBefore.get(n.id), n)) continue;
    const row = { businessId: B, id: n.id, kind: n.kind, title: n.title, body: n.body ?? null, href: n.href ?? null, read: n.read, at: date(n.at), updatedAt: now };
    await tx.insert(notices).values(row).onConflictDoUpdate({ target: [notices.businessId, notices.id], set: { read: n.read, updatedAt: now } });
  }
}

/* ------------------------------------------------------------ snapshot (pull) */

export type Snapshot = {
  cursor: string;
  full: boolean;
  business?: Pick<AppState, "business" | "theme" | "invoice" | "pos" | "monthlyGoal" | "plan" | "nextOrderNo" | "nextInvoiceNo" | "nextPurchaseNo"> &
    Partial<Pick<AppState, "locations" | "purchaseOrders" | "quotes" | "recurring">>;
  staff?: Staff[];
  categories?: AppState["categories"];
  products: Product[];
  customers: Customer[];
  orders: Order[];
  movements: StockMovement[];
  suppliers: Supplier[];
  purchases: Purchase[];
  expenses: Expense[];
  notices: Notice[];
  deleted: { entity: string; id: string }[];
};

/** Everything changed since `since` (or everything), as the device sees it. */
export async function snapshot(tx: Tx, businessId: string, role: Role, since?: Date): Promise<Snapshot> {
  // Overlap a little so a write committing during the pull isn't missed; merging is idempotent.
  const cursor = new Date(Date.now() - 5000).toISOString();
  const after = <T extends { updatedAt: unknown }>(col: T["updatedAt"]) => (since ? gt(col as never, since) : undefined);

  const [b] = await tx.select().from(businesses).where(eq(businesses.id, businessId));
  const s = initialState();
  businessToState(b, s);
  const businessChanged = !since || b.updatedAt > since;

  const changedProducts = await tx.select({ id: products.id }).from(products).where(after(products.updatedAt));
  const changedVariantProducts = since ? await tx.selectDistinct({ id: variants.productId }).from(variants).where(gt(variants.updatedAt, since)) : [];
  const productIds = [...new Set([...changedProducts, ...changedVariantProducts].map((r) => r.id))];
  const orderRows = await tx.select({ id: orders.id }).from(orders).where(after(orders.updatedAt));

  const [prods, ords, custs, moves, sups, purs, exps, nots, cats, staff, dels] = await Promise.all([
    loadProducts(tx, productIds),
    loadOrders(tx, orderRows.map((r) => r.id)),
    tx.select().from(customers).where(after(customers.updatedAt)),
    tx.select().from(stockMovements).where(after(stockMovements.updatedAt)),
    tx.select().from(suppliers).where(after(suppliers.updatedAt)),
    tx.select().from(purchases).where(after(purchases.updatedAt)),
    tx.select().from(expenses).where(after(expenses.updatedAt)),
    tx.select().from(notices).where(after(notices.updatedAt)),
    tx.select().from(categories),
    loadStaff(tx),
    since ? tx.select().from(tombstones).where(gt(tombstones.deletedAt, since)) : Promise.resolve([]),
  ]);

  const viewCost = can(role, "view_cost");
  const strip = viewCost
    ? <T,>(x: T) => x
    : <T,>(x: T): T => {
        // Roles without cost access never receive buying prices (AC-5).
        const c = structuredClone(x) as Record<string, unknown>;
        if (Array.isArray(c.variants)) c.variants = (c.variants as Variant[]).map((v) => ({ ...v, cost: 0 }));
        if (Array.isArray(c.lines)) c.lines = (c.lines as { cost?: number }[]).map((l) => ({ ...l, cost: 0, unitCost: undefined }));
        return c as T;
      };

  return {
    cursor,
    full: !since,
    business: businessChanged
      ? {
          business: s.business,
          theme: s.theme,
          invoice: s.invoice,
          pos: s.pos,
          monthlyGoal: s.monthlyGoal,
          plan: s.plan,
          nextOrderNo: s.nextOrderNo,
          nextInvoiceNo: s.nextInvoiceNo,
          nextPurchaseNo: s.nextPurchaseNo,
          ...(await docLists(tx, viewCost)),
        }
      : undefined,
    staff,
    categories: cats.map((c) => ({ id: c.id, name: c.name, nameBn: c.nameBn })),
    products: prods.map(strip),
    customers: custs.map(toCustomer),
    orders: ords.map(strip),
    movements: moves.map(toMovement),
    suppliers: viewCost ? sups.map(toSupplier) : [],
    purchases: viewCost ? purs.map(toPurchase) : [],
    expenses: viewCost ? exps.map(toExpense) : [],
    notices: nots.map(toNotice),
    deleted: dels.map((d) => ({ entity: d.entity, id: d.id })),
  };
}

/** Small per-business lists that sync whole, alongside the business record. */
async function docLists(tx: Tx, viewCost: boolean) {
  const [locs, pos, qs, rec] = await Promise.all([tx.select().from(locationsT), tx.select().from(poT), tx.select().from(quotesT), tx.select().from(recurringT)]);
  return {
    locations: locs.map(toLocation),
    purchaseOrders: pos.map(toPO).map((p) => (viewCost ? p : { ...p, lines: p.lines.map((l) => ({ ...l, unitCost: 0 })) })),
    quotes: qs.map(toQuote),
    recurring: viewCost ? rec.map(toRecurring) : [],
  };
}
