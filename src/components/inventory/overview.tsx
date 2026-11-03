"use client";

import { ArrowRight, Hourglass, Truck } from "@phosphor-icons/react";
import Link from "next/link";
import { useMemo } from "react";
import { ProductThumb } from "../bits";
import { cn, EmptyState, Panel, PanelHeader } from "../ui/core";
import { useCan, useFmt, useNow, useT } from "@/lib/hooks";
import { lowStock } from "@/lib/analytics";
import { useStore } from "@/lib/store";

const DAY = 86_400_000;

export function InventoryOverview({ onRestock }: { onRestock: (variantIds: string[]) => void }) {
  const t = useT();
  const f = useFmt();
  const can = useCan();
  const products = useStore((s) => s.products);
  const categories = useStore((s) => s.categories);
  const movements = useStore((s) => s.movements);
  const showCost = can("view_cost");
  const now = useNow(10 * 60_000);

  const totals = useMemo(() => {
    let atCost = 0;
    let atSale = 0;
    let onHand = 0;
    let reserved = 0;
    let inTransit = 0;
    let damaged = 0;
    const byCat = new Map<string, { atSale: number; atCost: number; units: number }>();
    for (const p of products) {
      for (const v of p.variants) {
        const units = Math.max(0, v.onHand);
        atCost += units * v.cost;
        atSale += units * v.price;
        onHand += units;
        reserved += v.reserved;
        inTransit += v.inTransit;
        damaged += v.damaged;
        const c = byCat.get(p.categoryId) ?? { atSale: 0, atCost: 0, units: 0 };
        c.atSale += units * v.price;
        c.atCost += units * v.cost;
        c.units += units;
        byCat.set(p.categoryId, c);
      }
    }
    const cats = [...byCat.entries()]
      .map(([id, v]) => ({ id, ...v, cat: categories.find((c) => c.id === id) }))
      .filter((c) => c.units > 0)
      .sort((a, b) => b.atSale - a.atSale);
    return { atCost, atSale, onHand, reserved, inTransit, damaged, free: Math.max(0, onHand - reserved), cats };
  }, [products, categories]);

  const restock = useMemo(() => lowStock(products), [products]);

  const dead = useMemo(() => {
    const lastSale = new Map<string, string>();
    for (const m of movements) if (m.reason === "sale" && (!lastSale.get(m.variantId) || m.at > lastSale.get(m.variantId)!)) lastSale.set(m.variantId, m.at);
    return products
      .flatMap((p) =>
        p.variants
          .filter((v) => v.active && v.onHand > 0)
          .map((v) => {
            const last = lastSale.get(v.id);
            const days = last ? Math.floor((now - new Date(last).getTime()) / DAY) : null;
            return { p, v, last, days, value: v.onHand * (showCost ? v.cost : v.price) };
          }),
      )
      .filter((x) => x.days === null || x.days >= 30)
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [products, movements, showCost, now]);

  const units = totals.free + totals.reserved + totals.inTransit + totals.damaged || 1;
  const parts = [
    { key: "free", label: t("Ready to sell", "বিক্রির জন্য প্রস্তুত"), value: totals.free, color: "var(--brand)" },
    { key: "reserved", label: t("Held for confirmed orders", "নিশ্চিত অর্ডারে রিজার্ভ"), value: totals.reserved, color: "var(--color-st-confirmed)" },
    { key: "transit", label: t("With couriers", "কুরিয়ারের কাছে"), value: totals.inTransit, color: "var(--color-st-shipped)" },
    { key: "damaged", label: t("Damaged", "নষ্ট"), value: totals.damaged, color: "var(--color-st-returned)" },
  ];
  const maxCat = Math.max(1, ...totals.cats.map((c) => c.atSale));

  return (
    <div className="space-y-5">
      <Panel className="overflow-hidden">
        <div className="grid gap-6 p-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] md:p-6">
          <div>
            <p className="text-[13px] text-ink-3">{t("Stock on your shelves, at selling price", "শেলফের স্টক, বিক্রয়মূল্যে")}</p>
            <p className="figure mt-1 text-[40px] font-semibold leading-none text-ink md:text-[48px]">{f.money(totals.atSale)}</p>
            {showCost && (
              <p className="mt-3 text-[13.5px] text-ink-2">
                {t("Paid", "কেনা")} <span className="tnum font-semibold text-ink">{f.money(Math.round(totals.atCost))}</span>
                <span className="mx-2 text-ink-4">·</span>
                {t("profit waiting to be made", "সম্ভাব্য লাভ")} <span className="tnum font-semibold text-ok">{f.money(Math.round(totals.atSale - totals.atCost))}</span>
              </p>
            )}
          </div>
          <div>
            <div className="flex items-baseline justify-between text-[13px]">
              <span className="font-medium text-ink">{t("Where your units are", "আপনার পণ্য কোথায়")}</span>
              <span className="tnum text-ink-3">{t(`${f.num(totals.onHand + totals.inTransit)} units`, `${f.num(totals.onHand + totals.inTransit)}টি`)}</span>
            </div>
            <div className="mt-3 flex h-3 gap-0.5 overflow-hidden rounded-full" role="img" aria-label={parts.map((p) => `${p.label} ${p.value}`).join(", ")}>
              {parts.map((p) => (p.value > 0 ? <span key={p.key} style={{ width: `${(p.value / units) * 100}%`, background: p.color }} className="h-full first:rounded-l-full last:rounded-r-full" /> : null))}
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
              {parts.map((p) => (
                <div key={p.key}>
                  <dt className="flex items-center gap-1.5 text-xs text-ink-3">
                    <span className="size-2 rounded-full" style={{ background: p.color }} />
                    {p.label}
                  </dt>
                  <dd className="figure mt-0.5 text-xl font-semibold text-ink">{f.num(p.value)}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
        {totals.cats.length > 0 && (
          <div className="border-t border-line px-5 py-4 md:px-6">
            <p className="mb-3 text-[13px] font-medium text-ink">{t("Value by category", "ক্যাটাগরি অনুযায়ী মূল্য")}</p>
            <ul className="grid gap-x-8 gap-y-2.5 md:grid-cols-2">
              {totals.cats.map((c) => (
                <li key={c.id} className="grid grid-cols-[120px_minmax(0,1fr)_auto] items-center gap-3 text-[13px]">
                  <span className="truncate text-ink-2">{c.cat ? t(c.cat.name, c.cat.nameBn) : "—"}</span>
                  <span className="h-2 overflow-hidden rounded-full bg-sunken">
                    <span className="block h-full rounded-full bg-brand-400" style={{ width: `${(c.atSale / maxCat) * 100}%` }} />
                  </span>
                  <span className="tnum w-20 text-right font-medium text-ink">{f.compact(c.atSale)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel>
          <PanelHeader
            title={t("Needs restocking", "রিস্টক দরকার")}
            sub={t("At or below the alert level you set", "আপনার সতর্কতা সীমায় বা নিচে")}
            action={
              restock.length > 0 ? (
                <button type="button" onClick={() => onRestock(restock.map((r) => r.v.id))} className="inline-flex h-8 items-center gap-1.5 rounded-sm px-2 text-[13px] font-medium text-brand-ink hover:bg-brand-50">
                  <Truck className="size-4" />
                  {t("Restock all", "সব রিস্টক")}
                </button>
              ) : undefined
            }
          />
          {restock.length === 0 ? (
            <EmptyState className="py-10" title={t("Nothing is running low", "কিছুই কম নেই")} body={t("You'll see sizes and colours here before they sell out.", "শেষ হওয়ার আগে এখানে দেখাবে।")} />
          ) : (
            <ul className="mt-3 divide-y divide-line">
              {restock.slice(0, 8).map(({ p, v, avail }) => (
                <li key={v.id} className="flex items-center gap-3 px-5 py-2.5">
                  <ProductThumb product={p} size={36} rounded="sm" />
                  <Link href={`/products/${p.id}`} className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-medium text-ink hover:underline">{t.lang === "bn" ? p.nameBn || p.name : p.name}</span>
                    <span className="block truncate text-xs text-ink-3">
                      {Object.values(v.options).join(" / ") || v.sku} · {t(`alert at ${f.num(v.lowStock)}`, `সতর্কতা ${f.num(v.lowStock)}`)}
                    </span>
                  </Link>
                  <span className={cn("tnum w-14 text-right text-sm font-semibold", avail <= 0 ? "text-danger" : "text-warn")}>{avail <= 0 ? t("Out", "শেষ") : f.num(avail)}</span>
                  <button type="button" onClick={() => onRestock([v.id])} className="grid size-9 place-items-center rounded-sm text-ink-3 hover:bg-sunken hover:text-ink" aria-label={t("Restock", "রিস্টক")} title={t("Restock", "রিস্টক")}>
                    <ArrowRight className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {restock.length > 8 && <p className="px-5 py-3 text-xs text-ink-3">{t(`+${restock.length - 8} more`, `আরও ${f.num(restock.length - 8)}টি`)}</p>}
        </Panel>

        <Panel>
          <PanelHeader title={t("Not selling", "বিক্রি হচ্ছে না")} sub={t("In stock but no sale for 30 days or more", "স্টকে আছে কিন্তু ৩০+ দিন বিক্রি নেই")} />
          {dead.length === 0 ? (
            <EmptyState className="py-10" icon={<Hourglass />} title={t("Everything is moving", "সবকিছুই বিক্রি হচ্ছে")} body={t("Every item in stock sold at least once in the last 30 days.", "গত ৩০ দিনে স্টকের সব পণ্য অন্তত একবার বিক্রি হয়েছে।")} />
          ) : (
            <ul className="mt-3 divide-y divide-line">
              {dead.map(({ p, v, days, value }) => (
                <li key={v.id} className="flex items-center gap-3 px-5 py-2.5">
                  <ProductThumb product={p} size={36} rounded="sm" />
                  <Link href={`/products/${p.id}`} className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-medium text-ink hover:underline">{t.lang === "bn" ? p.nameBn || p.name : p.name}</span>
                    <span className="block truncate text-xs text-ink-3">
                      {Object.values(v.options).join(" / ") || v.sku} · {days === null ? t("never sold", "কখনো বিক্রি হয়নি") : t(`last sold ${days} days ago`, `শেষ বিক্রি ${f.num(days)} দিন আগে`)}
                    </span>
                  </Link>
                  <span className="text-right">
                    <span className="tnum block text-sm font-semibold text-ink">{f.money(Math.round(value))}</span>
                    <span className="tnum block text-xs text-ink-3">{t(`${f.num(v.onHand)} units`, `${f.num(v.onHand)}টি`)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          {dead.length > 0 && <p className="border-t border-line px-5 py-3 text-xs text-ink-3">{t("Try a bundle offer or a Facebook live to clear these.", "বান্ডেল অফার বা ফেসবুক লাইভে বিক্রি করে দেখুন।")}</p>}
        </Panel>
      </div>
    </div>
  );
}
