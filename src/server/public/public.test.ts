/**
 * Public surfaces: customer invoice links and the catalogue storefront.
 * Runs against a real Postgres (see ../test/global-setup.ts).
 */
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { applyCommand } from "../apply";
import { createBusiness } from "../business";
import { db, schema, withTenant } from "../db";
import { ensurePublicToken, getPublicInvoice, newPublicToken, revokePublicToken } from "./invoice";
import { getCatalogue, placeOrderRequest, saveSettings } from "./storefront";

const rid = () => randomBytes(6).toString("hex");

async function shop(name: string) {
  const userId = `u_${rid()}`;
  await db.insert(schema.users).values({ id: userId, phone: `018${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`, name: "Owner" });
  const businessId = await createBusiness(userId, { name, ownerName: "Owner", type: "online", channels: ["facebook"], sample: false });
  const owner = { businessId, userId, userName: "Owner", role: "owner" as const };
  const at = new Date().toISOString();
  await applyCommand(owner, {
    id: `c${rid()}`,
    type: "product.save",
    at,
    payload: {
      product: { id: "p_saree", name: "Jamdani Saree", categoryId: "cat_saree", unit: "pcs", images: [], art: { hue: "#B23A48", pattern: "diamond" }, optionTypes: [], status: "active", tags: [], createdAt: at, variants: [{ id: "v_saree", sku: "JMD-1", options: {}, price: 6500, cost: 4200, onHand: 0, reserved: 0, inTransit: 0, damaged: 0, lowStock: 2, active: true }] },
      opening: { v_saree: 5 },
    },
  });
  const r = await applyCommand(owner, {
    id: `c${rid()}`,
    type: "order.create",
    at,
    payload: {
      mode: "confirm",
      input: {
        channel: "facebook",
        customer: { name: "Ayesha Rahman", phone: "01711234567", address: { line: "House 1", area: "Mirpur 10", district: "Dhaka" } },
        lines: [{ key: "k", productId: "p_saree", variantId: "v_saree", qty: 1, price: 6500, discount: 0 }],
        discount: { type: "flat", value: 0 },
        deliveryCharge: 70,
        otherCharges: 0,
        payments: [],
        settlement: "cod",
        notesInternal: "SECRET internal note",
        notesInvoice: "Gift wrap please",
      },
    },
  });
  return { ...owner, orderId: (r.result as { id: string }).id };
}

describe("customer invoice links (FR-INV-04, NFR-SEC-05)", () => {
  let a: Awaited<ReturnType<typeof shop>>;
  let b: Awaited<ReturnType<typeof shop>>;
  beforeAll(async () => {
    a = await shop("Shop A");
    b = await shop("Shop B");
  });

  it("tokens are 192-bit and unguessable", () => {
    const tokens = new Set(Array.from({ length: 2000 }, newPublicToken));
    expect(tokens.size).toBe(2000);
    for (const t of tokens) expect(t).toMatch(/^[A-Za-z0-9_-]{32}$/); // 24 random bytes
  });

  it("serves the invoice without cost, internal notes, staff names or the full phone", async () => {
    const token = (await ensurePublicToken(a.businessId, a.orderId))!;
    expect(await ensurePublicToken(a.businessId, a.orderId)).toBe(token); // stable
    const inv = await getPublicInvoice(token);
    expect(inv?.order.totals.total).toBe(6570);
    expect(inv?.order.noteForCustomer).toBe("Gift wrap please");
    const json = JSON.stringify(inv);
    expect(json).not.toContain("SECRET");
    expect(json).not.toContain("4200"); // buying price
    expect(json).not.toContain("cost\":4200");
    expect(json).not.toContain("01711234567");
    expect(json).not.toContain("Owner"); // who changed status stays private
    expect(inv?.order.customer?.phone).toBe("017••••4567");
  });

  it("stamps the invoice as a trial until the shop pays", async () => {
    const token = (await ensurePublicToken(b.businessId, b.orderId))!;
    expect((await getPublicInvoice(token))?.business.trial).toBe(true); // new shops start on the trial
    await db.update(schema.businesses).set({ plan: "starter" }).where(eq(schema.businesses.id, b.businessId));
    expect((await getPublicInvoice(token))?.business.trial).toBe(false);
    await db.update(schema.businesses).set({ plan: "expired" }).where(eq(schema.businesses.id, b.businessId));
    expect((await getPublicInvoice(token))?.business.trial).toBe(true);
  });

  it("a business can't mint or revoke another business's link", async () => {
    expect(await ensurePublicToken(b.businessId, a.orderId)).toBeNull();
    expect(await revokePublicToken(b.businessId, a.orderId)).toBe(false);
  });

  it("revoking kills the old link immediately; a new one is different", async () => {
    const old = (await ensurePublicToken(a.businessId, a.orderId))!;
    expect(await revokePublicToken(a.businessId, a.orderId)).toBe(true);
    expect(await getPublicInvoice(old)).toBeNull();
    const fresh = await ensurePublicToken(a.businessId, a.orderId);
    expect(fresh).not.toBe(old);
    expect(await getPublicInvoice(fresh!)).not.toBeNull();
  });

  it("rejects malformed or unknown tokens", async () => {
    expect(await getPublicInvoice("short")).toBeNull();
    expect(await getPublicInvoice(newPublicToken())).toBeNull();
    expect(await getPublicInvoice("' or 1=1 --aaaaaaaaaaaaaaaaaaaaa")).toBeNull();
  });
});

