/**
 * Barcode encoders for product labels (FR-PRD-04). Output is a list of
 * module widths (bar, space, bar, …) so any renderer — SVG on screen,
 * a printer raster — can draw it at its own resolution.
 */

/* ------------------------------------------------------------ Code 128 */

// Bar/space widths for symbol values 0–106 (103–105 = Start A/B/C, 106 = Stop).
const C128 = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213",
  "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132",
  "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211",
  "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313",
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331",
  "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111",
  "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214",
  "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111",
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141",
  "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141",
  "114131", "311141", "411131", "211412", "211214", "211232", "2331112",
];
export const CODE128_PATTERNS = C128;

const START_B = 104;
const START_C = 105;
const CODE_B = 100;
const CODE_C = 99;
const STOP = 106;

/** Symbol values for `text`, switching to code set C for runs of 4+ digits (shorter bars). */
export function code128Values(text: string): number[] {
  if (!text.length) throw new Error("Nothing to encode");
  for (const ch of text) {
    const c = ch.charCodeAt(0);
    if (c < 32 || c > 126) throw new Error(`Can't encode "${ch}" in a barcode`);
  }
  const digitRun = (i: number) => {
    let n = 0;
    while (i + n < text.length && text[i + n] >= "0" && text[i + n] <= "9") n++;
    return n;
  };
  const values: number[] = [];
  let set: "B" | "C";
  let i = 0;
  if (digitRun(0) >= 4) {
    set = "C";
    values.push(START_C);
  } else {
    set = "B";
    values.push(START_B);
  }
  while (i < text.length) {
    const run = digitRun(i);
    if (set === "C") {
      if (run >= 2) {
        values.push(Number(text.slice(i, i + 2)));
        i += 2;
        continue;
      }
      values.push(CODE_B);
      set = "B";
    }
    // In set B: switch to C for an even run of 4+ digits (or a run that ends the text).
    if (run >= 4 && (run % 2 === 0 || i + run === text.length)) {
      if (run % 2 === 1) {
        values.push(text.charCodeAt(i) - 32);
        i++;
      }
      values.push(CODE_C);
      set = "C";
      continue;
    }
    values.push(text.charCodeAt(i) - 32);
    i++;
  }
  const check = values.reduce((sum, v, k) => sum + v * (k === 0 ? 1 : k), 0) % 103;
  return [...values, check, STOP];
}

/** Module widths, bar first. Quiet zones are the caller's job (10 modules each side). */
export function code128(text: string): number[] {
  return code128Values(text).flatMap((v) => C128[v].split("").map(Number));
}

/* ------------------------------------------------------------ EAN-13 */

const EAN_L = ["0001101", "0011001", "0010011", "0111101", "0100011", "0110001", "0101111", "0111011", "0110111", "0001011"];
const EAN_G = ["0100111", "0110011", "0011011", "0100001", "0011101", "0111001", "0000101", "0010001", "0001001", "0010111"];
const EAN_R = ["1110010", "1100110", "1101100", "1000010", "1011100", "1001110", "1010000", "1000100", "1001000", "1110100"];
const PARITY = ["LLLLLL", "LLGLGG", "LLGGLG", "LLGGGL", "LGLLGG", "LGGLLG", "LGGGLL", "LGLGLG", "LGLGGL", "LGGLGL"];

export function eanCheckDigit(first12: string) {
  if (!/^\d{12}$/.test(first12)) throw new Error("EAN-13 needs 12 digits before the check digit");
  const sum = first12.split("").reduce((s, d, i) => s + Number(d) * (i % 2 ? 3 : 1), 0);
  return String((10 - (sum % 10)) % 10);
}

export function isValidEan13(code: string) {
  return /^\d{13}$/.test(code) && eanCheckDigit(code.slice(0, 12)) === code[12];
}

/** 95-module bit string ("1" = bar). Accepts 12 digits (check digit added) or a valid 13. */
export function ean13Bits(code: string): string {
  const full = code.length === 12 ? code + eanCheckDigit(code) : code;
  if (!isValidEan13(full)) throw new Error("Not a valid EAN-13");
  const parity = PARITY[Number(full[0])];
  let bits = "101";
  for (let i = 1; i <= 6; i++) bits += (parity[i - 1] === "L" ? EAN_L : EAN_G)[Number(full[i])];
  bits += "01010";
  for (let i = 7; i <= 12; i++) bits += EAN_R[Number(full[i])];
  return bits + "101";
}

/** Converts a bit string into bar/space widths, bar first. */
export function bitsToWidths(bits: string): number[] {
  const out: number[] = [];
  let run = 1;
  for (let i = 1; i <= bits.length; i++) {
    if (bits[i] === bits[i - 1]) run++;
    else {
      out.push(run);
      run = 1;
    }
  }
  return out;
}

/** The best symbology for a value: EAN-13 for retail barcodes, Code 128 for everything else. */
export function barcodeFor(value: string): { kind: "ean13" | "code128"; widths: number[]; text: string } {
  if (isValidEan13(value)) return { kind: "ean13", widths: bitsToWidths(ean13Bits(value)), text: value };
  return { kind: "code128", widths: code128(value), text: value };
}

/**
 * A fresh in-store EAN-13 (GS1 prefix 2 = restricted circulation, never
 * clashes with a manufacturer's code) that isn't in `taken`.
 */
export function inStoreEan13(taken: Set<string>): string {
  for (;;) {
    let body = "2";
    while (body.length < 12) body += Math.floor(Math.random() * 10);
    const code = body + eanCheckDigit(body);
    if (!taken.has(code)) return code;
  }
}

/**
 * The variant a scanned code points at — by barcode or SKU, ignoring case.
 * UPC-A scans (12 digits) also match the same code stored as EAN-13 ("0…").
 */
export function findByCode<P extends { variants: { sku: string; barcode?: string }[] }>(products: P[], raw: string): { p: P; v: P["variants"][number] } | null {
  const code = raw.trim().toLowerCase();
  if (!code) return null;
  const alts = /^\d{12}$/.test(code) ? [code, `0${code}`] : [code];
  for (const p of products) {
    const v = p.variants.find((x) => alts.includes(x.barcode?.trim().toLowerCase() ?? "") || alts.includes(x.sku.toLowerCase()));
    if (v) return { p, v };
  }
  return null;
}
