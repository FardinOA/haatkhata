"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "../ui/core";
import { useFmt, useT } from "@/lib/hooks";
import type { ProfitStep } from "./calc";

const ROW = 40;
const BAR = 18;

/**
 * Horizontal profit waterfall: each step floats from the running total
 * before it to the running total after it. Horizontal so long Bangla labels
 * and phone widths both fit. Sign is encoded three ways: direction, colour,
 * and the −/+ in the value label.
 */
export function Waterfall({ steps }: { steps: ProfitStep[] }) {
  const t = useT();
  const f = useFmt();
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  const [hover, setHover] = useState<number | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);

  // Running totals.
  const spans = steps.reduce<{ from: number; to: number }[]>((acc, s) => {
    const prev = acc.length ? acc[acc.length - 1].to : 0;
    if (s.kind === "total") acc.push({ from: 0, to: s.value });
    else acc.push({ from: prev, to: prev + s.value });
    return acc;
  }, []);
  const lo = Math.min(0, ...spans.flatMap((s) => [s.from, s.to]));
  const hi = Math.max(1, ...spans.flatMap((s) => [s.from, s.to]));
  const labelRoom = 76;
  const plotW = Math.max(40, w - labelRoom - 4);
  const x = (v: number) => ((v - lo) / (hi - lo)) * plotW;
  const revenue = steps[0]?.value || 1;

  const fill = (s: ProfitStep) => {
    if (s.kind === "total") return s.value < 0 ? "var(--color-danger)" : s.key === "net" ? "var(--brand)" : "var(--brand-800)";
    return s.value >= 0 ? "var(--brand-400)" : "color-mix(in oklab, var(--color-danger) 62%, white)";
  };

  return (
    <div className="flex">
      <ul className="w-[44%] shrink-0 sm:w-60" aria-hidden>
        {steps.map((s, i) => (
          <li
            key={s.key}
            className={cn("flex flex-col justify-center pr-3 transition-opacity", hover !== null && hover !== i && "opacity-50")}
            style={{ height: ROW }}
            onPointerEnter={() => setHover(i)}
            onPointerLeave={() => setHover(null)}
          >
            <span className={cn("truncate text-[13px] leading-tight", s.kind === "total" ? "font-semibold text-ink" : "text-ink-2")}>{t(s.en, s.bn)}</span>
            {s.kind === "delta" && <span className="tnum text-[11px] leading-tight text-ink-4">{t(`${f.pct(Math.abs(s.value) / Math.abs(revenue), 1)} of sales`, `বিক্রির ${f.pct(Math.abs(s.value) / Math.abs(revenue), 1)}`)}</span>}
          </li>
        ))}
      </ul>
      <div ref={ref} className="relative min-w-0 flex-1">
        {w > 0 && (
          <svg width={w} height={steps.length * ROW} role="img" aria-label={t("Profit waterfall", "লাভের ধাপ")} className="block overflow-visible">
            {lo < 0 && <line x1={x(0)} x2={x(0)} y1={0} y2={steps.length * ROW} stroke="var(--line-strong)" />}
            {spans.map((sp, i) => {
              const s = steps[i];
              const a = Math.min(x(sp.from), x(sp.to));
              const b = Math.max(x(sp.from), x(sp.to));
              const width = Math.max(2, b - a);
              const y = i * ROW + (ROW - BAR) / 2;
              const next = spans[i + 1];
              const neg = s.value < 0;
              const label = s.kind === "total" ? f.money(s.value) : f.money(s.value, { sign: true });
              const labelInside = b + labelRoom > w && width > 70;
              return (
                <g key={s.key} onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)}>
                  <rect x={0} y={i * ROW} width={w} height={ROW} fill={hover === i ? "var(--surface-2)" : "transparent"} />
                  {i > 0 && i % 2 === 0 && <line x1={0} x2={w} y1={i * ROW} y2={i * ROW} stroke="var(--line)" strokeOpacity="0.5" />}
                  <rect x={a} y={y} width={width} height={BAR} rx={Math.min(4, width / 2)} fill={fill(s)} />
                  {neg && s.kind === "delta" && width > 10 && (
                    <path d={`M${a + 6},${y + BAR / 2} l4,-3 v6 z`} fill="white" opacity="0.85" aria-hidden />
                  )}
                  {next && steps[i + 1].kind === "delta" && (
                    <line x1={x(sp.to)} x2={x(sp.to)} y1={y + BAR} y2={(i + 1) * ROW + (ROW - BAR) / 2} stroke="var(--ink-4)" strokeDasharray="2 2" />
                  )}
                  <text
                    x={labelInside ? b - 6 : b + 6}
                    y={y + BAR / 2}
                    dy="0.34em"
                    textAnchor={labelInside ? "end" : "start"}
                    className={cn("tnum text-[12px]", s.kind === "total" ? "font-semibold" : "font-medium")}
                    fill={!labelInside ? "var(--ink)" : s.kind !== "total" ? "var(--ink)" : s.key === "net" && s.value >= 0 ? "var(--brand-contrast)" : "#fff"}
                  >
                    {label}
                  </text>
                </g>
              );
            })}
          </svg>
        )}
      </div>
    </div>
  );
}
