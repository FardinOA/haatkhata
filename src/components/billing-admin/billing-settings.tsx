"use client";

import { ArrowSquareOut, Check, Copy, CreditCard, Crown, Gift, Receipt, ShareNetwork, Sparkle, WarningCircle } from "@phosphor-icons/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Badge, Button, cn, Input, Panel, Segmented, Skeleton } from "../ui/core";
import { Dialog, useToast } from "../ui/overlays";
import { useFmt, useT } from "@/lib/hooks";
import { useStore } from "@/lib/store";
import { effectivePlan, FEATURE_LABEL, PLAN_ORDER, PLANS, quote, type PlanId, type Term } from "@/server/billing/plans";
import { Card, Meter } from "./parts";
import { useUsage, type Usage } from "./usage-client";

const METHOD_META: Record<string, { en: string; bn: string; color: string; note: string }> = {
  bkash: { en: "bKash", bn: "বিকাশ", color: "var(--color-bkash)", note: "Pay from your bKash app" },
  nagad: { en: "Nagad", bn: "নগদ", color: "var(--color-nagad)", note: "Through SSLCommerz" },
  card: { en: "Card", bn: "কার্ড", color: "var(--ink-2)", note: "Visa, Mastercard, Amex" },
};

export function BillingSettings() {
  const t = useT();
  const f = useFmt();
  const toast = useToast();
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  const { data, error, reload } = useUsage();
  const [term, setTerm] = useState<Term>("year");
  const [paying, setPaying] = useState<PlanId | null>(null);

  // Coming back from a gateway.
  const result = params.get("payment");
  const handled = useRef<string | null>(null);
  useEffect(() => {
    if (!result || handled.current === result) return;
    handled.current = result;
    if (result === "success") toast({ title: t("Payment received — your plan is active", "পেমেন্ট হয়েছে — প্ল্যান চালু"), body: t("The receipt is in your billing history.", "রসিদ বিলিং ইতিহাসে আছে।") });
    else if (result === "cancelled") toast({ tone: "info", title: t("Payment cancelled — nothing was charged", "পেমেন্ট বাতিল — কোনো টাকা কাটা হয়নি") });
    else toast({ tone: "warn", title: t("The payment didn't go through", "পেমেন্ট সম্পন্ন হয়নি"), body: t("No money was taken. Try again or use another method.", "কোনো টাকা কাটা হয়নি। আবার চেষ্টা করুন বা অন্য মাধ্যম ব্যবহার করুন।") });
    reload();
    router.replace(`${path}?tab=plan`, { scroll: false });
  }, [result, toast, t, reload, router, path]);

  if (!data)
    return error ? (
      <Panel className="p-6 text-sm text-danger">{error}</Panel>
    ) : (
      <div className="space-y-4">
        <Skeleton className="h-44 rounded-lg" />
        <Skeleton className="h-80 rounded-lg" />
      </div>
    );

  const current = effectivePlan(data.effective);
  return (
    <div className="space-y-5">
      <CurrentPlan data={data} />

      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <h3 className="font-display text-lg font-semibold text-ink">{t("Plans", "প্ল্যান")}</h3>
        <Segmented<Term>
          size="sm"
          value={term}
          onChange={setTerm}
          ariaLabel={t("Billing period", "বিলিং সময়কাল")}
          options={[
            { value: "month", label: t("Monthly", "মাসিক") },
            { value: "quarter", label: t("3 months", "৩ মাস") },
            { value: "year", label: t("Yearly · 2 months off", "বার্ষিক · ২ মাস ছাড়") },
          ]}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {PLAN_ORDER.map((id) => {
          const p = PLANS[id];
          const q = quote(id, term, data.vatPct);
          const isCurrent = data.plan === id;
          const prev = PLAN_ORDER.indexOf(id) > 0 ? PLANS[PLAN_ORDER[PLAN_ORDER.indexOf(id) - 1]] : null;
          const extra = p.features.filter((x) => !prev?.features.includes(x));
          const higher = current.id === "expired" || PLAN_ORDER.indexOf(id) > PLAN_ORDER.indexOf(current.id);
          const featured = id === "business";
          return (
            <div key={id} className={cn("relative flex flex-col rounded-lg border bg-surface p-5", isCurrent ? "border-brand shadow-[var(--ring)]" : featured ? "border-brand-200 shadow-2" : "border-line shadow-1")}>
              {featured && !isCurrent && <Badge tone="brand" className="absolute right-4 top-4">{t("Most sellers", "বেশিরভাগ বিক্রেতা")}</Badge>}
              {isCurrent && <Badge tone="ok" className="absolute right-4 top-4">{t("Current", "বর্তমান")}</Badge>}
              <p className="text-sm font-semibold text-ink">{t(p.name, p.nameBn)}</p>
              <p className="text-xs text-ink-3">{t(p.blurb, p.blurbBn)}</p>
              <p className="figure mt-3 text-[30px] font-semibold leading-none text-ink">
                {f.money(term === "month" ? p.monthly : q.total)}
                <span className="font-sans text-[13px] font-normal text-ink-3">/{term === "month" ? t("month", "মাস") : term === "quarter" ? t("3 months", "৩ মাস") : t("year", "বছর")}</span>
              </p>
              <p className="mt-1 h-4 text-xs text-ok">{q.saved > 0 ? t(`You save ${f.money(q.saved)}`, `${f.money(q.saved)} সাশ্রয়`) : ""}</p>
              <ul className="mt-4 flex-1 space-y-2 text-[13px] text-ink-2">
                <Li>{t(`${p.limits.ordersPerMonth.toLocaleString("en-IN")} orders a month`, `মাসে ${f.num(p.limits.ordersPerMonth)} অর্ডার`)}</Li>
                <Li>
                  {Number.isFinite(p.limits.products) ? t(`${p.limits.products} products`, `${f.num(p.limits.products)} পণ্য`) : t("Unlimited products", "সীমাহীন পণ্য")} ·{" "}
                  {Number.isFinite(p.limits.staff) ? t(`${p.limits.staff} ${p.limits.staff === 1 ? "user" : "users"}`, `${f.num(p.limits.staff)} জন`) : t("unlimited team", "সীমাহীন টিম")}
                </Li>
                {prev && prev.features.length > 0 && <li className="pt-1 text-xs font-medium text-ink-3">{t(`Everything in ${prev.name}, plus`, `${prev.nameBn} এর সবকিছু, সাথে`)}</li>}
                {extra.map((x) => (
                  <Li key={x}>{t(...FEATURE_LABEL[x])}</Li>
                ))}
              </ul>
              <Button
                className="mt-5"
                variant={higher ? "primary" : "secondary"}
                disabled={data.demo || !data.canPay}
                onClick={() => setPaying(id)}
              >
                {isCurrent
                    ? t("Renew", "নবায়ন")
                    : current.id === "expired"
                      ? t(`Start ${p.name}`, `${p.nameBn} শুরু করুন`)
                      : higher
                      ? t(`Upgrade to ${p.name}`, `${p.nameBn} এ যান`)
                      : t(`Switch to ${p.name}`, `${p.nameBn} এ যান`)}
              </Button>
            </div>
          );
        })}
      </div>
      <p className="text-[13px] text-ink-3">
        {data.demo
          ? t("This is the demo shop. Create your own shop to subscribe.", "এটি ডেমো দোকান। সাবস্ক্রাইব করতে নিজের দোকান খুলুন।")
          : !data.canPay
            ? t("Only the owner can change the plan.", "শুধু মালিক প্ল্যান বদলাতে পারেন।")
            : t(`Prices include ${data.vatPct}% VAT. No setup fee. If your plan ends, nothing is deleted — you can always read and export.`, `দামে ${data.vatPct}% ভ্যাট আছে। কোনো সেটআপ ফি নেই। প্ল্যান শেষ হলেও কিছু মুছে যায় না — সবসময় দেখা ও এক্সপোর্ট করা যায়।`)}
      </p>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]">
        <History data={data} />
        <Referral data={data} onApplied={reload} />
      </div>

      {paying && <Checkout plan={paying} term={term} data={data} onClose={() => setPaying(null)} onTermChange={setTerm} />}
    </div>
  );
}

