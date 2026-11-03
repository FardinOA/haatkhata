"use client";

import { CaretDown, CheckCircle, HandCoins, Truck } from "@phosphor-icons/react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge, Button, Checkbox, cn, EmptyState, Field, Input, Panel, PanelHeader } from "../ui/core";
import { Dialog, useToast } from "../ui/overlays";
import { downloadCsv, isoDay } from "../reports/csv";
import { codOrders, groupByCourier, OVERDUE_DAYS, payouts, plural } from "./calc";
import { useCan, useFmt, useT } from "@/lib/hooks";
import { useStore } from "@/lib/store";

const COURIER_TINT: Record<string, string> = { Steadfast: "#0B8A5E", Pathao: "#E2136E", RedX: "#E0342B", Paperfly: "#2D6CDF", Carrybee: "#E39A00" };

export function CourierMark({ name, size = 32 }: { name: string; size?: number }) {
  const c = COURIER_TINT[name] ?? "#6B7178";
  return (
    <span className="grid shrink-0 place-items-center rounded-md font-display font-semibold" style={{ width: size, height: size, fontSize: size * 0.4, color: c, background: `color-mix(in oklab, ${c} 12%, white)` }} aria-hidden>
      {name === "Unassigned" ? <Truck className="size-4" /> : name.slice(0, 2)}
    </span>
  );
}

