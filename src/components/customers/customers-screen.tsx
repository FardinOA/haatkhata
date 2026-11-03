"use client";

import { DownloadSimple, MagnifyingGlass, UserPlus, UsersThree, X } from "@phosphor-icons/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { PageHeader, RiskRing } from "../bits";
import { Avatar, Button, cn, EmptyState, Input, Select } from "../ui/core";
import { useToast } from "../ui/overlays";
import { downloadText, stamp, toCsv } from "../orders/util";
import { CustomerForm } from "./customer-form";
import { CustomerSheet } from "./customer-sheet";
import { buildRows, inSegment, sortRows, type CustomerRow, type Segment, type SortKey } from "./data";
import type { RiskLevel } from "@/lib/domain";
import { districtBn } from "@/lib/geo";
import { useFmt, useNow, useT } from "@/lib/hooks";
import { useStore } from "@/lib/store";
import type { Customer } from "@/lib/types";

const PAGE = 50;

export function CustomersScreen() {
  const t = useT();
  const f = useFmt();
  const toast = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const openId = params.get("id");
  const isNew = params.get("new") === "1";

  const customers = useStore((s) => s.customers);
  const orders = useStore((s) => s.orders);
  const rows = useMemo(() => buildRows(customers, orders), [customers, orders]);

  const [q, setQ] = useState("");
  const [segment, setSegment] = useState<Segment>("all");
  const [district, setDistrict] = useState("all");
  const [risk, setRisk] = useState<RiskLevel | "all">("all");
  const [tag, setTag] = useState("all");
  const [sort, setSort] = useState<SortKey>("recent");
  const [limit, setLimit] = useState(PAGE);
  const [editing, setEditing] = useState<Customer | null>(null);

  const districts = useMemo(() => [...new Set(customers.map((c) => c.address.district).filter(Boolean))].sort(), [customers]);
  const tags = useMemo(() => [...new Set(customers.flatMap((c) => c.tags))].sort(), [customers]);

  const counts = useMemo(() => {
    const c: Record<Segment, number> = { all: rows.length, regular: 0, risky: 0, due: 0, new: 0 };
    for (const r of rows) for (const s of ["regular", "risky", "due", "new"] as const) if (inSegment(r, s)) c[s]++;
    return c;
  }, [rows]);
  const dueTotal = useMemo(() => rows.reduce((s, r) => s + r.stats.due, 0), [rows]);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const digits = needle.replace(/\D/g, "");
    const list = rows.filter((r) => {
      if (!inSegment(r, segment)) return false;
      if (district !== "all" && r.c.address.district !== district) return false;
      if (risk !== "all" && r.risk !== risk) return false;
      if (tag !== "all" && !r.c.tags.includes(tag)) return false;
      if (needle) {
        const hay = `${r.c.name} ${r.c.address.area} ${r.c.address.district}`.toLowerCase();
        if (!hay.includes(needle) && !(digits.length >= 3 && r.c.phone.includes(digits))) return false;
      }
      return true;
    });
    return sortRows(list, sort);
  }, [rows, q, segment, district, risk, tag, sort]);

  const dirty = q || segment !== "all" || district !== "all" || risk !== "all" || tag !== "all";
  const clear = () => {
    setQ("");
    setSegment("all");
    setDistrict("all");
    setRisk("all");
    setTag("all");
  };

  const open = useCallback((id: string) => router.replace(`${pathname}?id=${id}`, { scroll: false }), [router, pathname]);
  const closeUrl = useCallback(() => router.replace(pathname, { scroll: false }), [router, pathname]);

  const exportCsv = () => {
    const head = ["Name", "Phone", "Alt phone", "Address", "Area", "District", "Channel", "Tags", "Orders", "Delivered", "Returned", "Return rate", "Spent", "Due", "Last order", "Flagged"];
    const body = visible.map((r) => [
      r.c.name,
      r.c.phone,
      r.c.altPhone,
      r.c.address.line,
      r.c.address.area,
      r.c.address.district,
      r.c.channel,
      r.c.tags.join(" "),
      r.stats.orders,
      r.stats.delivered,
      r.stats.returned,
      `${Math.round(r.stats.returnRate * 100)}%`,
      r.stats.spent,
      r.stats.due,
      r.stats.lastOrder?.slice(0, 10),
      r.c.risky ? "yes" : "",
    ]);
    downloadText(`customers-${stamp()}.csv`, toCsv([head, ...body]));
    toast({ title: t(`Exported ${visible.length} customers`, `${f.num(visible.length)} জন কাস্টমার এক্সপোর্ট হয়েছে`) });
  };

  const SEGMENTS: { key: Segment; en: string; bn: string; dot: string }[] = [
    { key: "all", en: "Everyone", bn: "সবাই", dot: "var(--ink-4)" },
    { key: "regular", en: "Regulars", bn: "নিয়মিত", dot: "var(--color-ok)" },
    { key: "risky", en: "High return risk", bn: "ফেরতের ঝুঁকি", dot: "var(--color-danger)" },
    { key: "due", en: "Owe you money", bn: "টাকা বাকি", dot: "var(--cash)" },
    { key: "new", en: "New this month", bn: "এই মাসে নতুন", dot: "var(--color-st-confirmed)" },
  ];

  return (
    <div className="mx-auto max-w-[1440px] px-4 pb-20 pt-5 md:px-8 md:pt-7">
      <PageHeader
        title={t("Customers", "কাস্টমার")}
        sub={
          <>
            {t(`${rows.length} people have bought from you`, `${f.num(rows.length)} জন আপনার কাছ থেকে কিনেছেন`)}
            {dueTotal > 0 && (
              <>
                {" · "}
                <button type="button" onClick={() => setSegment("due")} className="font-medium text-cash-ink underline-offset-2 hover:underline">
                  {t(`${f.money(dueTotal)} owed to you`, `${f.money(dueTotal)} পাওনা`)}
                </button>
              </>
            )}
          </>
        }
        actions={
          <>
            <Button variant="secondary" icon={<DownloadSimple className="size-4" />} onClick={exportCsv} className="max-sm:hidden">
              {t("Export", "এক্সপোর্ট")}
            </Button>
            <Button variant="primary" icon={<UserPlus className="size-4" />} onClick={() => router.replace(`${pathname}?new=1`, { scroll: false })}>
              {t("Add customer", "কাস্টমার যোগ")}
            </Button>
          </>
        }
      />

      {/* segments */}
      <div role="radiogroup" aria-label={t("Segments", "ভাগ")} className="no-scrollbar -mx-4 mt-5 flex gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0">
        {SEGMENTS.map((s) => {
          const on = segment === s.key;
          return (
            <button
              key={s.key}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setSegment(s.key)}
              className={cn(
                "flex h-11 shrink-0 items-center gap-2.5 rounded-full border pl-3.5 pr-2 text-[13.5px] font-medium transition-colors",
                on ? "border-ink bg-ink text-white" : "border-line bg-surface text-ink-2 shadow-1 hover:border-line-strong",
              )}
            >
              <span className="size-2 rounded-full" style={{ background: s.dot }} />
              {t(s.en, s.bn)}
              <span className={cn("tnum grid h-7 min-w-7 place-items-center rounded-full px-2 text-xs", on ? "bg-white/15 text-white" : "bg-sunken text-ink-2")}>{f.num(counts[s.key])}</span>
            </button>
          );
        })}
      </div>

      {/* filters */}
      <div className="mt-4 flex flex-col gap-2 lg:flex-row lg:items-center">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("Name, phone or area", "নাম, ফোন বা এলাকা")}
          aria-label={t("Search customers", "কাস্টমার খুঁজুন")}
          leading={<MagnifyingGlass className="size-4" />}
          trailing={
            q ? (
              <button type="button" onClick={() => setQ("")} aria-label={t("Clear search", "খোঁজা মুছুন")} className="grid size-7 place-items-center rounded-full hover:bg-sunken">
                <X className="size-3.5" />
              </button>
            ) : undefined
          }
          className="lg:w-[280px]"
        />
        <div className="no-scrollbar -mx-4 flex items-center gap-2 overflow-x-auto px-4 lg:mx-0 lg:flex-1 lg:px-0">
          <Select aria-label={t("District", "জেলা")} value={district} onChange={(e) => setDistrict(e.target.value)} className="w-[150px] shrink-0">
            <option value="all">{t("All districts", "সব জেলা")}</option>
            {districts.map((d) => (
              <option key={d} value={d}>
                {t.lang === "bn" ? districtBn(d) : d}
              </option>
            ))}
          </Select>
          <Select aria-label={t("Return risk", "ফেরতের ঝুঁকি")} value={risk} onChange={(e) => setRisk(e.target.value as RiskLevel | "all")} className="w-[160px] shrink-0">
            <option value="all">{t("Any return risk", "সব ঝুঁকি")}</option>
            <option value="trusted">{t("Trusted", "বিশ্বস্ত")}</option>
            <option value="watch">{t("Watch returns", "খেয়াল রাখুন")}</option>
            <option value="risky">{t("High risk", "বেশি ঝুঁকি")}</option>
            <option value="new">{t("No orders yet", "অর্ডার নেই")}</option>
          </Select>
          {tags.length > 0 && (
            <Select aria-label={t("Tag", "ট্যাগ")} value={tag} onChange={(e) => setTag(e.target.value)} className="w-[140px] shrink-0">
              <option value="all">{t("Any tag", "সব ট্যাগ")}</option>
              {tags.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </Select>
          )}
          {dirty && (
            <button type="button" onClick={clear} className="h-10 shrink-0 rounded-md px-3 text-[13px] font-medium text-brand-ink hover:bg-brand-50">
              {t("Clear filters", "ফিল্টার মুছুন")}
            </button>
          )}
          <Select aria-label={t("Sort by", "সাজান")} value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="ml-auto w-[170px] shrink-0">
            <option value="recent">{t("Recently ordered", "সাম্প্রতিক অর্ডার")}</option>
            <option value="spent">{t("Spent the most", "সবচেয়ে বেশি কেনা")}</option>
            <option value="orders">{t("Most orders", "সবচেয়ে বেশি অর্ডার")}</option>
            <option value="returns">{t("Highest return rate", "সবচেয়ে বেশি ফেরত")}</option>
            <option value="name">{t("Name A–Z", "নাম অনুযায়ী")}</option>
          </Select>
        </div>
      </div>

      <p className="mb-3 mt-4 text-[13px] text-ink-3" aria-live="polite">
        <span className="tnum font-medium text-ink">{f.num(visible.length)}</span> {t("customers", "জন কাস্টমার")}
      </p>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-line bg-surface">
          <EmptyState
            icon={<UsersThree />}
            title={t("No customers yet", "এখনো কোনো কাস্টমার নেই")}
            body={t("Customers are saved automatically when you take an order with a phone number.", "ফোন নম্বর দিয়ে অর্ডার নিলেই কাস্টমার নিজে থেকে সেভ হয়।")}
            action={
              <Button variant="primary" icon={<UserPlus className="size-4" />} onClick={() => router.replace(`${pathname}?new=1`)}>
                {t("Add customer", "কাস্টমার যোগ")}
              </Button>
            }
          />
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line-strong bg-surface/60">
          <EmptyState
            title={t("No customers match", "কোনো কাস্টমার মেলেনি")}
            body={t("Check the spelling, try the last 4 digits of their phone, or clear filters.", "বানান দেখুন, ফোনের শেষ ৪ সংখ্যা দিন, বা ফিল্টার মুছুন।")}
            action={
              <Button variant="secondary" onClick={clear}>
                {t("Clear filters", "ফিল্টার মুছুন")}
              </Button>
            }
          />
        </div>
      ) : (
        <CustomerTable rows={visible.slice(0, limit)} onOpen={open} />
      )}

      {visible.length > limit && (
        <div className="mt-4 flex justify-center">
          <Button variant="secondary" onClick={() => setLimit((l) => l + PAGE)}>
            {t("Show more", "আরও দেখুন")}
            <span className="tnum text-ink-4">
              {f.num(limit)}/{f.num(visible.length)}
            </span>
          </Button>
        </div>
      )}

      <CustomerSheet
        customerId={openId}
        onClose={closeUrl}
        onEdit={(c) => {
          setEditing(c);
        }}
      />
      <CustomerForm open={isNew || !!editing} customer={editing ?? undefined} onClose={() => (editing ? setEditing(null) : closeUrl())} onSaved={(id) => !editing && open(id)} />
    </div>
  );
}

