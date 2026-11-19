"use client";

import { ChatCircleText, Clock, EnvelopeSimple, MapPin, Phone, Storefront } from "@phosphor-icons/react";
import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { cn } from "../ui/core";
import { BASE_VARS, LogoMark, makeN, SWATCHES, type L } from "../marketing/site-kit";
import { LEGAL_DOCS, type Block, type LegalSlug, type Pair } from "./content";
import { BANGLA_MONTHS, toBanglaDate } from "@/lib/bangla-calendar";
import { COMPANY, LEGAL_UPDATED, operatorName } from "@/lib/company";
import { themeVars } from "@/lib/theme";

type Slug = LegalSlug | "contact";

const PAGES: [Slug, Pair][] = [
  ["terms", ["Terms", "শর্তাবলী"]],
  ["privacy", ["Privacy", "গোপনীয়তা"]],
  ["refund", ["Refunds", "রিফান্ড"]],
  ["contact", ["Contact", "যোগাযোগ"]],
];

/** Same per-visitor language as the landing page, read after hydration. */
function useSiteLang() {
  const [lang, setLang] = useState<L>("bn");
  useEffect(() => {
    try {
      const saved = localStorage.getItem("bk-site-lang");
      // eslint-disable-next-line react-hooks/set-state-in-effect -- per-visitor preference, read after hydration
      if (saved === "en" || saved === "bn") setLang(saved);
    } catch {
      /* storage may be blocked */
    }
  }, []);
  const choose = (l: L) => {
    setLang(l);
    try {
      localStorage.setItem("bk-site-lang", l);
    } catch {
      /* ignore */
    }
  };
  return [lang, choose] as const;
}

/**
 * Terms, Privacy, Refund and Contact share this frame. Every legal section
 * carries a one-line summary in the margin, and "Short version" collapses
 * the page to just those lines: the whole policy in a minute.
 */
