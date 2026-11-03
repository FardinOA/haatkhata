"use client";

import { CheckCircle, Clock, LockSimple, WarningCircle, XCircle } from "@phosphor-icons/react";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { cn } from "../ui/core";
import { themeVars } from "@/lib/theme";

type Info = {
  shop: { name: string; logo: string | null; accent: string; phone: string };
  orderNo?: number;
  buyer?: string;
  amount: number;
  purpose: "advance" | "due";
  provider: "bkash" | "nagad" | "sandbox";
  status: "open" | "paid" | "expired" | "cancelled";
  trxId: string | null;
};

const WALLET = { bkash: { en: "Pay with bKash", bn: "বিকাশে পরিশোধ করুন", color: "#D81B72" }, nagad: { en: "Pay with Nagad", bn: "নগদে পরিশোধ করুন", color: "#EC6A1C" }, sandbox: { en: "Pay with test wallet", bn: "টেস্ট ওয়ালেটে পরিশোধ", color: "#7A45C2" } };

const taka = (n: number) => `৳${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(n)}`;

/** The page a buyer opens from a payment link. Shows only the shop, the order number and the amount. */
export function PayView() {
  const { token } = useParams<{ token: string }>();
  const params = useSearchParams();
  const [info, setInfo] = useState<Info | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [lang, setLang] = useState<"bn" | "en">("bn");
  const [reload, setReload] = useState(0);
  const t = (en: string, bn: string) => (lang === "bn" ? bn : en);
  const result = params.get("result");
  const sandbox = params.get("sandbox") === "1";

  useEffect(() => {
    let live = true;
    fetch(`/api/payment-links/public/${encodeURIComponent(token)}`)
      .then(async (r) => {
        const body = await r.json();
        if (!live) return;
        if (!r.ok) setError(body.error ?? "This link doesn't work");
        else setInfo(body);
      })
      .catch(() => live && setError("Couldn't load this payment"));
    return () => {
      live = false;
    };
  }, [token, reload]);

  const style = useMemo(() => (info ? (themeVars(info.shop.accent) as React.CSSProperties) : undefined), [info]);

  const pay = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`/api/payment-links/public/${encodeURIComponent(token)}/start`, { method: "POST" });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error);
      window.location.assign(body.redirectUrl);
    } catch (e) {
      setError((e as Error).message || "Couldn't start the payment");
      setBusy(false);
    }
  };

  const sandboxOutcome = async (outcome: "approve" | "decline") => {
    setBusy(true);
    const r = await fetch(`/api/payment-links/public/${encodeURIComponent(token)}/sandbox`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ outcome }) });
    const body = await r.json().catch(() => ({}));
    setBusy(false);
    if (!body.ok) setError(body.message ?? body.error ?? "Payment was declined");
    setReload((n) => n + 1);
  };

  const status = info?.status === "open" && result === "failed" ? "failed" : info?.status;
  const wallet = info ? WALLET[info.provider] : WALLET.bkash;

  return (
    <main className="flex min-h-dvh flex-col items-center bg-canvas px-4 py-8" style={style}>
      <div className="flex w-full max-w-[420px] justify-end">
        <button type="button" onClick={() => setLang(lang === "bn" ? "en" : "bn")} className="h-9 rounded-full px-3 text-[13px] font-medium text-ink-2 hover:bg-sunken">
          {lang === "bn" ? "English" : "বাংলা"}
        </button>
      </div>
      <div className="mt-4 w-full max-w-[420px]">
        {!info && !error && <div className="skeleton h-96 rounded-xl" />}
        {error && !info && (
          <div className="rounded-xl border border-line bg-surface p-8 text-center shadow-2">
            <WarningCircle className="mx-auto size-10 text-danger" weight="duotone" />
            <p className="mt-3 font-display text-lg font-semibold text-ink">{t("This payment link doesn't work", "এই পেমেন্ট লিংকটি কাজ করছে না")}</p>
            <p className="mt-1 text-sm text-ink-3">{t("Ask the shop to send a new one.", "দোকানকে নতুন লিংক পাঠাতে বলুন।")}</p>
          </div>
        )}
        {info && (
          <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-3">
            <div className="flex flex-col items-center gap-3 bg-brand px-6 pb-8 pt-7 text-center text-brand-contrast">
              <span className="grid size-16 place-items-center overflow-hidden rounded-[18px] bg-surface font-display text-xl font-semibold text-brand-ink shadow-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {info.shop.logo ? <img src={info.shop.logo} alt="" className="size-full object-contain" /> : info.shop.name.slice(0, 2).toUpperCase()}
              </span>
              <p className="font-display text-xl font-semibold">{info.shop.name}</p>
              {info.orderNo && <p className="text-[13px] text-brand-contrast/80">{t(`Order #${info.orderNo}`, `অর্ডার #${info.orderNo}`)}</p>}
            </div>
            <div className="-mt-4 rounded-t-xl bg-surface px-6 pb-6 pt-6">
              {status === "paid" ? (
                <div className="text-center">
                  <CheckCircle className="mx-auto size-14 text-ok" weight="fill" />
                  <p className="mt-3 font-display text-2xl font-semibold text-ink">{t("Payment received", "পেমেন্ট পাওয়া গেছে")}</p>
                  <p className="figure mt-1 text-3xl font-semibold text-ink">{taka(info.amount)}</p>
                  {info.trxId && <p className="tnum mt-2 text-[13px] text-ink-3">{t("Transaction", "ট্রানজেকশন")} {info.trxId}</p>}
                  <p className="mt-4 text-sm text-ink-2">{t("Thank you! The shop has been told and will send your parcel soon.", "ধন্যবাদ! দোকানকে জানানো হয়েছে, শীঘ্রই পার্সেল পাঠানো হবে।")}</p>
                </div>
              ) : status === "expired" || status === "cancelled" ? (
                <div className="text-center">
                  <Clock className="mx-auto size-12 text-ink-4" weight="duotone" />
                  <p className="mt-3 font-display text-xl font-semibold text-ink">{status === "expired" ? t("This link has expired", "লিংকের মেয়াদ শেষ") : t("This link was cancelled", "লিংকটি বাতিল করা হয়েছে")}</p>
                  <p className="mt-1 text-sm text-ink-3">{t("Ask the shop for a new payment link.", "দোকানের কাছে নতুন লিংক চান।")}</p>
                </div>
              ) : (
                <>
                  <p className="text-center text-sm text-ink-3">
                    {info.buyer ? t(`Hi ${info.buyer}, please pay`, `${info.buyer}, অনুগ্রহ করে পরিশোধ করুন`) : t("Please pay", "অনুগ্রহ করে পরিশোধ করুন")}
                  </p>
                  <p className="figure mt-1 text-center text-[44px] font-semibold leading-none text-ink">{taka(info.amount)}</p>
                  <p className="mt-2 text-center text-[13px] text-ink-3">{info.purpose === "advance" ? t("Advance for delivery — the rest is paid when your parcel arrives.", "ডেলিভারির অগ্রিম — বাকি টাকা পার্সেল পেলে দেবেন।") : t("Full payment for your order.", "অর্ডারের পুরো টাকা।")}</p>
                  {(status === "failed" || error) && (
                    <p className="mt-4 flex items-center gap-2 rounded-md bg-danger-soft px-3 py-2 text-[13px] text-danger">
                      <XCircle className="size-4 shrink-0" weight="fill" />
                      {error ?? t("The payment didn't go through. You can try again.", "পেমেন্ট হয়নি। আবার চেষ্টা করুন।")}
                    </p>
                  )}
                  {sandbox && info.provider === "sandbox" ? (
                    <div className="mt-6 rounded-lg border border-dashed border-line-strong p-4">
                      <p className="text-center text-xs font-medium text-ink-3">{t("Test wallet — no real money moves", "টেস্ট ওয়ালেট — কোনো আসল টাকা যাবে না")}</p>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <button type="button" disabled={busy} onClick={() => void sandboxOutcome("decline")} className="h-12 rounded-md border border-line-strong text-sm font-semibold text-ink-2 hover:bg-sunken disabled:opacity-50">
                          {t("Decline", "বাতিল")}
                        </button>
                        <button type="button" disabled={busy} onClick={() => void sandboxOutcome("approve")} className="h-12 rounded-md text-sm font-semibold text-white disabled:opacity-50" style={{ background: wallet.color }}>
                          {t("Approve", "অনুমোদন")}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button type="button" disabled={busy} onClick={() => void pay()} className={cn("mt-6 flex h-14 w-full items-center justify-center gap-2 rounded-md text-[15px] font-semibold text-white shadow-2 transition-[filter] hover:brightness-105 disabled:opacity-60")} style={{ background: wallet.color }}>
                      {busy ? t("Opening…", "খুলছে…") : t(wallet.en, wallet.bn)}
                    </button>
                  )}
                  <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-ink-4">
                    <LockSimple className="size-3.5" />
                    {t("You pay in your wallet app. The shop never sees your PIN.", "আপনি নিজের ওয়ালেটে পরিশোধ করবেন। দোকান কখনো আপনার পিন দেখে না।")}
                  </p>
                </>
              )}
            </div>
          </div>
        )}
        {info?.shop.phone && <p className="mt-5 text-center text-xs text-ink-4">{t(`Questions? Call ${info.shop.name} at ${info.shop.phone}`, `প্রশ্ন থাকলে ${info.shop.name}-কে ফোন করুন ${info.shop.phone}`)}</p>}
      </div>
    </main>
  );
}
