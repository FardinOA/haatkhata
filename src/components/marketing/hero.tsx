"use client";

import { ArrowRight, CaretDown, Check, Diamond, Dress, Drop, Headphones, InstagramLogo, MessengerLogo, Sneaker, Storefront, WhatsappLogo } from "@phosphor-icons/react";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "../ui/core";
import { PLANS } from "./data";
import { useSite } from "./site-kit";

type Pair = [string, string];

const CHAT_FEAT: Pair = ["Paste a chat, the order fills itself", "চ্যাট পেস্ট করলেই অর্ডার তৈরি"];

const WHERE = [
  { en: "on Facebook", bn: "ফেসবুকে", app: ["Messenger", "মেসেঞ্জার"] as Pair, icon: <MessengerLogo weight="fill" />, color: "#0866FF", online: true, feat: CHAT_FEAT },
  { en: "on Instagram", bn: "ইনস্টাগ্রামে", app: ["Instagram", "ইনস্টাগ্রাম"] as Pair, icon: <InstagramLogo weight="fill" />, color: "#D62976", online: true, feat: CHAT_FEAT },
  { en: "on WhatsApp", bn: "হোয়াটসঅ্যাপে", app: ["WhatsApp", "হোয়াটসঅ্যাপ"] as Pair, icon: <WhatsappLogo weight="fill" />, color: "#1FAF55", online: true, feat: CHAT_FEAT },
  { en: "at my shop", bn: "দোকানে", app: ["Shop counter", "দোকানের কাউন্টার"] as Pair, icon: <Storefront weight="fill" />, color: "#121212", online: false, feat: ["Your phone scans barcodes, print 80 mm receipts", "ফোনেই বারকোড স্ক্যান, ৮০ মিমি রসিদ"] as Pair },
];

const WHAT = [
  { en: "sarees", bn: "শাড়ি-থ্রিপিস", shop: ["Saree & three-piece shop", "শাড়ি-থ্রিপিসের দোকান"] as Pair, price: 6500, icon: <Dress weight="duotone" />, tint: "#F6DDD8", ink: "#A8323F", feat: ["Sizes and colours on one product", "এক পণ্যেই সাইজ আর রং"] as Pair },
  { en: "jewellery", bn: "গয়না", shop: ["Jewellery shop", "গয়নার দোকান"] as Pair, price: 1250, icon: <Diamond weight="duotone" />, tint: "#F4E6C4", ink: "#8A5D0B", feat: ["Sell matching sets as one combo", "সেট মিলিয়ে কম্বো বিক্রি"] as Pair },
  { en: "cosmetics", bn: "কসমেটিকস", shop: ["Cosmetics shop", "কসমেটিকসের দোকান"] as Pair, price: 1450, icon: <Drop weight="duotone" />, tint: "#DDEBF8", ink: "#255E9E", feat: ["Expiry dates on every batch", "প্রতিটা ব্যাচের মেয়াদ মনে রাখে"] as Pair },
  { en: "shoes", bn: "জুতা", shop: ["Shoe shop", "জুতার দোকান"] as Pair, price: 2800, icon: <Sneaker weight="duotone" />, tint: "#ECE3D8", ink: "#6B4628", feat: ["Stock for every size, separately", "প্রতিটা সাইজের আলাদা স্টক"] as Pair },
  { en: "gadgets", bn: "গ্যাজেট", shop: ["Gadget shop", "গ্যাজেটের দোকান"] as Pair, price: 1990, icon: <Headphones weight="duotone" />, tint: "#E4E4F6", ink: "#4040A8", feat: ["Print your own barcode labels", "নিজের বারকোড লেবেল প্রিন্ট"] as Pair },
];

/** Typical monthly orders for each kind of shop: cheap, quick-moving goods sell more often than sarees. */
const ORDERS_FOR = [300, 1500, 1500, 600, 600];

