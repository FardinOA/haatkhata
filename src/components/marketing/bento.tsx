"use client";

import { ArrowsClockwise, Check, CloudCheck, CloudSlash, Printer, WifiHigh, WifiSlash } from "@phosphor-icons/react";
import { useEffect, useState, type ReactNode } from "react";
import { cn } from "../ui/core";
import { SectionHead, useSite } from "./site-kit";

/** Capabilities as small working demos — every tile does something when touched. */
export function Bento() {
  const { t } = useSite();
  return (
    <section id="features" className="mx-auto max-w-[1120px] px-5 py-28 md:px-8 md:py-40">
      <SectionHead
        title={t("Built for how Bangladesh sells.", "বাংলাদেশ যেভাবে বিক্রি করে, সেভাবেই বানানো।")}
        sub={t("Patchy internet, Bangla numbers, profit after returns, and every kind of printer.", "দুর্বল নেট, বাংলা সংখ্যা, ফেরতের পরের লাভ, আর হরেক রকম প্রিন্টার।")}
      />
      <div className="mt-16 grid grid-cols-12 gap-5 md:mt-20">
        <Tile className="col-span-12 lg:col-span-7">
          <OfflineDemo />
        </Tile>
        <Tile className="col-span-12 sm:col-span-6 lg:col-span-5">
          <BanglaDemo />
        </Tile>
        <Tile className="col-span-12 sm:col-span-6 lg:col-span-5" tone="paper">
          <ProfitDemo />
        </Tile>
        <Tile className="col-span-12 lg:col-span-7">
          <PrintDemo />
        </Tile>
      </div>
    </section>
  );
}

function Tile({ children, className, tone = "surface" }: { children: ReactNode; className?: string; tone?: "surface" | "paper" | "brand" }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[30px] p-7 md:p-9",
        tone === "surface" && "bg-surface-2",
        tone === "paper" && "bg-surface-2",
        tone === "brand" && "bg-brand text-brand-contrast",
        className,
      )}
    >
      {children}
    </div>
  );
}

function TileHead({ title, body, light }: { title: string; body: string; light?: boolean }) {
  return (
    <div>
      <h3 className={cn("font-display text-[24px] font-semibold leading-tight tracking-[-0.02em] md:text-[28px]", light ? "text-brand-contrast" : "text-ink")}>{title}</h3>
      <p className={cn("mt-2 max-w-[420px] text-[16px] leading-relaxed", light ? "text-brand-contrast/80" : "text-ink-3")}>{body}</p>
    </div>
  );
}

/* ------------------------------------------------------------ offline */

