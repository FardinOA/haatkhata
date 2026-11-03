"use client";

import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  ChartLineUp,
  CheckCircle,
  Clock,
  Lightning,
  LockSimple,
  Package,
  PencilSimple,
  Plus,
  Printer,
  Receipt,
  Storefront,
  Target,
  Truck,
  UsersThree,
  Wallet,
  WarningCircle,
  type Icon,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import { ChannelIcon, Money, ProductThumb, StatusPill } from "../bits";
import { AreaChart, Donut, HeatGrid, ProgressRing, Sparkline } from "../charts";
import { Badge, Button, cn, Input, Panel } from "../ui/core";
import { useToast } from "../ui/overlays";
import {
  channelMix,
  codByCourier,
  dueCustomers,
  journey,
  kpis,
  lowStock,
  monthToDate,
  orderHeatmap,
  profitBreakdown,
  salesSeries,
  topProducts,
  type Range,
} from "@/lib/analytics";
import { toBanglaDate, BANGLA_MONTHS, BANGLA_MONTHS_EN } from "@/lib/bangla-calendar";
import { canTransition, customerStats, orderTotals, riskLevel } from "@/lib/domain";
import { DAYS_BN, DAYS_EN } from "@/lib/format";
import { useCan, useFmt, useNow, useT } from "@/lib/hooks";
import { CHANNEL_COLOR, CHANNEL_LABEL, STATUS_ACTION, STATUS_COLOR, STATUS_LABEL } from "@/lib/labels";
import { useMe, useStore } from "@/lib/store";
import type { OrderStatus, WidgetSize, WidgetType } from "@/lib/types";

export type WidgetProps = { size: WidgetSize; range: Range };

/* ------------------------------------------------------------ frame */

export function WidgetFrame({ title, sub, action, children, className, bodyClass }: { title: ReactNode; sub?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; bodyClass?: string }) {
  return (
    <Panel className={cn("flex h-full flex-col", className)}>
      <div className="flex items-start justify-between gap-3 px-5 pt-4">
        <div className="min-w-0">
          <h3 className="truncate text-[15px] font-semibold tracking-[-0.01em] text-ink">{title}</h3>
          {sub && <p className="mt-0.5 truncate text-[13px] text-ink-3">{sub}</p>}
        </div>
        {action}
      </div>
      <div className={cn("min-h-0 flex-1 px-5 pb-5 pt-3", bodyClass)}>{children}</div>
    </Panel>
  );
}

function MoreLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="-mr-1.5 inline-flex h-7 shrink-0 items-center gap-1 rounded-sm px-1.5 text-[13px] font-medium text-brand-ink transition-colors hover:bg-brand-50">
      {children}
      <ArrowRight className="size-3.5" weight="bold" />
    </Link>
  );
}

function rangeLabel(t: ReturnType<typeof useT>, r: Range) {
  return { today: t("today", "আজ"), "7d": t("last 7 days", "গত ৭ দিন"), "30d": t("last 30 days", "গত ৩০ দিন") }[r];
}

function prevLabel(t: ReturnType<typeof useT>, r: Range) {
  return { today: t("yesterday", "গতকাল"), "7d": t("previous 7 days", "আগের ৭ দিন"), "30d": t("previous 30 days", "আগের ৩০ দিন") }[r];
}

function Delta({ value, invert = false }: { value: number | null; invert?: boolean }) {
  const f = useFmt();
  if (value === null || !Number.isFinite(value)) return <span className="text-xs text-ink-4">—</span>;
  const up = value >= 0;
  const good = invert ? !up : up;
  const I = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cn("tnum inline-flex items-center gap-0.5 text-xs font-semibold", good ? "text-ok" : "text-danger")}>
      <I className="size-3.5" weight="bold" />
      {f.pct(Math.abs(value))}
    </span>
  );
}

/* ------------------------------------------------------------ 1. greeting */

