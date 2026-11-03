"use client";

import { ChatCircleText, Copy, Plus, Receipt, WhatsappLogo, Handshake } from "@phosphor-icons/react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Avatar, Button, EmptyState, Field, Input, Panel, PanelHeader, Segmented } from "../ui/core";
import { Dialog, Menu, useToast } from "../ui/overlays";
import { downloadCsv, isoDay } from "../reports/csv";
import { isSale } from "@/lib/analytics";
import { formatPhone, orderTotals } from "@/lib/domain";
import { useFmt, useT } from "@/lib/hooks";
import { PAY_LABEL } from "@/lib/labels";
import { useStore } from "@/lib/store";
import type { Order, PayMethod } from "@/lib/types";

type DueRow = { key: string; name: string; phone: string; due: number; orders: { order: Order; due: number }[] };

export function DuesPanel() {
  const t = useT();
  const f = useFmt();
  const toast = useToast();
  const orders = useStore((s) => s.orders);
  const business = useStore((s) => s.business);
  const addPayment = useStore((s) => s.addPayment);
  const [pay, setPay] = useState<{ order: Order; due: number } | null>(null);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PayMethod>("cash");
  const [txn, setTxn] = useState("");

  const rows = useMemo<DueRow[]>(() => {
    const map = new Map<string, DueRow>();
    for (const o of orders) {
      if (!isSale(o) || !o.customer) continue;
      const due = orderTotals(o).due;
      if (due <= 0) continue;
      const key = o.customerId ?? o.customer.phone;
      const r = map.get(key) ?? { key, name: o.customer.name, phone: o.customer.phone, due: 0, orders: [] };
      r.due += due;
      r.orders.push({ order: o, due });
      map.set(key, r);
    }
    return [...map.values()].sort((a, b) => b.due - a.due);
  }, [orders]);
  const total = rows.reduce((s, r) => s + r.due, 0);

  const message = (r: DueRow) => {
    const nos = r.orders.map((x) => `#${x.order.no}`).join(", ");
    return t.lang === "bn"
      ? `আসসালামু আলাইকুম ${r.name}, ${business.nameBn || business.name} থেকে বলছি। আপনার অর্ডার ${nos} এর ৳${r.due.toLocaleString("en-IN")} বাকি আছে। সুবিধামতো বিকাশ/নগদে ${business.phone} নম্বরে পাঠাতে পারেন। ধন্যবাদ!`
      : `Hi ${r.name}, this is ${business.name}. A balance of ৳${r.due.toLocaleString("en-IN")} is pending on order ${nos}. You can send it by bKash/Nagad to ${business.phone} whenever convenient. Thank you!`;
  };

  const openPay = (x: { order: Order; due: number }) => {
    setPay(x);
    setAmount(String(x.due));
    setMethod("cash");
    setTxn("");
  };
  const amt = Number(amount.replace(/[^\d.]/g, ""));
  const valid = pay && amt > 0 && amt <= pay.due;
  const submit = () => {
    if (!pay || !valid) return;
    addPayment(pay.order.id, { method, amount: amt, txnId: txn.trim() || undefined, kind: "payment" });
    toast({ title: t(`Recorded ${f.money(amt)} from ${pay.order.customer?.name}`, `${pay.order.customer?.name} থেকে ${f.money(amt)} নেওয়া হলো`), body: amt < pay.due ? t(`${f.money(pay.due - amt)} still due`, `${f.money(pay.due - amt)} এখনো বাকি`) : t("Order fully paid", "অর্ডারের টাকা পুরো পরিশোধ") });
    setPay(null);
  };

  return (
    <Panel>
      <PanelHeader
        title={t("Customer dues", "কাস্টমারের বাকি")}
        sub={rows.length ? t(`${rows.length} customers owe ${f.money(total)}`, `${f.num(rows.length)} জন কাস্টমারের কাছে ${f.money(total)} বাকি`) : t("Credit sales that are not paid yet", "বাকিতে বিক্রি যা এখনো পরিশোধ হয়নি")}
        action={
          rows.length > 0 && (
            <Button size="sm" variant="ghost" onClick={() => downloadCsv(`customer_dues_${isoDay(new Date())}`, ["customer", "phone", "orders", "due"], rows.map((r) => [r.name, r.phone, r.orders.map((x) => x.order.no).join(" "), r.due]))}>
              CSV
            </Button>
          )
        }
      />
      {rows.length === 0 ? (
        <EmptyState
          icon={<Handshake weight="duotone" />}
          title={t("Nobody owes you money", "কারো কাছে টাকা বাকি নেই")}
          body={t("When you sell on credit — choose “Due” instead of COD at checkout — the customer appears here with a reminder button.", "বাকিতে বিক্রি করলে — চেকআউটে COD এর বদলে “বাকি” বাছলে — কাস্টমার এখানে রিমাইন্ডার বাটনসহ দেখাবে।")}
          action={
            <Link href="/pos" className="inline-flex h-10 items-center gap-2 rounded-md bg-brand px-4 text-sm font-medium text-brand-contrast hover:brightness-[1.07]">
              <Plus className="size-4" weight="bold" />
              {t("New order", "নতুন অর্ডার")}
            </Link>
          }
        />
      ) : (
        <ul className="mt-4 divide-y divide-line border-t border-line">
          {rows.map((r) => (
            <li key={r.key} className="px-5 py-4">
              <div className="flex flex-wrap items-center gap-3">
                <Avatar name={r.name} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold text-ink">{r.name}</p>
                  <p className="tnum text-[13px] text-ink-3">{f.digits(formatPhone(r.phone))}</p>
                </div>
                <span className="figure text-xl font-semibold text-cash-ink">{f.money(r.due)}</span>
                <Menu
                  width={232}
                  items={[
                    { label: t("Send by SMS", "SMS এ পাঠান"), icon: <ChatCircleText />, onSelect: () => window.open(`sms:${r.phone}?body=${encodeURIComponent(message(r))}`, "_self") },
                    { label: t("Send on WhatsApp", "হোয়াটসঅ্যাপে পাঠান"), icon: <WhatsappLogo />, onSelect: () => window.open(`https://wa.me/88${r.phone}?text=${encodeURIComponent(message(r))}`, "_blank", "noopener") },
                    { type: "divider" },
                    {
                      label: t("Copy message", "মেসেজ কপি করুন"),
                      icon: <Copy />,
                      onSelect: () => {
                        navigator.clipboard?.writeText(message(r)).then(() => toast({ title: t("Reminder copied", "রিমাইন্ডার কপি হয়েছে"), tone: "info" }));
                      },
                    },
                  ]}
                  trigger={({ toggle, ref }) => (
                    <Button ref={ref} size="sm" variant="secondary" onClick={toggle}>
                      {t("Remind", "মনে করিয়ে দিন")}
                    </Button>
                  )}
                />
              </div>
              <ul className="mt-3 space-y-1.5 pl-12">
                {r.orders.map((x) => (
                  <li key={x.order.id} className="flex items-center gap-3 rounded-md bg-surface-2 px-3 py-2 text-[13px]">
                    <Receipt className="size-4 shrink-0 text-ink-3" />
                    <Link href={`/orders?id=${x.order.id}`} className="tnum font-medium text-ink hover:text-brand-ink hover:underline">
                      #{f.digits(String(x.order.no))}
                    </Link>
                    <span className="hidden text-ink-3 sm:inline">{f.dateShort(x.order.createdAt)}</span>
                    <span className="tnum ml-auto font-medium text-ink">{f.money(x.due)}</span>
                    <Button size="sm" variant="soft" onClick={() => openPay(x)}>
                      {t("Record payment", "টাকা নিন")}
                    </Button>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}

      <Dialog
        open={!!pay}
        onClose={() => setPay(null)}
        tone="cash"
        icon={<Receipt weight="duotone" />}
        title={t(`Payment for order #${pay?.order.no ?? ""}`, `অর্ডার #${f.digits(String(pay?.order.no ?? ""))} এর পেমেন্ট`)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setPay(null)}>
              {t("Cancel", "বাতিল")}
            </Button>
            <Button variant="primary" disabled={!valid} onClick={submit}>
              {t("Record payment", "পেমেন্ট সেভ করুন")}
            </Button>
          </>
        }
      >
        <p>
          {pay?.order.customer?.name} · {t("due", "বাকি")} <span className="tnum font-medium text-ink">{f.money(pay?.due ?? 0)}</span>
        </p>
        <div className="mt-4 space-y-4">
          <Field label={t("Amount received", "কত টাকা পেলেন")} htmlFor="due-amt" error={amount && !valid ? t(`Enter between ৳1 and ${f.money(pay?.due ?? 0)}`, `৳১ থেকে ${f.money(pay?.due ?? 0)} এর মধ্যে লিখুন`) : undefined}>
            <Input id="due-amt" data-autofocus inputMode="decimal" leading={<span className="text-sm">৳</span>} value={amount} onChange={(e) => setAmount(e.target.value)} aria-invalid={!!amount && !valid} onKeyDown={(e) => e.key === "Enter" && submit()} />
          </Field>
          <Field label={t("Paid by", "কীভাবে")}>
            <Segmented<PayMethod>
              value={method}
              onChange={setMethod}
              className="w-full"
              options={(["cash", "bkash", "nagad", "bank"] as PayMethod[]).map((m) => ({ value: m, label: t.pick(PAY_LABEL[m]) }))}
            />
          </Field>
          {method !== "cash" && (
            <Field label={t("Transaction ID", "ট্রানজেকশন আইডি")} optional={t("Optional", "ঐচ্ছিক")} htmlFor="due-txn">
              <Input id="due-txn" value={txn} onChange={(e) => setTxn(e.target.value)} placeholder="8N7A2KQ9" />
            </Field>
          )}
        </div>
      </Dialog>
    </Panel>
  );
}
