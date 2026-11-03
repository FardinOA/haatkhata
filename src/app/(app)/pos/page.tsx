"use client";

import { CaretUp, Copy, Lightning, X } from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Composer, type ComposerHandle } from "@/components/pos/composer";
import { ProductFinder } from "@/components/pos/product-finder";
import { OrderSuccess } from "@/components/pos/success";
import { draftFromCustomer, draftFromOrder, PosContext, usePosState } from "@/components/pos/use-pos";
import { Button, Kbd } from "@/components/ui/core";
import { Dialog, Sheet, useToast } from "@/components/ui/overlays";
import { normalizePhone } from "@/lib/domain";
import { useFmt, useHotkey, useMediaQuery, useT } from "@/lib/hooks";
import { useStore } from "@/lib/store";
import type { Order } from "@/lib/types";

export default function PosPage() {
  const t = useT();
  const f = useFmt();
  const toast = useToast();
  const api = usePosState();
  const { draft, totals, stockBlocked, normalized, reset } = api;
  const createOrder = useStore((s) => s.createOrder);
  const plan = useStore((s) => s.plan);
  const monthOrders = useStore((s) => {
    const now = new Date();
    return s.orders.filter((o) => {
      const d = new Date(o.createdAt);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() && o.status !== "draft";
    }).length;
  });
  const desktop = useMediaQuery("(min-width: 1024px)");
  const searchRef = useRef<HTMLInputElement>(null);
  const composerRef = useRef<ComposerHandle>(null);
  const [sheet, setSheet] = useState(false);
  const [done, setDone] = useState<Order | null>(null);
  const [limitHit, setLimitHit] = useState(false);

  /* ---- Arrivals from other screens: ?customer=<id> and ?duplicate=<orderId> */
  const search = useSearchParams();
  const router = useRouter();
  const customers = useStore((s) => s.customers);
  const orders = useStore((s) => s.orders);
  const products = useStore((s) => s.products);
  const pos = useStore((s) => s.pos);
  const custParam = search.get("customer");
  const dupParam = search.get("duplicate");
  const parkedParam = search.get("parked");
  const incoming = custParam ? `c:${custParam}` : dupParam ? `d:${dupParam}` : parkedParam ? `p:${parkedParam}` : null;
  const [handled, setHandled] = useState<string | null>(null);
  const [copied, setCopied] = useState<{ no: number; skipped: number } | null>(null);
  // Applied during render (not in an effect) so the cart never flashes empty.
  if (incoming !== handled) {
    setHandled(incoming);
    if (custParam) {
      const c = customers.find((x) => x.id === custParam);
      if (c) {
        api.setDraft(draftFromCustomer(c, pos.deliveryPresets, pos.defaultSettlement));
        setCopied(null);
      }
    } else if (dupParam) {
      const o = orders.find((x) => x.id === dupParam);
      if (o) {
        const { draft: d, skipped } = draftFromOrder(o, products, pos.deliveryPresets, pos.allowNegativeStock);
        api.setDraft(d);
        setCopied({ no: o.no, skipped });
      }
    }
  }
  // ?parked=<id> (e.g. "Create order from this chat" in the inbox): open that parked cart.
  // Unparking updates the shared store, so it happens after render.
  const unpark = useStore((s) => s.unpark);
  const { setDraft } = api;
  useEffect(() => {
    if (!parkedParam) return;
    const got = unpark(parkedParam);
    if (got)
      setDraft((d) => ({ ...d, lines: got.lines, channel: got.channel, name: got.customer?.name ?? "", phone: got.customer?.phone ?? "", address: got.customer?.address ?? d.address }));
  }, [parkedParam, unpark, setDraft]);
  // Drop the param so a refresh doesn't apply it again.
  useEffect(() => {
    if (incoming) router.replace("/pos", { scroll: false });
  }, [incoming, router]);

  const submit = useCallback(
    (mode: "draft" | "confirm" | "complete", print = false) => {
      if (!draft.lines.length) return;
      if (mode !== "draft") {
        if (stockBlocked) {
          toast({ title: t("Some items are short on stock", "কিছু পণ্যের স্টক কম"), body: t("Lower the quantities marked in red.", "লাল চিহ্নিত পরিমাণ কমান।"), tone: "warn" });
          return;
        }
        // SRS FR-SUB-02 / AC-6: block new orders at the plan limit, never existing data.
        if (monthOrders >= plan.orderLimit) {
          setLimitHit(true);
          return;
        }
      }
      const phone = normalizePhone(draft.phone);
      const order = createOrder(
        {
          channel: draft.channel,
          customer: phone ? { id: draft.customerId, name: draft.name.trim() || t("Customer", "কাস্টমার"), phone, address: draft.channel === "walkin" ? undefined : draft.address } : null,
          lines: draft.lines,
          discount: draft.discount,
          deliveryCharge: draft.deliveryCharge,
          otherCharges: draft.otherCharges,
          payments: draft.payments.filter((p) => p.amount > 0).map((p) => ({ method: p.method, amount: p.amount, txnId: p.txnId || undefined, kind: draft.channel === "walkin" ? ("payment" as const) : ("advance" as const) })),
          settlement: draft.settlement,
          notesInvoice: draft.notesInvoice || undefined,
          notesInternal: draft.notesInternal || undefined,
        },
        mode,
      );
      setSheet(false);
      setDone(order);
      if (print && mode !== "draft") window.open(`/invoice/${order.id}?print=1`, "_blank", "noopener");
    },
    [draft, stockBlocked, monthOrders, plan.orderLimit, createOrder, toast, t],
  );

  const next = useCallback(() => {
    setDone(null);
    setCopied(null);
    reset();
    setTimeout(() => searchRef.current?.focus(), 60);
  }, [reset]);

  const walkin = draft.channel === "walkin";
  const canConfirm = draft.lines.length > 0 && !stockBlocked && (walkin || (!!normalized && !!draft.name.trim()));

  useHotkey("F2", (e) => {
    e.preventDefault();
    searchRef.current?.focus();
    searchRef.current?.select();
  });
  useHotkey("F4", (e) => {
    e.preventDefault();
    if (!desktop) setSheet(true);
    setTimeout(() => composerRef.current?.focusPhone(), desktop ? 0 : 320);
  });
  useHotkey("F8", (e) => {
    e.preventDefault();
    if (!desktop) setSheet(true);
    setTimeout(() => composerRef.current?.focusPayment(), desktop ? 0 : 320);
  });
  useHotkey("F9", (e) => {
    e.preventDefault();
    if (canConfirm) submit(walkin ? "complete" : "confirm", true);
  });

  return (
    <PosContext.Provider value={api}>
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(400px,440px)]">
        <div className="min-w-0 px-4 pb-32 pt-3 md:px-8 md:pt-5 lg:pb-12">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-x-6 gap-y-1">
            <div>
              <h1 className="font-display text-[26px] font-semibold leading-tight tracking-[-0.02em] text-ink md:text-[30px]">{t("Sell", "বিক্রি করুন")}</h1>
              <p className="mt-0.5 text-sm text-ink-3">{t("Pick products, add the customer, confirm. Stock updates itself.", "পণ্য বাছুন, কাস্টমার দিন, নিশ্চিত করুন। স্টক নিজেই আপডেট হবে।")}</p>
            </div>
            <p className="hidden items-center gap-3 text-xs text-ink-3 xl:flex">
              <span className="flex items-center gap-1.5">
                <Kbd>F2</Kbd> {t("search", "খুঁজুন")}
              </span>
              <span className="flex items-center gap-1.5">
                <Kbd>F4</Kbd> {t("customer", "কাস্টমার")}
              </span>
              <span className="flex items-center gap-1.5">
                <Kbd>F8</Kbd> {t("payment", "পেমেন্ট")}
              </span>
              <span className="flex items-center gap-1.5">
                <Kbd>F9</Kbd> {t("confirm & print", "নিশ্চিত ও প্রিন্ট")}
              </span>
            </p>
          </div>
          {copied && (
            <div className="mb-3 flex items-center gap-3 rounded-md border border-brand-100 bg-brand-50 px-3.5 py-2.5 text-[13px] text-brand-ink" role="status">
              <Copy className="size-4 shrink-0" />
              <span className="min-w-0 flex-1">
                {t(`Copied from order #${copied.no}`, `অর্ডার #${f.digits(String(copied.no))} থেকে কপি`)}
                {copied.skipped > 0 && (
                  <span className="text-ink-3">
                    {" "}
                    · {t(`${copied.skipped} item(s) changed — not in stock or no longer sold`, `${f.num(copied.skipped)}টি পণ্য বদলেছে — স্টকে নেই বা আর বিক্রি হয় না`)}
                  </span>
                )}
              </span>
              <button type="button" onClick={() => setCopied(null)} className="grid size-7 place-items-center rounded-full hover:bg-brand-100" aria-label={t("Dismiss", "বন্ধ করুন")}>
                <X className="size-3.5" />
              </button>
            </div>
          )}
          <ProductFinder ref={searchRef} />
        </div>

        {desktop && (
          <aside className="sticky top-16 h-[calc(100dvh-64px)] border-l border-line bg-surface" aria-label={t("Order", "অর্ডার")}>
            <Composer ref={composerRef} onSubmit={submit} className="h-full" />
          </aside>
        )}
      </div>

      {!desktop && (
        <>
          <div className="fixed inset-x-3 bottom-[calc(76px+env(safe-area-inset-bottom))] z-30 md:bottom-5 md:left-auto md:right-6 md:w-[380px]">
            <button
              type="button"
              onClick={() => setSheet(true)}
              className="flex h-14 w-full items-center gap-3 rounded-xl bg-ink pl-4 pr-3 text-white shadow-3 transition-transform active:scale-[0.99]"
              aria-label={t("Open cart", "কার্ট খুলুন")}
            >
              <span className="tnum grid size-8 place-items-center rounded-full bg-white/15 text-sm font-semibold">{f.num(totals.units)}</span>
              <span className="min-w-0 flex-1 text-left">
                <span className="block text-[13px] text-white/70">{draft.name.trim() || (walkin ? t("Walk-in sale", "দোকানে বিক্রি") : t("New order", "নতুন অর্ডার"))}</span>
                <span className="figure block text-lg font-semibold leading-tight">{f.money(draft.lines.length ? totals.total : 0)}</span>
              </span>
              <span className="flex h-10 items-center gap-1.5 rounded-lg bg-brand px-3.5 text-sm font-semibold text-brand-contrast">
                {t("Review", "দেখুন")}
                <CaretUp className="size-4" weight="bold" />
              </span>
            </button>
          </div>
          <Sheet open={sheet} onClose={() => setSheet(false)} title={t("Order", "অর্ডার")} sub={draft.lines.length ? t(`${totals.units} items`, `${f.num(totals.units)}টি পণ্য`) : undefined} width={460}>
            <Composer ref={composerRef} onSubmit={submit} inSheet className="h-full" />
          </Sheet>
        </>
      )}

      <OrderSuccess order={done} onNew={next} />

      <Dialog
        open={limitHit}
        onClose={() => setLimitHit(false)}
        tone="cash"
        icon={<Lightning weight="fill" />}
        title={t(`You've used all ${plan.orderLimit} orders this month`, `এই মাসের ${f.num(plan.orderLimit)}টি অর্ডার শেষ`)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setLimitHit(false)}>
              {t("Not now", "এখন না")}
            </Button>
            <Link href="/settings?tab=plan" className="inline-flex h-10 items-center rounded-md bg-brand px-4 text-sm font-medium text-brand-contrast">
              {t("See plans", "প্ল্যান দেখুন")}
            </Link>
          </>
        }
      >
        {t("Your orders, invoices and reports stay open — upgrade to keep taking new orders.", "আগের অর্ডার, ইনভয়েস ও রিপোর্ট খোলা থাকবে — নতুন অর্ডার নিতে প্ল্যান আপগ্রেড করুন।")}
      </Dialog>
    </PosContext.Provider>
  );
}