export function GreetingWidget() {
  const t = useT();
  const f = useFmt();
  const nowMs = useNow();
  const me = useMe();
  const orders = useStore((s) => s.orders);
  const now = new Date(nowMs);
  const today = useMemo(() => kpis(orders, "today", new Date(nowMs)).cur, [orders, nowMs]);
  const toPack = orders.filter((o) => o.status === "confirmed").length;
  const toShip = orders.filter((o) => o.status === "packed").length;
  const cod = useMemo(() => codByCourier(orders).total, [orders]);
  const h = now.getHours();
  const hello = h < 5 ? t("Working late", "অনেক রাত হলো") : h < 12 ? t("Good morning", "শুভ সকাল") : h < 17 ? t("Good afternoon", "শুভ দুপুর") : t("Good evening", "শুভ সন্ধ্যা");
  const bd = toBanglaDate(now);
  const first = me.name.split(" ")[0];
  const dayName = (t.lang === "bn" ? DAYS_BN : DAYS_EN)[now.getDay()];
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-4 pt-1">
      <div className="max-w-[720px]">
        <p className="text-[13px] font-medium text-ink-3">
          {dayName}, {f.dateShort(now)} · {f.digits(String(bd.day))} {t.lang === "bn" ? BANGLA_MONTHS[bd.month] : BANGLA_MONTHS_EN[bd.month]} {f.digits(String(bd.year))}
          {t.lang === "bn" ? " বঙ্গাব্দ" : " BS"}
        </p>
        <h1 className="mt-1.5 font-display text-[30px] font-semibold leading-[1.1] tracking-[-0.025em] text-ink md:text-[38px]">
          {hello}, {first}
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-2 md:text-base">
          {today.orders > 0 ? (
            t.lang === "bn" ? (
              <>
                আজ <b className="font-semibold text-ink">{f.num(today.orders)}টি অর্ডারে</b> বিক্রি <b className="font-semibold text-ink">{f.money(today.sales)}</b>।{" "}
              </>
            ) : (
              <>
                You&apos;ve sold <b className="font-semibold text-ink">{f.money(today.sales)}</b> across <b className="font-semibold text-ink">{f.num(today.orders)} {today.orders === 1 ? "order" : "orders"}</b> today.{" "}
              </>
            )
          ) : (
            t("No sales yet today — the first one is a tap away. ", "আজ এখনো কোনো বিক্রি নেই — প্রথমটা এক ট্যাপেই। ")
          )}
          {toPack + toShip > 0 &&
            (t.lang === "bn" ? (
              <>
                <b className="font-semibold text-ink">{f.num(toPack)}টি</b> প্যাক আর <b className="font-semibold text-ink">{f.num(toShip)}টি</b> পাঠানোর অপেক্ষায়।{" "}
              </>
            ) : (
              <>
                <b className="font-semibold text-ink">{f.num(toPack)}</b> {toPack === 1 ? "parcel is" : "parcels are"} waiting to be packed and <b className="font-semibold text-ink">{f.num(toShip)}</b> {toShip === 1 ? "is" : "are"} ready to ship.{" "}
              </>
            ))}
          {cod > 0 &&
            (t.lang === "bn" ? (
              <>
                কুরিয়ারের কাছে আছে <b className="font-semibold text-cash-ink">{f.money(cod)}</b>।
              </>
            ) : (
              <>
                <b className="font-semibold text-cash-ink">{f.money(cod)}</b> is still with couriers.
              </>
            ))}
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ 2. KPI strip */

export function KpisWidget({ range, size }: WidgetProps) {
  const t = useT();
  const f = useFmt();
  const can = useCan();
  const nowMs = useNow();
  const orders = useStore((s) => s.orders);
  const k = useMemo(() => kpis(orders, range, new Date(nowMs)), [orders, range, nowMs]);
  const series = useMemo(() => salesSeries(orders, range === "today" ? "7d" : range, new Date(nowMs)).map((p) => p.value), [orders, range, nowMs]);
  const showProfit = can("view_cost");
  const cells: { label: string; value: string; delta: number | null; extra?: ReactNode; prev: string }[] = [
    { label: t("Sales", "বিক্রি"), value: f.money(k.cur.sales), delta: k.delta.sales, prev: f.money(k.prev.sales), extra: <Sparkline values={series} width={84} height={26} /> },
    { label: t("Orders", "অর্ডার"), value: f.num(k.cur.orders), delta: k.delta.orders, prev: f.num(k.prev.orders) },
    { label: t("Average order", "গড় অর্ডার"), value: f.money(Math.round(k.cur.aov)), delta: k.delta.aov, prev: f.money(Math.round(k.prev.aov)) },
    showProfit
      ? { label: t("Gross profit", "মোট লাভ"), value: f.money(k.cur.profit), delta: k.delta.profit, prev: f.money(k.prev.profit) }
      : { label: t("Items sold", "বিক্রিত পণ্য"), value: f.num(k.cur.units), delta: null, prev: "—" },
  ];
  return (
    <Panel className="h-full overflow-hidden">
      <div className={cn("grid h-full grid-cols-2 divide-line", size === "xl" ? "lg:grid-cols-4 lg:divide-x" : "")}>
        {cells.map((c, i) => (
          <div key={c.label} className={cn("flex flex-col justify-between gap-3 px-5 py-4", i < 2 && "border-b border-line", size === "xl" && "lg:border-b-0", i % 2 === 0 && size !== "xl" && "border-r border-line", i % 2 === 0 && size === "xl" && "max-lg:border-r max-lg:border-line")}>
            <div className="flex items-start justify-between gap-2">
              <p className="text-[13px] font-medium text-ink-3">{c.label}</p>
              <Delta value={c.delta} />
            </div>
            <div className="flex items-end justify-between gap-2">
              <p className="figure truncate text-[28px] font-semibold leading-none text-ink md:text-[32px]">{c.value}</p>
              {c.extra && <span className="hidden shrink-0 sm:block">{c.extra}</span>}
            </div>
            <p className="tnum truncate text-xs text-ink-4">
              {prevLabel(t, range)} {c.prev}
            </p>
          </div>
        ))}
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------ 3. parcel journey (signature) */

const STAGE_ICON: Record<string, Icon> = { draft: PencilSimple, confirmed: CheckCircle, packed: Package, shipped: Truck };

export function JourneyWidget() {
  const t = useT();
  const f = useFmt();
  const nowMs = useNow();
  const orders = useStore((s) => s.orders);
  const j = useMemo(() => journey(orders, new Date(nowMs)), [orders, nowMs]);
  const openTotal = j.open.reduce((s, x) => s + x.value, 0);
  const openCount = j.open.reduce((s, x) => s + x.count, 0);
  return (
    <Panel className="relative h-full overflow-hidden">
      <div className="flex flex-wrap items-end justify-between gap-3 px-5 pt-4">
        <div>
          <h3 className="text-[15px] font-semibold tracking-[-0.01em] text-ink">{t("Parcel journey", "পার্সেলের যাত্রা")}</h3>
          <p className="mt-0.5 text-[13px] text-ink-3">
            {t.lang === "bn" ? `${f.num(openCount)}টি অর্ডার চলমান · ${f.money(openTotal)}` : `${f.num(openCount)} orders on the move · ${f.money(openTotal)}`}
          </p>
        </div>
        <MoreLink href="/orders?view=board">{t("Open board", "বোর্ড খুলুন")}</MoreLink>
      </div>

      {/* Phones: the journey reads top to bottom, like a delivery timeline. */}
      <ol className="px-5 pb-5 pt-4 md:hidden">
        {j.open.map((s) => {
          const I = STAGE_ICON[s.status];
          const color = STATUS_COLOR[s.status];
          return (
            <li key={s.status} className="relative pb-3 pl-14 last:pb-0">
              <span className="absolute bottom-0 left-[19px] top-10 w-0.5 rounded" style={{ background: s.count ? `repeating-linear-gradient(${color} 0 5px, transparent 5px 10px)` : "var(--line-strong)" }} aria-hidden />
              <Link href={`/orders?status=${s.status}`} className="flex min-h-11 items-center gap-3">
                <span className="absolute left-0 top-0 grid size-10 place-items-center rounded-full border-2 bg-surface" style={{ borderColor: color, color }}>
                  <I className="size-[18px]" weight="duotone" />
                </span>
                <span className="flex-1">
                  <span className="block text-[13.5px] font-medium" style={{ color }}>{t.pick(STATUS_LABEL[s.status])}</span>
                  <span className="tnum block text-xs text-ink-3">{f.money(s.value)}</span>
                </span>
                <span className="figure text-[26px] font-semibold text-ink">{f.num(s.count)}</span>
              </Link>
            </li>
          );
        })}
        <li className="mt-3 flex gap-2 pl-14">
          <Link href="/orders?status=delivered" className="flex-1 rounded-md bg-ok-soft px-3 py-2">
            <span className="figure block text-xl font-semibold text-ink">{f.num(j.delivered.count)}</span>
            <span className="block text-xs font-medium text-ok">{t("Delivered", "ডেলিভারি")}</span>
          </Link>
          <Link href="/orders?status=returned" className="flex-1 rounded-md bg-danger-soft px-3 py-2">
            <span className="figure block text-xl font-semibold text-ink">{f.num(j.returned.count)}</span>
            <span className="block text-xs font-medium text-danger">
              {t("Returned", "ফেরত")} · {f.pct(j.returnRate, 1)}
            </span>
          </Link>
        </li>
      </ol>

      <div className="scroll-thin hidden overflow-x-auto px-5 pb-5 pt-5 md:block">
        <ol className="relative grid min-w-[760px] grid-cols-[repeat(4,minmax(0,1fr))_minmax(0,1.25fr)] items-stretch">
          {j.open.map((s) => {
            const I = STAGE_ICON[s.status];
            const color = STATUS_COLOR[s.status];
            return (
              <li key={s.status} className="relative">
                <Link href={`/orders?status=${s.status}`} className="group block pr-4">
                  <div className="relative flex items-center">
                    <span className="relative z-10 grid size-11 place-items-center rounded-full border-2 bg-surface transition-transform duration-200 group-hover:scale-105" style={{ borderColor: color, color }}>
                      <I className="size-5" weight="duotone" />
                    </span>
                    {/* flowing connector to the next stage */}
                    <svg className="absolute left-11 right-0 top-1/2 h-2 -translate-y-1/2" preserveAspectRatio="none" viewBox="0 0 100 8" aria-hidden>
                      <line x1="0" y1="4" x2="100" y2="4" stroke="var(--line-strong)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                      {s.count > 0 && (
                        <line x1="0" y1="4" x2="100" y2="4" stroke={color} strokeWidth="2" strokeDasharray="6 6" vectorEffect="non-scaling-stroke" style={{ animation: "flow 1.1s linear infinite" }} />
                      )}
                    </svg>
                  </div>
                  <p className="figure mt-3 text-[34px] font-semibold leading-none text-ink">{f.num(s.count)}</p>
                  <p className="mt-1.5 text-[13px] font-medium" style={{ color }}>
                    {t.pick(STATUS_LABEL[s.status])}
                  </p>
                  <p className="tnum mt-0.5 text-xs text-ink-3">{f.money(s.value)}</p>
                </Link>
              </li>
            );
          })}
          {/* outcome fork: delivered vs returned, last 7 days */}
          <li className="relative pl-1">
            <div className="flex h-full flex-col justify-center gap-2.5 rounded-lg border border-line bg-surface-2 p-3.5">
              <Link href="/orders?status=delivered" className="flex items-center gap-3 rounded-md px-1 py-0.5 hover:bg-surface">
                <span className="size-2.5 rounded-full" style={{ background: STATUS_COLOR.delivered }} />
                <span className="flex-1 text-[13px] font-medium text-ink-2">{t("Delivered", "ডেলিভারি")}</span>
                <span className="figure text-xl font-semibold text-ink">{f.num(j.delivered.count)}</span>
              </Link>
              <Link href="/orders?status=returned" className="flex items-center gap-3 rounded-md px-1 py-0.5 hover:bg-surface">
                <span className="size-2.5 rounded-full" style={{ background: STATUS_COLOR.returned }} />
                <span className="flex-1 text-[13px] font-medium text-ink-2">{t("Returned", "ফেরত")}</span>
                <span className="figure text-xl font-semibold text-ink">{f.num(j.returned.count)}</span>
              </Link>
              <div className="mt-0.5 border-t border-line pt-2.5">
                <div className="flex h-1.5 overflow-hidden rounded-full bg-sunken">
                  <span style={{ width: `${(1 - j.returnRate) * 100}%`, background: STATUS_COLOR.delivered }} />
                  <span className="ml-0.5" style={{ width: `${j.returnRate * 100}%`, background: STATUS_COLOR.returned }} />
                </div>
                <p className="mt-1.5 text-xs text-ink-3">
                  {t("Return rate this week", "এই সপ্তাহে ফেরতের হার")} <b className="tnum font-semibold text-ink">{f.pct(j.returnRate, 1)}</b>
                </p>
              </div>
            </div>
          </li>
        </ol>
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------ 4. sales trend */

export function SalesTrendWidget({ range, size }: WidgetProps) {
  const t = useT();
  const f = useFmt();
  const nowMs = useNow();
  const orders = useStore((s) => s.orders);
  const r: Range = range;
  const series = useMemo(() => salesSeries(orders, r, new Date(nowMs)), [orders, r, nowMs]);
  const total = series.reduce((s, p) => s + p.value, 0);
  const prev = series.reduce((s, p) => s + (p.compare ?? 0), 0);
  const data = series.map((p) => ({
    label: r === "today" ? f.time(p.date).replace(/:00/, "") : f.dateShort(p.date),
    tip: r === "today" ? f.time(p.date) : `${(t.lang === "bn" ? DAYS_BN : DAYS_EN)[p.date.getDay()]}, ${f.dateShort(p.date)}`,
    value: p.value,
    compare: p.compare,
  }));
  return (
    <WidgetFrame
      title={t("Sales", "বিক্রি")}
      sub={rangeLabel(t, r)}
      action={
        <div className="text-right">
          <p className="figure text-[22px] font-semibold leading-none text-ink">{f.money(total)}</p>
          <p className="mt-1">
            <Delta value={prev ? (total - prev) / prev : null} />
          </p>
        </div>
      }
    >
      <AreaChart data={data} height={size === "m" ? 180 : 230} format={(n) => f.compact(n)} valueLabel={t("This period", "এই সময়")} compareLabel={prevLabel(t, r)} />
    </WidgetFrame>
  );
}

/* ------------------------------------------------------------ 5. COD with couriers */

export function CodCourierWidget() {
  const t = useT();
  const f = useFmt();
  const nowMs = useNow(300_000);
  const orders = useStore((s) => s.orders);
  const cod = useMemo(() => codByCourier(orders, new Date(nowMs)), [orders, nowMs]);
  return (
    <WidgetFrame title={t("Cash with couriers", "কুরিয়ারের কাছে টাকা")} sub={t("Delivered, not yet paid out", "ডেলিভারি হয়েছে, টাকা আসেনি")} action={<MoreLink href="/money?tab=cod">{t("Collect", "সংগ্রহ")}</MoreLink>}>
      <div className="rounded-md bg-cash-soft px-4 py-3">
        <p className="figure text-[30px] font-semibold leading-none text-cash-ink">{f.money(cod.total)}</p>
        <p className="mt-1 text-xs text-cash-ink/80">
          {t.lang === "bn" ? `${f.num(cod.rows.reduce((s, r) => s + r.count, 0))}টি অর্ডার` : `${f.num(cod.rows.reduce((s, r) => s + r.count, 0))} orders`}
        </p>
      </div>
      <ul className="mt-3 space-y-1">
        {cod.rows.map((r) => {
          const days = Math.floor((nowMs - new Date(r.oldest).getTime()) / 86_400_000);
          return (
            <li key={r.courier} className="flex items-center gap-3 py-1.5">
              <span className="grid size-8 place-items-center rounded-full bg-sunken text-[11px] font-bold text-ink-2">{r.courier.slice(0, 2)}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-ink">{r.courier}</span>
                <span className={cn("flex items-center gap-1 text-xs", days > 5 ? "text-danger" : "text-ink-3")}>
                  {days > 5 && <Clock className="size-3.5" weight="bold" />}
                  {t.lang === "bn" ? `সবচেয়ে পুরোনো ${f.num(days)} দিন` : `oldest ${f.num(days)} days`}
                </span>
              </span>
              <Money value={r.amount} className="text-sm font-semibold text-ink" />
            </li>
          );
        })}
        {cod.rows.length === 0 && <li className="py-4 text-center text-sm text-ink-3">{t("Every COD payout is in. Nice.", "সব COD টাকা চলে এসেছে।")}</li>}
      </ul>
    </WidgetFrame>
  );
}

/* ------------------------------------------------------------ 6. low stock */

export function LowStockWidget({ size }: WidgetProps) {
  const t = useT();
  const f = useFmt();
  const products = useStore((s) => s.products);
  const list = useMemo(() => lowStock(products), [products]);
  const n = size === "s" ? 4 : 6;
  return (
    <WidgetFrame
      title={t("Running low", "স্টক কমে আসছে")}
      sub={t.lang === "bn" ? `${f.num(list.length)}টি ভ্যারিয়েন্ট` : `${f.num(list.length)} variants need restocking`}
      action={<MoreLink href="/inventory?action=stock-in">{t("Restock", "স্টক ইন")}</MoreLink>}
    >
      <ul className="space-y-0.5">
        {list.slice(0, n).map(({ p, v, avail }) => (
          <li key={v.id}>
            <Link href={`/products/${p.id}`} className="-mx-2 flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-surface-2">
              <ProductThumb product={p} size={34} rounded="sm" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] font-medium text-ink">{t.lang === "bn" ? p.nameBn ?? p.name : p.name}</span>
                <span className="block truncate text-xs text-ink-3">{Object.values(v.options).join(" / ") || v.sku}</span>
              </span>
              <Badge tone={avail <= 0 ? "danger" : "warn"} className="tnum">
                {avail <= 0 ? t("Out", "শেষ") : t.lang === "bn" ? `${f.num(avail)}টি` : `${f.num(avail)} left`}
              </Badge>
            </Link>
          </li>
        ))}
        {list.length === 0 && <li className="py-4 text-center text-sm text-ink-3">{t("Everything is well stocked.", "সব পণ্যের পর্যাপ্ত স্টক আছে।")}</li>}
      </ul>
    </WidgetFrame>
  );
}

/* ------------------------------------------------------------ 7. top products */

export function TopProductsWidget({ range, size }: WidgetProps) {
  const t = useT();
  const f = useFmt();
  const nowMs = useNow();
  const orders = useStore((s) => s.orders);
  const products = useStore((s) => s.products);
  const top = useMemo(() => topProducts(orders, products, range, new Date(nowMs), size === "s" ? 5 : 6), [orders, products, range, nowMs, size]);
  const max = Math.max(1, ...top.map((x) => x.revenue));
  return (
    <WidgetFrame title={t("Best sellers", "সেরা বিক্রি")} sub={rangeLabel(t, range)} action={<MoreLink href="/reports">{t("Report", "রিপোর্ট")}</MoreLink>}>
      <ol className="space-y-2.5">
        {top.map((x, i) => (
          <li key={x.productId} className="flex items-center gap-3">
            <span className="tnum w-3 text-xs font-semibold text-ink-4">{f.num(i + 1)}</span>
            <ProductThumb product={x.product} size={32} rounded="sm" />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-[13.5px] font-medium text-ink">{t.lang === "bn" ? x.product.nameBn ?? x.product.name : x.product.name}</span>
                <Money value={x.revenue} className="shrink-0 text-[13px] font-semibold text-ink" />
              </div>
              <div className="mt-1.5 flex items-center gap-2">
                <div className="h-1 flex-1 overflow-hidden rounded-full bg-sunken">
                  <div className="h-full rounded-full bg-brand" style={{ width: `${(x.revenue / max) * 100}%` }} />
                </div>
                <span className="tnum shrink-0 text-[11px] text-ink-3">{t.lang === "bn" ? `${f.num(x.units)}টি` : `${f.num(x.units)} sold`}</span>
              </div>
            </div>
          </li>
        ))}
        {top.length === 0 && <li className="py-4 text-center text-sm text-ink-3">{t("No sales in this period yet.", "এই সময়ে এখনো বিক্রি নেই।")}</li>}
      </ol>
    </WidgetFrame>
  );
}

/* ------------------------------------------------------------ 8. channel mix */

export function ChannelMixWidget({ range, size }: WidgetProps) {
  const t = useT();
  const f = useFmt();
  const nowMs = useNow();
  const orders = useStore((s) => s.orders);
  const mix = useMemo(() => channelMix(orders, range, new Date(nowMs)), [orders, range, nowMs]);
  const [hover, setHover] = useState<string | null>(null);
  const total = mix.reduce((s, m) => s + m.sales, 0);
  const shown = hover ? mix.find((m) => m.channel === hover) : null;
  return (
    <WidgetFrame title={t("Where orders come from", "অর্ডার কোথা থেকে আসে")} sub={rangeLabel(t, range)}>
      <div className={cn("flex gap-5", size === "s" ? "flex-col items-center" : "items-center")}>
        <Donut
          size={size === "s" ? 136 : 148}
          onHover={setHover}
          data={mix.map((m) => ({ key: m.channel, value: m.sales, color: CHANNEL_COLOR[m.channel], label: t.pick(CHANNEL_LABEL[m.channel]) }))}
          center={
            <div>
              <p className="figure text-lg font-semibold leading-none text-ink">{f.compact(shown ? shown.sales : total)}</p>
              <p className="mt-1 text-[11px] text-ink-3">{shown ? t.pick(CHANNEL_LABEL[shown.channel]) : t("total", "মোট")}</p>
            </div>
          }
        />
        <ul className="w-full min-w-0 flex-1 space-y-1.5">
          {mix.slice(0, 5).map((m) => (
            <li key={m.channel} className={cn("flex items-center gap-2 rounded-sm px-1 py-0.5 text-[13px] transition-opacity", hover && hover !== m.channel && "opacity-40")}>
              <ChannelIcon channel={m.channel} />
              <span className="min-w-0 flex-1 truncate text-ink-2">{t.pick(CHANNEL_LABEL[m.channel])}</span>
              <span className="tnum font-semibold text-ink">{f.pct(total ? m.sales / total : 0)}</span>
            </li>
          ))}
        </ul>
      </div>
    </WidgetFrame>
  );
}

/* ------------------------------------------------------------ 9. recent orders */

const NEXT_STEP: Partial<Record<OrderStatus, OrderStatus>> = { draft: "confirmed", confirmed: "packed", packed: "shipped", shipped: "delivered" };

export function RecentOrdersWidget({ size }: WidgetProps) {
  const t = useT();
  const f = useFmt();
  const nowMs = useNow();
  const me = useMe();
  const toast = useToast();
  const router = useRouter();
  const orders = useStore((s) => s.orders);
  const transition = useStore((s) => s.transition);
  const recent = useMemo(() => [...orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, size === "m" ? 5 : 7), [orders, size]);
  return (
    <WidgetFrame title={t("Latest orders", "সাম্প্রতিক অর্ডার")} sub={t("Move each one forward without leaving home", "এখান থেকেই অর্ডার এগিয়ে নিন")} action={<MoreLink href="/orders">{t("All orders", "সব অর্ডার")}</MoreLink>} bodyClass="px-2 pb-2">
      <ul className="divide-y divide-line">
        {recent.map((o) => {
          const next = NEXT_STEP[o.status];
          const allowed = next && canTransition(o.status, next, me.role);
          return (
            <li key={o.id} className="flex items-center gap-3 px-3 py-2.5">
              <ChannelIcon channel={o.channel} withBg />
              <Link href={`/orders?id=${o.id}`} className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate text-[13.5px] font-medium text-ink">{o.customer?.name ?? t("Walk-in customer", "দোকানের কাস্টমার")}</span>
                  <span className="tnum shrink-0 text-xs text-ink-4">#{f.digits(String(o.no))}</span>
                </span>
                <span className="mt-0.5 flex items-center gap-2 text-xs text-ink-3">
                  <StatusPill status={o.status} size="sm" />
                  <span className="truncate">{f.relative(o.createdAt, nowMs)}</span>
                </span>
              </Link>
              <Money value={orderTotals(o).total} className="hidden text-[13.5px] font-semibold text-ink sm:block" />
              {next && allowed && size !== "m" ? (
                <Button
                  size="sm"
                  variant="soft"
                  className="shrink-0"
                  onClick={() => {
                    if (next === "shipped" && !o.courier) {
                      router.push(`/orders?id=${o.id}`); // shipping needs courier details
                      return;
                    }
                    transition(o.id, next);
                    toast({ title: t(`Order #${o.no} moved to ${STATUS_LABEL[next][0].toLowerCase()}`, `অর্ডার #${f.digits(String(o.no))} — ${STATUS_LABEL[next][1]}`) });
                  }}
                >
                  {t.pick(STATUS_ACTION[next]!)}
                </Button>
              ) : null}
            </li>
          );
        })}
      </ul>
    </WidgetFrame>
  );
}

/* ------------------------------------------------------------ 10. monthly goal */

export function GoalWidget() {
  const t = useT();
  const f = useFmt();
  const nowMs = useNow();
  const orders = useStore((s) => s.orders);
  const goal = useStore((s) => s.monthlyGoal);
  const setGoal = useStore((s) => s.setMonthlyGoal);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(goal));
  const m = useMemo(() => monthToDate(orders, new Date(nowMs)), [orders, nowMs]);
  const progress = goal ? m.sales / goal : 0;
  const paceShare = goal ? m.pace / goal : 0;
  const onTrack = paceShare >= 1;
  return (
    <WidgetFrame
      title={t("Monthly target", "মাসিক লক্ষ্য")}
      sub={t.lang === "bn" ? `${f.num(m.daysInMonth - m.dayOfMonth)} দিন বাকি` : `${f.num(m.daysInMonth - m.dayOfMonth)} days to go`}
      action={
        <button type="button" onClick={() => { setDraft(String(goal)); setEditing((e) => !e); }} className="-mr-1 grid size-8 place-items-center rounded-sm text-ink-3 hover:bg-sunken hover:text-ink" aria-label={t("Edit target", "লক্ষ্য বদলান")}>
          <Target className="size-[18px]" />
        </button>
      }
    >
      {editing ? (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const n = Number(draft.replace(/[^\d]/g, ""));
            if (n > 0) setGoal(n);
            setEditing(false);
          }}
        >
          <label className="text-[13px] font-medium text-ink-2" htmlFor="goal-input">
            {t("Sales target for this month", "এই মাসের বিক্রির লক্ষ্য")}
          </label>
          <Input id="goal-input" autoFocus inputMode="numeric" value={draft} onChange={(e) => setDraft(e.target.value)} leading={<span className="text-sm">৳</span>} />
          <Button type="submit" variant="primary" size="sm">
            {t("Save target", "লক্ষ্য সেভ করুন")}
          </Button>
        </form>
      ) : (
        <div className="flex items-center gap-4">
          <ProgressRing value={progress} size={112} thickness={11} color={onTrack ? "var(--brand)" : "var(--cash)"}>
            <div>
              <p className="figure text-2xl font-semibold leading-none text-ink">{f.pct(progress)}</p>
              <p className="mt-1 text-[11px] text-ink-3">{t("of target", "লক্ষ্যের")}</p>
            </div>
          </ProgressRing>
          <div className="min-w-0 flex-1 space-y-2">
            <div>
              <p className="text-xs text-ink-3">{t("So far", "এ পর্যন্ত")}</p>
              <p className="tnum text-[15px] font-semibold text-ink">{f.money(m.sales)}</p>
            </div>
            <div>
              <p className="text-xs text-ink-3">{t("On pace for", "এই গতিতে হবে")}</p>
              <p className={cn("tnum text-[15px] font-semibold", onTrack ? "text-ok" : "text-cash-ink")}>{f.money(Math.round(m.pace))}</p>
            </div>
            <p className="text-xs text-ink-3">
              {t("Target", "লক্ষ্য")} {f.money(goal)}
            </p>
          </div>
        </div>
      )}
    </WidgetFrame>
  );
}

