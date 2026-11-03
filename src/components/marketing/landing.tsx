"use client";

import { Check, List, Package, X } from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { cn } from "../ui/core";
import { Bento } from "./bento";
import { DashboardShowcase } from "./dashboard-showcase";
import { PLANS } from "./data";
import { FaqChat } from "./faq-chat";
import { Footer } from "./footer";
import { Hero } from "./hero";
import { JourneyScroll } from "./journey-scroll";
import { PhoneScan } from "./phone-scan";
import { RouteMap } from "./route-map";
import { H2, JamdaniWeave, LogoMark, makeN, SiteCtx, SWATCHES, useSite, useSmoothScroll, type L, type Site } from "./site-kit";
import "lenis/dist/lenis.css";
import { normalizePhone } from "@/lib/domain";
import { themeVars } from "@/lib/theme";

// White pages alternating with one soft warm grey, near-black ink and a lime accent.
const BASE_VARS = {
  "--r": "14px",
  "--canvas": "#FFFFFF",
  "--surface": "#FFFFFF",
  "--surface-2": "#F5F5F2",
  "--sunken": "#ECECE7",
  "--line": "#E7E7E1",
  "--line-strong": "#D7D7CF",
  "--ink": "#121212",
  "--ink-2": "#45453F",
  "--ink-3": "#6E6E67",
  "--ink-4": "#A3A39B",
  "--font-display-active": "var(--font-anek)",
};

export function Landing() {
  const [lang, setLang] = useState<L>("bn");
  const [shop, setShop] = useState("");
  const [accent, setAccent] = useState(SWATCHES[0].hex);
  const [signedIn, setSignedIn] = useState(false);
  useSmoothScroll();

  useEffect(() => {
    try {
      const saved = localStorage.getItem("bk-site-lang");
      // eslint-disable-next-line react-hooks/set-state-in-effect -- per-visitor preference, read after hydration
      if (saved === "en" || saved === "bn") setLang(saved);
    } catch {
      /* storage may be blocked */
    }
    // Only ask the server when this device has been signed in before.
    let wasSignedIn = false;
    try {
      wasSignedIn = JSON.parse(localStorage.getItem("bechakena-pos") ?? "null")?.state?.sync?.mode === "account";
    } catch {
      /* ignore */
    }
    if (wasSignedIn)
      fetch("/api/auth/me")
        .then((r) => setSignedIn(r.ok))
        .catch(() => {});
  }, []);

  const site = useMemo<Site>(
    () => ({
      lang,
      setLang: (l) => {
        setLang(l);
        try {
          localStorage.setItem("bk-site-lang", l);
        } catch {
          /* ignore */
        }
      },
      t: (en, bn) => (lang === "bn" ? bn : en),
      n: makeN(lang),
      shop,
      setShop,
      accent,
      setAccent,
    }),
    [lang, shop, accent],
  );
  const style = useMemo(() => ({ ...BASE_VARS, ...themeVars(accent) }) as React.CSSProperties, [accent]);

  return (
    <SiteCtx.Provider value={site}>
      <div lang={lang} style={style} className="min-h-dvh overflow-x-clip bg-canvas text-ink">
        <Nav signedIn={signedIn} />
        <main>
          <Hero signedIn={signedIn} />
          <RouteMap />
          <JourneyScroll />
          <DashboardShowcase />
          <PhoneScan />
          <Bento />
          <Pricing />
          <FaqChat />
          <FinalCta />
        </main>
        <Footer />
      </div>
    </SiteCtx.Provider>
  );
}

const useT = useSite;

/* ------------------------------------------------------------ nav */

