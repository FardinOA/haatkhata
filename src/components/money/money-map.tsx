"use client";

import { useState } from "react";
import { cn } from "../ui/core";
import { useFmt, useT } from "@/lib/hooks";

export type MapTab = "cod" | "dues" | "suppliers" | "expenses";

type Seg = {
  key: string;
  tab: MapTab | null;
  value: number;
  fill: string;
  label: string;
  detail: string;
};

const HATCH_CASH = "repeating-linear-gradient(135deg, var(--cash) 0 3px, color-mix(in oklab, var(--cash) 35%, white) 3px 7px)";
const HATCH_OUT = "repeating-linear-gradient(135deg, var(--ink-3) 0 2px, var(--sunken) 2px 6px)";

/**
 * One story on one scale: what's already in hand, what is on its way
 * (marigold — money not yet yours), and what is going out to suppliers.
 */
export function MoneyMap({
  inHand,
  inHandDetail,
  couriers,
  couriersDetail,
  customers,
  customersDetail,
  suppliers,
  suppliersDetail,
  onPick,
  active,
}: {
  inHand: number;
  inHandDetail: string;
  couriers: number;
  couriersDetail: string;
  customers: number;
  customersDetail: string;
  suppliers: number;
  suppliersDetail: string;
  onPick: (t: MapTab) => void;
  active: MapTab;
}) {
  const t = useT();
  const f = useFmt();
  const [hover, setHover] = useState<string | null>(null);
  const incoming = couriers + customers;
  const net = incoming - suppliers;
  const scale = Math.max(1, inHand + incoming, suppliers);

  const inSegs: Seg[] = [
    { key: "hand", tab: null, value: inHand, fill: "var(--color-ok)", label: t("Collected this week", "এই সপ্তাহে হাতে এসেছে"), detail: inHandDetail },
    { key: "cod", tab: "cod", value: couriers, fill: "var(--cash)", label: t("With couriers", "কুরিয়ারের কাছে"), detail: couriersDetail },
    { key: "dues", tab: "dues", value: customers, fill: HATCH_CASH, label: t("Owed by customers", "কাস্টমারের বাকি"), detail: customersDetail },
  ];
  const outSeg: Seg = { key: "sup", tab: "suppliers", value: suppliers, fill: HATCH_OUT, label: t("You owe suppliers", "সাপ্লায়ারকে দিতে হবে"), detail: suppliersDetail };

  const bar = (segs: Seg[]) => (
    <div className="flex h-4 w-full gap-[2px]">
      {segs
        .filter((s) => s.value > 0)
        .map((s, i, arr) => (
          <button
            key={s.key}
            type="button"
            disabled={!s.tab}
            onClick={() => s.tab && onPick(s.tab)}
            onPointerEnter={() => setHover(s.key)}
            onPointerLeave={() => setHover(null)}
            aria-label={`${s.label}: ${f.money(s.value)}`}
            className={cn(
              "h-full min-w-[6px] transition-[opacity,transform] duration-150 disabled:cursor-default",
              i === 0 && "rounded-l-[4px]",
              i === arr.length - 1 && "rounded-r-[4px]",
              hover && hover !== s.key ? "opacity-40" : "opacity-100",
            )}
            style={{ width: `${(s.value / scale) * 100}%`, background: s.fill }}
          />
        ))}
    </div>
  );

  return (
    <section aria-label={t("Where your money is", "আপনার টাকা কোথায়")} className="overflow-hidden rounded-lg border border-line bg-surface shadow-1">
      <div className="grid grid-cols-1 gap-6 p-5 md:grid-cols-[minmax(0,300px)_minmax(0,1fr)] md:gap-10 md:p-6">
        <div>
          <p className="text-[13px] text-ink-3">{t("Coming to you", "আপনার কাছে আসবে")}</p>
          <p className="figure mt-1 text-[44px] font-semibold leading-none text-ink">{f.money(incoming)}</p>
          <p className="mt-3 text-sm leading-relaxed text-ink-2">
            {suppliers > 0
              ? t(
                  `After paying suppliers ${f.money(suppliers)}, you'd be ${net >= 0 ? "up" : "short"} ${f.money(Math.abs(net))}.`,
                  `সাপ্লায়ারকে ${f.money(suppliers)} দেওয়ার পর আপনার ${net >= 0 ? "থাকবে" : "কম পড়বে"} ${f.money(Math.abs(net))}।`,
                )
              : t("You don't owe any supplier right now.", "এই মুহূর্তে কোনো সাপ্লায়ারের কাছে দেনা নেই।")}
          </p>
        </div>

        <div className="min-w-0 self-center">
          <div className="grid grid-cols-[44px_minmax(0,1fr)] items-center gap-x-3 gap-y-3">
            <span className="text-xs font-medium text-ink-3">{t("In", "আসছে")}</span>
            {bar(inSegs)}
            <span className="text-xs font-medium text-ink-3">{t("Out", "যাবে")}</span>
            {bar([outSeg])}
          </div>
          <ul className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 lg:grid-cols-4">
            {[...inSegs, outSeg].map((s) => {
              const Tag = s.tab ? "button" : "div";
              return (
                <li key={s.key}>
                  <Tag
                    {...(s.tab ? { type: "button" as const, onClick: () => onPick(s.tab!) } : {})}
                    onPointerEnter={() => setHover(s.key)}
                    onPointerLeave={() => setHover(null)}
                    className={cn(
                      "group -m-2 block w-[calc(100%+16px)] rounded-md p-2 text-left transition-colors",
                      s.tab && "hover:bg-surface-2",
                      s.tab && active === s.tab && "bg-surface-2",
                    )}
                  >
                    <span className="flex items-center gap-2 text-[13px] text-ink-2">
                      <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: s.fill }} aria-hidden />
                      <span className="truncate">{s.label}</span>
                    </span>
                    <span className="figure mt-1 block text-[22px] font-semibold leading-tight text-ink">{f.money(s.value)}</span>
                    <span className="mt-0.5 line-clamp-2 block text-xs text-ink-3">{s.detail}</span>
                  </Tag>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}