/** Example sellers the badge cycles through until the visitor takes over. */
const EXAMPLES: [number, number][] = [
  [0, 0],
  [1, 1],
  [2, 2],
  [3, 4],
];

type Slot = "where" | "what";
type Pick = [number, number];

/**
 * Laid out like a calm product hero: a glow, a badge, two lines and a product
 * card. The badge is ours: it's a sentence about the visitor's shop, and the
 * card under the headline rebuilds itself for that shop as its words change.
 */
export function Hero({ signedIn }: { signedIn: boolean }) {
  const { t, lang } = useSite();
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
    setPick(([w, x]) => (slot === "where" ? [v, x] : [w, v]));
    setOpen(null);
  };
  const toggle = (slot: Slot) => {
    setTouched(true);
    setOpen((o) => (o === slot ? null : slot));
  };
  const close = () => setOpen(null);

  const where = WHERE[pick[0]];
  const what = WHAT[pick[1]];
  const slot = (id: Slot, label: string, options: string[], current: number) => (
    <Choice id={id} label={label} options={options} current={current} open={open === id} onToggle={() => toggle(id)} onPick={(v) => choose(id, v)} onClose={close} />
  );
  const whereSlot = slot("where", t(where.en, where.bn), WHERE.map((x) => t(x.en, x.bn)), pick[0]);
  const whatSlot = slot("what", t(what.en, what.bn), WHAT.map((x) => t(x.en, x.bn)), pick[1]);

  return (
    <section className="relative">
      {/* Reaches up under the clear nav, so the page opens in a wash of lime. */}
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-[-260px] h-[680px] w-[min(1100px,150vw)] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--brand)_45%,transparent),transparent)] transition-colors duration-500" />

      <div className="relative mx-auto flex max-w-[1240px] flex-col items-center px-5 pt-14 text-center md:px-8 md:pt-20">
        <div className={cn("inline-flex max-w-full flex-wrap items-center justify-center gap-x-1.5 gap-y-1 rounded-[22px] border border-line bg-surface py-1 pl-3.5 text-[13px] font-medium text-ink-2 shadow-[0_1px_2px_rgb(18_18_18/0.06)]", lang === "bn" ? "pr-3.5" : "pr-1")}>
          {lang === "bn" ? (
            <>
              আমি {whereSlot} {whatSlot} বিক্রি করি
            </>
          ) : (
            <>
              I sell {whatSlot} {whereSlot}
            </>
          )}
        </div>

        <h1 className={cn("mt-7 text-balance font-display font-semibold text-ink", lang === "bn" ? "text-[clamp(38px,5.6vw,76px)] leading-[1.16] tracking-[-0.03em]" : "text-[clamp(42px,6.4vw,88px)] leading-[1.02] tracking-[-0.04em]")}>
          {t("Every order, from chat", "চ্যাট থেকে ক্যাশ পর্যন্ত,")}
          <br className="hidden sm:block" /> {t("to cash in hand", "প্রতিটা অর্ডার এক জায়গায়")}
        </h1>

        <p className="mt-6 max-w-[580px] text-pretty text-[17px] leading-relaxed text-ink-3 md:text-[19px]">
          {t("HaatKhata keeps your stock, invoices, couriers and cash on delivery in step, so you can answer the next customer instead of chasing the last parcel.", "স্টক, ইনভয়েস, কুরিয়ার আর ক্যাশ অন ডেলিভারি সব মিলিয়ে রাখে হাটখাতা। আপনি শুধু পরের কাস্টমারকে উত্তর দিন।")}
        </p>

        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <Link href={signedIn ? "/dashboard" : "/login"} className="group inline-flex h-12 items-center gap-2 rounded-full bg-ink pl-6 pr-5 text-[15px] font-semibold text-white transition-opacity hover:opacity-85">
            {signedIn ? t("Open my shop", "আমার দোকান খুলুন") : t("Open your shop", "দোকান খুলুন")}
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" weight="bold" />
          </Link>
          <Link href="/dashboard" className="inline-flex h-12 items-center gap-2 rounded-full border border-line bg-surface px-6 text-[15px] font-semibold text-ink shadow-[0_1px_2px_rgb(18_18_18/0.05)] transition-colors hover:border-line-strong">
            <Storefront className="size-[18px]" />
            {t("Try the demo shop", "ডেমো দোকান দেখুন")}
          </Link>
        </div>
        <p className="mt-5 text-[12.5px] text-ink-3">{t("5 invoices to try it · No card needed", "৫টা ইনভয়েস দিয়ে দেখে নিন · কার্ড লাগে না")}</p>
      </div>

      <Showcase pick={pick} />
    </section>
  );
}

