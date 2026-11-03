"use client";

import { useId } from "react";
import { StatusGlyph } from "../bits";
import { cn } from "../ui/core";
import { orderTotals } from "@/lib/domain";
import { useFmt, useT } from "@/lib/hooks";
import { STATUS_COLOR, STATUS_LABEL } from "@/lib/labels";
import type { Order, OrderStatus } from "@/lib/types";
import type { OrderFilters } from "./util";

type StageKey = "draft" | "confirmed" | "packed" | "shipped" | "delivered" | "returned";
const MAIN: StageKey[] = ["draft", "confirmed", "packed", "shipped"];

type Stat = { count: number; value: number };

function stats(orders: Order[]) {
  const out = {} as Record<StageKey | "cancelled", Stat>;
  for (const k of [...MAIN, "delivered", "returned", "cancelled"] as const) out[k] = { count: 0, value: 0 };
  for (const o of orders) {
    const key: StageKey | "cancelled" = o.status === "partially_returned" ? "returned" : (o.status as StageKey | "cancelled");
    out[key].count++;
    out[key].value += orderTotals(o).total;
  }
  return out;
}

/**
 * The parcel journey: every order in view, placed on the road it travels.
 * Shipped forks into Delivered or Returned. Each station filters the list.
 */
export function JourneyStrip({ orders, active, onPick }: { orders: Order[]; active: OrderFilters["status"]; onPick: (s: OrderFilters["status"]) => void }) {
  const t = useT();
  const f = useFmt();
  const s = stats(orders);
  const done = s.delivered.count + s.returned.count;
  const returnRate = done ? s.returned.count / done : 0;
  const total = orders.filter((o) => o.status !== "cancelled" && o.status !== "draft").reduce((a, o) => a + orderTotals(o).total, 0);
  const toggle = (k: OrderStatus) => onPick(active === k ? "all" : k);

  return (
    <section aria-label={t("Parcel journey", "পার্সেলের যাত্রা")} className="rounded-lg border border-line bg-surface shadow-1">
      {/* Phone: compact grid, no rail. */}
      <div className="grid grid-cols-3 gap-1.5 p-2 md:hidden">
        {[...MAIN, "delivered", "returned"].map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => toggle(k as OrderStatus)}
            aria-pressed={active === k}
            className={cn("rounded-md px-2.5 py-2 text-left transition-colors", active === k ? "bg-[color-mix(in_oklab,var(--c)_10%,white)] ring-1 ring-[var(--c)]" : "hover:bg-surface-2")}
            style={{ "--c": STATUS_COLOR[k as OrderStatus] } as React.CSSProperties}
          >
            <span className="flex items-center gap-1.5 text-[12px] font-medium" style={{ color: STATUS_COLOR[k as OrderStatus] }}>
              <StatusGlyph status={k as OrderStatus} />
              <span className="truncate text-ink-2">{t.pick(STATUS_LABEL[k as OrderStatus])}</span>
            </span>
            <span className="figure mt-0.5 block text-[22px] font-semibold leading-tight text-ink">{f.num(s[k as StageKey].count)}</span>
            <span className="tnum block truncate text-[11px] text-ink-3">{f.compact(s[k as StageKey].value)}</span>
          </button>
        ))}
      </div>

      {/* Desktop: the rail. */}
      <div className="hidden px-4 pb-3 pt-4 md:flex">
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-start">
            {MAIN.map((k, i) => (
              <div key={k} className="flex min-w-0 flex-1 items-start">
                <Station k={k} stat={s[k]} active={active === k} onClick={() => toggle(k)} />
                <Connector from={STATUS_COLOR[k]} to={STATUS_COLOR[MAIN[i + 1] ?? "shipped"]} idle={s[k].count === 0} />
              </div>
            ))}
          </div>
          <div className="flex h-[60px] items-center gap-x-5 gap-y-1 pl-3 text-[13px] text-ink-3">
            <p>
              <span className="tnum font-medium text-ink">{f.num(orders.length)}</span>
              {t(" orders in view", "টি অর্ডার")} ·{" "}
              <span className="tnum font-medium text-ink">{f.money(total)}</span> {t("sold", "বিক্রি")}
            </p>
            <p className="hidden lg:block">
              {t("Return rate", "ফেরতের হার")} <span className={cn("tnum font-medium", returnRate > 0.15 ? "text-st-returned" : "text-ink")}>{f.pct(returnRate)}</span>
            </p>
            {s.cancelled.count > 0 && (
              <button type="button" onClick={() => toggle("cancelled")} className={cn("rounded-sm underline-offset-2 hover:text-ink hover:underline", active === "cancelled" && "font-medium text-ink underline")}>
                {f.num(s.cancelled.count)} {t("cancelled", "বাতিল")}
              </button>
            )}
          </div>
        </div>
        <Fork />
        <div className="flex w-[168px] shrink-0 flex-col gap-2">
          <Station k="delivered" stat={s.delivered} active={active === "delivered"} onClick={() => toggle("delivered")} />
          <button
            type="button"
            onClick={() => toggle("returned")}
            aria-pressed={active === "returned"}
            className={cn("flex h-[60px] items-center gap-2.5 rounded-lg px-3 text-left transition-colors", active === "returned" ? "bg-[color-mix(in_oklab,var(--color-st-returned)_9%,white)] ring-1 ring-st-returned" : "hover:bg-surface-2")}
          >
            <Node color={STATUS_COLOR.returned} dim={s.returned.count === 0} />
            <span className="min-w-0 flex-1">
              <span className="block text-[12.5px] text-ink-2">{t.pick(STATUS_LABEL.returned)}</span>
              <span className="tnum block truncate text-[11.5px] text-ink-3">{f.money(s.returned.value)}</span>
            </span>
            <span className="figure text-[22px] font-semibold text-st-returned">{f.num(s.returned.count)}</span>
          </button>
        </div>
      </div>
    </section>
  );
}