function Nav({ signedIn }: { signedIn: boolean }) {
  const { t, lang, setLang } = useT();
  const [open, setOpen] = useState(false);
  // Clear over the hero glow at the top; frosted once the page moves under it.
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const sync = () => setScrolled(window.scrollY > 8);
    sync();
    window.addEventListener("scroll", sync, { passive: true });
    return () => window.removeEventListener("scroll", sync);
  }, []);
  const links = [
    ["#how", t("How it works", "কীভাবে কাজ করে")],
    ["#dashboard", t("Dashboard", "ড্যাশবোর্ড")],
    ["#scan", t("Phone scanner", "ফোন স্ক্যানার")],
    ["#features", t("Features", "সুবিধা")],
    ["#pricing", t("Pricing", "দাম")],
    ["#faq", t("Questions", "প্রশ্ন")],
  ];
  return (
    <header className={cn("sticky top-0 z-40 border-b transition-[background-color,border-color] duration-300", scrolled || open ? "border-line/70 bg-canvas/80 backdrop-blur-xl" : "border-transparent")}>
      <nav className="mx-auto flex h-14 max-w-[1120px] items-center gap-2 px-5 md:px-8" aria-label={t("Main", "প্রধান")}>
        <Link href="/" className="mr-auto flex shrink-0 items-center gap-2 md:mr-0 xl:w-[290px]">
          <LogoMark size={28} />
          <span className="font-display text-[17px] font-semibold tracking-[-0.01em]">{t("BechaKena", "বেচাকেনা")}</span>
        </Link>
        <div className="hidden flex-1 items-center justify-center gap-1 md:flex">
          {links.map(([href, label]) => (
            // Six links don't fit beside the buttons: the FAQ lives in the menu and footer, Dashboard returns from lg.
            <a key={href} href={href} className={cn("whitespace-nowrap rounded-full px-2.5 py-1.5 text-[13px] text-ink-2 transition-colors hover:text-ink lg:px-3 lg:text-[13.5px]", href === "#faq" && "hidden", href === "#dashboard" && "hidden lg:inline")}>
              {label}
            </a>
          ))}
        </div>
        <div className="flex shrink-0 items-center justify-end gap-1 whitespace-nowrap xl:w-[290px]">
          <button type="button" onClick={() => setLang(lang === "bn" ? "en" : "bn")} className="hidden h-9 rounded-full px-3 text-[13.5px] text-ink-2 hover:text-ink sm:block">
            {lang === "bn" ? "English" : "বাংলা"}
          </button>
          {!signedIn && (
            <Link href="/login" className="hidden h-9 items-center rounded-full px-3 text-[13.5px] text-ink-2 hover:text-ink xl:inline-flex">
              {t("Sign in", "সাইন ইন")}
            </Link>
          )}
          <Link href={signedIn ? "/dashboard" : "/login"} className="inline-flex h-8 items-center rounded-full bg-ink px-3.5 text-[13px] font-semibold text-white transition-opacity hover:opacity-85">
            {signedIn ? t("Open my shop", "আমার দোকান") : t("Open your shop", "দোকান খুলুন")}
          </Link>
        </div>
        <button type="button" onClick={() => setOpen((o) => !o)} className="grid size-9 place-items-center rounded-full hover:bg-sunken md:hidden" aria-expanded={open} aria-label={t("Menu", "মেনু")}>
          {open ? <X className="size-5" /> : <List className="size-5" />}
        </button>
      </nav>
      {open && (
        <div className="border-t border-line bg-canvas px-3 pb-3 pt-2 md:hidden">
          {links.map(([href, label]) => (
            <a key={href} href={href} onClick={() => setOpen(false)} className="block rounded-2xl px-4 py-3 text-[15px] font-medium text-ink hover:bg-sunken">
              {label}
            </a>
          ))}
          <div className="mt-2 flex gap-2 border-t border-line pt-3">
            <button type="button" onClick={() => setLang(lang === "bn" ? "en" : "bn")} className="h-11 flex-1 rounded-full bg-sunken text-[14px] font-medium">
              {lang === "bn" ? "English" : "বাংলা"}
            </button>
            <Link href="/login" className="grid h-11 flex-1 place-items-center rounded-full border border-line text-[14px] font-medium">
              {t("Sign in", "সাইন ইন")}
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}

/* ------------------------------------------------------------ pricing */

function Pricing() {
  const { t, n } = useT();
  const [annual, setAnnual] = useState(true);
  return (
    <section id="pricing" className="bg-surface-2 py-28 md:py-40">
      <div className="mx-auto max-w-[1120px] px-5 md:px-8">
        <div className="flex flex-col items-center gap-8 text-center">
          <div className="max-w-[820px]">
            <H2 className="text-balance">{t("Costs less than six returned parcels a month.", "মাসে ছয়টা ফেরত পার্সেলের খরচের চেয়েও কম।")}</H2>
            <p className="mx-auto mt-5 max-w-[600px] text-balance text-[18px] leading-relaxed text-ink-3 md:text-[20px]">
              {t(
                "Every plan opens with a 7-day Business trial, with 5 invoices to print while you set up. No setup fee.",
                "প্রতিটা প্ল্যান শুরু হয় ৭ দিনের বিজনেস ট্রায়াল দিয়ে — সাজানোর সময় ৫টা ইনভয়েস প্রিন্ট করা যায়। সেটআপ ফি নেই।",
              )}
            </p>
          </div>
          <div className="inline-flex rounded-full bg-sunken p-1 text-[14px] font-semibold" role="radiogroup" aria-label={t("Billing period", "বিলিং")}>
            {[
              [false, t("Monthly", "মাসিক")],
              [true, t("Yearly, 2 months off", "বার্ষিক, ২ মাস ছাড়")],
            ].map(([v, label]) => (
              <button
                key={String(v)}
                type="button"
                role="radio"
                aria-checked={annual === v}
                onClick={() => setAnnual(v as boolean)}
                className={cn("rounded-full px-4 py-2 transition-colors", annual === v ? "bg-surface text-ink shadow-1" : "text-ink-3")}
              >
                {label as string}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-14 grid gap-5 md:grid-cols-3">
          {PLANS.map((p) => {
            const featured = "featured" in p && p.featured;
            const perMonth = annual ? Math.round((p.price * 10) / 12) : p.price;
            return (
              <div key={p.name[0]} className={cn("relative flex flex-col rounded-[28px] bg-surface p-8", featured && "ring-2 ring-brand-600")}>
                <div className="relative flex items-center justify-between">
                  <p className="font-display text-[20px] font-semibold">{t(p.name[0], p.name[1])}</p>
                </div>
                <p className={cn("relative mt-1 text-[14px]", "text-ink-3")}>{t(p.who[0], p.who[1])}</p>
                <p className="relative mt-6 flex items-baseline gap-1.5">
                  <span className="tnum font-display text-[48px] font-semibold leading-none tracking-[-0.02em]" style={{ fontVariationSettings: '"wdth" 88' }}>
                    ৳{n(perMonth)}
                  </span>
                  <span className={cn("text-[14px]", "text-ink-3")}>/{t("month", "মাস")}</span>
                </p>
                <p className={cn("relative mt-1 h-5 text-[13px]", "text-ink-3")}>
                  {annual ? t(`৳${n(p.price * 10)} billed yearly`, `বছরে ৳${n(p.price * 10)}`) : t(`about ৳${n(Math.round(p.price / 30))} a day`, `দিনে প্রায় ৳${n(Math.round(p.price / 30))}`)}
                </p>
                <ReturnsCost perMonth={perMonth} />
                <ul className="relative mt-6 flex-1 space-y-2.5 text-[14.5px]">
                  {[[`${p.orders.toLocaleString("en-IN")} orders a month`, `মাসে ${n(p.orders)} অর্ডার`], p.products, p.users, ...p.extra].map(([en, bn]) => (
                    <li key={en} className="flex gap-2.5">
                      <Check className={cn("mt-0.5 size-4 shrink-0", "text-ok")} weight="bold" />
                      {t(en, bn)}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/login"
                  className={cn(
                    "relative mt-8 grid h-12 place-items-center rounded-full text-[15px] font-semibold transition-transform hover:-translate-y-px",
                    featured ? "bg-brand text-brand-contrast" : "bg-ink text-white",
                  )}
                >
                  {t(`Start with ${p.name[0]}`, `${p.name[1]} দিয়ে শুরু`)}
                </Link>
              </div>
            );
          })}
        </div>
        <p className="mt-6 text-[14px] text-ink-3">
          {t(
            `Pay with bKash. Change or cancel any time; your data is never locked. Parcels assume about ৳${n(RETURN_COST)} lost on each return, delivery out and back.`,
            `বিকাশে পেমেন্ট। যেকোনো সময় বদলান বা বন্ধ করুন; আপনার তথ্য কখনো আটকায় না। প্রতিটা ফেরত পার্সেলে যাওয়া-আসায় আনুমানিক ৳${n(RETURN_COST)} খরচ ধরা হয়েছে।`,
          )}
        </p>
      </div>
    </section>
  );
}

/** Taka lost on one returned parcel (delivery out and back), the unit the pricing headline is measured in. */
const RETURN_COST = 135;

/** The plan's price drawn as the returned parcels it costs the same as. */
function ReturnsCost({ perMonth }: { perMonth: number }) {
  const { t, n } = useT();
  const count = Math.max(1, Math.round(perMonth / RETURN_COST));
  return (
    <div className="relative mt-5 rounded-[16px] bg-surface-2 px-3.5 py-3">
      <div className="flex flex-wrap gap-1" aria-hidden>
        {Array.from({ length: count }, (_, i) => (
          <Package key={i} className="size-[18px] text-ink-3" weight="duotone" />
        ))}
      </div>
      <p className="mt-1.5 text-[12.5px] text-ink-3">{t(`Same as ${count} returned parcel${count === 1 ? "" : "s"} a month`, `মাসে ${n(count)}টা ফেরত পার্সেলের খরচের সমান`)}</p>
    </div>
  );
}

/* ------------------------------------------------------------ final cta */

function FinalCta() {
  const { t } = useT();
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const ok = !!normalizePhone(phone);
  return (
    <section className="px-5 pb-6 md:px-6">
      <div className="relative mx-auto max-w-[1240px] overflow-hidden rounded-[36px] bg-brand px-6 py-16 text-brand-contrast md:px-14 md:py-24">
        <JamdaniWeave className="pointer-events-none absolute inset-0 size-full" color="var(--brand-contrast)" opacity={0.09} />
        <div className="relative grid grid-cols-[minmax(0,1fr)] items-end gap-10 lg:grid-cols-[minmax(0,1fr)_420px]">
          <h2 className="font-display text-[40px] font-semibold leading-[1] tracking-[-0.03em] sm:text-[56px] lg:text-[72px]">{t("Your first invoice is five minutes away.", "প্রথম ইনভয়েস মাত্র পাঁচ মিনিট দূরে।")}</h2>
          <form
            className="min-w-0"
            onSubmit={(e) => {
              e.preventDefault();
              router.push(`/login${ok ? `?phone=${normalizePhone(phone)}` : ""}`);
            }}
          >
            <label htmlFor="cta-phone" className="text-[14px] text-brand-contrast/80">
              {t("Start with your mobile number", "মোবাইল নম্বর দিয়ে শুরু করুন")}
            </label>
            <div className="mt-2 flex rounded-full bg-white p-1.5 shadow-3">
              <span className="grid place-items-center pl-4 pr-1 text-[15px] font-medium text-ink-3">+88</span>
              <input id="cta-phone" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="017XXXXXXXX" className="tnum w-0 min-w-0 flex-1 bg-transparent px-2 text-[16px] text-ink placeholder:text-ink-4 focus:outline-none" />
              <button type="submit" className="inline-flex h-12 shrink-0 items-center rounded-full bg-ink px-6 text-[15px] font-semibold text-white">
                {t("Start", "শুরু")}
              </button>
            </div>
            <p className="mt-3 text-[13px] text-brand-contrast/70">{t("No setup fee. Bangla support on WhatsApp.", "সেটআপ ফি নেই। হোয়াটসঅ্যাপে বাংলায় সাপোর্ট।")}</p>
          </form>
        </div>
      </div>
    </section>
  );
}
