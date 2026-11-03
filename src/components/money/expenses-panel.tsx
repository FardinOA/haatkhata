"use client";

import { ArrowUDownLeft, CaretDown, DotsThree, House, Megaphone, Package, Plus, Receipt, Trash, Truck, UsersThree, type Icon } from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import { Button, cn, EmptyState, Field, IconButton, Input, Panel, PanelHeader, Segmented } from "../ui/core";
import { Sheet, useConfirm, useToast } from "../ui/overlays";
import { downloadCsv, isoDay } from "../reports/csv";
import { RankedBars } from "../reports/parts";
import { useFmt, useT } from "@/lib/hooks";
import { MONTHS_BN } from "@/lib/format";
import { EXPENSE_LABEL, PAY_LABEL } from "@/lib/labels";
import { useStore } from "@/lib/store";
import type { Expense, ExpenseCategory, PayMethod } from "@/lib/types";

export const EXPENSE_ICON: Record<ExpenseCategory, Icon> = {
  delivery: Truck,
  return_fee: ArrowUDownLeft,
  packaging: Package,
  ads: Megaphone,
  rent: House,
  salary: UsersThree,
  other: DotsThree,
};

const CATS = Object.keys(EXPENSE_LABEL) as ExpenseCategory[];
const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function ExpensesPanel({ adding, setAdding }: { adding: boolean; setAdding: (v: boolean) => void }) {
  const t = useT();
  const f = useFmt();
  const toast = useToast();
  const [ask, confirmNode] = useConfirm();
  const expenses = useStore((s) => s.expenses);
  const addExpense = useStore((s) => s.addExpense);
  const deleteExpense = useStore((s) => s.deleteExpense);
  const [filter, setFilter] = useState<ExpenseCategory | "all">("all");
  const [openMonths, setOpenMonths] = useState<Record<string, boolean>>({});
  const [openFees, setOpenFees] = useState<Set<string>>(new Set());

  const remove = async (e: Expense) => {
    const ok = await ask({
      title: t(`Delete this ${f.money(e.amount)} expense?`, `${f.money(e.amount)} এর খরচটি মুছবেন?`),
      body: t("Profit reports will update. This can't be undone.", "লাভের রিপোর্ট বদলে যাবে। এটা ফেরানো যাবে না।"),
      confirm: t("Delete", "মুছুন"),
      cancel: t("Keep", "রাখুন"),
      danger: true,
    });
    if (ok) {
      deleteExpense(e.id);
      toast({ title: t("Expense deleted", "খরচ মুছে ফেলা হয়েছে"), tone: "info" });
    }
  };

  const months = useMemo(() => {
    const map = new Map<string, typeof expenses>();
    for (const e of [...expenses].sort((a, b) => b.date.localeCompare(a.date))) {
      if (filter !== "all" && e.category !== filter) continue;
      const k = isoDay(e.date).slice(0, 7);
      map.set(k, [...(map.get(k) ?? []), e]);
    }
    return [...map.entries()];
  }, [expenses, filter]);
  const [focusMonth, setFocusMonth] = useState<string | null>(null);
  const activeMonth = focusMonth ?? isoDay(new Date()).slice(0, 7);
  const monthList = expenses.filter((e) => isoDay(e.date).slice(0, 7) === activeMonth);
  const breakdown = CATS.map((c) => ({ c, v: monthList.filter((e) => e.category === c).reduce((s, e) => s + e.amount, 0) }))
    .filter((x) => x.v > 0)
    .sort((a, b) => b.v - a.v);
  const monthTotal = breakdown.reduce((s, x) => s + x.v, 0);
  const allMonths = [...new Set(expenses.map((e) => isoDay(e.date).slice(0, 7)))].sort().reverse().slice(0, 6);

  const monthName = (k: string) => {
    const [y, m] = k.split("-").map(Number);
    return t.lang === "bn" ? `${MONTHS_BN[m - 1]} ${f.digits(String(y))}` : `${MONTHS_LONG[m - 1]} ${y}`;
  };

  /* -------- add form */
  const [cat, setCat] = useState<ExpenseCategory>("packaging");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(() => isoDay(new Date()));
  const [method, setMethod] = useState<PayMethod>("cash");
  const [note, setNote] = useState("");
  const amt = Number(amount.replace(/[^\d.]/g, ""));
  const submit = () => {
    if (!(amt > 0) || !date) return;
    const d = new Date(`${date}T12:00:00`);
    addExpense({ category: cat, amount: amt, date: d.toISOString(), method, note: note.trim() || undefined });
    toast({ title: t(`Added ${f.money(amt)} for ${EXPENSE_LABEL[cat][0].toLowerCase()}`, `${t.pick(EXPENSE_LABEL[cat])} খাতে ${f.money(amt)} যোগ হয়েছে`) });
    setAmount("");
    setNote("");
    setAdding(false);
  };

  return (
    <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <Panel>
        <PanelHeader
          title={t("Expenses", "খরচ")}
          sub={t("Everything that isn't stock: delivery, ads, rent, salaries", "স্টক ছাড়া সব খরচ: ডেলিভারি, বিজ্ঞাপন, ভাড়া, বেতন")}
          action={
            <>
              <a href="/money/recurring" className="inline-flex h-8 items-center rounded-sm px-3 text-[13px] font-medium text-ink-2 hover:bg-sunken">
                {t("Monthly bills", "মাসিক খরচ")}
              </a>
              <Button size="sm" variant="ghost" onClick={() => downloadCsv(`expenses_${isoDay(new Date())}`, ["date", "category", "amount", "method", "note"], expenses.map((e) => [isoDay(e.date), e.category, e.amount, e.method, e.note ?? ""]))}>
                CSV
              </Button>
              <Button size="sm" variant="primary" icon={<Plus className="size-4" weight="bold" />} onClick={() => setAdding(true)}>
                {t("Add expense", "খরচ যোগ")}
              </Button>
            </>
          }
        />
        <div className="no-scrollbar mt-4 flex gap-1.5 overflow-x-auto px-5 pb-1">
          {(["all", ...CATS] as const).map((c) => {
            const I = c === "all" ? null : EXPENSE_ICON[c];
            const on = filter === c;
            return (
              <button
                key={c}
                type="button"
                onClick={() => setFilter(c)}
                aria-pressed={on}
                className={cn(
                  "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium transition-colors",
                  on ? "border-brand bg-brand-50 text-brand-ink" : "border-line text-ink-2 hover:border-line-strong hover:bg-surface-2",
                )}
              >
                {I && <I className="size-3.5" />}
                {c === "all" ? t("All", "সব") : t.pick(EXPENSE_LABEL[c])}
              </button>
            );
          })}
        </div>
        {months.length === 0 ? (
          <EmptyState icon={<Receipt weight="duotone" />} title={t("No expenses here", "এখানে কোনো খরচ নেই")} body={t("Log costs as they happen so profit stays honest.", "খরচ হলেই লিখে রাখুন, লাভের হিসাব ঠিক থাকবে।")} />
        ) : (
          <div className="mt-3">
            {months.map(([k, list], mi) => {
              const isOpen = openMonths[k] ?? mi < 2;
              const fees = filter === "all" ? list.filter((e) => e.category === "return_fee") : [];
              const rest = filter === "all" ? list.filter((e) => e.category !== "return_fee") : list;
              const feesOpen = openFees.has(k);
              const feeTotal = fees.reduce((s, e) => s + e.amount, 0);
              return (
                <section key={k} aria-label={monthName(k)}>
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => {
                      setFocusMonth(k);
                      setOpenMonths((m) => ({ ...m, [k]: !isOpen }));
                    }}
                    className={cn("flex w-full items-center gap-2 border-y border-line bg-surface-2 px-5 py-2 text-left", activeMonth === k && "text-brand-ink")}
                  >
                    <CaretDown className={cn("size-3.5 transition-transform", !isOpen && "-rotate-90")} />
                    <span className="flex-1 text-[13px] font-semibold">{monthName(k)}</span>
                    <span className="text-xs text-ink-3">{t(`${list.length} entries`, `${f.num(list.length)}টি`)}</span>
                    <span className="tnum w-24 text-right text-[13px] font-medium text-ink-2">{f.money(list.reduce((s, e) => s + e.amount, 0))}</span>
                  </button>
                  {isOpen && (
                    <ul className="divide-y divide-line/70">
                      {rest.map((e) => (
                        <ExpenseRow key={e.id} e={e} onDelete={() => remove(e)} />
                      ))}
                      {fees.length > 0 && (
                        <li>
                          <button type="button" aria-expanded={feesOpen} onClick={() => setOpenFees((s) => toggleIn(s, k))} className="flex w-full items-center gap-3 px-5 py-2.5 text-left hover:bg-surface-2">
                            <span className="grid size-8 shrink-0 place-items-center rounded-md bg-sunken text-ink-2">
                              <ArrowUDownLeft className="size-4" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm text-ink">{t(`${fees.length} return fees`, `${f.num(fees.length)}টি ফেরত চার্জ`)}</span>
                              <span className="block text-xs text-ink-3">{t("Charged by couriers for parcels that came back", "ফেরত আসা পার্সেলের জন্য কুরিয়ারের চার্জ")}</span>
                            </span>
                            <span className="tnum text-sm font-medium text-ink">{f.money(feeTotal)}</span>
                            <CaretDown className={cn("size-4 text-ink-3 transition-transform", feesOpen && "rotate-180")} />
                          </button>
                          {feesOpen && (
                            <ul className="divide-y divide-line/60 bg-surface-2/70">
                              {fees.map((e) => (
                                <ExpenseRow key={e.id} e={e} onDelete={() => remove(e)} nested />
                              ))}
                            </ul>
                          )}
                        </li>
                      )}
                    </ul>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </Panel>

      <Panel className="lg:sticky lg:top-24">
        <PanelHeader title={t("Where it went", "কোথায় খরচ হলো")} sub={monthName(activeMonth)} />
        <div className="px-5 pb-5 pt-3">
          <div className="no-scrollbar -mx-1 mb-4 flex gap-1 overflow-x-auto px-1">
            {allMonths.map((m) => (
              <button key={m} type="button" onClick={() => setFocusMonth(m)} aria-pressed={m === activeMonth} className={cn("shrink-0 rounded-full px-2.5 py-1 text-xs font-medium", m === activeMonth ? "bg-ink text-white" : "text-ink-3 hover:bg-sunken")}>
                {monthName(m).split(" ")[0]}
              </button>
            ))}
          </div>
          <p className="text-[13px] text-ink-3">{t("Total", "মোট")}</p>
          <p className="figure text-[32px] font-semibold leading-tight text-ink">{f.money(monthTotal)}</p>
          <div className="mt-4">
            <RankedBars
              emptyText={t("Nothing spent this month yet.", "এই মাসে এখনো কোনো খরচ নেই।")}
              items={breakdown.map((x) => {
                const I = EXPENSE_ICON[x.c];
                return {
                  key: x.c,
                  label: t.pick(EXPENSE_LABEL[x.c]),
                  value: x.v,
                  display: f.money(x.v),
                  detail: `${f.pct(x.v / (monthTotal || 1))} ${t("of the month", "মাসের")}`,
                  leading: <I className="size-3.5 text-ink-3" />,
                };
              })}
            />
          </div>
        </div>
      </Panel>

      <Sheet
        open={adding}
        onClose={() => setAdding(false)}
        title={t("Add an expense", "খরচ যোগ করুন")}
        sub={t("Counts against profit for the date you pick", "যে তারিখ দেবেন সেই দিনের লাভ থেকে বাদ যাবে")}
        width={460}
        footer={
          <>
            <Button variant="ghost" onClick={() => setAdding(false)}>
              {t("Cancel", "বাতিল")}
            </Button>
            <Button variant="primary" className="ml-auto" disabled={!(amt > 0) || !date} onClick={submit}>
              {amt > 0 ? t(`Add ${f.money(amt)}`, `${f.money(amt)} যোগ করুন`) : t("Add expense", "খরচ যোগ করুন")}
            </Button>
          </>
        }
      >
        <div className="space-y-5 p-5">
          <fieldset>
            <legend className="mb-2 text-[13px] font-medium text-ink-2">{t("What was it for?", "কিসের খরচ?")}</legend>
            <div className="grid grid-cols-4 gap-2">
              {CATS.map((c) => {
                const I = EXPENSE_ICON[c];
                const on = cat === c;
                return (
                  <button
                    key={c}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setCat(c)}
                    className={cn("flex flex-col items-center gap-1.5 rounded-md border px-1 py-2.5 text-center text-xs font-medium transition-colors", on ? "border-brand bg-brand-50 text-brand-ink" : "border-line text-ink-2 hover:border-line-strong hover:bg-surface-2")}
                  >
                    <I className="size-5" weight={on ? "fill" : "regular"} />
                    <span className="leading-tight">{t.pick(EXPENSE_LABEL[c])}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("Amount", "পরিমাণ")} htmlFor="exp-amt">
              <Input id="exp-amt" data-autofocus inputMode="decimal" leading={<span className="text-sm">৳</span>} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" onKeyDown={(e) => e.key === "Enter" && submit()} />
            </Field>
            <Field label={t("Date", "তারিখ")} htmlFor="exp-date">
              <Input id="exp-date" type="date" value={date} max={isoDay(new Date())} onChange={(e) => setDate(e.target.value)} />
            </Field>
          </div>
          <Field label={t("Paid with", "কীভাবে দিলেন")}>
            <Segmented<PayMethod> value={method} onChange={setMethod} className="w-full" options={(["cash", "bkash", "nagad", "bank", "card"] as PayMethod[]).map((m) => ({ value: m, label: t.pick(PAY_LABEL[m]) }))} />
          </Field>
          <Field label={t("Note", "নোট")} optional={t("Optional", "ঐচ্ছিক")} htmlFor="exp-note">
            <Input id="exp-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("e.g. Boost for Eid collection", "যেমন ঈদ কালেকশনের বুস্ট")} />
          </Field>
        </div>
      </Sheet>
      {confirmNode}
    </div>
  );
}

const toggleIn = (s: Set<string>, k: string) => {
  const n = new Set(s);
  if (n.has(k)) n.delete(k);
  else n.add(k);
  return n;
};

function ExpenseRow({ e, onDelete, nested }: { e: Expense; onDelete: () => void; nested?: boolean }) {
  const t = useT();
  const f = useFmt();
  const I = EXPENSE_ICON[e.category];
  return (
    <li className={cn("group flex items-center gap-3 py-2.5 pr-5", nested ? "pl-16" : "pl-5")}>
      {!nested && (
        <span className="grid size-8 shrink-0 place-items-center rounded-md bg-sunken text-ink-2">
          <I className="size-4" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-ink">{e.note || t.pick(EXPENSE_LABEL[e.category])}</p>
        <p className="text-xs text-ink-3">
          {t.pick(EXPENSE_LABEL[e.category])} · {f.dateShort(e.date)} · {t.pick(PAY_LABEL[e.method])}
        </p>
      </div>
      <span className="tnum text-sm font-medium text-ink">{f.money(e.amount)}</span>
      <IconButton size="sm" label={t("Delete expense", "খরচ মুছুন")} className="text-ink-4 hover:text-danger md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100" onClick={onDelete}>
        <Trash className="size-4" />
      </IconButton>
    </li>
  );
}
