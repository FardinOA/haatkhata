"use client";

import { CheckCircle, FacebookLogo, HandCoins, HandTap, InstagramLogo, Storefront, TiktokLogo, WhatsappLogo, type Icon } from "@phosphor-icons/react";
import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { cn } from "../ui/core";
import { useInView, useMotionOk, useSite } from "./site-kit";

type Pair = [string, string];

/** One stop on the route: a brand glyph, or a monogram where we don't ship the logo. */
type Stop = { id: string; name: Pair; icon?: Icon; letter?: string; color: string; via?: string; counter?: boolean; payout?: boolean };

const ORDERS: Stop[] = [
  { id: "facebook", name: ["Facebook", "Facebook"], icon: FacebookLogo, color: "#0866FF" },
  { id: "instagram", name: ["Instagram", "Instagram"], icon: InstagramLogo, color: "#D62976" },
  { id: "whatsapp", name: ["WhatsApp", "WhatsApp"], icon: WhatsappLogo, color: "#1FAF55" },
  { id: "tiktok", name: ["TikTok", "TikTok"], icon: TiktokLogo, color: "#121212" },
  { id: "counter", name: ["Your counter", "দোকানের কাউন্টার"], icon: Storefront, color: "#45453F", counter: true },
];

const COURIERS: Stop[] = [
  { id: "steadfast", name: ["Steadfast", "স্টেডফাস্ট"], letter: "SF", color: "var(--ink)" },
  { id: "sundarban", name: ["Sundarban", "সুন্দরবন"], letter: "SB", color: "var(--ink)" },
];

const MONEY: Stop[] = [
  { id: "bkash", name: ["bKash", "বিকাশ"], letter: "b", color: "#E2136E", via: "বিকাশে" },
  { id: "payout", name: ["Courier payout", "কুরিয়ার পেআউট"], icon: HandCoins, color: "var(--cash)", payout: true },
];

const COLUMNS: { label: Pair; stops: Stop[] }[] = [
  { label: ["Orders come in on", "অর্ডার আসে"], stops: ORDERS },
  { label: ["Parcels go out with", "পার্সেল যায়"], stops: COURIERS },
  { label: ["Money comes back via", "টাকা ফেরে"], stops: MONEY },
];

type Route = [number, number, number];

/** Routes the map plays through once, so the stops read as tappable, then rests on the first. */
const EXAMPLES: Route[] = [
  [0, 0, 0],
  [2, 1, 1],
  [1, 0, 1],
  [4, 1, 0],
];

/**
 * Not a logo strip: the apps a seller already uses, laid out as a route map in
 * the order their money moves. One stop per column is lit, a line runs through
 * them, and the route ends as the single order row HaatKhata keeps for it.
 */
