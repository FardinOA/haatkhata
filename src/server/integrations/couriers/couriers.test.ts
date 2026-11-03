/**
 * Couriers, payment links and network risk — against a real Postgres.
 * Run: BK_TEST_DB=bechakena_test_f1 npx vitest run --project server src/server/integrations
 */
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import type { CommandPayload, CommandType } from "@/lib/commands";
import { applyCommand } from "../../apply";
import { createBusiness } from "../../business";
import { db, schema, withTenant } from "../../db";
import { consignments, courierAccounts, paymentLinks } from "../../db/schema-couriers";
import { riskForPhone } from "../../risk";
import { loadWorkingSet } from "../../state-io";
import { completePayment, createLink, publicInfo } from "../payments/service";
import { decryptJson, encryptJson } from "../secrets";
import { bookOrders, connectAccount, handleWebhook, type Actor } from "./service";

const uid = () => randomBytes(8).toString("hex");
const cmd = <T extends CommandType>(type: T, payload: CommandPayload<T>) => ({ id: `c${uid()}`, type, payload, at: new Date().toISOString() });

async function shop(): Promise<Actor> {
  const userId = `u_${uid()}`;
  await db.insert(schema.users).values({ id: userId, phone: `018${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`, name: "Owner" });
  const businessId = await createBusiness(userId, { name: "Courier Shop", ownerName: "Owner", type: "online", channels: ["facebook"], sample: false });
  const owner: Actor = { businessId, userId, userName: "Owner", role: "owner" };
  const r = await applyCommand(
    owner,
    cmd("product.save", {
      product: { id: "p_bag", name: "Bag", categoryId: "cat_acc", unit: "pcs", images: [], art: { hue: "#A68A5B", pattern: "check" }, optionTypes: [], status: "active", tags: [], createdAt: new Date().toISOString(), variants: [{ id: "v_bag", sku: "BAG-1", options: {}, price: 450, cost: 210, onHand: 0, reserved: 0, inTransit: 0, damaged: 0, lowStock: 2, active: true }] },
      opening: { v_bag: 20 },
    }),
  );
  expect(r).toMatchObject({ status: "applied" });
  return owner;
}

async function order(a: Actor, phone = "01711222333", mode: "confirm" | "draft" = "confirm") {
  const r = await applyCommand(
    a,
    cmd("order.create", {
      mode,
      input: { channel: "facebook", customer: { name: "Ayesha Rahman", phone, address: { line: "House 4, Road 2", area: "Mirpur 10", district: "Dhaka" } }, lines: [{ key: "k", productId: "p_bag", variantId: "v_bag", qty: 2, price: 450, discount: 0 }], discount: { type: "flat", value: 0 }, deliveryCharge: 70, otherCharges: 0, payments: [], settlement: "cod" },
    }),
  );
  expect(r).toMatchObject({ status: "applied" });
  return (r.result as { id: string }).id;
}

const variant = (a: Actor) => withTenant(a.businessId, async (tx) => (await tx.select().from(schema.variants).where(eq(schema.variants.id, "v_bag")))[0]);
const orderRow = async (a: Actor, id: string) => (await withTenant(a.businessId, (tx) => loadWorkingSet(tx, a.businessId, "order.transition", { orderId: id }))).orders[0];