export function CodPanel() {
  const t = useT();
  const f = useFmt();
  const can = useCan();
  const toast = useToast();
  const orders = useStore((s) => s.orders);
  const markCodReceived = useStore((s) => s.markCodReceived);
  const [now] = useState(() => new Date());
  const items = useMemo(() => codOrders(orders, now), [orders, now]);
  const groups = useMemo(() => groupByCourier(items), [items]);
  const recent = useMemo(() => payouts(orders).slice(0, 8), [orders]);
  const [open, setOpen] = useState<Set<string>>(() => new Set(groups.filter((g) => g.overdue > 0).map((g) => g.courier).concat(groups[0]?.courier ?? [])));
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [dialog, setDialog] = useState(false);
  const [ref, setRef] = useState("");
  const canMark = can("deliver_return");

  const selected = items.filter((i) => sel.has(i.order.id));
  const selTotal = selected.reduce((s, i) => s + i.amount, 0);
  const toggle = (id: string) => setSel((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    return n;
  });
  const toggleGroup = (ids: string[], on: boolean) => setSel((s) => {
    const n = new Set(s);
    ids.forEach((id) => (on ? n.add(id) : n.delete(id)));
    return n;
  });

  const confirm = () => {
    const ids = selected.map((i) => i.order.id);
    markCodReceived(ids, ref.trim() || undefined);
    toast({ title: t(`Marked ${ids.length} ${plural(ids.length, "order", "orders")} as paid out`, `${f.num(ids.length)}টি অর্ডারের টাকা পাওয়া গেছে`), body: `${f.money(selTotal)}${ref.trim() ? ` · ${ref.trim()}` : ""}` });
    setSel(new Set());
    setRef("");
    setDialog(false);
  };

  return (
    <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <Panel>
        <PanelHeader
          title={t("Cash still with couriers", "কুরিয়ারের কাছে থাকা টাকা")}
          sub={t(`Delivered, but the payout hasn't reached you. Over ${OVERDUE_DAYS} days is overdue.`, `ডেলিভারি হয়েছে, কিন্তু টাকা এখনো আসেনি। ${f.num(OVERDUE_DAYS)} দিনের বেশি হলে দেরি।`)}
          action={
            items.length > 0 && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  downloadCsv(`cod_receivable_${isoDay(now)}`, ["courier", "order", "customer", "phone", "delivered", "days", "amount"], items.map((i) => [i.order.courier?.name ?? "", i.order.no, i.order.customer?.name ?? "", i.order.customer?.phone ?? "", isoDay(i.deliveredAt), i.days, i.amount]))
                }
              >
                CSV
              </Button>
            )
          }
        />
        {groups.length === 0 ? (
          <EmptyState icon={<CheckCircle weight="duotone" />} title={t("Every courier has paid you", "সব কুরিয়ার টাকা দিয়ে দিয়েছে")} body={t("When a COD order is marked delivered, its cash shows up here until the payout arrives.", "COD অর্ডার ডেলিভারি হলে, টাকা না আসা পর্যন্ত এখানে দেখাবে।")} />
        ) : (
          <ul className="mt-4 border-t border-line">
            {groups.map((g) => {
              const ids = g.items.map((i) => i.order.id);
              const nSel = ids.filter((id) => sel.has(id)).length;
              const isOpen = open.has(g.courier);
              return (
                <li key={g.courier} className="border-b border-line last:border-0">
                  <div className="flex items-center gap-3 px-5 py-3.5">
                    {canMark && <Checkbox checked={nSel === ids.length} indeterminate={nSel > 0 && nSel < ids.length} onChange={(on) => toggleGroup(ids, on)} label={t(`Select all ${g.courier}`, `${g.courier} সব বাছুন`)} />}
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      onClick={() => setOpen((s) => {
                        const n = new Set(s);
                        if (n.has(g.courier)) n.delete(g.courier);
                        else n.add(g.courier);
                        return n;
                      })}
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    >
                      <CourierMark name={g.courier} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-[15px] font-semibold text-ink">{g.courier}</span>
                          {g.overdue > 0 && <Badge tone="warn" dot>{t(`${g.overdue} overdue`, `${f.num(g.overdue)}টি দেরি`)}</Badge>}
                        </span>
                        <span className="mt-0.5 block text-[13px] text-ink-3">
                          {t(
                            `${g.items.length} ${plural(g.items.length, "order", "orders")} · oldest ${g.oldest === 0 ? "from today" : `${g.oldest} ${plural(g.oldest, "day", "days")}`}`,
                            `${f.num(g.items.length)}টি অর্ডার · সবচেয়ে পুরনো ${g.oldest === 0 ? "আজকের" : `${f.num(g.oldest)} দিন`}`,
                          )}
                        </span>
                      </span>
                      <span className="figure text-xl font-semibold text-ink">{f.money(g.amount)}</span>
                      <CaretDown className={cn("size-4 shrink-0 text-ink-3 transition-transform", isOpen && "rotate-180")} />
                    </button>
                  </div>
                  {isOpen && (
                    <ul className="bg-surface-2/70 pb-1">
                      {g.items.map((i) => {
                        const over = i.days > OVERDUE_DAYS;
                        return (
                          <li key={i.order.id} className={cn("flex items-center gap-3 border-t border-line/60 py-2.5 pl-5 pr-5", canMark && "cursor-pointer hover:bg-surface")} onClick={() => canMark && toggle(i.order.id)}>
                            {canMark && <Checkbox checked={sel.has(i.order.id)} onChange={() => toggle(i.order.id)} label={t(`Select order ${i.order.no}`, `অর্ডার ${i.order.no} বাছুন`)} />}
                            <span className="w-8 shrink-0" aria-hidden />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm text-ink">
                                <Link href={`/orders?id=${i.order.id}`} onClick={(e) => e.stopPropagation()} className="tnum font-medium hover:text-brand-ink hover:underline">
                                  #{f.digits(String(i.order.no))}
                                </Link>{" "}
                                · {i.order.customer?.name ?? t("Customer", "কাস্টমার")}
                              </p>
                              <p className="tnum truncate text-xs text-ink-3">
                                {i.order.courier?.tracking ?? "—"} · {t("delivered", "ডেলিভারি")} {f.dateShort(i.deliveredAt)}
                              </p>
                            </div>
                            <Badge tone={over ? "warn" : "neutral"} className="tnum hidden sm:inline-flex">
                              {over
                                ? t(`${i.days} days — overdue`, `${f.num(i.days)} দিন — দেরি`)
                                : i.days === 0
                                  ? t("Today", "আজ")
                                  : t(`${i.days} ${plural(i.days, "day", "days")}`, `${f.num(i.days)} দিন`)}
                            </Badge>
                            <span className={cn("tnum w-20 text-right text-sm font-medium", over ? "text-cash-ink" : "text-ink")}>{f.money(i.amount)}</span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {!canMark && groups.length > 0 && <p className="border-t border-line px-5 py-3 text-xs text-ink-3">{t("Only owners and managers can mark payouts as received.", "শুধু মালিক ও ম্যানেজার টাকা পাওয়া চিহ্নিত করতে পারেন।")}</p>}
      </Panel>

      <Panel className="lg:sticky lg:top-24">
        <PanelHeader title={t("Recent payouts", "সাম্প্রতিক পেমেন্ট")} sub={t("COD cash that reached you", "যে COD টাকা হাতে এসেছে")} />
        {recent.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-ink-3">{t("No payouts yet.", "এখনো কোনো পেমেন্ট আসেনি।")}</p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {recent.map((p) => (
              <li key={p.key} className="flex items-center gap-3 px-5 py-3">
                <CourierMark name={p.courier} size={28} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{p.ref ?? p.courier}</p>
                  <p className="text-xs text-ink-3">
                    {p.courier} · {t(`${p.count} ${plural(p.count, "order", "orders")}`, `${f.num(p.count)}টি অর্ডার`)} · {f.dateShort(p.at)}
                  </p>
                </div>
                <span className="tnum text-sm font-medium text-ok">{f.money(p.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {/* Selection bar */}
      {selected.length > 0 && (
        <div className="fixed inset-x-3 bottom-[calc(76px+env(safe-area-inset-bottom))] z-40 md:bottom-6 md:left-auto md:right-8 md:w-[460px]">
          <div className="flex items-center gap-3 rounded-lg border border-line bg-surface p-3 pl-4 shadow-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-cash-soft text-cash-ink">
              <HandCoins className="size-5" weight="duotone" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink">{f.money(selTotal)}</p>
              <p className="text-xs text-ink-3">{t(`${selected.length} ${plural(selected.length, "order", "orders")} selected`, `${f.num(selected.length)}টি অর্ডার বাছাই`)}</p>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setSel(new Set())}>
              {t("Clear", "বাদ দিন")}
            </Button>
            <Button size="sm" variant="primary" onClick={() => setDialog(true)}>
              {t("Mark received", "টাকা পেয়েছি")}
            </Button>
          </div>
        </div>
      )}

      <Dialog
        open={dialog}
        onClose={() => setDialog(false)}
        tone="cash"
        icon={<HandCoins weight="duotone" />}
        title={t(`Mark ${f.money(selTotal)} as received?`, `${f.money(selTotal)} পাওয়া গেছে?`)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDialog(false)}>
              {t("Cancel", "বাতিল")}
            </Button>
            <Button variant="primary" onClick={confirm}>
              {t(`Mark ${selected.length} received`, `${f.num(selected.length)}টি পাওয়া গেছে`)}
            </Button>
          </>
        }
      >
        <p>{t("These orders will move out of the courier's list and count as cash in hand.", "এই অর্ডারগুলো কুরিয়ারের তালিকা থেকে সরে হাতে থাকা টাকায় যোগ হবে।")}</p>
        <Field label={t("Payout reference", "পেমেন্ট রেফারেন্স")} optional={t("Optional", "ঐচ্ছিক")} hint={t("From the courier's payout SMS or statement", "কুরিয়ারের SMS বা স্টেটমেন্ট থেকে")} className="mt-4" htmlFor="payout-ref">
          <Input id="payout-ref" data-autofocus value={ref} onChange={(e) => setRef(e.target.value)} placeholder="PAYOUT-48213" onKeyDown={(e) => e.key === "Enter" && confirm()} />
        </Field>
      </Dialog>
    </div>
  );
}
