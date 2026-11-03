"use client";

import { Plus, Trash, Truck } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ProductThumb } from "../bits";
import { MoneyInput } from "../products/editor";
import { Button, cn, EmptyState, Field, IconButton, Input, Panel, Select, Stepper, Textarea } from "../ui/core";
import { useToast } from "../ui/overlays";
import { VariantPicker, type PickedVariant } from "./variant-picker";
import { useCan, useFmt, useT } from "@/lib/hooks";
import { available, normalizePhone } from "@/lib/domain";
import { getVariant, useStore } from "@/lib/store";
import { defaultLocationId } from "@/lib/stock-ops";

type Line = { variantId: string; productId: string; qty: number; unitCost: number; batch?: { code: string; expiry?: string } };

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export function StockIn({ prefill }: { prefill: string[] }) {
  const t = useT();
  const f = useFmt();
  const can = useCan();
  const router = useRouter();
  const toast = useToast();
  const products = useStore((s) => s.products);
  const suppliers = useStore((s) => s.suppliers);
  const stockIn = useStore((s) => s.stockIn);
  const addSupplier = useStore((s) => s.addSupplier);
  const nextNo = useStore((s) => s.nextPurchaseNo);
  const locations = useStore((s) => s.locations);
  const defaultLoc = useStore((s) => defaultLocationId(s));
  const [locationId, setLocationId] = useState<string>("");
  const showCost = can("view_cost");

  const [lines, setLines] = useState<Line[]>(() =>
    prefill.flatMap((id) => {
      const hit = getVariant(products, id);
      if (!hit) return [];
      const suggested = Math.max(1, hit.v.lowStock * 3 - available(hit.v));
      return [{ variantId: id, productId: hit.p.id, qty: suggested, unitCost: hit.v.cost }];
    }),
  );
  const [supplierId, setSupplierId] = useState<string>(suppliers[0]?.id ?? "");
  const [newSup, setNewSup] = useState<{ name: string; phone: string } | null>(null);
  const [supErr, setSupErr] = useState<string | null>(null);
  const [ref, setRef] = useState("");
  const [date, setDate] = useState(today);
  const [paid, setPaid] = useState<number | null>(null);
  const [note, setNote] = useState("");

  const total = lines.reduce((s, l) => s + l.qty * l.unitCost, 0);
  const units = lines.reduce((s, l) => s + l.qty, 0);
  const paidNow = paid ?? total;
  const due = Math.max(0, total - paidNow);
  // Bundles hold no stock of their own, so they can't be received.
  const exclude = useMemo(() => new Set([...lines.map((l) => l.variantId), ...products.filter((p) => p.bundle?.length).flatMap((p) => p.variants.map((v) => v.id))]), [lines, products]);

  const add = ({ p, v }: PickedVariant) =>
    setLines((ls) => (ls.some((l) => l.variantId === v.id) ? ls.map((l) => (l.variantId === v.id ? { ...l, qty: l.qty + 1 } : l)) : [...ls, { variantId: v.id, productId: p.id, qty: 1, unitCost: v.cost }]));

  const update = (id: string, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.variantId === id ? { ...l, ...patch } : l)));

  const saveSupplier = () => {
    if (!newSup) return;
    const phone = normalizePhone(newSup.phone);
    if (!newSup.name.trim()) return setSupErr(t("Add the supplier's name", "সাপ্লায়ারের নাম দিন"));
    if (newSup.phone && !phone) return setSupErr(t("Use a Bangladeshi mobile number, like 01712-345678", "বাংলাদেশি মোবাইল নম্বর দিন"));
    const id = addSupplier({ name: newSup.name.trim(), phone: phone ?? "" });
    setSupplierId(id);
    setNewSup(null);
    setSupErr(null);
  };

  const submit = () => {
    if (!lines.length) return;
    const pref = ref.trim();
    stockIn({
      supplierId: supplierId || undefined,
      ref: pref || undefined,
      date: new Date(`${date}T${new Date().toTimeString().slice(0, 8)}`).toISOString(),
      lines: lines.filter((l) => l.qty > 0).map((l) => (l.batch?.code.trim() ? { ...l, batch: { code: l.batch.code.trim(), expiry: l.batch.expiry || undefined } } : { ...l, batch: undefined })),
      locationId: locationId || undefined,
      paid: Math.min(paidNow, total),
      note: note.trim() || undefined,
    });
    toast({
      title: t(`Added ${units} units to stock`, `${f.num(units)}টি স্টকে যোগ হয়েছে`),
      body: due > 0 ? t(`${f.money(due)} added to what you owe the supplier.`, `সাপ্লায়ারের কাছে বাকি ${f.money(due)} যোগ হয়েছে।`) : undefined,
      action: { label: t("View ledger", "লেজার দেখুন"), onClick: () => router.replace("/inventory?tab=ledger") },
    });
    setLines([]);
    setRef("");
    setPaid(null);
    setNote("");
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-5">
        <Panel className="p-5">
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)]">
            <Field label={t("Supplier", "সাপ্লায়ার")} htmlFor="si-sup" error={supErr ?? undefined}>
              {newSup ? (
                <div className="space-y-2 rounded-md border border-brand-200 bg-brand-50/50 p-2.5">
                  <Input autoFocus inputSize="sm" placeholder={t("Supplier name", "সাপ্লায়ারের নাম")} value={newSup.name} onChange={(e) => setNewSup({ ...newSup, name: e.target.value })} aria-label={t("Supplier name", "সাপ্লায়ারের নাম")} />
                  <Input inputSize="sm" inputMode="tel" placeholder="01XXXXXXXXX" value={newSup.phone} onChange={(e) => setNewSup({ ...newSup, phone: e.target.value })} aria-label={t("Phone", "ফোন")} />
                  <div className="flex gap-2">
                    <Button size="sm" variant="primary" onClick={saveSupplier}>
                      {t("Add supplier", "যোগ করুন")}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => {
                        setNewSup(null);
                        setSupErr(null);
                      }}>
                      {t("Cancel", "বাতিল")}
                    </Button>
                  </div>
                </div>
              ) : (
                <Select
                  id="si-sup"
                  value={supplierId}
                  onChange={(e) => {
                    if (e.target.value === "__new") setNewSup({ name: "", phone: "" });
                    else setSupplierId(e.target.value);
                  }}
                >
                  <option value="">{t("No supplier", "সাপ্লায়ার নেই")}</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                  <option value="__new">＋ {t("New supplier…", "নতুন সাপ্লায়ার…")}</option>
                </Select>
              )}
            </Field>
            <Field label={t("Memo or bill no.", "মেমো বা বিল নং")} optional={t("Optional", "ঐচ্ছিক")} htmlFor="si-ref">
              <Input id="si-ref" value={ref} onChange={(e) => setRef(e.target.value)} placeholder={`PUR-${String(nextNo).padStart(4, "0")}`} />
            </Field>
            <Field label={t("Date received", "পাওয়ার তারিখ")} htmlFor="si-date">
              <Input id="si-date" type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} />
            </Field>
          </div>
          {locations.length > 1 && (
            <Field className="mt-4 sm:max-w-xs" label={t("Receive into", "কোথায় রাখবেন")} htmlFor="si-loc">
              <Select id="si-loc" value={locationId || defaultLoc || ""} onChange={(e) => setLocationId(e.target.value)}>
                {locations
                  .filter((l) => l.active)
                  .map((l) => (
                    <option key={l.id} value={l.id}>
                      {t.lang === "bn" ? l.nameBn || l.name : l.name}
                    </option>
                  ))}
              </Select>
            </Field>
          )}
        </Panel>

        <Panel>
          <div className="border-b border-line p-4 md:p-5">
            <VariantPicker onPick={add} exclude={exclude} autoFocus={!prefill.length} />
          </div>
          {lines.length === 0 ? (
            <EmptyState icon={<Truck />} title={t("What arrived?", "কী এসেছে?")} body={t("Search above or scan barcodes to add each item from the supplier's memo.", "উপরে খুঁজুন বা বারকোড স্ক্যান করে মেমোর প্রতিটি পণ্য যোগ করুন।")} />
          ) : (
            <ul className="divide-y divide-line">
              {lines.map((l) => {
                const hit = getVariant(products, l.variantId);
                if (!hit) return null;
                const { p, v } = hit;
                const prev = Math.max(0, v.onHand);
                const newAvg = prev + l.qty > 0 ? (prev * v.cost + l.qty * l.unitCost) / (prev + l.qty) : v.cost;
                const avgMoved = Math.abs(newAvg - v.cost) >= 0.5;
                return (
                  <li key={l.variantId} className="grid grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-3 px-4 py-3 md:grid-cols-[40px_minmax(0,1fr)_auto_120px_96px_40px] md:px-5">
                    <ProductThumb product={p} size={40} rounded="sm" />
                    <div className="min-w-0">
                      <p className="truncate text-[13.5px] font-medium text-ink">{t.lang === "bn" ? p.nameBn || p.name : p.name}</p>
                      <p className="truncate text-xs text-ink-3">
                        {Object.values(v.options).join(" / ") || v.sku} · {t(`${f.num(v.onHand)} → ${f.num(v.onHand + l.qty)} on hand`, `${f.num(v.onHand)} → ${f.num(v.onHand + l.qty)}টি`)}
                      </p>
                      {p.trackBatches && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Input inputSize="sm" className="w-28" placeholder={t("Batch no.", "ব্যাচ নং")} aria-label={t("Batch number", "ব্যাচ নম্বর")} value={l.batch?.code ?? ""} onChange={(e) => update(l.variantId, { batch: { code: e.target.value, expiry: l.batch?.expiry } })} />
                          <Input inputSize="sm" type="date" className="w-40" aria-label={t("Expiry date", "মেয়াদ শেষ")} value={l.batch?.expiry ?? ""} onChange={(e) => update(l.variantId, { batch: { code: l.batch?.code ?? "", expiry: e.target.value } })} />
                        </div>
                      )}
                      {showCost && avgMoved && (
                        <p className="tnum mt-0.5 text-xs text-ink-3">
                          {t("Avg cost", "গড় খরচ")} {f.money(Math.round(v.cost))} → <span className={cn("font-medium", newAvg > v.cost ? "text-warn" : "text-ok")}>{f.money(Math.round(newAvg))}</span>
                        </p>
                      )}
                    </div>
                    <IconButton label={t("Remove line", "সারি সরান")} size="sm" className="md:order-last" onClick={() => setLines((ls) => ls.filter((x) => x.variantId !== l.variantId))}>
                      <Trash className="size-4" />
                    </IconButton>
                    <div className="col-span-3 flex items-center gap-3 md:col-span-1 md:contents">
                      <Stepper value={l.qty} min={1} onChange={(n) => update(l.variantId, { qty: n })} size="sm" />
                      {showCost ? <MoneyInput size="sm" value={l.unitCost} onChange={(n) => update(l.variantId, { unitCost: n })} ariaLabel={t("Unit cost", "একক খরচ")} /> : <span className="hidden md:block" />}
                      <span className="tnum ml-auto text-right text-sm font-semibold text-ink md:ml-0">{showCost ? f.money(l.qty * l.unitCost) : ""}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>

      <div className="lg:sticky lg:top-24 lg:self-start">
        <Panel className="overflow-hidden">
          <div className="p-5">
            <h3 className="font-display text-[17px] font-semibold text-ink">{t("Summary", "সারাংশ")}</h3>
            <dl className="mt-4 space-y-2.5 text-[13.5px]">
              <div className="flex justify-between">
                <dt className="text-ink-3">{t("Items", "পণ্য")}</dt>
                <dd className="tnum text-ink">{f.num(lines.length)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-3">{t("Units", "সংখ্যা")}</dt>
                <dd className="tnum text-ink">{f.num(units)}</dd>
              </div>
              {showCost && (
                <div className="flex items-baseline justify-between border-t border-line pt-3">
                  <dt className="font-medium text-ink">{t("Bill total", "মোট বিল")}</dt>
                  <dd className="figure text-2xl font-semibold text-ink">{f.money(total)}</dd>
                </div>
              )}
            </dl>
            {showCost && (
              <div className="mt-4">
                <Field
                  label={t("Paid to supplier now", "এখন পরিশোধ")}
                  htmlFor="si-paid"
                  hint={
                    due > 0 ? (
                      <span className="font-medium text-cash-ink">{t(`${f.money(due)} will be added to what you owe`, `${f.money(due)} বাকি হিসেবে যোগ হবে`)}</span>
                    ) : (
                      t("Paid in full", "পুরো পরিশোধ")
                    )
                  }
                >
                  <MoneyInput id="si-paid" value={paidNow} onChange={(n) => setPaid(Math.min(n, total))} />
                </Field>
                <div className="mt-2 flex gap-2">
                  <Button size="sm" variant={paidNow >= total ? "soft" : "secondary"} onClick={() => setPaid(null)}>
                    {t("Full", "পুরো")}
                  </Button>
                  <Button size="sm" variant={paidNow === 0 && total > 0 ? "soft" : "secondary"} onClick={() => setPaid(0)}>
                    {t("On credit", "বাকিতে")}
                  </Button>
                </div>
              </div>
            )}
            <Field className="mt-4" label={t("Note", "নোট")} optional={t("Optional", "ঐচ্ছিক")} htmlFor="si-note">
              <Textarea id="si-note" className="min-h-16" value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("e.g. 2 pieces had loose threads", "যেমন ২টিতে সুতা খোলা")} />
            </Field>
          </div>
          <div className="border-t border-line bg-surface-2 p-4">
            <Button variant="primary" size="lg" className="w-full" disabled={!lines.length} onClick={submit} icon={<Plus className="size-4" weight="bold" />}>
              {lines.length ? t(`Add ${units} units to stock`, `${f.num(units)}টি স্টকে যোগ করুন`) : t("Add items to continue", "পণ্য যোগ করুন")}
            </Button>
          </div>
        </Panel>
      </div>
    </div>
  );
}
