/**
 * ESC/POS command encoder for 58/80 mm thermal printers (FR-INV-06).
 *
 * Text commands only carry ASCII, so Bangla receipts are printed as a raster
 * image of the rendered receipt (`raster`), which also keeps the logo and the
 * exact layout. Pure and dependency-free so it can be unit tested.
 */

const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

/** Printable dot widths at 203 dpi. */
export const PAPER_DOTS = { thermal58: 384, thermal80: 576 } as const;

export class EscPos {
  private bytes: number[] = [];

  private push(...b: number[]) {
    this.bytes.push(...b);
    return this;
  }

  init() {
    return this.push(ESC, 0x40);
  }

  align(a: "left" | "center" | "right") {
    return this.push(ESC, 0x61, a === "left" ? 0 : a === "center" ? 1 : 2);
  }

  bold(on: boolean) {
    return this.push(ESC, 0x45, on ? 1 : 0);
  }

  /** Character size multiplier, 1–8 in each direction. */
  size(width: number, height: number) {
    const w = Math.min(8, Math.max(1, width)) - 1;
    const h = Math.min(8, Math.max(1, height)) - 1;
    return this.push(GS, 0x21, (w << 4) | h);
  }

  /** ASCII text; anything outside printable ASCII becomes "?". */
  text(s: string) {
    for (const ch of s) {
      const c = ch.charCodeAt(0);
      this.bytes.push(c >= 32 && c < 127 ? c : 0x3f);
    }
    return this;
  }

  line(s = "") {
    return this.text(s).push(LF);
  }

  feed(lines = 1) {
    return this.push(ESC, 0x64, Math.min(255, Math.max(0, lines)));
  }

  /** Native QR (model 2). Size 1–16, error correction M. */
  qr(data: string, moduleSize = 6) {
    const d = [...data].map((c) => c.charCodeAt(0) & 0xff);
    const len = d.length + 3;
    return this.push(GS, 0x28, 0x6b, 4, 0, 0x31, 0x41, 0x32, 0x00) // model 2
      .push(GS, 0x28, 0x6b, 3, 0, 0x31, 0x43, Math.min(16, Math.max(1, moduleSize))) // module size
      .push(GS, 0x28, 0x6b, 3, 0, 0x31, 0x45, 0x31) // error correction M
      .push(GS, 0x28, 0x6b, len & 0xff, len >> 8, 0x31, 0x50, 0x30, ...d) // store
      .push(GS, 0x28, 0x6b, 3, 0, 0x31, 0x51, 0x30); // print
  }

  /**
   * Raster bit image (GS v 0). `pixels` is a row-major array of 0/1
   * (1 = black) with the given width; the width is padded to whole bytes.
   */
  raster(pixels: Uint8Array | number[], width: number) {
    const height = Math.floor(pixels.length / width);
    const bytesPerRow = Math.ceil(width / 8);
    this.push(GS, 0x76, 0x30, 0, bytesPerRow & 0xff, bytesPerRow >> 8, height & 0xff, height >> 8);
    for (let y = 0; y < height; y++)
      for (let bx = 0; bx < bytesPerRow; bx++) {
        let byte = 0;
        for (let bit = 0; bit < 8; bit++) {
          const x = bx * 8 + bit;
          if (x < width && pixels[y * width + x]) byte |= 0x80 >> bit;
        }
        this.bytes.push(byte);
      }
    return this;
  }

  /** Feed a little and cut (partial cut where supported). */
  cut() {
    return this.feed(3).push(GS, 0x56, 0x42, 0x00);
  }

  build() {
    return new Uint8Array(this.bytes);
  }
}

/**
 * Converts RGBA pixels to 1-bit with Floyd–Steinberg dithering, so logos and
 * Bangla text stay legible on a thermal head.
 */
export function toMonochrome(rgba: Uint8ClampedArray | number[], width: number, height: number, threshold = 160): Uint8Array {
  const gray = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const a = rgba[i * 4 + 3] / 255;
    // Transparent pixels are paper (white).
    const l = 0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2];
    gray[i] = l * a + 255 * (1 - a);
  }
  const out = new Uint8Array(width * height);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const old = gray[i];
      const black = old < threshold;
      out[i] = black ? 1 : 0;
      const err = old - (black ? 0 : 255);
      if (x + 1 < width) gray[i + 1] += (err * 7) / 16;
      if (y + 1 < height) {
        if (x > 0) gray[i + width - 1] += (err * 3) / 16;
        gray[i + width] += (err * 5) / 16;
        if (x + 1 < width) gray[i + width + 1] += err / 16;
      }
    }
  return out;
}

/** Splits a job into BLE-sized chunks (many printers accept ≤ 180 bytes per write). */
export function chunk(data: Uint8Array, size = 180): Uint8Array[] {
  const out: Uint8Array[] = [];
  for (let i = 0; i < data.length; i += size) out.push(data.slice(i, i + size));
  return out;
}