function Li({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2">
      <Check className="mt-0.5 size-4 shrink-0 text-ok" weight="bold" />
      <span>{children}</span>
    </li>
  );
}

/* ------------------------------------------------------------ current plan */

function CurrentPlan({ data }: { data: Usage }) {
  const t = useT();
  const f = useFmt();
  const plan = effectivePlan(data.effective);
  const expired = data.plan === "expired";
  const hot = !expired && Object.values(data.usage).some((m) => m.level !== "ok");
  const status = data.trial
    ? t(`Trial · ${data.trial.daysLeft} days left`, `ট্রায়াল · আর ${f.num(data.trial.daysLeft)} দিন`)
    : expired
      ? t("New orders and printing are paused", "নতুন অর্ডার ও প্রিন্ট বন্ধ")
      : data.daysLeft !== null && data.daysLeft < 0
        ? t("Renewal overdue", "নবায়নের সময় পেরিয়েছে")
        : data.renewsAt
          ? t(`Active until ${f.date(data.renewsAt)}`, `${f.date(data.renewsAt)} পর্যন্ত চালু`)
          : t("Active", "চালু");
  return (
    <Panel className="overflow-hidden">
      <div className="grid gap-6 bg-brand-50 px-5 py-5 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)]">
        <div>
          <p className="flex items-center gap-2 text-[13px] font-medium text-brand-ink">
            <Crown className="size-4" weight="fill" />
            {t("Your plan", "আপনার প্ল্যান")}
          </p>
          <p className="mt-1 font-display text-[26px] font-semibold leading-tight text-ink">{data.planName}</p>
          <p className="mt-1 text-[13px] text-ink-2">
            {status}
            {plan.monthly > 0 && !data.trial && (
              <>
                {" · "}
                {f.money(plan.monthly)}/{t("month", "মাস")}
              </>
            )}
          </p>
        </div>
        <div className="grid content-center gap-4 sm:grid-cols-3">
          <Meter label={t("Orders this month", "এই মাসের অর্ডার")} used={data.usage.orders.used} limit={data.usage.orders.limit} format={f.num} />
          <Meter label={t("Products", "পণ্য")} used={data.usage.products.used} limit={data.usage.products.limit} format={f.num} />
          <Meter label={t("Team", "টিম")} used={data.usage.staff.used} limit={data.usage.staff.limit} format={f.num} />
        </div>
      </div>
      {(data.trial && data.trial.daysLeft <= 7) || hot || expired ? (
        <div className={cn("flex items-start gap-2.5 border-t border-line px-5 py-3 text-[13px]", expired || Object.values(data.usage).some((m) => m.level === "full") ? "bg-danger-soft text-danger" : "bg-cash-soft text-cash-ink")}>
          <WarningCircle className="mt-0.5 size-4 shrink-0" weight="fill" />
          <span>
            {expired
              ? t("Your shop has no active plan. Pick one below to take new orders and print invoices again — everything you already have stays readable and exportable.", "আপনার দোকানে কোনো চালু প্ল্যান নেই। নতুন অর্ডার ও ইনভয়েস প্রিন্ট আবার চালু করতে নিচে একটি প্ল্যান বাছুন — আগের সবকিছু দেখা ও এক্সপোর্ট করা যাবে।")
              : Object.values(data.usage).some((m) => m.level === "full")
              ? t("You've reached a limit. New orders or products are paused until you upgrade — everything you already have stays readable, printable and exportable.", "একটি সীমা পূর্ণ হয়েছে। আপগ্রেড না করা পর্যন্ত নতুন অর্ডার/পণ্য বন্ধ — আগের সবকিছু দেখা, প্রিন্ট ও এক্সপোর্ট করা যাবে।")
              : hot
                ? t("You've used 80% of a limit this month. Upgrade before you run out.", "এই মাসে একটি সীমার ৮০% ব্যবহার হয়েছে। শেষ হওয়ার আগে আপগ্রেড করুন।")
                : t(`Your trial ends in ${data.trial!.daysLeft} days. After that, new orders are paused until you pick a plan — no data is lost.`, `আর ${f.num(data.trial!.daysLeft)} দিনে ট্রায়াল শেষ। এরপর প্ল্যান না নেওয়া পর্যন্ত নতুন অর্ডার বন্ধ থাকবে — কোনো তথ্য হারাবে না।`)}
          </span>
        </div>
      ) : null}
    </Panel>
  );
}

