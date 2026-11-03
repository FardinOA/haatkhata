/**
 * Inventory & documents through the server path: locations and transfers,
 * purchase orders (WAC), bundles, FEFO batches, quotations, exchanges,
 * customer merge and recurring expenses — plus device/server parity.
 */
import { randomBytes } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { produce } from "immer";
import { beforeEach, describe, expect, it } from "vitest";
import { COMMANDS, makeCtx, type CommandPayload, type CommandType } from "@/lib/commands";
import type { AppState } from "@/lib/state";
import type { Product, Role } from "@/lib/types";
import { applyCommand } from "./apply";
import { createBusiness } from "./business";
import { db, schema, withTenant } from "./db";
import { loadWorkingSet, snapshot } from "./state-io";

const uid = () => randomBytes(8).toString("hex");
type Who = { businessId: string; userId: string; userName: string; role: Role };

function cmd<T extends CommandType>(type: T, payload: CommandPayload<T>) {
  return { id: `c${uid()}`, type, payload, at: new Date().toISOString() };
}

async function ok<T extends CommandType>(who: Who, type: T, payload: CommandPayload<T>) {
  const r = await applyCommand(who, cmd(type, payload));
  expect(r).toMatchObject({ status: "applied" });
  return r.result;
}

const product = (id: string, sku: string, opts: Partial<Product> = {}): Product => ({
  id,
  name: id,
  categoryId: "cat_acc",
  unit: "pcs",
  images: [],
  art: { hue: "#0E6B53", pattern: "plain" },
  optionTypes: [],
  variants: [{ id: `v_${id}`, sku, options: {}, price: 500, cost: 250, onHand: 0, reserved: 0, inTransit: 0, damaged: 0, lowStock: 2, active: true }],
  status: "active",
  tags: [],
  createdAt: new Date().toISOString(),
  ...opts,
});

let shop: Who;

beforeEach(async () => {
  const userId = `u_${uid()}`;
  await db.insert(schema.users).values({ id: userId, phone: `018${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`, name: "Owner" });
  const businessId = await createBusiness(userId, { name: "Inv Shop", ownerName: "Owner", type: "both", channels: ["facebook"], sample: false });
  shop = { businessId, userId, userName: "Owner", role: "owner" };
});

const snap = () => withTenant(shop.businessId, (tx) => snapshot(tx, shop.businessId, "owner"));
const variantOf = async (id: string) => (await snap()).products.flatMap((p) => p.variants).find((v) => v.id === id)!;
const ledgerSum = async (variantId: string) => {
  const [{ s }] = await withTenant(shop.businessId, (tx) => tx.select({ s: sql<number>`coalesce(sum(delta),0)::int` }).from(schema.stockMovements).where(eq(schema.stockMovements.variantId, variantId)));
  return s;
};

const order = (lines: { variantId: string; productId: string; qty: number }[]) => ({
  channel: "facebook" as const,
  customer: { name: "Rina", phone: "01711000001", address: { line: "x", area: "Mirpur", district: "Dhaka" } },
  lines: lines.map((l, i) => ({ key: `k${i}`, ...l, price: 500, discount: 0 })),
  discount: { type: "flat" as const, value: 0 },
  deliveryCharge: 70,
  otherCharges: 0,
  payments: [],
  settlement: "cod" as const,
});

