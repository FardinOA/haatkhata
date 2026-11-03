"use client";

import { Barcode, MagnifyingGlass, X } from "@phosphor-icons/react";
import { forwardRef, useMemo, useState } from "react";
import { ProductThumb } from "@/components/bits";
import { cn, Kbd } from "@/components/ui/core";
import { useToast } from "@/components/ui/overlays";
import { available } from "@/lib/domain";
import { useFmt, useT } from "@/lib/hooks";
import { useStore } from "@/lib/store";
import type { Product } from "@/lib/types";
import { usePos } from "./use-pos";
import { VariantPicker } from "./variant-picker";

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9ঀ-৿]+/g, " ")
    .trim();

/** Edit distance ≤ 1 — forgives a single typo ("panjbi", "kurtti"). */
function near(a: string, b: string) {
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

function matchScore(p: Product, q: string) {
  const terms = norm(q).split(" ").filter(Boolean);
  if (!terms.length) return 1;
  const words = norm(`${p.name} ${p.nameBn ?? ""} ${p.tags.join(" ")} ${p.variants.map((v) => `${v.sku} ${v.barcode ?? ""} ${Object.values(v.options).join(" ")}`).join(" ")}`).split(" ");
  let score = 0;
  for (const t of terms) {
    if (words.some((w) => w.startsWith(t))) score += 3;
    else if (words.some((w) => w.includes(t))) score += 2;
    else if (t.length >= 4 && words.some((w) => near(w, t) || near(w.slice(0, t.length), t))) score += 1;
    else return 0;
  }
  return score;
}

export const ProductFinder = forwardRef<HTMLInputElement, { className?: string }>(function ProductFinder({ className }, searchRef) {
  const t = useT();
  const f = useFmt();
  const toast = useToast();
  const { addVariant, draft } = usePos();
  const products = useStore((s) => s.products);
  const categories = useStore((s) => s.categories);
  const orders = useStore((s) => s.orders);
  const allowNegative = useStore((s) => s.pos.allowNegativeStock);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("all");
  const [picker, setPicker] = useState<Product | null>(null);

  const popularity = useMemo(() => {
    const m = new Map<string, number>();
    for (const o of orders) if (o.status !== "cancelled") for (const l of o.lines) m.set(l.productId, (m.get(l.productId) ?? 0) + l.qty);
    return m;
  }, [orders]);

  const inCart = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of draft.lines) m.set(l.productId, (m.get(l.productId) ?? 0) + l.qty);
    return m;
  }, [draft.lines]);

  const active = products.filter((p) => p.status === "active");
  const list = useMemo(() => {
    const scored = active
      .filter((p) => cat === "all" || p.categoryId === cat)
      .map((p) => ({ p, s: matchScore(p, q) }))
      .filter((x) => x.s > 0);
    return scored.sort((a, b) => b.s - a.s || (popularity.get(b.p.id) ?? 0) - (popularity.get(a.p.id) ?? 0)).map((x) => x.p);
  }, [active, cat, q, popularity]);

  const catCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of active) m.set(p.categoryId, (m.get(p.categoryId) ?? 0) + 1);
    return m;
  }, [active]);

  const choose = (p: Product) => {
    const live = p.variants.filter((v) => v.active);
    if (live.length === 1) {
      const v = live[0];
      if (!allowNegative && available(v) <= 0) {
        toast({ title: t(`${p.name} is out of stock`, `${p.nameBn ?? p.name} স্টকে নেই`), tone: "warn" });
        return;
      }
      addVariant(v.id);
      return;
    }
    setPicker(p);
  };

  /** Keyboard-wedge scanners type the code and press Enter. */
  const onEnter = () => {
    const code = q.trim().toLowerCase();
    if (!code) return;
    for (const p of active) {
      const v = p.variants.find((x) => x.sku.toLowerCase() === code || x.barcode?.toLowerCase() === code);
      if (v) {
        addVariant(v.id);
        toast({ title: t("Added to cart", "কার্টে যোগ হয়েছে"), body: `${p.name}${Object.keys(v.options).length ? ` · ${Object.values(v.options).join(" / ")}` : ""}` });
        setQ("");
        return;
      }
    }
    if (list.length === 1) {
      choose(list[0]);
      setQ("");
    }
  };

  return (
    <div className={cn("flex min-w-0 flex-col", className)}>
      <div className="sticky top-14 z-10 -mx-4 bg-canvas/90 px-4 pb-3 pt-1 backdrop-blur md:top-16 md:-mx-8 md:px-8">
        <div className="relative">
          <MagnifyingGlass className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-ink-3" />
          <input
            ref={searchRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onEnter();
              } else if (e.key === "Escape") setQ("");
            }}
            placeholder={t("Search or scan — name, SKU, barcode", "খুঁজুন বা স্ক্যান করুন — নাম, SKU, বারকোড")}
            aria-label={t("Search products", "পণ্য খুঁজুন")}
            className="h-12 w-full rounded-lg border border-line bg-surface pl-12 pr-28 text-[15px] text-ink shadow-1 placeholder:text-ink-4 focus:border-brand focus:shadow-[var(--ring)] focus:outline-none"
          />
          <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-2">
            {q ? (
              <button type="button" onClick={() => setQ("")} className="grid size-7 place-items-center rounded-full text-ink-3 hover:bg-sunken" aria-label={t("Clear", "মুছুন")}>
                <X className="size-4" />
              </button>
            ) : (
              <Barcode className="size-5 text-ink-4" aria-hidden />
            )}
            <span className="hidden md:inline"><Kbd>F2</Kbd></span>
          </div>
        </div>
        <div className="no-scrollbar -mx-1 mt-3 flex gap-1.5 overflow-x-auto px-1 [mask-image:linear-gradient(to_right,#000_90%,transparent)] pr-8" role="tablist" aria-label={t("Categories", "ক্যাটাগরি")}>
          {[{ id: "all", name: "All", nameBn: "সব" }, ...categories.filter((c) => catCounts.get(c.id))].map((c) => {
            const on = cat === c.id;
            const n = c.id === "all" ? active.length : (catCounts.get(c.id) ?? 0);
            return (
              <button
                key={c.id}
                role="tab"
                aria-selected={on}
                type="button"
                onClick={() => setCat(c.id)}
                className={cn(
                  "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-medium transition-colors",
                  on ? "border-ink bg-ink text-white" : "border-line bg-surface text-ink-2 hover:border-line-strong hover:text-ink",
                )}
              >
                {t(c.name, c.nameBn)}
                <span className={cn("tnum text-xs", on ? "text-white/60" : "text-ink-4")}>{f.num(n)}</span>
              </button>
            );
          })}
        </div>
      </div>

      {list.length === 0 ? (
        <div className="grid place-items-center rounded-lg border border-dashed border-line-strong px-6 py-16 text-center">
          <p className="text-[15px] font-semibold text-ink">{t(`No products match “${q}”`, `“${q}” এর সাথে কোনো পণ্য মেলেনি`)}</p>
          <p className="mt-1 max-w-xs text-sm text-ink-3">{t("Check the spelling, try the SKU, or scan the barcode.", "বানান দেখুন, SKU দিয়ে খুঁজুন বা বারকোড স্ক্যান করুন।")}</p>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {list.map((p) => {
            const live = p.variants.filter((v) => v.active);
            const avail = live.reduce((s, v) => s + Math.max(0, available(v)), 0);
            const low = live.some((v) => available(v) > 0 && available(v) <= v.lowStock);
            const out = avail <= 0;
            const prices = live.map((v) => v.price);
            const minP = Math.min(...prices);
            const maxP = Math.max(...prices);
            const count = inCart.get(p.id) ?? 0;
            const optSummary = p.optionTypes.map((o) => `${f.num(o.values.length)} ${o.name.toLowerCase()}`).join(" · ");
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => choose(p)}
                  className={cn(
                    "group relative flex w-full flex-col rounded-lg border bg-surface p-1.5 text-left shadow-1 transition-[border-color,box-shadow,transform] duration-150 hover:-translate-y-0.5 hover:shadow-2 active:translate-y-0",
                    count ? "border-brand ring-2 ring-brand/15" : "border-line hover:border-line-strong",
                    out && !allowNegative && "opacity-60",
                  )}
                >
                  <span className="relative block aspect-[5/4] overflow-hidden rounded-md">
                    <ProductThumb product={p} size={400} rounded="sm" className="absolute left-0 top-1/2 !h-auto !w-full -translate-y-1/2 !rounded-none" />
                    {count > 0 && (
                      <span className="tnum absolute right-2 top-2 grid h-7 min-w-7 place-items-center rounded-full bg-brand px-2 text-[13px] font-semibold text-brand-contrast shadow-2">
                        {f.num(count)}
                      </span>
                    )}
                    {out && (
                      <span className="absolute inset-x-2 bottom-2 rounded-sm bg-surface/95 py-1 text-center text-xs font-semibold text-danger">{t("Out of stock", "স্টক নেই")}</span>
                    )}
                  </span>
                  <span className="flex flex-1 flex-col px-1.5 pb-1 pt-2.5">
                    <span className="line-clamp-2 text-[13.5px] font-medium leading-snug text-ink">{t(p.name, p.nameBn ?? p.name)}</span>
                    {optSummary && <span className="mt-0.5 truncate text-xs text-ink-3">{optSummary}</span>}
                    <span className="mt-auto flex items-end justify-between gap-2 pt-2">
                      <span className="figure text-[17px] font-semibold text-ink">
                        {f.money(minP)}
                        {maxP > minP && <span className="text-ink-3">+</span>}
                      </span>
                      {!out && (
                        <span
                          className="tnum flex items-center gap-1 text-xs text-ink-3"
                          title={low ? t("Some options are running low", "কিছু অপশনের স্টক কম") : undefined}
                        >
                          <span className={cn("size-1.5 rounded-full", low ? "bg-warn" : "bg-ok")} />
                          {f.num(avail)} {t("left", "আছে")}
                        </span>
                      )}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <VariantPicker product={picker} onClose={() => setPicker(null)} />
    </div>
  );
});
