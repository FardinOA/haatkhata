"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "../ui/core";
import { Check, LockSimple, PaintBrush } from "@phosphor-icons/react";
import { builtinPermissions } from "@/lib/domain";
import type { BuiltinRole, Permission } from "@/lib/types";
import { JamdaniWeave, SectionHead, useSite } from "./site-kit";

type Preset = "owner" | "packing" | "sales";

/** Swatch order and names match the site's own colour choices. */
const COLOURS: { key: string; file: string; hex: string; en: string; bn: string; note: [string, string] }[] = [
  { key: "lime", file: "", hex: "#C9F05A", en: "Lebu", bn: "লেবু", note: ["Fresh lime, BechaKena's own", "তাজা লেবু-সবুজ, বেচাকেনার নিজের রং"] },
  { key: "jamdani", file: "jamdani", hex: "#0E6B53", en: "Jamdani", bn: "জামদানি", note: ["Bottle green of Dhakai weave", "ঢাকাই বুননের গাঢ় সবুজ"] },
  { key: "shapla", file: "shapla", hex: "#C2306B", en: "Shapla", bn: "শাপলা", note: ["Water-lily pink", "শাপলা ফুলের গোলাপি"] },
  { key: "kantha", file: "kantha", hex: "#3446C4", en: "Kantha", bn: "কাঁথা", note: ["Indigo running stitch", "কাঁথা ফোঁড়ের নীল"] },
  { key: "shimul", file: "shimul", hex: "#D2401F", en: "Shimul", bn: "শিমুল", note: ["Silk-cotton blossom red", "শিমুল ফুলের লাল"] },
];

/** Glass frame shared by both product shots in this section. */
const BEZEL = "relative bg-white/55 shadow-[0_0_0_1px_rgb(18_18_18/0.07),0_2px_4px_rgb(18_18_18/0.04),0_20px_40px_-16px_rgb(18_18_18/0.14),0_70px_120px_-40px_rgb(18_18_18/0.3)] backdrop-blur-xl";

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
    <section id="dashboard">
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

      {/* The real thing, in a glass bezel over a soft glow, with what this role can and can't do pinned to it. */}
      <div className="relative mt-12 md:mt-14">
        <div aria-hidden className="pointer-events-none absolute -inset-x-[8%] bottom-[-14%] top-[22%] rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--brand)_55%,transparent),transparent)] blur-2xl" />
        <div className={cn(BEZEL, "rounded-[22px] p-1.5 md:rounded-[30px] md:p-3")}>
          <div id="dash-shot" role="tabpanel" className="relative aspect-[16/10] overflow-hidden rounded-[16px] bg-[#F3F4F0] shadow-[0_0_0_1px_rgb(18_18_18/0.08)] md:rounded-[20px]">
            {presets.map((p) => (
              <Image
                key={`${p.id}-${lang}`}
                src={`/landing/dash-${p.id}-${lang}.png`}
                alt={t(`BechaKena dashboard as seen by ${p.who[0]}: ${p.name}`, `${p.who[1]}-এর চোখে বেচাকেনার ড্যাশবোর্ড: ${p.name}`)}
                fill
                sizes="(min-width: 1240px) 1100px, 100vw"
                className={cn("object-cover object-top transition-opacity duration-500", preset === p.id ? "opacity-100" : "opacity-0")}
                aria-hidden={preset !== p.id}
              />
            ))}
            <Pins key={`${preset}-${lang}`} preset={preset} />
          </div>
        </div>
        <AccessCard preset={preset} />
      </div>

      <ColourStudio />
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ role overlays */

type Side = "l" | "r" | "ul" | "ur";
type Pin = { at: [number, number]; bn?: [number, number]; side: Side; bnSide?: Side; label: [string, string] };

/*
 * Points on each screenshot, in % of its width and height, with each label
 * set into empty space beside its target. The Bangla captures sit 2.5% higher
 * (their summary fits on one line), and the summary line ends elsewhere.
 */
const PINS: Record<Preset, Pin[]> = {
  owner: [
    { at: [37.4, 31.8], bn: [67.6, 29.2], side: "r", bnSide: "ul", label: ["Cash still with couriers", "কুরিয়ারের কাছে আটকে থাকা টাকা"] },
    { at: [86.5, 38.5], side: "ul", label: ["Profit only the owner sees", "লাভ শুধু মালিক দেখেন"] },
  ],
  packing: [
    { at: [51.1, 46.2], side: "ul", label: ["What to pack next", "এরপর কী প্যাক করবেন"] },
    { at: [70.3, 77.8], side: "ul", label: ["One tap moves a parcel on", "এক ট্যাপে পার্সেল পরের ধাপে"] },
  ],
  sales: [
    { at: [31, 43.5], side: "ur", label: ["A new order in one tap", "এক ট্যাপে নতুন অর্ডার"] },
    { at: [28.9, 58.3], side: "ur", label: ["Her target, never your margin", "তার লক্ষ্য, আপনার লাভ নয়"] },
  ],
};