describe("locations & transfers (FR-STK-10)", () => {
  it("moves units between locations without changing the total; the ledger still balances", async () => {
    await ok(shop, "product.save", { product: product("tee", "TEE-1"), opening: { v_tee: 10 } });
    const shopLoc = (await ok(shop, "location.save", { location: { name: "Shop" } })) as string;
    const wh = (await ok(shop, "location.save", { location: { name: "Warehouse" } })) as string;
    await ok(shop, "stock.transfer", { from: shopLoc, to: wh, lines: [{ variantId: "v_tee", qty: 4 }] });
    const v = await variantOf("v_tee");
    expect(v.onHand).toBe(10);
    expect(v.stockByLocation).toEqual({ [shopLoc]: 6, [wh]: 4 });
    expect(await ledgerSum("v_tee")).toBe(10);
    expect(await applyCommand(shop, cmd("stock.transfer", { from: wh, to: shopLoc, lines: [{ variantId: "v_tee", qty: 9 }] }))).toMatchObject({ status: "rejected", code: "conflict" });
  });

  it("ships from the order's location and counts at a location", async () => {
    await ok(shop, "product.save", { product: product("tee", "TEE-1"), opening: { v_tee: 10 } });
    const shopLoc = (await ok(shop, "location.save", { location: { name: "Shop" } })) as string;
    const wh = (await ok(shop, "location.save", { location: { name: "Warehouse" } })) as string;
    await ok(shop, "stock.transfer", { from: shopLoc, to: wh, lines: [{ variantId: "v_tee", qty: 3 }] });
    const o = (await ok(shop, "order.create", { input: order([{ variantId: "v_tee", productId: "tee", qty: 2 }]), mode: "confirm" })) as { id: string };
    await ok(shop, "order.transition", { orderId: o.id, to: "shipped" });
    expect((await variantOf("v_tee")).stockByLocation).toEqual({ [shopLoc]: 5, [wh]: 3 });
    await ok(shop, "stock.adjust", { variantId: "v_tee", newOnHand: 1, reason: "adjust", locationId: wh, note: "Count" });
    const v = await variantOf("v_tee");
    expect(v).toMatchObject({ onHand: 6, stockByLocation: { [shopLoc]: 5, [wh]: 1 } });
    expect(await ledgerSum("v_tee")).toBe(6);
  });
});

describe("purchase orders (FR-STK-11)", () => {
  it("receiving updates weighted average cost, status and the supplier balance", async () => {
    await ok(shop, "product.save", { product: product("tee", "TEE-1"), opening: { v_tee: 10 } });
    const sup = (await ok(shop, "supplier.add", { name: "Tangail", phone: "01700000000" })) as string;
    const po = (await ok(shop, "po.save", { po: { supplierId: sup, lines: [{ variantId: "v_tee", productId: "tee", qty: 10, received: 0, unitCost: 350 }] } })) as string;
    await ok(shop, "po.status", { id: po, status: "ordered" });
    await ok(shop, "po.receive", { id: po, lines: [{ variantId: "v_tee", qty: 6 }], paid: 0 });
    expect(await variantOf("v_tee")).toMatchObject({ onHand: 16, cost: 287.5 });
    let s = await snap();
    expect(s.business?.purchaseOrders?.[0]).toMatchObject({ no: "PO-0001", status: "partial" });
    await ok(shop, "po.receive", { id: po, lines: [{ variantId: "v_tee", qty: 4 }], paid: 1000 });
    s = await snap();
    expect(s.business?.purchaseOrders?.[0].status).toBe("received");
    expect(s.suppliers.find((x) => x.id === sup)?.balance).toBe(3500 - 1000);
    expect(await ledgerSum("v_tee")).toBe(20);
  });
});

describe("bundles (FR-PRD-09)", () => {
  it("selling a bundle reserves and ships its components", async () => {
    await ok(shop, "product.save", { product: product("orna", "ORN-1"), opening: { v_orna: 10 } });
    await ok(shop, "product.save", { product: product("jhumka", "JHM-1"), opening: { v_jhumka: 10 } });
    await ok(shop, "product.save", { product: product("combo", "CMB-1", { bundle: [{ variantId: "v_orna", qty: 1 }, { variantId: "v_jhumka", qty: 2 }] }) });
    expect((await variantOf("v_combo")).onHand).toBe(5);
    const o = (await ok(shop, "order.create", { input: order([{ variantId: "v_combo", productId: "combo", qty: 2 }]), mode: "confirm" })) as { id: string; lines: { cost: number }[] };
    expect(o.lines[0].cost).toBe(250 + 2 * 250);
    expect(await variantOf("v_orna")).toMatchObject({ reserved: 2 });
    expect(await variantOf("v_jhumka")).toMatchObject({ reserved: 4 });
    expect((await variantOf("v_combo")).onHand).toBe(3);
    await ok(shop, "order.transition", { orderId: o.id, to: "shipped" });
    expect(await variantOf("v_orna")).toMatchObject({ onHand: 8, reserved: 0, inTransit: 2 });
    expect(await variantOf("v_jhumka")).toMatchObject({ onHand: 6, inTransit: 4 });
    expect(await ledgerSum("v_jhumka")).toBe(6);
    expect(await applyCommand(shop, cmd("stock.adjust", { variantId: "v_combo", newOnHand: 9, reason: "adjust" }))).toMatchObject({ status: "rejected" });
  });
});

