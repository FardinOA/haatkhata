/**
 * Stock primitives shared by every command that moves units: locations
 * (FR-STK-10), batches with FEFO (FR-STK-12) and bundles (FR-PRD-09).
 * Pure functions over the Immer draft — deterministic on device and server.
 */
import type { AppState } from "./state";
import type { Batch, Product, Variant } from "./types";

type S = AppState;

/* ------------------------------------------------------------ locations */

export function defaultLocationId(s: S): string | undefined {
  const locs = s.locations ?? [];
  if (!locs.length) return undefined;
  return locs.find((l) => l.id === s.pos.defaultLocationId && l.active)?.id ?? locs.find((l) => l.isDefault)?.id ?? locs[0].id;
}

/** Units of a variant at one location (everything sits at the default until split). */
export function qtyAt(v: Pick<Variant, "onHand" | "stockByLocation">, locationId: string, defaultId: string | undefined) {
  if (v.stockByLocation) return v.stockByLocation[locationId] ?? 0;
  return locationId === defaultId ? v.onHand : 0;
}

/** Per-location map that always sums to onHand. */
export function locationBreakdown(v: Pick<Variant, "onHand" | "stockByLocation">, defaultId: string | undefined): Record<string, number> {
  if (v.stockByLocation) return { ...v.stockByLocation };
  return defaultId ? { [defaultId]: v.onHand } : {};
}

/**
 * The only way on-hand changes: keeps the location split in step.
 * `locationId` defaults to the business's default location.
 */
export function changeOnHand(s: S, v: Variant, delta: number, locationId?: string) {
  if (!delta) return;
  const def = defaultLocationId(s);
  if (def) {
    const map = locationBreakdown(v, def);
    const loc = locationId ?? def;
    map[loc] = (map[loc] ?? 0) + delta;
    for (const k of Object.keys(map)) if (map[k] === 0 && k !== def) delete map[k];
    v.stockByLocation = map;
  }
  v.onHand += delta;
}

/* ------------------------------------------------------------ batches */

const byExpiry = (a: Batch, b: Batch) => (a.expiry ?? "9999-12-31").localeCompare(b.expiry ?? "9999-12-31") || a.id.localeCompare(b.id);

export function addToBatch(v: Variant, qty: number, batch: { id: string; code: string; expiry?: string }) {
  if (qty <= 0) return;
  const list = (v.batches ??= []);
  const same = list.find((b) => b.code === batch.code && b.expiry === batch.expiry);
  if (same) same.qty += qty;
  else list.push({ id: batch.id, code: batch.code, expiry: batch.expiry, qty });
  list.sort(byExpiry);
}

/** First-expiry-first-out. Returns what was taken from which batch. */
export function consumeFefo(v: Variant, qty: number): { batchId: string; qty: number }[] {
  if (!v.batches?.length || qty <= 0) return [];
  const taken: { batchId: string; qty: number }[] = [];
  let left = qty;
  for (const b of [...v.batches].sort(byExpiry)) {
    if (!left) break;
    const n = Math.min(b.qty, left);
    if (n > 0) {
      b.qty -= n;
      left -= n;
      taken.push({ batchId: b.id, qty: n });
    }
  }
  v.batches = v.batches.filter((b) => b.qty > 0);
  return taken;
}

/** Returned units go back to the batch that expires last (the safest guess). */
export function restockBatch(v: Variant, qty: number) {
  if (!v.batches?.length || qty <= 0) return;
  const target = [...v.batches].sort(byExpiry).at(-1)!;
  target.qty += qty;
}

export function expiringSoon(products: Product[], withinDays: number, now = new Date()) {
  const limit = new Date(now.getTime() + withinDays * 86_400_000).toISOString().slice(0, 10);
  const today = now.toISOString().slice(0, 10);
  return products.flatMap((p) =>
    p.variants.flatMap((v) =>
      (v.batches ?? []).filter((b) => b.expiry && b.expiry <= limit && b.qty > 0).map((b) => ({ p, v, b, expired: (b.expiry as string) < today })),
    ),
  ).sort((a, b) => (a.b.expiry as string).localeCompare(b.b.expiry as string));
}

/* ------------------------------------------------------------ bundles */

export function findVariantIn(s: S, variantId: string): { p: Product; v: Variant } | null {
  for (const p of s.products) {
    const v = p.variants.find((x) => x.id === variantId);
    if (v) return { p, v };
  }
  return null;
}

/** The physical units a sold line consumes: itself, or its bundle components. */
export function stockUnits(s: S, variantId: string, qty: number): { p: Product; v: Variant; qty: number }[] {
  const hit = findVariantIn(s, variantId);
  if (!hit) return [];
  if (hit.p.bundle?.length)
    return hit.p.bundle.flatMap((c) => {
      const comp = findVariantIn(s, c.variantId);
      return comp ? [{ ...comp, qty: qty * c.qty }] : [];
    });
  return [{ ...hit, qty }];
}

/** How many bundles can be made from what's free right now. */
export function bundleAvailable(s: S, product: Product) {
  if (!product.bundle?.length) return 0;
  let min = Infinity;
  for (const c of product.bundle) {
    const comp = findVariantIn(s, c.variantId);
    if (!comp || c.qty <= 0) return 0;
    min = Math.min(min, Math.floor((comp.v.onHand - comp.v.reserved) / c.qty));
  }
  return Number.isFinite(min) ? Math.max(0, min) : 0;
}

/**
 * A bundle's own counters mirror what its components allow, so every screen
 * (POS stock guard, catalogue) treats it like any other SKU. Bundles never
 * hold stock or reservations of their own.
 */
export function syncBundles(s: S) {
  for (const p of s.products) {
    if (!p.bundle?.length) continue;
    const n = bundleAvailable(s, p);
    for (const v of p.variants) {
      v.onHand = n;
      v.reserved = 0;
      v.inTransit = 0;
      delete v.stockByLocation;
    }
  }
}

export function isBundle(p: Pick<Product, "bundle">) {
  return !!p.bundle?.length;
}
