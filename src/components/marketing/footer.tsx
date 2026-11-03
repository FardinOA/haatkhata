"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { cn } from "../ui/core";
import { LogoMark, useSite } from "./site-kit";
import { BANGLA_MONTHS, BANGLA_MONTHS_EN, toBanglaDate } from "@/lib/bangla-calendar";

/** The shop day the timeline spans, in minutes after midnight (6 am to midnight). */
const START = 6 * 60;
const END = 24 * 60;
const PICKUP = 16 * 60;

const MOMENTS: { at: number; en: string; bn: string }[] = [
  { at: 10 * 60, en: "Chat orders", bn: "চ্যাটে অর্ডার" },
  { at: 13 * 60, en: "Packing", bn: "প্যাকিং" },
  { at: PICKUP, en: "Courier pickup", bn: "কুরিয়ার পিকআপ" },
  { at: 20 * 60 + 30, en: "Live sale", bn: "লাইভ সেল" },
  { at: 23 * 60, en: "Close the books", bn: "দিনের হিসাব" },
];

const pos = (m: number) => Math.min(1, Math.max(0, (m - START) / (END - START)));

/** Wall-clock time in Dhaka, whatever the visitor's own time zone. */
function dhakaNow() {
  const d = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Dhaka" }));
  return { date: d, minutes: d.getHours() * 60 + d.getMinutes() };
}

/**
 * The footer is a seller's day: a timeline from morning chats to closing the
 * books with a marker at the real time in Dhaka, a line that fits the hour,
 * and what to do next.
 */
