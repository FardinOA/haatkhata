"use client";

import { CaretDown, Check, Diamond, Dress, Drop, Headphones, InstagramLogo, MessengerLogo, Sneaker, Storefront, WhatsappLogo } from "@phosphor-icons/react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { cn } from "../ui/core";
import { PLANS } from "./data";
import { useSite } from "./site-kit";

type Pair = [string, string];

const CHAT_FEAT: Pair = ["Paste a chat, the order fills itself", "চ্যাট পেস্ট করলেই অর্ডার তৈরি"];

const WHERE = [
  { en: "on Facebook", bn: "ফেসবুকে", app: ["Messenger", "মেসেঞ্জার"] as Pair, icon: <MessengerLogo weight="fill" />, color: "#0866FF", online: true, feat: CHAT_FEAT },
  { en: "on Instagram", bn: "ইনস্টাগ্রামে", app: ["Instagram", "ইনস্টাগ্রাম"] as Pair, icon: <InstagramLogo weight="fill" />, color: "#D62976", online: true, feat: CHAT_FEAT },
  { en: "on WhatsApp", bn: "হোয়াটসঅ্যাপে", app: ["WhatsApp", "হোয়াটসঅ্যাপ"] as Pair, icon: <WhatsappLogo weight="fill" />, color: "#1FAF55", online: true, feat: CHAT_FEAT },
  { en: "at my shop", bn: "দোকানে", app: ["Shop counter", "দোকানের কাউন্টার"] as Pair, icon: <Storefront weight="fill" />, color: "#121212", online: false, feat: ["Scan barcodes, print 80 mm receipts", "বারকোড স্ক্যান, ৮০ মিমি রসিদ"] as Pair },
];

const WHAT = [
  { en: "sarees", bn: "শাড়ি-থ্রিপিস", shop: ["Saree & three-piece shop", "শাড়ি-থ্রিপিসের দোকান"] as Pair, item: ["Dhakai Jamdani · Red", "ঢাকাই জামদানি · লাল"] as Pair, detail: ["Colour: red · Size: free", "রং: লাল · সাইজ: ফ্রি"] as Pair, price: 6500, icon: <Dress weight="duotone" />, tint: "#F6DDD8", ink: "#A8323F", feat: ["Sizes and colours on one product", "এক পণ্যেই সাইজ আর রং"] as Pair },
  { en: "jewellery", bn: "গয়না", shop: ["Jewellery shop", "গয়নার দোকান"] as Pair, item: ["Oxidised jhumka set", "অক্সিডাইজড ঝুমকা সেট"] as Pair, detail: ["Combo: 3 pieces together", "কম্বো: ৩টি একসাথে"] as Pair, price: 1250, icon: <Diamond weight="duotone" />, tint: "#F4E6C4", ink: "#8A5D0B", feat: ["Sell matching sets as one combo", "সেট মিলিয়ে কম্বো বিক্রি"] as Pair },
  { en: "cosmetics", bn: "কসমেটিকস", shop: ["Cosmetics shop", "কসমেটিকসের দোকান"] as Pair, item: ["Vitamin C serum", "ভিটামিন সি সিরাম"] as Pair, detail: ["Expires March 2027", "মেয়াদ মার্চ ২০২৭"] as Pair, price: 1450, icon: <Drop weight="duotone" />, tint: "#DDEBF8", ink: "#255E9E", feat: ["Expiry dates on every batch", "প্রতিটা ব্যাচের মেয়াদ মনে রাখে"] as Pair },
  { en: "shoes", bn: "জুতা", shop: ["Shoe shop", "জুতার দোকান"] as Pair, item: ["Leather loafer", "লেদার লোফার"] as Pair, detail: ["Size 41 · 3 left", "সাইজ ৪১ · স্টকে ৩টি"] as Pair, price: 2800, icon: <Sneaker weight="duotone" />, tint: "#ECE3D8", ink: "#6B4628", feat: ["Stock for every size, separately", "প্রতিটা সাইজের আলাদা স্টক"] as Pair },
  { en: "gadgets", bn: "গ্যাজেট", shop: ["Gadget shop", "গ্যাজেটের দোকান"] as Pair, item: ["Wireless earbuds", "ওয়্যারলেস ইয়ারবাড"] as Pair, detail: ["Barcode 8901234567890", "বারকোড ৮৯০১২৩৪৫৬৭৮৯০"] as Pair, price: 1990, icon: <Headphones weight="duotone" />, tint: "#E4E4F6", ink: "#4040A8", feat: ["Print your own barcode labels", "নিজের বারকোড লেবেল প্রিন্ট"] as Pair },
];

