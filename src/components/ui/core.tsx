"use client";

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { forwardRef, useId, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { CaretDown, CircleNotch } from "@phosphor-icons/react";

/** Joins classes; later Tailwind utilities override earlier ones (so callers can override component defaults). */
export const cn = (...v: ClassValue[]) => twMerge(clsx(v));

/* ---------------------------------------------------------------- Button */

type Variant = "primary" | "secondary" | "ghost" | "danger" | "cash" | "soft";
type Size = "sm" | "md" | "lg";

const BTN_BASE =
  "relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap font-medium transition-[background-color,box-shadow,transform,color,border-color,filter] duration-150 ease-[var(--ease-out)] active:translate-y-px disabled:pointer-events-none disabled:opacity-45";

const BTN_VARIANT: Record<Variant, string> = {
  primary: "bg-brand text-brand-contrast shadow-[inset_0_1px_0_rgb(255_255_255/0.18),0_1px_2px_rgb(0_0_0/0.12)] hover:brightness-[1.07]",
  secondary: "bg-surface text-ink border border-line-strong/80 shadow-1 hover:border-ink-4 hover:bg-surface-2",
  ghost: "text-ink-2 hover:bg-sunken hover:text-ink",
  soft: "bg-brand-50 text-brand-ink hover:bg-brand-100",
  danger: "bg-danger text-white hover:brightness-110",
  cash: "bg-cash text-[#2b1a00] hover:brightness-105 shadow-[inset_0_1px_0_rgb(255_255_255/0.3)]",
};

const BTN_SIZE: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px] rounded-sm",
  md: "h-10 px-4 text-sm rounded-md",
  lg: "h-12 px-5 text-[15px] rounded-md",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
  iconRight?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", loading, icon, iconRight, className, children, type = "button", ...rest },
  ref,
) {
  return (
    <button ref={ref} type={type} className={cn(BTN_BASE, BTN_VARIANT[variant], BTN_SIZE[size], className)} {...rest}>
      {loading ? <CircleNotch className="size-4 animate-spin" /> : icon}
      {children}
      {iconRight}
    </button>
  );
});

export const IconButton = forwardRef<HTMLButtonElement, ButtonProps & { label: string }>(function IconButton(
  { label, variant = "ghost", size = "md", className, children, type = "button", ...rest },
  ref,
) {
  const dim = size === "sm" ? "size-8" : size === "lg" ? "size-12" : "size-10";
  return (
    <button ref={ref} type={type} aria-label={label} title={label} className={cn(BTN_BASE, BTN_VARIANT[variant], dim, "rounded-sm p-0", className)} {...rest}>
      {children}
    </button>
  );
});

/* ---------------------------------------------------------------- Inputs */

export const FIELD_CLASS =
  "w-full bg-surface text-ink placeholder:text-ink-4 border border-line-strong/80 rounded-sm transition-[border-color,box-shadow] duration-150 hover:border-ink-4 focus:outline-none focus:border-brand focus:shadow-[var(--ring)] disabled:bg-sunken disabled:text-ink-3 aria-[invalid=true]:border-danger";

export const Input = forwardRef<HTMLInputElement, Omit<InputHTMLAttributes<HTMLInputElement>, "size"> & { leading?: ReactNode; trailing?: ReactNode; inputSize?: Size }>(
  function Input({ className, leading, trailing, inputSize = "md", ...rest }, ref) {
    const h = inputSize === "sm" ? "h-8 text-[13px]" : inputSize === "lg" ? "h-12 text-[15px]" : "h-10 text-sm";
    if (!leading && !trailing) return <input ref={ref} className={cn(FIELD_CLASS, h, "px-3", className)} {...rest} />;
    return (
      <div className={cn("relative flex items-center", className)}>
        {leading && <span className="pointer-events-none absolute left-3 flex text-ink-3">{leading}</span>}
        <input ref={ref} className={cn(FIELD_CLASS, h, leading ? "pl-9" : "pl-3", trailing ? "pr-10" : "pr-3")} {...rest} />
        {trailing && <span className="absolute right-2 flex items-center text-ink-3">{trailing}</span>}
      </div>
    );
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...rest }, ref) {
  return <textarea ref={ref} className={cn(FIELD_CLASS, "min-h-20 px-3 py-2.5 text-sm leading-relaxed", className)} {...rest} />;
});

