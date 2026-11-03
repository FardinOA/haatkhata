"use client";

import { Lightning, ShieldCheck, ShieldWarning, UsersThree } from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";
import { cn } from "../ui/core";
import { api, loadPrefs } from "./client";
import { scoreRisk, type RiskLevel, type RiskResult } from "./risk-score";
import { normalizePhone } from "@/lib/domain";
import { useFmt, useT } from "@/lib/hooks";
import { useStore } from "@/lib/store";

const LEVEL: Record<RiskLevel, { en: string; bn: string; color: string; soft: string }> = {
  new: { en: "No delivery history yet", bn: "এখনো ডেলিভারির ইতিহাস নেই", color: "var(--ink-3)", soft: "var(--sunken)" },
  trusted: { en: "Usually accepts parcels", bn: "সাধারণত পার্সেল নেন", color: "var(--color-ok)", soft: "var(--color-ok-soft)" },
  watch: { en: "Has refused some parcels", bn: "কিছু পার্সেল ফেরত দিয়েছেন", color: "var(--color-warn)", soft: "var(--color-warn-soft)" },
  risky: { en: "Often refuses parcels", bn: "প্রায়ই পার্সেল ফেরত দেন", color: "var(--color-danger)", soft: "var(--color-danger-soft)" },
};

/**
 * Return-risk for a buyer's phone (FR-CUS-06): your own history works
 * offline; signed-in shops also see anonymised counts from other shops.
 */
export function NetworkRisk({ phone, className, compact }: { phone: string; className?: string; compact?: boolean }) {
  const t = useT();
  const f = useFmt();
  const mode = useStore((s) => s.sync.mode);
  const orders = useStore((s) => s.orders);
  const flagged = useStore((s) => s.customers.find((c) => c.phone === normalizePhone(phone))?.risky ?? false);
  const p = normalizePhone(phone);
  const [server, setServer] = useState<{ phone: string; r: RiskResult } | null>(null);
  const [advanceRule, setAdvanceRule] = useState(true);

  const local = useMemo(() => {
    if (!p) return null;
    const mine = orders.filter((o) => o.customer?.phone === p);
    return scoreRisk(
      {
        delivered: mine.filter((o) => o.status === "delivered" || o.status === "partially_returned").length,
        returned: mine.filter((o) => o.status === "returned").length,
        cancelled: mine.filter((o) => o.status === "cancelled").length,
      },
      null,
      flagged,
    );
  }, [orders, p, flagged]);

  useEffect(() => {
    if (mode !== "account" || !p) return;
    let live = true;
    const id = setTimeout(() => {
      api<RiskResult>(`/api/risk?phone=${p}`)
        .then((r) => live && setServer({ phone: p, r }))
        .catch(() => {});
      loadPrefs().then((x) => live && setAdvanceRule(x.advanceOnHighRisk));
    }, 250);
    return () => {
      live = false;
      clearTimeout(id);
    };
  }, [mode, p]);

  if (!p || !local) return null;
  const r = server?.phone === p ? server.r : local;
  const meta = LEVEL[r.level];
  const net = r.network;
  const Icon = r.level === "risky" || r.level === "watch" ? ShieldWarning : ShieldCheck;

  return (
    <div className={cn("rounded-md border border-line bg-surface-2 p-3", className)} aria-live="polite">
      <div className="flex items-center gap-2.5">
        <span className="grid size-8 shrink-0 place-items-center rounded-full" style={{ background: meta.soft, color: meta.color }}>
          <Icon className="size-[18px]" weight="fill" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold" style={{ color: r.level === "new" ? "var(--ink-2)" : meta.color }}>
            {t(meta.en, meta.bn)}
          </p>
          {/* risk meter: green → amber → red, marker at the score */}
          <div className="relative mt-1.5 h-1.5 rounded-full" style={{ background: "linear-gradient(90deg, var(--color-ok) 0%, var(--color-warn) 55%, var(--color-danger) 100%)", opacity: r.level === "new" ? 0.35 : 1 }} aria-hidden>
            <span className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface shadow-1" style={{ left: `${r.score}%`, background: meta.color }} />
          </div>
        </div>
        <span className="tnum shrink-0 text-xs font-semibold text-ink-3" title={t("Risk score out of 100", "১০০ এর মধ্যে ঝুঁকি")}>
          {f.num(r.score)}
        </span>
      </div>
      {!compact && (
        <dl className="mt-2.5 grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-sm bg-surface px-2.5 py-1.5">
            <dt className="text-ink-4">{t("With you", "আপনার সাথে")}</dt>
            <dd className="tnum mt-0.5 font-medium text-ink-2">
              {t.lang === "bn" ? `${f.num(r.own.delivered)} নিয়েছেন · ${f.num(r.own.returned)} ফেরত` : `${f.num(r.own.delivered)} taken · ${f.num(r.own.returned)} returned`}
            </dd>
          </div>
          <div className="rounded-sm bg-surface px-2.5 py-1.5">
            <dt className="flex items-center gap-1 text-ink-4">
              <UsersThree className="size-3.5" />
              {net ? t(`Other shops (${net.merchants})`, `অন্য দোকান (${f.num(net.merchants)})`) : t("Other shops", "অন্য দোকান")}
            </dt>
            <dd className="tnum mt-0.5 font-medium text-ink-2">
              {mode !== "account"
                ? t("Sign in to see", "দেখতে সাইন ইন করুন")
                : net
                  ? t.lang === "bn"
                    ? `${f.num(net.delivered)} নিয়েছেন · ${f.num(net.returned)} ফেরত`
                    : `${f.num(net.delivered)} taken · ${f.num(net.returned)} returned`
                  : t("No history", "ইতিহাস নেই")}
            </dd>
          </div>
        </dl>
      )}
      {r.askAdvance && advanceRule && (
        <p className="mt-2.5 flex items-start gap-1.5 rounded-sm bg-cash-soft px-2.5 py-2 text-xs text-cash-ink">
          <Lightning className="mt-px size-3.5 shrink-0" weight="fill" />
          {t("Ask for the delivery charge in advance by bKash or Nagad before you ship.", "পাঠানোর আগে বিকাশ বা নগদে ডেলিভারি চার্জ অগ্রিম নিন।")}
        </p>
      )}
    </div>
  );
}
