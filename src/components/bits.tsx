"use client";

import {
  DotsThreeCircle,
  FacebookLogo,
  Globe,
  InstagramLogo,
  Phone,
  Storefront,
  TiktokLogo,
  WhatsappLogo,
  type Icon,
} from "@phosphor-icons/react";
import { useId } from "react";
import { cn } from "./ui/core";
import { useFmt, useT } from "@/lib/hooks";
import { CHANNEL_COLOR, CHANNEL_LABEL, PAY_COLOR, PAY_LABEL, STATUS_COLOR, STATUS_LABEL } from "@/lib/labels";
import { available, type RiskLevel } from "@/lib/domain";
import { useStore } from "@/lib/store";
import type { Channel, OrderStatus, PayMethod, Product, Variant } from "@/lib/types";

/* ------------------------------------------------------------ status */

export function StatusPill({ status, className, size = "md" }: { status: OrderStatus; className?: string; size?: "sm" | "md" }) {
  const t = useT();
  const color = STATUS_COLOR[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full font-medium",
        size === "sm" ? "h-5 px-1.5 text-[11px]" : "h-[22px] px-2 text-xs",
        status === "cancelled" && "line-through decoration-1",
        className,
      )}
      style={{ color, background: `color-mix(in oklab, ${color} 11%, white)` }}
    >
      <StatusGlyph status={status} />
      {t.pick(STATUS_LABEL[status])}
    </span>
  );
}

/** Tiny progress glyph: how far along the delivery journey an order is. */
export function StatusGlyph({ status }: { status: OrderStatus }) {
  const steps = { draft: 0, confirmed: 1, packed: 2, shipped: 3, delivered: 4, returned: 4, partially_returned: 4, cancelled: 0 }[status];
  const r = 4.5;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 12 12" className="size-3 shrink-0" aria-hidden>
      <circle cx="6" cy="6" r={r} fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="1.6" />
      <circle cx="6" cy="6" r={r} fill="none" stroke="currentColor" strokeWidth="1.6" strokeDasharray={`${(c * steps) / 4} ${c}`} strokeLinecap="round" transform="rotate(-90 6 6)" />
      {(status === "returned" || status === "partially_returned") && <path d="M4.2 6h3.6M4.2 6l1.4-1.4M4.2 6l1.4 1.4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" fill="none" />}
    </svg>
  );
}

/* ------------------------------------------------------------ channel */

export const CHANNEL_ICON: Record<Channel, Icon> = {
  facebook: FacebookLogo,
  instagram: InstagramLogo,
  whatsapp: WhatsappLogo,
  tiktok: TiktokLogo,
  website: Globe,
  walkin: Storefront,
  phone: Phone,
  other: DotsThreeCircle,
};

export function ChannelIcon({ channel, className, withBg = false }: { channel: Channel; className?: string; withBg?: boolean }) {
  const I = CHANNEL_ICON[channel];
  if (!withBg) return <I className={cn("size-4", className)} weight="fill" style={{ color: CHANNEL_COLOR[channel] }} aria-hidden />;
  return (
    <span className={cn("grid size-7 shrink-0 place-items-center rounded-full", className)} style={{ background: `color-mix(in oklab, ${CHANNEL_COLOR[channel]} 12%, white)` }}>
      <I className="size-4" weight="fill" style={{ color: CHANNEL_COLOR[channel] }} aria-hidden />
    </span>
  );
}

export function ChannelTag({ channel, className }: { channel: Channel; className?: string }) {
  const t = useT();
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap text-[13px] text-ink-2", className)}>
      <ChannelIcon channel={channel} />
      {t.pick(CHANNEL_LABEL[channel])}
    </span>
  );
}

export function PayTag({ method, className }: { method: PayMethod; className?: string }) {
  const t = useT();
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap text-[13px] text-ink-2", className)}>
      <span className="size-2 rounded-full" style={{ background: PAY_COLOR[method] }} />
      {t.pick(PAY_LABEL[method])}
    </span>
  );
}

/* ------------------------------------------------------------ money */

export function Money({ value, className, sign, muted }: { value: number; className?: string; sign?: boolean; muted?: boolean }) {
  const f = useFmt();
  return <span className={cn("tnum whitespace-nowrap", muted && "text-ink-3", className)}>{f.money(value, { sign })}</span>;
}

/* ------------------------------------------------------------ product art */

/**
 * Generated textile swatch used when a product has no photo. Each pattern is
 * a nod to a local weave or print, tinted with the product's hue.
 */
