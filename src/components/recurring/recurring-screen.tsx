"use client";

import { ArrowLeft, CalendarCheck, LockSimple, Pause, Play, Plus, Repeat, Trash } from "@phosphor-icons/react";
import Link from "next/link";
import { useState } from "react";
import { PageHeader } from "../bits";
import { MoneyInput } from "../products/editor";
import { Badge, Button, EmptyState, Field, IconButton, Input, Panel, Select } from "../ui/core";
import { Sheet, useConfirm, useToast } from "../ui/overlays";
import { PAY_METHODS } from "@/lib/domain";
import { useCan, useFmt, useNow, useT } from "@/lib/hooks";
import { EXPENSE_LABEL, PAY_LABEL } from "@/lib/labels";
import { useStore } from "@/lib/store";
import type { ExpenseCategory, PayMethod, RecurringExpense } from "@/lib/types";

const ordinal = (n: number) => `${n}${n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th"}`;

/** Monthly costs that repeat (FR-EXP-02): created automatically on their day. */
export function RecurringScreen() {
  const t = useT();
  const f = useFmt();
  const can = useCan();
  const nowMs = useNow(3_600_000);
  const [confirm, confirmNode] = useConfirm();
  const recurring = useStore((s) => s.recurring);
  const saveRecurring = useStore((s) => s.saveRecurring);
  const deleteRecurring = useStore((s) => s.deleteRecurring);
  const [editing, setEditing] = useState<Partial<RecurringExpense> | null>(null);
  const monthly = recurring.filter((r) => r.active).reduce((s, r) => s + r.amount, 0);
  const now = new Date(nowMs);
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  if (!can("view_cost"))
    return (
      <div className="mx-auto max-w-[900px] px-4 py-8">
        <Panel>
          <EmptyState icon={<LockSimple />} title={t("Only owners, managers and accountants can see expenses", "শুধু মালিক, ম্যানেজার ও হিসাবরক্ষক খরচ দেখতে পারেন")} />
        </Panel>
      </div>
    );

  const nextDate = (r: RecurringExpense) => {
    const ranThisMonth = r.lastRun && r.lastRun >= month;
    const d = new Date(now.getFullYear(), now.getMonth() + (ranThisMonth || now.getDate() > r.dayOfMonth ? 1 : 0), r.dayOfMonth);
    return d;
  };

  return (
    <div className="mx-auto max-w-[900px] px-4 py-6 md:px-8 md:py-8">
      <Link href="/money?tab=expenses" className="-ml-2 mb-3 inline-flex h-9 items-center gap-1.5 rounded-sm px-2 text-[13px] font-medium text-ink-2 hover:bg-sunken">
        <ArrowLeft className="size-4" />
        {t("Expenses", "খরচ")}
      </Link>
      <PageHeader
        title={t("Monthly expenses", "মাসিক খরচ")}
        sub={t(`Rent, salaries and bills you pay every month · ${f.money(monthly)} a month`, `প্রতি মাসের ভাড়া, বেতন ও বিল · মাসে ${f.money(monthly)}`)}
        actions={
          <Button variant="primary" icon={<Plus className="size-4" weight="bold" />} onClick={() => setEditing({ category: "rent", method: "cash", dayOfMonth: 1, active: true, amount: 0 })}>
            {t("Add monthly expense", "মাসিক খরচ যোগ")}
          </Button>
        }
      />
      <Panel className="mt-6 overflow-hidden">
        {recurring.length ? (
          <ul className="divide-y divide-line">
            {recurring.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4">
                <span className="grid size-10 place-items-center rounded-md bg-brand-50 text-brand-ink">
                  <Repeat className="size-5" />
                </span>
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setEditing(r)}>
                  <span className="flex items-center gap-2 text-[14.5px] font-medium text-ink">
                    {t.pick(EXPENSE_LABEL[r.category])}
                    {!r.active && <Badge>{t("Paused", "বন্ধ")}</Badge>}
                  </span>
                  <span className="block truncate text-[13px] text-ink-3">
                    {r.note ? `${r.note} · ` : ""}
                    {t(`on the ${ordinal(r.dayOfMonth)} · ${PAY_LABEL[r.method][0]}`, `প্রতি মাসের ${f.num(r.dayOfMonth)} তারিখ · ${PAY_LABEL[r.method][1]}`)}
                  </span>
                </button>
                <span className="text-right">
                  <span className="tnum block text-[15px] font-semibold text-ink">{f.money(r.amount)}</span>
                  {r.active && (
                    <span className="flex items-center justify-end gap-1 text-xs text-ink-3">
                      <CalendarCheck className="size-3.5" />
                      {t(`next ${f.dateShort(nextDate(r))}`, `পরের ${f.dateShort(nextDate(r))}`)}
                    </span>
                  )}
                </span>
                <span className="flex items-center gap-1">
                  <IconButton label={r.active ? t("Pause", "বন্ধ করুন") : t("Resume", "চালু করুন")} size="sm" onClick={() => saveRecurring({ ...r, active: !r.active })}>
                    {r.active ? <Pause className="size-4" /> : <Play className="size-4" />}
                  </IconButton>
                  <IconButton
                    label={t("Delete", "মুছুন")}
                    size="sm"
                    onClick={async () => {
                      if (await confirm({ title: t("Stop this monthly expense?", "এই মাসিক খরচ বন্ধ করবেন?"), body: t("Expenses already recorded stay in your books.", "আগে লেখা খরচগুলো থেকে যাবে।"), confirm: t("Delete", "মুছুন"), danger: true })) deleteRecurring(r.id);
                    }}
                  >
                    <Trash className="size-4" />
                  </IconButton>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={<Repeat />} title={t("Nothing repeats yet", "এখনো কিছু নিয়মিত নেই")} body={t("Add rent or salaries once. Each month they're added to your expenses on their day, so your profit is always complete.", "ভাড়া বা বেতন একবার যোগ করুন। প্রতি মাসে নির্দিষ্ট দিনে খরচে যোগ হবে, তাই লাভের হিসাব সবসময় পূর্ণ।")} />
        )}
      </Panel>
      <p className="mt-3 text-[13px] text-ink-3">{t("They're added the first time anyone opens the app on or after the day — never twice, even with several phones.", "নির্দিষ্ট দিনে বা পরে প্রথম যে কেউ অ্যাপ খুললে যোগ হবে — কয়েকটি ফোন থাকলেও দুবার নয়।")}</p>
      <EditSheet value={editing} onClose={() => setEditing(null)} />
      {confirmNode}
    </div>
  );
}

