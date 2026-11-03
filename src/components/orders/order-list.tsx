"use client";

import { CaretRight } from "@phosphor-icons/react";
import { useState } from "react";
import { ChannelIcon, ProductThumb, StatusPill } from "../bits";
import { Button, Checkbox, cn } from "../ui/core";
import { PayChip } from "./util";
import { orderTotals } from "@/lib/domain";
import { useFmt, useNow, useT } from "@/lib/hooks";
import { CHANNEL_LABEL } from "@/lib/labels";
import type { Order, Product } from "@/lib/types";

const PAGE = 40;

export function ItemStack({ order, products, size = 28 }: { order: Order; products: Map<string, Product>; size?: number }) {
  const t = useT();
  const shown = order.lines.slice(0, 3);
  const first = order.lines[0];
  const units = order.lines.reduce((s, l) => s + l.qty, 0);
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <div className="flex shrink-0 -space-x-2">
        {shown.map((l) => {
          const p = products.get(l.productId);
          return p ? <ProductThumb key={l.id} product={p} size={size} rounded="sm" className="ring-2 ring-surface" /> : null;
        })}
      </div>
      <div className="min-w-0">
        <p className="truncate text-[13px] text-ink-2">{first ? (t.lang === "bn" ? (products.get(first.productId)?.nameBn ?? first.name) : first.name) : "—"}</p>
        <p className="truncate text-xs text-ink-4">
          {order.lines.length > 1 ? t(`+${order.lines.length - 1} more · ${units} pcs`, `+${order.lines.length - 1}টি আরও · ${units} পিস`) : first?.variantLabel || t(`${units} pcs`, `${units} পিস`)}
        </p>
      </div>
    </div>
  );
}

