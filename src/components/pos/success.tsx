"use client";

import { Printer, ShareNetwork, Sticker, Plus, ListBullets } from "@phosphor-icons/react";
import { AnimatePresence, m } from "motion/react";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Button, cn } from "@/components/ui/core";
import { useDevicePaperName, usePrint } from "@/components/invoice/print-dialog";
import { useFmt, useT } from "@/lib/hooks";
import { orderTotals } from "@/lib/store";
import type { Order } from "@/lib/types";

/**
 * Shown after an order is saved. The ticket drops in like a printed slip,
 * with the next actions a seller takes: print, share to Messenger, label.
 */
export function OrderSuccess({ order, onNew }: { order: Order | null; onNew: () => void }) {
  const t = useT();
  const f = useFmt();
  const ref = useRef<HTMLDivElement>(null);
  const tot = order ? orderTotals(order) : null;
  const draft = order?.status === "draft";
  const walkin = order?.channel === "walkin";
  const printing = usePrint();
  const paperName = useDevicePaperName("invoice");
  const choosing = printing.isOpen;

  useEffect(() => {
    // The paper chooser handles its own keys while it's open.
    if (!order || choosing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Enter") {
        e.preventDefault();
        onNew();
      }
    };
    document.addEventListener("keydown", onKey);
    setTimeout(() => ref.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus(), 50);
    return () => document.removeEventListener("keydown", onKey);
  }, [order, onNew, choosing]);

  if (typeof document === "undefined") return null;
  const open = (path: string) => window.open(path, "_blank", "noopener");

  return createPortal(
    <>
      <AnimatePresence>
        {order && tot && (
          <div className="fixed inset-0 z-50 grid place-items-center p-4">
            <m.div className="absolute inset-0 bg-[rgb(22_24_26/0.4)] backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onNew} />
            <m.div
              ref={ref}
              role="dialog"
              aria-modal="true"
              aria-label={t("Order saved", "অর্ডার সেভ হয়েছে")}
              className="relative w-full max-w-[400px]"
              initial={{ y: -40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
            >
              <div className="receipt-edge rounded-t-xl bg-surface px-6 pb-9 pt-7 shadow-3">
                <div className="flex flex-col items-center text-center">
                  <svg viewBox="0 0 56 56" className="size-14" aria-hidden>
                    <m.circle
                      cx="28"
                      cy="28"
                      r="26"
                      fill="var(--brand-50)"
                      stroke="var(--brand)"
                      strokeWidth="2"
                      initial={{ scale: 0.6, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{
                        delay: 0.1,
                        type: "spring",
                        stiffness: 300,
                        damping: 18,
                      }}
                      style={{ originX: "50%", originY: "50%" }}
                    />
                    <m.path
                      d="M17 29l7 7 15-16"
                      fill="none"
                      stroke="var(--brand)"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{
                        delay: 0.25,
                        duration: 0.35,
                        ease: "easeOut",
                      }}
                    />
                  </svg>
                  <p className="mt-4 text-sm text-ink-3">
                    {draft ? t("Draft saved", "খসড়া সেভ হয়েছে") : walkin ? t("Sale complete", "বিক্রি সম্পন্ন") : t("Order confirmed", "অর্ডার নিশ্চিত হয়েছে")}
                  </p>
                  <p className="mt-1 font-display text-[26px] font-semibold tracking-[-0.02em] text-ink">#{f.digits(String(order.no))}</p>
                  {order.invoiceNo && <p className="tnum text-xs text-ink-4">{f.digits(order.invoiceNo)}</p>}
                </div>

                <div className="mt-5 border-t border-dashed border-line-strong pt-4">
                  <div className="flex items-baseline justify-between">
                    <span className="text-[13px] text-ink-3">{order.customer?.name ?? t("Walk-in customer", "দোকানের কাস্টমার")}</span>
                    <span className="figure text-2xl font-semibold text-ink">{f.money(tot.total)}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap justify-end gap-1.5 text-xs">
                    {tot.paid > 0 && (
                      <span className="tnum rounded-full bg-ok-soft px-2 py-0.5 font-medium text-ok">
                        {t("Paid", "পরিশোধ")} {f.money(tot.paid)}
                      </span>
                    )}
                    {tot.cod > 0 && <span className="tnum rounded-full bg-cash-soft px-2 py-0.5 font-semibold text-cash-ink">COD {f.money(tot.cod)}</span>}
                    {tot.due > 0 && (
                      <span className="tnum rounded-full bg-cash-soft px-2 py-0.5 font-semibold text-cash-ink">
                        {t("Due", "বাকি")} {f.money(tot.due)}
                      </span>
                    )}
                  </div>
                  <p className="mt-3 text-center text-xs text-ink-3">
                    {draft
                      ? t("Stock isn't held for drafts. Confirm it from Orders when the customer is ready.", "খসড়ায় স্টক রাখা হয় না। কাস্টমার প্রস্তুত হলে অর্ডার থেকে নিশ্চিত করুন।")
                      : walkin
                        ? t(`${tot.units} item(s) taken out of stock.`, `${f.num(tot.units)}টি পণ্য স্টক থেকে বাদ হয়েছে।`)
                        : t(`${tot.units} item(s) held in stock until it ships.`, `পাঠানো পর্যন্ত ${f.num(tot.units)}টি পণ্য রিজার্ভ রাখা হলো।`)}
                  </p>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2">
                {!draft &&
                  (
                    [
                      [
                        "invoice",
                        <Printer key="i" className="size-5" />,
                        t("Print invoice", "ইনভয়েস প্রিন্ট"),
                        () =>
                          printing.print([order.id], "invoice", {
                            labels: !walkin,
                          }),
                      ],
                      ["share", <ShareNetwork key="s" className="size-5" />, t("Share image", "ছবি শেয়ার"), () => open(`/invoice/${order.id}?share=1`)],
                      ["label", <Sticker key="l" className="size-5" />, t("Print label", "লেবেল প্রিন্ট"), () => printing.print([order.id], "label")],
                    ] as const
                  ).map(([key, icon, label, onClick]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={onClick}
                      disabled={walkin && key === "label"}
                      className={cn(
                        "flex flex-col items-center gap-1.5 rounded-lg bg-surface/95 px-2 py-3 text-xs font-medium text-ink-2 shadow-2 transition-colors hover:bg-surface hover:text-ink disabled:opacity-40",
                      )}
                    >
                      <span className="text-brand-ink">{icon}</span>
                      {label}
                    </button>
                  ))}
                {!draft && (
                  <button
                    type="button"
                    onClick={() =>
                      printing.choose([order.id], "invoice", {
                        labels: !walkin,
                      })
                    }
                    className="col-span-3 justify-self-center rounded-full bg-surface/90 px-3 py-1 text-xs text-ink-3 shadow-1 transition-colors hover:bg-surface hover:text-ink"
                  >
                    {t("Prints on", "প্রিন্ট হবে")} <b className="font-semibold text-ink">{paperName}</b> · <span className="underline underline-offset-2">{t("Change paper", "কাগজ বদলান")}</span>
                  </button>
                )}
                {draft && (
                  <Link href="/orders" className="col-span-3 flex items-center justify-center gap-2 rounded-lg bg-surface/95 py-3 text-sm font-medium text-ink-2 shadow-2 hover:bg-surface">
                    <ListBullets className="size-5 text-brand-ink" />
                    {t("Go to orders", "অর্ডারে যান")}
                  </Link>
                )}
              </div>
              <Button data-autofocus variant="primary" size="lg" className="mt-2 w-full" icon={<Plus className="size-5" weight="bold" />} onClick={onNew}>
                {t("Start the next order", "পরের অর্ডার শুরু করুন")}
              </Button>
            </m.div>
          </div>
        )}
      </AnimatePresence>
      {printing.node}
    </>,
    document.body,
  );
}