describe("catalogue storefront", () => {
  let s: Awaited<ReturnType<typeof shop>>;
  const slug = `shop-${rid()}`;
  beforeAll(async () => {
    s = await shop("Catalogue Shop");
    await saveSettings(s.businessId, { slug, enabled: true, showStock: false, banner: "Eid collection", deliveryInside: 60, deliveryOutside: 120, whatsapp: "01711000000", messenger: null });
  });

  it("lists active products with availability but no stock numbers or costs", async () => {
    const cat = await getCatalogue(slug);
    expect(cat?.products).toHaveLength(1);
    const v = cat!.products[0].variants[0];
    expect(v).toMatchObject({ price: 6500, inStock: true, left: null });
    expect(JSON.stringify(cat)).not.toContain("4200");
  });

  it("disabled catalogues are invisible", async () => {
    const other = await shop("Hidden");
    const hidden = `hid-${rid()}`;
    await saveSettings(other.businessId, { slug: hidden, enabled: false, showStock: false, banner: "", deliveryInside: 60, deliveryOutside: 120, whatsapp: null, messenger: null });
    expect(await getCatalogue(hidden)).toBeNull();
    await saveSettings(other.businessId, { slug: hidden, enabled: true, showStock: false, banner: "", deliveryInside: 60, deliveryOutside: 120, whatsapp: null, messenger: null });
    expect(await getCatalogue(hidden)).not.toBeNull();
  });

  it("refuses a slug another shop already uses", async () => {
    const other = await shop("Copycat");
    await expect(saveSettings(other.businessId, { slug, enabled: true, showStock: false, banner: "", deliveryInside: 60, deliveryOutside: 120, whatsapp: null, messenger: null })).rejects.toMatchObject({ status: 409 });
  });

  it("an order request becomes a DRAFT priced from the database, never from the visitor", async () => {
    const r = await placeOrderRequest(slug, { name: "Nabila", phone: "+880 1811-223344", address: { line: "Road 4", area: "Agrabad", district: "Chattogram" }, lines: [{ variantId: "v_saree", qty: 2, price: 1 }] }, "10.0.0.1");
    expect(r.total).toBe(2 * 6500 + 120);
    const rows = await withTenant(s.businessId, (tx) => tx.select().from(schema.orders).where(eq(schema.orders.no, r.orderNo!)));
    expect(rows[0]).toMatchObject({ status: "draft", channel: "website", total: 13120 });
    const notices = await withTenant(s.businessId, (tx) => tx.select().from(schema.notices));
    expect(notices.some((n) => n.title.includes(`#${r.orderNo}`))).toBe(true);
    // Drafts don't touch stock.
    const [v] = await withTenant(s.businessId, (tx) => tx.select().from(schema.variants).where(eq(schema.variants.id, "v_saree")));
    expect(v.reserved).toBe(1);
  });

  it("validates phone and unknown items, and quietly swallows bots", async () => {
    await expect(placeOrderRequest(slug, { name: "X Y", phone: "12345", address: { line: "abc", district: "Dhaka" }, lines: [{ variantId: "v_saree", qty: 1 }] }, "10.0.0.2")).rejects.toMatchObject({ status: 400 });
    await expect(placeOrderRequest(slug, { name: "X Y", phone: "01911223344", address: { line: "abc", district: "Dhaka" }, lines: [{ variantId: "v_other_shop", qty: 1 }] }, "10.0.0.3")).rejects.toMatchObject({ status: 409 });
    expect(await placeOrderRequest(slug, { name: "Bot", phone: "01911223345", address: { line: "abc", district: "Dhaka" }, lines: [{ variantId: "v_saree", qty: 1 }], company: "spam inc" }, "10.0.0.4")).toEqual({ orderNo: null, total: 0 });
  });

  it("rate-limits by phone and by network", async () => {
    const body = (n: number) => ({ name: "Repeat Buyer", phone: "01611000000", address: { line: "Road 9", district: "Dhaka" }, lines: [{ variantId: "v_saree", qty: 1 }], n });
    for (let i = 0; i < 3; i++) await placeOrderRequest(slug, body(i), `10.1.0.${i}`);
    await expect(placeOrderRequest(slug, body(9), "10.1.0.9")).rejects.toMatchObject({ status: 429 });
    const ipBody = (i: number) => ({ name: "Someone", phone: `0151100000${i}`, address: { line: "Road 9", district: "Dhaka" }, lines: [{ variantId: "v_saree", qty: 1 }] });
    for (let i = 0; i < 6; i++) await placeOrderRequest(slug, ipBody(i), "10.2.0.1");
    await expect(placeOrderRequest(slug, ipBody(7), "10.2.0.1")).rejects.toMatchObject({ status: 429 });
  });
});