export function RouteMap() {
  const { t, n, lang } = useSite();
  const [route, setRoute] = useState<Route>(EXAMPLES[0]);
  const [touched, setTouched] = useState(false);
  const [sectionRef, seen] = useInView<HTMLElement>(0.4);
  const motion = useMotionOk();
  const mapRef = useRef<HTMLDivElement>(null);
  const line = useRouteLine(mapRef, route, lang);

  useEffect(() => {
    if (!seen || touched || !motion) return;
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setRoute(EXAMPLES[i % EXAMPLES.length]);
      if (i >= EXAMPLES.length) clearInterval(id);
    }, 2800);
    return () => clearInterval(id);
  }, [seen, touched, motion]);

  const pick = (col: number, i: number) => {
    setTouched(true);
    setRoute((r) => r.map((v, c) => (c === col ? i : v)) as Route);
  };

  return (
    <section ref={sectionRef} aria-labelledby="route-title" className="bg-surface-2">
      <div className="mx-auto max-w-[1120px] px-5 py-16 md:px-8 md:py-24">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <h2 id="route-title" className="max-w-[560px] text-balance font-display text-[28px] font-semibold leading-[1.12] tracking-[-0.025em] text-ink md:text-[36px]">
            {t("Your orders already travel this route.", "আপনার অর্ডার এই পথেই চলে।")} <span className="text-ink-3">{t("HaatKhata keeps the whole map.", "হাটখাতা পুরো পথটা মনে রাখে।")}</span>
          </h2>
          <p className="flex items-center gap-2 text-[13.5px] text-ink-3">
            <HandTap className="size-[18px] text-ink-2" />
            {t("Tap any stop to trace an order", "যেকোনো নামে ট্যাপ করে অর্ডারের পথ দেখুন")}
          </p>
        </div>

        <div ref={mapRef} className="relative mt-12 flex flex-col lg:mt-16 lg:grid lg:grid-cols-[repeat(3,minmax(0,1fr))_minmax(0,1.4fr)] lg:items-start lg:gap-x-14">
          {line && (
            <svg aria-hidden className="pointer-events-none absolute inset-0 hidden size-full overflow-visible lg:block">
              <path key={route.join()} d={line.d} pathLength={1} strokeDasharray={1} fill="none" stroke="var(--ink)" strokeWidth="1.5" className="animate-[bk-draw_900ms_var(--ease-out)_both]" />
              <circle cx={line.end[0]} cy={line.end[1]} r="3.5" fill="var(--ink)" />
              {motion && (
                <circle r="5" fill="var(--brand-500)" stroke="var(--ink)" strokeWidth="1.5">
                  <animateMotion dur="3.6s" repeatCount="indefinite" path={line.d} />
                </circle>
              )}
            </svg>
          )}

          {COLUMNS.map((col, c) => (
            <div key={c} role="group" aria-labelledby={`route-col-${c}`} className="relative">
              <p id={`route-col-${c}`} className="flex items-baseline gap-2 text-[13px] text-ink-3">
                <span className="tnum font-display font-semibold text-brand-ink">{n(String(c + 1).padStart(2, "0"))}</span>
                {t(...col.label)}
              </p>
              <div className="no-scrollbar -mx-5 mt-3 flex gap-2 overflow-x-auto px-5 md:-mx-8 md:px-8 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0">
                {col.stops.map((s, i) => (
                  <Chip key={s.id} stop={s} on={route[c] === i} onPick={() => pick(c, i)} />
                ))}
              </div>
              {/* On narrow screens the columns stack as swipeable rows, so a short rule stands in for the route line. */}
              <span aria-hidden className="my-3 ml-[22px] block h-5 w-px bg-ink/25 lg:hidden" />
            </div>
          ))}

          <OrderRow route={route} live={touched} />
        </div>
      </div>
    </section>
  );
}

function Chip({ stop, on, onPick }: { stop: Stop; on: boolean; onPick: () => void }) {
  const { t } = useSite();
  return (
    <button
      type="button"
      aria-pressed={on}
      data-lit={on || undefined}
      onClick={onPick}
      className={cn(
        "flex h-11 shrink-0 items-center gap-2.5 rounded-full border pl-1.5 pr-4 text-[14px] font-medium transition-[background-color,border-color,color] duration-200 lg:w-full",
        on ? "border-ink bg-ink text-white" : "border-line bg-surface text-ink-2 hover:border-line-strong hover:text-ink",
      )}
    >
      <Mark stop={stop} />
      <span className="truncate">{t(...stop.name)}</span>
    </button>
  );
}

function Mark({ stop, className }: { stop: Stop; className?: string }) {
  const { icon: Glyph, letter, color } = stop;
  return (
    <span aria-hidden className={cn("grid size-8 shrink-0 place-items-center rounded-full bg-white ring-1 ring-line", className)} style={{ color }}>
      {Glyph ? <Glyph weight="fill" className="size-[17px]" /> : <span className={cn("font-display font-bold leading-none", letter && letter.length > 1 ? "text-[11.5px] tracking-[-0.02em]" : "text-[14px]")}>{letter}</span>}
    </span>
  );
}

