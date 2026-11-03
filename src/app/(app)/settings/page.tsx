"use client";

import { Buildings, CreditCard, Database, LockSimple, PaintBrush, Receipt, ShieldCheck, ShoppingCart, Storefront, Truck, Bell, ChatsCircle, Code, Translate, UsersThree, type Icon } from "@phosphor-icons/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/bits";
import { AuditSettings, DevicesSettings } from "@/components/settings/account-sections";
import { BrandStudio } from "@/components/settings/brand-studio";
import { StorefrontSettings } from "@/components/storefront/storefront-settings";
import { VatSettingsCard } from "@/components/invoice/vat-settings";
import { CourierSettings } from "@/components/couriers/courier-settings";
import { ApiSettings } from "@/components/platform/api-settings";
import { ChannelsSettings } from "@/components/platform/channels-settings";
import { NotificationsSettings } from "@/components/platform/notifications-settings";
import { SmsSettings } from "@/components/platform/sms-settings";
import { BusinessSettings, DataSettings, InvoiceSettings, LanguageSettings, PlanSettings, SellingSettings, StaffSettings } from "@/components/settings/sections";
import { cn, EmptyState } from "@/components/ui/core";
import { useCan, useT } from "@/lib/hooks";

type Tab = "brand" | "business" | "invoice" | "selling" | "couriers" | "catalogue" | "messaging" | "staff" | "security" | "notifications" | "developers" | "language" | "plan" | "data";

const TABS: { key: Tab; en: string; bn: string; sub: string; subBn: string; icon: Icon; open?: boolean }[] = [
  { key: "brand", en: "Brand studio", bn: "ব্র্যান্ড স্টুডিও", sub: "Logo, colours, type", subBn: "লোগো, রং, ফন্ট", icon: PaintBrush },
  { key: "business", en: "Business", bn: "ব্যবসা", sub: "Name, address, phone", subBn: "নাম, ঠিকানা, ফোন", icon: Buildings },
  { key: "invoice", en: "Invoices", bn: "ইনভয়েস", sub: "Templates and footer", subBn: "টেমপ্লেট ও নিচের লেখা", icon: Receipt },
  { key: "selling", en: "Selling", bn: "বিক্রি", sub: "Delivery charges, stock rules", subBn: "ডেলিভারি চার্জ, স্টকের নিয়ম", icon: ShoppingCart },
  { key: "couriers", en: "Couriers & payments", bn: "কুরিয়ার ও পেমেন্ট", sub: "Booking, tracking, bKash links", subBn: "বুকিং, ট্র্যাকিং, বিকাশ লিংক", icon: Truck },
  { key: "catalogue", en: "Online catalogue", bn: "অনলাইন ক্যাটালগ", sub: "A shop link for customers", subBn: "কাস্টমারের জন্য দোকানের লিংক", icon: Storefront },
  { key: "messaging", en: "Messaging", bn: "মেসেজিং", sub: "Inbox pages, customer SMS", subBn: "ইনবক্স পেজ, কাস্টমার SMS", icon: ChatsCircle },
  { key: "staff", en: "Team & roles", bn: "টিম ও ভূমিকা", sub: "Who can do what", subBn: "কে কী করতে পারে", icon: UsersThree },
  { key: "security", en: "Devices & activity", bn: "ডিভাইস ও কার্যকলাপ", sub: "Sign-ins and the audit log", subBn: "সাইন ইন ও লগ", icon: ShieldCheck },
  { key: "notifications", en: "Notifications", bn: "নোটিফিকেশন", sub: "Push alerts and daily summary", subBn: "পুশ ও দৈনিক সারাংশ", icon: Bell, open: true },
  { key: "developers", en: "API & webhooks", bn: "API ও ওয়েবহুক", sub: "Connect other tools", subBn: "অন্য টুল যুক্ত করুন", icon: Code },
  { key: "language", en: "Language", bn: "ভাষা", sub: "Bangla, English, numerals", subBn: "বাংলা, ইংরেজি, সংখ্যা", icon: Translate, open: true },
  { key: "plan", en: "Plan & billing", bn: "প্ল্যান ও বিলিং", sub: "Usage and upgrades", subBn: "ব্যবহার ও আপগ্রেড", icon: CreditCard },
  { key: "data", en: "Data & backup", bn: "তথ্য ও ব্যাকআপ", sub: "Export or reset", subBn: "এক্সপোর্ট বা রিসেট", icon: Database },
];

