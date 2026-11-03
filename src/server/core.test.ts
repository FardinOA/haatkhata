/**
 * Server integration tests against a real Postgres (see test/global-setup.ts).
 * Covers tenant isolation, idempotency, the SRS acceptance criteria through
 * the server path, role enforcement and device/server determinism.
 */
import { randomBytes } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { produce } from "immer";
import { beforeAll, describe, expect, it } from "vitest";
import { COMMANDS, makeCtx, type CommandPayload, type CommandType } from "@/lib/commands";
import type { AppState } from "@/lib/state";
import type { Role } from "@/lib/types";
import { applyCommand } from "./apply";
import { createBusiness } from "./business";
import { db, schema, withTenant } from "./db";
import { loadWorkingSet, snapshot } from "./state-io";

const uid = () => randomBytes(8).toString("hex");

async function makeUser(name = "Owner") {
  const id = `u_${uid()}`;
  await db.insert(schema.users).values({ id, phone: `017${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`, name });
  return id;
}

function cmd<T extends CommandType>(type: T, payload: CommandPayload<T>) {
  return { id: `c${uid()}`, type, payload, at: new Date().toISOString() };
}

type Who = { businessId: string; userId: string; userName: string; role: Role };

async function freshShop(opts: { sample?: boolean } = {}) {
  const userId = await makeUser();
  const businessId = await createBusiness(userId, { name: "Test Shop", ownerName: "Owner", type: "online", channels: ["facebook"], sample: opts.sample ?? false });
  const owner: Who = { businessId, userId, userName: "Owner", role: "owner" };
  // One product with a single variant, 10 on hand (AC-1 starting point).
  const r = await applyCommand(
    owner,
    cmd("product.save", {
      product: {
        id: "p_tee",
        name: "Tee",
        categoryId: "cat_kurti",
        unit: "pcs",
        images: [],
        art: { hue: "#C2306B", pattern: "plain" },
        optionTypes: [],
        variants: [{ id: "v_tee", sku: "TEE-RED-L", options: {}, price: 500, cost: 250, onHand: 0, reserved: 0, inTransit: 0, damaged: 0, lowStock: 2, active: true }],
        status: "active",
        tags: [],
        createdAt: new Date().toISOString(),
      },
      opening: { v_tee: 10 },
    }),
  );
  expect(r).toMatchObject({ status: "applied" });
  return owner;
}

const variant = (businessId: string) => withTenant(businessId, async (tx) => (await tx.select().from(schema.variants).where(eq(schema.variants.id, "v_tee")))[0]);

const orderInput = (qty: number) => ({
  channel: "facebook" as const,
  customer: { name: "Ayesha", phone: "01711000000", address: { line: "Road 1", area: "Mirpur", district: "Dhaka" } },
  lines: [{ key: "k", productId: "p_tee", variantId: "v_tee", qty, price: 500, discount: 0 }],
  discount: { type: "flat" as const, value: 0 },
  deliveryCharge: 70,
  otherCharges: 0,
  payments: [],
  settlement: "cod" as const,
});

describe("tenant isolation (NFR-SEC-01)", () => {
  let a: Who, b: Who;
  beforeAll(async () => {
    a = await freshShop();
    b = await freshShop();
  });

  it("a business only ever sees its own rows", async () => {
    const seen = await withTenant(a.businessId, (tx) => tx.select({ b: schema.variants.businessId }).from(schema.variants));
    expect(seen.length).toBeGreaterThan(0);
    expect(new Set(seen.map((r) => r.b))).toEqual(new Set([a.businessId]));
  });

  it("writing another business's rows is blocked by row-level security", async () => {
    await expect(
      withTenant(a.businessId, (tx) => tx.insert(schema.expenses).values({ businessId: b.businessId, id: "x_evil", category: "other", amount: 1, date: new Date(), method: "cash" })),
    ).rejects.toSatisfy((e: Error & { cause?: Error }) => /row-level security/.test(e.cause?.message ?? e.message));
  });

  it("updates can't reach across tenants", async () => {
    await withTenant(a.businessId, (tx) => tx.update(schema.variants).set({ onHand: 999 }).where(sql`business_id = ${b.businessId}`));
    expect((await variant(b.businessId)).onHand).toBe(10);
  });
});