function CustomerTable({ rows, onOpen }: { rows: CustomerRow[]; onOpen: (id: string) => void }) {
  const t = useT();
  const f = useFmt();
  const now = useNow();
  return (
    <>
      <div className="hidden overflow-hidden rounded-lg border border-line bg-surface shadow-1 md:block">
        <table className="w-full table-fixed text-left">
          <colgroup>
            <col />
            <col className="w-[18%]" />
            <col className="w-[84px]" />
            <col className="w-[120px]" />
            <col className="w-[132px]" />
            <col className="w-[110px]" />
            <col className="w-[120px]" />
          </colgroup>
          <thead className="border-b border-line bg-surface-2 text-xs text-ink-3">
            <tr className="h-10">
              <th className="pl-5 font-medium">{t("Customer", "কাস্টমার")}</th>
              <th className="font-medium">{t("Area", "এলাকা")}</th>
              <th className="pr-4 text-right font-medium">{t("Orders", "অর্ডার")}</th>
              <th className="pr-4 text-right font-medium">{t("Spent", "কেনাকাটা")}</th>
              <th className="font-medium">{t("Returns", "ফেরত")}</th>
              <th className="pr-4 text-right font-medium">{t("Owes", "বাকি")}</th>
              <th className="pr-5 text-right font-medium">{t("Last order", "শেষ অর্ডার")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/80">
            {rows.map((r) => (
              <tr
                key={r.c.id}
                tabIndex={0}
                data-testid="customer-row"
                onClick={() => onOpen(r.c.id)}
                onKeyDown={(e) => e.key === "Enter" && onOpen(r.c.id)}
                className="cursor-pointer transition-colors hover:bg-surface-2 focus-visible:bg-brand-50 focus-visible:outline-none"
                style={{ height: "calc(var(--row) + 14px)" }}
              >
                <td className="pl-5 pr-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar name={r.c.name} size={34} />
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 truncate text-[14px] font-medium text-ink">
                        <span className="truncate">{r.c.name}</span>
                        {r.c.risky && <span className="shrink-0 rounded-full bg-danger-soft px-1.5 text-[11px] font-medium text-danger">{t("flagged", "চিহ্নিত")}</span>}
                        {r.isRegular && !r.c.risky && <span className="shrink-0 rounded-full bg-ok-soft px-1.5 text-[11px] font-medium text-ok">{t("regular", "নিয়মিত")}</span>}
                      </p>
                      <p className="tnum truncate text-xs text-ink-3">{f.digits(r.c.phone)}</p>
                    </div>
                  </div>
                </td>
                <td className="pr-3">
                  <p className="truncate text-[13px] text-ink-2">{r.c.address.area || "—"}</p>
                  <p className="truncate text-xs text-ink-4">{t.lang === "bn" ? districtBn(r.c.address.district) : r.c.address.district}</p>
                </td>
                <td className="tnum pr-4 text-right text-[14px] text-ink-2">{f.num(r.stats.orders)}</td>
                <td className="tnum pr-4 text-right text-[14px] font-medium text-ink">{f.money(r.stats.spent)}</td>
                <td>
                  <div className="flex items-center gap-2">
                    <RiskRing level={r.risk} delivered={r.stats.delivered} returned={r.stats.returned} size={24} />
                    <span className={cn("tnum text-[13px]", r.stats.returnRate >= 0.2 ? "font-medium text-st-returned" : "text-ink-3")}>
                      {r.stats.delivered + r.stats.returned > 0 ? f.pct(r.stats.returnRate) : "—"}
                    </span>
                  </div>
                </td>
                <td className="pr-4 text-right">
                  {r.stats.due > 0 ? <span className="tnum rounded-full bg-cash-soft px-2 py-0.5 text-[13px] font-medium text-cash-ink">{f.money(r.stats.due)}</span> : <span className="text-ink-4">—</span>}
                </td>
                <td className="pr-5 text-right text-[13px] text-ink-3">{r.stats.lastOrder ? f.relative(r.stats.lastOrder, now) : t("never", "কখনো না")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="space-y-2 md:hidden">
        {rows.map((r) => (
          <li key={r.c.id}>
            <button type="button" data-testid="customer-card" onClick={() => onOpen(r.c.id)} className="flex w-full items-center gap-3 rounded-lg border border-line bg-surface p-3.5 text-left shadow-1 active:bg-surface-2">
              <Avatar name={r.c.name} size={40} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-[15px] font-medium text-ink">{r.c.name}</p>
                  <span className="tnum shrink-0 text-[14px] font-semibold text-ink">{f.money(r.stats.spent)}</span>
                </div>
                <p className="truncate text-[13px] text-ink-3">
                  {r.c.address.area ? `${r.c.address.area}, ` : ""}
                  {r.c.address.district} · {t(`${r.stats.orders} orders`, `${f.num(r.stats.orders)}টি অর্ডার`)}
                </p>
                <div className="mt-1.5 flex items-center gap-2">
                  <RiskRing level={r.risk} delivered={r.stats.delivered} returned={r.stats.returned} size={18} />
                  <span className={cn("tnum text-xs", r.stats.returnRate >= 0.2 ? "font-medium text-st-returned" : "text-ink-3")}>
                    {r.stats.delivered + r.stats.returned > 0 ? t(`${f.pct(r.stats.returnRate)} returned`, `${f.pct(r.stats.returnRate)} ফেরত`) : t("No deliveries yet", "এখনো ডেলিভারি নেই")}
                  </span>
                  {r.stats.due > 0 && <span className="tnum ml-auto rounded-full bg-cash-soft px-2 py-0.5 text-xs font-medium text-cash-ink">{t(`owes ${f.money(r.stats.due)}`, `বাকি ${f.money(r.stats.due)}`)}</span>}
                </div>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}