export const Select = forwardRef<HTMLSelectElement, Omit<SelectHTMLAttributes<HTMLSelectElement>, "size"> & { inputSize?: Size }>(function Select(
  { className, children, inputSize = "md", ...rest },
  ref,
) {
  const h = inputSize === "sm" ? "h-8 text-[13px]" : inputSize === "lg" ? "h-12" : "h-10 text-sm";
  return (
    <div className={cn("relative", className)}>
      <select ref={ref} className={cn(FIELD_CLASS, h, "appearance-none pl-3 pr-9")} {...rest}>
        {children}
      </select>
      <CaretDown className="pointer-events-none absolute right-3 top-1/2 size-3.5 -translate-y-1/2 text-ink-3" weight="bold" />
    </div>
  );
});

export function Field({
  label,
  hint,
  error,
  children,
  className,
  optional,
  htmlFor,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  children: ReactNode;
  className?: string;
  optional?: string;
  htmlFor?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="flex items-baseline justify-between gap-2 text-[13px] font-medium text-ink-2">
        <span>{label}</span>
        {optional && <span className="text-xs font-normal text-ink-4">{optional}</span>}
      </label>
      {children}
      {error ? <p className="text-xs text-danger">{error}</p> : hint ? <p className="text-xs text-ink-3">{hint}</p> : null}
    </div>
  );
}

/* ---------------------------------------------------------------- Toggles */

export function Switch({ checked, onChange, label, disabled, size = "md" }: { checked: boolean; onChange: (v: boolean) => void; label?: string; disabled?: boolean; size?: "sm" | "md" }) {
  const track = size === "sm" ? "h-5 w-9" : "h-6 w-11";
  const knob = size === "sm" ? "size-4" : "size-5";
  const shift = checked ? (size === "sm" ? "translate-x-4" : "translate-x-5") : "translate-x-0";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn("relative inline-flex shrink-0 items-center rounded-full p-0.5 transition-colors duration-200 disabled:opacity-50", track, checked ? "bg-brand" : "bg-line-strong")}
    >
      <span className={cn("block rounded-full bg-white shadow-[0_1px_2px_rgb(0_0_0/0.25)] transition-transform duration-200 ease-[var(--ease-spring)]", knob, shift)} />
    </button>
  );
}

export function Checkbox({ checked, onChange, label, indeterminate, className }: { checked: boolean; onChange: (v: boolean) => void; label?: string; indeterminate?: boolean; className?: string }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={indeterminate ? "mixed" : checked}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onChange(!checked);
      }}
      className={cn(
        "grid size-[18px] shrink-0 place-items-center rounded-[5px] border transition-colors",
        checked || indeterminate ? "border-brand bg-brand text-brand-contrast" : "border-line-strong bg-surface hover:border-ink-4",
        className,
      )}
    >
      {indeterminate ? (
        <span className="h-0.5 w-2.5 rounded bg-current" />
      ) : checked ? (
        <svg viewBox="0 0 12 12" className="size-3" aria-hidden>
          <path d="M2.5 6.2 5 8.5l4.5-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : null}
    </button>
  );
}

/** Single choice in a sunken track. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  size = "md",
  className,
  ariaLabel,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode; icon?: ReactNode }[];
  size?: "sm" | "md";
  className?: string;
  ariaLabel?: string;
}) {
  const id = useId();
  return (
    <div role="radiogroup" aria-label={ariaLabel} className={cn("inline-flex rounded-md bg-sunken p-0.5", className)}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            id={`${id}-${o.value}`}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={cn(
              "inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-[calc(var(--radius-md)-2px)] font-medium transition-all duration-150",
              size === "sm" ? "h-7 px-2.5 text-xs" : "h-8 px-3 text-[13px]",
              on ? "bg-surface text-ink shadow-1" : "text-ink-3 hover:text-ink",
            )}
          >
            {o.icon}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------------- Display */

export type Tone = "neutral" | "brand" | "ok" | "warn" | "danger" | "cash" | "info";

