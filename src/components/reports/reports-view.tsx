"use client";

import { CalendarBlank, Printer } from "@phosphor-icons/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { AreaChart, Donut } from "../charts";
import { Avatar, Badge, Button, cn, Segmented } from "../ui/core";
import { ChannelIcon, PageHeader, ProductThumb } from "../bits";
import { byCategory, byChannel, byDistrict, byProduct, byStaff, makeInterval, profitSteps, returnRows, salesIn, series, staffRows, stockRows, totals, type RangeKey, type Row } from "./calc";
import { downloadCsv, isoDay } from "./csv";
import { DataTable, Delta, Locked, RankedBars, ReportSection } from "./parts";
import { Waterfall } from "./waterfall";
import { useCan, useFmt, useT } from "@/lib/hooks";
import { CHANNEL_COLOR, CHANNEL_LABEL } from "@/lib/labels";
import { districtBn } from "@/lib/geo";
import { useStore } from "@/lib/store";
import type { Channel } from "@/lib/types";

const SECTIONS = [
  { id: "sales", en: "Sales", bn: "বিক্রি" },
  { id: "profit", en: "Profit", bn: "লাভ" },
  { id: "stock", en: "Stock", bn: "স্টক" },
  { id: "returns", en: "Returns", bn: "ফেরত" },
  { id: "staff", en: "Staff", bn: "স্টাফ" },
];