const HOW_MANY = [50, 300, 1500, 6000];

/** Example sellers the sentence cycles through until the visitor takes over. */
const EXAMPLES: [number, number, number][] = [
  [0, 0, 1],
  [1, 1, 1],
  [2, 2, 2],
  [3, 4, 0],
];

type Slot = "where" | "what" | "count";
type Pick = [number, number, number];

/**
 * Centred and calm, with one idea: the headline is a sentence the visitor
 * finishes about their own shop, and the shop dashboard under it rebuilds
 * itself for that shop as the words change.
 */
export function Hero({ signedIn }: { signedIn: boolean }) {
  const { t, n, lang } = useSite();
  const [pick, setPick] = useState<Pick>(EXAMPLES[0]);
  const [touched, setTouched] = useState(false);
  const [open, setOpen] = useState<Slot | null>(null);

  // Plays through a few sellers once so the words read as changeable, then rests on the first.
  useEffect(() => {
    if (touched || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setPick(EXAMPLES[i % EXAMPLES.length]);
      if (i >= EXAMPLES.length) clearInterval(id);
    }, 3000);
    return () => clearInterval(id);
  }, [touched]);

  const choose = (slot: Slot, v: number) => {
    setTouched(true);
    setPick(([w, x, c]) => (slot === "where" ? [v, x, c] : slot === "what" ? [w, v, c] : [w, x, v]));
    setOpen(null);
  };
  const toggle = (slot: Slot) => {
    setTouched(true);
    setOpen((o) => (o === slot ? null : slot));
  };
  const close = () => setOpen(null);

  const where = WHERE[pick[0]];
  const what = WHAT[pick[1]];
  const count = HOW_MANY[pick[2]];
  const orders = (c: number) => (lang === "bn" ? `${n(c)}টা` : n(c));
  const slot = (id: Slot, label: string, options: string[], current: number) => (
    <Choice id={id} label={label} options={options} current={current} open={open === id} onToggle={() => toggle(id)} onPick={(v) => choose(id, v)} onClose={close} />
  );
  const whereSlot = slot("where", t(where.en, where.bn), WHERE.map((x) => t(x.en, x.bn)), pick[0]);
  const whatSlot = slot("what", t(what.en, what.bn), WHAT.map((x) => t(x.en, x.bn)), pick[1]);
  const countSlot = slot("count", orders(count), HOW_MANY.map(orders), pick[2]);

  return (
    <section className="relative overflow-x-clip">
      <div className="relative mx-auto flex max-w-[1240px] flex-col items-center px-5 pt-20 text-center md:px-8 md:pt-28">
        <h1 className={cn("max-w-[980px] text-balance font-display font-semibold tracking-[-0.035em] text-ink", lang === "bn" ? "text-[clamp(34px,5vw,66px)]" : "text-[clamp(36px,5.4vw,72px)]", "leading-[1.22]")}>
          {lang === "bn" ? (
            <>
              আমি {whereSlot} {whatSlot} বিক্রি করি, মাসে প্রায় {countSlot} অর্ডার আসে।
            </>
          ) : (
            <>
              I sell {whatSlot} {whereSlot} and get about {countSlot} orders a month.
            </>
          )}
        </h1>

        <p className="mt-7 max-w-[600px] text-[18px] leading-relaxed text-ink-3 md:text-[21px]">
          {t("BechaKena takes it from there: stock, invoices, couriers and cash on delivery, in one Bangla app.", "বাকিটা বেচাকেনার — স্টক, ইনভয়েস, কুরিয়ার আর ক্যাশ অন ডেলিভারি, এক বাংলা অ্যাপে।")}
        </p>

        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <Link href={signedIn ? "/dashboard" : "/login"} className="inline-flex h-12 items-center rounded-full bg-ink px-7 text-[15.5px] font-semibold text-white transition-opacity hover:opacity-85">
            {signedIn ? t("Open my shop", "আমার দোকান খুলুন") : t("Open this shop", "এই দোকানটা খুলুন")}
          </Link>
          <Link href="/dashboard" className="inline-flex h-12 items-center rounded-full px-5 text-[15.5px] font-semibold text-ink transition-colors hover:bg-sunken">
            {t("Try the demo shop", "ডেমো দোকান দেখুন")}
          </Link>
        </div>
        <p className="mt-5 text-[13.5px] text-ink-3">{t("Tap an underlined word to make it your shop. Try it with 5 invoices, no card needed.", "দাগ দেওয়া শব্দে চাপ দিয়ে নিজের দোকান বানান। ৫টা ইনভয়েস দিয়ে দেখে নিন, কার্ড লাগে না।")}</p>
      </div>

      <Showcase pick={pick} />
    </section>
  );
}