export function Badge({ children, tone = "neutral", className, dot }: { children: ReactNode; tone?: Tone; className?: string; dot?: boolean }) {
  const tones: Record<Tone, string> = {
    neutral: "bg-sunken text-ink-2",
    brand: "bg-brand-50 text-brand-ink",
    ok: "bg-ok-soft text-ok",
    warn: "bg-warn-soft text-warn",
    danger: "bg-danger-soft text-danger",
    cash: "bg-cash-soft text-cash-ink",
    info: "bg-[#e8f1fb] text-[#1c5f9e]",
  };
  return (
    <span className={cn("inline-flex h-[22px] items-center gap-1.5 whitespace-nowrap rounded-full px-2 text-xs font-medium", tones[tone], className)}>
      {dot && <span className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd className={cn("inline-flex h-5 min-w-5 items-center justify-center rounded-[5px] border border-line-strong bg-surface px-1 font-sans text-[10.5px] font-medium text-ink-3 shadow-[0_1px_0_var(--line-strong)]", className)}>
      {children}
    </kbd>
  );
}

const AVATAR_HUES = ["#0E6B53", "#3446C4", "#C2306B", "#0A7CA8", "#B4531F", "#7A45C2", "#6B4A33", "#1F8A70", "#A0315A", "#3D6B9E"];
export function hashColor(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return AVATAR_HUES[h % AVATAR_HUES.length];
}

export function Avatar({ name, color, size = 32, src, className }: { name: string; color?: string; size?: number; src?: string | null; className?: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  return (
    <span
      className={cn("inline-grid shrink-0 place-items-center overflow-hidden rounded-full font-semibold text-white", className)}
      style={{ width: size, height: size, fontSize: size * 0.38, background: src ? undefined : (color ?? hashColor(name)) }}
      aria-hidden
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {src ? <img src={src} alt="" className="size-full object-cover" /> : initials}
    </span>
  );
}

/** Section container. `tone="sunken"` for nested groups that shouldn't read as another card. */
export function Panel({
  children,
  className,
  tone = "surface",
  as: As = "section",
  ...rest
}: { children: ReactNode; className?: string; tone?: "surface" | "sunken" | "brand"; as?: "section" | "div" | "article" } & React.HTMLAttributes<HTMLElement>) {
  const tones = {
    surface: "bg-surface border border-line shadow-1",
    sunken: "bg-surface-2 border border-line/70",
    brand: "bg-brand-50 border border-brand-100",
  };
  return (
    <As className={cn("rounded-lg", tones[tone], className)} {...rest}>
      {children}
    </As>
  );
}

export function PanelHeader({ title, sub, action, className }: { title: ReactNode; sub?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-start justify-between gap-3 px-5 pt-4", className)}>
      <div className="min-w-0">
        <h3 className="truncate text-[15px] font-semibold tracking-[-0.01em] text-ink">{title}</h3>
        {sub && <p className="mt-0.5 text-[13px] text-ink-3">{sub}</p>}
      </div>
      {action && <div className="flex shrink-0 items-center gap-1">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton rounded-sm", className)} />;
}

export function EmptyState({ icon, title, body, action, className }: { icon?: ReactNode; title: ReactNode; body?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-12 text-center", className)}>
      {icon && <div className="mb-4 grid size-12 place-items-center rounded-full bg-brand-50 text-brand-ink [&>svg]:size-6">{icon}</div>}
      <p className="text-[15px] font-semibold text-ink">{title}</p>
      {body && <p className="mt-1 max-w-sm text-sm text-ink-3">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Divider({ className, label }: { className?: string; label?: ReactNode }) {
  if (!label) return <hr className={cn("border-0 border-t border-line", className)} />;
  return (
    <div className={cn("flex items-center gap-3 text-xs text-ink-4", className)}>
      <span className="h-px flex-1 bg-line" />
      {label}
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}

/** − n + stepper for quantities. */
export function Stepper({ value, onChange, min = 0, max = Infinity, size = "md" }: { value: number; onChange: (n: number) => void; min?: number; max?: number; size?: "sm" | "md" }) {
  const btn = cn("grid place-items-center text-ink-2 transition-colors hover:bg-sunken disabled:opacity-35", size === "sm" ? "w-7" : "w-9");
  return (
    <div className={cn("inline-flex items-stretch overflow-hidden rounded-sm border border-line-strong/80 bg-surface", size === "sm" ? "h-8" : "h-10")}>
      <button type="button" aria-label="Decrease" className={btn} disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))}>
        <svg viewBox="0 0 12 12" className="size-3" aria-hidden>
          <path d="M2 6h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </button>
      <input
        aria-label="Quantity"
        inputMode="numeric"
        value={value}
        onChange={(e) => {
          const n = parseInt(e.target.value.replace(/\D/g, "") || "0", 10);
          onChange(Math.min(max, Math.max(min, n)));
        }}
        className={cn("tnum border-x border-line bg-transparent text-center font-semibold text-ink focus:outline-none", size === "sm" ? "w-8 text-[13px]" : "w-10 text-sm")}
      />
      <button type="button" aria-label="Increase" className={btn} disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))}>
        <svg viewBox="0 0 12 12" className="size-3" aria-hidden>
          <path d="M2 6h8M6 2v8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}
