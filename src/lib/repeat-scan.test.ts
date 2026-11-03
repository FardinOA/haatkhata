import { describe, expect, it } from "vitest";
import { afterScan, isRepeatScan, REPEAT_WINDOW_MS } from "./repeat-scan";

describe("repeat scans", () => {
  it("asks when the same item comes again within the window", () => {
    const last = afterScan("v1", 1000);
    expect(isRepeatScan(last, "v1", 1000 + 2000)).toBe(true);
    expect(isRepeatScan(last, "v1", 1000 + REPEAT_WINDOW_MS)).toBe(false);
  });

  it("never asks about a different item, or the first scan", () => {
    expect(isRepeatScan(null, "v1", 0)).toBe(false);
    expect(isRepeatScan(afterScan("v1", 0), "v2", 500)).toBe(false);
  });

  it("asks again on every repeat, timed from the latest scan", () => {
    let last = afterScan("v1", 0);
    last = afterScan("v1", 9000);
    expect(isRepeatScan(last, "v1", 9000 + REPEAT_WINDOW_MS - 1)).toBe(true);
  });
});
