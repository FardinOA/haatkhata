"use client";

/**
 * Small, dependency-free SVG charts. Rules (see design-dna.md and the dataviz
 * guidance): 2px lines, 4px rounded bar ends on the baseline, recessive grid,
 * a hover layer on every plot, text in ink tokens — never series colour.
 */
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { cn } from "./ui/core";

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

/** Monotone cubic interpolation — smooth without overshooting the data. */
function monotonePath(pts: [number, number][]) {
  if (pts.length < 2) return "";
  const n = pts.length;
  const dx: number[] = [];
  const m: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx.push(pts[i + 1][0] - pts[i][0]);
    m.push((pts[i + 1][1] - pts[i][1]) / (dx[i] || 1));
  }
  const t: number[] = [m[0]];
  for (let i = 1; i < n - 1; i++) t.push(m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2);
  t.push(m[n - 2]);
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) {
      t[i] = 0;
      t[i + 1] = 0;
      continue;
    }
    const a = t[i] / m[i];
    const b = t[i + 1] / m[i];
    const s = a * a + b * b;
    if (s > 9) {
      const k = 3 / Math.sqrt(s);
      t[i] = k * a * m[i];
      t[i + 1] = k * b * m[i];
    }
  }
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += ` C${pts[i][0] + h},${pts[i][1] + h * t[i]} ${pts[i + 1][0] - h},${pts[i + 1][1] - h * t[i + 1]} ${pts[i + 1][0]},${pts[i + 1][1]}`;
  }
  return d;
}

function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return step * p;
}

