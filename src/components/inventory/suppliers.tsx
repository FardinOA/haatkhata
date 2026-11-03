"use client";

import { Phone, Plus, Storefront, Truck } from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import { MoneyInput } from "../products/editor";
import { Avatar, Badge, Button, cn, EmptyState, Field, Input, Panel, Textarea } from "../ui/core";
import { Sheet, useToast } from "../ui/overlays";
import { useCan, useFmt, useT } from "@/lib/hooks";
import { formatPhone, normalizePhone } from "@/lib/domain";
import { useStore } from "@/lib/store";
import type { Supplier } from "@/lib/types";

export function Suppliers({ onStockIn }: { onStockIn: () => void }) {
  const t = useT();
  const f = useFmt();
  const can = useCan();
  const suppliers = useStore((s) => s.suppliers);
  const purchases = useStore((s) => s.purchases);
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const showMoney = can("view_cost");

  const stats = useMemo(() => {
    const m = new Map<string, { count: number; total: number; last?: string }>();
    for (const p of purchases) {
      if (!p.supplierId) continue;
      const s = m.get(p.supplierId) ?? { count: 0, total: 0 };
      s.count++;
      s.total += p.total;
      if (!s.last || p.date > s.last) s.last = p.date;
      m.set(p.supplierId, s);
    }
    return m;
  }, [purchases]);

  const owed = suppliers.reduce((s, x) => s + x.balance, 0);
  const open = suppliers.find((s) => s.id === openId) ?? null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        {showMoney ? (
          <div>
            <p className="text-[13px] text-ink-3">{t("You owe suppliers", "সাপ্লায়ারদের কাছে বাকি")}</p>
            <p className={cn("figure text-3xl font-semibold", owed > 0 ? "text-cash-ink" : "text-ink")}>{f.money(owed)}</p>
          </div>
        ) : (
          <span />
        )}
        <Button variant="primary" icon={<Plus className="size-4" weight="bold" />} onClick={() => setAdding(true)}>
          {t("Add supplier", "সাপ্লায়ার যোগ")}
        </Button>
      </div>

      {suppliers.length === 0 ? (
        <Panel>
          <EmptyState icon={<Storefront />} title={t("No suppliers yet", "এখনো সাপ্লায়ার নেই")} body={t("Add the wholesalers and weavers you buy from to track what you owe them.", "যাদের থেকে কেনেন তাদের যোগ করুন, বাকি হিসাব রাখতে।")} action={<Button onClick={() => setAdding(true)}>{t("Add supplier", "সাপ্লায়ার যোগ")}</Button>} />
        </Panel>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {suppliers.map((s) => {
            const st = stats.get(s.id);
            return (
              <li key={s.id}>
                <button type="button" onClick={() => setOpenId(s.id)} className="flex h-full w-full flex-col rounded-lg border border-line bg-surface p-4 text-left shadow-1 transition-[border-color,box-shadow] hover:border-line-strong hover:shadow-2">
                  <span className="flex items-start gap-3">
                    <Avatar name={s.name} size={40} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-ink">{s.name}</span>
                      <span className="block truncate text-xs text-ink-3">{s.address || f.digits(formatPhone(s.phone))}</span>
                    </span>
                    {showMoney && s.balance > 0 && <Badge tone="cash">{t("Due", "বাকি")}</Badge>}
                  </span>
                  <span className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-3">
                    <span>
                      <span className="block text-xs text-ink-3">{t("Purchases", "ক্রয়")}</span>
                      <span className="tnum block text-sm font-medium text-ink">
                        {f.num(st?.count ?? 0)}
                        {st?.last && <span className="font-normal text-ink-3"> · {f.dateShort(st.last)}</span>}
                      </span>
                    </span>
                    {showMoney && (
                      <span className="text-right">
                        <span className="block text-xs text-ink-3">{t("You owe", "বাকি")}</span>
                        <span className={cn("figure block text-lg font-semibold", s.balance > 0 ? "text-cash-ink" : "text-ink-3")}>{f.money(s.balance)}</span>
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <SupplierSheet supplier={open} onClose={() => setOpenId(null)} onStockIn={onStockIn} />
      <AddSupplierSheet open={adding} onClose={() => setAdding(false)} />
    </div>
  );
}

function SupplierSheet({ supplier, onClose, onStockIn }: { supplier: Supplier | null; onClose: () => void; onStockIn: () => void }) {
  const t = useT();
  const f = useFmt();
  const can = useCan();
  const toast = useToast();
  const purchases = useStore((s) => s.purchases);
  const products = useStore((s) => s.products);
  const paySupplier = useStore((s) => s.paySupplier);
  const [amount, setAmount] = useState(0);
  const showMoney = can("view_cost");
  const list = supplier ? purchases.filter((p) => p.supplierId === supplier.id).sort((a, b) => b.date.localeCompare(a.date)) : [];

  const pay = () => {
    if (!supplier || amount <= 0) return;
    const amt = Math.min(amount, supplier.balance);
    paySupplier(supplier.id, amt);
    toast({ title: t(`Paid ${f.money(amt)} to ${supplier.name}`, `${supplier.name} কে ${f.money(amt)} পরিশোধ`), body: t(`${f.money(supplier.balance - amt)} still owed`, `আরও বাকি ${f.money(supplier.balance - amt)}`) });
    setAmount(0);
  };

  return (
    <Sheet
      open={!!supplier}
      onClose={() => {
        setAmount(0);
        onClose();
      }}
      title={supplier?.name ?? ""}
      sub={
        supplier && (
          <span className="inline-flex items-center gap-3">
            {supplier.phone && (
              <a href={`tel:${supplier.phone}`} className="inline-flex items-center gap-1 text-brand-ink hover:underline">
                <Phone className="size-3.5" />
                {f.digits(formatPhone(supplier.phone))}
              </a>
            )}
            {supplier.address}
          </span>
        )
      }
      width={520}
      footer={
        <Button
          icon={<Truck className="size-4" />}
          onClick={() => {
            onClose();
            onStockIn();
          }}
        >
          {t("Record stock in", "স্টক ইন করুন")}
        </Button>
      }
    >
      {supplier && (
        <div className="space-y-6 p-5">
          {showMoney && (
            <div className="rounded-lg border border-line bg-surface-2 p-4">
              <div className="flex items-baseline justify-between">
                <span className="text-[13px] text-ink-3">{t("You owe", "বাকি")}</span>
                <span className={cn("figure text-3xl font-semibold", supplier.balance > 0 ? "text-cash-ink" : "text-ink")}>{f.money(supplier.balance)}</span>
              </div>
              {supplier.balance > 0 ? (
                <div className="mt-4 flex gap-2">
                  <div className="flex-1">
                    <MoneyInput value={amount} onChange={(n) => setAmount(Math.min(n, supplier.balance))} ariaLabel={t("Amount to pay", "পরিশোধের পরিমাণ")} />
                  </div>
                  <Button onClick={() => setAmount(supplier.balance)}>{t("All", "সব")}</Button>
                  <Button variant="primary" disabled={amount <= 0} onClick={pay}>
                    {t("Record payment", "পরিশোধ লিখুন")}
                  </Button>
                </div>
              ) : (
                <p className="mt-2 text-[13px] text-ok">{t("All settled with this supplier.", "এই সাপ্লায়ারের সাথে সব পরিশোধিত।")}</p>
              )}
            </div>
          )}
          <div>
            <h3 className="text-[13px] font-medium text-ink-2">{t("Purchase history", "ক্রয়ের ইতিহাস")}</h3>
            {list.length === 0 ? (
              <p className="mt-2 text-[13px] text-ink-3">{t("Nothing bought from this supplier yet.", "এখনো কিছু কেনা হয়নি।")}</p>
            ) : (
              <ul className="mt-2 divide-y divide-line overflow-hidden rounded-md border border-line">
                {list.map((p) => {
                  const units = p.lines.reduce((s, l) => s + l.qty, 0);
                  const items = [...new Set(p.lines.map((l) => products.find((x) => x.id === l.productId)?.name).filter(Boolean))];
                  return (
                    <li key={p.id} className="px-4 py-3">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="font-mono text-[13px] font-medium text-ink">{p.ref}</span>
                        {showMoney && <span className="tnum text-sm font-semibold text-ink">{f.money(p.total)}</span>}
                      </div>
                      <p className="mt-0.5 text-xs text-ink-3">
                        {f.date(p.date)} · {t(`${units} units`, `${f.num(units)}টি`)}
                        {showMoney && p.paid < p.total && <span className="text-cash-ink"> · {t(`${f.money(p.total - p.paid)} on credit`, `${f.money(p.total - p.paid)} বাকিতে`)}</span>}
                      </p>
                      <p className="mt-1 line-clamp-2 text-xs text-ink-2">{items.join(", ")}</p>
                      {p.note && <p className="mt-1 text-xs italic text-ink-3">{p.note}</p>}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </Sheet>
  );
}

function AddSupplierSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const toast = useToast();
  const addSupplier = useStore((s) => s.addSupplier);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [tried, setTried] = useState(false);
  const phoneOk = !phone || !!normalizePhone(phone);
  const close = () => {
    setName("");
    setPhone("");
    setAddress("");
    setTried(false);
    onClose();
  };
  const save = () => {
    setTried(true);
    if (!name.trim() || !phoneOk) return;
    addSupplier({ name: name.trim(), phone: normalizePhone(phone) ?? "", address: address.trim() || undefined });
    toast({ title: t("Supplier added", "সাপ্লায়ার যোগ হয়েছে") });
    close();
  };
  return (
    <Sheet
      open={open}
      onClose={close}
      title={t("Add supplier", "সাপ্লায়ার যোগ")}
      width={440}
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            {t("Cancel", "বাতিল")}
          </Button>
          <Button variant="primary" className="ml-auto" onClick={save}>
            {t("Add supplier", "সাপ্লায়ার যোগ")}
          </Button>
        </>
      }
    >
      <div className="space-y-4 p-5">
        <Field label={t("Name", "নাম")} htmlFor="sup-name" error={tried && !name.trim() ? t("Add a name", "নাম দিন") : undefined}>
          <Input id="sup-name" data-autofocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Tangail Taant Ghor" aria-invalid={tried && !name.trim()} />
        </Field>
        <Field label={t("Mobile", "মোবাইল")} optional={t("Optional", "ঐচ্ছিক")} htmlFor="sup-phone" error={!phoneOk && tried ? t("Use a Bangladeshi mobile number, like 01712-345678", "বাংলাদেশি মোবাইল নম্বর দিন") : undefined}>
          <Input id="sup-phone" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="01XXXXXXXXX" aria-invalid={!phoneOk && tried} />
        </Field>
        <Field label={t("Address", "ঠিকানা")} optional={t("Optional", "ঐচ্ছিক")} htmlFor="sup-addr">
          <Textarea id="sup-addr" className="min-h-16" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Islampur, Old Dhaka" />
        </Field>
      </div>
    </Sheet>
  );
}

