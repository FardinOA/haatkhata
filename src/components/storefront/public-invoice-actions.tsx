"use client";

import { Check, LinkSimple, Phone, Printer, WhatsappLogo } from "@phosphor-icons/react";
import { useState } from "react";

/** Contact the seller, copy the link, or print — the only interactive bits of the public invoice. */
export function InvoiceActions({ phone, whatsapp, lang }: { phone: string; whatsapp: string | null; lang: "en" | "bn" }) {
  const t = (en: string, bn: string) => (lang === "bn" ? bn : en);
  const [copied, setCopied] = useState(false);
  const btn = "inline-flex h-11 flex-1 whitespace-nowrap items-center justify-center gap-2 rounded-md border border-line bg-surface px-4 text-sm font-medium text-ink shadow-1 transition-colors hover:border-line-strong";
  return (
    <div className="no-print mt-4 grid grid-cols-2 gap-2 sm:flex">
      {whatsapp && (
        <a href={whatsapp} target="_blank" rel="noopener noreferrer" className={btn}>
          <WhatsappLogo className="size-[18px]" weight="fill" style={{ color: "#1FA855" }} />
          {t("Message the shop", "দোকানে মেসেজ")}
        </a>
      )}
      {phone && (
        <a href={`tel:${phone}`} className={btn}>
          <Phone className="size-[18px] text-brand-ink" />
          {t("Call", "কল করুন")}
        </a>
      )}
      <button
        type="button"
        className={btn}
        onClick={async () => {
          await navigator.clipboard?.writeText(window.location.href).catch(() => {});
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        }}
      >
        {copied ? <Check className="size-[18px] text-ok" weight="bold" /> : <LinkSimple className="size-[18px] text-ink-3" />}
        {copied ? t("Link copied", "লিংক কপি হয়েছে") : t("Copy link", "লিংক কপি")}
      </button>
      <button type="button" className={btn} onClick={() => window.print()}>
        <Printer className="size-[18px] text-ink-3" />
        {t("Print", "প্রিন্ট")}
      </button>
    </div>
  );
}
