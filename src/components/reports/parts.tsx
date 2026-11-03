"use client";

import { ArrowDown, ArrowUp, DownloadSimple, LockSimple, Rows, ChartBar } from "@phosphor-icons/react";
import { useState, type ReactNode } from "react";
import { Button, cn, EmptyState, IconButton } from "../ui/core";
import { useFmt, useT } from "@/lib/hooks";

/* ------------------------------------------------------------ section */

/**
 * A report section: heading row with "view as table" and CSV export, then
 * either the visual or its table. `render(asTable)` gets the current mode.
 */
export function ReportSection({
  id,
  title,
  sub,
  onExport,
  render,
  toggle = true,
  extra,
  className,
}: {
  id?: string;
  title: ReactNode;
  sub?: ReactNode;
  onExport?: () => void;
  render: (asTable: boolean) => ReactNode;
  toggle?: boolean;
  extra?: ReactNode;
  className?: string;
}) {
  const t = useT();
  const [asTable, setAsTable] = useState(false);
  return (
    <section id={id} className={cn("scroll-mt-28 rounded-lg border border-line bg-surface shadow-1 print:break-inside-avoid print:shadow-none", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-4">
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold tracking-[-0.01em] text-ink">{title}</h3>
          {sub && <p className="mt-0.5 text-[13px] text-ink-3">{sub}</p>}
        </div>
        <div className="no-print flex items-center gap-1">
          {extra}
          {toggle && (
            <IconButton
              size="sm"
              label={asTable ? t("Show chart", "চার্ট দেখুন") : t("View as table", "টেবিল হিসেবে দেখুন")}
              onClick={() => setAsTable((v) => !v)}
              aria-pressed={asTable}
              className={asTable ? "bg-brand-50 text-brand-ink" : ""}
            >
              {asTable ? <ChartBar className="size-4" /> : <Rows className="size-4" />}
            </IconButton>
          )}
          {onExport && (
            <Button size="sm" variant="ghost" icon={<DownloadSimple className="size-4" />} onClick={onExport}>
              CSV
            </Button>
          )}
        </div>
      </div>
      <div className="px-5 pb-5 pt-4">{render(asTable)}</div>
    </section>
  );
}

/* ------------------------------------------------------------ table */

export type Col<R> = {
  key: string;
  label: ReactNode;
  cell: (r: R) => ReactNode;
  align?: "left" | "right";
  /** Hide this column in the stacked mobile layout's secondary line. */
  primary?: boolean;
  className?: string;
};

/** Real table from md up; stacked label/value rows on phones. */
export function DataTable<R>({ rows, cols, rowKey, empty, max }: { rows: R[]; cols: Col<R>[]; rowKey: (r: R) => string; empty?: ReactNode; max?: number }) {
  const t = useT();
  const [all, setAll] = useState(false);
  const shown = max && !all ? rows.slice(0, max) : rows;
  if (!rows.length) return <div className="py-6 text-center text-sm text-ink-3">{empty ?? t("Nothing in this period.", "এই সময়ে কিছু নেই।")}</div>;
  return (
    <div>
      <table className="hidden w-full text-sm md:table">
        <thead>
          <tr className="border-b border-line text-left text-xs text-ink-3">
            {cols.map((c) => (
              <th key={c.key} scope="col" className={cn("pb-2 pr-4 font-medium last:pr-0", c.align === "right" && "text-right")}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shown.map((r) => (
            <tr key={rowKey(r)} className="border-b border-line/70 last:border-0 hover:bg-surface-2">
              {cols.map((c) => (
                <td key={c.key} className={cn("py-2.5 pr-4 align-middle last:pr-0", c.align === "right" && "tnum text-right", c.className)}>
                  {c.cell(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="divide-y divide-line md:hidden">
        {shown.map((r) => {
          const [head, ...rest] = cols;
          return (
            <li key={rowKey(r)} className="py-3">
              <div className="text-sm font-medium text-ink">{head.cell(r)}</div>
              <dl className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-1 text-[13px]">
                {rest.map((c) => (
                  <div key={c.key} className="flex items-baseline justify-between gap-2">
                    <dt className="text-ink-3">{c.label}</dt>
                    <dd className="tnum text-right text-ink">{c.cell(r)}</dd>
                  </div>
                ))}
              </dl>
            </li>
          );
        })}
      </ul>
      {max && rows.length > max && (
        <button type="button" onClick={() => setAll((v) => !v)} className="no-print mt-2 text-[13px] font-medium text-brand-ink hover:underline">
          {all ? t("Show less", "কম দেখান") : t(`Show all ${rows.length}`, `সব ${rows.length}টি দেখুন`)}
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------ ranked bars */

export type RankedItem = { key: string; label: ReactNode; value: number; display: string; detail?: string; color?: string; leading?: ReactNode };

/**
 * Horizontal ranked bars with direct value labels. Hovering a row reveals
 * its detail line (the hover layer); bars use the brand colour unless the
 * item carries an identity colour (e.g. a channel).
 */
export function RankedBars({ items, max: maxItems = 8, emptyText }: { items: RankedItem[]; max?: number; emptyText?: string }) {
  const t = useT();
  const [hover, setHover] = useState<string | null>(null);
  const list = items.slice(0, maxItems);
  const max = Math.max(1, ...list.map((i) => Math.abs(i.value)));
  if (!list.length) return <p className="py-6 text-center text-sm text-ink-3">{emptyText ?? t("Nothing in this period.", "এই সময়ে কিছু নেই।")}</p>;
  return (
    <ul className="space-y-2.5" role="list">
      {list.map((it) => (
        <li key={it.key} onPointerEnter={() => setHover(it.key)} onPointerLeave={() => setHover(null)} className="relative">
          <div className="flex items-baseline justify-between gap-3 text-[13px]">
            <span className="flex min-w-0 items-center gap-2 text-ink-2">
              {it.leading}
              <span className="truncate">{it.label}</span>
            </span>
            <span className="tnum shrink-0 font-medium text-ink">{it.display}</span>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-sunken">
              <div
                className="h-full rounded-full transition-[width,opacity] duration-500 ease-[var(--ease-out)]"
                style={{ width: `${(Math.abs(it.value) / max) * 100}%`, background: it.color ?? "var(--brand)", opacity: hover && hover !== it.key ? 0.4 : 1 }}
              />
            </div>
          </div>
          {it.detail && hover === it.key && (
            <p role="tooltip" className="tnum pointer-events-none absolute left-0 top-full z-10 mt-1 whitespace-nowrap rounded-md border border-line bg-surface px-2.5 py-1.5 text-xs text-ink-2 shadow-2">
              {it.detail}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------ delta */

export function Delta({ value, invert = false, points = false }: { value: number | null; invert?: boolean; points?: boolean }) {
  const f = useFmt();
  const t = useT();
  if (value === null || !Number.isFinite(value)) return <span className="text-xs text-ink-4">{t("no earlier data", "আগের তথ্য নেই")}</span>;
  const up = value >= 0;
  const good = invert ? !up : up;
  const I = up ? ArrowUp : ArrowDown;
  const text = points ? `${f.num(Math.abs(value * 100), true)} ${t("pts", "পয়েন্ট")}` : f.pct(Math.abs(value));
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-xs font-medium", Math.abs(value) < 0.005 ? "text-ink-3" : good ? "text-ok" : "text-danger")}>
      <I className="size-3" weight="bold" aria-hidden />
      {text}
      <span className="sr-only">{up ? t("up", "বেড়েছে") : t("down", "কমেছে")}</span>
    </span>
  );
}

export function Locked({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-md border border-dashed border-line-strong bg-surface-2">
      <EmptyState icon={<LockSimple weight="duotone" />} title={title} body={body} className="py-10" />
    </div>
  );
}