/* ------------------------------------------------------------ checkout */

function Checkout({ plan, term, data, onClose, onTermChange }: { plan: PlanId; term: Term; data: Usage; onClose: () => void; onTermChange: (t: Term) => void }) {
  const t = useT();
  const f = useFmt();
  const toast = useToast();
  const methods = data.methods.length ? data.methods : [{ method: "bkash", gateway: "sandbox" }];
  const [method, setMethod] = useState(methods[0].method);
  const [busy, setBusy] = useState(false);
  const q = quote(plan, term, data.vatPct);
  const gateway = methods.find((m) => m.method === method)?.gateway;

  const pay = async () => {
    setBusy(true);
    try {
      const r = await fetch("/api/billing/checkout", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ plan, term, method }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Couldn't start the payment");
      window.location.assign(d.redirectUrl);
    } catch (e) {
      toast({ tone: "warn", title: (e as Error).message });
      setBusy(false);
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      width={480}
      title={t(`${q.plan.name} plan`, `${q.plan.nameBn} প্ল্যান`)}
      tone="brand"
      icon={<CreditCard weight="fill" />}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t("Cancel", "বাতিল")}
          </Button>
          <Button variant="primary" loading={busy} onClick={pay}>
            {t(`Pay ${f.money(q.total)}`, `${f.money(q.total)} পরিশোধ করুন`)}
          </Button>
        </>
      }
    >
      <Segmented<Term>
        size="sm"
        className="mt-2 w-full"
        value={term}
        onChange={onTermChange}
        options={[
          { value: "month", label: t("1 month", "১ মাস") },
          { value: "quarter", label: t("3 months", "৩ মাস") },
          { value: "year", label: t("12 months", "১২ মাস") },
        ]}
      />
      <p className="mb-2 mt-4 text-[13px] font-medium text-ink-2">{t("Pay with", "পরিশোধের মাধ্যম")}</p>
      <div role="radiogroup" className="grid grid-cols-3 gap-2">
        {methods.map((m) => {
          const meta = METHOD_META[m.method] ?? { en: m.method, bn: m.method, color: "var(--ink-3)", note: "" };
          return (
            <button key={m.method} type="button" role="radio" aria-checked={method === m.method} onClick={() => setMethod(m.method)} className={cn("flex h-16 flex-col items-center justify-center gap-1 rounded-md border text-[13px] font-semibold transition-all", method === m.method ? "border-brand shadow-[var(--ring)]" : "border-line hover:border-line-strong")}>
              <span className="size-2.5 rounded-full" style={{ background: meta.color }} />
              {t(meta.en, meta.bn)}
            </button>
          );
        })}
      </div>
      <dl className="mt-5 space-y-1.5 rounded-md bg-surface-2 px-4 py-3 text-[13px]">
        <div className="flex justify-between">
          <dt className="text-ink-2">{t(`${q.plan.name} · ${q.months} months`, `${q.plan.nameBn} · ${f.num(q.months)} মাস`)}</dt>
          <dd className="tnum text-ink">{f.money(Math.round(q.net))}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-ink-3">{t(`VAT ${q.vatPct}%`, `ভ্যাট ${f.num(q.vatPct)}%`)}</dt>
          <dd className="tnum text-ink-3">{f.money(Math.round(q.vatAmount))}</dd>
        </div>
        {data.referral.credits > 0 && (
          <div className="flex justify-between text-ok">
            <dt>{t(`+ ${data.referral.credits} bonus month${data.referral.credits > 1 ? "s" : ""} from referrals`, `+ রেফারেলের ${f.num(data.referral.credits)} বোনাস মাস`)}</dt>
            <dd>{t("Included", "যুক্ত")}</dd>
          </div>
        )}
        <div className="flex justify-between border-t border-line pt-2 text-[15px] font-semibold">
          <dt className="text-ink">{t("Total", "মোট")}</dt>
          <dd className="tnum text-ink">{f.money(q.total)}</dd>
        </div>
      </dl>
      <p className="mt-3 text-xs text-ink-3">
        {gateway === "sandbox"
          ? t("Test mode: you'll see a sandbox checkout — no real money moves.", "টেস্ট মোড: স্যান্ডবক্স পেমেন্ট পেজ দেখাবে — আসল টাকা কাটবে না।")
          : t("You'll finish paying securely on the payment page, then come straight back here.", "পেমেন্ট পেজে নিরাপদে পরিশোধ শেষে এখানে ফিরবেন।")}
      </p>
    </Dialog>
  );
}