export function ChartTooltip({ x, y, children, width }: { x: number; y: number; children: ReactNode; width: number }) {
  const left = Math.min(Math.max(x, 70), width - 70);
  return (
    <div
      className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md border border-line bg-surface px-3 py-2 text-xs shadow-2"
      style={{ left, top: y - 10 }}
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------------------ area */

export type Point = { label: string; value: number; compare?: number; tip?: string };

export function AreaChart({
  data,
  height = 220,
  format,
  color = "var(--brand)",
  compareLabel,
  valueLabel,
  className,
  showAxis = true,
}: {
  data: Point[];
  height?: number;
  format: (n: number) => string;
  color?: string;
  compareLabel?: string;
  valueLabel?: string;
  className?: string;
  showAxis?: boolean;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const gid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const padL = showAxis ? 44 : 4;
  const padR = 8;
  const padT = 12;
  const padB = showAxis ? 26 : 4;
  const hasCompare = data.some((d) => d.compare !== undefined);
  const max = niceMax(Math.max(...data.map((d) => Math.max(d.value, d.compare ?? 0)), 1));
  const iw = Math.max(1, width - padL - padR);
  const ih = height - padT - padB;
  const x = (i: number) => padL + (data.length === 1 ? iw / 2 : (i / (data.length - 1)) * iw);
  const y = (v: number) => padT + ih - (v / max) * ih;
  const pts = data.map((d, i) => [x(i), y(d.value)] as [number, number]);
  const cmp = hasCompare ? data.map((d, i) => [x(i), y(d.compare ?? 0)] as [number, number]) : [];
  const line = monotonePath(pts);
  const area = line ? `${line} L${pts.at(-1)![0]},${padT + ih} L${pts[0][0]},${padT + ih} Z` : "";
  const ticks = [0, 0.5, 1].map((f) => f * max);
  const labelEvery = Math.ceil(data.length / Math.max(2, Math.floor(iw / 56)));

  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const r = (e.currentTarget as SVGRectElement).getBoundingClientRect();
    const px = e.clientX - r.left;
    const i = Math.round((px / r.width) * (data.length - 1));
    setHover(Math.max(0, Math.min(data.length - 1, i)));
  };

  return (
    <div className={cn("w-full", className)}>
      {hasCompare && (
        <div className="mb-2 flex items-center gap-4 text-xs text-ink-3">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded" style={{ background: color }} />
            {valueLabel}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0 w-4 border-t-2 border-dashed border-ink-4" />
            {compareLabel}
          </span>
        </div>
      )}
      <div ref={ref} className="relative" style={{ height }}>
        {width > 0 && (
          <svg width={width} height={height} role="img" aria-label={valueLabel ?? "Trend"} className="block overflow-visible">
            <defs>
              <linearGradient id={`a${gid}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor={color} stopOpacity="0.16" />
                <stop offset="1" stopColor={color} stopOpacity="0" />
              </linearGradient>
            </defs>
            {showAxis &&
              ticks.map((tk) => (
                <g key={tk}>
                  <line x1={padL} x2={width - padR} y1={y(tk)} y2={y(tk)} stroke="var(--line)" strokeDasharray={tk === 0 ? undefined : "2 4"} />
                  <text x={padL - 8} y={y(tk)} dy="0.32em" textAnchor="end" className="fill-ink-4 text-[10.5px] tnum">
                    {format(tk)}
                  </text>
                </g>
              ))}
            {showAxis &&
              data.map((d, i) =>
                i % labelEvery === 0 || i === data.length - 1 ? (
                  <text key={i} x={x(i)} y={height - 6} textAnchor="middle" className={cn("text-[10.5px]", hover === i ? "fill-ink" : "fill-ink-4")}>
                    {d.label}
                  </text>
                ) : null,
              )}
            {hasCompare && <path d={monotonePath(cmp)} fill="none" stroke="var(--ink-4)" strokeWidth="1.5" strokeDasharray="4 4" />}
            <path d={area} fill={`url(#a${gid})`} />
            <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            {hover !== null && (
              <g>
                <line x1={x(hover)} x2={x(hover)} y1={padT} y2={padT + ih} stroke="var(--ink-4)" strokeDasharray="2 3" />
                <circle cx={x(hover)} cy={y(data[hover].value)} r="5" fill={color} stroke="var(--surface)" strokeWidth="2" />
              </g>
            )}
            {hover === null && pts.length > 0 && <circle cx={pts.at(-1)![0]} cy={pts.at(-1)![1]} r="4" fill={color} stroke="var(--surface)" strokeWidth="2" />}
            <rect x={padL} y={padT} width={iw} height={ih} fill="transparent" onPointerMove={onMove} onPointerLeave={() => setHover(null)} />
          </svg>
        )}
        {hover !== null && width > 0 && (
          <ChartTooltip x={x(hover)} y={y(Math.max(data[hover].value, data[hover].compare ?? 0))} width={width}>
            <p className="font-medium text-ink">{data[hover].tip ?? data[hover].label}</p>
            <p className="tnum mt-0.5 text-ink-2">
              {valueLabel && <span className="text-ink-3">{valueLabel} </span>}
              <span className="font-semibold text-ink">{format(data[hover].value)}</span>
            </p>
            {hasCompare && (
              <p className="tnum text-ink-3">
                {compareLabel} {format(data[hover].compare ?? 0)}
              </p>
            )}
          </ChartTooltip>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ bars */

export function BarChart({
  data,
  height = 160,
  format,
  color = "var(--brand)",
  highlight,
  className,
}: {
  data: { label: string; value: number; tip?: string; color?: string }[];
  height?: number;
  format: (n: number) => string;
  color?: string;
  highlight?: number;
  className?: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const padB = 22;
  const ih = height - padB - 8;
  const max = niceMax(Math.max(...data.map((d) => d.value), 1));
  const slot = width / Math.max(1, data.length);
  const bw = Math.max(4, Math.min(28, slot - 6));
  return (
    <div ref={ref} className={cn("relative w-full", className)} style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label="Bar chart" className="block">
          <line x1={0} x2={width} y1={8 + ih} y2={8 + ih} stroke="var(--line)" />
          {data.map((d, i) => {
            const h = Math.max(d.value > 0 ? 2 : 0, (d.value / max) * ih);
            const bx = i * slot + (slot - bw) / 2;
            const by = 8 + ih - h;
            const r = Math.min(4, bw / 2, h);
            const active = hover === i || highlight === i;
            return (
              <g key={i} onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)}>
                <rect x={i * slot} y={0} width={slot} height={height} fill="transparent" />
                <path
                  d={`M${bx},${8 + ih} V${by + r} Q${bx},${by} ${bx + r},${by} H${bx + bw - r} Q${bx + bw},${by} ${bx + bw},${by + r} V${8 + ih} Z`}
                  fill={d.color ?? color}
                  opacity={hover === null ? (highlight === undefined || active ? 1 : 0.45) : active ? 1 : 0.4}
                  className="transition-opacity duration-150"
                />
                {(data.length <= 10 || i % Math.ceil(data.length / 8) === 0 || i === data.length - 1) && (
                  <text x={i * slot + slot / 2} y={height - 5} textAnchor="middle" className={cn("text-[10.5px]", active ? "fill-ink" : "fill-ink-4")}>
                    {d.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      )}
      {hover !== null && width > 0 && (
        <ChartTooltip x={hover * slot + slot / 2} y={8 + ih - (data[hover].value / max) * ih} width={width}>
          <p className="font-medium text-ink">{data[hover].tip ?? data[hover].label}</p>
          <p className="tnum mt-0.5 font-semibold text-ink">{format(data[hover].value)}</p>
        </ChartTooltip>
      )}
    </div>
  );
}

/* ------------------------------------------------------------ donut */

export function Donut({
  data,
  size = 132,
  thickness = 16,
  center,
  onHover,
}: {
  data: { key: string; value: number; color: string; label: string }[];
  size?: number;
  thickness?: number;
  center?: ReactNode;
  onHover?: (key: string | null) => void;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const gap = data.filter((d) => d.value > 0).length > 1 ? 2.5 : 0;
  const offsets = data.reduce<number[]>((acc, d, i) => [...acc, (acc[i - 1] ?? 0) + (i ? (data[i - 1].value / total) * c : 0)], []);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Share">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--sunken)" strokeWidth={thickness} />
        {data.map((d) => {
          const len = (d.value / total) * c;
          const seg = Math.max(0, len - gap);
          const off = offsets[data.indexOf(d)];
          if (d.value <= 0) return null;
          const active = hover === null || hover === d.key;
          return (
            <circle
              key={d.key}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={d.color}
              strokeWidth={hover === d.key ? thickness + 3 : thickness}
              strokeDasharray={`${seg} ${c}`}
              strokeDashoffset={-off}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
              opacity={active ? 1 : 0.35}
              className="cursor-pointer transition-all duration-150"
              onPointerEnter={() => {
                setHover(d.key);
                onHover?.(d.key);
              }}
              onPointerLeave={() => {
                setHover(null);
                onHover?.(null);
              }}
            >
              <title>{`${d.label}: ${Math.round((d.value / total) * 100)}%`}</title>
            </circle>
          );
        })}
      </svg>
      {center && <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">{center}</div>}
    </div>
  );
}

/* ------------------------------------------------------------ sparkline */

export function Sparkline({ values, width = 96, height = 28, color = "var(--brand)" }: { values: number[]; width?: number; height?: number; color?: string }) {
  if (values.length < 2) return null;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const pts = values.map((v, i) => [(i / (values.length - 1)) * (width - 4) + 2, height - 3 - ((v - min) / (max - min || 1)) * (height - 6)] as [number, number]);
  return (
    <svg width={width} height={height} aria-hidden className="overflow-visible">
      <path d={monotonePath(pts)} fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" />
      <circle cx={pts.at(-1)![0]} cy={pts.at(-1)![1]} r="2.5" fill={color} />
    </svg>
  );
}

/* ------------------------------------------------------------ ring */

export function ProgressRing({ value, size = 120, thickness = 10, color = "var(--brand)", children, track = "var(--sunken)" }: { value: number; size?: number; thickness?: number; color?: string; children?: ReactNode; track?: string }) {
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={thickness} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={`${c * v} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className="transition-[stroke-dasharray] duration-700 ease-[var(--ease-out)]"
        />
      </svg>
      {children && <div className="absolute inset-0 grid place-items-center text-center">{children}</div>}
    </div>
  );
}

/* ------------------------------------------------------------ heat grid */

/** Rows × columns of cells on the brand sequential ramp. */
export function HeatGrid({
  rows,
  cols,
  values,
  tip,
  className,
}: {
  rows: string[];
  cols: string[];
  values: number[][];
  tip: (r: number, c: number, v: number) => string;
  className?: string;
}) {
  const [hover, setHover] = useState<[number, number] | null>(null);
  const max = Math.max(1, ...values.flat());
  const steps = ["var(--sunken)", "var(--brand-100)", "var(--brand-200)", "var(--brand-300)", "var(--brand-500)", "var(--brand-700)"];
  const colorFor = (v: number) => (v <= 0 ? steps[0] : steps[Math.min(5, 1 + Math.floor((v / max) * 4.999))]);
  return (
    <div className={cn("relative", className)}>
      <div className="grid gap-[3px]" style={{ gridTemplateColumns: `auto repeat(${cols.length}, minmax(0, 1fr))` }}>
        <span />
        {cols.map((c, i) => (
          <span key={i} className="pb-1 text-center text-[10px] text-ink-4">
            {c}
          </span>
        ))}
        {rows.map((r, ri) => (
          <div key={ri} className="contents">
            <span className="pr-2 text-right text-[11px] leading-[18px] text-ink-3">{r}</span>
            {cols.map((_, ci) => (
              <span
                key={ci}
                className={cn("h-[18px] rounded-[4px] transition-transform duration-100", hover?.[0] === ri && hover?.[1] === ci && "scale-110 ring-2 ring-surface")}
                style={{ background: colorFor(values[ri][ci]) }}
                onPointerEnter={() => setHover([ri, ci])}
                onPointerLeave={() => setHover(null)}
                title={tip(ri, ci, values[ri][ci])}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-end gap-1.5 text-[10.5px] text-ink-4">
        <span>Less</span>
        {steps.map((s) => (
          <span key={s} className="size-2.5 rounded-[3px]" style={{ background: s }} />
        ))}
        <span>More</span>
      </div>
      {hover && <p className="tnum absolute -bottom-1 left-0 text-xs text-ink-2">{tip(hover[0], hover[1], values[hover[0]][hover[1]])}</p>}
    </div>
  );
}
