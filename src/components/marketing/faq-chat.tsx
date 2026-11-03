"use client";

import { DownloadSimple, FileXls, Lock, PaperPlaneRight } from "@phosphor-icons/react";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { cn } from "../ui/core";
import { FAQ, matchFaq, type Proof } from "./data";
import { LogoMark, SectionHead, useInView, useSite } from "./site-kit";

type Msg = { id: number; from: "me" | "bk"; faq: number; text?: string; suggest?: number[] };

const REPLY_MS = 380;

/**
 * The FAQ as the kind of chat sellers have all day with their own customers:
 * tap a question (or type one) and the answer arrives with a small proof of
 * the thing working, not just a sentence about it.
 */
export function FaqChat() {
  const { t } = useSite();
  const [thread, setThread] = useState<Msg[]>([]);
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState("");
  const [card, seen] = useInView<HTMLDivElement>(0.35);
  const nextId = useRef(1);
  const timers = useRef<number[]>([]);
  const acted = useRef(false);
  const lastRef = useRef<HTMLDivElement>(null);

  const answered = new Set(thread.filter((m) => m.from === "bk" && m.faq >= 0).map((m) => m.faq));
  const open = FAQ.map((_, i) => i).filter((i) => FAQ[i].chip !== false && !answered.has(i));

  const send = (faq: number, text?: string) => {
    if (typing) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const me: Msg = { id: nextId.current++, from: "me", faq, text };
    setThread((th) => [...th, me]);
    setTyping(true);
    timers.current.push(
      window.setTimeout(
        () => {
          const asked = new Set([...answered, faq]);
          const suggest = faq < 0 ? FAQ.map((_, i) => i).filter((i) => FAQ[i].chip !== false && !asked.has(i)).slice(0, 3) : undefined;
          setThread((th) => [...th, { id: nextId.current++, from: "bk", faq, suggest }]);
          setTyping(false);
        },
        reduced ? 0 : REPLY_MS,
      ),
    );
  };

  const ask = (faq: number) => {
    acted.current = true;
    send(faq);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || typing) return;
    acted.current = true;
    setDraft("");
    send(matchFaq(text), text);
  };

  // The first question asks itself once the chat comes into view.
  useEffect(() => {
    if (!seen) return;
    const id = window.setTimeout(() => setThread((th) => (th.length ? th : [{ id: nextId.current++, from: "me", faq: 0 }])), 450);
    const reply = window.setTimeout(() => setThread((th) => (th.length === 1 && th[0].faq === 0 ? [...th, { id: nextId.current++, from: "bk", faq: 0 }] : th)), 450 + REPLY_MS);
    return () => {
      clearTimeout(id);
      clearTimeout(reply);
    };
  }, [seen]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  // Keep the newest reply in view, but only after the visitor has asked something.
  useEffect(() => {
    if (acted.current) lastRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [thread.length, typing]);

  const schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map((f) => ({ "@type": "Question", name: t(...f.q), acceptedAnswer: { "@type": "Answer", text: t(...f.a) } })),
  };

  return (
    <section id="faq" className="mx-auto max-w-[1000px] px-5 py-28 md:px-8 md:py-40">
      <SectionHead title={t("Ask us like a customer would.", "কাস্টমারের মতো করেই জিজ্ঞেস করুন।")} sub={t("Tap a question or type your own.", "একটা প্রশ্ন বেছে নিন বা নিজে লিখুন।")} />

      <div ref={card} className="mt-14 overflow-hidden rounded-[28px] bg-surface shadow-[0_0_0_1px_rgb(18_18_18/0.06),0_30px_70px_-35px_rgb(18_18_18/0.25)] md:mt-16">
        {/* Chat header */}
        <div className="flex items-center gap-3 border-b border-line px-4 py-3.5 md:px-6">
          <span className="relative shrink-0">
            <LogoMark size={40} />
            <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-surface bg-ok" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-[16px] font-semibold leading-tight text-ink">{t("BechaKena team", "বেচাকেনা টিম")}</p>
            <p className="truncate text-[12.5px] text-ink-3">{t("Answers here, a real person on WhatsApp", "উত্তর এখানেই, মানুষ আছেন হোয়াটসঅ্যাপে")}</p>
          </div>
        </div>

        {/* Thread, on a faint Jamdani wallpaper like a chat background */}
        <div className="relative bg-surface-2">
          <div role="log" aria-live="polite" aria-label={t("Questions and answers", "প্রশ্ন ও উত্তর")} className="relative flex min-h-[360px] flex-col gap-3 px-4 py-6 md:min-h-[420px] md:px-8 md:py-8">
            <Bot>
              <Bubble>{t("Hi! 👋 This is the BechaKena team. What would you like to know?", "আসসালামু আলাইকুম! 👋 বেচাকেনা টিম থেকে বলছি। কী জানতে চান?")}</Bubble>
            </Bot>
            {thread.map((m) =>
              m.from === "me" ? (
                <Mine key={m.id}>
                  {m.text ?? t(...FAQ[m.faq].q)}
                </Mine>
              ) : (
                <Bot key={m.id}>
                  {m.faq >= 0 ? (
                    <>
                      <Bubble>{t(...FAQ[m.faq].a)}</Bubble>
                      {FAQ[m.faq].proof && <ProofCard proof={FAQ[m.faq].proof!} />}
                    </>
                  ) : (
                    <>
                      <Bubble>{t("I don't have a ready answer for that one. Message us on WhatsApp and a real person will answer, in Bangla. Or try one of these:", "এটার তৈরি উত্তর আমার কাছে নেই। হোয়াটসঅ্যাপে মেসেজ দিন — বাংলায় একজন মানুষ উত্তর দেবেন। অথবা এগুলো দেখুন:")}</Bubble>
                      {!!m.suggest?.length && (
                        <div className="flex flex-wrap gap-2">
                          {m.suggest.map((s) => (
                            <Chip key={s} onClick={() => ask(s)} disabled={typing || answered.has(s)}>
                              {t(...FAQ[s].q)}
                            </Chip>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </Bot>
              ),
            )}
            {typing && (
              <Bot>
                <span className="inline-flex h-10 items-center gap-1 rounded-[20px] rounded-bl-md border border-line bg-surface px-4" aria-label={t("Typing", "লিখছে")}>
                  {[0, 1, 2].map((d) => (
                    <span key={d} className="size-1.5 rounded-full bg-ink-3 motion-safe:animate-[bk-typing_1s_ease-in-out_infinite]" style={{ animationDelay: `${d * 0.15}s` }} />
                  ))}
                </span>
              </Bot>
            )}
            <div ref={lastRef} className="h-px" aria-hidden />
          </div>
        </div>

        {/* Quick replies + composer */}
        <div className="border-t border-line bg-surface px-4 pb-4 pt-3.5 md:px-6">
          {open.length ? (
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-3 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label={t("Suggested questions", "প্রশ্নগুলো")}>
              {open.map((i) => (
                <Chip key={i} onClick={() => ask(i)} disabled={typing}>
                  {t(...FAQ[i].q)}
                </Chip>
              ))}
            </div>
          ) : (
            <p className="pb-3 text-[14px] text-ink-2">{t("That's every question we usually get. Ask your own below.", "সাধারণত যত প্রশ্ন আসে, সব শেষ। নিজের প্রশ্ন নিচে লিখুন।")}</p>
          )}
          <form onSubmit={submit} className="flex items-center gap-2">
            <label htmlFor="faq-ask" className="sr-only">
              {t("Type your own question", "নিজের প্রশ্ন লিখুন")}
            </label>
            <input
              id="faq-ask"
              value={draft}
              onChange={(e) => setDraft(e.target.value.slice(0, 160))}
              placeholder={t("Type your own question…", "নিজের প্রশ্ন লিখুন…")}
              autoComplete="off"
              className="h-12 min-w-0 flex-1 rounded-full border border-transparent bg-sunken px-5 text-[15px] text-ink outline-none transition-colors placeholder:text-ink-4 focus:border-brand focus:bg-surface"
            />
            <button type="submit" disabled={!draft.trim() || typing} className="grid size-12 shrink-0 place-items-center rounded-full bg-brand text-brand-contrast transition-all hover:-translate-y-px disabled:translate-y-0 disabled:opacity-40" aria-label={t("Send", "পাঠান")}>
              <PaperPlaneRight className="size-5" weight="fill" />
            </button>
          </form>
        </div>
      </div>

      {/* Same questions for search engines */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, "\\u003c") }} />
    </section>
  );
}

/* ------------------------------------------------------------ messages */

function Bot({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-end gap-2.5 motion-safe:animate-[bk-msg_.35s_var(--ease-out)]">
      <LogoMark size={28} />
      <div className="flex min-w-0 max-w-[min(88%,560px)] flex-col items-start gap-2">{children}</div>
    </div>
  );
}

function Bubble({ children }: { children: ReactNode }) {
  return <p className="rounded-[20px] rounded-bl-md border border-line bg-surface px-4 py-2.5 text-[15px] leading-relaxed text-ink shadow-[0_1px_2px_rgb(22_24_26/0.05)]">{children}</p>;
}

function Mine({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col items-end gap-1 motion-safe:animate-[bk-msg_.3s_var(--ease-out)]">
      <p className="max-w-[min(85%,480px)] rounded-[20px] rounded-br-md bg-brand px-4 py-2.5 text-[15px] leading-relaxed text-brand-contrast transition-colors duration-500">{children}</p>
    </div>
  );
}

function Chip({ children, onClick, disabled }: { children: ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="shrink-0 whitespace-nowrap rounded-full border border-brand/35 bg-surface px-4 py-2 text-[14px] font-medium text-brand-ink transition-all hover:-translate-y-px hover:border-brand hover:bg-brand-50 disabled:pointer-events-none disabled:opacity-45 sm:whitespace-normal sm:text-left"
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------ proofs */

function ProofCard({ proof }: { proof: Proof }) {
  // Proof only where the answer needs showing; the rest already speak for themselves (or are shown elsewhere on the page).
  const body = { catalogue: <CatalogueProof />, staff: <StaffProof />, data: <DataProof /> }[proof as "catalogue" | "staff" | "data"];
  if (!body) return null;
  return <div className="w-[min(100%,380px)] rounded-[18px] border border-line bg-surface p-3.5 shadow-[0_10px_30px_-18px_rgb(22_24_26/0.35)]">{body}</div>;
}

function useSlug() {
  const { shop } = useSite();
  return (
    shop
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "your-shop"
  );
}

function CatalogueProof() {
  const { t, n, shop, accent } = useSite();
  const slug = useSlug();
  const items = [
    [t("Jamdani", "জামদানি"), "6,500", 1],
    [t("Silk orna", "সিল্ক ওড়না"), "980", 0.62],
    [t("Three-piece", "থ্রি-পিস"), "1,450", 0.36],
  ] as const;
  return (
    <div>
      <div className="grid grid-cols-3 gap-1.5">
        {items.map(([name, price, o]) => (
          <div key={name} className="overflow-hidden rounded-[10px] bg-sunken">
            <div className="relative aspect-[5/3]" style={{ background: accent, opacity: 0.25 + o * 0.75 }}>
            </div>
            <div className="px-2 py-1.5">
              <p className="truncate text-[11.5px] font-medium text-ink">{name}</p>
              <p className="tnum text-[11px] text-ink-3">৳{n(price)}</p>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 truncate text-[12px] text-ink-3">bechakena.app/s/{slug}</p>
      <p className="truncate font-display text-[15px] font-semibold text-ink">
        {shop.trim() || t("Your Shop", "আপনার দোকান")} · {t("catalogue", "ক্যাটালগ")}
      </p>
    </div>
  );
}

function StaffProof() {
  const { t, n } = useSite();
  const view = (who: string, hide: boolean) => (
    <div className={cn("rounded-[12px] border p-2.5", hide ? "border-line bg-surface-2" : "border-brand/30 bg-brand-50")}>
      <p className="text-[11.5px] font-medium text-ink-3">{who}</p>
      {[
        [t("Buying price", "কেনা দাম"), "4,200"],
        [t("Profit", "লাভ"), "2,340"],
      ].map(([k, v]) => (
        <p key={k} className="mt-1 flex items-center justify-between gap-2 text-[12.5px]">
          <span className="text-ink-2">{k}</span>
          {hide ? (
            <span className="flex items-center gap-1 text-ink-4">
              <Lock className="size-3" weight="bold" />
              ••••
            </span>
          ) : (
            <span className="tnum font-semibold text-ink">৳{n(v)}</span>
          )}
        </p>
      ))}
    </div>
  );
  return (
    <div className="grid grid-cols-2 gap-2">
      {view(t("Owner sees", "মালিক দেখেন"), false)}
      {view(t("Sales staff see", "সেলস স্টাফ দেখেন"), true)}
    </div>
  );
}

function DataProof() {
  const { t, n } = useSite();
  const slug = useSlug();
  return (
    <div className="flex items-center gap-3">
      <span className="grid size-11 shrink-0 place-items-center rounded-[12px] bg-[#E7F4EC] text-[#1D7044]">
        <FileXls className="size-6" weight="duotone" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13.5px] font-medium text-ink">{slug}-backup.xlsx</p>
        <p className="text-[12px] text-ink-3">{t(`Orders, products, customers · ${n("2.4")} MB`, `অর্ডার, পণ্য, কাস্টমার · ${n("2.4")} MB`)}</p>
      </div>
      <DownloadSimple className="size-5 shrink-0 text-ink-3" aria-hidden />
    </div>
  );
}