describe("batches (FR-STK-12)", () => {
  it("sells the earliest expiry first", async () => {
    await ok(shop, "product.save", { product: product("cream", "CRM-1", { trackBatches: true }) });
    await ok(shop, "stock.in", { lines: [{ variantId: "v_cream", productId: "cream", qty: 5, unitCost: 100, batch: { code: "LATE", expiry: "2027-06-30" } }], paid: 0 });
    await ok(shop, "stock.in", { lines: [{ variantId: "v_cream", productId: "cream", qty: 4, unitCost: 100, batch: { code: "SOON", expiry: "2026-12-01" } }], paid: 0 });
    const walkIn = { ...order([{ variantId: "v_cream", productId: "cream", qty: 6 }]), channel: "walkin" as const, customer: null, deliveryCharge: 0, settlement: "due" as const };
    await ok(shop, "order.create", { input: walkIn, mode: "complete" });
    const v = await variantOf("v_cream");
    expect(v.onHand).toBe(3);
    expect(v.batches?.map((b) => [b.code, b.qty])).toEqual([["LATE", 3]]);
  });
});

describe("quotations, exchanges, merges, recurring", () => {
  it("converts a quotation into an order once", async () => {
    await ok(shop, "product.save", { product: product("tee", "TEE-1"), opening: { v_tee: 10 } });
    const q = (await ok(shop, "quote.save", { quote: { customer: { name: "Wholesale", phone: "01811000000" }, channel: "whatsapp", lines: [{ productId: "tee", variantId: "v_tee", name: "tee", variantLabel: "", qty: 3, price: 450, discount: 0 }], discount: { type: "flat", value: 0 }, deliveryCharge: 0, validUntil: "2026-12-31" } })) as string;
    const o = (await ok(shop, "quote.convert", { id: q, mode: "confirm" })) as { quoteId: string; status: string };
    expect(o).toMatchObject({ quoteId: q, status: "confirmed" });
    expect((await variantOf("v_tee")).reserved).toBe(3);
    expect(await applyCommand(shop, cmd("quote.convert", { id: q, mode: "confirm" }))).toMatchObject({ status: "rejected", code: "conflict" });
  });

  it("exchanges: returns item A, sends item B as a linked order", async () => {
    await ok(shop, "product.save", { product: product("a", "A-1"), opening: { v_a: 5 } });
    await ok(shop, "product.save", { product: product("b", "B-1"), opening: { v_b: 5 } });
    const o = (await ok(shop, "order.create", { input: order([{ variantId: "v_a", productId: "a", qty: 1 }]), mode: "confirm" })) as { id: string; lines: { id: string }[] };
    await ok(shop, "order.transition", { orderId: o.id, to: "shipped" });
    await ok(shop, "order.transition", { orderId: o.id, to: "delivered" });
    const next = (await ok(shop, "order.exchange", { orderId: o.id, returnLines: [{ lineId: o.lines[0].id, qty: 1, condition: "restock" }], fee: 60, newLines: [{ key: "x", productId: "b", variantId: "v_b", qty: 1, price: 500, discount: 0 }], deliveryCharge: 70, mode: "confirm" })) as { id: string; exchangeOf: string };
    expect(next.exchangeOf).toBe(o.id);
    const s = await snap();
    expect(s.orders.find((x) => x.id === o.id)).toMatchObject({ status: "returned", exchangedTo: next.id });
    expect(await variantOf("v_a")).toMatchObject({ onHand: 5 });
    expect(await variantOf("v_b")).toMatchObject({ reserved: 1 });
  });

  it("merges duplicate customers and re-points their orders", async () => {
    await ok(shop, "product.save", { product: product("tee", "TEE-1"), opening: { v_tee: 10 } });
    const a = (await ok(shop, "customer.upsert", { name: "Ayesha", phone: "01711111111", tags: ["regular"] })) as string;
    const b = (await ok(shop, "customer.upsert", { name: "Ayesha R.", phone: "01722222222", tags: ["wholesale"] })) as string;
    const o = (await ok(shop, "order.create", { input: { ...order([{ variantId: "v_tee", productId: "tee", qty: 1 }]), customer: { id: b, name: "Ayesha R.", phone: "01722222222" } }, mode: "confirm" })) as { id: string };
    await ok(shop, "customer.merge", { keepId: a, mergeIds: [b] });
    const s = await snap();
    expect(s.customers.map((c) => c.id)).toEqual([a]);
    expect(s.customers[0]).toMatchObject({ altPhone: "01722222222", tags: ["regular", "wholesale"] });
    expect(s.orders.find((x) => x.id === o.id)?.customerId).toBe(a);
    const later = await withTenant(shop.businessId, (tx) => snapshot(tx, shop.businessId, "owner", new Date(Date.now() - 60_000)));
    expect(later.deleted).toContainEqual({ entity: "customer", id: b });
  });

  it("creates each month's recurring expense exactly once", async () => {
    const id = (await ok(shop, "recurring.save", { template: { category: "rent", amount: 15000, method: "bank", dayOfMonth: 1, active: true } })) as string;
    // Pretend it last ran long ago, then run twice from two devices.
    await withTenant(shop.businessId, async (tx) => {
      const { recurringExpenses } = await import("./db/schema-inventory");
      await tx.update(recurringExpenses).set({ lastRun: "2020-01" }).where(eq(recurringExpenses.id, id));
    });
    const today = new Date().toISOString().slice(0, 10);
    await ok(shop, "recurring.run", { today });
    await ok(shop, "recurring.run", { today });
    const rows = await withTenant(shop.businessId, (tx) => tx.select().from(schema.expenses).where(eq(schema.expenses.category, "rent")));
    expect(rows).toHaveLength(1);
  });
});

