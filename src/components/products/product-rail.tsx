"use client";

import Link from "next/link";
import { useMemo } from "react";
import { StockMeter } from "../bits";
import { Sparkline } from "../charts";
import { cn, Panel, PanelHeader } from "../ui/core";
import { CardArt } from "./card-art";
import { productStock, variantLabel } from "./utils";
import { useFmt, useT } from "@/lib/hooks";
import { daysAgo, sameDay } from "@/lib/format";
import { REASON_LABEL } from "@/lib/labels";
import { useStore } from "@/lib/store";
import type { Product } from "@/lib/types";

export function ProductRail({ product }: { product: Product }) {
  const t = useT();
  const f = useFmt();
  const orders = useStore((s) => s.orders);
  const movements = useStore((s) => s.movements);

  const sold = useMemo(() => {
    const from = daysAgo(29);
    const days = Array.from({ length: 30 }, (_, i) => daysAgo(29 - i));
    const perDay = days.map(() => 0);
    let units = 0;
    let revenue = 0;
    for (const o of orders) {
      if (o.status === "draft" || o.status === "cancelled") continue;
      const d = new Date(o.createdAt);
      if (d < from) continue;
      for (const l of o.lines) {
        if (l.productId !== product.id) continue;
        const u = l.qty - l.returnedQty;
        units += u;
        revenue += u * l.price - l.discount;
        const i = days.findIndex((x) => sameDay(x, d));
        if (i >= 0) perDay[i] += u;
      }
    }
    return { units, revenue, perDay };
  }, [orders, product.id]);

  const recent = useMemo(
    () =>
      movements
        .filter((m) => m.productId === product.id)
        .sort((a, b) => b.at.localeCompare(a.at))
        .slice(0, 10),
    [movements, product.id],
  );

  const s = productStock(product);
  const vName = (id: string) => {
    const v = product.variants.find((x) => x.id === id);
    return v ? variantLabel(v) || t("Default", "ডিফল্ট") : "—";
  };

  return (
    <>
      <Panel className="overflow-hidden">
        <CardArt product={product} hover={false} className="relative aspect-[16/9]" />
        <div className="grid grid-cols-3 divide-x divide-line border-b border-line">
          <Stat label={t("Available", "আছে")} value={f.num(s.available)} tone={s.out ? "danger" : s.low ? "warn" : undefined} />
          <Stat label={t("Held", "রিজার্ভ")} value={f.num(s.reserved)} />
          <Stat label={t("On the way", "পথে")} value={f.num(s.inTransit)} />
        </div>
        <div className="flex items-end justify-between gap-3 px-4 py-4">
          <div>
            <p className="text-xs text-ink-3">{t("Sold in the last 30 days", "গত ৩০ দিনে বিক্রি")}</p>
            <p className="figure mt-1 text-2xl font-semibold text-ink">
              {f.num(sold.units)} <span className="text-sm font-normal text-ink-3">{t("units", "টি")}</span>
            </p>
            <p className="tnum text-[13px] text-ink-2">{f.money(sold.revenue)}</p>
          </div>
          <Sparkline values={sold.perDay} width={120} height={40} />
        </div>
      </Panel>

      <Panel>
        <PanelHeader title={t("Stock by variant", "ভ্যারিয়েন্ট অনুযায়ী স্টক")} sub={t("Available to sell, after confirmed orders", "নিশ্চিত অর্ডারের পর যা বিক্রি করা যাবে")} />
        <ul className="space-y-3.5 px-5 pb-5 pt-4">
          {product.variants.map((v) => (
            <li key={v.id} className={cn(!v.active && "opacity-50")}>
              <p className="mb-1 flex items-baseline justify-between gap-2 text-[13px]">
                <span className="truncate font-medium text-ink">{variantLabel(v) || t("Default", "ডিফল্ট")}</span>
                <span className="font-mono text-[11px] text-ink-4">{v.sku}</span>
              </p>
              <StockMeter v={v} />
            </li>
          ))}
        </ul>
      </Panel>

      <Panel>
        <PanelHeader
          title={t("Recent stock movements", "সাম্প্রতিক স্টক পরিবর্তন")}
          action={
            <Link href={`/inventory?tab=ledger&product=${product.id}`} className="text-[13px] font-medium text-brand-ink hover:underline">
              {t("Full ledger", "পুরো লেজার")}
            </Link>
          }
        />
        {recent.length === 0 ? (
          <p className="px-5 pb-5 pt-3 text-[13px] text-ink-3">{t("No movements yet. Stock in or a sale will show here.", "এখনো কিছু নেই। স্টক ইন বা বিক্রি এখানে দেখাবে।")}</p>
        ) : (
          <ul className="mt-2 divide-y divide-line">
            {recent.map((m) => (
              <li key={m.id} className="flex items-center gap-3 px-5 py-2.5">
                <span className={cn("tnum w-11 shrink-0 text-right text-sm font-semibold", m.delta > 0 ? "text-ok" : "text-danger")}>
                  {m.delta > 0 ? "+" : "−"}
                  {f.num(Math.abs(m.delta))}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] text-ink">
                    {t.pick(REASON_LABEL[m.reason])} · <span className="text-ink-3">{vName(m.variantId)}</span>
                  </span>
                  <span className="block truncate text-xs text-ink-4">
                    {m.refId?.startsWith("o_") ? (
                      <Link href={`/orders?id=${m.refId}`} className="hover:text-brand-ink hover:underline">
                        {m.refLabel}
                      </Link>
                    ) : (
                      m.refLabel
                    )}{" "}
                    · {f.relative(m.at)}
                  </span>
                </span>
                <span className="tnum shrink-0 text-xs text-ink-3">= {f.num(m.balance)}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "danger" | "warn" }) {
  return (
    <div className="px-4 py-3">
      <p className="text-xs text-ink-3">{label}</p>
      <p className={cn("figure mt-0.5 text-xl font-semibold", tone === "danger" ? "text-danger" : tone === "warn" ? "text-warn" : "text-ink")}>{value}</p>
    </div>
  );
}