/* ------------------------------------------------------------ showcase */

function Showcase({ pick }: { pick: Pick }) {
  const { t, n, lang } = useSite();
  const where = WHERE[pick[0]];
  const what = WHAT[pick[1]];
  const count = ORDERS_FOR[pick[1]];
  const plan = PLANS.find((p) => p.orders >= count) ?? PLANS[PLANS.length - 1];
  // Same figure the pricing section shows by default: the yearly price, per day.
  const perDay = Math.round((plan.price * 10) / 365);
  const sales = count * what.price;
  // Online orders are mostly cash on delivery, and some of it is still with the courier.
  const cash = where.online ? Math.round(sales * 0.82) : sales;

  return (
    <div className="relative mx-auto mt-16 max-w-[1240px] px-5 pb-24 md:mt-20 md:px-8 md:pb-32">
      <Orbit />
      <div className="relative mx-auto max-w-[900px]">
        <ShopCard pick={pick} count={count} />
        <Floating className="-left-44 top-[72px]">
          <p className={eyebrow(lang)}>
            <Roll value={where.online ? t("COD collected", "COD আদায়") : t("Cash at the counter", "কাউন্টারে নগদ")} />
          </p>
          <p className="tnum mt-1.5 font-display text-[22px] font-semibold leading-none tracking-[-0.02em] text-ink">
            <Roll value={`৳${n(cash)}`} delay={STAGGER.what} />
          </p>
          <p className="tnum mt-2 text-[12px] font-semibold text-brand-ink">↑ {t(`${n(18)}% this month`, `এই মাসে ${n(18)}%`)}</p>
        </Floating>
        <Floating className="-right-44 bottom-14">
          <p className={eyebrow(lang)}>{t("Plan for this shop", "এই দোকানের প্ল্যান")}</p>
          <p className="mt-1.5 font-display text-[22px] font-semibold leading-none tracking-[-0.02em] text-ink">
            <Roll value={t(plan.name[0], plan.name[1])} delay={STAGGER.what} />
          </p>
          <p className="tnum mt-2 text-[12px] font-semibold text-brand-ink">
            <Roll value={t(`৳${n(perDay)} a day, yearly`, `বছরে নিলে দিনে ৳${n(perDay)}`)} delay={STAGGER.what + 60} />
          </p>
        </Floating>
      </div>
    </div>
  );
}

const eyebrow = (lang: string) => cn("text-[11px] font-semibold text-ink-3", lang === "en" && "uppercase tracking-[0.08em]");

/** A small stat card resting on the edge of the shop card. Only where there is room beside it: on smaller screens the card says it all. */
function Floating({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("absolute z-10 hidden w-[188px] rounded-[18px] border border-line bg-surface p-4 text-left shadow-[0_24px_48px_-20px_rgb(18_18_18/0.28)] xl:block", className)}>{children}</div>;
}