export function ProductThumb({ product, size = 44, className, rounded = "md" }: { product: Pick<Product, "art" | "images" | "name">; size?: number; className?: string; rounded?: "sm" | "md" | "lg" | "full" }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const radius = { sm: "rounded-sm", md: "rounded-md", lg: "rounded-lg", full: "rounded-full" }[rounded];
  if (product.images?.[0])
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={product.images[0]} alt="" width={size} height={size} className={cn("shrink-0 object-cover", radius, className)} style={{ width: size, height: size }} />
    );
  const hue = product.art.hue;
  const light = `color-mix(in oklab, ${hue} 22%, white)`;
  const mid = `color-mix(in oklab, ${hue} 60%, white)`;
  const p = product.art.pattern;
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} className={cn("shrink-0 overflow-hidden", radius, className)} aria-hidden>
      <defs>
        <pattern id={`p${id}`} width="10" height="10" patternUnits="userSpaceOnUse" patternTransform={p === "stripe" || p === "weave" ? "rotate(0)" : "rotate(45)"}>
          {p === "stripe" && (
            <>
              <rect width="10" height="10" fill={light} />
              <rect width="10" height="3" fill={hue} />
              <rect y="5" width="10" height="1" fill={mid} />
            </>
          )}
          {p === "check" && (
            <>
              <rect width="10" height="10" fill={light} />
              <rect width="5" height="10" fill={mid} opacity="0.7" />
              <rect width="10" height="5" fill={mid} opacity="0.7" />
            </>
          )}
          {p === "dots" && (
            <>
              <rect width="10" height="10" fill={hue} />
              <circle cx="5" cy="5" r="1.7" fill={light} />
            </>
          )}
          {p === "wave" && (
            <>
              <rect width="10" height="10" fill={light} />
              <path d="M0 5 Q2.5 2 5 5 T10 5" stroke={hue} strokeWidth="1.4" fill="none" />
              <path d="M0 9 Q2.5 6 5 9 T10 9" stroke={mid} strokeWidth="0.8" fill="none" />
            </>
          )}
          {p === "diamond" && (
            <>
              <rect width="10" height="10" fill={hue} />
              <rect x="3" y="3" width="4" height="4" fill={light} />
              <rect x="4.3" y="4.3" width="1.4" height="1.4" fill={hue} />
            </>
          )}
          {p === "paisley" && (
            <>
              <rect width="10" height="10" fill={light} />
              <path d="M5 2c2 0 3 1.6 2.2 3.2C6.4 6.8 4 7 3.4 8.6 3 6.4 2.6 2 5 2z" fill={hue} />
            </>
          )}
          {p === "weave" && (
            <>
              <rect width="10" height="10" fill={mid} />
              <rect width="5" height="2" fill={light} />
              <rect x="5" y="5" width="5" height="2" fill={light} />
              <rect x="2" y="2" width="1" height="3" fill={hue} />
              <rect x="7" y="7" width="1" height="3" fill={hue} />
            </>
          )}
          {p === "plain" && <rect width="10" height="10" fill={hue} />}
        </pattern>
        <linearGradient id={`g${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.18" />
          <stop offset="1" stopColor="#000" stopOpacity="0.08" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" fill={`url(#p${id})`} />
      <rect width="40" height="40" fill={`url(#g${id})`} />
      {p === "plain" && <text x="20" y="25" textAnchor="middle" fontSize="13" fontWeight="600" fill="#fff" opacity="0.9">{product.name.slice(0, 1)}</text>}
    </svg>
  );
}

/* ------------------------------------------------------------ brand */

/** The seller's logo, or a monogram built from the business name. */
export function BrandMark({ size = 36, className, inverted }: { size?: number; className?: string; inverted?: boolean }) {
  const logo = useStore((s) => s.business.logo);
  const name = useStore((s) => s.business.name);
  const shape = useStore((s) => s.business.logoShape);
  const radius = shape === "circle" ? "9999px" : shape === "square" ? `${size * 0.14}px` : `${size * 0.28}px`;
  if (logo)
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={logo} alt={name} width={size} height={size} className={cn("shrink-0 bg-surface object-contain", className)} style={{ width: size, height: size, borderRadius: radius }} />
    );
  const letters = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  return (
    <span
      className={cn("relative grid shrink-0 place-items-center overflow-hidden font-display font-semibold", inverted ? "bg-surface text-brand-ink" : "bg-brand text-brand-contrast", className)}
      style={{ width: size, height: size, borderRadius: radius, fontSize: size * 0.4 }}
      aria-label={name}
    >
      <svg className="absolute inset-0 size-full opacity-25" viewBox="0 0 36 36" aria-hidden>
        <path d="M0 27 Q9 21 18 27 T36 27 V36 H0z" fill="currentColor" />
      </svg>
      <span className="relative">{letters}</span>
    </span>
  );
}

