/**
 * Brand theming: turns one accent hex into a full 50–950 ramp in OKLCH so any
 * colour a seller picks (or that we pull out of their logo) yields usable
 * tints, borders and AA-safe text colours.
 */

export type ThemePreset = {
  id: string;
  name: string;
  nameBn: string;
  hex: string;
  note: string;
};

// Named after Bangladeshi textiles, flowers and places so they read as ours.
export const THEME_PRESETS: ThemePreset[] = [
  { id: "jamdani", name: "Jamdani", nameBn: "জামদানি", hex: "#0E6B53", note: "Bottle green of Dhakai weave" },
  { id: "kantha", name: "Kantha", nameBn: "কাঁথা", hex: "#3446C4", note: "Indigo running stitch" },
  { id: "shapla", name: "Shapla", nameBn: "শাপলা", hex: "#C2306B", note: "Water-lily pink" },
  { id: "padma", name: "Padma", nameBn: "পদ্মা", hex: "#0A7CA8", note: "River-water blue" },
  { id: "shimul", name: "Shimul", nameBn: "শিমুল", hex: "#D2401F", note: "Silk-cotton blossom red" },
  { id: "sorisha", name: "Sorisha", nameBn: "সরিষা", hex: "#E0A100", note: "Mustard field yellow" },
  { id: "jarul", name: "Jarul", nameBn: "জারুল", hex: "#7A45C2", note: "Monsoon lilac" },
  { id: "matir", name: "Matir", nameBn: "মাটির", hex: "#6B4A33", note: "Clay pot brown" },
];

type RGB = [number, number, number];
type OKLCH = [number, number, number];

