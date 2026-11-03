"use client";

import { LockSimple, SlidersHorizontal, X } from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import { ProductThumb } from "../bits";
import { Button, cn, EmptyState, Field, IconButton, Input, Panel, PanelHeader, Segmented, Select, Textarea } from "../ui/core";
import { useToast } from "../ui/overlays";
import { VariantPicker } from "./variant-picker";
import { useCan, useFmt, useT } from "@/lib/hooks";
import { available } from "@/lib/domain";
import { REASON_LABEL } from "@/lib/labels";
import { getVariant, useStore } from "@/lib/store";
import { defaultLocationId, qtyAt } from "@/lib/stock-ops";

type Mode = "count" | "remove";
const COUNT_REASONS = [
  { id: "count", en: "Count correction", bn: "গণনা সংশোধন" },
  { id: "found", en: "Found extra stock", bn: "বাড়তি স্টক পাওয়া গেছে" },
  { id: "other", en: "Other", bn: "অন্যান্য" },
];
const REMOVE_REASONS = [
  { id: "damaged", en: "Damaged", bn: "নষ্ট" },
  { id: "lost", en: "Lost or stolen", bn: "হারানো বা চুরি" },
  { id: "gift", en: "Gift or sample", bn: "উপহার বা স্যাম্পল" },
  { id: "other", en: "Other", bn: "অন্যান্য" },
];

