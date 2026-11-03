"use client";

import { Plus } from "@phosphor-icons/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { PageHeader } from "../bits";
import { Button, cn } from "../ui/core";
import { Locked } from "../reports/parts";
import { codOrders, collectedThisWeek, OVERDUE_DAYS, plural } from "./calc";
import { CodPanel } from "./cod-panel";
import { DuesPanel } from "./dues-panel";
import { ExpensesPanel } from "./expenses-panel";
import { MoneyMap, type MapTab } from "./money-map";
import { PayoutImport } from "../couriers/payout-import";
import { SuppliersPanel } from "./suppliers-panel";
import { dueCustomers } from "@/lib/analytics";
import { useCan, useFmt, useT } from "@/lib/hooks";
import { useStore } from "@/lib/store";

type Tab = MapTab | "payouts";
const TABS: Tab[] = ["cod", "payouts", "dues", "suppliers", "expenses"];

export function MoneyView() {
  const t = useT();
  const f = useFmt();
  const can = useCan();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const orders = useStore((s) => s.orders);
  const suppliers = useStore((s) => s.suppliers);
  const expenses = useStore((s) => s.expenses);
  const [now] = useState(() => new Date());
  const [adding, setAdding] = useState(false);

  const raw = params.get("tab") as Tab | null;
  const tab: Tab = raw && TABS.includes(raw) ? raw : "cod";
  const setTab = (next: Tab) => {
    const q = new URLSearchParams(params.toString());
    q.set("tab", next);
    router.replace(`${pathname}?${q.toString()}`, { scroll: false });
  };
  const viewCost = can("view_cost");

  const cod = useMemo(() => codOrders(orders, now), [orders, now]);
  const codTotal = cod.reduce((s, c) => s + c.amount, 0);
  const overdue = cod.filter((c) => c.days > OVERDUE_DAYS).length;
  const dues = useMemo(() => dueCustomers(orders), [orders]);
  const duesTotal = dues.reduce((s, d) => s + d.due, 0);
  const week = useMemo(() => collectedThisWeek(orders, now), [orders, now]);
  const owed = suppliers.reduce((s, x) => s + x.balance, 0);
  const monthSpend = expenses
    .filter((e) => {
      const d = new Date(e.date);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    })
    .reduce((s, e) => s + e.amount, 0);

  const counts: Record<Tab, string> = {
    cod: f.compact(codTotal),
    payouts: "",
    dues: dues.length ? f.compact(duesTotal) : "",
    suppliers: viewCost && owed ? f.compact(owed) : "",
    expenses: viewCost && monthSpend ? f.compact(monthSpend) : "",
  };
  const labels: Record<Tab, string> = {
    cod: t("Courier COD", "কুরিয়ার COD"),
    payouts: t("Payout statements", "পেমেন্ট স্টেটমেন্ট"),
    dues: t("Customer dues", "কাস্টমারের বাকি"),
    suppliers: t("Suppliers", "সাপ্লায়ার"),
    expenses: t("Expenses", "খরচ"),
  };

  return (
    <div className="mx-auto max-w-[1280px] px-4 py-6 md:px-8 md:py-8">
      <PageHeader
        title={t("Cash & COD", "টাকা ও COD")}
        sub={t("Where your money is right now — and what to chase first", "এখন আপনার টাকা কোথায় — আর আগে কোনটা আদায় করবেন")}
        actions={
          viewCost && (
            <Button
              variant="secondary"
              icon={<Plus className="size-4" weight="bold" />}
              onClick={() => {
                setTab("expenses");
                setAdding(true);
              }}
            >
              {t("Add expense", "খরচ যোগ")}
            </Button>
          )
        }
      />

      <div className="mt-6">
        <MoneyMap
          active={tab === "payouts" ? "cod" : tab}
          onPick={setTab}
          inHand={week.total}
          inHandDetail={t(`Cash ${f.compact(week.direct)} · MFS ${f.compact(week.mfs)} · COD ${f.compact(week.cod)}`, `নগদ ${f.compact(week.direct)} · মোবাইল ${f.compact(week.mfs)} · COD ${f.compact(week.cod)}`)}
          couriers={codTotal}
          couriersDetail={overdue ? t(`${cod.length} ${plural(cod.length, "order", "orders")} · ${overdue} overdue`, `${f.num(cod.length)}টি অর্ডার · ${f.num(overdue)}টি দেরি`) : t(`${cod.length} ${plural(cod.length, "order", "orders")}, none overdue`, `${f.num(cod.length)}টি অর্ডার, দেরি নেই`)}
          customers={duesTotal}
          customersDetail={dues.length ? t(`${dues.length} ${plural(dues.length, "customer", "customers")}`, `${f.num(dues.length)} জন কাস্টমার`) : t("No credit sales open", "বাকিতে বিক্রি নেই")}
          suppliers={owed}
          suppliersDetail={t(`${suppliers.filter((s) => s.balance > 0).length} ${plural(suppliers.filter((s) => s.balance > 0).length, "supplier", "suppliers")} to pay`, `${f.num(suppliers.filter((s) => s.balance > 0).length)} জন সাপ্লায়ার`)}
        />
      </div>

      <div role="tablist" aria-label={t("Money sections", "টাকার অংশ")} className="no-scrollbar mt-8 flex gap-6 overflow-x-auto border-b border-line">
        {TABS.map((k) => {
          const on = tab === k;
          return (
            <button
              key={k}
              role="tab"
              type="button"
              aria-selected={on}
              aria-controls={`money-${k}`}
              onClick={() => setTab(k)}
              className={cn("relative flex h-11 shrink-0 items-center gap-2 text-sm font-medium transition-colors", on ? "text-ink" : "text-ink-3 hover:text-ink-2")}
            >
              {labels[k]}
              {counts[k] && (
                <span className={cn("tnum rounded-full px-1.5 py-px text-[11px] font-semibold", k === "cod" || k === "dues" ? "bg-cash-soft text-cash-ink" : "bg-sunken text-ink-2")}>৳{counts[k]}</span>
              )}
              {on && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-brand" />}
            </button>
          );
        })}
      </div>

      <div id={`money-${tab}`} role="tabpanel" className="mt-5">
        {tab === "cod" && <CodPanel />}
        {tab === "payouts" && <PayoutImport />}
        {tab === "dues" && <DuesPanel />}
        {tab === "suppliers" &&
          (viewCost ? <SuppliersPanel /> : <Locked title={t("Supplier balances are private", "সাপ্লায়ারের হিসাব গোপন")} body={t("Owners, managers and accountants can see what the shop owes. Ask the owner if you need it.", "মালিক, ম্যানেজার ও হিসাবরক্ষক দেনা দেখতে পারেন। দরকার হলে মালিককে বলুন।")} />)}
        {tab === "expenses" &&
          (viewCost ? <ExpensesPanel adding={adding} setAdding={setAdding} /> : <Locked title={t("Expenses are visible to owners and accountants", "খরচ মালিক ও হিসাবরক্ষক দেখতে পারেন")} body={t("Your role takes orders and payments. Shop costs stay with the owner.", "আপনার রোলে অর্ডার ও পেমেন্ট নেওয়া যায়। দোকানের খরচ মালিক দেখেন।")} />)}
      </div>
    </div>
  );
}
