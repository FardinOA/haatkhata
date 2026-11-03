"use client";

import { Barcode, MagnifyingGlass } from "@phosphor-icons/react";
import { useId, useMemo, useRef, useState } from "react";
import { ProductThumb } from "../bits";
import { cn, Input } from "../ui/core";
import { useFmt, useT } from "@/lib/hooks";
import { available } from "@/lib/domain";
import { useStore } from "@/lib/store";
import type { Product, Variant } from "@/lib/types";

export type PickedVariant = { p: Product; v: Variant };

/** Search-as-you-type picker over every SKU. Enter picks the highlighted row; a full barcode match picks instantly (scanner friendly). */
export function VariantPicker({
  onPick,
  placeholder,
  exclude,
  autoFocus,
  className,
}: {
  onPick: (x: PickedVariant) => void;
  placeholder?: string;
  exclude?: Set<string>;
  autoFocus?: boolean;
  className?: string;
}) {
  const t = useT();
  const f = useFmt();
  const products = useStore((s) => s.products);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState(0);
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const all = useMemo(() => products.flatMap((p) => p.variants.filter((v) => v.active).map((v) => ({ p, v }))), [products]);

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const pool = all.filter((x) => !exclude?.has(x.v.id));
    if (!needle) return pool.slice(0, 8);
    const words = needle.split(/\s+/);
    return pool
      .filter(({ p, v }) => {
        const hay = `${p.name} ${p.nameBn ?? ""} ${v.sku} ${v.barcode ?? ""} ${Object.values(v.options).join(" ")}`.toLowerCase();
        return words.every((w) => hay.includes(w));
      })
      .slice(0, 8);
  }, [all, q, exclude]);

  const pick = (x: PickedVariant) => {
    onPick(x);
    setQ("");
    setIdx(0);
    inputRef.current?.focus();
  };

  return (
    <div className={cn("relative", className)}>
      <Input
        ref={inputRef}
        autoFocus={autoFocus}
        role="combobox"
        aria-expanded={open && results.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        leading={<MagnifyingGlass className="size-4" />}
        trailing={<Barcode className="mr-1 size-4 text-ink-4" />}
        value={q}
        placeholder={placeholder ?? t("Search product, SKU or scan a barcode", "পণ্য, SKU খুঁজুন বা বারকোড স্ক্যান করুন")}
        onClick={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onChange={(e) => {
          const val = e.target.value;
          setQ(val);
          setIdx(0);
          setOpen(true);
          const exact = all.find((x) => x.v.barcode && x.v.barcode === val.trim());
          if (exact && !exclude?.has(exact.v.id)) pick(exact);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            if (!open) return setOpen(true);
            setIdx((i) => Math.min(results.length - 1, i + 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setIdx((i) => Math.max(0, i - 1));
          } else if (e.key === "Enter") {
            e.preventDefault();
            if (results[idx]) pick(results[idx]);
          } else if (e.key === "Escape") setOpen(false);
        }}
      />
      {open && (
        <div id={listId} role="listbox" className="absolute inset-x-0 top-full z-40 mt-1.5 max-h-80 overflow-y-auto rounded-md border border-line bg-surface p-1 shadow-3">
          {results.length === 0 ? (
            <p className="px-3 py-4 text-center text-[13px] text-ink-3">{t("No product matches. Check the spelling or SKU.", "কোনো পণ্য মেলেনি। বানান বা SKU দেখুন।")}</p>
          ) : (
            results.map((x, i) => {
              const a = available(x.v);
              return (
                <button
                  key={x.v.id}
                  type="button"
                  role="option"
                  aria-selected={i === idx}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseMove={() => setIdx(i)}
                  onClick={() => pick(x)}
                  className={cn("flex w-full items-center gap-3 rounded-sm px-2 py-1.5 text-left", i === idx && "bg-brand-50")}
                >
                  <ProductThumb product={x.p} size={34} rounded="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-medium text-ink">
                      {t.lang === "bn" ? x.p.nameBn || x.p.name : x.p.name}
                      {Object.keys(x.v.options).length > 0 && <span className="font-normal text-ink-3"> · {Object.values(x.v.options).join(" / ")}</span>}
                    </span>
                    <span className="block font-mono text-[11px] text-ink-4">{x.v.sku}</span>
                  </span>
                  <span className={cn("tnum shrink-0 text-xs", a <= 0 ? "text-danger" : a <= x.v.lowStock ? "text-warn" : "text-ink-3")}>
                    {t(`${f.num(x.v.onHand)} on hand`, `${f.num(x.v.onHand)}টি আছে`)}
                  </span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