export function Adjust() {
  const t = useT();
  const f = useFmt();
  const can = useCan();
  const toast = useToast();
  const products = useStore((s) => s.products);
  const movements = useStore((s) => s.movements);
  const adjustStock = useStore((s) => s.adjustStock);
  const locations = useStore((s) => s.locations);
  const defaultLoc = useStore((s) => defaultLocationId(s));
  const [locationId, setLocationId] = useState("");
  const bundleIds = useMemo(() => new Set(products.filter((p) => p.bundle?.length).flatMap((p) => p.variants.map((v) => v.id))), [products]);

  const [variantId, setVariantId] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("count");
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("count");
  const [note, setNote] = useState("");
  const [tried, setTried] = useState(false);

  const recent = useMemo(
    () =>
      movements
        .filter((m) => m.reason === "adjust" || m.reason === "damage")
        .sort((a, b) => b.at.localeCompare(a.at))
        .slice(0, 8),
    [movements],
  );

  if (!can("edit_stock"))
    return (
      <Panel>
        <EmptyState icon={<LockSimple />} title={t("Your role can't change stock", "আপনার ভূমিকায় স্টক বদলানো যায় না")} body={t("Ask an owner or manager to adjust counts. Every change is recorded with who made it.", "মালিক বা ম্যানেজারকে বলুন। প্রতিটি পরিবর্তন কে করেছে তা লেখা থাকে।")} />
      </Panel>
    );

  const hit = variantId ? getVariant(products, variantId) : null;
  const n = parseInt(qty.replace(/\D/g, "") || "", 10);
  const valid = Number.isFinite(n);
  // With several locations, counts and write-offs apply to one location.
  const loc = locations.length > 1 ? locationId || defaultLoc || "" : "";
  const base = hit ? (loc ? qtyAt(hit.v, loc, defaultLoc) : hit.v.onHand) : 0;
  const newOnHand = !hit || !valid ? null : mode === "count" ? n : base - n;
  const delta = hit && newOnHand !== null ? newOnHand - base : 0;
  const qtyError = tried && !valid ? t("Enter a quantity", "সংখ্যা দিন") : mode === "remove" && hit && valid && n > base ? t(`Only ${base} on hand`, `মাত্র ${f.num(base)}টি আছে`) : undefined;
  const noteError = tried && !note.trim() ? t("Say what happened — it's kept in the ledger.", "কী হয়েছে লিখুন — লেজারে থাকবে।") : undefined;
  const reasons = mode === "count" ? COUNT_REASONS : REMOVE_REASONS;

  const submit = () => {
    setTried(true);
    if (!hit || !valid || !note.trim() || qtyError || newOnHand === null || newOnHand < 0) return;
    if (delta === 0) {
      toast({ title: t("Count matches — nothing to change", "গণনা মিলেছে — বদলানোর কিছু নেই"), tone: "info" });
      return;
    }
    const r = reasons.find((x) => x.id === reason)!;
    adjustStock(hit.v.id, newOnHand, reason === "damaged" ? "damage" : "adjust", `${r.en}: ${note.trim()}`, loc || undefined);
    toast({ title: t(`Stock updated: ${delta > 0 ? "+" : "−"}${Math.abs(delta)}`, `স্টক আপডেট: ${delta > 0 ? "+" : "−"}${f.num(Math.abs(delta))}`), body: `${hit.p.name} · ${Object.values(hit.v.options).join(" / ") || hit.v.sku}` });
    setQty("");
    setNote("");
    setTried(false);
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
      <Panel className="p-5 md:p-6">
        <h3 className="font-display text-[17px] font-semibold text-ink">{t("Adjust stock", "স্টক সমন্বয়")}</h3>
        <p className="mt-0.5 text-[13px] text-ink-3">{t("Fix a count, or write off damaged or lost items. A reason and a note are required.", "গণনা ঠিক করুন বা নষ্ট/হারানো বাদ দিন। কারণ ও নোট লাগবে।")}</p>

        <div className="mt-5">
          {hit ? (
            <div className="flex items-center gap-3 rounded-md border border-line bg-surface-2 p-3">
              <ProductThumb product={hit.p} size={44} rounded="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{t.lang === "bn" ? hit.p.nameBn || hit.p.name : hit.p.name}</p>
                <p className="truncate text-xs text-ink-3">
                  {Object.values(hit.v.options).join(" / ") || t("Default", "ডিফল্ট")} · <span className="font-mono">{hit.v.sku}</span>
                </p>
              </div>
              <dl className="tnum hidden gap-5 text-right text-xs sm:flex">
                <div>
                  <dt className="text-ink-3">{t("On hand", "হাতে")}</dt>
                  <dd className="text-base font-semibold text-ink">{f.num(hit.v.onHand)}</dd>
                </div>
                <div>
                  <dt className="text-ink-3">{t("Held", "রিজার্ভ")}</dt>
                  <dd className="text-base font-semibold text-ink">{f.num(hit.v.reserved)}</dd>
                </div>
                <div>
                  <dt className="text-ink-3">{t("Free", "খালি")}</dt>
                  <dd className="text-base font-semibold text-ink">{f.num(available(hit.v))}</dd>
                </div>
              </dl>
              <IconButton label={t("Choose another item", "অন্য পণ্য")} size="sm" onClick={() => setVariantId(null)}>
                <X className="size-4" />
              </IconButton>
            </div>
          ) : (
            <Field label={t("Item", "পণ্য")}>
              <VariantPicker onPick={({ v }) => setVariantId(v.id)} exclude={bundleIds} />
            </Field>
          )}
          {tried && !hit && <p className="mt-1.5 text-xs text-danger">{t("Pick the item to adjust", "কোন পণ্য বাছুন")}</p>}
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field label={t("What are you doing?", "কী করছেন?")} className="sm:col-span-2">
            <Segmented<Mode>
              className="w-full sm:w-auto"
              value={mode}
              onChange={(m) => {
                setMode(m);
                setReason(m === "count" ? "count" : "damaged");
                setQty("");
              }}
              options={[
                { value: "count", label: t("Set counted quantity", "গণনা অনুযায়ী সেট") },
                { value: "remove", label: t("Write off items", "পণ্য বাদ দিন") },
              ]}
            />
          </Field>
          {locations.length > 1 && (
            <Field label={t("Location", "লোকেশন")} htmlFor="adj-loc" className="sm:col-span-2" hint={hit ? t(`${base} here now`, `এখানে এখন ${f.num(base)}টি`) : undefined}>
              <Select id="adj-loc" value={loc} onChange={(e) => setLocationId(e.target.value)}>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {t.lang === "bn" ? l.nameBn || l.name : l.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <Field
            label={mode === "count" ? t("Counted on the shelf", "শেলফে গণনা") : t("How many to write off", "কতটি বাদ")}
            htmlFor="adj-qty"
            error={qtyError}
            hint={
              hit && valid && newOnHand !== null && !qtyError ? (
                <span className={cn("tnum font-medium", delta > 0 ? "text-ok" : delta < 0 ? "text-danger" : "text-ink-3")}>
                  {delta === 0 ? t("Matches the system", "সিস্টেমের সাথে মিলেছে") : t(`${delta > 0 ? "+" : "−"}${Math.abs(delta)} → ${newOnHand} on hand`, `${delta > 0 ? "+" : "−"}${f.num(Math.abs(delta))} → ${f.num(newOnHand)}টি`)}
                </span>
              ) : undefined
            }
          >
            <Input id="adj-qty" inputMode="numeric" className="tnum" value={qty} onChange={(e) => setQty(e.target.value.replace(/\D/g, ""))} placeholder={hit ? String(mode === "count" ? base : 1) : "0"} aria-invalid={!!qtyError} />
          </Field>
          <Field label={t("Reason", "কারণ")} htmlFor="adj-reason">
            <Select id="adj-reason" value={reason} onChange={(e) => setReason(e.target.value)}>
              {reasons.map((r) => (
                <option key={r.id} value={r.id}>
                  {t(r.en, r.bn)}
                </option>
              ))}
            </Select>
          </Field>
          <Field className="sm:col-span-2" label={t("Note", "নোট")} htmlFor="adj-note" error={noteError}>
            <Textarea id="adj-note" value={note} onChange={(e) => setNote(e.target.value)} aria-invalid={!!noteError} placeholder={mode === "count" ? t("e.g. Monthly count, shelf B", "যেমন মাসিক গণনা, শেলফ বি") : t("e.g. Stain on the border, can't sell", "যেমন পাড়ে দাগ, বিক্রি করা যাবে না")} />
          </Field>
        </div>
        <div className="mt-5 flex justify-end">
          <Button variant="primary" icon={<SlidersHorizontal className="size-4" />} onClick={submit}>
            {t("Save adjustment", "সমন্বয় সেভ করুন")}
          </Button>
        </div>
      </Panel>

      <Panel className="self-start">
        <PanelHeader title={t("Recent adjustments", "সাম্প্রতিক সমন্বয়")} sub={t("Visible to the owner in the audit trail", "মালিক অডিটে দেখতে পান")} />
        {recent.length === 0 ? (
          <p className="px-5 pb-5 pt-3 text-[13px] text-ink-3">{t("No adjustments yet.", "এখনো কোনো সমন্বয় নেই।")}</p>
        ) : (
          <ul className="mt-2 divide-y divide-line">
            {recent.map((m) => {
              const h = getVariant(products, m.variantId);
              return (
                <li key={m.id} className="flex gap-3 px-5 py-3">
                  <span className={cn("tnum w-10 shrink-0 pt-0.5 text-right text-sm font-semibold", m.delta > 0 ? "text-ok" : "text-danger")}>
                    {m.delta > 0 ? "+" : "−"}
                    {f.num(Math.abs(m.delta))}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-ink">
                      {h ? (t.lang === "bn" ? h.p.nameBn || h.p.name : h.p.name) : "—"}
                      {h && Object.keys(h.v.options).length > 0 && <span className="font-normal text-ink-3"> · {Object.values(h.v.options).join(" / ")}</span>}
                    </span>
                    <span className="block text-xs text-ink-3">{m.note ?? t.pick(REASON_LABEL[m.reason])}</span>
                    <span className="block text-xs text-ink-4">
                      {m.by} · {f.relative(m.at)}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
}