/* ------------------------------------------------------------ stock */

export function StockMeter({ v, className }: { v: Pick<Variant, "onHand" | "reserved" | "lowStock" | "inTransit">; className?: string }) {
  const t = useT();
  const f = useFmt();
  const a = available(v);
  const cap = Math.max(v.onHand + v.inTransit, v.lowStock * 3, 1);
  const level = a <= 0 ? "out" : a <= v.lowStock ? "low" : "ok";
  const color = level === "out" ? "var(--color-danger)" : level === "low" ? "var(--color-warn)" : "var(--color-ok)";
  return (
    <div className={cn("min-w-0", className)}>
      <div className="flex items-baseline justify-between gap-2 text-[13px]">
        <span className="tnum font-semibold" style={{ color: level === "ok" ? "var(--ink)" : color }}>
          {level === "out" ? t("Out of stock", "স্টক নেই") : `${f.num(a)} ${t("available", "আছে")}`}
        </span>
        {v.reserved > 0 && <span className="tnum text-xs text-ink-3">{f.num(v.reserved)} {t("held", "রিজার্ভ")}</span>}
      </div>
      <div className="mt-1.5 flex h-1.5 overflow-hidden rounded-full bg-sunken" aria-hidden>
        <span className="h-full" style={{ width: `${(Math.max(0, a) / cap) * 100}%`, background: color }} />
        <span className="h-full bg-st-confirmed/60" style={{ width: `${(v.reserved / cap) * 100}%` }} />
        <span className="h-full bg-st-shipped/40" style={{ width: `${(v.inTransit / cap) * 100}%` }} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ risk */

const RISK_META: Record<RiskLevel, { color: string; en: string; bn: string }> = {
  new: { color: "#7C8288", en: "New customer", bn: "নতুন কাস্টমার" },
  trusted: { color: "#18915A", en: "Trusted", bn: "বিশ্বস্ত" },
  watch: { color: "#B86E00", en: "Watch returns", bn: "ফেরতের দিকে খেয়াল" },
  risky: { color: "#C8342F", en: "High return risk", bn: "ফেরতের ঝুঁকি বেশি" },
};

/** Ring showing delivered vs returned share for a customer. */
export function RiskRing({ level, delivered, returned, size = 40 }: { level: RiskLevel; delivered: number; returned: number; size?: number }) {
  const total = delivered + returned;
  const r = 15;
  const c = 2 * Math.PI * r;
  const retShare = total ? returned / total : 0;
  const meta = RISK_META[level];
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} className="shrink-0" aria-hidden>
      <circle cx="20" cy="20" r={r} fill="none" stroke="var(--sunken)" strokeWidth="5" />
      {total > 0 && <circle cx="20" cy="20" r={r} fill="none" stroke="#18915A" strokeWidth="5" strokeDasharray={`${c * (1 - retShare)} ${c}`} transform="rotate(-90 20 20)" />}
      {returned > 0 && <circle cx="20" cy="20" r={r} fill="none" stroke="#D0435A" strokeWidth="5" strokeDasharray={`${c * retShare} ${c}`} strokeDashoffset={-c * (1 - retShare)} transform="rotate(-90 20 20)" />}
      <circle cx="20" cy="20" r="5" fill={meta.color} />
    </svg>
  );
}

export function RiskLabel({ level, className }: { level: RiskLevel; className?: string }) {
  const t = useT();
  const m = RISK_META[level];
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium", className)} style={{ color: m.color }}>
      <span className="size-1.5 rounded-full" style={{ background: m.color }} />
      {t(m.en, m.bn)}
    </span>
  );
}

/* ------------------------------------------------------------ headings */

export function PageHeader({ title, sub, actions, className }: { title: React.ReactNode; sub?: React.ReactNode; actions?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-x-6 gap-y-3", className)}>
      <div className="min-w-0">
        <h1 className="font-display text-[26px] font-semibold leading-tight tracking-[-0.02em] text-ink md:text-[30px]">{title}</h1>
        {sub && <p className="mt-1 text-sm text-ink-3">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
