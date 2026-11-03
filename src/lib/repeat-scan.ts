/**
 * Repeat scans (FR-POS-02): the same item scanned again moments later is as
 * likely a slip as a second unit, so the till asks how many the cart should
 * hold instead of guessing.
 */

/** A repeat inside this window asks for the quantity. */
export const REPEAT_WINDOW_MS = 10_000;

export type LastScan = { variantId: string; at: number } | null;

/** Should this scan ask for the quantity instead of adding one? */
export function isRepeatScan(last: LastScan, variantId: string, now: number) {
  return !!last && last.variantId === variantId && now - last.at < REPEAT_WINDOW_MS;
}

/** The memory after an item was scanned into the cart. */
export function afterScan(variantId: string, now: number): LastScan {
  return { variantId, at: now };
}
