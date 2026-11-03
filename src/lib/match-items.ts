/**
 * Free, rule-based product matching for pasted chats: which catalogue items a
 * customer asked for, and how many, without an AI call. Runs the same in the
 * browser and on the server. Understands Bangla and English product names,
 * SKUs, sizes, Banglish colour words and quantities written as 2ta, duita,
 * ২টা, x2 or "2 pcs".
 *
 * Pass it the part of the chat that isn't name, phone or address (the
 * `leftover` from parseMessage), so "House 38" never reads as shoe size 38.
 */
export type MatchEntry = { productId: string; variantId: string; sku: string; name: string; nameBn?: string; options: string };
export type ItemMatch = { productId?: string; variantId?: string; text: string; qty: number };

const BN_DIGITS = "০১২৩৪৫৬৭৮৯";

/** Banglish and Bangla words a customer uses for a colour or size, mapped to how catalogues usually spell them. */
const SYNONYMS: Record<string, string> = {
  lal: "red", লাল: "red",
  kalo: "black", kala: "black", কালো: "black",
  sada: "white", shada: "white", সাদা: "white",
  nil: "blue", neel: "blue", নীল: "blue",
  sobuj: "green", shobuj: "green", সবুজ: "green",
  holud: "yellow", হলুদ: "yellow",
  golapi: "pink", gulabi: "pink", গোলাপি: "pink",
  meroon: "maroon", merun: "maroon", মেরুন: "maroon",
  khoyeri: "brown", খয়েরি: "brown",
  ash: "grey", gray: "grey", ছাই: "grey",
  komla: "orange", কমলা: "orange",
  beguni: "purple", বেগুনি: "purple",
  small: "s", medium: "m", large: "l",
};

const QTY_WORDS: Record<string, number> = {
  ek: 1, ekta: 1, akta: 1, ekti: 1, one: 1, একটা: 1, একটি: 1,
  dui: 2, duita: 2, duta: 2, duiti: 2, two: 2, দুইটা: 2, দুটো: 2, দুইটি: 2, দুটি: 2,
  tin: 3, tinta: 3, tinti: 3, three: 3, তিনটা: 3, তিনটি: 3,
  char: 4, charta: 4, four: 4, চারটা: 4, চারটি: 4,
  pach: 5, pachta: 5, panch: 5, five: 5, পাঁচটা: 5, পাঁচটি: 5,
};

/** Words that appear in many product names and say nothing about which product is meant. */
const STOP = new Set(["the", "and", "for", "with", "new", "pcs", "piece", "size", "set", "item", "price", "dam", "koto", "ache", "available", "lagbe", "chai", "din", "den", "apu", "vai", "bhai", "please", "plz"]);

const toAscii = (s: string) => s.replace(/[০-৯]/g, (d) => String(BN_DIGITS.indexOf(d)));
const norm = (s: string) => toAscii(s).toLowerCase();
/** Words, keeping Bangla vowel signs (\p{M}) attached to their letters. */
const words = (s: string) => norm(s).split(/[^\p{L}\p{N}\p{M}]+/u).filter(Boolean);
const canon = (w: string) => SYNONYMS[w] ?? w;
const isBangla = (w: string) => /[ঀ-৿]/.test(w);
const significant = (w: string) => !STOP.has(w) && (isBangla(w) ? w.length >= 2 : w.length >= 3);

