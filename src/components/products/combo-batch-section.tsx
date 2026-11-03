"use client";

import { Hourglass, Package, Trash } from "@phosphor-icons/react";
import { useMemo } from "react";
import { ProductThumb } from "../bits";
import { VariantPicker } from "../inventory/variant-picker";
import { Badge, IconButton, Panel, Stepper, Switch } from "../ui/core";
import { available } from "@/lib/domain";
import { useCan, useFmt, useT } from "@/lib/hooks";
import { getVariant, useStore } from "@/lib/store";
import type { BundleComponent } from "@/lib/types";

/**
 * Two product-level switches that change how stock behaves:
 * batch & expiry tracking (FR-STK-12) and combos/bundles (FR-PRD-09).
 */
export function ComboBatchSection({
  productId,
  trackBatches,
  combo,
  bundle,
  hasOptions,
  onChange,
}: {
  productId: string;
  trackBatches: boolean;
  combo: boolean;
  bundle: BundleComponent[];
  hasOptions: boolean;
  onChange: (patch: { trackBatches?: boolean; combo?: boolean; bundle?: BundleComponent[] }) => void;
}) {
  const t = useT();
  const f = useFmt();
  const can = useCan();
  const products = useStore((s) => s.products);
  const isCombo = combo;
  // Combos can't contain other combos or themselves.
  const exclude = useMemo(
    () => new Set([...products.filter((p) => p.bundle?.length || p.id === productId).flatMap((p) => p.variants.map((v) => v.id)), ...bundle.map((b) => b.variantId)]),
    [products, productId, bundle],
  );
  const parts = bundle.map((b) => ({ b, hit: getVariant(products, b.variantId) }));
  const canMake = parts.length ? Math.max(0, Math.min(...parts.map(({ b, hit }) => (hit ? Math.floor(available(hit.v) / b.qty) : 0)))) : 0;
  const partsCost = parts.reduce((s, { b, hit }) => s + (hit ? hit.v.cost * b.qty : 0), 0);
  const partsPrice = parts.reduce((s, { b, hit }) => s + (hit ? hit.v.price * b.qty : 0), 0);

  return (
    <Panel className="p-5 md:p-6">
      <h3 className="font-display text-[17px] font-semibold text-ink">{t("How stock works for this product", "এই পণ্যের স্টক কীভাবে চলবে")}</h3>
      <div className="mt-4 divide-y divide-line rounded-md border border-line">
        <div className="flex items-start gap-3 p-4">
          <span className="grid size-9 shrink-0 place-items-center rounded-md bg-sunken text-ink-2">
            <Package className="size-[18px]" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-ink">{t("This is a combo", "এটি একটি কম্বো")}</p>
            <p className="mt-0.5 text-[13px] text-ink-3">{t("Made of other items you sell. It has no stock of its own — selling one takes each item inside from stock.", "অন্য পণ্য দিয়ে তৈরি। নিজস্ব স্টক নেই — একটি বিক্রি হলে ভেতরের প্রতিটি পণ্য স্টক থেকে কমে।")}</p>
          </div>
          <Switch
            checked={isCombo}
            label={t("This is a combo", "এটি একটি কম্বো")}
            disabled={!can("edit_price")}
            onChange={(on) => onChange(on ? { combo: true, trackBatches: false } : { combo: false, bundle: [] })}
          />
        </div>
        {isCombo && (
          <div className="space-y-3 bg-surface-2/60 p-4">
            {hasOptions && <p className="rounded-md bg-warn-soft px-3 py-2 text-[13px] text-warn">{t("Combos sell as a single item. Remove the sizes/colours below.", "কম্বো একটি পণ্য হিসেবে বিক্রি হয়। নিচের সাইজ/রং সরিয়ে দিন।")}</p>}
            <VariantPicker onPick={({ v }) => onChange({ bundle: [...bundle, { variantId: v.id, qty: 1 }] })} exclude={exclude} placeholder={t("Add an item to the combo", "কম্বোতে পণ্য যোগ করুন")} />
            {parts.length > 0 && (
              <ul className="divide-y divide-line rounded-md border border-line bg-surface">
                {parts.map(({ b, hit }) => (
                  <li key={b.variantId} className="flex items-center gap-3 px-3 py-2.5">
                    {hit && <ProductThumb product={hit.p} size={34} rounded="sm" />}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-medium text-ink">{hit?.p.name ?? b.variantId}</span>
                      <span className="block truncate text-xs text-ink-3">
                        {hit ? Object.values(hit.v.options).join(" / ") || hit.v.sku : ""} · {t(`${hit ? available(hit.v) : 0} free`, `${f.num(hit ? available(hit.v) : 0)}টি আছে`)}
                      </span>
                    </span>
                    <Stepper size="sm" value={b.qty} min={1} onChange={(n) => onChange({ bundle: bundle.map((x) => (x.variantId === b.variantId ? { ...x, qty: n } : x)) })} />
                    <IconButton label={t("Remove", "সরান")} size="sm" onClick={() => onChange({ bundle: bundle.filter((x) => x.variantId !== b.variantId) })}>
                      <Trash className="size-4" />
                    </IconButton>
                  </li>
                ))}
              </ul>
            )}
            {parts.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 text-[13px]">
                <Badge tone={canMake > 0 ? "ok" : "danger"}>{t(`You can make ${canMake}`, `${f.num(canMake)}টি বানানো যাবে`)}</Badge>
                <span className="text-ink-3">
                  {t("Items bought separately", "আলাদা কিনলে")} <b className="tnum font-semibold text-ink">{f.money(partsPrice)}</b>
                  {can("view_cost") && (
                    <>
                      {" · "}
                      {t("cost", "খরচ")} <b className="tnum font-semibold text-ink">{f.money(partsCost)}</b>
                    </>
                  )}
                </span>
              </div>
            )}
          </div>
        )}
        <div className="flex items-start gap-3 p-4">
          <span className="grid size-9 shrink-0 place-items-center rounded-md bg-sunken text-ink-2">
            <Hourglass className="size-[18px]" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-ink">{t("Track batches & expiry", "ব্যাচ ও মেয়াদ ট্র্যাক")}</p>
            <p className="mt-0.5 text-[13px] text-ink-3">
              {isCombo
                ? t("Combos follow the batches of the items inside.", "কম্বো ভেতরের পণ্যের ব্যাচ অনুসরণ করে।")
                : t("For cosmetics, food or medicine. Record a batch and expiry on each stock in; the oldest batch sells first.", "কসমেটিকস, খাবার বা ওষুধের জন্য। প্রতিটি স্টক ইনে ব্যাচ ও মেয়াদ দিন; পুরোনো ব্যাচ আগে বিক্রি হবে।")}
            </p>
          </div>
          <Switch checked={trackBatches} disabled={isCombo || !can("edit_price")} label={t("Track batches & expiry", "ব্যাচ ও মেয়াদ ট্র্যাক")} onChange={(on) => onChange({ trackBatches: on })} />
        </div>
      </div>
    </Panel>
  );
}