/* ------------------------------------------------------------ 11. order heatmap */

export function HeatmapWidget() {
  const t = useT();
  const f = useFmt();
  const nowMs = useNow(600_000);
  const orders = useStore((s) => s.orders);
  const hm = useMemo(() => orderHeatmap(orders, new Date(nowMs)), [orders, nowMs]);
  const days = t.lang === "bn" ? DAYS_BN : DAYS_EN;
  const order = [6, 0, 1, 2, 3, 4, 5]; // week starts Saturday in Bangladesh
  const rows = order.map((d) => days[d]);
  const values = order.map((d) => hm.grid[d]);
  const blockLabel = (b: number) => {
    const h = hm.blocks[b];
    const end = (h + 3) % 24;
    return `${f.digits(String(h % 12 || 12))}–${f.digits(String(end % 12 || 12))}${end < 12 || end === 24 ? (t.lang === "bn" ? "" : "am") : t.lang === "bn" ? "" : "pm"}`;
  };
  const best = values.reduce<[number, number, number]>(
    (acc, row, ri) => row.reduce<[number, number, number]>((a, v, ci) => (v > a[2] ? [ri, ci, v] : a), acc),
    [0, 0, -1],
  );
  return (
    <WidgetFrame title={t("When orders arrive", "কখন অর্ডার আসে")} sub={t("Last 4 weeks, by day and time", "গত ৪ সপ্তাহ, দিন ও সময় অনুযায়ী")}>
      <HeatGrid
        rows={rows}
        cols={hm.blocks.map((_, i) => blockLabel(i))}
        values={values}
        tip={(r, c, v) => (t.lang === "bn" ? `${rows[r]}, ${blockLabel(c)}: ${f.num(v)}টি অর্ডার` : `${rows[r]}, ${blockLabel(c)}: ${f.num(v)} orders`)}
      />
      {best[2] > 0 && (
        <p className="mt-4 flex items-start gap-2 rounded-md bg-brand-50 px-3 py-2 text-[13px] text-brand-ink">
          <Lightning className="mt-0.5 size-4 shrink-0" weight="fill" />
          {t.lang === "bn"
            ? `সবচেয়ে ব্যস্ত সময় ${rows[best[0]]} ${blockLabel(best[1])}। বুস্ট পোস্ট ও লাইভ এর আগে দিন।`
            : `Busiest on ${rows[best[0]]} ${blockLabel(best[1])}. Schedule boosts and lives just before.`}
        </p>
      )}
    </WidgetFrame>
  );
}

