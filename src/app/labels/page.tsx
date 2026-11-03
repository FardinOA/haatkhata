"use client";

import { Printer, Tag, Trash } from "@phosphor-icons/react";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { ProductThumb } from "@/components/bits";
import { PrintFrame, PrintToolbar } from "@/components/invoice/print-frame";
import { printKey, usePrintGate } from "@/components/invoice/print-gate";
import { VariantPicker } from "@/components/inventory/variant-picker";
import { Barcode } from "@/components/products/barcode";
import { Button, cn, EmptyState, IconButton, Segmented, Stepper, Switch } from "@/components/ui/core";
import { useFmt, useT } from "@/lib/hooks";
import { getVariant, useStore } from "@/lib/store";

/** Barcode label sheets (FR-PRD-04): A4 3×8 sheets or 38×25 mm label-printer rolls. */
export default function LabelsPage() {
  return <PrintFrame>{() => <Labels />}</PrintFrame>;
}

type Sheet = "a4" | "roll";
const A4 = { cols: 3, rows: 8, w: 63.5, h: 33.9, top: 13.5, left: 7.2, gapX: 2.5, gapY: 0 };

function Labels() {
  const t = useT();
  const f = useFmt();
  const params = useSearchParams();
  const products = useStore((s) => s.products);
  const business = useStore((s) => s.business);
  const [lines, setLines] = useState<{ variantId: string; qty: number }[]>(() =>
    (params.get("v") ?? "")
      .split(",")
      .filter(Boolean)
      .map((x) => {
        const [variantId, q] = x.split(":");
        return { variantId, qty: Math.max(1, Number(q) || 1) };
      })
      .filter((l) => getVariant(products, l.variantId)),
  );
  const [sheet, setSheet] = useState<Sheet>("a4");
  const [showPrice, setShowPrice] = useState(true);
  const [showShop, setShowShop] = useState(true);
  const gate = usePrintGate();

  const labels = useMemo(
    () =>
      lines.flatMap((l) => {
        const hit = getVariant(products, l.variantId);
        return hit ? Array.from({ length: l.qty }, () => hit) : [];
      }),
    [lines, products],
  );
  const perPage = sheet === "a4" ? A4.cols * A4.rows : 1;
  const pages = Array.from({ length: Math.ceil(labels.length / perPage) }, (_, i) => labels.slice(i * perPage, (i + 1) * perPage));
  const exclude = useMemo(() => new Set(lines.map((l) => l.variantId)), [lines]);

  const label = (hit: (typeof labels)[number], i: number) => (
    <div
      key={i}
      className="flex flex-col overflow-hidden bg-white text-black"
      style={{ width: `${sheet === "a4" ? A4.w : 38}mm`, height: `${sheet === "a4" ? A4.h : 25}mm`, padding: sheet === "a4" ? "2.2mm 3mm" : "1.2mm 1.6mm" }}
    >
      <div className="flex items-baseline justify-between gap-1" style={{ fontSize: sheet === "a4" ? "7.5pt" : "6pt", lineHeight: 1.15 }}>
        <span className="truncate font-semibold">{hit.p.name}</span>
        {showPrice && <span className="shrink-0 font-bold">৳{hit.v.price.toLocaleString("en-IN")}</span>}
      </div>
      <div className="truncate text-[#444]" style={{ fontSize: sheet === "a4" ? "6.5pt" : "5pt", lineHeight: 1.2 }}>
        {Object.values(hit.v.options).join(" / ") || hit.v.sku}
        {showShop && ` · ${business.name}`}
      </div>
      <Barcode value={hit.v.barcode || hit.v.sku} height={34} className="mt-auto w-full" />
    </div>
  );

  return (
    <div className="min-h-dvh bg-canvas">
      <style>{`@media print { @page { size: ${sheet === "a4" ? "A4" : "38mm 25mm"}; margin: 0; } body { background: #fff; } }`}</style>
      <PrintToolbar back="/products" title={t("Print barcode labels", "বারকোড লেবেল প্রিন্ট")} sub={t(`${labels.length} labels on ${pages.length} ${sheet === "a4" ? "sheets" : "labels"}`, `${f.num(labels.length)}টি লেবেল`)}>
        <Segmented<Sheet>
          size="sm"
          value={sheet}
          onChange={setSheet}
          options={[
            { value: "a4", label: t("A4 sheet · 3×8", "A4 শিট · ৩×৮") },
            { value: "roll", label: t("Label printer · 38×25 mm", "লেবেল প্রিন্টার · ৩৮×২৫") },
          ]}
        />
        <Button variant="primary" icon={<Printer className="size-4" />} disabled={!labels.length} onClick={async () => (await gate.claim([printKey("labels", lines.map((l) => l.variantId))])) && window.print()}>
          {t("Print", "প্রিন্ট")}
        </Button>
      </PrintToolbar>

      <div className="mx-auto grid max-w-[1100px] gap-6 px-4 py-6 md:px-6 lg:grid-cols-[340px_minmax(0,1fr)]">
        <aside className="no-print space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-lg border border-line bg-surface p-4 shadow-1">
            <VariantPicker onPick={({ v }) => setLines((ls) => [...ls, { variantId: v.id, qty: 1 }])} exclude={exclude} placeholder={t("Add a product", "পণ্য যোগ করুন")} />
            <ul className="mt-3 divide-y divide-line">
              {lines.map((l) => {
                const hit = getVariant(products, l.variantId);
                if (!hit) return null;
                return (
                  <li key={l.variantId} className="flex items-center gap-2.5 py-2.5">
                    <ProductThumb product={hit.p} size={32} rounded="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-ink">{hit.p.name}</span>
                      <span className="block truncate text-xs text-ink-3">{hit.v.barcode || hit.v.sku}</span>
                    </span>
                    <Stepper size="sm" value={l.qty} min={1} max={500} onChange={(n) => setLines((ls) => ls.map((x) => (x.variantId === l.variantId ? { ...x, qty: n } : x)))} />
                    <IconButton label={t("Remove", "সরান")} size="sm" onClick={() => setLines((ls) => ls.filter((x) => x.variantId !== l.variantId))}>
                      <Trash className="size-4" />
                    </IconButton>
                  </li>
                );
              })}
            </ul>
            {lines.length > 0 && (
              <Button size="sm" variant="ghost" className="mt-1" onClick={() => setLines((ls) => ls.map((l) => ({ ...l, qty: Math.max(1, getVariant(products, l.variantId)?.v.onHand ?? 1) })))}>
                {t("One label per unit in stock", "স্টকের প্রতিটির জন্য একটি")}
              </Button>
            )}
          </div>
          <div className="space-y-3 rounded-lg border border-line bg-surface p-4 shadow-1">
            <label className="flex items-center justify-between gap-3 text-[13px] text-ink-2">
              {t("Show price", "দাম দেখান")}
              <Switch size="sm" checked={showPrice} onChange={setShowPrice} label={t("Show price", "দাম দেখান")} />
            </label>
            <label className="flex items-center justify-between gap-3 text-[13px] text-ink-2">
              {t("Show shop name", "দোকানের নাম")}
              <Switch size="sm" checked={showShop} onChange={setShowShop} label={t("Show shop name", "দোকানের নাম")} />
            </label>
            <p className="text-xs text-ink-3">{t("Products without a barcode print their SKU as Code 128 — any scanner reads it, and so does the order screen.", "বারকোড না থাকলে SKU কোড-১২৮ হিসেবে প্রিন্ট হয় — যেকোনো স্ক্যানার ও অর্ডার স্ক্রিন পড়তে পারে।")}</p>
            {gate.note && <p className="text-xs font-medium text-cash-ink">{gate.note}</p>}
          </div>
        </aside>

        <main className="min-w-0" data-print-gated>
          {!labels.length ? (
            <div className="no-print rounded-lg border border-line bg-surface">
              <EmptyState icon={<Tag />} title={t("Choose what to label", "কোন পণ্যের লেবেল")} body={t("Add products on the left. Set how many labels each needs.", "বাঁ দিকে পণ্য যোগ করুন। প্রতিটির কয়টি লেবেল লাগবে তা দিন।")} />
            </div>
          ) : (
            <div className={cn("flex flex-col items-center gap-6 print:gap-0", sheet === "roll" && "flex-row flex-wrap justify-center")}>
              {pages.map((page, pi) =>
                sheet === "a4" ? (
                  <div key={pi} className="relative bg-white shadow-2 print:shadow-none" style={{ width: "210mm", height: "297mm", padding: `${A4.top}mm ${A4.left}mm`, breakAfter: "page" }}>
                    <div className="grid" style={{ gridTemplateColumns: `repeat(${A4.cols}, ${A4.w}mm)`, gridAutoRows: `${A4.h}mm`, columnGap: `${A4.gapX}mm`, rowGap: `${A4.gapY}mm` }}>
                      {page.map((hit, i) => (
                        <div key={i} className="outline outline-1 outline-dashed outline-line print:outline-0">
                          {label(hit, i)}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div key={pi} className="bg-white shadow-2 print:shadow-none" style={{ breakAfter: "page" }}>
                    {label(page[0], 0)}
                  </div>
                ),
              )}
            </div>
          )}
        </main>
      </div>
      {gate.ui}
    </div>
  );
}
