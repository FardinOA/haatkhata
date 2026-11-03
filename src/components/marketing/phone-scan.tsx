"use client";

import { Barcode as BarcodeIcon, CheckCircle, DeviceMobile, Monitor, Usb, WarningCircle } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { cn } from "../ui/core";
import { Barcode } from "../products/barcode";
import { eanCheckDigit } from "@/lib/barcode";
import { SectionHead, useInView, useMotionOk, useSite } from "./site-kit";

const ean = (body: string) => body + eanCheckDigit(body);

/** Hang tags on the counter. Real EAN-13s — the app itself would scan these. */
const TAGS = [
  { id: "kurti", en: "Kurti · M · Indigo", bn: "কুর্তি · M · ইন্ডিগো", price: 1450, stock: 9, code: ean("200143500017"), tilt: -3, tint: "#DCE2F7" },
  { id: "hijab", en: "Georgette hijab", bn: "জর্জেট হিজাব", price: 650, stock: 14, code: ean("200065000024"), tilt: 2, tint: "#F6DDD8" },
  { id: "saree", en: "Tangail saree", bn: "টাঙ্গাইল শাড়ি", price: 3200, stock: 3, code: ean("200320000031"), tilt: -1.5, tint: "#F4E6C4" },
  { id: "jhumka", en: "Jhumka", bn: "ঝুমকা", price: 480, stock: 0, code: ean("200048000048"), tilt: 3, tint: "#E9E2F4" },
] as const;
type Tag = (typeof TAGS)[number];

type Result = { ok: boolean; title: string; detail: string; at: number };

/**
 * The phone-as-scanner pitch, shown rather than told: pair the phone with
 * the counter's QR, tap a tag, and watch it land in the computer's cart.
 */