/* ------------------------------------------------------------ 12. returns watch */

export function ReturnsWatchWidget() {
  const t = useT();
  const f = useFmt();
  const nowMs = useNow();
  const orders = useStore((s) => s.orders);
  const customers = useStore((s) => s.customers);
  const j = useMemo(() => journey(orders, new Date(nowMs)), [orders, nowMs]);
  const risky = useMemo(() => customers.filter((c) => riskLevel(c, customerStats(c, orders)) === "risky"), [customers, orders]);
  const byDistrict = useMemo(() => {
    const m = new Map<string, number>();
    for (const o of orders) if (o.status === "returned" && o.customer?.address) m.set(o.customer.address.district, (m.get(o.customer.address.district) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  }, [orders]);
  return (
    <WidgetFrame title={t("Returns watch", "ফেরতের দিকে নজর")} sub={t("Last 7 days", "গত ৭ দিন")} action={<MoreLink href="/customers?risk=risky">{t("Customers", "কাস্টমার")}</MoreLink>}>
      <div className="flex items-baseline gap-2">
        <p className="figure text-[30px] font-semibold leading-none text-ink">{f.pct(j.returnRate, 1)}</p>
        <p className="text-xs text-ink-3">{t("of finished parcels came back", "পার্সেল ফেরত এসেছে")}</p>
      </div>
      <div className="mt-4 space-y-2">
        <Link href="/customers?risk=risky" className="flex items-center gap-2 rounded-md bg-danger-soft px-3 py-2 text-[13px] text-danger hover:brightness-[0.98]">
          <WarningCircle className="size-4" weight="fill" />
          <span className="flex-1">{t.lang === "bn" ? `${f.num(risky.length)} জন ঝুঁকিপূর্ণ কাস্টমার` : `${f.num(risky.length)} high-risk customers`}</span>
          <ArrowRight className="size-3.5" />
        </Link>
        {byDistrict.length > 0 && (
          <div className="pt-1">
            <p className="text-xs text-ink-3">{t("Most returns from", "সবচেয়ে বেশি ফেরত")}</p>
            <ul className="mt-1.5 flex flex-wrap gap-1.5">
              {byDistrict.map(([d, n]) => (
                <Badge key={d}>
                  {d} <span className="tnum text-ink-4">{f.num(n)}</span>
                </Badge>
              ))}
            </ul>
          </div>
        )}
      </div>
    </WidgetFrame>
  );
}

/* ------------------------------------------------------------ 13. dues */

export function DuesWidget() {
  const t = useT();
  const f = useFmt();
  const orders = useStore((s) => s.orders);
  const dues = useMemo(() => dueCustomers(orders), [orders]);
  const total = dues.reduce((s, d) => s + d.due, 0);
  return (
    <WidgetFrame title={t("Customers owe you", "কাস্টমারের বাকি")} sub={t.lang === "bn" ? `${f.num(dues.length)} জন` : `${f.num(dues.length)} customers`} action={<MoreLink href="/money?tab=dues">{t("Collect", "আদায়")}</MoreLink>}>
      <p className="figure text-[30px] font-semibold leading-none text-cash-ink">{f.money(total)}</p>
      <ul className="mt-3 space-y-1">
        {dues.slice(0, 4).map((d) => (
          <li key={d.customerId} className="flex items-center justify-between gap-2 py-1 text-[13px]">
            <span className="truncate text-ink-2">{d.name}</span>
            <Money value={d.due} className="font-semibold text-ink" />
          </li>
        ))}
        {dues.length === 0 && <li className="py-3 text-sm text-ink-3">{t("Nobody owes you anything right now.", "এখন কারো কাছে বাকি নেই।")}</li>}
      </ul>
    </WidgetFrame>
  );
}

/* ------------------------------------------------------------ 14. quick actions */

export function QuickActionsWidget({ size }: WidgetProps) {
  const t = useT();
  const orders = useStore((s) => s.orders);
  const packedIds = orders.filter((o) => o.status === "packed" || o.status === "confirmed").map((o) => o.id);
  const actions: { href: string; icon: Icon; en: string; bn: string; tone?: "brand" }[] = [
    { href: "/pos", icon: Plus, en: "New order", bn: "নতুন অর্ডার", tone: "brand" },
    { href: packedIds.length ? `/invoice/${packedIds.join(",")}?doc=label` : "/orders", icon: Printer, en: "Print today's labels", bn: "আজকের লেবেল প্রিন্ট" },
    { href: "/inventory?action=stock-in", icon: Truck, en: "Stock in", bn: "স্টক ইন" },
    { href: "/products/new", icon: Storefront, en: "Add product", bn: "পণ্য যোগ" },
    { href: "/money?tab=expenses", icon: Receipt, en: "Record expense", bn: "খরচ লিখুন" },
    { href: "/customers?new=1", icon: UsersThree, en: "Add customer", bn: "কাস্টমার যোগ" },
  ];
  return (
    <WidgetFrame title={t("Quick actions", "দ্রুত কাজ")}>
      <div className={cn("grid gap-2", size === "xl" ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6" : size === "m" ? "grid-cols-3" : "grid-cols-2")}>
        {actions.map((a) => {
          const I = a.icon;
          return (
            <Link
              key={a.href + a.en}
              href={a.href}
              className={cn(
                "flex min-h-[84px] flex-col justify-between gap-2 rounded-md border p-3 text-[13px] font-medium transition-all hover:-translate-y-px hover:shadow-2",
                a.tone === "brand" ? "border-transparent bg-brand text-brand-contrast" : "border-line bg-surface-2 text-ink hover:border-line-strong hover:bg-surface",
              )}
            >
              <I className={cn("size-5", a.tone === "brand" ? "" : "text-brand-ink")} weight="duotone" />
              {t(a.en, a.bn)}
            </Link>
          );
        })}
      </div>
    </WidgetFrame>
  );
}

/* ------------------------------------------------------------ 15. profit receipt */

export function ProfitWaterfallWidget({ range }: WidgetProps) {
  const t = useT();
  const f = useFmt();
  const can = useCan();
  const nowMs = useNow();
  const orders = useStore((s) => s.orders);
  const expenses = useStore((s) => s.expenses);
  const p = useMemo(() => profitBreakdown(orders, expenses, range, new Date(nowMs)), [orders, expenses, range, nowMs]);
  if (!can("view_cost"))
    return (
      <WidgetFrame title={t("Real profit", "আসল লাভ")}>
        <div className="flex h-full flex-col items-center justify-center gap-2 py-6 text-center">
          <LockSimple className="size-6 text-ink-4" />
          <p className="text-sm text-ink-3">{t("Only the owner and managers can see costs and profit.", "শুধু মালিক ও ম্যানেজার খরচ ও লাভ দেখতে পারেন।")}</p>
        </div>
      </WidgetFrame>
    );
  const rows: [string, number][] = [
    [t("Product sales", "পণ্য বিক্রি"), p.revenue],
    [t("Returned goods", "ফেরত পণ্য"), -p.returnsValue],
    [t("Discounts", "ছাড়"), -p.discounts],
    [t("Cost of goods", "পণ্যের ক্রয়মূল্য"), -p.cogs],
    [t("Delivery charge − courier fee", "ডেলিভারি চার্জ − কুরিয়ার ফি"), p.deliveryNet],
    [t("Return fees", "ফেরত চার্জ"), -p.returnFees],
    [t("Facebook ads", "বিজ্ঞাপন"), -p.ads],
    [t("Rent, salary, packaging", "ভাড়া, বেতন, প্যাকেজিং"), -p.other],
  ];
  const margin = p.revenue ? p.net / p.revenue : 0;
  return (
    <WidgetFrame title={t("Real profit", "আসল লাভ")} sub={t(`After returns, delivery and every expense · ${rangeLabel(t, range)}`, `ফেরত, ডেলিভারি ও সব খরচের পরে · ${rangeLabel(t, range)}`)} action={<MoreLink href="/reports">{t("Details", "বিস্তারিত")}</MoreLink>}>
      <div className="relative rounded-md border border-dashed border-line-strong bg-surface-2 px-4 pb-3 pt-2">
        <ul>
          {rows.map(([label, v]) => (
            <li key={label} className="flex items-baseline gap-2 py-[5px] text-[13px]">
              <span className="shrink-0 text-ink-2">{label}</span>
              <span className="mb-1 min-w-4 flex-1 border-b border-dotted border-line-strong" aria-hidden />
              <span className={cn("tnum shrink-0 font-medium", v < 0 ? "text-ink-2" : "text-ink")}>{f.money(v, { sign: v > 0 && label !== rows[0][0] })}</span>
            </li>
          ))}
        </ul>
        <div className="mt-2 flex items-end justify-between gap-3 border-t-2 border-ink pt-3">
          <div>
            <p className="text-[13px] font-semibold text-ink">{t("Net profit", "নিট লাভ")}</p>
            <p className="tnum text-xs text-ink-3">
              {f.pct(margin, 1)} {t("of sales", "বিক্রির")}
            </p>
          </div>
          <p className={cn("figure text-[30px] font-semibold leading-none", p.net >= 0 ? "text-ok" : "text-danger")}>{f.money(p.net)}</p>
        </div>
      </div>
    </WidgetFrame>
  );
}

/* ------------------------------------------------------------ registry */

export const WIDGETS: Record<WidgetType, { en: string; bn: string; note: string; noteBn: string; icon: Icon; component: (p: WidgetProps) => ReactNode; bare?: boolean }> = {
  greeting: { en: "Greeting & summary", bn: "শুভেচ্ছা ও সারাংশ", note: "Today in one sentence", noteBn: "আজকের অবস্থা এক লাইনে", icon: CheckCircle, component: GreetingWidget, bare: true },
  kpis: { en: "Key numbers", bn: "মূল সংখ্যা", note: "Sales, orders, average order, profit", noteBn: "বিক্রি, অর্ডার, গড়, লাভ", icon: ChartLineUp, component: KpisWidget },
  journey: { en: "Parcel journey", bn: "পার্সেলের যাত্রা", note: "Every open order, stage by stage", noteBn: "চলমান অর্ডার ধাপে ধাপে", icon: Truck, component: JourneyWidget },
  salesTrend: { en: "Sales trend", bn: "বিক্রির ধারা", note: "Compared with the previous period", noteBn: "আগের সময়ের সাথে তুলনা", icon: ChartLineUp, component: SalesTrendWidget },
  codCourier: { en: "Cash with couriers", bn: "কুরিয়ারের কাছে টাকা", note: "COD not yet paid out", noteBn: "যে COD এখনো আসেনি", icon: Wallet, component: CodCourierWidget },
  lowStock: { en: "Running low", bn: "স্টক কম", note: "Variants to restock", noteBn: "যা আবার আনতে হবে", icon: Package, component: LowStockWidget },
  topProducts: { en: "Best sellers", bn: "সেরা বিক্রি", note: "Top products by revenue", noteBn: "আয় অনুযায়ী সেরা পণ্য", icon: Storefront, component: TopProductsWidget },
  channelMix: { en: "Order sources", bn: "অর্ডারের উৎস", note: "Facebook, WhatsApp, walk-in…", noteBn: "ফেসবুক, হোয়াটসঅ্যাপ, দোকান…", icon: UsersThree, component: ChannelMixWidget },
  recentOrders: { en: "Latest orders", bn: "সাম্প্রতিক অর্ডার", note: "Advance orders in one tap", noteBn: "এক ট্যাপে অর্ডার এগিয়ে নিন", icon: Receipt, component: RecentOrdersWidget },
  goal: { en: "Monthly target", bn: "মাসিক লক্ষ্য", note: "Progress and pace", noteBn: "অগ্রগতি ও গতি", icon: Target, component: GoalWidget },
  heatmap: { en: "When orders arrive", bn: "কখন অর্ডার আসে", note: "Busiest days and hours", noteBn: "ব্যস্ত দিন ও সময়", icon: Clock, component: HeatmapWidget },
  returnsWatch: { en: "Returns watch", bn: "ফেরতের দিকে নজর", note: "Return rate and risky buyers", noteBn: "ফেরতের হার ও ঝুঁকি", icon: WarningCircle, component: ReturnsWatchWidget },
  dues: { en: "Customer dues", bn: "কাস্টমারের বাকি", note: "Who owes you money", noteBn: "কার কাছে টাকা বাকি", icon: Wallet, component: DuesWidget },
  quickActions: { en: "Quick actions", bn: "দ্রুত কাজ", note: "Shortcuts you use daily", noteBn: "প্রতিদিনের শর্টকাট", icon: Lightning, component: QuickActionsWidget },
  profitWaterfall: { en: "Real profit", bn: "আসল লাভ", note: "Sales down to net profit", noteBn: "বিক্রি থেকে নিট লাভ", icon: Receipt, component: ProfitWaterfallWidget },
};