export function OrderList({
  orders,
  products,
  selected,
  onSelect,
  onSelectAll,
  onOpen,
}: {
  orders: Order[];
  products: Map<string, Product>;
  selected: Set<string>;
  onSelect: (id: string, on: boolean) => void;
  onSelectAll: (on: boolean) => void;
  onOpen: (id: string) => void;
}) {
  const t = useT();
  const f = useFmt();
  const now = useNow();
  const [limit, setLimit] = useState(PAGE);
  const shown = orders.slice(0, limit);
  const allOn = orders.length > 0 && orders.every((o) => selected.has(o.id));
  const someOn = !allOn && orders.some((o) => selected.has(o.id));

  return (
    <div>
      {/* Desktop table */}
      <div className="hidden overflow-hidden rounded-lg border border-line bg-surface shadow-1 md:block">
        <table className="w-full table-fixed text-left">
          <colgroup>
            <col className="w-12" />
            <col className="w-[132px]" />
            <col />
            <col className="hidden w-[24%] lg:table-column" />
            <col className="w-[140px]" />
            <col className="w-[160px]" />
            <col className="w-[112px]" />
            <col className="w-9" />
          </colgroup>
          <thead className="border-b border-line bg-surface-2 text-xs font-medium text-ink-3">
            <tr className="h-10">
              <th className="pl-4">
                <Checkbox checked={allOn} indeterminate={someOn} onChange={onSelectAll} label={t("Select all", "সব নির্বাচন")} />
              </th>
              <th className="font-medium">{t("Order", "অর্ডার")}</th>
              <th className="font-medium">{t("Customer", "কাস্টমার")}</th>
              <th className="hidden font-medium lg:table-cell">{t("Items", "পণ্য")}</th>
              <th className="font-medium">{t("Status", "অবস্থা")}</th>
              <th className="font-medium">{t("Payment", "পেমেন্ট")}</th>
              <th className="pr-2 text-right font-medium">{t("Total", "মোট")}</th>
              <th />
            </tr>
          </thead>
          <tbody className="divide-y divide-line/80">
            {shown.map((o) => {
              const on = selected.has(o.id);
              return (
                <tr
                  key={o.id}
                  data-testid="order-row"
                  tabIndex={0}
                  onClick={() => onOpen(o.id)}
                  onKeyDown={(e) => e.key === "Enter" && onOpen(o.id)}
                  className={cn("group cursor-pointer transition-colors focus-visible:bg-brand-50 focus-visible:outline-none", on ? "bg-brand-50/70" : "hover:bg-surface-2")}
                  style={{ height: "calc(var(--row) + 16px)" }}
                >
                  <td className="pl-4" onClick={(e) => e.stopPropagation()}>
                    <Checkbox checked={on} onChange={(v) => onSelect(o.id, v)} label={t(`Select order ${o.no}`, `অর্ডার ${o.no} নির্বাচন`)} />
                  </td>
                  <td>
                    <p className="tnum text-[14px] font-semibold text-ink">#{f.digits(String(o.no))}</p>
                    <p className="text-xs text-ink-4" title={`${f.date(o.createdAt)} ${f.time(o.createdAt)}`}>
                      {f.relative(o.createdAt, now)}
                    </p>
                  </td>
                  <td className="pr-3">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span title={t.pick(CHANNEL_LABEL[o.channel])} className="shrink-0">
                        <ChannelIcon channel={o.channel} withBg />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-[14px] font-medium text-ink">{o.customer?.name ?? t("Walk-in", "দোকানে বিক্রি")}</p>
                        <p className="tnum truncate text-xs text-ink-3">
                          {o.customer ? `${f.digits(o.customer.phone)}${o.customer.address?.district ? ` · ${o.customer.address.district}` : ""}` : t.pick(CHANNEL_LABEL[o.channel])}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="hidden pr-3 lg:table-cell">
                    <ItemStack order={o} products={products} />
                  </td>
                  <td>
                    <StatusPill status={o.status} />
                  </td>
                  <td>
                    <PayChip order={o} />
                  </td>
                  <td className="pr-2 text-right">
                    <span className="tnum text-[14px] font-semibold text-ink">{f.money(orderTotals(o).total)}</span>
                  </td>
                  <td className="pr-3 text-ink-4">
                    <CaretRight className="size-4 opacity-0 transition-opacity group-hover:opacity-100" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Phone cards */}
      <ul className="space-y-2 md:hidden">
        {shown.map((o) => {
          const on = selected.has(o.id);
          return (
            <li key={o.id}>
              <div
                role="button"
                tabIndex={0}
                data-testid="order-card"
                onClick={() => onOpen(o.id)}
                onKeyDown={(e) => e.key === "Enter" && onOpen(o.id)}
                className={cn("block rounded-lg border bg-surface p-3.5 shadow-1 active:bg-surface-2", on ? "border-brand bg-brand-50/60" : "border-line")}
              >
                <div className="flex items-start gap-3">
                  <Checkbox checked={on} onChange={(v) => onSelect(o.id, v)} label={t(`Select order ${o.no}`, `অর্ডার ${o.no} নির্বাচন`)} className="mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="tnum flex items-center gap-1.5 text-[14px] font-semibold text-ink">
                        <ChannelIcon channel={o.channel} className="size-3.5" />#{f.digits(String(o.no))}
                        <span className="font-normal text-ink-4">· {f.relative(o.createdAt, now)}</span>
                      </p>
                      <span className="tnum text-[15px] font-semibold text-ink">{f.money(orderTotals(o).total)}</span>
                    </div>
                    <p className="mt-0.5 truncate text-[14px] text-ink-2">
                      {o.customer?.name ?? t("Walk-in customer", "দোকানের কাস্টমার")}
                      {o.customer?.address?.area && <span className="text-ink-4"> · {o.customer.address.area}</span>}
                    </p>
                    <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                      <StatusPill status={o.status} />
                      <PayChip order={o} />
                    </div>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {orders.length > limit && (
        <div className="mt-4 flex justify-center">
          <Button variant="secondary" onClick={() => setLimit((l) => l + PAGE)}>
            {t(`Show ${Math.min(PAGE, orders.length - limit)} more`, `আরও ${f.num(Math.min(PAGE, orders.length - limit))}টি দেখুন`)}
            <span className="tnum text-ink-4">
              {f.num(limit)}/{f.num(orders.length)}
            </span>
          </Button>
        </div>
      )}
    </div>
  );
}
