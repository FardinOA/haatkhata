import { describe, expect, it } from "vitest";
import { barcodeFor, bitsToWidths, code128, code128Values, CODE128_PATTERNS, ean13Bits, eanCheckDigit, barcodeOwner, fillMissingBarcodes, findByCode, inStoreEan13, isValidEan13 } from "./barcode";

/** Reads Code 128 widths back into text — proves the encoder is reversible. */
function decode128(widths: number[]): string {
  const symbols: number[] = [];
  for (let i = 0; i + 6 <= widths.length - 7; i += 6) symbols.push(CODE128_PATTERNS.indexOf(widths.slice(i, i + 6).join("")));
  expect(widths.slice(-7).join("")).toBe("2331112");
  const [start, ...rest] = symbols;
  const data = rest.slice(0, -1);
  const check = rest.at(-1)!;
  expect(check).toBe([start, ...data].reduce((s, v, k) => s + v * (k === 0 ? 1 : k), 0) % 103);
  let set = start === 105 ? "C" : "B";
  let out = "";
  for (const v of data) {
    if (v === 99) set = "C";
    else if (v === 100) set = "B";
    else out += set === "C" ? String(v).padStart(2, "0") : String.fromCharCode(v + 32);
  }
  return out;
}

describe("Code 128", () => {
  it("every pattern is 11 modules (stop is 13)", () => {
    CODE128_PATTERNS.forEach((p, i) => expect(p.split("").reduce((a, b) => a + Number(b), 0)).toBe(i === 106 ? 13 : 11));
  });

  it("computes the check symbol (Wikipedia → 88)", () => {
    const v = code128Values("Wikipedia");
    expect(v[0]).toBe(104);
    expect(v.at(-2)).toBe(88);
  });

  it.each(["TNG-101", "CMB-101", "2100000001234", "AB12345678", "X1", "12345", "PO-0001", "a b~c"])("round-trips %s", (text) => {
    expect(decode128(code128(text))).toBe(text);
  });

  it("uses the compact numeric set for long digit runs", () => {
    expect(code128Values("123456")[0]).toBe(105);
    expect(code128("123456").length).toBeLessThan(code128("12345A").length);
  });

  it("rejects characters it can't encode", () => {
    expect(() => code128("শাড়ি")).toThrow();
  });
});

describe("EAN-13", () => {
  it("computes check digits", () => {
    expect(eanCheckDigit("400638133393")).toBe("1");
    expect(eanCheckDigit("590123412345")).toBe("7");
    expect(isValidEan13("5901234123457")).toBe(true);
    expect(isValidEan13("5901234123458")).toBe(false);
  });

  it("encodes 95 modules with guards in the right places", () => {
    const bits = ean13Bits("590123412345");
    expect(bits).toHaveLength(95);
    expect(bits.slice(0, 3)).toBe("101");
    expect(bits.slice(45, 50)).toBe("01010");
    expect(bits.slice(-3)).toBe("101");
    // First digit 5 → parity LGGLLG: digit 9 is encoded with L.
    expect(bits.slice(3, 10)).toBe("0001011");
    expect(bitsToWidths(bits).reduce((a, b) => a + b, 0)).toBe(95);
  });

  it("picks EAN-13 for valid retail codes and Code 128 otherwise", () => {
    expect(barcodeFor("4006381333931").kind).toBe("ean13");
    expect(barcodeFor("JMD-101").kind).toBe("code128");
  });

  it("generates valid, unused in-store EAN-13 codes", () => {
    const taken = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const code = inStoreEan13(taken);
      expect(isValidEan13(code)).toBe(true);
      expect(code[0]).toBe("2");
      expect(taken.has(code)).toBe(false);
      taken.add(code);
    }
  });

  it("finds a variant by barcode or SKU, including UPC-A scans of EAN-13 codes", () => {
    const products = [
      { id: "a", variants: [{ sku: "JMD-101", barcode: "0012345678905" }] },
      { id: "b", variants: [{ sku: "PNJ-M" }, { sku: "PNJ-L", barcode: "2000000000015" }] },
    ];
    expect(findByCode(products, "2000000000015")?.v.sku).toBe("PNJ-L");
    expect(findByCode(products, " jmd-101 ")?.p.id).toBe("a");
    expect(findByCode(products, "012345678905")?.p.id).toBe("a");
    expect(findByCode(products, "999")).toBeNull();
  });

  it("names the other product that already uses a barcode", () => {
    const products = [
      { id: "a", name: "Kurti", variants: [{ barcode: "0012345678905" }, {}] },
      { id: "b", name: "Hijab", variants: [{ barcode: "2000000000015" }] },
    ];
    expect(barcodeOwner(products, "2000000000015")?.name).toBe("Hijab");
    expect(barcodeOwner(products, " 2000000000015 ", "b")).toBeNull(); // its own code is fine
    expect(barcodeOwner(products, "012345678905")?.name).toBe("Kurti"); // UPC-A form of the same code
    expect(barcodeOwner(products, "")).toBeNull();
  });

  it("fills only missing barcodes, only in the chosen products, all unique", () => {
    const all = [
      { id: "a", variants: [{ barcode: "2000000000015" }, { barcode: "" }, {}] },
      { id: "b", variants: [{}] },
      { id: "c", variants: [{ barcode: "4006381333931" }] },
    ];
    const { changed, filled } = fillMissingBarcodes(all, new Set(["a", "c"]));
    expect(filled).toBe(2);
    expect(changed.map((p) => p.id)).toEqual(["a"]); // c had nothing missing, b wasn't chosen
    const codes = changed[0].variants.map((v) => v.barcode!);
    expect(codes[0]).toBe("2000000000015");
    expect(codes.slice(1).every(isValidEan13)).toBe(true);
    expect(new Set(codes).size).toBe(3);
  });
});