/** Where the route ends: the one order row HaatKhata keeps, drawn like the app's journey rail. */
function OrderRow({ route, live }: { route: Route; live: boolean }) {
  const { t, n } = useSite();
  const [from, courier, money] = [ORDERS[route[0]], COURIERS[route[1]], MONEY[route[2]]];
  const [courierName] = courier.name;
  const steps = [
    {
      stop: from,
      title: from.counter ? t("Sold at your counter", "দোকানের কাউন্টারে বিক্রি") : t(`Came in on ${from.name[0]}`, `${from.name[1]} থেকে এলো`),
      note: from.counter ? t("Rung up there, delivered from there", "সেখানেই বিল, সেখান থেকেই ডেলিভারি") : t("Name, phone and address read from the chat", "চ্যাট থেকে নাম, ফোন, ঠিকানা নেওয়া"),
    },
    { stop: courier, title: t(`Sent with ${courierName}`, `${courierName} দিয়ে পাঠানো`), note: t("Label printed, tracking number saved", "লেবেল প্রিন্ট, ট্র্যাকিং নম্বর সেভ") },
    money.payout
      ? { stop: money, title: t(`${courierName} paid out the COD`, `${courierName} COD টাকা পাঠালো`), note: t("Payout matched to this order", "পেআউট এই অর্ডারের সাথে মেলানো") }
      : { stop: money, title: t(`Paid on ${money.name[0]}`, `${money.via} পেমেন্ট এলো`), note: t("Advance matched to this order", "অগ্রিম এই অর্ডারের সাথে মেলানো") },
  ];

  return (
    <article data-lit aria-live={live ? "polite" : "off"} className="relative rounded-[22px] border border-line bg-surface p-5 shadow-[0_24px_48px_-24px_rgb(18_18_18/0.22)] md:p-6 lg:self-center">
      <div className="flex items-center justify-between gap-3">
        <p className="tnum text-[13px] text-ink-3">{t(`Order #${n("1042")}`, `অর্ডার #${n("1042")}`)}</p>
        <span className="inline-flex items-center gap-1 rounded-full bg-ok-soft py-1 pl-1.5 pr-2.5 text-[12px] font-semibold text-ok">
          <CheckCircle weight="fill" className="size-4" />
          {t("Settled", "মিটে গেছে")}
        </span>
      </div>
      <p className="figure mt-2 text-[34px] font-semibold leading-none text-ink">৳{n(2450)}</p>

      <ol className="relative mt-6 space-y-4">
        <span aria-hidden className="absolute bottom-4 left-4 top-4 w-px bg-line-strong" />
        {steps.map(({ stop, title, note }) => (
          <li key={stop.id} className="relative flex gap-3 animate-[bk-soft-in_400ms_var(--ease-out)_both]">
            <Mark stop={stop} />
            <div className="min-w-0 pt-0.5">
              <p className="text-[14px] font-semibold leading-snug text-ink">{title}</p>
              <p className="text-[12.5px] leading-snug text-ink-3">{note}</p>
            </div>
          </li>
        ))}
      </ol>

      <p className="mt-5 border-t border-line pt-4 text-[12.5px] text-ink-3">{t("Stock, courier and cash already agree. Nothing to copy by hand.", "স্টক, কুরিয়ার আর টাকার হিসাব মিলে আছে। হাতে কিছু লিখতে হয় না।")}</p>
    </article>
  );
}

/**
 * Measures the lit stops (in DOM order) and threads one curve through them,
 * ending at the left edge of the order row. Redrawn on every pick and resize.
 */
function useRouteLine(map: RefObject<HTMLElement | null>, route: Route, lang: string) {
  const [line, setLine] = useState<{ d: string; end: [number, number] } | null>(null);

  useLayoutEffect(() => {
    const el = map.current;
    if (!el) return;
    const draw = () => {
      const box = el.getBoundingClientRect();
      const rects = [...el.querySelectorAll("[data-lit]")].map((s) => s.getBoundingClientRect());
      if (rects.length < 2 || !rects[0].width) return setLine(null);
      const mid = (r: DOMRect) => r.top + r.height / 2 - box.top;
      // Starts inside the first chip so the travelling dot slips out from under it.
      let x = rects[0].right - box.left;
      let y = mid(rects[0]);
      let d = `M${rects[0].left + rects[0].width / 2 - box.left} ${y} L${x} ${y}`;
      rects.slice(1).forEach((r, i, rest) => {
        const nx = r.left - box.left;
        const ny = mid(r);
        const k = (nx - x) / 2;
        d += ` C${x + k} ${y} ${nx - k} ${ny} ${nx} ${ny}`;
        x = nx;
        y = ny;
        if (i < rest.length - 1) {
          x = r.right - box.left;
          d += ` L${x} ${y}`;
        }
      });
      setLine({ d, end: [x, y] });
    };
    const frame = requestAnimationFrame(draw);
    const ro = new ResizeObserver(draw);
    ro.observe(el);
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
    };
  }, [map, route, lang]);

  return line;
}
