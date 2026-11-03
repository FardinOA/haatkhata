"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "../ui/core";
import { SectionHead, useSite } from "./site-kit";

type Preset = "owner" | "packing" | "sales";

/** Swatch order and names match the site's own colour choices. */
const COLOURS: { key: string; file: string; en: string; bn: string }[] = [
  { key: "lime", file: "", en: "Lebu", bn: "লেবু" },
  { key: "jamdani", file: "jamdani", en: "Jamdani", bn: "জামদানি" },
  { key: "shapla", file: "shapla", en: "Shapla", bn: "শাপলা" },
  { key: "kantha", file: "kantha", en: "Kantha", bn: "কাঁথা" },
  { key: "shimul", file: "shimul", en: "Shimul", bn: "শিমুল" },
];

/**
 * The real dashboard, not a drawing of one: screenshots of the demo shop taken
 * as each role (Mim, the sales staff, genuinely can't see profit), and the
 * owner's view in every shop colour.
 */
export function DashboardShowcase() {
  const { t, lang } = useSite();
  const [preset, setPreset] = useState<Preset>("owner");
  const presets: { id: Preset; name: string; who: [string, string]; note: string }[] = [
    { id: "owner", name: t("Owner's morning", "মালিকের সকাল"), who: ["Nusrat", "নুসরাত"], note: t("Sales, real profit, parcels on the move and the cash couriers still owe.", "বিক্রি, আসল লাভ, চলমান পার্সেল আর কুরিয়ারের কাছে কত টাকা আটকে।") },
    { id: "packing", name: t("Packing desk", "প্যাকিং ডেস্ক"), who: ["Rakib", "রাকিব"], note: t("Today's parcels by stage and what to pack next. Nothing about money.", "আজকের পার্সেল কোন ধাপে, এরপর কী প্যাক করবেন। টাকার হিসাব নেই।") },
    { id: "sales", name: t("Sales floor", "সেলস ফ্লোর"), who: ["Mim", "মিম"], note: t("Quick actions, the monthly target and best sellers. Profit and buying prices never show.", "দ্রুত কাজ, মাসের লক্ষ্য আর সেরা বিক্রি। লাভ আর কেনা দাম কখনো দেখা যায় না।") },
  ];
  const current = presets.find((p) => p.id === preset)!;

  return (
    <section id="dashboard" className="bg-surface-2">
      <div className="mx-auto max-w-[1120px] px-5 py-28 md:px-8 md:py-40">
      <SectionHead
        title={t("Your whole shop on one screen, arranged your way.", "পুরো দোকান এক স্ক্রিনে, আপনার মতো সাজানো।")}
        sub={t("Everyone at the shop gets the layout their job needs, and only sees what their role allows.", "দোকানের প্রত্যেকে নিজের কাজের মতো সাজ পান, আর শুধু নিজের রোলের জিনিস দেখেন।")}
      />

      {/* Roles */}
      <div className="mt-14 flex flex-col items-center gap-4 text-center md:mt-16">
        <div role="tablist" aria-label={t("Dashboard by role", "রোল অনুযায়ী ড্যাশবোর্ড")} className="grid w-full grid-cols-3 gap-1 rounded-full bg-sunken p-1 sm:w-auto">
          {presets.map((p) => (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={preset === p.id}
              aria-controls="dash-shot"
              onClick={() => setPreset(p.id)}
              className={cn("rounded-full px-4 py-2 text-center transition-all sm:px-5", preset === p.id ? "bg-surface shadow-[0_2px_8px_-2px_rgb(18_18_18/0.12)]" : "hover:bg-surface/60")}
            >
              <span className={cn("block text-[13.5px] font-semibold", preset === p.id ? "text-ink" : "text-ink-2")}>{p.name}</span>
            </button>
          ))}
        </div>
        <p key={preset} className="max-w-[520px] text-[15px] leading-relaxed text-ink-3 motion-safe:animate-[bk-msg_.35s_var(--ease-out)]">
          {t(`As ${current.who[0]}: `, `${current.who[1]} হিসেবে: `)}
          {current.note}
        </p>
      </div>

      {/* The real thing */}
      <div id="dash-shot" role="tabpanel" className="relative mt-10 overflow-hidden rounded-[22px] bg-surface shadow-[0_0_0_1px_rgb(18_18_18/0.05),0_40px_90px_-40px_rgb(18_18_18/0.3)]">
        <div className="relative aspect-[16/10]">
          {presets.map((p) => (
            <Image
              key={`${p.id}-${lang}`}
              src={`/landing/dash-${p.id}-${lang}.png`}
              alt={t(`BechaKena dashboard as seen by ${p.who[0]}: ${p.name}`, `${p.who[1]}-এর চোখে বেচাকেনার ড্যাশবোর্ড: ${p.name}`)}
              fill
              sizes="(min-width: 1240px) 1176px, 100vw"
              className={cn("object-cover object-top transition-opacity duration-500", preset === p.id ? "opacity-100" : "opacity-0")}
              aria-hidden={preset !== p.id}
            />
          ))}
        </div>
      </div>

      {/* Same dashboard, the shop's own colour */}
      <div className="mt-24 text-center md:mt-28">
        <p className="font-display text-[26px] font-semibold tracking-[-0.02em] text-ink md:text-[34px]">{t("Same dashboard, in your shop's colour.", "একই ড্যাশবোর্ড, আপনার দোকানের রঙে।")}</p>
        <p className="mx-auto mt-3 max-w-[520px] text-[16px] text-ink-3">{t("Upload your logo and BechaKena suggests colours from it, for the app, invoices and labels.", "লোগো দিলে বেচাকেনা তা থেকে রং সাজিয়ে দেয় — অ্যাপ, ইনভয়েস আর লেবেলে।")}</p>
        <ul className="-mx-5 mt-10 flex snap-x text-left snap-mandatory gap-3 overflow-x-auto px-5 pb-2 [scrollbar-width:none] md:mx-0 md:grid md:grid-cols-5 md:overflow-visible md:px-0">
          {COLOURS.map((c) => (
            <li key={c.key} className="w-[220px] shrink-0 snap-start md:w-auto">
              <div className="relative aspect-[16/10] overflow-hidden rounded-[14px] bg-surface shadow-[0_0_0_1px_rgb(18_18_18/0.05),0_12px_30px_-16px_rgb(18_18_18/0.25)]">
                <Image
                  src={c.file ? `/landing/dash-owner-${c.file}-${lang}.png` : `/landing/dash-owner-${lang}.png`}
                  alt={t(`Owner dashboard in ${c.en}`, `${c.bn} রঙে মালিকের ড্যাশবোর্ড`)}
                  fill
                  sizes="(min-width: 768px) 230px, 220px"
                  className="object-cover object-left-top"
                />
              </div>
              <p className="mt-3 text-center text-[13px] text-ink-3">{t(c.en, c.bn)}</p>
            </li>
          ))}
        </ul>
      </div>
      </div>
    </section>
  );
}
