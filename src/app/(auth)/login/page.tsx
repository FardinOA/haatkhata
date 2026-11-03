"use client";

import { ArrowLeft, ArrowRight, CheckCircle, Package, Storefront, Truck, Wallet } from "@phosphor-icons/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BrandMark } from "@/components/bits";
import { Button, cn } from "@/components/ui/core";
import { normalizePhone } from "@/lib/domain";
import { useT } from "@/lib/hooks";
import { useStore } from "@/lib/store";
import { enterAccount } from "@/lib/sync";

type Biz = { id: string; name: string; logo: string | null; role: string; plan: string };

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Something went wrong");
  return data as T;
}

export default function LoginPage() {
  const t = useT();
  const router = useRouter();
  const lang = useStore((s) => s.lang);
  const setLang = useStore((s) => s.setLang);
  const [step, setStep] = useState<"phone" | "code" | "choose">("phone");
  const search = useSearchParams();
  const [phone, setPhone] = useState(() => search.get("phone") ?? "");
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const [businesses, setBusinesses] = useState<Biz[]>([]);
  const [userId, setUserId] = useState("");
  const boxes = useRef<(HTMLInputElement | null)[]>([]);
  const normalized = normalizePhone(phone);

  useEffect(() => {
    if (resendIn <= 0) return;
    const id = setTimeout(() => setResendIn((n) => n - 1), 1000);
    return () => clearTimeout(id);
  }, [resendIn]);

  const sendCode = async () => {
    if (!normalized) return setError(t("Enter a Bangladeshi mobile number like 017XXXXXXXX", "০১৭XXXXXXXX এর মতো মোবাইল নম্বর দিন"));
    setBusy(true);
    setError(null);
    try {
      const r = await post<{ devCode?: string }>("/api/auth/otp", { phone: normalized });
      setDevCode(r.devCode ?? null);
      setStep("code");
      setResendIn(30);
      setDigits(["", "", "", "", "", ""]);
      setTimeout(() => boxes.current[0]?.focus(), 50);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const finish = async (uid: string, biz: Biz[]) => {
    if (!biz.length) return router.replace("/welcome");
    if (biz.length > 1) {
      setBusinesses(biz);
      setStep("choose");
      return;
    }
    await enterAccount(uid);
    router.replace("/dashboard");
  };

  const verify = async (code: string) => {
    setBusy(true);
    setError(null);
    try {
      const r = await post<{ user: { id: string }; businesses: Biz[] }>("/api/auth/verify", { phone: normalized, code });
      setUserId(r.user.id);
      await finish(r.user.id, r.businesses);
    } catch (e) {
      setError((e as Error).message);
      setDigits(["", "", "", "", "", ""]);
      boxes.current[0]?.focus();
    } finally {
      setBusy(false);
    }
  };

  const setDigit = (i: number, v: string) => {
    const clean = v.replace(/[০-৯]/g, (d) => String("০১২৩৪৫৬৭৮৯".indexOf(d))).replace(/\D/g, "");
    if (clean.length > 1) {
      // Pasted or autofilled the whole code.
      const all = clean.slice(0, 6).split("");
      const next = ["", "", "", "", "", ""].map((_, k) => all[k] ?? "");
      setDigits(next);
      if (all.length === 6) void verify(next.join(""));
      else boxes.current[all.length]?.focus();
      return;
    }
    const next = [...digits];
    next[i] = clean;
    setDigits(next);
    if (clean && i < 5) boxes.current[i + 1]?.focus();
    if (next.every(Boolean)) void verify(next.join(""));
  };

  const journey: [typeof Package, string][] = [
    [Storefront, t("Order", "অর্ডার")],
    [Package, t("Packed", "প্যাক")],
    [Truck, t("Shipped", "পাঠানো")],
    [CheckCircle, t("Delivered", "ডেলিভারি")],
    [Wallet, t("Cash in", "টাকা হাতে")],
  ];

  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      {/* Story panel: the product's whole idea — an order's life after the sale. */}
      <aside className="relative hidden overflow-hidden bg-brand text-brand-contrast lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-[12px] bg-white/15">
            <Package className="size-6" weight="duotone" />
          </span>
          <span className="font-display text-xl font-semibold">BechaKena</span>
        </div>
        <div className="max-w-[520px]">
          <p className="font-display text-[44px] font-semibold leading-[1.05] tracking-[-0.02em]">{t("Every order, from the chat to the cash.", "চ্যাট থেকে টাকা পর্যন্ত, প্রতিটি অর্ডার।")}</p>
          <p className="mt-4 text-[17px] leading-relaxed text-brand-contrast/80">
            {t("Stock that updates itself, invoices in seconds, and you always know which parcel still owes you money.", "স্টক নিজে নিজে আপডেট হয়, ইনভয়েস হয় সেকেন্ডে, আর কোন পার্সেলের টাকা বাকি তা সবসময় জানা থাকে।")}
          </p>
          <ol className="mt-10 flex items-center" aria-label={t("An order's journey", "একটি অর্ডারের যাত্রা")}>
            {journey.map(([Icon, label], i) => (
              <li key={label} className="flex flex-1 items-center last:flex-none">
                <span className="flex flex-col items-center gap-2">
                  <span className={cn("grid size-11 place-items-center rounded-full", i === journey.length - 1 ? "bg-cash text-[#2b1a00]" : "bg-white/15")}>
                    <Icon className="size-5" weight="duotone" />
                  </span>
                  <span className="text-xs font-medium text-brand-contrast/85">{label}</span>
                </span>
                {i < journey.length - 1 && (
                  <svg className="mx-1 mb-6 h-2 flex-1" preserveAspectRatio="none" viewBox="0 0 100 8" aria-hidden>
                    <line x1="0" y1="4" x2="100" y2="4" stroke="currentColor" strokeOpacity="0.45" strokeWidth="2" strokeDasharray="6 6" vectorEffect="non-scaling-stroke" style={{ animation: "flow 1.4s linear infinite" }} />
                  </svg>
                )}
              </li>
            ))}
          </ol>
        </div>
        <p className="text-sm text-brand-contrast/70">{t("Made for Facebook, Instagram and WhatsApp sellers in Bangladesh.", "বাংলাদেশের ফেসবুক, ইনস্টাগ্রাম ও হোয়াটসঅ্যাপ বিক্রেতাদের জন্য।")}</p>
      </aside>

      <main className="flex flex-col px-5 py-6 sm:px-10">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2.5 lg:invisible">
            <span className="grid size-9 place-items-center rounded-[11px] bg-brand text-brand-contrast">
              <Package className="size-5" weight="duotone" />
            </span>
            <span className="font-display text-lg font-semibold">BechaKena</span>
          </span>
          <button type="button" onClick={() => setLang(lang === "en" ? "bn" : "en")} className="h-9 rounded-full px-3 text-[13px] font-medium text-ink-2 hover:bg-sunken">
            {lang === "en" ? "বাংলা" : "English"}
          </button>
        </div>

        <div className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center py-10">
          {step === "phone" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void sendCode();
              }}
            >
              <h1 className="font-display text-[30px] font-semibold leading-tight tracking-[-0.02em] text-ink">{t("Sign in or create your shop", "সাইন ইন করুন বা দোকান খুলুন")}</h1>
              <p className="mt-2 text-[15px] text-ink-3">{t("We'll text a 6-digit code to your phone. No password needed.", "আপনার ফোনে ৬ সংখ্যার কোড পাঠাব। পাসওয়ার্ড লাগবে না।")}</p>
              <label htmlFor="phone" className="mt-8 block text-[13px] font-medium text-ink-2">
                {t("Mobile number", "মোবাইল নম্বর")}
              </label>
              <div className={cn("mt-1.5 flex h-14 items-center overflow-hidden rounded-md border bg-surface transition-shadow focus-within:border-brand focus-within:shadow-[var(--ring)]", error ? "border-danger" : "border-line-strong")}>
                <span className="flex h-full items-center border-r border-line bg-surface-2 px-3.5 text-[15px] font-medium text-ink-2">+88</span>
                <input
                  id="phone"
                  autoFocus
                  inputMode="tel"
                  autoComplete="tel-national"
                  placeholder="017XXXXXXXX"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="tnum h-full flex-1 bg-transparent px-3.5 text-[18px] tracking-wide text-ink placeholder:text-ink-4 focus:outline-none"
                  aria-invalid={!!error}
                  aria-describedby={error ? "login-error" : undefined}
                />
                {normalized && <CheckCircle className="mr-3 size-5 text-ok" weight="fill" aria-hidden />}
              </div>
              {error && (
                <p id="login-error" className="mt-2 text-[13px] text-danger">
                  {error}
                </p>
              )}
              <Button type="submit" variant="primary" size="lg" className="mt-5 w-full" loading={busy} iconRight={<ArrowRight className="size-4" weight="bold" />}>
                {t("Send code", "কোড পাঠান")}
              </Button>
              <div className="my-6 flex items-center gap-3 text-xs text-ink-4">
                <span className="h-px flex-1 bg-line" />
                {t("or", "অথবা")}
                <span className="h-px flex-1 bg-line" />
              </div>
              <Button
                variant="secondary"
                size="lg"
                className="w-full"
                onClick={async () => {
                  const st = useStore.getState();
                  if (st.sync.mode === "account" || !st.seeded) await st.resetDemo();
                  router.push("/dashboard");
                }}
              >
                {t("Explore a demo shop first", "আগে ডেমো দোকান ঘুরে দেখুন")}
              </Button>
              <p className="mt-6 text-center text-xs leading-relaxed text-ink-4">{t("By continuing you agree to the Terms and Privacy Policy. Your customers' data belongs to you.", "চালিয়ে গেলে আপনি শর্তাবলী ও গোপনীয়তা নীতিতে সম্মত হচ্ছেন। কাস্টমারের তথ্য আপনার।")}</p>
            </form>
          )}

          {step === "code" && (
            <div>
              <button type="button" onClick={() => setStep("phone")} className="-ml-2 mb-6 inline-flex h-9 items-center gap-1.5 rounded-sm px-2 text-[13px] font-medium text-ink-2 hover:bg-sunken">
                <ArrowLeft className="size-4" />
                {t("Change number", "নম্বর বদলান")}
              </button>
              <h1 className="font-display text-[30px] font-semibold leading-tight tracking-[-0.02em] text-ink">{t("Enter the code", "কোডটি লিখুন")}</h1>
              <p className="mt-2 text-[15px] text-ink-3">
                {t("Sent to", "পাঠানো হয়েছে")} <b className="tnum font-semibold text-ink">{normalized}</b>
              </p>
              <div className="mt-8 flex justify-between gap-2" role="group" aria-label={t("6-digit code", "৬ সংখ্যার কোড")}>
                {digits.map((d, i) => (
                  <input
                    key={i}
                    ref={(el) => {
                      boxes.current[i] = el;
                    }}
                    inputMode="numeric"
                    autoComplete={i === 0 ? "one-time-code" : "off"}
                    aria-label={t(`Digit ${i + 1}`, `সংখ্যা ${i + 1}`)}
                    value={d}
                    disabled={busy}
                    onChange={(e) => setDigit(i, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Backspace" && !digits[i] && i > 0) boxes.current[i - 1]?.focus();
                    }}
                    className={cn(
                      "tnum h-14 w-full min-w-0 rounded-md border bg-surface text-center font-display text-2xl font-semibold text-ink transition-all focus:border-brand focus:shadow-[var(--ring)] focus:outline-none",
                      error ? "border-danger" : d ? "border-ink-4" : "border-line-strong",
                    )}
                  />
                ))}
              </div>
              {error && <p className="mt-3 text-[13px] text-danger">{error}</p>}
              {devCode && (
                <p className="mt-4 rounded-md bg-cash-soft px-3 py-2 text-[13px] text-cash-ink">
                  {t("Development mode — your code is", "ডেভেলপমেন্ট মোড — আপনার কোড")} <b className="tnum font-semibold">{devCode}</b>
                </p>
              )}
              <p className="mt-6 text-[13px] text-ink-3">
                {resendIn > 0 ? (
                  t(`You can ask for a new code in ${resendIn}s`, `${resendIn} সেকেন্ড পরে নতুন কোড চাইতে পারবেন`)
                ) : (
                  <button type="button" onClick={sendCode} className="font-semibold text-brand-ink hover:underline">
                    {t("Send a new code", "নতুন কোড পাঠান")}
                  </button>
                )}
              </p>
            </div>
          )}

          {step === "choose" && (
            <div>
              <h1 className="font-display text-[30px] font-semibold leading-tight tracking-[-0.02em] text-ink">{t("Which shop?", "কোন দোকান?")}</h1>
              <p className="mt-2 text-[15px] text-ink-3">{t("You can switch any time from the sidebar.", "সাইডবার থেকে যেকোনো সময় বদলানো যায়।")}</p>
              <ul className="mt-6 space-y-2">
                {businesses.map((b) => (
                  <li key={b.id}>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true);
                        await post("/api/businesses/switch", { businessId: b.id });
                        await enterAccount(userId);
                        router.replace("/dashboard");
                      }}
                      className="flex w-full items-center gap-3 rounded-lg border border-line bg-surface p-3.5 text-left shadow-1 transition-colors hover:border-brand"
                    >
                      {b.logo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={b.logo} alt="" className="size-10 rounded-md object-contain" />
                      ) : (
                        <BrandMark size={40} />
                      )}
                      <span className="flex-1">
                        <span className="block text-[15px] font-semibold text-ink">{b.name}</span>
                        <span className="block text-[13px] capitalize text-ink-3">{b.role}</span>
                      </span>
                      <ArrowRight className="size-4 text-ink-3" />
                    </button>
                  </li>
                ))}
              </ul>
              <Button variant="ghost" className="mt-4" onClick={() => router.push("/welcome")}>
                {t("Create another shop", "আরেকটি দোকান খুলুন")}
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