const LABEL_AT: Record<Side, string> = {
  r: "left-4 top-0 -translate-y-1/2",
  l: "right-4 top-0 -translate-y-1/2",
  ul: "bottom-3 -right-2",
  ur: "bottom-3 -left-2",
};

function Pins({ preset }: { preset: Preset }) {
  const { t, lang } = useSite();
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 hidden md:block">
      {PINS[preset].map((p, i) => {
        const [x, y] = lang === "bn" ? (p.bn ?? [p.at[0], p.at[1] - 2.5]) : p.at;
        return (
          <span key={i} className="absolute size-0 motion-safe:animate-[bk-soft-in_450ms_var(--ease-out)_both]" style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${250 + i * 160}ms` }}>
            <span className="absolute -left-[7px] -top-[7px] size-3.5 rounded-full bg-brand shadow-[0_0_0_3px_#fff,0_4px_10px_rgb(18_18_18/0.25)]" />
            <span className="absolute -left-[7px] -top-[7px] size-3.5 rounded-full bg-brand/60 motion-safe:animate-ping" />
            <span className={cn("absolute whitespace-nowrap rounded-full bg-ink px-3 py-1.5 text-[12.5px] font-medium text-white shadow-[0_8px_20px_-6px_rgb(18_18_18/0.45)]", LABEL_AT[(lang === "bn" && p.bnSide) || p.side])}>{t(...p.label)}</span>
          </span>
        );
      })}
    </div>
  );
}

const PEOPLE: Record<Preset, { name: [string, string]; role: BuiltinRole; title: [string, string]; initials: string; color: string }> = {
  owner: { name: ["Nusrat Jahan", "নুসরাত জাহান"], role: "owner", title: ["Owner", "মালিক"], initials: "NJ", color: "#0E6B53" },
  packing: { name: ["Rakib Hasan", "রাকিব হাসান"], role: "packer", title: ["Packer", "প্যাকার"], initials: "RH", color: "#E0A100" },
  sales: { name: ["Mim Akter", "মিম আক্তার"], role: "sales", title: ["Sales", "সেলস"], initials: "MA", color: "#C2306B" },
};

const ACCESS: { perm: Permission; label: [string, string] }[] = [
  { perm: "create_order", label: ["Take orders", "অর্ডার নেওয়া"] },
  { perm: "pack_ship", label: ["Pack and ship", "প্যাক ও শিপ"] },
  { perm: "view_cost", label: ["See profit and buying prices", "লাভ ও কেনা দাম দেখা"] },
];

/** The role's real permissions (from the app's own role table), resting on the bezel's corner. */
function AccessCard({ preset }: { preset: Preset }) {
  const { t } = useSite();
  const who = PEOPLE[preset];
  const perms = builtinPermissions(who.role);
  return (
    <div className="absolute -bottom-10 -left-5 z-10 hidden w-[272px] rounded-[20px] bg-white p-4 shadow-[0_0_0_1px_rgb(18_18_18/0.06),0_24px_48px_-16px_rgb(18_18_18/0.3)] lg:block xl:-left-12">
      <div key={preset} className="flex items-center gap-3 motion-safe:animate-[bk-soft-in_350ms_var(--ease-out)_both]">
        <span className="grid size-9 shrink-0 place-items-center rounded-full text-[12.5px] font-semibold text-white" style={{ background: who.color }}>
          {who.initials}
        </span>
        <div className="min-w-0">
          <p className="truncate text-[14px] font-semibold text-ink">{t(...who.name)}</p>
          <p className="text-[12.5px] text-ink-3">{t(...who.title)}</p>
        </div>
      </div>
      <ul className="mt-3 space-y-2 border-t border-line pt-3">
        {ACCESS.map((a) => {
          const ok = perms.includes(a.perm);
          return (
            <li key={a.perm} className="flex items-center gap-2.5 text-[13px]">
              <span className={cn("grid size-5 shrink-0 place-items-center rounded-full transition-colors duration-300", ok ? "bg-ok-soft text-ok" : "bg-sunken text-ink-4")}>
                {ok ? <Check weight="bold" className="size-3" /> : <LockSimple weight="fill" className="size-3" />}
              </span>
              <span className={cn("transition-colors duration-300", ok ? "text-ink-2" : "text-ink-4")}>{t(...a.label)}</span>
              <span className="sr-only">{ok ? t("allowed", "অনুমতি আছে") : t("hidden", "লুকানো")}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------ colour studio */

/**
 * A swatch book of the shop colours, woven like the fabrics they're named
 * after. Picking one changes the dashboard shot and the whole landing page,
 * so the visitor sees their colour everywhere at once, as their shop would.
 */
function ColourStudio() {
  const { t, lang, accent, setAccent } = useSite();
  const active = Math.max(0, COLOURS.findIndex((c) => c.hex.toLowerCase() === accent.toLowerCase()));

  return (
    <div className="mt-32 grid items-center gap-12 md:mt-40 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] lg:gap-16">
      <div>
        <h3 className="text-balance font-display text-[30px] font-semibold leading-[1.08] tracking-[-0.03em] text-ink md:text-[40px]">{t("Same dashboard, in your shop's colour.", "একই ড্যাশবোর্ড, আপনার দোকানের রঙে।")}</h3>
        <p className="mt-4 text-[16.5px] leading-relaxed text-ink-3">{t("Upload your logo and BechaKena suggests colours from it, for the app, invoices and labels.", "লোগো দিলে বেচাকেনা তা থেকে রং সাজিয়ে দেয় — অ্যাপ, ইনভয়েস আর লেবেলে।")}</p>

        <div role="radiogroup" aria-label={t("Shop colour", "দোকানের রং")} className="mt-8 space-y-1">
          {COLOURS.map((c, i) => {
            const on = i === active;
            const light = c.key === "lime";
            return (
              <button
                key={c.key}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setAccent(c.hex)}
                className={cn(
                  "flex w-full items-center gap-3.5 rounded-[16px] p-2 pr-4 text-left transition-[background-color,box-shadow] duration-300",
                  on ? "bg-white shadow-[0_0_0_1px_rgb(18_18_18/0.06),0_10px_24px_-12px_rgb(18_18_18/0.25)]" : "hover:bg-sunken/60",
                )}
              >
                <span className="relative size-11 shrink-0 overflow-hidden rounded-[12px] shadow-[inset_0_0_0_1px_rgb(18_18_18/0.08)]" style={{ background: c.hex }}>
                  <JamdaniWeave className="absolute inset-0 size-full" color={light ? "#121212" : "#FFFFFF"} opacity={light ? 0.2 : 0.3} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold leading-tight text-ink">{t(c.en, c.bn)}</span>
                  <span className="mt-0.5 block truncate text-[13px] text-ink-3">{t(...c.note)}</span>
                </span>
                <span className={cn("grid size-6 shrink-0 place-items-center rounded-full transition-all duration-300", on ? "scale-100 bg-ink text-white" : "scale-75 text-transparent")}>
                  <Check weight="bold" className="size-3.5" />
                </span>
              </button>
            );
          })}
        </div>
        <p className="mt-5 flex items-center gap-2 px-2 text-[13px] text-ink-3">
          <PaintBrush className="size-4 text-ink-2" />
          {t("Pick one. This page changes with it.", "একটা বেছে নিন। এই পেজটাও সেই রঙে বদলাবে।")}
        </p>
      </div>

      <div className="relative">
        <div aria-hidden className="pointer-events-none absolute -inset-x-[10%] bottom-[-16%] top-[10%] rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--brand)_60%,transparent),transparent)] blur-2xl transition-colors duration-500" />
        <div className={cn(BEZEL, "rounded-[22px] p-1.5 md:rounded-[28px] md:p-2.5")}>
          <div className="relative aspect-[5/4] overflow-hidden rounded-[16px] bg-[#F3F4F0] shadow-[0_0_0_1px_rgb(18_18_18/0.08)] md:rounded-[20px]">
            {COLOURS.map((c, i) => (
              <Image
                key={`${c.key}-${lang}`}
                src={c.file ? `/landing/dash-owner-${c.file}-${lang}.png` : `/landing/dash-owner-${lang}.png`}
                alt={t(`Owner dashboard in ${c.en}`, `${c.bn} রঙে মালিকের ড্যাশবোর্ড`)}
                fill
                sizes="(min-width: 1024px) 680px, 100vw"
                className={cn("object-cover object-left-top transition-opacity duration-700", i === active ? "opacity-100" : "opacity-0")}
                aria-hidden={i !== active}
              />
            ))}
          </div>
        </div>
        <LogoCard />
      </div>
    </div>
  );
}

/** "Your logo → your colours": the shop's mark and the ramp drawn from it, in the live accent. */
function LogoCard() {
  const { t } = useSite();
  return (
    <div className="absolute -right-3 -top-8 hidden w-[232px] rounded-[20px] bg-white p-4 shadow-[0_0_0_1px_rgb(18_18_18/0.06),0_24px_48px_-16px_rgb(18_18_18/0.3)] md:block xl:-right-10">
      <p className="text-[12px] font-medium text-ink-3">{t("From your logo", "আপনার লোগো থেকে")}</p>
      <div className="mt-3 flex items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-[12px] bg-brand font-display text-[15px] font-bold text-brand-contrast transition-colors duration-500">RB</span>
        <svg aria-hidden viewBox="0 0 24 8" className="h-2 w-6 shrink-0 text-ink-4">
          <path d="M0 4h21M18 1l3 3-3 3" fill="none" stroke="currentColor" strokeWidth="1.4" />
        </svg>
        <span className="flex -space-x-1.5">
          {["--brand-200", "--brand-400", "--brand-600", "--brand-800"].map((v) => (
            <span key={v} className="size-7 rounded-full shadow-[0_0_0_2px_#fff] transition-colors duration-500" style={{ background: `var(${v})` }} />
          ))}
        </span>
      </div>
      <p className="mt-3 text-[12.5px] leading-snug text-ink-2">{t("App, invoices and labels, all in one colour.", "অ্যাপ, ইনভয়েস আর লেবেল — সব এক রঙে।")}</p>
    </div>
  );
}
