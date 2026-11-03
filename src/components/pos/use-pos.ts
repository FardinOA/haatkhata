"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { available, customerStats, normalizePhone, orderTotals, riskLevel } from "@/lib/domain";
import { isInsideDhaka } from "@/lib/geo";
import { getVariant, useStore } from "@/lib/store";
import type { Address, CartLine, Channel, Customer, Order, PayMethod, Product } from "@/lib/types";

export type PayRow = { key: string; method: PayMethod; amount: number; txnId: string };

export type PosDraft = {
  lines: CartLine[];
  channel: Channel;
  customerId?: string;
  name: string;
  phone: string;
  address: Address;
  discount: { type: "flat" | "pct"; value: number };
  deliveryPresetId: string | "custom" | "free";
  deliveryCharge: number;
  deliveryTouched: boolean;
  otherCharges: number;
  payments: PayRow[];
  settlement: "cod" | "due";
  notesInvoice: string;
  notesInternal: string;
  parkedFrom?: string;
};

const key = () => Math.random().toString(36).slice(2, 9);

export function emptyDraft(channel: Channel, presets: { id: string; amount: number }[], settlement: "cod" | "due"): PosDraft {
  const walkin = channel === "walkin";
  const first = presets[0];
  return {
    lines: [],
    channel,
    name: "",
    phone: "",
    address: { line: "", area: "", district: "Dhaka" },
    discount: { type: "flat", value: 0 },
    deliveryPresetId: walkin ? "free" : (first?.id ?? "custom"),
    deliveryCharge: walkin ? 0 : (first?.amount ?? 0),
    deliveryTouched: false,
    otherCharges: 0,
    payments: [],
    settlement: walkin ? "due" : settlement,
    notesInvoice: "",
    notesInternal: "",
  };
}

type Presets = { id: string; amount: number }[];

function presetFor(district: string, presets: Presets) {
  return presets.find((p) => p.id === (isInsideDhaka(district) ? "dp_in" : "dp_out")) ?? presets[0];
}

/** New cart addressed to a known customer (`/pos?customer=<id>`). */
export function draftFromCustomer(c: Customer, presets: Presets, settlement: "cod" | "due"): PosDraft {
  const base = emptyDraft(c.channel, presets, settlement);
  const preset = c.channel === "walkin" ? undefined : presetFor(c.address.district, presets);
  return {
    ...base,
    customerId: c.id,
    name: c.name,
    phone: c.phone,
    address: { ...c.address },
    ...(preset ? { deliveryPresetId: preset.id, deliveryCharge: preset.amount } : {}),
  };
}

/**
 * Repeat order (`/pos?duplicate=<orderId>`, FR-POS-13): same items at today's
 * prices, only active variants, quantities clamped to what's in stock.
 */
export function draftFromOrder(o: Order, products: Product[], presets: Presets, allowNegative: boolean): { draft: PosDraft; skipped: number } {
  const base = emptyDraft(o.channel, presets, o.settlement);
  let skipped = 0;
  const lines: CartLine[] = [];
  for (const l of o.lines) {
    const hit = getVariant(products, l.variantId);
    if (!hit || !hit.v.active || hit.p.status !== "active") {
      skipped++;
      continue;
    }
    const qty = allowNegative ? l.qty : Math.min(l.qty, Math.max(0, available(hit.v)));
    if (qty <= 0) {
      skipped++;
      continue;
    }
    if (qty < l.qty) skipped++;
    lines.push({ key: key(), productId: hit.p.id, variantId: hit.v.id, qty, price: hit.v.price, discount: 0 });
  }
  const preset = presets.find((p) => p.amount === o.deliveryCharge);
  return {
    skipped,
    draft: {
      ...base,
      lines,
      customerId: o.customerId,
      name: o.customer?.name ?? "",
      phone: o.customer?.phone ?? "",
      address: o.customer?.address ? { ...o.customer.address } : base.address,
      deliveryCharge: o.deliveryCharge,
      deliveryPresetId: o.channel === "walkin" ? "free" : preset ? preset.id : o.deliveryCharge === 0 ? "free" : "custom",
      deliveryTouched: true,
      otherCharges: o.otherCharges,
    },
  };
}

