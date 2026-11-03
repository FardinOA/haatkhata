"use client";

import { Check } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { cn } from "@/components/ui/core";
import { useT } from "@/lib/hooks";
import type { PaperSpec } from "@/lib/print";
import { PaperGlyph, ROLL_MM } from "./paper-glyph";

export { PaperGlyph };

/* ------------------------------------------------------------------ shelf */

/** Paper sizes standing side by side at true relative scale, grouped by the kind of printer. */
export function PaperShelf<T extends string>({
  papers,
  value,
  onChange,
  scale = 0.34,
  ariaLabel,
}: {
  papers: PaperSpec<T>[];
  value: T;
  onChange: (v: T) => void;
  scale?: number;
  ariaLabel: string;
}) {
  const t = useT();
  const groups: { key: string; title: ReactNode; items: PaperSpec<T>[] }[] = [
    { key: "roll", title: t("Receipt printer · POS machine", "রসিদ প্রিন্টার · POS মেশিন"), items: papers.filter((p) => p.group === "roll") },
    { key: "label", title: t("Label printer", "লেবেল প্রিন্টার"), items: papers.filter((p) => p.group === "label") },
    { key: "sheet", title: t("Office printer", "অফিস প্রিন্টার"), items: papers.filter((p) => p.group === "sheet") },
  ].filter((g) => g.items.length);
  const tallest = Math.max(...papers.map((p) => (p.h ?? ROLL_MM) * scale));

  return (
    <div role="radiogroup" aria-label={ariaLabel} className="flex flex-wrap gap-x-6 gap-y-5">
      {groups.map((g) => (
        <div key={g.key} className="min-w-0">
          <p className="mb-2 text-xs font-medium text-ink-3">{g.title}</p>
          <div className="flex flex-wrap gap-1.5 border-b border-line-strong pb-0">
            {g.items.map((p) => {
              const on = p.id === value;
              return (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => onChange(p.id)}
                  className={cn(
                    "group relative flex w-[108px] flex-col items-center rounded-t-lg px-1.5 pt-2.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
                    on ? "bg-brand-50" : "hover:bg-sunken",
                  )}
                >
                  <span className="flex w-full items-end justify-center" style={{ height: tallest + 4 }}>
                    <PaperGlyph spec={p} scale={scale} active={on} className="transition-transform duration-200 ease-[var(--ease-out)] group-hover:-translate-y-0.5" />
                  </span>
                  <span className={cn("mt-2 block w-full truncate text-center text-[12.5px] font-semibold", on ? "text-brand-ink" : "text-ink")}>{t(p.en, p.bn)}</span>
                  <span className="mb-2 mt-0.5 line-clamp-2 block min-h-[2lh] w-full text-center text-[11px] leading-snug text-ink-3">{t(p.hintEn, p.hintBn)}</span>
                  {on && (
                    <span className="absolute right-1.5 top-1.5 grid size-4 place-items-center rounded-full bg-brand text-brand-contrast">
                      <Check className="size-2.5" weight="bold" />
                    </span>
                  )}
                  <span className={cn("absolute inset-x-2 -bottom-px h-[2px] rounded-full", on ? "bg-brand" : "bg-transparent")} />
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