export function PhoneScan() {
  const { t, n } = useSite();
  const motion = useMotionOk();
  const [ref, seen] = useInView<HTMLDivElement>(0.35);
  const [paired, setPaired] = useState(false);
  const [pairing, setPairing] = useState(false);
  const [cart, setCart] = useState<{ id: Tag["id"]; qty: number }[]>([]);
  const [inView, setInView] = useState<Tag | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [flash, setFlash] = useState<Result | null>(null);
  const touched = useRef(false);
  // Timed steps (and the autoplay) read the latest pairing and cart from here.
  const live = useRef({ paired, cart });
  useEffect(() => {
    live.current = { paired, cart };
  });
  const timers = useRef<number[]>([]);

  const later = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms));
  const stopAuto = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  useEffect(() => {
    let live = true;
    import("qrcode")
      .then((QR) => QR.toDataURL(`${window.location.origin}/login`, { margin: 0, width: 200, errorCorrectionLevel: "M", color: { dark: "#121212", light: "#0000" } }))
      .then((d) => live && setQr(d))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (!flash) return;
    const id = window.setTimeout(() => setFlash(null), 550);
    return () => clearTimeout(id);
  }, [flash]);

  const show = (r: Omit<Result, "at">) => {
    const full = { ...r, at: Date.now() };
    setResult(full);
    setFlash(full);
  };

  const pair = (then?: () => void) => {
    if (live.current.paired) return then?.();
    setPairing(true);
    later(900, () => {
      setPairing(false);
      setPaired(true);
      live.current.paired = true;
      then?.();
    });
  };

  const scan = (tag: Tag) => {
    if (!live.current.paired) return pair(() => scan(tag));
    setInView(tag);
    later(450, () => {
      const c = live.current.cart;
      const have = c.find((l) => l.id === tag.id)?.qty ?? 0;
      if (have >= tag.stock) {
        show({ ok: false, title: t(`${tag.en} — out of stock`, `${tag.bn} — স্টকে নেই`), detail: t("Not added. No overselling.", "যোগ হয়নি। স্টকের বেশি বিক্রি হয় না।") });
        return;
      }
      const next = have ? c.map((l) => (l.id === tag.id ? { ...l, qty: l.qty + 1 } : l)) : [...c, { id: tag.id, qty: 1 }];
      live.current.cart = next;
      setCart(next);
      show({ ok: true, title: t(tag.en, tag.bn), detail: t(`৳${n(tag.price)} · ${have + 1} in cart`, `৳${n(tag.price)} · কার্টে ${n(have + 1)}টি`) });
    });
  };

  const byHand = (fn: () => void) => {
    touched.current = true;
    stopAuto();
    fn();
  };

  // Plays itself once when it scrolls into view, until the visitor takes over.
  useEffect(() => {
    if (!seen || !motion || touched.current) return;
    const steps: [number, () => void][] = [
      [700, () => pair()],
      [1900, () => scan(TAGS[0])],
      [1900, () => scan(TAGS[2])],
      [1900, () => scan(TAGS[0])],
      [1900, () => scan(TAGS[3])],
    ];
    let at = 0;
    for (const [ms, fn] of steps) later((at += ms), fn);
    return stopAuto;
    // Runs once per reveal; `pair`/`scan` read fresh state through their own setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seen, motion]);

  const lines = cart.map((l) => ({ ...l, tag: TAGS.find((x) => x.id === l.id)! }));
  const total = lines.reduce((s, l) => s + l.tag.price * l.qty, 0);
  const count = lines.reduce((s, l) => s + l.qty, 0);

  return (
    <section id="scan" className="bg-surface-2">
      <div className="mx-auto max-w-[1120px] px-5 py-28 md:px-8 md:py-40">
        <SectionHead
          title={t("Your phone is the barcode scanner.", "আপনার ফোনই বারকোড স্ক্যানার।")}
          sub={t(
            "No scanner gun to buy, no app to install. Scan the QR on your computer once, and every product you scan with your phone lands in the cart — wirelessly.",
            "স্ক্যানার কিনতে হবে না, অ্যাপও লাগবে না। কম্পিউটারের QR একবার স্ক্যান করুন — এরপর ফোনে যা স্ক্যান করবেন, তারবিহীনভাবে সোজা কার্টে।",
          )}
        />

        <div ref={ref} className="mt-16 md:mt-20">
          <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_250px] lg:gap-12">
            {/* The computer at the counter */}
            <div className="overflow-hidden rounded-[22px] bg-canvas shadow-[0_0_0_1px_rgb(18_18_18/0.06),0_24px_60px_-28px_rgb(18_18_18/0.35)]">
              <div className="flex items-center gap-1.5 border-b border-line px-4 py-3">
                {["#E7E7E1", "#E7E7E1", "#E7E7E1"].map((c, i) => (
                  <span key={i} className="size-2.5 rounded-full" style={{ background: c }} />
                ))}
                <span className="ml-3 text-[12px] font-medium text-ink-3">{t("Order screen · counter computer", "অর্ডার স্ক্রিন · কাউন্টারের কম্পিউটার")}</span>
              </div>
              <div className="grid min-h-[200px] sm:min-h-[340px] sm:grid-cols-[minmax(0,1fr)_240px]">
                <div className="hidden p-4 sm:block">
                  <div className="flex h-10 items-center gap-2 rounded-xl border border-line px-3">
                    <span className="h-2 w-24 rounded-full bg-sunken" />
                    <span className={cn("relative ml-auto inline-flex h-7 items-center gap-1 rounded-lg bg-ink px-2.5 text-[11px] font-semibold text-white")}>
                      <DeviceMobile className="size-3.5" weight="bold" />
                      {t("Scan", "স্ক্যান")}
                      {paired && <span className="absolute -right-1 -top-1 size-2.5 rounded-full bg-ok ring-2 ring-canvas" />}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2.5">
                    {[...TAGS, null, null].map((tag, i) => {
                      const qty = tag ? (cart.find((l) => l.id === tag.id)?.qty ?? 0) : 0;
                      return (
                        <div key={tag?.id ?? i} className={cn("rounded-xl border p-1.5 transition-[border-color,box-shadow] duration-300", qty ? "border-brand ring-2 ring-brand/25" : "border-line")}>
                          <div className="relative aspect-[5/4] rounded-lg" style={{ background: tag?.tint ?? "var(--sunken)" }}>
                            {qty > 0 && (
                              <span key={qty} className="tnum absolute right-1.5 top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-brand px-1.5 text-[10.5px] font-semibold text-brand-contrast shadow-1 [animation:bk-rise_250ms_var(--ease-out)]">
                                {n(qty)}
                              </span>
                            )}
                          </div>
                          {tag ? (
                            <>
                              <p className="mt-1.5 truncate px-0.5 text-[11px] font-medium text-ink">{t(tag.en, tag.bn)}</p>
                              <p className="tnum px-0.5 text-[11px] font-semibold text-ink-3">৳{n(tag.price)}</p>
                            </>
                          ) : (
                            <>
                              <div className="mt-2 h-1.5 w-3/4 rounded-full bg-sunken" />
                              <div className="mt-1.5 h-1.5 w-1/3 rounded-full bg-line" />
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="relative flex flex-col border-line bg-surface-2/60 p-4 sm:border-l">
                  <p className="flex items-center justify-between text-[13px] font-semibold text-ink">
                    {t("Cart", "কার্ট")}
                    <span className="tnum text-ink-3">{n(count)}</span>
                  </p>
                  <ul className="mt-3 flex-1 space-y-2" aria-live="polite">
                    {lines.map((l) => (
                      <li key={l.id} className="flex items-center gap-2 rounded-xl bg-canvas px-3 py-2.5 text-[12.5px] shadow-1 [animation:bk-rise_350ms_var(--ease-out)]">
                        <span className="min-w-0 flex-1 truncate text-ink">{t(l.tag.en, l.tag.bn)}</span>
                        <span key={l.qty} className="tnum shrink-0 font-semibold text-ink-3 [animation:bk-rise_250ms_var(--ease-out)]">
                          ×{n(l.qty)}
                        </span>
                      </li>
                    ))}
                    {!lines.length && paired && <li className="pt-6 text-center text-[12.5px] text-ink-3">{t("Tap a tag below to scan it", "নিচের একটি ট্যাগে চাপুন")}</li>}
                  </ul>
                  <div className="mt-3 flex items-end justify-between border-t border-line pt-3">
                    <span className="text-[12px] text-ink-3">{t("Total", "মোট")}</span>
                    <span className="tnum font-display text-[24px] font-semibold leading-none text-ink">৳{n(total)}</span>
                  </div>

                  {/* The pairing QR, exactly where the real app shows it. */}
                  {!paired && (
                    <button
                      type="button"
                      onClick={() => byHand(() => pair())}
                      className="absolute inset-2 flex flex-col items-center justify-center gap-3 rounded-2xl bg-canvas p-4 text-center shadow-2 transition-opacity"
                    >
                      <span className="grid size-28 place-items-center rounded-xl border border-line bg-white p-2">
                        {/* eslint-disable-next-line @next/next/no-img-element -- a generated data: URL */}
                        {qr ? <img src={qr} alt="" className="size-full [image-rendering:pixelated]" /> : <span className="size-full rounded-md bg-sunken" />}
                      </span>
                      <span className="text-[13px] font-semibold text-ink">{t("Scan with your phone", "ফোন দিয়ে স্ক্যান করুন")}</span>
                      <span className="flex items-center gap-1.5 text-[12px] text-ink-3">
                        <span className={cn("size-1.5 rounded-full", pairing ? "bg-ok" : "animate-pulse bg-warn")} />
                        {pairing ? t("Connecting…", "যুক্ত হচ্ছে…") : t("Tap to pair the phone", "ফোন যুক্ত করতে চাপুন")}
                      </span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* The phone in the shopkeeper's hand */}
            <div className="mx-auto w-[230px] shrink-0 rounded-[40px] bg-ink p-[9px] shadow-[0_30px_60px_-24px_rgb(18_18_18/0.5)]">
              <div className="flex h-[452px] flex-col overflow-hidden rounded-[32px] bg-canvas">
                <div className="flex items-center justify-between px-4 pb-2 pt-4">
                  <span className="font-display text-[12px] font-semibold">{t("BechaKena", "বেচাকেনা")}</span>
                  <span className={cn("inline-flex h-5 items-center gap-1 rounded-full px-2 text-[10px] font-semibold", paired ? "bg-ok-soft text-ok" : "bg-sunken text-ink-3")}>
                    <span className={cn("size-1 rounded-full", paired ? "bg-ok" : "animate-pulse bg-warn")} />
                    {paired ? t("Counter connected", "কাউন্টার যুক্ত") : t("Not paired", "যুক্ত নয়")}
                  </span>
                </div>
                <div className="relative mx-3 grid aspect-[3/4] place-items-center overflow-hidden rounded-[18px] bg-[#0b0c0d]">
                  {!paired ? (
                    // eslint-disable-next-line @next/next/no-img-element -- a generated data: URL
                    qr && <img src={qr} alt="" className={cn("size-24 rounded-md bg-white p-1.5 opacity-80 transition-transform duration-700", pairing && "scale-110")} />
                  ) : inView ? (
                    <div key={`${inView.id}-${result?.at}`} className="w-[78%] rounded-md bg-white p-2 [animation:bk-rise_300ms_var(--ease-out)]" style={{ rotate: `${inView.tilt}deg` }}>
                      <p className="truncate text-[9px] font-semibold text-black">{t(inView.en, inView.bn)}</p>
                      <Barcode value={inView.code} height={30} className="mt-1 w-full" />
                    </div>
                  ) : (
                    <p className="px-6 text-center text-[11px] text-white/70">{t("Point at a barcode", "বারকোডে ক্যামেরা ধরুন")}</p>
                  )}
                  <div className="pointer-events-none absolute inset-0 grid place-items-center">
                    <div className="relative h-[42%] w-[84%] rounded-md shadow-[0_0_0_100vmax_rgb(0_0_0/0.3)]">
                      {["left-0 top-0 border-l-2 border-t-2 rounded-tl-md", "right-0 top-0 border-r-2 border-t-2 rounded-tr-md", "bottom-0 left-0 border-b-2 border-l-2 rounded-bl-md", "bottom-0 right-0 border-b-2 border-r-2 rounded-br-md"].map((pos) => (
                        <span key={pos} className={cn("absolute size-4 transition-colors duration-150", pos, flash ? (flash.ok ? "border-ok" : "border-danger") : "border-white")} />
                      ))}
                      {motion && <span className="absolute inset-x-2 h-px bg-white/80 [animation:bk-scan_1.8s_ease-in-out_infinite_alternate]" />}
                      {flash && <span key={flash.at} className={cn("absolute inset-0 rounded-md [animation:bk-fade-out_500ms_ease-out_forwards]", flash.ok ? "bg-ok/30" : "bg-danger/30")} />}
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex-1 px-3">
                  {result ? (
                    <div key={result.at} className="flex items-start gap-2 rounded-xl border border-line bg-surface px-2.5 py-2 [animation:bk-rise_300ms_var(--ease-out)]">
                      {result.ok ? <CheckCircle className="mt-px size-4 shrink-0 text-ok" weight="fill" /> : <WarningCircle className="mt-px size-4 shrink-0 text-danger" weight="fill" />}
                      <span className="min-w-0">
                        <span className="block truncate text-[11.5px] font-semibold text-ink">{result.title}</span>
                        <span className="block truncate text-[10.5px] text-ink-3">{result.detail}</span>
                      </span>
                    </div>
                  ) : (
                    <p className="pt-1 text-center text-[11px] leading-relaxed text-ink-3">{t("Each beep means the counter got it.", "প্রতিটি বিপ মানে কাউন্টারে পৌঁছেছে।")}</p>
                  )}
                  <p className="mt-2 text-center text-[11px] text-ink-3">
                    <span className="tnum font-display text-[18px] font-semibold text-ink">{n(count)}</span> {t("added", "টি যোগ হয়েছে")}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* The counter: tap a tag to scan it */}
          <div className="mt-10">
            <p className="text-center text-[13px] font-medium text-ink-3">{t("Tap a tag to scan it — these are real barcodes", "স্ক্যান করতে ট্যাগে চাপুন — এগুলো আসল বারকোড")}</p>
            {/* A row you swipe on phones, a counter-top line from tablets up. */}
            <ul className="no-scrollbar -mx-5 mt-5 flex snap-x gap-4 overflow-x-auto px-5 pb-4 pt-2 sm:mx-auto sm:grid sm:max-w-[880px] sm:grid-cols-4 sm:overflow-visible sm:px-0">
              {TAGS.map((tag) => {
                const active = inView?.id === tag.id && paired;
                return (
                  <li key={tag.id} className="w-[46%] shrink-0 snap-center sm:w-auto">
                    <button
                      type="button"
                      onClick={() => byHand(() => scan(tag))}
                      style={{ rotate: `${tag.tilt}deg` }}
                      className={cn(
                        "relative w-full rounded-[14px] bg-white px-3 pb-3 pt-5 text-left shadow-[0_1px_2px_rgb(18_18_18/0.06),0_10px_24px_-14px_rgb(18_18_18/0.35)] transition-[transform,box-shadow] duration-200 ease-[var(--ease-spring)] hover:-translate-y-1 hover:shadow-[0_1px_2px_rgb(18_18_18/0.06),0_18px_34px_-16px_rgb(18_18_18/0.4)]",
                        active && "ring-2 ring-brand",
                      )}
                      aria-label={t(`Scan ${tag.en}`, `${tag.bn} স্ক্যান করুন`)}
                    >
                      <span className="absolute left-1/2 top-2 size-2 -translate-x-1/2 rounded-full bg-surface-2 ring-1 ring-line" aria-hidden />
                      <span className="block truncate text-[12.5px] font-semibold text-black">{t(tag.en, tag.bn)}</span>
                      <span className="mt-0.5 flex items-center justify-between text-[11.5px]">
                        <span className="tnum font-semibold text-black">৳{n(tag.price)}</span>
                        {tag.stock === 0 && <span className="font-semibold text-danger">{t("Sold out", "শেষ")}</span>}
                      </span>
                      <Barcode value={tag.code} height={34} className="mt-2 w-full" />
                    </button>
                  </li>
                );
              })}
            </ul>
            {(paired || cart.length > 0) && (
              <p className="mt-6 text-center">
                <button
                  type="button"
                  onClick={() =>
                    byHand(() => {
                      setPaired(false);
                      setCart([]);
                      live.current = { paired: false, cart: [] };
                      setInView(null);
                      setResult(null);
                    })
                  }
                  className="text-[13px] font-medium text-ink-3 underline-offset-4 hover:text-ink hover:underline"
                >
                  {t("Start over", "আবার শুরু")}
                </button>
              </p>
            )}
          </div>
        </div>

        <ul className="mt-16 grid grid-cols-2 gap-x-5 gap-y-9 md:mt-20 lg:grid-cols-4 lg:gap-x-8">
          {[
            { icon: <BarcodeIcon />, title: t("Barcode labels, printed", "বারকোড লেবেল প্রিন্ট"), body: t("A4 sheets of 24 or label-printer rolls. Products without a barcode get one in a tap.", "এক A4-এ ২৪টি বা লেবেল প্রিন্টারের রোল। বারকোড না থাকলে এক চাপে তৈরি।") },
            { icon: <DeviceMobile />, title: t("Scan on the phone", "ফোনেই স্ক্যান"), body: t("Selling from your phone? Its camera scans straight into the cart.", "ফোনে বিক্রি করছেন? ক্যামেরা দিয়েই সোজা কার্টে।") },
            { icon: <Monitor />, title: t("Wireless to the computer", "কম্পিউটারে তারবিহীন"), body: t("Scan the QR once. The phone works like a scanner on every screen.", "একবার QR স্ক্যান করুন। প্রতিটি স্ক্রিনে ফোন স্ক্যানারের মতো চলে।") },
            { icon: <Usb />, title: t("Have a scanner? Plug it in", "স্ক্যানার আছে? লাগিয়ে দিন"), body: t("USB barcode scanners work too — nothing to set up.", "USB বারকোড স্ক্যানারও চলে — কোনো সেটআপ নেই।") },
          ].map((f) => (
            <li key={f.title}>
              <span className="grid size-11 place-items-center rounded-2xl bg-canvas text-ink shadow-1 [&>svg]:size-5">{f.icon}</span>
              <h3 className="mt-4 font-display text-[16px] font-semibold tracking-[-0.01em] text-ink sm:text-[18px]">{f.title}</h3>
              <p className="mt-1.5 text-[14px] leading-relaxed text-ink-3 sm:text-[15px]">{f.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