/* ------------------------------------------------------------ showcase */

function Showcase({ pick }: { pick: Pick }) {
  return (
    <div className="mx-auto mt-16 max-w-[1000px] px-5 pb-28 md:mt-24 md:px-8 md:pb-36">
      <ShopCard pick={pick} />
    </div>
  );
}

/* ------------------------------------------------------------ the card */

/** The visitor's shop, rebuilt from their sentence. */
function ShopCard({ pick }: { pick: Pick }) {
  const { t, n } = useSite();
  const where = WHERE[pick[0]];
  const what = WHAT[pick[1]];
  const count = HOW_MANY[pick[2]];
  const plan = PLANS.find((p) => p.orders >= count) ?? PLANS[PLANS.length - 1];
  // Same figure the pricing section shows by default: the yearly price, per day.
  const perDay = Math.round((plan.price * 10) / 365);
  const tier = PLANS.indexOf(plan);
  // Each feature names the plan it comes with when the suggested plan doesn't include it.
  const needs = (min: number, f: Pair): Pair => (tier >= min ? f : [`${f[0]} (from ${PLANS[min].name[0]})`, `${f[1]} (${PLANS[min].name[1]} থেকে)`]);
  const feats: Pair[] = [where.feat, what.feat, where.online ? needs(1, ["Courier booking and COD, courier by courier", "কুরিয়ার বুকিং আর কোন কুরিয়ারে কত COD"]) : ["Bangla invoices your customers can read", "কাস্টমারের পড়ার মতো বাংলা ইনভয়েস"]];
  const sales = count * what.price;

  return (
    <div className="relative overflow-hidden rounded-[28px] bg-surface text-left shadow-[0_0_0_1px_rgb(18_18_18/0.05),0_30px_80px_-30px_rgb(18_18_18/0.22)]">
      {/* header */}
      <div className="flex items-center gap-3 border-b border-line px-5 py-4 md:px-7">
        <span key={pick[1]} className="grid size-10 shrink-0 place-items-center rounded-[12px] text-[22px] transition-colors duration-500 motion-safe:animate-[bk-soft-in_.6s_cubic-bezier(.22,1,.36,1)_both]" style={{ background: what.tint, color: what.ink }}>
          {what.icon}
        </span>
        <div className="min-w-0 flex-1">
          <Roll value={t(what.shop[0], what.shop[1])} className="grid truncate font-display text-[16px] font-semibold text-ink" />
          <p className="flex items-center gap-1.5 text-[12px] text-ink-3">
            <span style={{ color: where.color }}>{where.icon}</span>
            <Roll value={where.online ? t(`Sells on ${where.app[0] === "Messenger" ? "Facebook" : where.app[0]}`, `${where.bn} বিক্রি`) : t("Sells at the counter", "দোকানে বিক্রি")} />
          </p>
        </div>
        <span className="hidden items-center gap-1.5 rounded-full bg-sunken px-2.5 py-1 text-[12px] font-medium text-ink-2 sm:inline-flex">
          {t("Example", "উদাহরণ")}
        </span>
      </div>

      <div className="grid md:grid-cols-[1.2fr_1fr]">
        {/* this month: laid out like the app's own sales widget */}
        <div className="border-b border-line p-5 md:border-b-0 md:border-r md:p-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[15px] font-semibold text-ink">{t("Orders", "অর্ডার")}</p>
              <p className="text-[13px] text-ink-3">{t("This month", "এই মাস")}</p>
            </div>
            <div className="text-right">
              <p className="tnum overflow-hidden font-display text-[34px] font-semibold leading-[1.05] tracking-[-0.03em] text-ink md:text-[40px]">
                <Roll value={n(count)} delay={STAGGER.count} />
              </p>
              <p className="tnum text-[12.5px] font-semibold text-ok">
                ↗ {n(12)}% <span className="font-normal text-ink-3"><Roll value={t(`৳${n(sales)} in sales`, `৳${n(sales)} বিক্রি`)} delay={STAGGER.count + 60} /></span>
              </p>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-4 text-[12px] text-ink-3" aria-hidden>
            <span className="flex items-center gap-1.5">
              <span className="h-[2.5px] w-4 rounded-full bg-brand-600" />
              {t("This month", "এই মাস")}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-4 border-t-2 border-dashed border-ink-4" />
              {t("Last month", "গত মাস")}
            </span>
          </div>
          <Spark seed={pick[1] + pick[2]} />
          <div className="mt-2 flex justify-between text-[11px] text-ink-3">
            {[1, 2, 3, 4].map((w) => (
              <span key={w}>{t(`Wk ${w}`, `সপ্তাহ ${n(w)}`)}</span>
            ))}
          </div>
        </div>

        {/* made for this shop */}
        <div className="p-5 md:p-7">
          <div className="flex items-center justify-between gap-3 rounded-[16px] bg-surface-2 p-3.5">
            <div>
              <p className="text-[12px] text-ink-3">{t("Your plan", "আপনার প্ল্যান")}</p>
              <p className="font-display text-[20px] font-semibold leading-tight text-ink">
                <Roll value={t(plan.name[0], plan.name[1])} delay={STAGGER.count} />
              </p>
            </div>
            <p className="tnum text-right text-[14px] font-semibold text-ink">
              <Roll value={t(`৳${n(perDay)} a day`, `দিনে ৳${n(perDay)}`)} delay={STAGGER.count + 60} />
            </p>
          </div>
          <p className="mt-5 text-[12.5px] font-medium text-ink-3">{t("Most useful for this shop", "এই দোকানের সবচেয়ে কাজে লাগবে")}</p>
          <ul className="mt-2.5 min-h-[136px] space-y-2.5 md:min-h-0">
            {feats.map((f, i) => (
              <li key={i} className="flex items-start gap-2.5 text-[14px] leading-snug text-ink">
                <span className="mt-[2px] grid size-[18px] shrink-0 place-items-center rounded-full bg-brand text-brand-contrast transition-colors duration-500">
                  <Check className="size-2.5" weight="bold" />
                </span>
                <Roll value={t(f[0], f[1])} delay={i * 70} className="grid min-w-0 flex-1" />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

/** A month of orders climbing; the shape shifts a little with each shop. One series, so no legend. */
function Spark({ seed }: { seed: number }) {
  const base = [18, 22, 20, 27, 31, 29, 36, 34, 41, 47, 45, 52];
  const pts = base.map((v, i) => v + (((i * 7 + seed * 5) % 9) - 4) * 0.8);
  const w = 420;
  const h = 96;
  const x = (i: number) => (i / (pts.length - 1)) * w;
  const y = (v: number) => h - 6 - ((v - 12) / 46) * (h - 12);
  const line = pts.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  // Last month, a little lower: the comparison the app draws dashed.
  const prev = pts.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v * 0.86 + 1).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="mt-3 h-[96px] w-full overflow-visible" aria-hidden>
      <defs>
        <linearGradient id="bk-spark" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="var(--brand)" stopOpacity="0.38" />
          <stop offset="1" stopColor="var(--brand)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={prev} fill="none" stroke="var(--ink-4)" strokeWidth="1.5" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" className="transition-[d] duration-700" />
      <path d={`${line} L${w},${h} L0,${h} Z`} fill="url(#bk-spark)" className="transition-[d] duration-700" />
      <path d={line} fill="none" stroke="var(--brand-600)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" className="transition-[d] duration-700" />
      <circle cx={x(pts.length - 1)} cy={y(pts[pts.length - 1])} r="4.5" fill="var(--surface)" stroke="var(--brand-600)" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/* ------------------------------------------------------------ choices */

/** A lime word in the sentence that opens its alternatives. */
function Choice({ id, label, options, current, open, onToggle, onPick, onClose }: { id: Slot; label: string; options: string[]; current: number; open: boolean; onToggle: () => void; onPick: (i: number) => void; onClose: () => void }) {
  const { t } = useSite();
  const wrap = useRef<HTMLSpanElement>(null);
  const [align, setAlign] = useState<"left" | "center" | "right">("center");
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const r = wrap.current?.getBoundingClientRect();
    const frame = requestAnimationFrame(() => setAlign(!r ? "center" : r.left < 140 ? "left" : r.right > window.innerWidth - 140 ? "right" : "center"));
    const down = (e: MouseEvent) => !wrap.current?.contains(e.target as Node) && closeRef.current();
    const key = (e: KeyboardEvent) => e.key === "Escape" && closeRef.current();
    document.addEventListener("mousedown", down);
    document.addEventListener("keydown", key);
    wrap.current?.querySelector<HTMLButtonElement>("[role=option][aria-selected=true]")?.focus();
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("mousedown", down);
      document.removeEventListener("keydown", key);
    };
  }, [open]);

  const name = { where: t("Where you sell", "কোথায় বিক্রি করেন"), what: t("What you sell", "কী বিক্রি করেন"), count: t("Orders a month", "মাসে অর্ডার") }[id];

  return (
    <span ref={wrap} className="relative inline-block whitespace-nowrap">
      <button
        type="button"
        onClick={onToggle}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${name}: ${label}`}
        className={cn(
          // A fill-in-the-blank line in the accent: as wide as the longest option, so it reads like a form.
          "inline-flex items-center gap-[0.1em] overflow-hidden rounded-[0.08em] bg-[linear-gradient(var(--brand),var(--brand))] bg-[length:100%_0.11em] bg-[position:0_94%] bg-no-repeat px-[0.04em] text-ink outline-none transition-[background-size] duration-300 hover:bg-[length:100%_0.32em] focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2",
          open && "bg-[length:100%_0.32em]",
        )}
      >
        {/* Every option sits invisibly in the same cell, so the chip is always as wide as the longest one and the sentence never reflows. */}
        <span className="inline-grid text-center">
          {options.map((o) => (
            <span key={o} aria-hidden className="invisible [grid-area:1/1]">
              {o}
            </span>
          ))}
          <Roll value={label} delay={STAGGER[id]} className="[grid-area:1/1]" />
        </span>
        <CaretDown className={cn("size-[0.32em] opacity-60 transition-transform", open && "rotate-180")} weight="bold" />
      </button>
      {open && (
        <span
          role="listbox"
          aria-label={name}
          className={cn(
            "absolute top-full z-40 mt-2 flex w-max min-w-[210px] max-w-[min(320px,calc(100vw-40px))] flex-col rounded-[20px] border border-line bg-surface p-1.5 text-left font-sans text-[15px] font-medium tracking-normal text-ink shadow-[0_28px_56px_-20px_rgb(18_18_18/0.35)] motion-safe:animate-[bk-msg_.2s_var(--ease-out)]",
            align === "left" ? "left-0" : align === "right" ? "right-0" : "left-1/2 -translate-x-1/2",
          )}
        >
          <span className="px-3 pb-1 pt-1.5 text-[12px] font-normal text-ink-3">{name}</span>
          {options.map((o, i) => (
            <button
              key={o}
              type="button"
              role="option"
              aria-selected={i === current}
              onClick={() => onPick(i)}
              className={cn("flex items-center justify-between gap-6 rounded-[14px] px-3 py-2.5 text-left leading-none transition-colors hover:bg-sunken focus-visible:bg-sunken focus-visible:outline-none", i === current ? "text-ink" : "text-ink-2")}
            >
              {o}
              {i === current && <Check className="size-4 text-ink" weight="bold" />}
            </button>
          ))}
        </span>
      )}
    </span>
  );
}

/* ------------------------------------------------------------ motion */

/** Sentence order, so a cycle ripples left to right instead of everything changing at once. */
const STAGGER: Record<Slot, number> = { where: 0, what: 90, count: 180 };

/**
 * Text that rolls to its new value like an odometer: the old value slides up
 * out of a clipped window as the new one slides in beneath it. No blur and no
 * overlap, so there's never a moment of doubled letters.
 */
function Roll({ value, delay = 0, className }: { value: string; delay?: number; className?: string }) {
  const [roll, setRoll] = useState({ cur: value, prev: null as string | null, n: 0 });
  // Remember the outgoing value during render (no effect, so no flash of the new text alone).
  if (roll.cur !== value) setRoll({ cur: value, prev: roll.cur, n: roll.n + 1 });
  const style = { animationDelay: `${delay}ms` };
  return (
    <span className={cn("relative -my-[0.14em] inline-grid overflow-hidden py-[0.14em]", className)}>
      {/* Out of the layout, so only the current value ever sizes the box; dropped once it has gone. */}
      {roll.prev !== null && (
        <span
          key={`out${roll.n}`}
          aria-hidden
          onAnimationEnd={() => setRoll((r) => ({ ...r, prev: null }))}
          className="pointer-events-none absolute inset-x-0 top-[0.14em] motion-safe:animate-[bk-slot-out_.6s_cubic-bezier(.65,0,.35,1)_both] motion-reduce:hidden"
          style={style}
        >
          {roll.prev}
        </span>
      )}
      <span key={`in${roll.n}`} className={cn("[grid-area:1/1]", roll.n > 0 && "motion-safe:animate-[bk-slot-in_.6s_cubic-bezier(.65,0,.35,1)_both]")} style={style}>
        {roll.cur}
      </span>
    </span>
  );
}