export function usePosState() {
  const products = useStore((s) => s.products);
  const customers = useStore((s) => s.customers);
  const orders = useStore((s) => s.orders);
  const pos = useStore((s) => s.pos);

  const [draft, setDraft] = useState<PosDraft>(() => emptyDraft(pos.lastChannel, pos.deliveryPresets, pos.defaultSettlement));

  const patch = useCallback((p: Partial<PosDraft> | ((d: PosDraft) => Partial<PosDraft>)) => {
    setDraft((d) => ({ ...d, ...(typeof p === "function" ? p(d) : p) }));
  }, []);

  /* ---------------- cart */
  const addVariant = useCallback(
    (variantId: string, qty = 1) => {
      const hit = getVariant(products, variantId);
      if (!hit) return;
      setDraft((d) => {
        const ex = d.lines.find((l) => l.variantId === variantId);
        if (ex) return { ...d, lines: d.lines.map((l) => (l.variantId === variantId ? { ...l, qty: l.qty + qty } : l)) };
        return { ...d, lines: [...d.lines, { key: key(), productId: hit.p.id, variantId, qty, price: hit.v.price, discount: 0 }] };
      });
    },
    [products],
  );
  const updateLine = useCallback((k: string, p: Partial<CartLine>) => setDraft((d) => ({ ...d, lines: d.lines.map((l) => (l.key === k ? { ...l, ...p } : l)) })), []);
  const removeLine = useCallback((k: string) => setDraft((d) => ({ ...d, lines: d.lines.filter((l) => l.key !== k) })), []);

  /* ---------------- channel / delivery */
  const setChannel = useCallback(
    (channel: Channel) =>
      setDraft((d) => {
        if (channel === "walkin") return { ...d, channel, deliveryPresetId: "free", deliveryCharge: 0, settlement: "due" };
        if (d.channel === "walkin") {
          const preset = pos.deliveryPresets.find((p) => p.id === (isInsideDhaka(d.address.district) ? "dp_in" : "dp_out")) ?? pos.deliveryPresets[0];
          return { ...d, channel, deliveryPresetId: preset?.id ?? "custom", deliveryCharge: preset?.amount ?? 0, settlement: pos.defaultSettlement };
        }
        return { ...d, channel };
      }),
    [pos.deliveryPresets, pos.defaultSettlement],
  );

  const setDistrict = useCallback(
    (district: string) =>
      setDraft((d) => {
        const next = { ...d, address: { ...d.address, district } };
        if (d.channel === "walkin" || d.deliveryTouched) return next;
        const want = isInsideDhaka(district) ? "dp_in" : "dp_out";
        const preset = pos.deliveryPresets.find((p) => p.id === want);
        return preset ? { ...next, deliveryPresetId: preset.id, deliveryCharge: preset.amount } : next;
      }),
    [pos.deliveryPresets],
  );

  /* ---------------- customer */
  const normalized = normalizePhone(draft.phone);
  const matched: Customer | undefined = useMemo(
    () => (draft.customerId ? customers.find((c) => c.id === draft.customerId) : normalized ? customers.find((c) => c.phone === normalized) : undefined),
    [customers, draft.customerId, normalized],
  );
  const matchedStats = useMemo(() => (matched ? customerStats(matched, orders) : null), [matched, orders]);
  const matchedRisk = matched && matchedStats ? riskLevel(matched, matchedStats) : null;

  const pickCustomer = useCallback(
    (c: Customer) =>
      setDraft((d) => {
        const next: PosDraft = { ...d, customerId: c.id, name: c.name, phone: c.phone, address: { ...c.address } };
        if (d.channel === "walkin" || d.deliveryTouched) return next;
        const want = isInsideDhaka(c.address.district) ? "dp_in" : "dp_out";
        const preset = pos.deliveryPresets.find((p) => p.id === want);
        return preset ? { ...next, deliveryPresetId: preset.id, deliveryCharge: preset.amount } : next;
      }),
    [pos.deliveryPresets],
  );
  const clearCustomer = useCallback(() => patch({ customerId: undefined, name: "", phone: "", address: { line: "", area: "", district: "Dhaka" } }), [patch]);

  /* ---------------- derived */
  const resolved = useMemo(
    () =>
      draft.lines.map((l) => {
        const hit = getVariant(products, l.variantId);
        const avail = hit ? available(hit.v) : 0;
        return { line: l, product: hit?.p, variant: hit?.v, avail, over: !!hit && l.qty > avail };
      }),
    [draft.lines, products],
  );

  const totals = useMemo(
    () =>
      orderTotals({
        lines: draft.lines.map((l) => ({ id: l.key, productId: l.productId, variantId: l.variantId, name: "", variantLabel: "", sku: "", qty: l.qty, price: l.price, discount: l.discount, cost: 0, returnedQty: 0 })),
        discount: draft.discount,
        deliveryCharge: draft.deliveryCharge,
        otherCharges: draft.otherCharges,
        payments: draft.payments.map((p) => ({ id: p.key, method: p.method, amount: p.amount || 0, at: "", by: "", kind: "payment" as const })),
        settlement: draft.settlement,
      }),
    [draft],
  );

  const stockBlocked = !pos.allowNegativeStock && resolved.some((r) => r.over);
  const phoneValid = !draft.phone || !!normalized;

  const reset = useCallback(() => setDraft(emptyDraft(pos.lastChannel, pos.deliveryPresets, pos.defaultSettlement)), [pos.lastChannel, pos.deliveryPresets, pos.defaultSettlement]);

  return {
    draft,
    setDraft,
    patch,
    addVariant,
    updateLine,
    removeLine,
    setChannel,
    setDistrict,
    pickCustomer,
    clearCustomer,
    matched,
    matchedStats,
    matchedRisk,
    normalized,
    resolved,
    totals,
    stockBlocked,
    phoneValid,
    reset,
  };
}

export type PosApi = ReturnType<typeof usePosState>;

export const PosContext = createContext<PosApi | null>(null);

export function usePos() {
  const v = useContext(PosContext);
  if (!v) throw new Error("usePos outside PosContext");
  return v;
}

export const newKey = key;