describe("device and server agree on the new commands", () => {
  it("stock.transfer, quote.convert and po.receive produce identical records", async () => {
    await ok(shop, "product.save", { product: product("tee", "TEE-1"), opening: { v_tee: 10 } });
    const shopLoc = (await ok(shop, "location.save", { location: { name: "Shop" } })) as string;
    const wh = (await ok(shop, "location.save", { location: { name: "Warehouse" } })) as string;
    const q = (await ok(shop, "quote.save", { quote: { customer: { name: "Q", phone: "01811000009" }, channel: "facebook", lines: [{ productId: "tee", variantId: "v_tee", name: "tee", variantLabel: "", qty: 2, price: 500, discount: 0 }], discount: { type: "flat", value: 0 }, deliveryCharge: 70, validUntil: "2026-12-31" } })) as string;
    const po = (await ok(shop, "po.save", { po: { lines: [{ variantId: "v_tee", productId: "tee", qty: 5, received: 0, unitCost: 300 }] } })) as string;
    const cases = [cmd("stock.transfer", { from: shopLoc, to: wh, lines: [{ variantId: "v_tee", qty: 2 }] }), cmd("quote.convert", { id: q, mode: "confirm" }), cmd("po.receive", { id: po, lines: [{ variantId: "v_tee", qty: 5 }], paid: 0, locationId: wh })];
    for (const c of cases) {
      const base = await withTenant(shop.businessId, (tx) => loadWorkingSet(tx, shop.businessId, c.type, c.payload));
      const device = produce(base, (d) => void (COMMANDS[c.type] as (s: AppState, p: unknown, ctx: ReturnType<typeof makeCtx>) => unknown)(d as AppState, c.payload, makeCtx(c.id, c.at, { id: shop.userId, name: shop.userName, role: "owner" })));
      expect(await applyCommand(shop, c)).toMatchObject({ status: "applied" });
      const server = await snap();
      expect(server.products.find((p) => p.id === "tee")).toEqual(device.products.find((p) => p.id === "tee"));
      const devMoves = device.movements.map((m) => m.id).sort();
      const srvMoves = server.movements.filter((m) => devMoves.includes(m.id)).map((m) => m.id).sort();
      expect(srvMoves).toEqual(devMoves);
    }
  });
});