/** One edit apart (substitution, insertion or deletion): "kurtti" still finds "kurti". */
function nearlyEqual(a: string, b: string) {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else {
      i++;
      j++;
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

/** How well one word from the chat matches one word of a product name: 1 exact, 0.6 close, 0 not at all. */
function wordScore(said: string, name: string) {
  if (said === name) return 1;
  if (isBangla(said) || isBangla(name)) return said.length >= 2 && (name.startsWith(said) || said.startsWith(name)) ? 0.6 : 0;
  if (said.length >= 4 && (name.startsWith(said) || said.startsWith(name))) return 0.6;
  if (name.length >= 5 && nearlyEqual(said, name)) return 0.6;
  return 0;
}

export function readQty(text: string): number | undefined {
  const s = norm(text);
  const m = /(?:^|[^\d])(\d{1,2})\s*(?:ta|ti|টা|টি|pcs|pc|pieces|piece|x)(?![a-z])/.exec(s) ?? /(?:^|\s)x\s*(\d{1,2})(?!\d)/.exec(s);
  if (m) return Number(m[1]) || undefined;
  for (const w of words(text)) if (QTY_WORDS[w]) return QTY_WORDS[w];
  return undefined;
}

type ProductInfo = { productId: string; entries: MatchEntry[]; nameWords: string[] };

export function matchItems(text: string, catalog: MatchEntry[]): ItemMatch[] {
  if (!text.trim() || !catalog.length) return [];

  const products = new Map<string, ProductInfo>();
  for (const e of catalog) {
    const p = products.get(e.productId) ?? { productId: e.productId, entries: [], nameWords: [...new Set([...words(e.name), ...words(e.nameBn ?? "")].filter(significant))] };
    p.entries.push(e);
    products.set(e.productId, p);
  }
  // Rarer words count for more: "jamdani" picks one saree, "saree" alone could be any.
  const spread = new Map<string, number>();
  for (const p of products.values()) for (const w of p.nameWords) spread.set(w, (spread.get(w) ?? 0) + 1);

  /** The one product these words point to, "tie" when several fit equally well, or undefined for no product at all. */
  const bestProduct = (said: string[]): ProductInfo | "tie" | undefined => {
    let best: { p: ProductInfo; score: number } | null = null;
    let tied = false;
    for (const p of products.values()) {
      let score = 0;
      for (const w of p.nameWords) {
        const hit = Math.max(0, ...said.map((s) => wordScore(s, w)));
        score += hit / (spread.get(w) ?? 1);
      }
      if (score <= 0) continue;
      if (!best || score > best.score + 1e-9) {
        best = { p, score };
        tied = false;
      } else if (Math.abs(score - best.score) <= 1e-9) tied = true;
    }
    return tied ? "tie" : best?.p;
  };

  const bySku = (chunk: string) => {
    const s = norm(chunk);
    return catalog.find((e) => e.sku && new RegExp(`(^|[^a-z0-9])${norm(e.sku).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![a-z0-9])`).test(s));
  };

  /** One requested item; without a product it was asked for but couldn't be pinned to one product. */
  type Draft = { text: string; qty?: number; said: Set<string>; product?: ProductInfo; sku?: MatchEntry };
  const drafts: Draft[] = [];
  const chunks = text
    .split(/\n|[,;+·।]|\s(?:and|ar|আর|o)\s/i)
    .map((c) => c.trim())
    .filter(Boolean);

  for (const chunk of chunks) {
    const said = words(chunk).map(canon);
    const sku = bySku(chunk);
    const product = sku ? products.get(sku.productId) : bestProduct(said);
    const qty = readQty(chunk);
    if (product === "tie") drafts.push({ text: chunk, qty, said: new Set(said) });
    else if (product) drafts.push({ text: chunk, qty, said: new Set(said), product, sku });
    else if (drafts.length) {
      // A follow-on fragment ("indigo", "M size", "2ta") describes the item before it.
      const last = drafts[drafts.length - 1];
      last.text = `${last.text}, ${chunk}`;
      said.forEach((w) => last.said.add(w));
      last.qty ??= qty;
    }
  }

  const out: ItemMatch[] = [];
  const seen = new Set<string>();
  for (const d of drafts) {
    const p = d.product;
    if (!p) {
      out.push({ text: d.text, qty: Math.min(99, d.qty ?? 1) });
      continue;
    }
    let variant = d.sku;
    if (!variant) {
      const scored = p.entries.map((e) => ({ e, n: words(e.options).map(canon).filter((w) => d.said.has(w)).length }));
      const top = Math.max(...scored.map((x) => x.n));
      const leaders = scored.filter((x) => x.n === top);
      if (p.entries.length === 1) variant = p.entries[0];
      else if (top > 0 && leaders.length === 1) variant = leaders[0].e;
    }
    const key = variant?.variantId ?? `p:${p.productId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ productId: p.productId, variantId: variant?.variantId, text: d.text, qty: Math.min(99, d.qty ?? 1) });
  }
  return out;
}