export function LegalPage({ slug }: { slug: Slug }) {
  const [lang, setLang] = useSiteLang();
  const [short, setShort] = useState(false);
  const t = (p: Pair) => (lang === "bn" ? p[1] : p[0]);
  const n = makeN(lang);
  const style = useMemo(() => ({ ...BASE_VARS, ...themeVars(SWATCHES[0].hex) }) as React.CSSProperties, []);

  const updated = useMemo(() => {
    const d = new Date(`${LEGAL_UPDATED}T12:00:00+06:00`);
    if (lang === "en") return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
    const b = toBanglaDate(d);
    return `${n(String(d.getDate()))} ${d.toLocaleString("bn-BD", { month: "long" })} ${n(String(d.getFullYear()))} · ${n(String(b.day))} ${BANGLA_MONTHS[b.month]} ${n(String(b.year))}`;
  }, [lang, n]);

  const doc = slug === "contact" ? null : LEGAL_DOCS[slug];
  const title: Pair = doc ? doc.title : ["Contact us", "যোগাযোগ"];

  return (
    <div lang={lang} style={style} className="min-h-dvh bg-canvas text-ink">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-[1120px] flex-wrap items-center gap-x-3 gap-y-3 px-4 py-4 sm:px-5 md:px-8">
          <Link href="/" className="inline-flex items-center gap-2.5">
            <LogoMark size={28} />
            <span className="font-display text-[17px] font-semibold tracking-[-0.01em] text-ink">{t(["HaatKhata", "হাটখাতা"])}</span>
          </Link>
          <button type="button" onClick={() => setLang(lang === "bn" ? "en" : "bn")} className="ml-auto h-9 rounded-full bg-sunken px-3.5 text-[13.5px] font-medium text-ink-2 hover:text-ink sm:order-3 sm:ml-0">
            {lang === "bn" ? "English" : "বাংলা"}
          </button>
          <nav aria-label={t(["Policies", "নীতিমালা"])} className="-mx-1 flex w-full gap-1 overflow-x-auto pb-1 sm:order-2 sm:ml-auto sm:w-auto sm:pb-0">
            {PAGES.map(([s, label]) => (
              <Link key={s} href={`/${s}`} aria-current={s === slug ? "page" : undefined} className={cn("shrink-0 rounded-full px-3.5 py-2 text-[13.5px] font-medium transition-colors", s === slug ? "bg-ink text-white" : "text-ink-2 hover:bg-sunken hover:text-ink")}>
                {t(label)}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-[1120px] px-4 pb-24 sm:px-5 md:px-8">
        <div className="max-w-[760px] pb-10 pt-12 md:pt-16">
          <p className="text-[13px] text-ink-3">
            {t(["Updated", "হালনাগাদ"])} {updated}
          </p>
          <h1 className="mt-3 font-display text-[40px] font-semibold leading-[1.04] tracking-[-0.03em] text-ink md:text-[56px]">{t(title)}</h1>
          {doc && <p className="mt-5 text-[16.5px] leading-relaxed text-ink-2 md:text-[18px]">{t(doc.intro)}</p>}
          {doc && (
            <div className="mt-7 inline-flex rounded-full bg-sunken p-1" role="radiogroup" aria-label={t(["How much to show", "কতটা দেখাবে"])}>
              {(
                [
                  [true, ["Short version", "সংক্ষেপে"]],
                  [false, ["Full text", "পুরোটা"]],
                ] as const
              ).map(([v, label]) => (
                <button key={String(v)} type="button" role="radio" aria-checked={short === v} onClick={() => setShort(v)} className={cn("rounded-full px-4 py-2 text-[13.5px] font-medium transition-colors", short === v ? "bg-surface text-ink shadow-[0_1px_3px_rgb(18_18_18/0.1)]" : "text-ink-3 hover:text-ink")}>
                  {t(label)}
                </button>
              ))}
            </div>
          )}
        </div>

        {doc ? (
          <ol className="border-t border-line">
            {doc.sections.map((s, i) => (
              <li key={s.id} id={s.id} className={cn("grid scroll-mt-6 gap-x-12 border-b border-line md:grid-cols-[260px_minmax(0,1fr)]", short ? "py-5" : "py-9")}>
                <div>
                  <h2 className="flex items-baseline gap-3 font-display text-[19px] font-semibold leading-snug tracking-[-0.01em] text-ink md:text-[21px]">
                    <span className="tnum text-[13px] font-medium text-ink-4">{n(String(i + 1).padStart(2, "0"))}</span>
                    {t(s.title)}
                  </h2>
                  {!short && (
                    <p className="mt-2 text-[14.5px] leading-relaxed text-ink-3 md:pr-2">
                      <span className="box-decoration-clone bg-[color-mix(in_oklab,var(--brand)_45%,transparent)] px-1 py-0.5">{t(s.short)}</span>
                    </p>
                  )}
                </div>
                {short ? (
                  <p className="mt-2 text-[16.5px] leading-relaxed text-ink md:mt-0 md:text-[18px]">
                    <span className="box-decoration-clone bg-[color-mix(in_oklab,var(--brand)_45%,transparent)] px-1 py-0.5">{t(s.short)}</span>
                  </p>
                ) : (
                  <div className="mt-4 max-w-[68ch] space-y-4 text-[15.5px] leading-relaxed text-ink-2 md:mt-0">
                    {s.body.map((b, j) => (
                      <BlockView key={j} block={b} t={t} />
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ol>
        ) : (
          <ContactCards t={t} n={n} />
        )}

        {doc && (
          <p className="mt-12 max-w-[68ch] text-[14px] leading-relaxed text-ink-3">
            {t([`Questions about this page? Email ${COMPANY.email}.`, `এই পাতা নিয়ে প্রশ্ন? ${COMPANY.email}-এ ইমেইল করুন।`])}
          </p>
        )}
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[1120px] flex-wrap justify-between gap-3 px-4 py-8 text-[12.5px] text-ink-3 sm:px-5 md:px-8">
          <span>
            © {n("2026")} {operatorName()}
          </span>
          <Link href="/" className="hover:text-ink">
            {t(["Back to HaatKhata", "হাটখাতায় ফিরুন"])}
          </Link>
        </div>
      </footer>
    </div>
  );
}

function BlockView({ block, t }: { block: Block; t: (p: Pair) => string }) {
  if (!("list" in block)) return <p>{t(block)}</p>;
  return (
    <ul className="space-y-2.5">
      {block.list.map((item, i) => (
        <li key={i} className="relative pl-5 before:absolute before:left-0 before:top-[0.7em] before:size-1.5 before:rounded-full before:bg-ink-4">
          {t(item)}
        </li>
      ))}
    </ul>
  );
}

function ContactCards({ t, n }: { t: (p: Pair) => string; n: (v: string | number) => string }) {
  const c = COMPANY;
  const cards: { icon: ReactNode; label: Pair; value: string; href?: string; note?: Pair }[] = [
    { icon: <EnvelopeSimple size={20} />, label: ["Email", "ইমেইল"], value: c.email, href: `mailto:${c.email}`, note: ["For refunds, include the transaction ID from your receipt.", "রিফান্ডের জন্য রসিদের ট্রানজেকশন আইডি দিন।"] },
  ];
  if (c.phone) cards.push({ icon: <Phone size={20} />, label: ["Phone", "ফোন"], value: n(c.phone), href: `tel:+88${c.phone}` });
  if (c.whatsapp) cards.push({ icon: <ChatCircleText size={20} />, label: ["WhatsApp", "হোয়াটসঅ্যাপ"], value: n(c.whatsapp), href: `https://wa.me/88${c.whatsapp}` });
  cards.push({ icon: <Clock size={20} />, label: ["Support hours", "সাপোর্টের সময়"], value: t(c.hours) });
  if (c.address) cards.push({ icon: <MapPin size={20} />, label: ["Office", "অফিস"], value: t([c.address, c.addressBn || c.address]) });
  if (c.legalName) cards.push({ icon: <Storefront size={20} />, label: ["Business", "প্রতিষ্ঠান"], value: c.tradeLicence ? `${c.legalName} · ${t(["Trade licence", "ট্রেড লাইসেন্স"])} ${n(c.tradeLicence)}` : c.legalName });

  return (
    <ul className="grid gap-3 border-t border-line pt-8 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((card) => {
        const body = (
          <>
            <span className="grid size-10 place-items-center rounded-full bg-brand text-brand-contrast">{card.icon}</span>
            <span className="mt-5 block text-[13px] text-ink-3">{t(card.label)}</span>
            <span className="mt-1 block break-words font-display text-[19px] font-semibold leading-snug text-ink">{card.value}</span>
            {card.note && <span className="mt-2 block text-[13.5px] leading-relaxed text-ink-3">{t(card.note)}</span>}
          </>
        );
        return (
          <li key={card.label[0]}>
            {card.href ? (
              <a href={card.href} className="block h-full rounded-[var(--r)] border border-line bg-surface p-5 transition-colors hover:border-line-strong">
                {body}
              </a>
            ) : (
              <div className="h-full rounded-[var(--r)] border border-line bg-surface p-5">{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
