"use client";

import type { ReactNode } from "react";
import { cn, Panel } from "../ui/core";

/** Same anatomy as the other settings cards: title strip, body, optional footer. */
export function Card({ title, sub, children, footer, aside, className }: { title: ReactNode; sub?: ReactNode; children: ReactNode; footer?: ReactNode; aside?: ReactNode; className?: string }) {
  return (
    <Panel className={cn("overflow-hidden", className)}>
      <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
          {sub && <p className="mt-0.5 text-[13px] text-ink-3">{sub}</p>}
        </div>
        {aside}
      </div>
      <div className="px-5 py-5">{children}</div>
      {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line bg-surface-2 px-5 py-3">{footer}</div>}
    </Panel>
  );
}

/** Usage bar that turns marigold at 80% and red at 100% (FR-SUB-01). */
export function Meter({ used, limit, label, format }: { used: number; limit: number | null; label: string; format: (n: number) => string }) {
  const pct = limit ? Math.min(1, used / limit) : 0;
  const level = limit === null ? "ok" : used >= limit ? "full" : used >= limit * 0.8 ? "warn" : "ok";
  const color = level === "full" ? "var(--color-danger)" : level === "warn" ? "var(--cash)" : "var(--brand)";
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="text-ink-3">{label}</span>
        <span className={cn("tnum font-semibold", level === "full" ? "text-danger" : level === "warn" ? "text-cash-ink" : "text-ink")}>
          {format(used)}
          <span className="font-normal text-ink-3"> / {limit === null ? "∞" : format(limit)}</span>
        </span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-sunken" role="meter" aria-valuenow={used} aria-valuemin={0} aria-valuemax={limit ?? undefined} aria-label={label}>
        <div className="h-full rounded-full transition-[width] duration-500" style={{ width: limit === null ? "6%" : `${Math.max(2, pct * 100)}%`, background: color }} />
      </div>
    </div>
  );
}