export default function SettingsPage() {
  const t = useT();
  const can = useCan();
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  const allowed = can("settings");
  const requested = (params.get("tab") as Tab) ?? (allowed ? "brand" : "language");
  const tab = TABS.some((x) => x.key === requested) ? requested : "brand";
  const locked = !allowed && !TABS.find((x) => x.key === tab)?.open;
  const go = (k: Tab) => router.replace(`${path}?tab=${k}`, { scroll: false });
  const current = TABS.find((x) => x.key === tab)!;

  return (
    <div className="mx-auto max-w-[1440px] px-4 pb-10 pt-6 md:px-8">
      <PageHeader title={t("Settings", "সেটিংস")} sub={t("Make the app look and work like your shop.", "অ্যাপটিকে আপনার দোকানের মতো করে নিন।")} />

      <div className="mt-6 grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <nav aria-label={t("Settings sections", "সেটিংসের অংশ")} className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 lg:sticky lg:top-24 lg:mx-0 lg:flex-col lg:self-start lg:overflow-visible lg:px-0">
          {TABS.map((x) => {
            const I = x.icon;
            const on = x.key === tab;
            const disabled = !allowed && !x.open;
            return (
              <button
                key={x.key}
                type="button"
                onClick={() => go(x.key)}
                aria-current={on ? "page" : undefined}
                className={cn(
                  "flex shrink-0 items-center gap-3 rounded-md px-3 text-left transition-colors lg:py-2.5",
                  "h-10 lg:h-auto",
                  on ? "bg-surface text-ink shadow-1 ring-1 ring-line" : "text-ink-2 hover:bg-sunken",
                  disabled && "opacity-50",
                )}
              >
                <I className={cn("size-[19px] shrink-0", on ? "text-brand-ink" : "text-ink-3")} weight={on ? "fill" : "regular"} />
                <span className="min-w-0">
                  <span className="block whitespace-nowrap text-sm font-medium">{t(x.en, x.bn)}</span>
                  <span className="hidden truncate text-xs text-ink-3 lg:block">{t(x.sub, x.subBn)}</span>
                </span>
                {disabled && <LockSimple className="ml-auto size-3.5 text-ink-4" />}
              </button>
            );
          })}
        </nav>

        <div className="min-w-0">
          <h2 className="mb-4 font-display text-xl font-semibold text-ink lg:hidden">{t(current.en, current.bn)}</h2>
          {locked ? (
            <div className="rounded-lg border border-line bg-surface">
              <EmptyState
                icon={<LockSimple />}
                title={t("Only the owner and managers can change this", "শুধু মালিক ও ম্যানেজার এটি বদলাতে পারেন")}
                body={t("Ask them for access, or change your own language and number style.", "অনুমতির জন্য তাদের বলুন, অথবা নিজের ভাষা ও সংখ্যা বদলান।")}
              />
            </div>
          ) : tab === "brand" ? (
            <div className="rounded-lg border border-line bg-surface p-5 shadow-1 md:p-6">
              <BrandStudio />
            </div>
          ) : tab === "business" ? (
            <BusinessSettings />
          ) : tab === "invoice" ? (
            <div className="space-y-5">
              <InvoiceSettings />
              <VatSettingsCard />
            </div>
          ) : tab === "selling" ? (
            <SellingSettings />
          ) : tab === "couriers" ? (
            <CourierSettings />
          ) : tab === "catalogue" ? (
            <StorefrontSettings />
          ) : tab === "messaging" ? (
            <div className="space-y-5">
              <ChannelsSettings />
              <SmsSettings />
            </div>
          ) : tab === "notifications" ? (
            <NotificationsSettings />
          ) : tab === "developers" ? (
            can("billing") ? <ApiSettings /> : <div className="rounded-lg border border-line bg-surface"><EmptyState icon={<LockSimple />} title={t("Only the owner can manage API keys", "শুধু মালিক API কী পরিচালনা করতে পারেন")} /></div>
          ) : tab === "staff" ? (
            <StaffSettings />
          ) : tab === "security" ? (
            <div className="space-y-5">
              <DevicesSettings />
              {can("billing") && <AuditSettings />}
            </div>
          ) : tab === "language" ? (
            <LanguageSettings />
          ) : tab === "plan" ? (
            <PlanSettings />
          ) : (
            <DataSettings />
          )}
        </div>
      </div>
    </div>
  );
}
