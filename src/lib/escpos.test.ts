import { describe, expect, it } from "vitest";
import { chunk, EscPos, toMonochrome } from "./escpos";

describe("ESC/POS encoder", () => {
  it("emits init, alignment, bold and cut", () => {
    const b = new EscPos().init().align("center").bold(true).line("Hi").cut().build();
    expect([...b.slice(0, 2)]).toEqual([0x1b, 0x40]);
    expect([...b.slice(2, 5)]).toEqual([0x1b, 0x61, 1]);
    expect([...b.slice(5, 8)]).toEqual([0x1b, 0x45, 1]);
    expect([...b.slice(8, 11)]).toEqual([0x48, 0x69, 0x0a]);
    expect([...b.slice(-4)]).toEqual([0x1d, 0x56, 0x42, 0x00]);
  });

  it("replaces non-ASCII with ? in text mode", () => {
    expect([...new EscPos().text("৳5").build()]).toEqual([0x3f, 0x35]);
  });

  it("packs raster images 8 pixels per byte, MSB first, padding the width", () => {
    // 10 px wide, 2 rows: first pixel and tenth pixel black on row 0.
    const px = new Uint8Array(20);
    px[0] = 1;
    px[9] = 1;
    px[10 + 7] = 1;
    const b = new EscPos().raster(px, 10).build();
    expect([...b.slice(0, 8)]).toEqual([0x1d, 0x76, 0x30, 0, 2, 0, 2, 0]);
    expect([...b.slice(8)]).toEqual([0b10000000, 0b01000000, 0b00000001, 0]);
  });

  it("encodes a native QR with the right length header", () => {
    const b = [...new EscPos().qr("abc").build()].join(",");
    // store: GS ( k pL pH 49 80 48 data — pL = 3 + data length
    expect(b).toContain([0x1d, 0x28, 0x6b, 6, 0, 0x31, 0x50, 0x30, 0x61, 0x62, 0x63].join(","));
    expect(b.endsWith([0x1d, 0x28, 0x6b, 3, 0, 0x31, 0x51, 0x30].join(","))).toBe(true);
  });

  it("dithers to 1-bit: white stays white, black stays black, transparent is paper", () => {
    const rgba = [0, 0, 0, 255, 255, 255, 255, 255, 0, 0, 0, 0];
    expect([...toMonochrome(rgba, 3, 1)]).toEqual([1, 0, 0]);
  });

  it("splits jobs into BLE-sized writes", () => {
    const parts = chunk(new Uint8Array(400), 180);
    expect(parts.map((p) => p.length)).toEqual([180, 180, 40]);
  });
});