export function ReportsView() {
  const t = useT();
  const f = useFmt();
  const can = useCan();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const orders = useStore((s) => s.orders);
  const products = useStore((s) => s.products);
  const expenses = useStore((s) => s.expenses);
  const staff = useStore((s) => s.staff);
  const businessName = useStore((s) => s.business.name);

  const [now] = useState(() => new Date());
  const range = (params.get("range") as RangeKey) || "7d";
  const from = params.get("from") || isoDay(new Date(now.getTime() - 29 * 86_400_000));
  const to = params.get("to") || isoDay(now);
  const setQuery = (patch: Record<string, string>) => {
    const q = new URLSearchParams(params.toString());
    Object.entries(patch).forEach(([k, v]) => q.set(k, v));
    router.replace(`${pathname}?${q.toString()}`, { scroll: false });
  };

  const iv = useMemo(() => makeInterval(range, from, to, now), [range, from, to, now]);
  const lang = t.lang;
  const list = useMemo(() => salesIn(orders, iv.start, iv.end), [orders, iv]);
  const k = useMemo(() => totals(orders, iv), [orders, iv]);
  const trend = useMemo(() => series(orders, iv, now), [orders, iv, now]);
  const viewCost = can("view_cost");

  const rangeLabel =
    range === "custom"
      ? `${f.date(iv.start)} – ${f.date(new Date(iv.end.getTime() - 1))}`
      : range === "today"
        ? t("Today, compared with yesterday", "আজ, গতকালের তুলনায়")
        : range === "7d"
          ? t("Last 7 days, compared with the 7 before", "গত ৭ দিন, আগের ৭ দিনের তুলনায়")
          : t("Last 30 days, compared with the 30 before", "গত ৩০ দিন, আগের ৩০ দিনের তুলনায়");
  const fileTag = `${isoDay(iv.start)}_${isoDay(new Date(iv.end.getTime() - 1))}`;

  return (
    <div className="mx-auto max-w-[1280px] px-4 py-6 md:px-8 md:py-8">
      {/* Print layout: hide app chrome, keep the report. */}
      <style>{`@media print { aside, header, nav, .no-print { display: none !important; } main { padding: 0 !important; } @page { margin: 14mm; } }`}</style>

      <PageHeader
        title={t("Reports", "রিপোর্ট")}
        sub={
          <>
            <span className="hidden print:inline">{businessName} · </span>
            {rangeLabel}
          </>
        }
        actions={
          <Button variant="secondary" icon={<Printer className="size-4" />} onClick={() => window.print()} className="no-print">
            {t("Print or save PDF", "প্রিন্ট বা PDF")}
          </Button>
        }
      />

      {/* Range control — the one row that drives every chart. */}
      <div className="no-print sticky top-14 z-20 -mx-4 mt-5 border-b border-line/70 bg-canvas/90 px-4 py-3 backdrop-blur-md md:top-16 md:-mx-8 md:px-8">
        <div className="flex flex-wrap items-center gap-3">
          <Segmented<RangeKey>
            ariaLabel={t("Date range", "সময়সীমা")}
            value={range}
            onChange={(v) => setQuery({ range: v })}
            options={[
              { value: "today", label: t("Today", "আজ") },
              { value: "7d", label: t("7 days", "৭ দিন") },
              { value: "30d", label: t("30 days", "৩০ দিন") },
              { value: "custom", label: t("Custom", "নিজে বাছুন"), icon: <CalendarBlank className="size-3.5" /> },
            ]}
          />
          {range === "custom" && (
            <div className="flex items-center gap-2 text-[13px] text-ink-3">
              <label className="sr-only" htmlFor="rep-from">{t("From", "থেকে")}</label>
              <input id="rep-from" type="date" value={from} max={to} onChange={(e) => e.target.value && setQuery({ from: e.target.value })} className="h-8 rounded-sm border border-line-strong/80 bg-surface px-2 text-[13px] text-ink focus:border-brand focus:shadow-[var(--ring)] focus:outline-none" />
              <span>–</span>
              <label className="sr-only" htmlFor="rep-to">{t("To", "পর্যন্ত")}</label>
              <input id="rep-to" type="date" value={to} min={from} max={isoDay(now)} onChange={(e) => e.target.value && setQuery({ to: e.target.value })} className="h-8 rounded-sm border border-line-strong/80 bg-surface px-2 text-[13px] text-ink focus:border-brand focus:shadow-[var(--ring)] focus:outline-none" />
            </div>
          )}
          <nav className="no-scrollbar -mx-1 flex w-full gap-1 overflow-x-auto px-1 md:ml-auto md:w-auto" aria-label={t("Report sections", "রিপোর্টের অংশ")}>
            {SECTIONS.map((s) => (
              <a key={s.id} href={`#${s.id}`} className="shrink-0 rounded-full px-3 py-1.5 text-[13px] font-medium text-ink-3 transition-colors hover:bg-sunken hover:text-ink">
                {t(s.en, s.bn)}
              </a>
            ))}
          </nav>
        </div>
      </div>

      {/* Headline numbers: one strip, separated by rules — not a card grid. */}
      <section aria-label={t("Summary", "সারাংশ")} className="mt-6 grid grid-cols-2 overflow-hidden rounded-lg border border-line bg-surface shadow-1 md:grid-cols-[minmax(0,1.5fr)_repeat(4,minmax(0,1fr))]">
        <div className="col-span-2 border-b border-line p-5 md:col-span-1 md:border-b-0 md:border-r">
          <p className="text-[13px] text-ink-3">{t("Sales", "বিক্রি")}</p>
          <p className="figure mt-1 text-[38px] font-semibold leading-none text-ink">{f.money(k.cur.sales)}</p>
          <div className="mt-2 flex items-center gap-2">
            <Delta value={k.delta.sales} />
            <span className="text-xs text-ink-4">{t("vs", "আগে")} {f.money(k.prev.sales)}</span>
          </div>
        </div>
        {[
          { label: t("Orders", "অর্ডার"), value: f.num(k.cur.orders), delta: <Delta value={k.delta.orders} /> },
          { label: t("Average order", "গড় অর্ডার"), value: f.money(k.cur.aov), delta: <Delta value={k.delta.aov} /> },
          viewCost
            ? { label: t("Gross profit", "মোট লাভ"), value: f.money(k.cur.profit), delta: <Delta value={k.delta.profit} /> }
            : { label: t("Units sold", "বিক্রিত পিস"), value: f.num(k.cur.units), delta: null },
          { label: t("Return rate", "ফেরতের হার"), value: f.pct(k.cur.returnRate, 1), delta: <Delta value={k.delta.returnRate} invert points /> },
        ].map((m, i) => (
          <div key={i} className={cn("p-5", i % 2 === 0 ? "border-r border-line" : "md:border-r", i < 2 && "border-b border-line md:border-b-0", i === 3 && "md:border-r-0")}>
            <p className="text-[13px] text-ink-3">{m.label}</p>
            <p className="figure mt-1 text-[26px] font-semibold leading-none text-ink">{m.value}</p>
            <div className="mt-2 min-h-4">{m.delta}</div>
          </div>
        ))}
      </section>

      <div className="mt-6 grid grid-cols-1 gap-5">
        {/* ---------------- Sales */}
        <h2 id="sales" className="scroll-mt-32 pt-2 font-display text-xl font-semibold text-ink">{t("Sales", "বিক্রি")}</h2>
        <ReportSection
          title={t("Sales over time", "সময় অনুযায়ী বিক্রি")}
          sub={trend.hourly ? t("Running total through the day", "দিনের মোট, ঘণ্টা অনুযায়ী") : t("Per day, product sales without delivery charge", "প্রতিদিন, ডেলিভারি চার্জ ছাড়া")}
          onExport={() =>
            downloadCsv(`sales_${fileTag}`, ["date", "sales", "previous_period"], trend.points.map((p) => [trend.hourly ? p.date.toISOString() : isoDay(p.date), Math.round(p.value), Math.round(p.compare)]))
          }
          render={(asTable) =>
            asTable ? (
              <DataTable
                rows={trend.points}
                rowKey={(p) => p.date.toISOString()}
                cols={[
                  { key: "d", label: t("Date", "তারিখ"), cell: (p) => (trend.hourly ? f.time(p.date) : f.date(p.date)) },
                  { key: "v", label: t("Sales", "বিক্রি"), align: "right", cell: (p) => f.money(p.value) },
                  { key: "c", label: t("Previous period", "আগের সময়"), align: "right", cell: (p) => f.money(p.compare) },
                ]}
              />
            ) : (
              <AreaChart
                height={240}
                data={trend.points.map((p) => ({
                  label: trend.hourly ? hourLabel(p.date, lang) : f.dateShort(p.date),
                  tip: trend.hourly ? `${t("Up to", "পর্যন্ত")} ${f.time(new Date(p.date.getTime() + 3_599_000))}` : f.date(p.date),
                  value: p.value,
                  compare: p.compare,
                }))}
                format={(n) => `৳${f.compact(n)}`}
                valueLabel={t("This period", "এই সময়")}
                compareLabel={t("Previous period", "আগের সময়")}
              />
            )
          }
        />
        <SalesBreakdown list={list} fileTag={fileTag} />

        {/* ---------------- Profit */}
        <h2 id="profit" className="scroll-mt-32 pt-4 font-display text-xl font-semibold text-ink">{t("Profit", "লাভ")}</h2>
        {viewCost ? (
          <ProfitSection iv={iv} fileTag={fileTag} orders={orders} expenses={expenses} />
        ) : (
          <Locked title={t("Profit is visible to owners and managers", "লাভের হিসাব মালিক ও ম্যানেজার দেখতে পারেন")} body={t("Your role can see sales but not buying prices. Ask the owner if you need access.", "আপনার রোলে বিক্রি দেখা যায়, কেনা দাম নয়। দরকার হলে মালিককে বলুন।")} />
        )}

        {/* ---------------- Stock */}
        <h2 id="stock" className="scroll-mt-32 pt-4 font-display text-xl font-semibold text-ink">{t("Stock", "স্টক")}</h2>
        <StockSection orders={orders} products={products} fileTag={fileTag} viewCost={viewCost} now={now} />

        {/* ---------------- Returns */}
        <h2 id="returns" className="scroll-mt-32 pt-4 font-display text-xl font-semibold text-ink">{t("Returns", "ফেরত")}</h2>
        <ReturnsSection list={list} fileTag={fileTag} />

        {/* ---------------- Staff */}
        <h2 id="staff" className="scroll-mt-32 pt-4 font-display text-xl font-semibold text-ink">{t("Staff performance", "স্টাফের কাজ")}</h2>
        <ReportSection
          title={t("Who sold what", "কে কত বিক্রি করেছেন")}
          sub={t("Orders created and confirmed in this period, by person", "এই সময়ে কে কত অর্ডার নিয়েছেন ও নিশ্চিত করেছেন")}
          toggle={false}
          onExport={() => {
            const rows = staffRows(orders, iv, staff.map((s) => s.name));
            downloadCsv(`staff_${fileTag}`, ["staff", "orders_created", "orders_confirmed", "sales", "returned", "return_rate"], rows.map((r) => [r.name, r.created, r.confirmed, Math.round(r.sales), r.returned, (r.returnRate * 100).toFixed(1)]));
          }}
          render={() => {
            const rows = staffRows(orders, iv, staff.map((s) => s.name));
            const max = Math.max(1, ...rows.map((r) => r.sales));
            return (
              <DataTable
                rows={rows}
                rowKey={(r) => r.name}
                cols={[
                  {
                    key: "n",
                    label: t("Staff", "স্টাফ"),
                    cell: (r) => {
                      const s = staff.find((x) => x.name === r.name);
                      return (
                        <span className="flex items-center gap-2.5">
                          <Avatar name={r.name} color={s?.color} size={28} />
                          <span>{r.name}</span>
                        </span>
                      );
                    },
                  },
                  { key: "c", label: t("Created", "নিয়েছেন"), align: "right", cell: (r) => f.num(r.created) },
                  { key: "cf", label: t("Confirmed", "নিশ্চিত"), align: "right", cell: (r) => f.num(r.confirmed) },
                  {
                    key: "s",
                    label: t("Sales", "বিক্রি"),
                    align: "right",
                    cell: (r) => (
                      <span className="inline-flex items-center justify-end gap-2">
                        <span className="hidden h-1.5 w-20 overflow-hidden rounded-full bg-sunken lg:inline-block">
                          <span className="block h-full rounded-full bg-brand" style={{ width: `${(r.sales / max) * 100}%` }} />
                        </span>
                        {f.money(r.sales)}
                      </span>
                    ),
                  },
                  { key: "r", label: t("Return rate", "ফেরতের হার"), align: "right", cell: (r) => (r.finished ? <span className={r.returnRate >= 0.2 ? "text-danger" : ""}>{f.pct(r.returnRate)}</span> : <span className="text-ink-4">—</span>) },
                ]}
              />
            );
          }}
        />
      </div>
    </div>
  );
}