function Node({ color, dim }: { color: string; dim?: boolean }) {
  return (
    <span
      className="block size-3.5 shrink-0 rounded-full"
      style={{ background: dim ? "var(--surface)" : color, border: `2px solid ${color}`, boxShadow: `0 0 0 4px color-mix(in oklab, ${color} 16%, transparent)` }}
    />
  );
}

function Station({ k, stat, active, onClick }: { k: StageKey; stat: Stat; active: boolean; onClick: () => void }) {
  const t = useT();
  const f = useFmt();
  const c = STATUS_COLOR[k];
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      data-testid={`stage-${k}`}
      className={cn("group h-[108px] w-[132px] shrink-0 rounded-lg p-3 text-left transition-colors", active ? "ring-1" : "hover:bg-surface-2")}
      style={active ? { background: `color-mix(in oklab, ${c} 8%, white)`, boxShadow: `inset 0 0 0 1px ${c}` } : undefined}
    >
      <Node color={c} dim={stat.count === 0} />
      <span className="mt-2.5 block text-[12.5px] font-medium text-ink-2">{t.pick(STATUS_LABEL[k])}</span>
      <span className="figure block text-[28px] font-semibold leading-[1.1]" style={{ color: stat.count ? "var(--ink)" : "var(--ink-4)" }}>
        {f.num(stat.count)}
      </span>
      <span className="tnum block truncate text-[11.5px] text-ink-3">{f.money(stat.value)}</span>
    </button>
  );
}

function Connector({ from, to, idle }: { from: string; to: string; idle: boolean }) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  return (
    <svg className="mt-[17px] h-1 min-w-4 flex-1" aria-hidden>
      <defs>
        <linearGradient id={`c${id}`} gradientUnits="userSpaceOnUse" x1="0" x2="100%" y1="0" y2="0">
          <stop offset="0" stopColor={from} />
          <stop offset="1" stopColor={to} />
        </linearGradient>
      </defs>
      <line x1="4" x2="100%" y1="2" y2="2" stroke="var(--line)" strokeWidth="2" strokeLinecap="round" />
      <line
        x1="4"
        x2="100%"
        y1="2"
        y2="2"
        stroke={`url(#c${id})`}
        strokeWidth="2"
        strokeDasharray="6 6"
        strokeLinecap="round"
        opacity={idle ? 0.35 : 0.9}
        style={idle ? undefined : { animation: "flow 1.1s linear infinite" }}
      />
    </svg>
  );
}

/** Shipped splits: straight on to Delivered, or bends down to Returned. */
function Fork() {
  return (
    <svg width="40" height="176" className="shrink-0" aria-hidden>
      <path d="M0 19 H40" stroke={STATUS_COLOR.delivered} strokeWidth="2" strokeDasharray="6 6" style={{ animation: "flow 1.1s linear infinite" }} fill="none" />
      <path d="M0 19 C22 19 18 146 40 146" stroke={STATUS_COLOR.returned} strokeOpacity="0.7" strokeWidth="2" strokeDasharray="3 5" fill="none" />
    </svg>
  );
}
