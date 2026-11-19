"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "../ui/core";
import { SectionHead, useSite } from "./site-kit";

/**
 * "Chat to cash" in five chapters. The phone stays put while the chapters
 * scroll past; whichever chapter is centred decides what the phone shows.
 */
export function JourneyScroll() {
  const { t } = useSite();
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLLIElement | null)[]>([]);

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.i));
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );
    refs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, []);

  const chapters: { title: string; body: string; screen: ReactNode; tone: string }[] = (
  [
    { title: t("Paste the chat. The order fills itself.", "চ্যাট পেস্ট করুন। অর্ডার নিজেই তৈরি।"), body: t("HaatKhata reads the name, phone, address and what they want, in Bangla, Banglish or English. A known customer shows how often they return parcels, and stock is held the moment you confirm.", "নাম, ফোন, ঠিকানা আর কী চান — বাংলা, বাংলিশ বা ইংরেজি — হাটখাতা নিজেই বুঝে নেয়। পুরোনো কাস্টমার হলে দেখায় কত পার্সেল ফেরত দিয়েছেন, আর নিশ্চিত করলেই স্টক রাখা হয়।"), screen: <Shot name="order" />, tone: "" },
    { title: t("The invoice goes back into the chat", "ইনভয়েস চলে যায় চ্যাটেই"), body: t("Your logo, your colour, Bangla or English. Share it as a picture straight to Messenger or WhatsApp.", "আপনার লোগো, আপনার রং, বাংলা বা ইংরেজি। ছবি হিসেবে সরাসরি মেসেঞ্জার বা হোয়াটসঅ্যাপে পাঠান।"), screen: <Shot name="invoice" />, tone: "" },
    { title: t("The courier is booked in one tap", "এক ট্যাপে কুরিয়ার বুকিং"), body: t("Steadfast or Sundarban. The label prints, the tracking number is saved, and the parcel shows as on its way.", "স্টেডফাস্ট বা সুন্দরবন। লেবেল প্রিন্ট হয়, ট্র্যাকিং নম্বর সেভ হয়, পার্সেল চলে যায় পথে।"), screen: <Shot name="label" />, tone: "" },
    { title: t("And you know when the cash lands", "আর জানেন টাকা কখন হাতে এলো"), body: t("Delivered or returned, stock moves by itself. You see exactly how much each courier still owes you — and your real profit.", "ডেলিভারি হোক বা ফেরত, স্টক নিজেই ঠিক হয়। কোন কুরিয়ারের কাছে কত বাকি আর আসল লাভ কত — সব পরিষ্কার।"), screen: <Shot name="cash" />, tone: "" },
  ]).map((c) => ({ ...c, tone: "var(--brand-ink)" }));

  return (
    <section id="how" className="mx-auto max-w-[1120px] px-5 py-28 md:px-8 md:py-40">
      <SectionHead
        title={t("The order doesn't end at the sale. Neither do we.", "বিক্রিতেই অর্ডার শেষ হয় না। আমাদের কাজও না।")}
        sub={t("Packing, courier, cash on delivery, returns. HaatKhata follows every order to the end.", "প্যাকিং, কুরিয়ার, ক্যাশ অন ডেলিভারি, ফেরত। হাটখাতা প্রতিটা অর্ডারের শেষ পর্যন্ত সাথে থাকে।")}
      />

      <div className="mt-20 grid gap-12 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-24">
        <ol className="relative">
          {chapters.map((c, i) => (
            <li
              key={i}
              data-i={i}
              ref={(el) => {
                refs.current[i] = el;
              }}
              className="flex flex-col justify-center py-10 transition-colors duration-300 lg:min-h-[44vh]"
            >
              <span className="tnum font-display text-sm font-semibold transition-colors" style={{ color: active === i ? c.tone : "var(--ink-3)" }}>
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className={cn("mt-3 font-display text-[28px] font-semibold leading-tight tracking-[-0.02em] transition-colors md:text-[38px]", active === i ? "text-ink" : "text-ink lg:text-ink-3")}>{c.title}</h3>
              <p className={cn("mt-4 max-w-[460px] text-[17px] leading-relaxed transition-colors", active === i ? "text-ink-2" : "text-ink-2 lg:text-ink-3")}>{c.body}</p>
              <div className="mt-8 lg:hidden">
                <Phone>{c.screen}</Phone>
              </div>
            </li>
          ))}
        </ol>
        <div className="hidden lg:block">
          <div className="sticky top-[calc(50vh-300px)]">
            <Phone>
              {chapters.map((c, i) => (
                <div key={i} className={cn("absolute inset-0 transition-all duration-500 ease-[var(--ease-out)]", active === i ? "translate-y-0 opacity-100" : i < active ? "-translate-y-4 opacity-0" : "translate-y-4 opacity-0")} aria-hidden={active !== i}>
                  {c.screen}
                </div>
              ))}
            </Phone>
          </div>
        </div>
      </div>
    </section>
  );
}

function Phone({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-[300px] rounded-[44px] bg-[#16181a] p-2.5 shadow-[0_40px_80px_-35px_rgb(22_24_26/0.4)]">
      <div className="relative h-[480px] overflow-hidden rounded-[36px] bg-canvas lg:h-[560px]">
        <div className="absolute left-1/2 top-2 z-10 h-5 w-20 -translate-x-1/2 rounded-full bg-[#16181a]" />
        <div className="relative h-full pt-9 [&>div.absolute]:pt-0">{children}</div>
      </div>
    </div>
  );
}

/** A real screen from the app on a phone, captured from the demo shop in the visitor's language. */
function Shot({ name }: { name: "order" | "invoice" | "label" | "cash" }) {
  const { t, lang } = useSite();
  const alt = { order: t("Order screen in HaatKhata", "হাটখাতার অর্ডার স্ক্রিন"), invoice: t("80 mm invoice in HaatKhata", "হাটখাতার ৮০ মিমি ইনভয়েস"), label: t("Parcel label in HaatKhata", "হাটখাতার পার্সেল লেবেল"), cash: t("Cash and COD screen in HaatKhata", "হাটখাতার টাকা ও COD স্ক্রিন") }[name];
  return (
    <div className="absolute inset-x-0 bottom-0 top-9 bg-surface">
      <Image src={`/landing/phone-${name}-${lang}.png`} alt={alt} fill sizes="280px" className="object-cover object-top" />
    </div>
  );
}