function hourLabel(d: Date, lang: "en" | "bn") {
  const h = d.getHours();
  const h12 = h % 12 || 12;
  return lang === "bn" ? `${h12}টা` : `${h12}${h < 12 ? "a" : "p"}`;
}

/* ------------------------------------------------------------ sales by */

type By = "product" | "category" | "channel" | "staff" | "district";

function SalesBreakdown({ list, fileTag }: { list: ReturnType<typeof salesIn>; fileTag: string }) {
  const t = useT();
  const f = useFmt();
  const products = useStore((s) => s.products);
  const categories = useStore((s) => s.categories);
  const [by, setBy] = useState<By>("product");
  const [hoverCh, setHoverCh] = useState<string | null>(null);
  const lang = t.lang;
  const rows: Row[] = useMemo(() => {
    switch (by) {
      case "product":
        return byProduct(list, products, lang);
      case "category":
        return byCategory(list, products, categories, lang);
      case "channel":
        return byChannel(list).map((r) => ({ ...r, label: t.pick(CHANNEL_LABEL[r.key as Channel]) }));
      case "staff":
        return byStaff(list);
      case "district":
        return byDistrict(list, t("Counter sale", "দোকানে বিক্রি")).map((r) => ({ ...r, label: lang === "bn" ? districtBn(r.label) : r.label }));
    }
  }, [by, list, products, categories, lang, t]);
  const total = rows.reduce((s, r) => s + r.sales, 0) || 1;
  const detail = (r: Row) => `${f.num(r.orders)} ${t("orders", "অর্ডার")} · ${f.num(r.units)} ${t("pcs", "পিস")} · ${f.pct(r.sales / total)} ${t("of sales", "বিক্রির")}`;

  return (
    <ReportSection
      title={t("Where sales came from", "বিক্রি কোথা থেকে এলো")}
      sub={t("Ranked by sales value", "বিক্রির মূল্য অনুযায়ী সাজানো")}
      extra={
        <div className="hidden lg:block">
          <BySwitch by={by} setBy={setBy} />
        </div>
      }
      onExport={() => downloadCsv(`sales_by_${by}_${fileTag}`, [by, "sales", "orders", "units", "share_pct"], rows.map((r) => [r.label, Math.round(r.sales), r.orders, r.units, ((r.sales / total) * 100).toFixed(1)]))}
      render={(asTable) => (
        <>
          <div className="no-scrollbar -mx-1 mb-4 overflow-x-auto px-1 lg:hidden">
            <BySwitch by={by} setBy={setBy} />
          </div>
          {asTable ? (
            <DataTable
              rows={rows}
              rowKey={(r) => r.key}
              max={12}
              cols={[
                { key: "l", label: t("Name", "নাম"), cell: (r) => r.label },
                { key: "s", label: t("Sales", "বিক্রি"), align: "right", cell: (r) => f.money(r.sales) },
                { key: "o", label: t("Orders", "অর্ডার"), align: "right", cell: (r) => f.num(r.orders) },
                { key: "u", label: t("Pieces", "পিস"), align: "right", cell: (r) => f.num(r.units) },
                { key: "p", label: t("Share", "অংশ"), align: "right", cell: (r) => f.pct(r.sales / total) },
              ]}
            />
          ) : by === "channel" ? (
            <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
              <Donut
                size={168}
                thickness={20}
                onHover={setHoverCh}
                data={rows.map((r) => ({ key: r.key, value: r.sales, color: CHANNEL_COLOR[r.key as Channel], label: r.label }))}
                center={
                  <div>
                    <p className="figure text-xl font-semibold text-ink">{hoverCh ? f.pct((rows.find((r) => r.key === hoverCh)?.sales ?? 0) / total) : f.compact(total)}</p>
                    <p className="text-[11px] text-ink-3">{hoverCh ? rows.find((r) => r.key === hoverCh)?.label : t("total sales", "মোট বিক্রি")}</p>
                  </div>
                }
              />
              <div className="w-full min-w-0 flex-1">
                <RankedBars
                  items={rows.map((r) => ({
                    key: r.key,
                    label: r.label,
                    value: r.sales,
                    display: `${f.money(r.sales)} · ${f.pct(r.sales / total)}`,
                    detail: detail(r),
                    color: CHANNEL_COLOR[r.key as Channel],
                    leading: <ChannelIcon channel={r.key as Channel} />,
                  }))}
                />
              </div>
            </div>
          ) : (
            <RankedBars
              items={rows.map((r) => {
                const p = by === "product" ? products.find((x) => x.id === r.key) : undefined;
                return {
                  key: r.key,
                  label: r.label,
                  value: r.sales,
                  display: f.money(r.sales),
                  detail: detail(r),
                  leading: p ? <ProductThumb product={p} size={20} rounded="sm" /> : by === "staff" ? <Avatar name={r.label} size={20} /> : undefined,
                };
              })}
            />
          )}
        </>
      )}
    />
  );
}

