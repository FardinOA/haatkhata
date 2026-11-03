"use client";

import { ArrowsLeftRight, DotsThree, MagnifyingGlass, MapPin, Plus, Star, Trash, Warehouse } from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import { ProductThumb } from "../bits";
import { Badge, Button, cn, EmptyState, Field, IconButton, Input, Panel, PanelHeader, Select, Stepper, Textarea } from "../ui/core";
import { Menu, Sheet, useConfirm, useToast } from "../ui/overlays";
import { VariantPicker } from "./variant-picker";
import { useCan, useFmt, useT } from "@/lib/hooks";
import { defaultLocationId, locationBreakdown, qtyAt } from "@/lib/stock-ops";
import { getVariant, useStore } from "@/lib/store";
import type { Location } from "@/lib/types";

const locName = (l: Location | undefined, lang: string) => (l ? (lang === "bn" ? l.nameBn || l.name : l.name) : "");

/** Locations tab (FR-STK-10): where stock sits, and moving it between places. */
export function Locations() {
  const t = useT();
  const f = useFmt();
  const can = useCan();
  const toast = useToast();
  const [confirm, confirmNode] = useConfirm();
  const locations = useStore((s) => s.locations);
  const products = useStore((s) => s.products);
  const def = useStore((s) => defaultLocationId(s));
  const saveLocation = useStore((s) => s.saveLocation);
  const deleteLocation = useStore((s) => s.deleteLocation);
  const [adding, setAdding] = useState<{ id?: string; name: string; nameBn: string } | null>(null);
  const [transfer, setTransfer] = useState<{ from?: string; variantId?: string } | null>(null);
  const [q, setQ] = useState("");
  const [only, setOnly] = useState<string>("");

  const stockRows = useMemo(
    () => products.filter((p) => !p.bundle?.length).flatMap((p) => p.variants.filter((v) => v.onHand !== 0).map((v) => ({ p, v, split: locationBreakdown(v, def) }))),
    [products, def],
  );
  const totals = useMemo(() => {
    const out: Record<string, { units: number; value: number; cost: number; skus: number }> = {};
    for (const l of locations) out[l.id] = { units: 0, value: 0, cost: 0, skus: 0 };
    for (const r of stockRows)
      for (const [loc, n] of Object.entries(r.split)) {
        if (!out[loc] || !n) continue;
        out[loc].units += n;
        out[loc].value += n * r.v.price;
        out[loc].cost += n * r.v.cost;
        out[loc].skus += 1;
      }
    return out;
  }, [stockRows, locations]);

  const filtered = stockRows.filter((r) => {
    if (only && !(r.split[only] > 0)) return false;
    if (!q.trim()) return true;
    const hay = `${r.p.name} ${r.p.nameBn ?? ""} ${r.v.sku} ${Object.values(r.v.options).join(" ")}`.toLowerCase();
    return q.toLowerCase().split(/\s+/).every((w) => hay.includes(w));
  });

  const save = () => {
    if (!adding?.name.trim()) return;
    const id = saveLocation({ id: adding.id, name: adding.name.trim(), nameBn: adding.nameBn.trim() || adding.name.trim() });
    if (id) toast({ title: adding.id ? t("Location updated", "লোকেশন আপডেট হয়েছে") : t(`${adding.name.trim()} added`, `${adding.name.trim()} যোগ হয়েছে`) });
    setAdding(null);
  };

  if (!locations.length)
    return (
      <Panel>
        <EmptyState
          icon={<Warehouse />}
          title={t("Keep stock in more than one place?", "একাধিক জায়গায় স্টক রাখেন?")}
          body={t("Add your shop, home store or warehouse. Everything you have now starts at the first one, and you can move units between them any time.", "দোকান, বাসা বা গুদাম যোগ করুন। এখনকার সব স্টক প্রথমটিতে থাকবে, পরে যেকোনো সময় সরাতে পারবেন।")}
          action={
            can("settings") ? (
              <Button variant="primary" icon={<Plus className="size-4" weight="bold" />} onClick={() => setAdding({ name: t("Shop", "দোকান"), nameBn: "দোকান" })}>
                {t("Add your first location", "প্রথম লোকেশন যোগ করুন")}
              </Button>
            ) : undefined
          }
        />
        <LocationSheet value={adding} onChange={setAdding} onSave={save} />
      </Panel>
    );

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {locations.map((l) => {
          const tot = totals[l.id] ?? { units: 0, value: 0, cost: 0, skus: 0 };
          return (
            <Panel key={l.id} className={cn("relative p-4", !l.active && "opacity-60")}>
              <div className="flex items-start justify-between gap-2">
                <span className={cn("grid size-9 place-items-center rounded-md", l.isDefault ? "bg-brand text-brand-contrast" : "bg-sunken text-ink-2")}>
                  <MapPin className="size-[18px]" weight={l.isDefault ? "fill" : "regular"} />
                </span>
                {can("settings") && (
                  <Menu
                    items={[
                      { label: t("Rename", "নাম বদলান"), onSelect: () => setAdding({ id: l.id, name: l.name, nameBn: l.nameBn }) },
                      ...(!l.isDefault ? [{ label: t("Sell from here by default", "এখান থেকে বিক্রি (ডিফল্ট)"), icon: <Star />, onSelect: () => saveLocation({ id: l.id, name: l.name, isDefault: true }) }] : []),
                      { label: t("Move stock from here", "এখান থেকে স্টক সরান"), icon: <ArrowsLeftRight />, onSelect: () => setTransfer({ from: l.id }) },
                      ...(!l.isDefault
                        ? [
                            { type: "divider" as const },
                            {
                              label: t("Delete location", "লোকেশন মুছুন"),
                              icon: <Trash />,
                              danger: true,
                              onSelect: async () => {
                                if (await confirm({ title: t(`Delete ${l.name}?`, `${l.name} মুছবেন?`), body: t("Only empty locations can be deleted. Move its stock first.", "শুধু খালি লোকেশন মোছা যায়। আগে স্টক সরান।"), confirm: t("Delete", "মুছুন"), danger: true })) deleteLocation(l.id);
                              },
                            },
                          ]
                        : []),
                    ]}
                    trigger={({ toggle, ref }) => (
                      <IconButton ref={ref} label={t("Location actions", "লোকেশনের কাজ")} size="sm" onClick={toggle}>
                        <DotsThree className="size-5" weight="bold" />
                      </IconButton>
                    )}
                  />
                )}
              </div>
              <p className="mt-3 flex items-center gap-2 text-[15px] font-semibold text-ink">
                {locName(l, t.lang)}
                {l.isDefault && <Badge tone="brand">{t("Sells from here", "এখান থেকে বিক্রি")}</Badge>}
              </p>
              <p className="figure mt-2 text-[28px] font-semibold leading-none text-ink">{f.num(tot.units)}</p>
              <p className="mt-1 text-xs text-ink-3">
                {t(`units · ${tot.skus} items · worth ${f.money(tot.value)}`, `টি · ${f.num(tot.skus)} পণ্য · দাম ${f.money(tot.value)}`)}
              </p>
            </Panel>
          );
        })}
        {can("settings") && (
          <button
            type="button"
            onClick={() => setAdding({ name: "", nameBn: "" })}
            className="flex min-h-[148px] flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-line-strong text-sm font-medium text-ink-3 transition-colors hover:border-brand-300 hover:bg-brand-50/40 hover:text-brand-ink"
          >
            <Plus className="size-5" weight="bold" />
            {t("Add a location", "লোকেশন যোগ করুন")}
          </button>
        )}
      </div>

      <Panel className="overflow-hidden">
        <PanelHeader
          title={t("Where each item is", "কোন পণ্য কোথায়")}
          sub={t("Units at each location. Totals always match what you have on hand.", "প্রতিটি লোকেশনে কতটি। মোট সবসময় হাতের স্টকের সমান।")}
          action={
            can("edit_stock") && locations.length > 1 ? (
              <Button size="sm" variant="primary" icon={<ArrowsLeftRight className="size-4" />} onClick={() => setTransfer({})}>
                {t("Move stock", "স্টক সরান")}
              </Button>
            ) : undefined
          }
        />
        <div className="flex flex-wrap items-center gap-2 px-5 pb-3 pt-4">
          <Input className="min-w-0 flex-1 sm:max-w-xs" inputSize="sm" leading={<MagnifyingGlass className="size-4" />} placeholder={t("Product or SKU", "পণ্য বা SKU")} value={q} onChange={(e) => setQ(e.target.value)} aria-label={t("Search", "খুঁজুন")} />
          <Select inputSize="sm" className="w-48" value={only} onChange={(e) => setOnly(e.target.value)} aria-label={t("Show items at", "যেখানে আছে")}>
            <option value="">{t("All locations", "সব লোকেশন")}</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {t(`Only at ${l.name}`, `শুধু ${locName(l, "bn")}`)}
              </option>
            ))}
          </Select>
        </div>
        <div className="scroll-thin overflow-x-auto">
          <table className="w-full min-w-[560px] text-[13.5px]">
            <thead>
              <tr className="border-y border-line bg-surface-2 text-left text-xs text-ink-3">
                <th className="px-5 py-2.5 font-medium">{t("Item", "পণ্য")}</th>
                {locations.map((l) => (
                  <th key={l.id} className="px-3 py-2.5 text-right font-medium">
                    {locName(l, t.lang)}
                  </th>
                ))}
                <th className="px-5 py-2.5 text-right font-medium">{t("Total", "মোট")}</th>
                {can("edit_stock") && locations.length > 1 && <th className="w-12" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filtered.slice(0, 200).map(({ p, v, split }) => (
                <tr key={v.id} className="hover:bg-surface-2/60">
                  <td className="px-5 py-2.5">
                    <span className="flex items-center gap-3">
                      <ProductThumb product={p} size={32} rounded="sm" />
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-ink">{t.lang === "bn" ? p.nameBn || p.name : p.name}</span>
                        <span className="block truncate text-xs text-ink-3">{Object.values(v.options).join(" / ") || v.sku}</span>
                      </span>
                    </span>
                  </td>
                  {locations.map((l) => (
                    <td key={l.id} className={cn("tnum px-3 py-2.5 text-right", split[l.id] ? "text-ink" : "text-ink-4")}>
                      {split[l.id] ? f.num(split[l.id]) : "—"}
                    </td>
                  ))}
                  <td className="tnum px-5 py-2.5 text-right font-semibold text-ink">{f.num(v.onHand)}</td>
                  {can("edit_stock") && locations.length > 1 && (
                    <td className="pr-3">
                      <IconButton label={t("Move this item", "এই পণ্য সরান")} size="sm" onClick={() => setTransfer({ variantId: v.id, from: Object.entries(split).sort((a, b) => b[1] - a[1])[0]?.[0] })}>
                        <ArrowsLeftRight className="size-4" />
                      </IconButton>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {!filtered.length && <EmptyState title={t("Nothing matches", "কিছু মেলেনি")} body={t("Try another search or location.", "অন্যভাবে খুঁজুন।")} />}
        </div>
      </Panel>

      <LocationSheet value={adding} onChange={setAdding} onSave={save} />
      <TransferSheet seed={transfer} onClose={() => setTransfer(null)} />
      {confirmNode}
    </div>
  );
}

function LocationSheet({ value, onChange, onSave }: { value: { id?: string; name: string; nameBn: string } | null; onChange: (v: { id?: string; name: string; nameBn: string } | null) => void; onSave: () => void }) {
  const t = useT();
  return (
    <Sheet
      open={!!value}
      onClose={() => onChange(null)}
      title={value?.id ? t("Rename location", "লোকেশনের নাম বদলান") : t("New location", "নতুন লোকেশন")}
      sub={t("A shop, home store, warehouse — anywhere you keep stock.", "দোকান, বাসা, গুদাম — যেখানে স্টক রাখেন।")}
      width={440}
      footer={
        <>
          <Button variant="ghost" onClick={() => onChange(null)}>
            {t("Cancel", "বাতিল")}
          </Button>
          <Button variant="primary" className="ml-auto" disabled={!value?.name.trim()} onClick={onSave}>
            {value?.id ? t("Save", "সেভ") : t("Add location", "লোকেশন যোগ")}
          </Button>
        </>
      }
    >
      {value && (
        <div className="grid gap-4 p-5">
          <Field label={t("Name", "নাম")} htmlFor="loc-name">
            <Input id="loc-name" data-autofocus value={value.name} onChange={(e) => onChange({ ...value, name: e.target.value })} placeholder={t("e.g. Mirpur warehouse", "যেমন মিরপুর গুদাম")} />
          </Field>
          <Field label={t("Name in Bangla", "বাংলায় নাম")} htmlFor="loc-namebn" optional={t("optional", "ঐচ্ছিক")}>
            <Input id="loc-namebn" lang="bn" value={value.nameBn} onChange={(e) => onChange({ ...value, nameBn: e.target.value })} />
          </Field>
        </div>
      )}
    </Sheet>
  );
}

/** Move units between two locations. The total never changes; the ledger records both sides. */
export function TransferSheet({ seed, onClose }: { seed: { from?: string; variantId?: string } | null; onClose: () => void }) {
  const t = useT();
  const f = useFmt();
  const toast = useToast();
  const locations = useStore((s) => s.locations);
  const products = useStore((s) => s.products);
  const def = useStore((s) => defaultLocationId(s));
  const transferStock = useStore((s) => s.transferStock);
  const [state, setState] = useState<{ key: string; from: string; to: string; lines: { variantId: string; qty: number }[]; note: string } | null>(null);

  // Re-seed whenever the sheet is opened with a new starting point.
  const key = seed ? `${seed.from ?? ""}|${seed.variantId ?? ""}` : "";
  if (seed && state?.key !== key) {
    const from = seed.from ?? def ?? locations[0]?.id ?? "";
    const to = locations.find((l) => l.id !== from)?.id ?? "";
    setState({ key, from, to, lines: seed.variantId ? [{ variantId: seed.variantId, qty: 1 }] : [], note: "" });
  }
  if (!seed && state) setState(null);
  const s = state;
  const bundleIds = useMemo(() => new Set(products.filter((p) => p.bundle?.length).flatMap((p) => p.variants.map((v) => v.id))), [products]);
  const exclude = useMemo(() => new Set([...bundleIds, ...(s?.lines.map((l) => l.variantId) ?? [])]), [bundleIds, s?.lines]);
  const units = s?.lines.reduce((a, l) => a + l.qty, 0) ?? 0;
  const over = s?.lines.some((l) => {
    const hit = getVariant(products, l.variantId);
    return !hit || l.qty > qtyAt(hit.v, s.from, def);
  });

  const submit = () => {
    if (!s || !s.lines.length || over) return;
    const id = transferStock(s.from, s.to, s.lines.filter((l) => l.qty > 0), s.note.trim() || undefined);
    if (id) {
      toast({ title: t(`Moved ${units} units`, `${f.num(units)}টি সরানো হয়েছে`), body: `${locName(locations.find((l) => l.id === s.from), t.lang)} → ${locName(locations.find((l) => l.id === s.to), t.lang)}` });
      onClose();
    }
  };

  return (
    <Sheet
      open={!!seed}
      onClose={onClose}
      title={t("Move stock", "স্টক সরান")}
      sub={t("The total stays the same — both sides are written to the ledger.", "মোট একই থাকে — দুই দিকই লেজারে লেখা হয়।")}
      width={560}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t("Cancel", "বাতিল")}
          </Button>
          <Button variant="primary" className="ml-auto" disabled={!s?.lines.length || !!over || s?.from === s?.to} onClick={submit} icon={<ArrowsLeftRight className="size-4" />}>
            {units ? t(`Move ${units} units`, `${f.num(units)}টি সরান`) : t("Move", "সরান")}
          </Button>
        </>
      }
    >
      {s && (
        <div className="space-y-5 p-5">
          <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-2">
            <Field label={t("From", "থেকে")} htmlFor="tr-from">
              <Select id="tr-from" value={s.from} onChange={(e) => setState({ ...s, from: e.target.value, to: e.target.value === s.to ? (locations.find((l) => l.id !== e.target.value)?.id ?? "") : s.to })}>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {locName(l, t.lang)}
                  </option>
                ))}
              </Select>
            </Field>
            <IconButton label={t("Swap", "উল্টান")} className="mb-0.5" onClick={() => setState({ ...s, from: s.to, to: s.from })}>
              <ArrowsLeftRight className="size-4" />
            </IconButton>
            <Field label={t("To", "যেখানে")} htmlFor="tr-to">
              <Select id="tr-to" value={s.to} onChange={(e) => setState({ ...s, to: e.target.value })}>
                {locations
                  .filter((l) => l.id !== s.from)
                  .map((l) => (
                    <option key={l.id} value={l.id}>
                      {locName(l, t.lang)}
                    </option>
                  ))}
              </Select>
            </Field>
          </div>
          <VariantPicker onPick={({ v }) => setState({ ...s, lines: [...s.lines, { variantId: v.id, qty: 1 }] })} exclude={exclude} placeholder={t("Add an item to move", "সরানোর পণ্য যোগ করুন")} />
          {s.lines.length > 0 && (
            <ul className="divide-y divide-line rounded-md border border-line">
              {s.lines.map((l) => {
                const hit = getVariant(products, l.variantId);
                if (!hit) return null;
                const have = qtyAt(hit.v, s.from, def);
                return (
                  <li key={l.variantId} className="flex items-center gap-3 px-3 py-2.5">
                    <ProductThumb product={hit.p} size={36} rounded="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-medium text-ink">{hit.p.name}</span>
                      <span className={cn("block text-xs", l.qty > have ? "text-danger" : "text-ink-3")}>{t(`${have} at ${locName(locations.find((x) => x.id === s.from), "en")}`, `সেখানে ${f.num(have)}টি`)}</span>
                    </span>
                    <Stepper size="sm" value={l.qty} min={1} max={Math.max(1, have)} onChange={(n) => setState({ ...s, lines: s.lines.map((x) => (x.variantId === l.variantId ? { ...x, qty: n } : x)) })} />
                    <IconButton label={t("Remove", "সরান")} size="sm" onClick={() => setState({ ...s, lines: s.lines.filter((x) => x.variantId !== l.variantId) })}>
                      <Trash className="size-4" />
                    </IconButton>
                  </li>
                );
              })}
            </ul>
          )}
          <Field label={t("Note", "নোট")} optional={t("optional", "ঐচ্ছিক")} htmlFor="tr-note">
            <Textarea id="tr-note" className="min-h-16" value={s.note} onChange={(e) => setState({ ...s, note: e.target.value })} placeholder={t("e.g. For the weekend fair", "যেমন সাপ্তাহিক মেলার জন্য")} />
          </Field>
        </div>
      )}
    </Sheet>
  );
}
