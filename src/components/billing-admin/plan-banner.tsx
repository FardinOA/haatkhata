"use client";
/**
 * App-wide plan nudge (FR-SUB-01/04): trial ending, 80%/100% of a limit, or a
 * lapsed plan. Quiet by default; dismissible per day. Mount above <main>.
 */
import { WarningCircle, X } from "@phosphor-icons/react";
import Link from "next/link";
import { useState } from "react";
import { cn } from "../ui/core";
import { useFmt, useT } from "@/lib/hooks";
import { usePathname } from "next/navigation";
import { useUsage } from "./usage-client";

const KEY = "bk-plan-banner-dismissed";
const today = () => new Date().toISOString().slice(0, 10);

export function PlanBanner() {
  const t = useT();
  const f = useFmt();
  const path = usePathname();
  const { data } = useUsage();
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(KEY) === today();
    } catch {
      return false;
    }
  });
  if (!data || data.demo || dismissed || path.startsWith("/settings")) return null;
  const full = Object.entries(data.usage).find(([, m]) => m.level === "full");
  const warn = Object.entries(data.usage).find(([, m]) => m.level === "warn");
  const label = (k: string) => ({ orders: t("orders this month", "এই মাসের অর্ডার"), products: t("products", "পণ্য"), staff: t("team seats", "টিমের আসন") })[k] ?? k;
  let text: string | null = null;
  let tone: "danger" | "cash" = "cash";
  if (data.plan === "expired") {
    tone = "danger";
    text = t("Your shop has no active plan — new orders and invoice printing are paused.", "আপনার দোকানে কোনো চালু প্ল্যান নেই — নতুন অর্ডার ও ইনভয়েস প্রিন্ট বন্ধ।");
  } else if (full) {
    tone = "danger";
    text = t(`You've used all your ${label(full[0])}. New ones are paused — everything else keeps working.`, `সব ${label(full[0])} ব্যবহার হয়ে গেছে। নতুন যোগ বন্ধ — বাকি সব চলবে।`);
  } else if (data.trial && data.trial.daysLeft <= 3) {
    text = t(`Your trial ends in ${data.trial.daysLeft} day${data.trial.daysLeft === 1 ? "" : "s"}. Pick a plan to keep taking orders.`, `আর ${f.num(data.trial.daysLeft)} দিনে ট্রায়াল শেষ। অর্ডার নেওয়া চালু রাখতে প্ল্যান বাছুন।`);
  } else if (data.daysLeft !== null && data.daysLeft < 0 && !data.trial) {
    tone = "danger";
    text = t("Your plan's renewal is overdue. Renew so new orders don't pause.", "প্ল্যান নবায়নের সময় পেরিয়েছে। নতুন অর্ডার বন্ধ হওয়া এড়াতে নবায়ন করুন।");
  } else if (warn) {
    text = t(`You've used ${Math.round((warn[1].used / (warn[1].limit ?? 1)) * 100)}% of your ${label(warn[0])}.`, `${label(warn[0])} এর ${f.num(Math.round((warn[1].used / (warn[1].limit ?? 1)) * 100))}% ব্যবহার হয়েছে।`);
  }
  if (!text) return null;
  return (
    <div className={cn("flex items-center gap-3 border-b px-4 py-2 text-[13px] md:px-8", tone === "danger" ? "border-danger/20 bg-danger-soft text-danger" : "border-cash/30 bg-cash-soft text-cash-ink")} role="status">
      <WarningCircle className="size-4 shrink-0" weight="fill" />
      <span className="min-w-0 flex-1">{text}</span>
      <Link href="/settings?tab=plan" className="shrink-0 font-semibold underline-offset-2 hover:underline">
        {t("See plans", "প্ল্যান দেখুন")}
      </Link>
      <button
        type="button"
        aria-label={t("Hide for today", "আজকের জন্য লুকান")}
        className="grid size-7 shrink-0 place-items-center rounded-sm hover:bg-black/5"
        onClick={() => {
          try {
            localStorage.setItem(KEY, today());
          } catch {
            /* ignore */
          }
          setDismissed(true);
        }}
      >
        <X className="size-3.5" weight="bold" />
      </button>
    </div>
  );
}