function BySwitch({ by, setBy }: { by: By; setBy: (b: By) => void }) {
  const t = useT();
  return (
    <Segmented<By>
      size="sm"
      ariaLabel={t("Group sales by", "বিক্রি ভাগ করুন")}
      value={by}
      onChange={setBy}
      options={[
        { value: "product", label: t("Product", "পণ্য") },
        { value: "category", label: t("Category", "ক্যাটাগরি") },
        { value: "channel", label: t("Channel", "চ্যানেল") },
        { value: "staff", label: t("Staff", "স্টাফ") },
        { value: "district", label: t("District", "জেলা") },
      ]}
    />
  );
}

/* ------------------------------------------------------------ profit */

function ProfitSection({ iv, fileTag, orders, expenses }: { iv: ReturnType<typeof makeInterval>; fileTag: string; orders: ReturnType<typeof useStore.getState>["orders"]; expenses: ReturnType<typeof useStore.getState>["expenses"] }) {
  const t = useT();
  const f = useFmt();
  const steps = useMemo(() => profitSteps(orders, expenses, iv), [orders, expenses, iv]);
  const revenue = steps[0].value;
  const net = steps[steps.length - 1].value;
  const margin = revenue ? net / revenue : 0;
  return (
    <ReportSection
      title={t("From sales to what you keep", "বিক্রি থেকে হাতে কত থাকল")}
      sub={t("Product sales, minus every cost along the way. Uses average buying price at the time of sale.", "পণ্য বিক্রি থেকে সব খরচ বাদ দিয়ে। বিক্রির সময়ের গড় কেনা দাম ধরা হয়েছে।")}
      onExport={() => downloadCsv(`profit_${fileTag}`, ["step", "amount"], steps.map((s) => [s.en, Math.round(s.value)]))}
      render={(asTable) => (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_220px]">
          {asTable ? (
            <DataTable
              rows={steps}
              rowKey={(s) => s.key}
              cols={[
                { key: "l", label: t("Step", "ধাপ"), cell: (s) => <span className={s.kind === "total" ? "font-semibold" : ""}>{t(s.en, s.bn)}</span> },
                { key: "v", label: t("Amount", "পরিমাণ"), align: "right", cell: (s) => f.money(s.value, { sign: s.kind === "delta" }) },
                { key: "p", label: t("Of sales", "বিক্রির"), align: "right", cell: (s) => f.pct(Math.abs(s.value) / (revenue || 1), 1) },
              ]}
            />
          ) : (
            <Waterfall steps={steps} />
          )}
          <aside className="flex flex-row items-center gap-4 rounded-md bg-surface-2 p-4 lg:flex-col lg:items-start lg:justify-center">
            <div>
              <p className="text-[13px] text-ink-3">{t("Net profit", "নিট লাভ")}</p>
              <p className={cn("figure mt-1 text-[32px] font-semibold leading-none", net < 0 ? "text-danger" : "text-brand-ink")}>{f.money(net)}</p>
            </div>
            <div className="lg:mt-3">
              <Badge tone={margin >= 0.15 ? "ok" : margin >= 0 ? "warn" : "danger"}>
                {f.pct(margin, 1)} {t("net margin", "নিট মার্জিন")}
              </Badge>
              <p className="mt-2 max-w-[24ch] text-xs text-ink-3">
                {margin < 0.1
                  ? t("Returns and ads are eating the margin. Check the Returns section below.", "ফেরত আর বিজ্ঞাপনে মার্জিন কমছে। নিচে ফেরত অংশ দেখুন।")
                  : t("Healthy for a social-commerce shop. Keep return fees in check.", "অনলাইন দোকানের জন্য ভালো। ফেরত চার্জ নিয়ন্ত্রণে রাখুন।")}
              </p>
            </div>
          </aside>
        </div>
      )}
    />
  );
}