/* ------------------------------------------------------------ history */

function History({ data }: { data: Usage }) {
  const t = useT();
  const f = useFmt();
  const statusTone = { paid: "ok", pending: "neutral", failed: "danger", cancelled: "neutral" } as const;
  return (
    <Card title={t("Billing history", "বিলিং ইতিহাস")} sub={t("VAT receipts for every payment", "প্রতিটি পেমেন্টের ভ্যাট রসিদ")}>
      {data.payments.length === 0 ? (
        <div className="flex flex-col items-center py-6 text-center">
          <Receipt className="size-8 text-ink-4" />
          <p className="mt-2 text-sm text-ink-3">{t("No payments yet. Receipts appear here after you subscribe.", "এখনো কোনো পেমেন্ট নেই। সাবস্ক্রাইব করার পর রসিদ এখানে দেখাবে।")}</p>
        </div>
      ) : (
        <ul className="-my-2 divide-y divide-line">
          {data.payments.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink">
                  {PLANS[p.plan as PlanId]?.name ?? p.plan} · {t(`${p.months} mo`, `${f.num(p.months)} মাস`)}
                  {p.creditMonths > 0 && <span className="text-ok"> + {t(`${p.creditMonths} bonus`, `${f.num(p.creditMonths)} বোনাস`)}</span>}
                </p>
                <p className="text-xs text-ink-3">
                  {f.date(p.paidAt ?? p.createdAt)} · {p.method}
                  {p.invoiceNo && ` · ${p.invoiceNo}`}
                </p>
              </div>
              <Badge tone={statusTone[p.status as keyof typeof statusTone] ?? "neutral"}>{p.status}</Badge>
              <span className="tnum w-20 text-right text-sm font-semibold text-ink">{f.money(p.amount)}</span>
              {p.status === "paid" ? (
                <a href={`/api/billing/receipt/${p.id}`} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1 rounded-sm px-2 text-[13px] font-medium text-brand-ink hover:bg-brand-50">
                  {t("Receipt", "রসিদ")}
                  <ArrowSquareOut className="size-3.5" />
                </a>
              ) : (
                <span className="w-[76px]" />
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------ referral */

function Referral({ data, onApplied }: { data: Usage; onApplied: () => void }) {
  const t = useT();
  const f = useFmt();
  const toast = useToast();
  const businessName = useStore((s) => s.business.name);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const link = typeof window !== "undefined" && data.referral.code ? `${window.location.origin}/login?ref=${data.referral.code}` : "";
  const message = t(
    `I run ${businessName} on BechaKena — stock, orders and invoices in one place. Use my code ${data.referral.code} and we both get a bonus month: ${link}`,
    `আমি ${businessName} চালাই বেচাকেনা দিয়ে — স্টক, অর্ডার আর ইনভয়েস এক জায়গায়। আমার কোড ${data.referral.code} দিলে দুজনেই এক মাস বোনাস পাব: ${link}`,
  );
  return (
    <Card title={t("Invite a seller, get a bonus month", "বিক্রেতা আনুন, এক মাস বোনাস নিন")} sub={t("When they pay for their first month, you both get one month added to your plan.", "তারা প্রথম মাসের টাকা দিলে দুজনের প্ল্যানেই এক মাস যোগ হবে।")} aside={<Gift className="size-6 text-cash" weight="duotone" />}>
      <div className="flex items-center gap-2">
        <span className="tnum flex h-11 flex-1 items-center rounded-md border border-dashed border-line-strong bg-surface-2 px-4 font-display text-lg font-semibold tracking-[0.12em] text-ink">{data.referral.code ?? "—"}</span>
        <Button
          variant="secondary"
          icon={<Copy className="size-4" />}
          disabled={!link}
          onClick={async () => {
            await navigator.clipboard?.writeText(message).catch(() => {});
            toast({ title: t("Invite message copied", "আমন্ত্রণ বার্তা কপি হয়েছে") });
          }}
        >
          {t("Copy", "কপি")}
        </Button>
        <a href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer" aria-label={t("Share on WhatsApp", "হোয়াটসঅ্যাপে শেয়ার")} className="grid size-11 place-items-center rounded-md border border-line text-[#1FA855] hover:bg-surface-2">
          <ShareNetwork className="size-5" />
        </a>
      </div>
      <p className="mt-3 flex items-center gap-1.5 text-[13px] text-ink-2">
        <Sparkle className="size-4 text-cash" weight="fill" />
        {data.referral.credits > 0 ? t(`${data.referral.credits} bonus month${data.referral.credits > 1 ? "s" : ""} waiting — added to your next payment.`, `${f.num(data.referral.credits)} বোনাস মাস অপেক্ষায় — পরের পেমেন্টে যোগ হবে।`) : t("No bonus months yet.", "এখনো কোনো বোনাস মাস নেই।")}
      </p>
      {!data.referral.referredBy && !data.demo && data.canPay && (
        <form
          className="mt-4 flex gap-2 border-t border-line pt-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            const r = await fetch("/api/billing/referral", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code }) });
            const d = await r.json().catch(() => ({}));
            setBusy(false);
            if (!r.ok) return toast({ tone: "warn", title: d.error ?? "Couldn't apply the code" });
            toast({ title: t(`Code from ${d.referrer} added`, `${d.referrer} এর কোড যোগ হয়েছে`), body: t("You'll both get a bonus month after your first payment.", "প্রথম পেমেন্টের পর দুজনেই এক মাস বোনাস পাবেন।") });
            setCode("");
            onApplied();
          }}
        >
          <Input inputSize="sm" placeholder={t("Got a friend's code?", "বন্ধুর কোড আছে?")} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} aria-label={t("Referral code", "রেফারেল কোড")} className="flex-1" />
          <Button size="sm" type="submit" loading={busy} disabled={code.trim().length < 4}>
            {t("Apply", "যোগ করুন")}
          </Button>
        </form>
      )}
    </Card>
  );
}
