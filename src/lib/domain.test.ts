import { beforeEach, describe, expect, it } from "vitest";
import { toBanglaDate } from "./bangla-calendar";
import { available, canTransition, normalizePhone, orderTotals, transitionEffect } from "./domain";
import { buildSeed } from "./seed";
import { useStore } from "./store";
import { contrast, themeVars, THEME_PRESETS } from "./theme";
import type { Product } from "./types";

const tee: Product = {
  id: "p_tee",
  name: "Tee",
  categoryId: "cat_kurti",
  unit: "pcs",
  images: [],
  art: { hue: "#C2306B", pattern: "plain" },
  optionTypes: [{ name: "Colour", values: ["Red"] }],
  variants: [{ id: "v_red_l", sku: "TEE-RED-L", options: { Colour: "Red" }, price: 500, cost: 250, onHand: 0, reserved: 0, inTransit: 0, damaged: 0, lowStock: 2, active: true }],
  status: "active",
  tags: [],
  createdAt: new Date().toISOString(),
};

const variant = () => useStore.getState().products.find((p) => p.id === "p_tee")!.variants[0];

describe("stock lifecycle (SRS §8)", () => {
  beforeEach(() => {
    useStore.setState({ products: [], orders: [], movements: [], expenses: [], customers: [] });
    useStore.getState().saveProduct(structuredClone(tee), { v_red_l: 10 });
  });

  it("AC-1: confirming reserves, shipping moves stock to in-transit", () => {
    const order = useStore.getState().createOrder(
      { channel: "facebook", customer: { name: "Ayesha", phone: "01711000000" }, lines: [{ key: "k", productId: "p_tee", variantId: "v_red_l", qty: 3, price: 500, discount: 0 }], discount: { type: "flat", value: 0 }, deliveryCharge: 70, otherCharges: 0, payments: [], settlement: "cod" },
      "confirm",
    );
    expect(variant()).toMatchObject({ onHand: 10, reserved: 3 });
    expect(available(variant())).toBe(7);
    expect(order.invoiceNo).toMatch(/^INV-\d{4}-\d{6}$/);

    useStore.getState().transition(order.id, "shipped");
    expect(variant()).toMatchObject({ onHand: 7, reserved: 0, inTransit: 3 });
  });

  it("AC-2: returns restock or write off, and book the courier fee as an expense", () => {
    const order = useStore.getState().createOrder(
      { channel: "facebook", customer: { name: "Ayesha", phone: "01711000000" }, lines: [{ key: "k", productId: "p_tee", variantId: "v_red_l", qty: 3, price: 500, discount: 0 }], discount: { type: "flat", value: 0 }, deliveryCharge: 70, otherCharges: 0, payments: [], settlement: "cod" },
      "confirm",
    );
    useStore.getState().transition(order.id, "shipped");
    const lineId = useStore.getState().orders.find((o) => o.id === order.id)!.lines[0].id;
    useStore.getState().recordReturn(order.id, [{ lineId, qty: 2, condition: "restock" }, { lineId, qty: 1, condition: "damaged" }], 60, 0);

    expect(variant()).toMatchObject({ onHand: 9, damaged: 1, inTransit: 0 });
    expect(useStore.getState().orders.find((o) => o.id === order.id)!.status).toBe("returned");
    expect(useStore.getState().expenses[0]).toMatchObject({ category: "return_fee", amount: 60 });
  });

  it("walk-in sale deducts stock immediately and is delivered", () => {
    const order = useStore.getState().createOrder(
      { channel: "walkin", customer: null, lines: [{ key: "k", productId: "p_tee", variantId: "v_red_l", qty: 2, price: 500, discount: 0 }], discount: { type: "flat", value: 0 }, deliveryCharge: 0, otherCharges: 0, payments: [{ method: "cash", amount: 1000, kind: "payment" }], settlement: "due" },
      "complete",
    );
    expect(order.status).toBe("delivered");
    expect(variant().onHand).toBe(8);
    expect(orderTotals(order).due).toBe(0);
  });

  it("cancelling a confirmed order releases the reservation", () => {
    const order = useStore.getState().createOrder(
      { channel: "phone", customer: null, lines: [{ key: "k", productId: "p_tee", variantId: "v_red_l", qty: 4, price: 500, discount: 0 }], discount: { type: "flat", value: 0 }, deliveryCharge: 0, otherCharges: 0, payments: [], settlement: "cod" },
      "confirm",
    );
    useStore.getState().transition(order.id, "cancelled");
    expect(variant()).toMatchObject({ onHand: 10, reserved: 0 });
  });

  it("stock-in recalculates weighted average cost", () => {
    useStore.getState().stockIn({ lines: [{ variantId: "v_red_l", productId: "p_tee", qty: 10, unitCost: 350 }], paid: 0 });
    expect(variant()).toMatchObject({ onHand: 20, cost: 300 });
  });
});

