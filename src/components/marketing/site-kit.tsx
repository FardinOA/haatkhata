"use client";

import { createContext, useContext, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { cn } from "../ui/core";

export type L = "en" | "bn";

const BN = "০১২৩৪৫৬৭৮৯";

export type Site = {
  lang: L;
  setLang: (l: L) => void;
  t: (en: string, bn: string) => string;
  /** Digits in the visitor's language: ১২,৩৪৫ or 12,345. */
  n: (v: string | number) => string;
  shop: string;
  setShop: (s: string) => void;
  accent: string;
  setAccent: (hex: string) => void;
};

export const SiteCtx = createContext<Site | null>(null);

export function useSite() {
  const s = useContext(SiteCtx);
  if (!s) throw new Error("useSite outside <Landing>");
  return s;
}

export function makeN(lang: L) {
  return (v: string | number) => {
    const s = typeof v === "number" ? new Intl.NumberFormat("en-IN").format(v) : v;
    return lang === "bn" ? s.replace(/\d/g, (d) => BN[Number(d)]) : s;
  };
}

/** Fires once when the element scrolls into view. */
export function useInView<T extends Element>(threshold = 0.3) {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setSeen(true), { threshold });
    io.observe(el);
    return () => io.disconnect();
  }, [seen, threshold]);
  return [ref, seen] as const;
}

/** Section heading: big, tight, left aligned. */
export function H2({ children, className }: { children: ReactNode; className?: string }) {
  return <h2 className={cn("font-display text-[34px] font-semibold leading-[1.06] tracking-[-0.03em] text-ink sm:text-[46px] lg:text-[60px]", className)}>{children}</h2>;
}

/** Every section opens the same quiet way: one centred headline, one line under it. */
export function SectionHead({ title, sub, className }: { title: ReactNode; sub?: ReactNode; className?: string }) {
  return (
    <div className={cn("mx-auto max-w-[820px] text-center", className)}>
      <H2 className="text-balance">{title}</H2>
      {sub && <p className="mx-auto mt-5 max-w-[620px] text-balance text-[18px] leading-relaxed text-ink-3 md:text-[20px]">{sub}</p>}
    </div>
  );
}

/**
 * Woven Jamdani-style diamond motif, the site's one decorative material.
 * Each instance gets its own pattern id: with a shared id every copy would
 * draw in the first copy's colour. On brand-coloured surfaces pass
 * `var(--brand-contrast)` so it stays visible on light accents like lime.
 */
export function JamdaniWeave({ className, color = "currentColor", opacity = 0.14 }: { className?: string; color?: string; opacity?: number }) {
  const id = `jw${useId().replace(/:/g, "")}`;
  return (
    <svg className={className} aria-hidden>
      <defs>
        <pattern id={id} width="28" height="28" patternUnits="userSpaceOnUse">
          <path d="M14 3 25 14 14 25 3 14Z" fill="none" stroke={color} strokeOpacity={opacity} strokeWidth="1.2" />
          <path d="M14 9 19 14 14 19 9 14Z" fill={color} fillOpacity={opacity * 0.9} />
          <circle cx="0" cy="0" r="1.6" fill={color} fillOpacity={opacity} />
          <circle cx="28" cy="0" r="1.6" fill={color} fillOpacity={opacity} />
          <circle cx="0" cy="28" r="1.6" fill={color} fillOpacity={opacity} />
          <circle cx="28" cy="28" r="1.6" fill={color} fillOpacity={opacity} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}

/**
 * BechaKena's own mark (same drawing as app/icon.svg): a parcel with the
 * marigold cash dot, tinted with the site's accent.
 */
export function LogoMark({ size = 36, className }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className={cn("shrink-0", className)} aria-hidden>
      <rect width="64" height="64" rx="15" style={{ fill: "var(--brand)" }} className="transition-[fill] duration-500" />
      <path d="M18 26.5 32 19l14 7.5v15L32 49l-14-7.5z" fill="none" style={{ stroke: "var(--brand-contrast)" }} strokeWidth="3.4" strokeLinejoin="round" />
      <path d="M18 26.5 32 34l14-7.5M32 34v15" fill="none" style={{ stroke: "var(--brand-contrast)" }} strokeWidth="3.4" strokeLinejoin="round" />
      <circle cx="47" cy="17" r="6" fill="#F0A92B" />
    </svg>
  );
}

export const SWATCHES = [
  { hex: "#C9F05A", en: "Lebu", bn: "লেবু" },
  { hex: "#0E6B53", en: "Jamdani", bn: "জামদানি" },
  { hex: "#C2306B", en: "Shapla", bn: "শাপলা" },
  { hex: "#3446C4", en: "Kantha", bn: "কাঁথা" },
  { hex: "#D2401F", en: "Shimul", bn: "শিমুল" },
];
