"use client";

import { ArrowUUpLeft, Money as MoneyIcon, Truck, Wallet } from "@phosphor-icons/react";
import { useState } from "react";
import { Button, cn, Field, Input, Segmented, Select, Stepper } from "../ui/core";
import { Dialog } from "../ui/overlays";
import { COURIERS, orderTotals, PAY_METHODS } from "@/lib/domain";
import { useFmt, useT } from "@/lib/hooks";
import { PAY_LABEL } from "@/lib/labels";
import type { Courier, Order, PayMethod, ReturnRecord } from "@/lib/types";

const num = (v: string) => Math.max(0, Number(v.replace(/[^\d.]/g, "")) || 0);

/* ------------------------------------------------------------ ship */

export function ShipDialog({
  open,
  onClose,
  onConfirm,
  count = 1,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (c: Courier) => void;
  count?: number;
  initial?: Courier;
}) {
  const t = useT();
  const f = useFmt();
  const [name, setName] = useState(initial?.name ?? COURIERS[0]);
  const [tracking, setTracking] = useState(initial?.tracking ?? "");
  const [fee, setFee] = useState(String(initial?.fee ?? 60));
  return (
    <Dialog
      open={open}
      onClose={onClose}
      tone="brand"
      icon={<Truck weight="fill" />}
      title={count > 1 ? t(`Ship ${count} orders`, `${f.num(count)}টি অর্ডার পাঠান`) : t("Hand over to courier", "কুরিয়ারে দিন")}
      width={460}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t("Cancel", "বাতিল")}
          </Button>
          <Button variant="primary" data-autofocus onClick={() => onConfirm({ name, tracking: tracking.trim() || undefined, fee: num(fee) })}>
            {t("Mark shipped", "পাঠানো হয়েছে")}
          </Button>
        </>
      }
    >
      <p className="text-[13px] text-ink-3">{t("Stock moves from held to in-transit when you confirm.", "নিশ্চিত করলে স্টক রিজার্ভ থেকে ট্রানজিটে যাবে।")}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field label={t("Courier", "কুরিয়ার")} className="sm:col-span-2">
          <div className="flex flex-wrap gap-1.5">
            {COURIERS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setName(c)}
                aria-pressed={name === c}
                className={cn("h-9 rounded-full border px-3.5 text-[13px] font-medium transition-colors", name === c ? "border-brand bg-brand-50 text-brand-ink" : "border-line-strong/80 text-ink-2 hover:border-ink-4")}
              >
                {c}
              </button>
            ))}
          </div>
        </Field>
        {count === 1 && (
          <Field label={t("Tracking / consignment ID", "ট্র্যাকিং আইডি")} optional={t("optional", "ঐচ্ছিক")}>
            <Input value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="SF1234567" />
          </Field>
        )}
        <Field label={t("Courier fee per parcel", "প্রতি পার্সেল চার্জ")} className={count > 1 ? "sm:col-span-2" : ""}>
          <Input inputMode="numeric" value={fee} onChange={(e) => setFee(e.target.value)} leading={<span className="text-sm">৳</span>} />
        </Field>
      </div>
    </Dialog>
  );
}

/* ------------------------------------------------------------ payment */

export function PaymentDialog({ open, onClose, order, onConfirm }: { open: boolean; onClose: () => void; order: Order; onConfirm: (p: { method: PayMethod; amount: number; txnId?: string }) => void }) {
  const t = useT();
  const f = useFmt();
  const remaining = orderTotals(order).remaining;
  const [method, setMethod] = useState<PayMethod>("bkash");
  const [amount, setAmount] = useState(String(remaining));
  const [txn, setTxn] = useState("");
  const amt = num(amount);
  return (
    <Dialog
      open={open}
      onClose={onClose}
      tone="cash"
      icon={<Wallet weight="fill" />}
      title={t("Record a payment", "পেমেন্ট যোগ করুন")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t("Cancel", "বাতিল")}
          </Button>
          <Button variant="primary" disabled={amt <= 0} onClick={() => onConfirm({ method, amount: amt, txnId: txn.trim() || undefined })}>
            {t(`Record ${f.money(amt)}`, `${f.money(amt)} যোগ করুন`)}
          </Button>
        </>
      }
    >
      <p className="text-[13px] text-ink-3">
        {t("Still to collect", "আরও পাওনা")} <span className="tnum font-semibold text-cash-ink">{f.money(remaining)}</span>
      </p>
      <div className="mt-4 space-y-3">
        <Field label={t("Method", "মাধ্যম")}>
          <Select value={method} onChange={(e) => setMethod(e.target.value as PayMethod)}>
            {PAY_METHODS.map((m) => (
              <option key={m} value={m}>
                {t.pick(PAY_LABEL[m])}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("Amount", "পরিমাণ")}>
            <Input data-autofocus inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} leading={<span className="text-sm">৳</span>} />
          </Field>
          <Field label={t("Transaction ID", "ট্রানজেকশন আইডি")} optional={t("optional", "ঐচ্ছিক")}>
            <Input value={txn} onChange={(e) => setTxn(e.target.value)} placeholder="8N7A6…" />
          </Field>
        </div>
      </div>
    </Dialog>
  );
}

/* ------------------------------------------------------------ return */

type RetLine = { lineId: string; qty: number; condition: "restock" | "damaged" };

