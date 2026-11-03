import { available } from "@/lib/domain";
import type { Product, Variant } from "@/lib/types";

/** Aggregate stock across a product's active variants. */
export function productStock(p: Product) {
  const vs = p.variants.filter((v) => v.active);
  const sum = (k: keyof Pick<Variant, "onHand" | "reserved" | "inTransit" | "damaged" | "lowStock">) => vs.reduce((s, v) => s + v[k], 0);
  const avail = vs.reduce((s, v) => s + Math.max(0, available(v)), 0);
  const out = vs.filter((v) => available(v) <= 0).length;
  const low = vs.filter((v) => available(v) > 0 && available(v) <= v.lowStock).length;
  return {
    onHand: sum("onHand"),
    reserved: sum("reserved"),
    inTransit: sum("inTransit"),
    damaged: sum("damaged"),
    lowStock: sum("lowStock"),
    available: avail,
    out,
    low,
    variants: vs.length,
  };
}

export function priceRange(p: Product) {
  const prices = p.variants.filter((v) => v.active).map((v) => v.price);
  if (!prices.length) return { min: 0, max: 0 };
  return { min: Math.min(...prices), max: Math.max(...prices) };
}

export function avgCost(p: Product) {
  const vs = p.variants.filter((v) => v.active);
  if (!vs.length) return 0;
  return vs.reduce((s, v) => s + v.cost, 0) / vs.length;
}

export function margin(price: number, cost: number) {
  return price > 0 ? (price - cost) / price : 0;
}

export function variantLabel(v: Pick<Variant, "options">) {
  return Object.values(v.options).join(" / ");
}

/** "Colour" / "Color" values, used to draw swatch dots on cards. */
export function colourValues(p: Product) {
  const ot = p.optionTypes.find((o) => /colou?r|রং/i.test(o.name));
  return ot?.values ?? [];
}

const NAMED: Record<string, string> = {
  red: "#B23A48", teal: "#1F7A7A", "off-white": "#EFE9DD", ivory: "#F3EBD8", white: "#F6F6F2", black: "#1D1F21",
  mustard: "#D79A1E", indigo: "#33449E", green: "#2F7D4A", peach: "#F2A88B", mint: "#9ED8C0", navy: "#22325E",
  rust: "#B4532A", sky: "#8EC3E6", beige: "#D9C7A6", "dusty rose": "#C99098", olive: "#7A7A3A", magenta: "#B0247A",
  gold: "#C99A2E", rose: "#D77C8C", pink: "#E58FB0", blue: "#2F5FAF", yellow: "#E5BC2B", grey: "#8A9097", gray: "#8A9097",
  brown: "#6B4A33", purple: "#6B3FA0", orange: "#E07A2E", maroon: "#6E1F2B",
};

export function swatchFor(name: string) {
  return NAMED[name.trim().toLowerCase()] ?? null;
}

/* ------------------------------------------------------------ CSV */

/** RFC-4180-ish parser: quoted fields, escaped quotes, CRLF. */
export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

export function toCSV(rows: (string | number | undefined | null)[][]) {
  return rows
    .map((r) =>
      r
        .map((c) => {
          const s = c === undefined || c === null ? "" : String(c);
          return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(","),
    )
    .join("\r\n");
}

export function downloadText(filename: string, text: string, type = "text/csv;charset=utf-8") {
  const blob = new Blob(["﻿" + text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ------------------------------------------------------------ images */

/** Downscales an image file to ≤ max px on its long side and returns a JPEG data URL. */
export async function compressImage(file: File, max = 800, quality = 0.8): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * scale);
    const h = Math.round(img.naturalHeight * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unavailable");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", quality);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Next free SKU number for a prefix, given all SKUs in the business. */
export function nextSku(prefix: string, taken: Set<string>, start = 101) {
  let n = start;
  while (taken.has(`${prefix}-${n}`)) n++;
  return `${prefix}-${n}`;
}

export function skuPrefixFrom(name: string) {
  const letters = name
    .replace(/[^A-Za-z ]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.slice(0, w.length > 3 ? 2 : 1))
    .join("")
    .toUpperCase();
  return (letters || "PRD").slice(0, 3).padEnd(3, "X");
}
