"use client";
/**
 * Without a paid plan, documents (invoices, parcel and barcode labels,
 * quotations) can be printed, saved or shared a few times per device, shop
 * and IP (server: billing/print-quota.ts). Every way out of a print page goes
 * through `claim`. `ui` hides anything marked [data-print-gated] from the
 * printer unless <html data-print-ok> is set, so Ctrl+P can't skip the check.
 */
import { Printer } from "@phosphor-icons/react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button } from "../ui/core";
import { Dialog, useToast } from "../ui/overlays";
import { useFmt, useT } from "@/lib/hooks";
import { useStore } from "@/lib/store";

type Allowance = { paid: boolean; used: number; limit: number; left: number };

const allow = () => (document.documentElement.dataset.printOk = "1");
const lock = () => delete document.documentElement.dataset.printOk;

// A paid shop must still print offline (offline POS), so the last answer is remembered per business.
const PAID_KEY = "bk-print-paid";
const rememberPaid = (businessId: string | undefined, paid: boolean) => {
  try {
    if (paid && businessId) localStorage.setItem(PAID_KEY, businessId);
    else localStorage.removeItem(PAID_KEY);
  } catch {
    /* ignore */
  }
};
const wasPaid = (businessId: string | undefined) => {
  try {
    return !!businessId && localStorage.getItem(PAID_KEY) === businessId;
  } catch {
    return false;
  }
};

export function usePrintGate() {
  const t = useT();
  const f = useFmt();
  const toast = useToast();
  const demo = useStore((s) => s.sync.mode) !== "account";
  const businessId = useStore((s) => (s.sync.mode === "account" ? s.sync.businessId : undefined));
  const [allowance, setAllowance] = useState<Allowance | null>(null);
  const [blocked, setBlocked] = useState<Allowance | null>(null);

  useEffect(() => {
    let live = true;
    fetch("/api/print-quota")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Allowance | null) => {
        if (!live || !d) return;
        setAllowance(d);
        rememberPaid(businessId, d.paid);
        if (d.paid) allow();
      })
      .catch(() => {
        if (live && wasPaid(businessId)) allow();
      });
    return () => {
      live = false;
      lock();
    };
  }, [businessId]);

  /** Resolves true when these documents (order ids, or `quote:…` / `labels:…` keys) may be printed / saved / shared now. */
  const claim = useCallback(
    async (orderIds: string[]) => {
      try {
        const r = await fetch("/api/print-quota", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ orders: orderIds }) });
        const d = await r.json();
        if (r.status === 402) {
          rememberPaid(businessId, false);
          setAllowance(d);
          setBlocked(d);
          return false;
        }
        if (!r.ok) throw new Error(d.error);
        setAllowance(d);
        rememberPaid(businessId, d.paid);
        allow();
        // Unpaid: the next Ctrl+P has to come back through here.
        if (!d.paid) window.addEventListener("afterprint", lock, { once: true });
        return true;
      } catch {
        if (wasPaid(businessId)) {
          allow();
          return true;
        }
        toast({ tone: "warn", title: t("Couldn't check your plan", "প্ল্যান যাচাই করা যায়নি"), body: t("Check the internet connection and try again.", "ইন্টারনেট সংযোগ দেখে আবার চেষ্টা করুন।") });
        return false;
      }
    },
    [t, toast, businessId],
  );

  const note =
    allowance && !allowance.paid
      ? allowance.left > 0
        ? t(`Trying it out: ${allowance.left} of ${allowance.limit} prints left. A plan makes printing unlimited.`, `ট্রায়াল: আর ${f.num(allowance.left)}টি প্রিন্ট বাকি (মোট ${f.num(allowance.limit)}টি)। প্ল্যান নিলে প্রিন্ট সীমাহীন।`)
        : t("Trial prints used up — pick a plan to print anything new. What you printed before can be printed again.", "ট্রায়াল প্রিন্ট শেষ — নতুন কিছু প্রিন্ট করতে প্ল্যান নিন। আগে প্রিন্ট করা জিনিস আবার প্রিন্ট করা যাবে।")
      : null;

  const ui = (
    <>
      <style>{`@media print { html:not([data-print-ok]) [data-print-gated] { display: none !important; } html:not([data-print-ok]) .print-locked { display: block !important; } }`}</style>
      <p className="print-locked hidden p-12 text-center text-[15px] text-ink">
        {t("Printing needs a plan. Open HaatKhata → Settings → Plan & billing.", "প্রিন্ট করতে প্ল্যান লাগবে। হাটখাতা → সেটিংস → প্ল্যান ও বিলিং খুলুন।")}
      </p>
      <Dialog
      open={!!blocked}
      onClose={() => setBlocked(null)}
      tone="brand"
      icon={<Printer />}
      title={t("Pick a plan to keep printing", "প্রিন্ট চালু রাখতে প্ল্যান বাছুন")}
      footer={
        <>
          <Button variant="ghost" onClick={() => setBlocked(null)}>
            {t("Not now", "এখন না")}
          </Button>
          <Link href={demo ? "/login" : "/settings?tab=plan"} className="inline-flex h-10 items-center rounded-md bg-brand px-4 text-sm font-medium text-brand-contrast">
            {demo ? t("Open your shop", "দোকান খুলুন") : t("See plans", "প্ল্যান দেখুন")}
          </Link>
        </>
      }
    >
      {t(
        `You've used your ${blocked?.limit ?? 5} trial prints. Plans start at ৳299 a month — about ৳10 a day — with unlimited printing. Pay with bKash, Nagad or card. Anything you already printed can be printed again.`,
        `ট্রায়ালের ${f.num(blocked?.limit ?? 5)}টি প্রিন্ট শেষ। প্ল্যান মাসে ৳২৯৯ থেকে — দিনে প্রায় ৳১০ — সীমাহীন প্রিন্টসহ। বিকাশ, নগদ বা কার্ডে পেমেন্ট করুন। আগে প্রিন্ট করা জিনিস আবার প্রিন্ট করা যাবে।`,
      )}
      </Dialog>
    </>
  );

  return { claim, note, ui };
}

/** Short stable key for a set of things printed together (the server caps keys at 80 chars). */
export function printKey(kind: string, ids: string[]) {
  let h = 5381;
  for (const c of [...ids].sort().join(",")) h = ((h << 5) + h + c.charCodeAt(0)) >>> 0;
  return `${kind}:${h.toString(36)}`;
}