export function ReturnDialog({
  open,
  onClose,
  order,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  order: Order;
  onConfirm: (lines: ReturnRecord["lines"], fee: number, refund: number, method: PayMethod) => void;
}) {
  const t = useT();
  const f = useFmt();
  const [lines, setLines] = useState<RetLine[]>(() =>
    order.lines.filter((l) => l.qty > l.returnedQty).map((l) => ({ lineId: l.id, qty: l.qty - l.returnedQty, condition: "restock" as const })),
  );
  const [fee, setFee] = useState(String(order.courier?.fee ?? 60));
  const paid = Math.max(0, orderTotals(order).paid);
  const [refund, setRefund] = useState("0");
  const [method, setMethod] = useState<PayMethod>("bkash");
  const units = lines.reduce((s, l) => s + l.qty, 0);
  const set = (id: string, patch: Partial<RetLine>) => setLines((ls) => ls.map((l) => (l.lineId === id ? { ...l, ...patch } : l)));

  return (
    <Dialog
      open={open}
      onClose={onClose}
      tone="danger"
      icon={<ArrowUUpLeft weight="bold" />}
      title={t(`Record return · #${order.no}`, `ফেরত নিন · #${f.digits(String(order.no))}`)}
      width={560}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t("Cancel", "বাতিল")}
          </Button>
          <Button variant="primary" disabled={units === 0} onClick={() => onConfirm(lines.filter((l) => l.qty > 0), num(fee), num(refund), method)}>
            {t(`Return ${units} item${units === 1 ? "" : "s"}`, `${f.num(units)}টি পণ্য ফেরত নিন`)}
          </Button>
        </>
      }
    >
      <p className="text-[13px] text-ink-3">{t("Restocked items go back on the shelf. Damaged items are written off.", "রিস্টক করা পণ্য আবার বিক্রির জন্য স্টকে যাবে। নষ্ট পণ্য বাদ দেওয়া হবে।")}</p>
      <ul className="mt-4 divide-y divide-line rounded-md border border-line">
        {lines.map((rl) => {
          const l = order.lines.find((x) => x.id === rl.lineId)!;
          const max = l.qty - l.returnedQty;
          return (
            <li key={rl.lineId} className="flex flex-wrap items-center gap-3 px-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{l.name}</p>
                <p className="truncate text-xs text-ink-3">
                  {l.variantLabel || l.sku} · {t(`${max} sent`, `${f.num(max)}টি পাঠানো`)}
                </p>
              </div>
              <Stepper size="sm" value={rl.qty} min={0} max={max} onChange={(n) => set(rl.lineId, { qty: n })} />
              <Segmented
                size="sm"
                value={rl.condition}
                onChange={(v) => set(rl.lineId, { condition: v })}
                options={[
                  { value: "restock", label: t("Restock", "রিস্টক") },
                  { value: "damaged", label: t("Damaged", "নষ্ট") },
                ]}
              />
            </li>
          );
        })}
      </ul>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Field label={t("Courier return fee", "ফেরত চার্জ")} hint={t("Saved as an expense", "খরচ হিসেবে যোগ হবে")}>
          <Input inputMode="numeric" value={fee} onChange={(e) => setFee(e.target.value)} leading={<span className="text-sm">৳</span>} />
        </Field>
        <Field label={t("Refund to customer", "কাস্টমারকে ফেরত")} hint={paid ? t(`They paid ${f.money(paid)}`, `পরিশোধ করেছেন ${f.money(paid)}`) : t("Nothing was prepaid", "আগে কিছু দেননি")}>
          <Input inputMode="numeric" value={refund} onChange={(e) => setRefund(e.target.value)} leading={<span className="text-sm">৳</span>} disabled={!paid} />
        </Field>
        <Field label={t("Refund via", "ফেরতের মাধ্যম")}>
          <Select value={method} onChange={(e) => setMethod(e.target.value as PayMethod)} disabled={!paid || num(refund) === 0}>
            {PAY_METHODS.map((m) => (
              <option key={m} value={m}>
                {t.pick(PAY_LABEL[m])}
              </option>
            ))}
          </Select>
        </Field>
      </div>
    </Dialog>
  );
}

/* ------------------------------------------------------------ cod */

export function CodDialog({ open, onClose, amount, count, onConfirm }: { open: boolean; onClose: () => void; amount: number; count: number; onConfirm: (ref?: string) => void }) {
  const t = useT();
  const f = useFmt();
  const [ref, setRef] = useState("");
  return (
    <Dialog
      open={open}
      onClose={onClose}
      tone="cash"
      icon={<MoneyIcon weight="fill" />}
      title={t("Courier paid you?", "কুরিয়ার টাকা দিয়েছে?")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t("Not yet", "এখনো না")}
          </Button>
          <Button variant="cash" onClick={() => onConfirm(ref.trim() || undefined)}>
            {t(`Received ${f.money(amount)}`, `${f.money(amount)} পেয়েছি`)}
          </Button>
        </>
      }
    >
      <p>
        {count > 1
          ? t(`Marks COD on ${count} orders as received.`, `${f.num(count)}টি অর্ডারের COD পাওয়া হিসেবে চিহ্নিত হবে।`)
          : t("Marks this order's COD as received.", "এই অর্ডারের COD পাওয়া হিসেবে চিহ্নিত হবে।")}
      </p>
      <Field label={t("Payout reference", "পেআউট রেফারেন্স")} optional={t("optional", "ঐচ্ছিক")} className="mt-3">
        <Input data-autofocus value={ref} onChange={(e) => setRef(e.target.value)} placeholder="PAYOUT-48213" />
      </Field>
    </Dialog>
  );
}