export function Footer() {
  const { t, n, lang, setLang } = useSite();
  const [now, setNow] = useState<ReturnType<typeof dhakaNow> | null>(null);

  // Time only exists on the client; until then the day is drawn without a marker.
  useEffect(() => {
    const tick = () => setNow(dhakaNow());
    const first = requestAnimationFrame(tick);
    const id = setInterval(tick, 15_000);
    return () => {
      cancelAnimationFrame(first);
      clearInterval(id);
    };
  }, []);

  const m = now?.minutes ?? 0;
  const p = now ? pos(m) : 0;

  const clock = now
    ? (() => {
        const h = now.date.getHours();
        const mm = String(now.date.getMinutes()).padStart(2, "0");
        const h12 = ((h + 11) % 12) + 1;
        const part = h < 5 ? ["night", "রাত"] : h < 12 ? ["morning", "সকাল"] : h < 16 ? ["afternoon", "দুপুর"] : h < 18 ? ["afternoon", "বিকেল"] : h < 20 ? ["evening", "সন্ধ্যা"] : ["night", "রাত"];
        return lang === "bn" ? `${part[1]} ${n(`${h12}:${mm}`)}` : `${h12}:${mm} ${h < 12 ? "am" : "pm"}`;
      })()
    : "";

  const date = now
    ? (() => {
        const b = toBanglaDate(now.date);
        return lang === "bn"
          ? `${n(b.day)} ${BANGLA_MONTHS[b.month]} ${n(b.year)}, ${n(now.date.getDate())} ${now.date.toLocaleString("bn-BD", { month: "long" })}`
          : `${b.day} ${BANGLA_MONTHS_EN[b.month]} ${b.year}, ${now.date.toLocaleString("en-GB", { day: "numeric", month: "long" })}`;
      })()
    : "";

  const nextMoment = now ? MOMENTS.find((mo) => mo.at > m) : undefined;
  const hourLabel = (at: number) => {
    const h = Math.floor(at / 60);
    const mm = at % 60;
    const h12 = ((h + 11) % 12) + 1;
    return lang === "bn" ? `${n(h12)}${mm ? `:${n(String(mm).padStart(2, "0"))}` : "টা"}` : `${h12}${mm ? `:${String(mm).padStart(2, "0")}` : ""} ${h < 12 ? "am" : "pm"}`;
  };
  const left = PICKUP - m;
  const line = !now
    ? ""
    : m < START
      ? t("The shop's asleep. Orders that came in overnight are waiting in BechaKena.", "দোকান এখন ঘুমিয়ে। রাতে আসা অর্ডারগুলো বেচাকেনায় অপেক্ষা করছে।")
      : left > 0
        ? t(`Courier pickup in ${Math.floor(left / 60)}h ${left % 60}m. Every label prints in one tap.`, `কুরিয়ার পিকআপের বাকি ${n(Math.floor(left / 60))} ঘণ্টা ${n(left % 60)} মিনিট। সব লেবেল এক চাপে প্রিন্ট।`)
        : m < 20 * 60 + 30
          ? t("Pickup's gone. Follow every parcel from one screen.", "পিকআপ হয়ে গেছে। প্রতিটা পার্সেল এক স্ক্রিনে দেখুন।")
          : m < 23 * 60
            ? t("Live sale time. Comment orders go straight into the list.", "লাইভ সেলের সময়। কমেন্টের অর্ডার সরাসরি তালিকায়।")
            : t("Closing time. Today's cash, COD and profit are already added up.", "দোকান বন্ধের সময়। আজকের ক্যাশ, COD আর লাভ আগেই হিসাব হয়ে আছে।");

  return (
    <footer className="overflow-hidden border-t border-line pt-20 md:pt-24">
      <div className="mx-auto max-w-[1120px] px-5 md:px-8">
        {/* The shop's day */}
        <div>
          <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-5">
            <div>
              <p className="text-[13px] text-ink-3">{t("Your shop's day, in Dhaka", "ঢাকায় আপনার দোকানের দিন")}</p>
              <p className="tnum mt-1 min-h-[1.1em] font-display text-[40px] font-semibold leading-none tracking-[-0.03em] text-ink md:text-[52px]">{clock}</p>
              <p className="mt-2 min-h-[1.5em] text-[14px] text-ink-2">{date}</p>
            </div>
            <div className="max-w-[440px]">
              <p className="min-h-[3em] text-[16px] leading-relaxed text-ink md:text-[17px]" aria-live="polite">
                {line}
              </p>
              <Link href="/login" className="group mt-3 inline-flex items-center gap-1.5 text-[14.5px] font-semibold text-ink underline decoration-brand decoration-2 underline-offset-[6px]">
                {t("Put today's orders in BechaKena", "আজকের অর্ডারগুলো বেচাকেনায় তুলুন")}
              </Link>
            </div>
          </div>

          {/* Timeline */}
          <div className="relative mt-10 h-[92px] md:mt-12" role="img" aria-label={t("Timeline of a seller's day from 6 am to midnight", "সকাল ৬টা থেকে মাঝরাত পর্যন্ত বিক্রেতার দিন")}>
            {/* track */}
            <div className="absolute inset-x-0 top-[40px] h-[6px] rounded-full bg-sunken" />
            <div className="absolute left-0 top-[40px] h-[6px] rounded-full bg-brand transition-[width,background-color] duration-700" style={{ width: `${p * 100}%` }} />

            {/* moments */}
            {MOMENTS.map((mo, i) => {
              const x = pos(mo.at) * 100;
              const done = now && m >= mo.at;
              const up = i % 2 === 0;
              return (
                <div key={mo.at} className="absolute top-0 h-full -translate-x-1/2" style={{ left: `${x}%` }}>
                  <span className={cn("absolute left-1/2 top-[37px] size-3 -translate-x-1/2 rounded-full border-2 border-surface transition-colors duration-500", done ? "bg-brand-ink" : "bg-line-strong")} />
                  <span className={cn("absolute left-1/2 hidden -translate-x-1/2 whitespace-nowrap text-[12px] font-medium sm:block md:text-[13px]", up ? "top-[6px]" : "top-[60px]", done ? "text-ink" : "text-ink-3", i === 0 && "max-sm:left-0 max-sm:translate-x-[-10%]", i === MOMENTS.length - 1 && "max-sm:-translate-x-[85%]")}>
                    {t(mo.en, mo.bn)}
                  </span>
                </div>
              );
            })}

            {/* now */}
            {now && m >= START && (
              <div className="absolute top-[43px] -translate-x-1/2 -translate-y-1/2 transition-[left] duration-700" style={{ left: `${p * 100}%` }}>
                <span className="absolute inset-0 rounded-full bg-brand opacity-50 motion-safe:animate-ping" />
                <span className="relative block size-[22px] rounded-full border-[5px] border-surface bg-brand shadow-[0_0_0_1.5px_var(--brand-600)] transition-colors duration-500" />
              </div>
            )}
          </div>
          <div className="mt-1 flex justify-between text-[11.5px] text-ink-4" aria-hidden>
            {[6, 9, 12, 15, 18, 21, 24].map((h) => (
              <span key={h} className="tnum">
                {lang === "bn" ? `${n(((h + 11) % 12) + 1)}টা` : `${((h + 11) % 12) + 1}${h < 12 || h === 24 ? "am" : "pm"}`}
              </span>
            ))}
          </div>
          {/* Phones are too narrow for five labels on one line; say what's next instead. */}
          {nextMoment && (
            <p className="mt-4 text-[14px] text-ink-2 sm:hidden">
              {t("Next", "এরপর")}: <span className="font-semibold text-ink">{t(nextMoment.en, nextMoment.bn)}</span>, {hourLabel(nextMoment.at)}
            </p>
          )}
        </div>

        {/* Links */}
        <div className="mt-20 flex flex-wrap items-start justify-between gap-x-12 gap-y-8 border-t border-line pt-10 md:mt-24">
          <div>
            <Link href="/" className="inline-flex items-center gap-2.5">
              <LogoMark size={28} />
              <span className="font-display text-[19px] font-semibold tracking-[-0.01em] text-ink">{t("BechaKena", "বেচাকেনা")}</span>
            </Link>
            <p className="mt-3 max-w-[300px] text-[14px] leading-relaxed text-ink-3">{t("Made in Dhaka for the sellers who keep Bangladesh shopping.", "ঢাকায় তৈরি, বাংলাদেশের বিক্রেতাদের জন্য।")}</p>
            <div className="mt-5 inline-flex rounded-full bg-sunken p-1" role="radiogroup" aria-label={t("Language", "ভাষা")}>
              {(
                [
                  ["bn", "বাংলা"],
                  ["en", "English"],
                ] as const
              ).map(([l, label]) => (
                <button key={l} type="button" role="radio" aria-checked={lang === l} onClick={() => setLang(l)} className={cn("rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors", lang === l ? "bg-surface text-ink shadow-[0_1px_3px_rgb(18_18_18/0.1)]" : "text-ink-3 hover:text-ink")}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <nav aria-label={t("Footer", "ফুটার")} className="flex max-w-[620px] flex-wrap gap-x-6 gap-y-3 pt-1 text-[14px] text-ink-2">
            {(
              [
                ["#how", t("How it works", "কীভাবে কাজ করে")],
                ["#dashboard", t("Dashboard", "ড্যাশবোর্ড")],
                ["#features", t("Features", "সুবিধা")],
                ["#pricing", t("Pricing", "দাম")],
                ["#faq", t("Questions", "প্রশ্ন")],
                ["/dashboard", t("Demo shop", "ডেমো দোকান")],
                ["/developers", t("API for developers", "ডেভেলপারদের API")],
                ["/login", t("Sign in", "সাইন ইন")],
              ] as const
            ).map(([href, label]) =>
              href.startsWith("#") ? (
                <a key={href} href={href} className="transition-colors hover:text-ink">
                  {label}
                </a>
              ) : (
                <Link key={href} href={href} className="transition-colors hover:text-ink">
                  {label}
                </Link>
              ),
            )}
          </nav>
        </div>
      </div>

      <div className="mx-auto flex max-w-[1120px] flex-wrap justify-between gap-2 px-5 pb-10 pt-12 text-[12.5px] text-ink-3 md:px-8">
        <span>© 2026 BechaKena</span>
      </div>
    </footer>
  );
}