/** The order loop: an ellipse behind the card with parcels travelling round it. */
function Orbit() {
  const [motion, setMotion] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setMotion(!mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  const loop = "M 40 190 A 520 170 0 1 1 1080 190 A 520 170 0 1 1 40 190";
  return (
    <svg aria-hidden viewBox="0 0 1120 380" className="pointer-events-none absolute left-1/2 top-1/2 hidden w-[min(1120px,100%)] -translate-x-1/2 -translate-y-[56%] overflow-visible md:block">
      <path id="bk-orbit" d={loop} fill="none" stroke="var(--line-strong)" strokeWidth="1" />
      {/* Only while moving: without a path to follow they would sit in the corner. */}
      {motion &&
        [0, 1, 2].map((i) => (
          <circle key={i} r={i === 0 ? 4.5 : 3} fill={i === 1 ? "var(--ink)" : "var(--brand-500)"}>
            <animateMotion dur="18s" repeatCount="indefinite" begin={`${-i * 6}s`}>
              <mpath href="#bk-orbit" />
            </animateMotion>
          </circle>
        ))}
    </svg>
  );
}

/* ------------------------------------------------------------ the card */

/** The visitor's shop, rebuilt from the badge's sentence. */
function ShopCard({ pick, count }: { pick: Pick; count: number }) {
  const { t, n, lang } = useSite();
  const where = WHERE[pick[0]];
  const what = WHAT[pick[1]];
  const plan = PLANS.find((p) => p.orders >= count) ?? PLANS[PLANS.length - 1];
  const tier = PLANS.indexOf(plan);
  // Each feature names the plan it comes with when the suggested plan doesn't include it.
  const needs = (min: number, f: Pair): Pair => (tier >= min ? f : [`${f[0]} (from ${PLANS[min].name[0]})`, `${f[1]} (${PLANS[min].name[1]} থেকে)`]);
  const feats: Pair[] = [where.feat, what.feat, where.online ? needs(1, ["Courier booking and COD, courier by courier", "কুরিয়ার বুকিং আর কোন কুরিয়ারে কত COD"]) : ["Bangla invoices your customers can read", "কাস্টমারের পড়ার মতো বাংলা ইনভয়েস"]];
  // Online: parcels that reached the customer. At the counter: sales rung up with a receipt.
  const rate = where.online ? 90 + ((pick[0] + pick[1] * 2) % 6) : 100;
  const dots = ["bg-brand-500", "bg-ink", "bg-ink-4"];

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
          <span className="size-1.5 rounded-full bg-brand-500" />
          {t("Example", "উদাহরণ")}
        </span>
      </div>

      <div className="grid md:grid-cols-[1.25fr_1fr]">
        {/* this month */}
        <div className="border-b border-line p-5 md:border-b-0 md:border-r md:p-7">
          <p className={eyebrow(lang)}>{t("Orders · this month", "অর্ডার · এই মাস")}</p>
          <p className="tnum mt-2 overflow-hidden font-display text-[44px] font-semibold leading-[1.05] tracking-[-0.035em] text-ink md:text-[52px]">
            <Roll value={n(count)} delay={STAGGER.what} />
          </p>
          <p className="tnum mt-3 inline-flex items-center gap-1 rounded-full bg-brand-200 px-2.5 py-1 text-[12px] font-semibold text-brand-900">
            ↑ <Roll value={t(`৳${n(count * what.price)} in sales`, `৳${n(count * what.price)} বিক্রি`)} delay={STAGGER.what + 60} />
          </p>
          <Spark seed={pick[0] + pick[1]} />
          <div className="mt-2 flex justify-between text-[11px] text-ink-3">
            {[1, 2, 3, 4].map((w) => (
              <span key={w}>{t(`Wk ${w}`, `সপ্তাহ ${n(w)}`)}</span>
            ))}
          </div>
        </div>

        {/* made for this shop */}
        <div className="p-5 md:p-7">
          <div className="flex items-center gap-4">
            <Ring value={rate} label={`${n(rate)}%`} />
            <div className="min-w-0">
              <Roll value={where.online ? t("Parcels delivered", "পার্সেল পৌঁছেছে") : t("Sales with a receipt", "রসিদসহ বিক্রি")} className="grid text-[14px] font-semibold text-ink" />
              <p className="text-[12px] text-ink-3">{where.online ? t("Returns tracked per courier", "কোন কুরিয়ারে কত রিটার্ন") : t("Every sale on record", "প্রতিটা বিক্রির হিসাব")}</p>
            </div>
          </div>
          <p className={cn(eyebrow(lang), "mt-7")}>{t("Most useful for this shop", "এই দোকানের সবচেয়ে কাজে লাগবে")}</p>
          <ul className="mt-3 min-h-[112px] space-y-3 md:min-h-0">
            {feats.map((f, i) => (
              <li key={i} className="flex items-start gap-2.5 text-[13.5px] leading-snug text-ink-2">
                <span className={cn("mt-[6px] size-[7px] shrink-0 rounded-full", dots[i])} />
                <Roll value={t(f[0], f[1])} delay={i * 70} className="grid min-w-0 flex-1" />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

/** A thin progress ring with the figure inside. */
function Ring({ value, label }: { value: number; label: string }) {
  const r = 27;
  const c = 2 * Math.PI * r;
  return (
    <span className="relative grid size-[64px] shrink-0 place-items-center">
      <svg viewBox="0 0 64 64" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx="32" cy="32" r={r} fill="none" stroke="var(--line)" strokeWidth="3" />
        <circle cx="32" cy="32" r={r} fill="none" stroke="var(--brand-500)" strokeWidth="3" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - value / 100)} className="transition-[stroke-dashoffset] duration-700" />
      </svg>
      <span className="tnum relative text-[15px] font-semibold text-ink">{label}</span>
    </span>
  );
}

/** A month of orders climbing; the shape shifts a little with each shop. */
function Spark({ seed }: { seed: number }) {
  const base = [18, 22, 20, 27, 31, 29, 36, 34, 41, 47, 45, 52];
  const pts = base.map((v, i) => v + (((i * 7 + seed * 5) % 9) - 4) * 0.8);
  const w = 420;
  const h = 96;
  const x = (i: number) => (i / (pts.length - 1)) * w;
  const y = (v: number) => h - 6 - ((v - 12) / 46) * (h - 12);
  const line = pts.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="mt-6 h-[96px] w-full overflow-visible" aria-hidden>
      <defs>
        <linearGradient id="bk-spark" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="var(--brand)" stopOpacity="0.45" />
          <stop offset="1" stopColor="var(--brand)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L${w},${h} L0,${h} Z`} fill="url(#bk-spark)" className="transition-[d] duration-700" />
      <path d={line} fill="none" stroke="var(--brand-500)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" className="transition-[d] duration-700" />
      <circle cx={x(pts.length - 1)} cy={y(pts[pts.length - 1])} r="4.5" fill="var(--surface)" stroke="var(--brand-500)" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/* ------------------------------------------------------------ choices */

/** A lime tag in the badge's sentence that opens its alternatives. */
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

  const name = { where: t("Where you sell", "কোথায় বিক্রি করেন"), what: t("What you sell", "কী বিক্রি করেন") }[id];

  return (
    <span ref={wrap} className="relative inline-block whitespace-nowrap">
      <button
        type="button"
        onClick={onToggle}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${name}: ${label}`}
        className={cn(
          "inline-flex items-center gap-1 rounded-full bg-brand py-0.5 pl-2.5 pr-2 text-[12.5px] font-semibold text-brand-contrast outline-none transition-[filter] duration-200 hover:brightness-95 focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-1",
          open && "brightness-95",
        )}
      >
        {/* Every option sits invisibly in the same cell, so the tag is always as wide as the longest one and the badge never reflows. */}
        <span className="inline-grid text-center">
          {options.map((o) => (
            <span key={o} aria-hidden className="invisible [grid-area:1/1]">
              {o}
            </span>
          ))}
          <Roll value={label} delay={STAGGER[id]} className="[grid-area:1/1]" />
        </span>
        <CaretDown className={cn("size-3 opacity-70 transition-transform", open && "rotate-180")} weight="bold" />
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
const STAGGER: Record<Slot, number> = { where: 0, what: 90 };

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