/* ------------------------------------------------------------ stock */

function StockSection({ orders, products, fileTag, viewCost, now }: { orders: ReturnType<typeof useStore.getState>["orders"]; products: ReturnType<typeof useStore.getState>["products"]; fileTag: string; viewCost: boolean; now: Date }) {
  const t = useT();
  const f = useFmt();
  const [deadDays, setDeadDays] = useState<"14" | "30" | "45">("30");
  const rows = useMemo(() => stockRows(products, orders, t.lang, now), [products, orders, t.lang, now]);
  const sum = (k: "onHand" | "reserved" | "available" | "costValue" | "saleValue") => rows.reduce((s, r) => s + r[k], 0);
  const dead = rows.filter((r) => r.onHand > 0 && (r.daysSinceSale === null || r.daysSinceSale >= +deadDays));
  return (
    <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <ReportSection
        title={t("Stock on hand", "হাতে থাকা স্টক")}
        sub={t("Right now, across all products", "এই মুহূর্তে, সব পণ্য মিলিয়ে")}
        toggle={false}
        onExport={() =>
          downloadCsv(
            `stock_${fileTag}`,
            ["product", "on_hand", "reserved", "available", "in_transit", ...(viewCost ? ["value_at_cost"] : []), "value_at_sale", "last_sold"],
            rows.map((r) => [r.label, r.onHand, r.reserved, r.available, r.inTransit, ...(viewCost ? [Math.round(r.costValue)] : []), Math.round(r.saleValue), r.lastSold ? isoDay(r.lastSold) : ""]),
          )
        }
        render={() => (
          <>
            <dl className="mb-5 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
              {[
                { l: t("Pieces on hand", "হাতে আছে"), v: f.num(sum("onHand")) },
                { l: t("Held for orders", "অর্ডারে রাখা"), v: f.num(sum("reserved")) },
                ...(viewCost ? [{ l: t("Value at cost", "কেনা দামে মূল্য"), v: f.money(sum("costValue")) }] : []),
                { l: t("Value at sale price", "বিক্রয় মূল্যে"), v: f.money(sum("saleValue")) },
              ].map((m) => (
                <div key={m.l}>
                  <dt className="text-xs text-ink-3">{m.l}</dt>
                  <dd className="figure mt-0.5 text-xl font-semibold text-ink">{m.v}</dd>
                </div>
              ))}
            </dl>
            <DataTable
              rows={rows}
              rowKey={(r) => r.key}
              max={8}
              cols={[
                {
                  key: "p",
                  label: t("Product", "পণ্য"),
                  cell: (r) => (
                    <span className="flex min-w-0 items-center gap-2.5">
                      <ProductThumb product={r.product} size={28} rounded="sm" />
                      <span className="truncate">{r.label}</span>
                    </span>
                  ),
                },
                { key: "o", label: t("On hand", "আছে"), align: "right", cell: (r) => f.num(r.onHand) },
                { key: "r", label: t("Held", "রাখা"), align: "right", cell: (r) => (r.reserved ? f.num(r.reserved) : <span className="text-ink-4">0</span>) },
                { key: "a", label: t("Available", "বিক্রিযোগ্য"), align: "right", cell: (r) => <span className={r.available === 0 ? "font-medium text-danger" : ""}>{f.num(r.available)}</span> },
                viewCost
                  ? { key: "c", label: t("At cost", "কেনা দামে"), align: "right" as const, cell: (r: (typeof rows)[number]) => f.money(r.costValue) }
                  : { key: "s", label: t("At sale price", "বিক্রয় মূল্যে"), align: "right" as const, cell: (r: (typeof rows)[number]) => f.money(r.saleValue) },
              ]}
            />
          </>
        )}
      />
      <ReportSection
        title={t("Not moving", "বিক্রি হচ্ছে না")}
        sub={t("In stock but no sale for a while — candidates for a discount post", "স্টকে আছে কিন্তু অনেক দিন বিক্রি নেই — ছাড়ের পোস্ট দিতে পারেন")}
        toggle={false}
        extra={
          <Segmented<"14" | "30" | "45">
            size="sm"
            ariaLabel={t("Days without a sale", "কত দিন বিক্রি নেই")}
            value={deadDays}
            onChange={setDeadDays}
            options={[
              { value: "14", label: f.digits("14d") },
              { value: "30", label: f.digits("30d") },
              { value: "45", label: f.digits("45d") },
            ]}
          />
        }
        onExport={() => downloadCsv(`dead_stock_${deadDays}d`, ["product", "on_hand", "days_since_sale"], dead.map((r) => [r.label, r.onHand, r.daysSinceSale ?? "never"]))}
        render={() =>
          dead.length ? (
            <ul className="divide-y divide-line">
              {dead.map((r) => (
                <li key={r.key} className="flex items-center gap-3 py-2.5">
                  <ProductThumb product={r.product} size={36} rounded="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{r.label}</p>
                    <p className="text-xs text-ink-3">
                      {f.num(r.onHand)} {t("pcs", "পিস")} · {viewCost ? f.money(r.costValue) : f.money(r.saleValue)} {t("tied up", "আটকে আছে")}
                    </p>
                  </div>
                  <Badge tone="warn">{r.daysSinceSale === null ? t("Never sold", "কখনো বিক্রি হয়নি") : t(`${r.daysSinceSale} days`, `${f.num(r.daysSinceSale)} দিন`)}</Badge>
                </li>
              ))}
            </ul>
          ) : (
            <div className="rounded-md bg-ok-soft/60 px-4 py-6 text-center">
              <p className="text-sm font-medium text-ok">{t("Everything in stock has sold recently.", "স্টকের সব পণ্যই সম্প্রতি বিক্রি হয়েছে।")}</p>
              <p className="mt-1 text-xs text-ink-3">{t(`No product has gone ${deadDays} days without a sale.`, `${f.num(+deadDays)} দিন বিক্রি নেই এমন কোনো পণ্য নেই।`)}</p>
            </div>
          )
        }
      />
    </div>
  );
}