function EditSheet({ value, onClose }: { value: Partial<RecurringExpense> | null; onClose: () => void }) {
  const t = useT();
  const toast = useToast();
  const saveRecurring = useStore((s) => s.saveRecurring);
  const [form, setForm] = useState<Partial<RecurringExpense> | null>(null);
  if (value && form?.id !== value.id && !(form && !value.id && !form.id)) setForm({ ...value });
  if (!value && form) setForm(null);
  const ok = !!form && (form.amount ?? 0) > 0;
  return (
    <Sheet
      open={!!value}
      onClose={onClose}
      title={value?.id ? t("Edit monthly expense", "মাসিক খরচ সম্পাদনা") : t("New monthly expense", "নতুন মাসিক খরচ")}
      width={460}
      footer={
        <Button
          variant="primary"
          className="ml-auto"
          disabled={!ok}
          onClick={() => {
            if (!form) return;
            const id = saveRecurring({ id: form.id, category: form.category as ExpenseCategory, amount: form.amount ?? 0, method: form.method as PayMethod, note: form.note?.trim() || undefined, dayOfMonth: form.dayOfMonth ?? 1, active: form.active ?? true });
            if (id) {
              toast({ title: t("Saved", "সেভ হয়েছে") });
              onClose();
            }
          }}
        >
          {t("Save", "সেভ")}
        </Button>
      }
    >
      {form && (
        <div className="grid gap-4 p-5">
          <Field label={t("What for", "কিসের জন্য")} htmlFor="rx-cat">
            <Select id="rx-cat" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as ExpenseCategory })}>
              {(Object.keys(EXPENSE_LABEL) as ExpenseCategory[]).map((c) => (
                <option key={c} value={c}>
                  {t.pick(EXPENSE_LABEL[c])}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("Amount each month", "প্রতি মাসে")} htmlFor="rx-amt">
            <MoneyInput id="rx-amt" value={form.amount ?? 0} onChange={(n) => setForm({ ...form, amount: n })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("Day of the month", "মাসের তারিখ")} htmlFor="rx-day" hint={t("1–28", "১–২৮")}>
              <Input id="rx-day" inputMode="numeric" value={form.dayOfMonth ?? 1} onChange={(e) => setForm({ ...form, dayOfMonth: Math.min(28, Math.max(1, Number(e.target.value.replace(/\D/g, "")) || 1)) })} />
            </Field>
            <Field label={t("Paid by", "মাধ্যম")} htmlFor="rx-method">
              <Select id="rx-method" value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value as PayMethod })}>
                {PAY_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {t.pick(PAY_LABEL[m])}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label={t("Note", "নোট")} optional={t("optional", "ঐচ্ছিক")} htmlFor="rx-note">
            <Input id="rx-note" value={form.note ?? ""} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder={t("e.g. Shop rent, Mirpur", "যেমন দোকান ভাড়া, মিরপুর")} />
          </Field>
        </div>
      )}
    </Sheet>
  );
}
