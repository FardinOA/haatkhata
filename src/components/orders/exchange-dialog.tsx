"use client";

import { ArrowsClockwise, ArrowRight, Receipt, Trash } from "@phosphor-icons/react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ProductThumb } from "../bits";
import { VariantPicker } from "../inventory/variant-picker";
import { Button, cn, Field, IconButton, Segmented, Stepper } from "../ui/core";
import { Sheet } from "../ui/overlays";
import { MoneyInput } from "../products/editor";
import { available, lineTotal } from "@/lib/domain";
import { useFmt, useT } from "@/lib/hooks";
import { getVariant, useStore } from "@/lib/store";
import type { CartLine, Order } from "@/lib/types";

/** Exchange (FR-ORD-06): take item A back and send item B as a linked new order. */
export function ExchangeDialog({ order, onClose, onDone }: { order: Order; onClose: () => void; onDone: (next: Order) => void }) {
  const t = useT();
  const f = useFmt();
  const products = useStore((s) => s.products);
  const presets = useStore((s) => s.pos.deliveryPresets);
  const exchange = useStore((s) => s.exchangeOrder);
  const returnable = order.lines.filter((l) => l.qty - l.returnedQty > 0);
  const [back, setBack] = useState<Record<string, { qty: number; condition: "restock" | "damaged" }>>(() => Object.fromEntries(returnable.map((l) => [l.id, { qty: l.qty - l.returnedQty, condition: "restock" as const }])));
  const [send, setSend] = useState<CartLine[]>([]);
  const inDhaka = (order.customer?.address?.district ?? "Dhaka") === "Dhaka";
  const [delivery, setDelivery] = useState(presets.find((p) => (inDhaka ? p.id === "dp_in" : p.id === "dp_out"))?.amount ?? (inDhaka ? 70 : 130));
  const [fee, setFee] = useState(order.courier?.fee ?? 0);
  const exclude = useMemo(() => new Set(send.map((l) => l.variantId)), [send]);

  const credit = returnable.reduce((s, l) => s + (back[l.id]?.qty ?? 0) * (lineTotal(l) / l.qty), 0);
  const newValue = send.reduce((s, l) => s + l.qty * l.price, 0);
  const toCollect = Math.max(0, newValue - credit) + delivery;
  const backUnits = Object.values(back).reduce((s, b) => s + b.qty, 0);
  const over = send.some((l) => {
    const hit = getVariant(products, l.variantId);
    return !hit || l.qty > available(hit.v);
  });

  const submit = () => {
    if (!backUnits || !send.length || over) return;
    const next = exchange({
      orderId: order.id,
      returnLines: returnable.filter((l) => back[l.id]?.qty > 0).map((l) => ({ lineId: l.id, qty: back[l.id].qty, condition: back[l.id].condition })),
      fee,
      newLines: send,
      deliveryCharge: delivery,
      credit: Math.min(credit, newValue),
      mode: "confirm",
    });
    if (next) onDone(next);
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={t(`Exchange · #${order.no}`, `বদল · #${f.digits(String(order.no))}`)}
      sub={t("The returned items come back into stock and a new parcel goes out, linked to this order.", "ফেরত পণ্য স্টকে ফিরবে আর নতুন পার্সেল যাবে, এই অর্ডারের সাথে যুক্ত।")}
      width={620}
      footer={
        <>
          <span className="text-sm text-ink-2">
            {t("Courier collects", "কুরিয়ার নেবে")} <b className="tnum text-ink">{f.money(toCollect)}</b>
          </span>
          <Button variant="primary" className="ml-auto" disabled={!backUnits || !send.length || over} icon={<ArrowsClockwise className="size-4" />} onClick={submit}>
            {t("Exchange", "বদল করুন")}
          </Button>
        </>
      }
    >
      <div className="space-y-6 p-5">
        <section>
          <h3 className="mb-2 text-[13px] font-semibold text-ink">{t("Coming back", "ফেরত আসছে")}</h3>
          <ul className="divide-y divide-line rounded-md border border-line">
            {returnable.map((l) => {
              const hit = getVariant(products, l.variantId);
              const b = back[l.id];
              return (
                <li key={l.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                  {hit && <ProductThumb product={hit.p} size={34} rounded="sm" />}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-medium text-ink">{l.name}</span>
                    <span className="block truncate text-xs text-ink-3">{l.variantLabel || l.sku}</span>
                  </span>
                  <Segmented<"restock" | "damaged">
                    size="sm"
                    value={b.condition}
                    onChange={(c) => setBack({ ...back, [l.id]: { ...b, condition: c } })}
                    options={[
                      { value: "restock", label: t("Back to stock", "স্টকে") },
                      { value: "damaged", label: t("Damaged", "নষ্ট") },
                    ]}
                  />
                  <Stepper size="sm" value={b.qty} min={0} max={l.qty - l.returnedQty} onChange={(n) => setBack({ ...back, [l.id]: { ...b, qty: n } })} />
                </li>
              );
            })}
          </ul>
        </section>
        <section>
          <h3 className="mb-2 text-[13px] font-semibold text-ink">{t("Sending instead", "পরিবর্তে যাচ্ছে")}</h3>
          <VariantPicker onPick={({ p, v }) => setSend([...send, { key: v.id, productId: p.id, variantId: v.id, qty: 1, price: v.price, discount: 0 }])} exclude={exclude} placeholder={t("Pick the replacement", "বদলি পণ্য বাছুন")} />
          {send.length > 0 && (
            <ul className="mt-2 divide-y divide-line rounded-md border border-line">
              {send.map((l) => {
                const hit = getVariant(products, l.variantId);
                const free = hit ? available(hit.v) : 0;
                return (
                  <li key={l.variantId} className="flex items-center gap-3 px-3 py-2.5">
                    {hit && <ProductThumb product={hit.p} size={34} rounded="sm" />}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-medium text-ink">{hit?.p.name}</span>
                      <span className={cn("block text-xs", l.qty > free ? "text-danger" : "text-ink-3")}>
                        {hit ? Object.values(hit.v.options).join(" / ") || hit.v.sku : ""} · {t(`${free} available`, `${f.num(free)}টি আছে`)}
                      </span>
                    </span>
                    <Stepper size="sm" value={l.qty} min={1} onChange={(n) => setSend(send.map((x) => (x.variantId === l.variantId ? { ...x, qty: n } : x)))} />
                    <span className="tnum w-20 text-right text-sm font-semibold text-ink">{f.money(l.qty * l.price)}</span>
                    <IconButton label={t("Remove", "সরান")} size="sm" onClick={() => setSend(send.filter((x) => x.variantId !== l.variantId))}>
                      <Trash className="size-4" />
                    </IconButton>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("Delivery for the new parcel", "নতুন পার্সেলের ডেলিভারি")} htmlFor="ex-del">
            <MoneyInput id="ex-del" value={delivery} onChange={setDelivery} />
          </Field>
          <Field label={t("Courier's return fee", "কুরিয়ারের ফেরত চার্জ")} htmlFor="ex-fee" hint={t("Recorded as an expense", "খরচ হিসেবে লেখা হবে")}>
            <MoneyInput id="ex-fee" value={fee} onChange={setFee} />
          </Field>
        </div>
        <dl className="space-y-1.5 rounded-md bg-surface-2 p-4 text-[13.5px]">
          <div className="flex justify-between">
            <dt className="text-ink-3">{t("Value of what comes back", "ফেরত পণ্যের মূল্য")}</dt>
            <dd className="tnum text-ink">{f.money(Math.round(credit))}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-3">{t("New items", "নতুন পণ্য")}</dt>
            <dd className="tnum text-ink">{f.money(newValue)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-3">{t("Delivery", "ডেলিভারি")}</dt>
            <dd className="tnum text-ink">{f.money(delivery)}</dd>
          </div>
          <div className="flex justify-between border-t border-line pt-2 font-semibold">
            <dt className="text-ink">{t("Courier collects", "কুরিয়ার নেবে")}</dt>
            <dd className="tnum text-cash-ink">{f.money(Math.round(toCollect))}</dd>
          </div>
          {credit > newValue && <p className="pt-1 text-xs text-warn">{t(`The returned items are worth ${f.money(Math.round(credit - newValue))} more — refund that separately.`, `ফেরত পণ্যের মূল্য ${f.money(Math.round(credit - newValue))} বেশি — আলাদা করে ফেরত দিন।`)}</p>}
        </dl>
      </div>
    </Sheet>
  );
}

/** Links between exchanged orders, and the payment receipt (FR-INV-10). */
export function OrderDocLinks({ order }: { order: Order }) {
  const t = useT();
  const f = useFmt();
  const orders = useStore((s) => s.orders);
  const from = order.exchangeOf ? orders.find((o) => o.id === order.exchangeOf) : undefined;
  const to = order.exchangedTo ? orders.find((o) => o.id === order.exchangedTo) : undefined;
  const paid = order.payments.some((p) => p.amount > 0);
  if (!from && !to && !paid) return null;
  return (
    <div className="flex flex-wrap gap-2 px-5 pb-4">
      {from && (
        <Link href={`/orders?id=${from.id}`} className="inline-flex h-8 items-center gap-1.5 rounded-full bg-brand-50 px-3 text-xs font-medium text-brand-ink hover:bg-brand-100">
          <ArrowsClockwise className="size-3.5" />
          {t(`Exchange for #${from.no}`, `#${f.digits(String(from.no))} এর বদল`)}
        </Link>
      )}
      {to && (
        <Link href={`/orders?id=${to.id}`} className="inline-flex h-8 items-center gap-1.5 rounded-full bg-brand-50 px-3 text-xs font-medium text-brand-ink hover:bg-brand-100">
          {t(`Exchanged — new order #${to.no}`, `বদল — নতুন অর্ডার #${f.digits(String(to.no))}`)}
          <ArrowRight className="size-3.5" />
        </Link>
      )}
      {paid && (
        <Link href={`/invoice/${order.id}?doc=receipt`} target="_blank" className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line px-3 text-xs font-medium text-ink-2 hover:bg-sunken">
          <Receipt className="size-3.5" />
          {t("Payment receipt", "টাকার রসিদ")}
        </Link>
      )}
    </div>
  );
}