function OfflineDemo() {
  const { t, n } = useSite();
  const [online, setOnline] = useState(false);
  const [queued, setQueued] = useState(1);
  const [synced, setSynced] = useState(0);

  useEffect(() => {
    if (online) return;
    const id = setInterval(() => setQueued((q) => Math.min(4, q + 1)), 1400);
    return () => clearInterval(id);
  }, [online]);
  useEffect(() => {
    if (!online) return;
    const id = setInterval(() => setSynced((s) => (s < queued ? s + 1 : s)), 380);
    return () => clearInterval(id);
  }, [online, queued]);

  const items = [t("Kurti · M · Indigo", "কুর্তি · M · ইন্ডিগো"), t("Georgette hijab", "জর্জেট হিজাব"), t("Tangail saree", "টাঙ্গাইল শাড়ি"), t("Jhumka", "ঝুমকা")].slice(0, queued);
  const done = online && synced >= queued;

  return (
    <div className="grid h-full gap-6 md:grid-cols-[1fr_280px]">
      <div className="flex flex-col justify-between gap-6">
        <TileHead title={t("Keeps selling when the internet doesn't", "নেট না থাকলেও বিক্রি চলে")} body={t("Orders save on the phone and sync the moment you're back online. Nothing is lost, nothing is counted twice.", "অর্ডার ফোনেই সেভ হয়, নেট ফিরলেই সিঙ্ক। কিছু হারায় না, দুবার গোনাও হয় না।")} />
        <button
          type="button"
          onClick={() => {
            setOnline((o) => !o);
            if (online) {
              setQueued(1);
              setSynced(0);
            }
          }}
          aria-pressed={online}
          className={cn("inline-flex h-12 w-fit items-center gap-2.5 rounded-full px-5 text-[14px] font-semibold transition-colors", online ? "bg-ok-soft text-ok" : "bg-warn-soft text-warn")}
        >
          {online ? <WifiHigh className="size-5" weight="bold" /> : <WifiSlash className="size-5" weight="bold" />}
          {online ? t("Online — tap to cut the internet", "অনলাইন — নেট বন্ধ করতে চাপুন") : t("Offline — tap to reconnect", "অফলাইন — নেট চালু করতে চাপুন")}
        </button>
      </div>
      <div className="rounded-[20px] bg-canvas p-3">
        <div className={cn("mb-2 flex items-center gap-2 rounded-full px-3 py-1.5 text-[12px] font-semibold", done ? "bg-ok-soft text-ok" : online ? "bg-brand-50 text-brand-ink" : "bg-warn-soft text-warn")}>
          {done ? <CloudCheck className="size-4" weight="fill" /> : online ? <ArrowsClockwise className="size-4 animate-spin" /> : <CloudSlash className="size-4" />}
          {done ? t("Everything saved", "সব সেভ হয়েছে") : online ? t("Syncing…", "সিঙ্ক হচ্ছে…") : t(`${queued} waiting on this phone`, `${n(queued)}টি এই ফোনে অপেক্ষায়`)}
        </div>
        <ul className="space-y-1.5">
          {items.map((x, i) => (
            <li key={x} className="flex items-center justify-between rounded-xl bg-surface px-3 py-2.5 text-[13px] shadow-1">
              <span className="truncate text-ink-2">
                #{n(1101 + i)} · {x}
              </span>
              {online && synced > i ? <Check className="size-4 text-ok" weight="bold" /> : <span className="size-2 rounded-full bg-warn" />}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ bangla */

function BanglaDemo() {
  const { t } = useSite();
  const [bn, setBn] = useState(true);
  const BN = "০১২৩৪৫৬৭৮৯";
  const num = "12,34,567";
  return (
    <div className="flex h-full flex-col justify-between gap-6">
      <TileHead title={t("Bangla, done properly", "বাংলা, ঠিকঠাক")} body={t("Bangla screens and invoices, lakh–crore commas, and Bangla numerals when you want them.", "বাংলা স্ক্রিন ও ইনভয়েস, লাখ–কোটির কমা, আর চাইলে বাংলা সংখ্যা।")} />
      <button type="button" onClick={() => setBn((b) => !b)} className="group text-left" aria-label={t("Switch numerals", "সংখ্যা বদলান")}>
        <span className="tnum block font-display text-[52px] font-semibold leading-none tracking-[-0.02em] text-ink transition-all md:text-[60px]" style={{ fontVariationSettings: '"wdth" 88' }}>
          ৳{bn ? num.replace(/\d/g, (d) => BN[Number(d)]) : num}
        </span>
        <span className="mt-3 inline-flex items-center gap-2 rounded-full bg-sunken p-1 text-[12.5px] font-semibold">
          <span className={cn("rounded-full px-3 py-1 transition-colors", bn ? "bg-surface text-ink shadow-1" : "text-ink-3")}>১২৩</span>
          <span className={cn("rounded-full px-3 py-1 transition-colors", !bn ? "bg-surface text-ink shadow-1" : "text-ink-3")}>123</span>
        </span>
      </button>
    </div>
  );
}

/* ------------------------------------------------------------ return risk */

function ProfitDemo() {
  const { t, n } = useSite();
  const rows: [string, string][] = [
    [t("Sales", "বিক্রি"), n("1,30,850")],
    [t("Returned goods", "ফেরত পণ্য"), `−${n("17,390")}`],
    [t("Cost of goods", "পণ্যের দাম"), `−${n("65,580")}`],
    [t("Courier & return fees", "কুরিয়ার ও ফেরত চার্জ"), `−${n("8,810")}`],
    [t("Facebook ads", "বিজ্ঞাপন"), `−${n("12,500")}`],
  ];
  return (
    <div className="flex h-full flex-col gap-4">
      <TileHead title={t("Your real profit", "আসল লাভ")} body={t("After returns, delivery and ads — not just sales.", "ফেরত, ডেলিভারি আর বিজ্ঞাপনের পরে — শুধু বিক্রি না।")} />
      <ul className="font-sans text-[13px]">
        {rows.map(([a, b]) => (
          <li key={a} className="flex items-baseline gap-2 py-[5px] text-ink-2">
            <span className="shrink-0">{a}</span>
            <span className="mb-1 flex-1 border-b border-dotted border-[#d8d0bb]" />
            <span className="tnum shrink-0">৳{b}</span>
          </li>
        ))}
      </ul>
      <div className="mt-auto flex items-end justify-between border-t-2 border-ink pt-3">
        <span className="text-[13px] font-semibold text-ink">{t("Kept", "হাতে থাকল")}</span>
        <span className="tnum font-display text-[30px] font-semibold leading-none text-ok">৳{n("26,570")}</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ printing */

function PrintDemo() {
  const { t } = useSite();
  const sizes = [
    { k: "58", label: t("58 mm", "৫৮ মিমি"), w: 46, h: 112, roll: true },
    { k: "80", label: t("80 mm", "৮০ মিমি"), w: 62, h: 112, roll: true },
    { k: "a5", label: "A5", w: 84, h: 116, roll: false },
    { k: "lbl", label: t("Label", "লেবেল"), w: 112, h: 84, roll: false },
  ];
  const [k, setK] = useState("80");
  const s = sizes.find((x) => x.k === k)!;
  return (
    <div className="flex h-full flex-col gap-4">
      <TileHead title={t("Prints on what you have", "যা আছে তাতেই প্রিন্ট")} body={t("Thermal rolls, A4/A5 memos and parcel stickers.", "থার্মাল রোল, A4/A5 মেমো আর পার্সেল স্টিকার।")} />
      <div className="grid flex-1 place-items-center rounded-[20px] bg-canvas py-5">
        <div className={cn("relative bg-white shadow-2 transition-all duration-500 ease-[var(--ease-spring)]", s.roll && "receipt-edge")} style={{ width: s.w, height: s.h }}>
          <div className="space-y-1.5 p-2.5">
            <div className="mx-auto h-2 w-1/2 rounded bg-brand transition-colors" />
            {Array.from({ length: s.k === "lbl" ? 3 : 6 }).map((_, i) => (
              <div key={i} className="h-1 rounded bg-sunken" style={{ width: `${90 - ((i * 13) % 35)}%` }} />
            ))}
          </div>
          <Printer className="absolute -bottom-3 -right-3 size-7 rounded-full bg-surface p-1 text-ink-3 shadow-1" />
        </div>
      </div>
      <div className="flex gap-1.5">
        {sizes.map((x) => (
          <button key={x.k} type="button" onClick={() => setK(x.k)} aria-pressed={k === x.k} className={cn("h-9 flex-1 rounded-full text-[12.5px] font-semibold transition-colors", k === x.k ? "bg-ink text-white" : "bg-sunken text-ink-2 hover:bg-line")}>
            {x.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ brand */