describe("courier booking & status sync", () => {
  it("books with the test courier, ships the order and moves stock to transit", async () => {
    const a = await shop();
    const id = await order(a);
    const [res] = await bookOrders(a, [id], "sandbox");
    expect(res).toMatchObject({ ok: true });
    const o = await orderRow(a, id);
    expect(o.status).toBe("shipped");
    expect(o.courier).toMatchObject({ provider: "sandbox", consignmentId: res.consignmentId, name: "Test courier" });
    expect(await variant(a)).toMatchObject({ onHand: 18, reserved: 0, inTransit: 2 });
    // Booking twice is refused rather than double-shipping.
    const [again] = await bookOrders(a, [id], "sandbox");
    expect(again.ok).toBe(false);
  });

  it("refuses roles that can't ship", async () => {
    const a = await shop();
    const id = await order(a);
    await expect(bookOrders({ ...a, role: "sales" }, [id], "sandbox")).rejects.toThrow(/can't ship/);
  });

  it("a delivered webhook completes the order once; a returned one raises a notice without restocking", async () => {
    const a = await shop();
    await connectAccount(a.businessId, "sandbox", {});
    const [acct] = await withTenant(a.businessId, (tx) => tx.select().from(courierAccounts));
    const [d1, d2] = [await order(a), await order(a, "01711999888")];
    const [b1, b2] = await bookOrders(a, [d1, d2], "sandbox");

    const r = await handleWebhook("sandbox", acct.webhookKey, { consignment_id: b1.consignmentId, status: "delivered" }, new Headers());
    expect(r).toMatchObject({ changed: true });
    await handleWebhook("sandbox", acct.webhookKey, { consignment_id: b1.consignmentId, status: "delivered" }, new Headers()); // duplicate callback
    expect((await orderRow(a, d1)).status).toBe("delivered");
    expect((await variant(a)).inTransit).toBe(2); // only the second parcel is still out

    await handleWebhook("sandbox", acct.webhookKey, { consignment_id: b2.consignmentId, status: "returned" }, new Headers());
    expect((await orderRow(a, d2)).status).toBe("shipped"); // waits for the shop to record what came back
    expect((await variant(a)).onHand).toBe(16);
    const notes = await withTenant(a.businessId, (tx) => tx.select().from(schema.notices));
    expect(notes.some((n) => n.title.includes("coming back"))).toBe(true);
    const [row] = await withTenant(a.businessId, (tx) => tx.select().from(consignments).where(eq(consignments.consignmentId, b2.consignmentId!)));
    expect(row.status).toBe("returned");
  });

  it("rejects webhooks with an unknown key", async () => {
    await expect(handleWebhook("sandbox", "x".repeat(24), { consignment_id: "SB1", status: "delivered" }, new Headers())).rejects.toThrow(/Unknown webhook/);
  });

  it("stores courier credentials encrypted", async () => {
    const blob = encryptJson({ apiKey: "abc", secretKey: "s3cret" });
    expect(blob).not.toContain("s3cret");
    expect(decryptJson(blob)).toEqual({ apiKey: "abc", secretKey: "s3cret" });
  });
});

describe("network return-risk (FR-CUS-06)", () => {
  it("counts other shops' outcomes without revealing them, and excludes your own shop", async () => {
    const phone = `0191${String(Math.floor(Math.random() * 1e7)).padStart(7, "0")}`;
    const a = await shop();
    const b = await shop();
    // Shop A ships two parcels to this buyer; both come back.
    for (let i = 0; i < 2; i++) {
      const id = await order(a, phone);
      await applyCommand(a, cmd("order.transition", { orderId: id, to: "shipped", courier: { name: "Steadfast" } }));
      const o = await orderRow(a, id);
      await applyCommand(a, cmd("order.return", { orderId: id, lines: [{ lineId: o.lines[0].id, qty: 2, condition: "restock" }], fee: 60, refund: 0 }));
    }
    const forB = await riskForPhone(b.businessId, phone);
    expect(forB?.own).toEqual({ delivered: 0, returned: 0, cancelled: 0 });
    expect(forB?.network).toEqual({ delivered: 0, returned: 2, cancelled: 0, merchants: 1 });
    expect(forB?.level).toBe("risky");
    expect(JSON.stringify(forB)).not.toContain(a.businessId);
    const forA = await riskForPhone(a.businessId, phone);
    expect(forA?.own.returned).toBe(2);
    expect(forA?.network).toBeNull(); // nobody else has sold to this buyer
  });

  it("the network function is the only cross-tenant path — direct reads stay isolated", async () => {
    const a = await shop();
    const b = await shop();
    await order(a, "01722000111");
    const seenByB = await withTenant(b.businessId, (tx) => tx.select().from(schema.orders));
    expect(seenByB.every((o) => o.businessId === b.businessId)).toBe(true);
  });
});

describe("payment links", () => {
  it("records a verified payment exactly once and shows the buyer only what they need", async () => {
    const a = await shop();
    const id = await order(a);
    const link = await createLink(a, { orderId: id, amount: 70, purpose: "advance", provider: "sandbox" });
    expect(link.token.length).toBeGreaterThanOrEqual(22);
    const info = await publicInfo(link.token);
    expect(info).toMatchObject({ amount: 70, status: "open", orderNo: expect.any(Number), buyer: "Ayesha" });
    expect(JSON.stringify(info)).not.toContain("01711222333");

    expect(await completePayment(link.token, new URLSearchParams({ outcome: "decline" }))).toMatchObject({ ok: false });
    expect(await completePayment(link.token, new URLSearchParams({ outcome: "approve" }))).toMatchObject({ ok: true });
    expect(await completePayment(link.token, new URLSearchParams({ outcome: "approve" }))).toMatchObject({ ok: true, already: true });
    const o = await orderRow(a, id);
    expect(o.payments.filter((p) => p.kind === "advance").map((p) => p.amount)).toEqual([70]);
    const [row] = await withTenant(a.businessId, (tx) => tx.select().from(paymentLinks));
    expect(row.status).toBe("paid");
  });

  it("refuses links for more than the order still owes", async () => {
    const a = await shop();
    const id = await order(a);
    await expect(createLink(a, { orderId: id, amount: 99999, purpose: "due", provider: "sandbox" })).rejects.toThrow(/between/);
  });
});