describe("stock lifecycle through the server (SRS §8)", () => {
  it("AC-1 + AC-2: reserve, ship, then return with restock/damage and a fee", async () => {
    const owner = await freshShop();
    const created = await applyCommand(owner, cmd("order.create", { input: orderInput(3), mode: "confirm" }));
    expect(created.status).toBe("applied");
    const order = created.result as { id: string; invoiceNo: string; lines: { id: string }[] };
    expect(order.invoiceNo).toMatch(/^INV-\d{4}-000001$/);
    expect(await variant(owner.businessId)).toMatchObject({ onHand: 10, reserved: 3 });

    expect((await applyCommand(owner, cmd("order.transition", { orderId: order.id, to: "shipped", courier: { name: "Steadfast" } }))).status).toBe("applied");
    expect(await variant(owner.businessId)).toMatchObject({ onHand: 7, reserved: 0, inTransit: 3 });

    const ret = await applyCommand(owner, cmd("order.return", { orderId: order.id, lines: [{ lineId: order.lines[0].id, qty: 2, condition: "restock" }, { lineId: order.lines[0].id, qty: 1, condition: "damaged" }], fee: 60, refund: 0 }));
    expect(ret.status).toBe("applied");
    expect(await variant(owner.businessId)).toMatchObject({ onHand: 9, damaged: 1, inTransit: 0 });
    const fees = await withTenant(owner.businessId, (tx) => tx.select().from(schema.expenses).where(eq(schema.expenses.category, "return_fee")));
    expect(fees.map((f) => f.amount)).toEqual([60]);

    // Ledger integrity: on-hand equals the sum of movements.
    const [{ sum }] = await withTenant(owner.businessId, (tx) => tx.select({ sum: sql<number>`sum(delta)::int` }).from(schema.stockMovements).where(eq(schema.stockMovements.variantId, "v_tee")));
    expect(sum).toBe(9);
  });

  it("is idempotent: a retried command never double-deducts (NFR-REL-04)", async () => {
    const owner = await freshShop();
    const c = cmd("order.create", { input: orderInput(2), mode: "confirm" });
    expect((await applyCommand(owner, c)).status).toBe("applied");
    expect((await applyCommand(owner, c)).status).toBe("duplicate");
    expect((await variant(owner.businessId)).reserved).toBe(2);
    const n = await withTenant(owner.businessId, (tx) => tx.select().from(schema.orders));
    expect(n).toHaveLength(1);
  });

  it("flags an oversold offline order for review instead of dropping it (NFR-REL-03)", async () => {
    const owner = await freshShop();
    expect((await applyCommand(owner, cmd("order.create", { input: orderInput(12), mode: "confirm" }))).status).toBe("applied");
    const notes = await withTenant(owner.businessId, (tx) => tx.select().from(schema.notices));
    expect(notes.some((n) => n.title.startsWith("Stock conflict"))).toBe(true);
  });
});