describe("order maths", () => {
  it("total = subtotal − discount + delivery + other; remainder goes to COD", () => {
    const t = orderTotals({ lines: [{ qty: 2, price: 890, discount: 80 }] as never, discount: { type: "pct", value: 10 }, deliveryCharge: 70, otherCharges: 20, payments: [{ amount: 70 }] as never, settlement: "cod" });
    expect(t.subtotal).toBe(1700);
    expect(t.discount).toBe(170);
    expect(t.total).toBe(1620);
    expect(t.cod).toBe(1550);
    expect(t.due).toBe(0);
  });

  it("state machine allows only legal moves, gated by role", () => {
    expect(canTransition("draft", "shipped", "owner")).toBe(false);
    expect(canTransition("packed", "shipped", "packer")).toBe(true);
    expect(canTransition("shipped", "delivered", "sales")).toBe(false);
    expect(transitionEffect("confirmed", "packed", 3)).toEqual({ onHand: 0, reserved: 0, inTransit: 0, damaged: 0 });
  });
});

describe("seed integrity", () => {
  it("every variant's on-hand equals the sum of its ledger (SRS §6)", () => {
    const seed = buildSeed(new Date(2026, 10, 2, 18));
    // Bundles hold no stock of their own; their counters mirror their components.
    for (const p of seed.products.filter((x) => !x.bundle?.length))
      for (const v of p.variants) {
        const sum = seed.movements.filter((m) => m.variantId === v.id).reduce((s, m) => s + m.delta, 0);
        expect(sum).toBe(v.onHand);
        expect(v.onHand).toBeGreaterThanOrEqual(v.reserved);
        if (v.stockByLocation) expect(Object.values(v.stockByLocation).reduce((a, b) => a + b, 0)).toBe(v.onHand);
        if (v.batches) expect(v.batches.reduce((a, b) => a + b.qty, 0)).toBeLessThanOrEqual(v.onHand);
      }
  });
});

describe("locale helpers", () => {
  it("normalises Bangladeshi mobile numbers", () => {
    expect(normalizePhone("+880 1711-234567")).toBe("01711234567");
    expect(normalizePhone("০১৯১১২২৩৩৪৪")).toBe("01911223344");
    expect(normalizePhone("1711234567")).toBe("01711234567");
    expect(normalizePhone("01211234567")).toBeNull();
  });

  it("converts to the Bangla calendar", () => {
    expect(toBanglaDate(new Date(2026, 3, 14))).toEqual({ day: 1, month: 0, year: 1433 });
    expect(toBanglaDate(new Date(2026, 1, 21))).toEqual({ day: 8, month: 10, year: 1432 }); // Ekushey: 21 Feb is always ৮ ফাল্গুন
    expect(toBanglaDate(new Date(2026, 11, 16))).toEqual({ day: 1, month: 8, year: 1433 });
  });

  it("every theme preset yields AA-safe brand text", () => {
    for (const p of THEME_PRESETS) {
      const v = themeVars(p.hex);
      expect(contrast(v["--brand-ink"], "#FFFFFF")).toBeGreaterThanOrEqual(4.5);
      expect(contrast(v["--brand"], v["--brand-contrast"])).toBeGreaterThanOrEqual(3);
    }
  });
});