/* ------------------------------------------------------------ returns */

type RBy = "product" | "channel" | "district" | "customer";

function ReturnsSection({ list, fileTag }: { list: ReturnType<typeof salesIn>; fileTag: string }) {
  const t = useT();
  const f = useFmt();
  const products = useStore((s) => s.products);
  const [by, setBy] = useState<RBy>("product");
  const lang = t.lang;
  const rows = useMemo(
    () =>
      returnRows(list, (o) => {
        switch (by) {
          case "product":
            return o.lines.map((l) => {
              const p = products.find((x) => x.id === l.productId);
              return { key: l.productId, label: p ? (lang === "bn" ? (p.nameBn ?? p.name) : p.name) : l.name };
            });
          case "channel":
            return [{ key: o.channel, label: t.pick(CHANNEL_LABEL[o.channel]) }];
          case "district": {
            const d = o.customer?.address?.district;
            return d ? [{ key: d, label: lang === "bn" ? districtBn(d) : d }] : null;
          }
          case "customer":
            return o.customer ? [{ key: o.customerId ?? o.customer.phone, label: o.customer.name }] : null;
        }
      }).filter((r) => (by === "customer" ? r.returned > 0 : true)),
    [list, by, products, lang, t],
  );
  const all = list.filter((o) => ["delivered", "returned", "partially_returned"].includes(o.status));
  const ret = all.filter((o) => o.status !== "delivered").length;
  const overall = all.length ? ret / all.length : 0;
  return (
    <ReportSection
      title={t("Where parcels come back from", "কোথা থেকে পার্সেল ফেরত আসে")}
      sub={
        <>
          {t("Overall", "মোট")} <span className="tnum font-medium text-ink">{f.pct(overall, 1)}</span> · {f.num(ret)} {t("of", "/")} {f.num(all.length)} {t("finished orders came back", "টি শেষ হওয়া অর্ডার ফেরত")}
        </>
      }
      extra={
        <div className="hidden md:block">
          <Segmented<RBy>
            size="sm"
            ariaLabel={t("Group returns by", "ফেরত ভাগ করুন")}
            value={by}
            onChange={setBy}
            options={[
              { value: "product", label: t("Product", "পণ্য") },
              { value: "channel", label: t("Channel", "চ্যানেল") },
              { value: "district", label: t("District", "জেলা") },
              { value: "customer", label: t("Customer", "কাস্টমার") },
            ]}
          />
        </div>
      }
      onExport={() => downloadCsv(`returns_by_${by}_${fileTag}`, [by, "finished_orders", "returned", "return_rate_pct"], rows.map((r) => [r.label, r.finished, r.returned, (r.rate * 100).toFixed(1)]))}
      render={(asTable) => (
        <>
          <div className="no-scrollbar -mx-1 mb-4 overflow-x-auto px-1 md:hidden">
            <Segmented<RBy>
              size="sm"
              value={by}
              onChange={setBy}
              options={[
                { value: "product", label: t("Product", "পণ্য") },
                { value: "channel", label: t("Channel", "চ্যানেল") },
                { value: "district", label: t("District", "জেলা") },
                { value: "customer", label: t("Customer", "কাস্টমার") },
              ]}
            />
          </div>
          {asTable ? (
            <DataTable
              rows={rows}
              rowKey={(r) => r.key}
              max={12}
              cols={[
                { key: "l", label: t("Name", "নাম"), cell: (r) => r.label },
                { key: "f", label: t("Finished", "শেষ"), align: "right", cell: (r) => f.num(r.finished) },
                { key: "r", label: t("Returned", "ফেরত"), align: "right", cell: (r) => f.num(r.returned) },
                { key: "p", label: t("Rate", "হার"), align: "right", cell: (r) => f.pct(r.rate, 1) },
              ]}
            />
          ) : (
            <RankedBars
              emptyText={t("No returns in this period.", "এই সময়ে কোনো ফেরত নেই।")}
              items={rows
                .filter((r) => r.returned > 0)
                .map((r) => ({
                  key: r.key,
                  label: r.label,
                  value: r.rate,
                  display: `${f.pct(r.rate)} · ${f.num(r.returned)}/${f.num(r.finished)}`,
                  detail: t(`${r.returned} of ${r.finished} finished orders returned`, `${f.num(r.finished)}টির মধ্যে ${f.num(r.returned)}টি ফেরত`),
                  color: r.rate >= Math.max(0.2, overall * 1.5) ? "var(--color-st-returned)" : "var(--ink-4)",
                }))}
            />
          )}
        </>
      )}
    />
  );
}
