"use client";

import { X } from "@phosphor-icons/react";
import { useState } from "react";
import { cn } from "../ui/core";

/** Type a value and press Enter or comma to add it as a chip. Backspace removes the last one. */
export function ChipInput({
  values,
  onChange,
  placeholder,
  ariaLabel,
  max = 30,
  invalid,
  renderChip,
}: {
  values: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  ariaLabel: string;
  max?: number;
  invalid?: boolean;
  renderChip?: (v: string) => React.ReactNode;
}) {
  const [draft, setDraft] = useState("");
  const commit = (raw: string) => {
    const parts = raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (!parts.length) return;
    const next = [...values];
    for (const p of parts) if (!next.some((v) => v.toLowerCase() === p.toLowerCase()) && next.length < max) next.push(p);
    onChange(next);
    setDraft("");
  };
  return (
    <div
      className={cn(
        "flex min-h-10 w-full flex-wrap items-center gap-1.5 rounded-sm border bg-surface px-2 py-1.5 transition-[border-color,box-shadow] focus-within:border-brand focus-within:shadow-[var(--ring)]",
        invalid ? "border-danger" : "border-line-strong/80 hover:border-ink-4",
      )}
    >
      {values.map((v) => (
        <span key={v} className="inline-flex h-7 items-center gap-1 rounded-[6px] bg-sunken pl-2 pr-1 text-[13px] font-medium text-ink">
          {renderChip ? renderChip(v) : v}
          <button type="button" aria-label={`Remove ${v}`} onClick={() => onChange(values.filter((x) => x !== v))} className="grid size-5 place-items-center rounded text-ink-3 hover:bg-line hover:text-ink">
            <X className="size-3" weight="bold" />
          </button>
        </span>
      ))}
      <input
        aria-label={ariaLabel}
        value={draft}
        onChange={(e) => {
          if (e.target.value.includes(",")) commit(e.target.value);
          else setDraft(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit(draft);
          } else if (e.key === "Backspace" && !draft && values.length) onChange(values.slice(0, -1));
        }}
        onBlur={() => commit(draft)}
        placeholder={values.length ? "" : placeholder}
        className="h-7 min-w-24 flex-1 bg-transparent px-1 text-sm text-ink placeholder:text-ink-4 focus:outline-none"
      />
    </div>
  );
}