describe("roles and plans", () => {
  it("AC-5: roles without cost access never receive buying prices", async () => {
    const owner = await freshShop();
    await applyCommand(owner, cmd("order.create", { input: orderInput(1), mode: "confirm" }));
    const forSales = await withTenant(owner.businessId, (tx) => snapshot(tx, owner.businessId, "sales"));
    expect(forSales.products[0].variants[0].cost).toBe(0);
    expect(forSales.orders[0].lines[0].cost).toBe(0);
    expect(forSales.expenses).toEqual([]);
    const forOwner = await withTenant(owner.businessId, (tx) => snapshot(tx, owner.businessId, "owner"));
    expect(forOwner.products[0].variants[0].cost).toBe(250);
  });

  it("enforces permissions on the server, not just in the UI (NFR-SEC-04)", async () => {
    const owner = await freshShop();
    const sales: Who = { ...owner, role: "sales" };
    expect(await applyCommand(sales, cmd("stock.adjust", { variantId: "v_tee", newOnHand: 99, reason: "adjust" }))).toMatchObject({ status: "rejected", code: "forbidden" });
    const cheap = orderInput(1);
    cheap.lines[0].price = 1;
    expect(await applyCommand(sales, cmd("order.create", { input: cheap, mode: "confirm" }))).toMatchObject({ status: "rejected", code: "forbidden" });
    const bigDiscount = { ...orderInput(1), discount: { type: "pct" as const, value: 40 } };
    expect(await applyCommand(sales, cmd("order.create", { input: bigDiscount, mode: "confirm" }))).toMatchObject({ status: "rejected", code: "forbidden" });
    expect((await applyCommand(sales, cmd("order.create", { input: orderInput(1), mode: "confirm" }))).status).toBe("applied");
  });

  it("AC-6: at the plan limit new orders are blocked, drafts and existing data still work", async () => {
    const owner = await freshShop();
    await db.update(schema.businesses).set({ planOrderLimit: 1 }).where(eq(schema.businesses.id, owner.businessId));
    expect((await applyCommand(owner, cmd("order.create", { input: orderInput(1), mode: "confirm" }))).status).toBe("applied");
    expect(await applyCommand(owner, cmd("order.create", { input: orderInput(1), mode: "confirm" }))).toMatchObject({ status: "rejected", code: "limit" });
    expect((await applyCommand(owner, cmd("order.create", { input: orderInput(1), mode: "draft" }))).status).toBe("applied");
    const snap = await withTenant(owner.businessId, (tx) => snapshot(tx, owner.businessId, "owner"));
    expect(snap.orders.length).toBe(2);
  });

  it("writes sensitive actions to the audit log (FR-AUD-01)", async () => {
    const owner = await freshShop();
    await applyCommand(owner, cmd("stock.adjust", { variantId: "v_tee", newOnHand: 8, reason: "adjust", note: "Count" }));
    const log = await withTenant(owner.businessId, (tx) => tx.select().from(schema.auditLog));
    expect(log.map((l) => l.action)).toContain("stock.adjusted");
  });
});

describe("device and server agree", () => {
  it("the same command produces identical records on both sides", async () => {
    const owner = await freshShop();
    const c = cmd("order.create", { input: orderInput(2), mode: "confirm" });
    // Device: apply the reducer to the state the device would have.
    const deviceBase = await withTenant(owner.businessId, (tx) => loadWorkingSet(tx, owner.businessId, "order.create", c.payload));
    const device = produce(deviceBase, (d) => void COMMANDS["order.create"](d as AppState, c.payload, makeCtx(c.id, c.at, { id: owner.userId, name: owner.userName, role: "owner" })));
    // Server: apply through the API path, then read back.
    await applyCommand(owner, c);
    const server = await withTenant(owner.businessId, (tx) => snapshot(tx, owner.businessId, "owner"));
    const d = device.orders.at(-1)!;
    const s = server.orders.find((o) => o.id === d.id)!;
    expect(s).toBeDefined();
    expect({ ...s, events: s.events.map((e) => e.id) }).toEqual({ ...d, events: d.events.map((e) => e.id) });
  });

  it("new accounts can start with sample data whose ledger balances", async () => {
    const shop = await freshShop({ sample: true });
    const rows = await withTenant(shop.businessId, (tx) =>
      // Bundles hold no stock of their own (their counters mirror their components), so they have no ledger.
      tx.execute(sql`select v.id, v.on_hand, coalesce(sum(m.delta), 0)::int as ledger from variants v join products p on p.id = v.product_id and p.business_id = v.business_id left join stock_movements m on m.variant_id = v.id and m.business_id = v.business_id where jsonb_array_length(coalesce(p.extra->'bundle', '[]'::jsonb)) = 0 group by v.id, v.on_hand`),
    );
    expect(rows.rows.length).toBeGreaterThan(20);
    for (const r of rows.rows as { on_hand: number; ledger: number }[]) expect(r.ledger).toBe(r.on_hand);
  });
});
