import type { Lang, Numerals } from "./types";

const BN_DIGITS = "০১২৩৪৫৬৭৮৯";

export function toBanglaDigits(s: string) {
  return s.replace(/\d/g, (d) => BN_DIGITS[Number(d)]);
}

// en-IN gives the South-Asian 12,34,567 grouping the SRS asks for.
const nf0 = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
const nf2 = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

export type FmtOptions = { numerals: Numerals; lang: Lang };

export function makeFormatters({ numerals, lang }: FmtOptions) {
  const digits = (s: string) => (numerals === "bangla" ? toBanglaDigits(s) : s);

  const num = (n: number, decimals = false) => digits((decimals ? nf2 : nf0).format(n));

  const money = (n: number, opts: { sign?: boolean; decimals?: boolean } = {}) => {
    const abs = Math.abs(n);
    const body = num(abs, opts.decimals);
    const sign = n < 0 ? "−" : opts.sign && n > 0 ? "+" : "";
    return `${sign}৳${body}`;
  };

  /** 1.2L / 45.3K — for tight chart axes and widgets. */
  const compact = (n: number) => {
    const abs = Math.abs(n);
    let out: string;
    if (abs >= 1_00_00_000) out = `${trim(abs / 1_00_00_000)}${lang === "bn" ? " কোটি" : "Cr"}`;
    else if (abs >= 1_00_000) out = `${trim(abs / 1_00_000)}${lang === "bn" ? " লাখ" : "L"}`;
    else if (abs >= 1_000) out = `${trim(abs / 1_000)}${lang === "bn" ? " হা." : "K"}`;
    else out = String(Math.round(abs));
    return (n < 0 ? "−" : "") + digits(out);
  };

  const pct = (ratio: number, decimals = 0) => digits(`${(ratio * 100).toFixed(decimals)}%`);

  const date = (iso: string | Date) => {
    const d = typeof iso === "string" ? new Date(iso) : iso;
    const s = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
    return digits(s);
  };

  const dateShort = (iso: string | Date) => {
    const d = typeof iso === "string" ? new Date(iso) : iso;
    const m = (lang === "bn" ? MONTHS_BN : MONTHS_EN)[d.getMonth()];
    return digits(`${d.getDate()} ${m}`);
  };

  const time = (iso: string | Date) => {
    const d = typeof iso === "string" ? new Date(iso) : iso;
    let h = d.getHours();
    const am = h < 12;
    h = h % 12 || 12;
    const suffix = lang === "bn" ? (am ? " পূর্বাহ্ণ" : " অপরাহ্ণ") : am ? " am" : " pm";
    return digits(`${h}:${pad(d.getMinutes())}`) + suffix;
  };

  const relative = (iso: string | Date, now = Date.now()) => {
    const d = typeof iso === "string" ? new Date(iso) : iso;
    const s = Math.round((now - d.getTime()) / 1000);
    const bn = lang === "bn";
    if (s < 45) return bn ? "এইমাত্র" : "just now";
    const m = Math.round(s / 60);
    if (m < 60) return digits(bn ? `${m} মিনিট আগে` : `${m}m ago`);
    const h = Math.round(m / 60);
    if (h < 24) return digits(bn ? `${h} ঘণ্টা আগে` : `${h}h ago`);
    const days = Math.round(h / 24);
    if (days === 1) return bn ? "গতকাল" : "yesterday";
    if (days < 7) return digits(bn ? `${days} দিন আগে` : `${days}d ago`);
    return dateShort(d);
  };

  return { num, money, compact, pct, date, dateShort, time, relative, digits };
}

export type Formatters = ReturnType<typeof makeFormatters>;

const pad = (n: number) => String(n).padStart(2, "0");
const trim = (n: number) => (n >= 100 ? n.toFixed(0) : n >= 10 ? n.toFixed(1) : n.toFixed(2)).replace(/\.?0+$/, "");

export const MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const MONTHS_BN = ["জানু", "ফেব্রু", "মার্চ", "এপ্রি", "মে", "জুন", "জুলা", "আগ", "সেপ্টে", "অক্টো", "নভে", "ডিসে"];
export const DAYS_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const DAYS_BN = ["রবি", "সোম", "মঙ্গল", "বুধ", "বৃহঃ", "শুক্র", "শনি"];

export function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function daysAgo(n: number, from = new Date()) {
  const x = startOfDay(from);
  x.setDate(x.getDate() - n);
  return x;
}

export function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