export function hexToRgb(hex: string): RGB {
  let h = hex.replace("#", "").trim();
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex([r, g, b]: RGB): string {
  const c = (v: number) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`.toUpperCase();
}

export function isHex(v: string) {
  return /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v.trim());
}

const toLinear = (c: number) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
};
const fromLinear = (v: number) => {
  const c = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
  return c * 255;
};

export function rgbToOklch(rgb: RGB): OKLCH {
  const [r, g, b] = rgb.map(toLinear);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const C = Math.sqrt(A * A + B * B);
  let H = (Math.atan2(B, A) * 180) / Math.PI;
  if (H < 0) H += 360;
  return [L, C, H];
}

function oklchToLinear([L, C, H]: OKLCH): RGB {
  const a = C * Math.cos((H * Math.PI) / 180);
  const b = C * Math.sin((H * Math.PI) / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

const inGamut = (lin: RGB) => lin.every((v) => v >= -0.0005 && v <= 1.0005);

/** Converts to sRGB, reducing chroma until the colour fits the gamut. */
export function oklchToHex([L, C, H]: OKLCH): string {
  let c = C;
  let lin = oklchToLinear([L, c, H]);
  while (!inGamut(lin) && c > 0.001) {
    c *= 0.94;
    lin = oklchToLinear([L, c, H]);
  }
  return rgbToHex(lin.map(fromLinear) as RGB);
}

export function luminance(hex: string) {
  const [r, g, b] = hexToRgb(hex).map(toLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string) {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

const STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;
const L_TARGET = [0.975, 0.945, 0.895, 0.82, 0.72, 0.625, 0.53, 0.455, 0.385, 0.32, 0.235];
const C_SCALE = [0.13, 0.24, 0.42, 0.66, 0.86, 0.98, 1, 0.94, 0.84, 0.72, 0.56];

export type Ramp = Record<(typeof STEPS)[number], string>;

export function buildRamp(hex: string): Ramp {
  const [, C, H] = rgbToOklch(hexToRgb(hex));
  // Very grey picks still get a hint of hue so tints don't go flat.
  const chroma = Math.max(C, 0.02);
  const ramp = {} as Ramp;
  STEPS.forEach((step, i) => {
    ramp[step] = oklchToHex([L_TARGET[i], chroma * C_SCALE[i], H]);
  });
  return ramp;
}

const INK = "#16181A";

/** CSS custom properties for a given accent. */
export function themeVars(hex: string): Record<string, string> {
  const brand = rgbToHex(hexToRgb(hex));
  const ramp = buildRamp(brand);
  const brandContrast = contrast(brand, "#FFFFFF") >= 3.2 ? "#FFFFFF" : INK;
  // Text in brand colour must clear 4.5:1 on white.
  const brandInk =
    contrast(brand, "#FFFFFF") >= 4.6
      ? brand
      : ([ramp[600], ramp[700], ramp[800], ramp[900]].find((c) => contrast(c, "#FFFFFF") >= 4.6) ?? ramp[900]);
  const vars: Record<string, string> = {
    "--brand": brand,
    "--brand-contrast": brandContrast,
    "--brand-ink": brandInk,
  };
  STEPS.forEach((s) => (vars[`--brand-${s}`] = ramp[s]));
  return vars;
}

export type CanvasTone = "stone" | "mist" | "sand" | "white" | "tint";
export type Density = "comfortable" | "compact";
export type Corners = "sharp" | "soft" | "round";
export type DisplayFont = "anek" | "hind" | "baloo" | "geist";
export type SidebarStyle = "light" | "tinted" | "bold";

export const CORNER_PX: Record<Corners, number> = { sharp: 6, soft: 12, round: 18 };

export type ThemeSettings = {
  accent: string;
  canvas: CanvasTone;
  density: Density;
  corners: Corners;
  display: DisplayFont;
  sidebar: SidebarStyle;
};

export const DEFAULT_THEME: ThemeSettings = {
  accent: "#0E6B53",
  canvas: "stone",
  density: "comfortable",
  corners: "soft",
  display: "anek",
  sidebar: "light",
};

export const THEME_STORAGE_KEY = "bk-theme-boot";

/** Everything the pre-paint boot script needs, in one flat object. */
export function bootPayload(t: ThemeSettings, lang: "en" | "bn") {
  return {
    vars: { ...themeVars(t.accent), "--r": `${CORNER_PX[t.corners]}px` },
    attrs: { "data-canvas": t.canvas, "data-density": t.density, "data-display": t.display, lang },
  };
}

export function applyTheme(t: ThemeSettings, lang: "en" | "bn") {
  if (typeof document === "undefined") return;
  const payload = bootPayload(t, lang);
  const root = document.documentElement;
  Object.entries(payload.vars).forEach(([k, v]) => root.style.setProperty(k, v));
  Object.entries(payload.attrs).forEach(([k, v]) => root.setAttribute(k, v));
  try {
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* storage can be unavailable in private mode */
  }
}

/** Inline, synchronous script: applies the saved theme before first paint. */
export const THEME_BOOT_SCRIPT = `(function(){try{var p=JSON.parse(localStorage.getItem("${THEME_STORAGE_KEY}")||"null");if(!p)return;var r=document.documentElement;for(var k in p.vars)r.style.setProperty(k,p.vars[k]);for(var a in p.attrs)r.setAttribute(a,p.attrs[a]);}catch(e){}})();`;

/**
 * Pulls a handful of distinctive colours out of an uploaded logo. Skips near
 * white/black/grey pixels, buckets by hue and returns the most common
 * saturated buckets — good brand-accent candidates.
 */
export async function extractLogoColors(dataUrl: string, max = 5): Promise<string[]> {
  const img = new Image();
  img.src = dataUrl;
  await img.decode();
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return [];
  ctx.drawImage(img, 0, 0, size, size);
  const { data } = ctx.getImageData(0, 0, size, size);
  const buckets = new Map<number, { n: number; r: number; g: number; b: number; c: number }>();
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    const rgb: RGB = [data[i], data[i + 1], data[i + 2]];
    const [L, C, H] = rgbToOklch(rgb);
    if (C < 0.045 || L > 0.93 || L < 0.18) continue;
    const key = Math.round(H / 20) * 10 + Math.min(2, Math.floor(L * 3));
    const b = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0, c: 0 };
    b.n++;
    b.r += rgb[0];
    b.g += rgb[1];
    b.b += rgb[2];
    b.c += C;
    buckets.set(key, b);
  }
  return [...buckets.values()]
    .filter((b) => b.n > 6)
    .sort((a, b) => b.n * (b.c / b.n) - a.n * (a.c / a.n))
    .slice(0, max)
    .map((b) => rgbToHex([b.r / b.n, b.g / b.n, b.b / b.n]));
}
