"use client";

import { CaretDown, Plus, Storefront, Truck } from "@phosphor-icons/react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge, Button, cn, EmptyState, Field, Input, Panel, PanelHeader } from "../ui/core";
import { Dialog, useToast } from "../ui/overlays";
import { downloadCsv, isoDay } from "../reports/csv";
import { supplierActivity } from "./calc";
import { formatPhone, normalizePhone } from "@/lib/domain";
import { useFmt, useT } from "@/lib/hooks";
import { useStore } from "@/lib/store";
import type { Supplier } from "@/lib/types";

export function SuppliersPanel() {
  const t = useT();
  const f = useFmt();
  const toast = useToast();
  const suppliers = useStore((s) => s.suppliers);
  const purchases = useStore((s) => s.purchases);
  const paySupplier = useStore((s) => s.paySupplier);
  const addSupplier = useStore((s) => s.addSupplier);
  const [paying, setPaying] = useState<Supplier | null>(null);
  const [amount, setAmount] = useState("");
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ name: "", phone: "", address: "" });
  const [open, setOpen] = useState<string | null>(null);

  const rows = useMemo(() => suppliers.map((s) => ({ s, a: supplierActivity(purchases, s.id) })).sort((x, y) => y.s.balance - x.s.balance), [suppliers, purchases]);
  const owed = suppliers.reduce((s, x) => s + x.balance, 0);
  const amt = Number(amount.replace(/[^\d.]/g, ""));
  const validPay = paying && amt > 0 && amt <= paying.balance;
  const phoneOk = !draft.phone || !!normalizePhone(draft.phone);

  const submitPay = () => {
    if (!paying || !validPay) return;
    paySupplier(paying.id, amt);
    toast({ title: t(`Paid ${f.money(amt)} to ${paying.name}`, `${paying.name} কে ${f.money(amt)} দেওয়া হলো`), body: amt < paying.balance ? t(`${f.money(paying.balance - amt)} still owed`, `${f.money(paying.balance - amt)} এখনো বাকি`) : t("Fully settled", "পুরো পরিশোধ") });
    setPaying(null);
  };
  const submitAdd = () => {
    if (!draft.name.trim() || !phoneOk) return;
    addSupplier({ name: draft.name.trim(), phone: normalizePhone(draft.phone) ?? draft.phone.trim(), address: draft.address.trim() || undefined });
    toast({ title: t(`Added ${draft.name.trim()}`, `${draft.name.trim()} যোগ হয়েছে`) });
    setDraft({ name: "", phone: "", address: "" });
    setAdding(false);
  };

  return (
    <Panel>
      <PanelHeader
        title={t("Suppliers", "সাপ্লায়ার")}
        sub={owed > 0 ? t(`You owe ${f.money(owed)} in total`, `মোট ${f.money(owed)} দেনা`) : t("All suppliers are paid up", "সব সাপ্লায়ারের টাকা দেওয়া")}
        action={
          <>
            <Button size="sm" variant="ghost" onClick={() => downloadCsv(`suppliers_${isoDay(new Date())}`, ["supplier", "phone", "address", "purchases", "bought_total", "balance_owed"], rows.map(({ s, a }) => [s.name, s.phone, s.address ?? "", a.count, a.total, s.balance]))}>
              CSV
            </Button>
            <Button size="sm" variant="secondary" icon={<Plus className="size-4" />} onClick={() => setAdding(true)}>
              {t("Add supplier", "সাপ্লায়ার যোগ")}
            </Button>
          </>
        }
      />
      {rows.length === 0 ? (
        <EmptyState icon={<Storefront weight="duotone" />} title={t("No suppliers yet", "এখনো কোনো সাপ্লায়ার নেই")} body={t("Add the people you buy stock from to track what you owe them.", "যাদের থেকে মাল কেনেন তাদের যোগ করুন, দেনার হিসাব থাকবে।")} />
      ) : (
        <ul className="mt-4 divide-y divide-line border-t border-line">
          {rows.map(({ s, a }) => (
            <li key={s.id}>
              <div className="flex flex-wrap items-center gap-3 px-5 py-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-md bg-sunken text-ink-2">
                  <Truck className="size-5" />
                </span>
                <button type="button" aria-expanded={open === s.id} onClick={() => setOpen(open === s.id ? null : s.id)} className="min-w-0 flex-1 text-left">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-[15px] font-semibold text-ink">{s.name}</span>
                    {a.count > 0 && <CaretDown className={cn("size-3.5 text-ink-3 transition-transform", open === s.id && "rotate-180")} />}
                  </span>
                  <span className="tnum mt-0.5 block truncate text-[13px] text-ink-3">
                    {f.digits(formatPhone(s.phone))}
                    {s.address ? ` · ${s.address}` : ""}
                  </span>
                </button>
                <div className="text-right">
                  {s.balance > 0 ? <p className="figure text-xl font-semibold text-ink">{f.money(s.balance)}</p> : <Badge tone="ok">{t("Paid up", "পরিশোধিত")}</Badge>}
                  <p className="text-xs text-ink-3">{a.count ? t(`${a.count} purchases · last ${f.dateShort(a.last!)}`, `${f.num(a.count)}টি কেনা · শেষ ${f.dateShort(a.last!)}`) : t("No purchases yet", "এখনো কেনা হয়নি")}</p>
                </div>
                <Button
                  size="sm"
                  variant={s.balance > 0 ? "secondary" : "ghost"}
                  disabled={s.balance <= 0}
                  onClick={() => {
                    setPaying(s);
                    setAmount(String(s.balance));
                  }}
                >
                  {t("Pay", "টাকা দিন")}
                </Button>
              </div>
              {open === s.id && a.count > 0 && (
                <ul className="mx-5 mb-4 divide-y divide-line/70 rounded-md bg-surface-2 text-[13px]">
                  {a.list.map((p) => (
                    <li key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2">
                      <span className="font-medium text-ink">{p.ref}</span>
                      <span className="text-ink-3">{f.date(p.date)}</span>
                      <span className="text-ink-3">{t(`${p.lines.length} items`, `${f.num(p.lines.length)}টি আইটেম`)}</span>
                      {p.note && <span className="text-ink-3">{p.note}</span>}
                      <span className="tnum ml-auto text-ink">
                        {f.money(p.total)} <span className="text-ink-3">· {t("paid", "দেওয়া")} {f.money(p.paid)}</span>
                      </span>
                    </li>
                  ))}
                  <li className="px-3 py-2">
                    <Link href="/inventory?action=stock-in" className="font-medium text-brand-ink hover:underline">
                      {t("Record a new purchase", "নতুন কেনা লিখুন")}
                    </Link>
                  </li>
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}

      <Dialog
        open={!!paying}
        onClose={() => setPaying(null)}
        title={t(`Pay ${paying?.name ?? ""}`, `${paying?.name ?? ""} কে টাকা দিন`)}
        icon={<Truck weight="duotone" />}
        tone="brand"
        footer={
          <>
            <Button variant="ghost" onClick={() => setPaying(null)}>
              {t("Cancel", "বাতিল")}
            </Button>
            <Button variant="primary" disabled={!validPay} onClick={submitPay}>
              {t(`Pay ${amt > 0 ? f.money(amt) : ""}`, `${amt > 0 ? f.money(amt) : ""} দিন`)}
            </Button>
          </>
        }
      >
        <p>
          {t("Currently owed", "বর্তমান দেনা")} <span className="tnum font-medium text-ink">{f.money(paying?.balance ?? 0)}</span>
        </p>
        <Field label={t("Amount paid", "কত দিলেন")} className="mt-4" htmlFor="sup-amt" error={amount && !validPay ? t("Can't pay more than you owe", "দেনার বেশি দেওয়া যাবে না") : undefined}>
          <Input id="sup-amt" data-autofocus inputMode="decimal" leading={<span className="text-sm">৳</span>} value={amount} onChange={(e) => setAmount(e.target.value)} aria-invalid={!!amount && !validPay} onKeyDown={(e) => e.key === "Enter" && submitPay()} />
        </Field>
      </Dialog>

      <Dialog
        open={adding}
        onClose={() => setAdding(false)}
        title={t("Add supplier", "সাপ্লায়ার যোগ করুন")}
        icon={<Storefront weight="duotone" />}
        tone="brand"
        footer={
          <>
            <Button variant="ghost" onClick={() => setAdding(false)}>
              {t("Cancel", "বাতিল")}
            </Button>
            <Button variant="primary" disabled={!draft.name.trim() || !phoneOk} onClick={submitAdd}>
              {t("Add supplier", "যোগ করুন")}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label={t("Name", "নাম")} htmlFor="sup-name">
            <Input id="sup-name" data-autofocus value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder={t("e.g. Islampur Wholesale", "যেমন ইসলামপুর হোলসেল")} />
          </Field>
          <Field label={t("Phone", "ফোন")} htmlFor="sup-phone" error={!phoneOk ? t("Enter an 11-digit mobile number (01…)", "১১ সংখ্যার মোবাইল নম্বর দিন (০১…)") : undefined}>
            <Input id="sup-phone" inputMode="tel" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} placeholder="01XXXXXXXXX" aria-invalid={!phoneOk} />
          </Field>
          <Field label={t("Address", "ঠিকানা")} optional={t("Optional", "ঐচ্ছিক")} htmlFor="sup-addr">
            <Input id="sup-addr" value={draft.address} onChange={(e) => setDraft({ ...draft, address: e.target.value })} />
          </Field>
        </div>
      </Dialog>
    </Panel>
  );
}
