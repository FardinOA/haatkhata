"use client";

import { CheckCircle, ClipboardText, PaperPlaneTilt, PencilSimple, Plus, Printer, Trash, Truck, XCircle } from "@phosphor-icons/react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ProductThumb } from "../bits";
import { MoneyInput } from "../products/editor";
import { Badge, Button, cn, EmptyState, Field, IconButton, Input, Panel, Segmented, Select, Stepper, Textarea, type Tone } from "../ui/core";
import { Sheet, useConfirm, useToast } from "../ui/overlays";
import { VariantPicker } from "./variant-picker";
import { useCan, useFmt, useNow, useT } from "@/lib/hooks";
import { getVariant, useStore } from "@/lib/store";
import type { PurchaseOrder, PurchaseOrderStatus } from "@/lib/types";

export const PO_STATUS: Record<PurchaseOrderStatus, { en: string; bn: string; tone: Tone }> = {
  draft: { en: "Draft", bn: "খসড়া", tone: "neutral" },
  ordered: { en: "Ordered", bn: "অর্ডার দেওয়া", tone: "info" },
  partial: { en: "Partly received", bn: "আংশিক এসেছে", tone: "cash" },
  received: { en: "Received", bn: "এসেছে", tone: "ok" },
  closed: { en: "Closed", bn: "বন্ধ", tone: "neutral" },
  cancelled: { en: "Cancelled", bn: "বাতিল", tone: "danger" },
};

export const poTotal = (po: Pick<PurchaseOrder, "lines">) => po.lines.reduce((s, l) => s + l.qty * l.unitCost, 0);

/** Purchase orders tab (FR-STK-11): order from suppliers, receive in parts. */
export function PurchaseOrders() {
  const t = useT();
  const f = useFmt();
  const can = useCan();
  const pos = useStore((s) => s.purchaseOrders);
  const suppliers = useStore((s) => s.suppliers);
  const nowMs = useNow();
  const [view, setView] = useState<"open" | "all">("open");
  const [editing, setEditing] = useState<PurchaseOrder | "new" | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const list = pos.filter((p) => view === "all" || ["draft", "ordered", "partial"].includes(p.status));
  const open = pos.find((p) => p.id === openId) ?? null;
  const showCost = can("view_cost");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented<"open" | "all">
          value={view}
          onChange={setView}
          options={[
            { value: "open", label: t(`Open · ${pos.filter((p) => ["draft", "ordered", "partial"].includes(p.status)).length}`, `চলমান · ${f.num(pos.filter((p) => ["draft", "ordered", "partial"].includes(p.status)).length)}`) },
            { value: "all", label: t("All", "সব") },
          ]}
        />
        {can("edit_stock") && (
          <Button variant="primary" icon={<Plus className="size-4" weight="bold" />} onClick={() => setEditing("new")}>
            {t("New purchase order", "নতুন ক্রয় অর্ডার")}
          </Button>
        )}
      </div>

      <Panel className="overflow-hidden">
        {list.length ? (
          <ul className="divide-y divide-line">
            {list.map((po) => {
              const ordered = po.lines.reduce((s, l) => s + l.qty, 0);
              const got = po.lines.reduce((s, l) => s + Math.min(l.received, l.qty), 0);
              const sup = suppliers.find((s) => s.id === po.supplierId);
              const late = po.expectedAt && ["ordered", "partial"].includes(po.status) && new Date(po.expectedAt).getTime() < nowMs;
              const st = PO_STATUS[po.status];
              return (
                <li key={po.id}>
                  <button type="button" onClick={() => setOpenId(po.id)} className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-5 py-4 text-left transition-colors hover:bg-surface-2 md:grid-cols-[120px_minmax(0,1fr)_160px_150px_120px]">
                    <span className="flex items-center gap-2 md:block">
                      <span className="tnum block text-sm font-semibold text-ink">{po.no}</span>
                      <Badge tone={st.tone} className="md:mt-1">
                        {t(st.en, st.bn)}
                      </Badge>
                    </span>
                    <span className="min-w-0 max-md:order-first max-md:col-span-2">
                      <span className="block truncate text-[14px] font-medium text-ink">{sup?.name ?? t("No supplier", "সাপ্লায়ার নেই")}</span>
                      <span className="block truncate text-xs text-ink-3">
                        {t(`${po.lines.length} items · ${ordered} units`, `${f.num(po.lines.length)} পণ্য · ${f.num(ordered)}টি`)}
                        {po.note ? ` · ${po.note}` : ""}
                      </span>
                    </span>
                    <span>
                      <span className="flex h-1.5 overflow-hidden rounded-full bg-sunken">
                        <span className="rounded-full bg-ok" style={{ width: `${ordered ? (got / ordered) * 100 : 0}%` }} />
                      </span>
                      <span className="tnum mt-1 block text-xs text-ink-3">{t(`${got} of ${ordered} received`, `${f.num(ordered)}টির মধ্যে ${f.num(got)}টি এসেছে`)}</span>
                    </span>
                    <span className={cn("text-xs max-md:hidden", late ? "font-medium text-danger" : "text-ink-3")}>
                      {po.expectedAt ? t(`Expected ${f.dateShort(po.expectedAt)}`, `প্রত্যাশিত ${f.dateShort(po.expectedAt)}`) : t("No date", "তারিখ নেই")}
                      {late && <span className="block">{t("Late", "দেরি")}</span>}
                    </span>
                    <span className="tnum text-right text-sm font-semibold text-ink max-md:hidden">{showCost ? f.money(poTotal(po)) : ""}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState
            icon={<ClipboardText />}
            title={view === "open" ? t("No open purchase orders", "কোনো চলমান ক্রয় অর্ডার নেই") : t("No purchase orders yet", "এখনো ক্রয় অর্ডার নেই")}
            body={t("Order from a supplier here, then receive it in one go or as parcels arrive. Costs and stock update automatically.", "এখান থেকে সাপ্লায়ারকে অর্ডার দিন, তারপর একবারে বা ভাগে ভাগে গ্রহণ করুন। খরচ ও স্টক নিজে আপডেট হবে।")}
          />
        )}
      </Panel>

      <POEditor value={editing} onClose={() => setEditing(null)} onSaved={(id) => setOpenId(id)} />
      <PODetail po={open} onClose={() => setOpenId(null)} onEdit={(po) => {
          setOpenId(null);
          setEditing(po);
        }} />
    </div>
  );
}

type EditLine = { variantId: string; productId: string; qty: number; unitCost: number };

function POEditor({ value, onClose, onSaved }: { value: PurchaseOrder | "new" | null; onClose: () => void; onSaved: (id: string) => void }) {
  const t = useT();
  const f = useFmt();
  const can = useCan();
  const toast = useToast();
  const products = useStore((s) => s.products);
  const suppliers = useStore((s) => s.suppliers);
  const locations = useStore((s) => s.locations);
  const savePO = useStore((s) => s.savePurchaseOrder);
  const setStatus = useStore((s) => s.setPurchaseOrderStatus);
  const [form, setForm] = useState<{ key: string; supplierId: string; expectedAt: string; locationId: string; note: string; lines: EditLine[] } | null>(null);
  const key = value === "new" ? "new" : (value?.id ?? "");
  if (value && form?.key !== key)
    setForm(
      value === "new"
        ? { key, supplierId: suppliers[0]?.id ?? "", expectedAt: "", locationId: "", note: "", lines: [] }
        : { key, supplierId: value.supplierId ?? "", expectedAt: value.expectedAt?.slice(0, 10) ?? "", locationId: value.locationId ?? "", note: value.note ?? "", lines: value.lines.map(({ variantId, productId, qty, unitCost }) => ({ variantId, productId, qty, unitCost })) },
    );
  if (!value && form) setForm(null);
  const bundleIds = useMemo(() => new Set(products.filter((p) => p.bundle?.length).flatMap((p) => p.variants.map((v) => v.id))), [products]);
  const exclude = useMemo(() => new Set([...bundleIds, ...(form?.lines.map((l) => l.variantId) ?? [])]), [bundleIds, form?.lines]);
  const showCost = can("view_cost");
  const total = form?.lines.reduce((s, l) => s + l.qty * l.unitCost, 0) ?? 0;

  const save = (send: boolean) => {
    if (!form?.lines.length) return;
    const id = savePO({
      id: value !== "new" ? value?.id : undefined,
      supplierId: form.supplierId || undefined,
      expectedAt: form.expectedAt ? new Date(`${form.expectedAt}T12:00:00`).toISOString() : undefined,
      locationId: form.locationId || undefined,
      note: form.note.trim() || undefined,
      lines: form.lines.map((l) => ({ ...l, received: 0 })),
    });
    if (!id) return;
    if (send && (value === "new" || value?.status === "draft")) setStatus(id, "ordered");
    toast({ title: send ? t("Purchase order sent", "ক্রয় অর্ডার পাঠানো হয়েছে") : t("Saved as draft", "খসড়া সেভ হয়েছে") });
    onClose();
    onSaved(id);
  };

  return (
    <Sheet
      open={!!value}
      onClose={onClose}
      title={value === "new" ? t("New purchase order", "নতুন ক্রয় অর্ডার") : t(`Edit ${value?.no ?? ""}`, `${value?.no ?? ""} সম্পাদনা`)}
      width={640}
      footer={
        <>
          {showCost && <span className="tnum text-sm text-ink-2">{t("Total", "মোট")} <b className="text-ink">{f.money(total)}</b></span>}
          <Button variant="secondary" className="ml-auto" disabled={!form?.lines.length} onClick={() => save(false)}>
            {t("Save draft", "খসড়া সেভ")}
          </Button>
          <Button variant="primary" disabled={!form?.lines.length} icon={<PaperPlaneTilt className="size-4" />} onClick={() => save(true)}>
            {value !== "new" && value?.status !== "draft" ? t("Save", "সেভ") : t("Save & mark ordered", "সেভ ও অর্ডার দিন")}
          </Button>
        </>
      }
    >
      {form && (
        <div className="space-y-5 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("Supplier", "সাপ্লায়ার")} htmlFor="po-sup">
              <Select id="po-sup" value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })}>
                <option value="">{t("No supplier", "সাপ্লায়ার নেই")}</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t("Expected on", "কবে আসবে")} htmlFor="po-date" optional={t("optional", "ঐচ্ছিক")}>
              <Input id="po-date" type="date" value={form.expectedAt} onChange={(e) => setForm({ ...form, expectedAt: e.target.value })} />
            </Field>
            {locations.length > 1 && (
              <Field label={t("Deliver to", "কোথায় আসবে")} htmlFor="po-loc">
                <Select id="po-loc" value={form.locationId} onChange={(e) => setForm({ ...form, locationId: e.target.value })}>
                  <option value="">{t("Default location", "ডিফল্ট লোকেশন")}</option>
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {t.lang === "bn" ? l.nameBn || l.name : l.name}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
          </div>
          <VariantPicker onPick={({ p, v }) => setForm({ ...form, lines: [...form.lines, { variantId: v.id, productId: p.id, qty: Math.max(1, v.lowStock * 3), unitCost: v.cost }] })} exclude={exclude} placeholder={t("Add an item to order", "অর্ডারের পণ্য যোগ করুন")} />
          {form.lines.length > 0 && (
            <ul className="divide-y divide-line rounded-md border border-line">
              {form.lines.map((l) => {
                const hit = getVariant(products, l.variantId);
                if (!hit) return null;
                return (
                  <li key={l.variantId} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                    <ProductThumb product={hit.p} size={36} rounded="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-medium text-ink">{hit.p.name}</span>
                      <span className="block truncate text-xs text-ink-3">{Object.values(hit.v.options).join(" / ") || hit.v.sku} · {t(`${hit.v.onHand} in stock`, `স্টকে ${f.num(hit.v.onHand)}টি`)}</span>
                    </span>
                    <Stepper size="sm" value={l.qty} min={1} onChange={(n) => setForm({ ...form, lines: form.lines.map((x) => (x.variantId === l.variantId ? { ...x, qty: n } : x)) })} />
                    {showCost && (
                      <div className="w-28">
                        <MoneyInput size="sm" value={l.unitCost} onChange={(n) => setForm({ ...form, lines: form.lines.map((x) => (x.variantId === l.variantId ? { ...x, unitCost: n } : x)) })} ariaLabel={t("Unit cost", "একক খরচ")} />
                      </div>
                    )}
                    <IconButton label={t("Remove", "সরান")} size="sm" onClick={() => setForm({ ...form, lines: form.lines.filter((x) => x.variantId !== l.variantId) })}>
                      <Trash className="size-4" />
                    </IconButton>
                  </li>
                );
              })}
            </ul>
          )}
          <Field label={t("Note to supplier", "সাপ্লায়ারের জন্য নোট")} optional={t("optional", "ঐচ্ছিক")} htmlFor="po-note">
            <Textarea id="po-note" className="min-h-16" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </Field>
        </div>
      )}
    </Sheet>
  );
}

function PODetail({ po, onClose, onEdit }: { po: PurchaseOrder | null; onClose: () => void; onEdit: (po: PurchaseOrder) => void }) {
  const t = useT();
  const f = useFmt();
  const can = useCan();
  const toast = useToast();
  const [confirm, confirmNode] = useConfirm();
  const products = useStore((s) => s.products);
  const suppliers = useStore((s) => s.suppliers);
  const locations = useStore((s) => s.locations);
  const setStatus = useStore((s) => s.setPurchaseOrderStatus);
  const receive = useStore((s) => s.receivePurchaseOrder);
  const [rx, setRx] = useState<{ key: string; lines: Record<string, { qty: number; unitCost: number; code: string; expiry: string }>; paid: number } | null>(null);
  const canReceive = po && ["draft", "ordered", "partial"].includes(po.status) && can("edit_stock");
  if (!po && rx) setRx(null);
  const sup = suppliers.find((s) => s.id === po?.supplierId);
  const showCost = can("view_cost");

  const startReceive = () =>
    po &&
    setRx({
      key: po.id,
      paid: 0,
      lines: Object.fromEntries(po.lines.map((l) => [l.variantId, { qty: Math.max(0, l.qty - l.received), unitCost: l.unitCost, code: "", expiry: "" }])),
    });

  const rxUnits = rx ? Object.values(rx.lines).reduce((s, l) => s + l.qty, 0) : 0;
  const rxTotal = rx ? Object.values(rx.lines).reduce((s, l) => s + l.qty * l.unitCost, 0) : 0;

  const submitReceive = () => {
    if (!po || !rx || !rxUnits) return;
    const id = receive(
      po.id,
      Object.entries(rx.lines)
        .filter(([, l]) => l.qty > 0)
        .map(([variantId, l]) => ({ variantId, qty: l.qty, unitCost: l.unitCost, batch: l.code.trim() ? { code: l.code.trim(), expiry: l.expiry || undefined } : undefined })),
      Math.min(rx.paid, rxTotal),
    );
    if (id) {
      toast({ title: t(`Received ${rxUnits} units`, `${f.num(rxUnits)}টি গ্রহণ হয়েছে`), body: t("Stock and average costs are updated.", "স্টক ও গড় খরচ আপডেট হয়েছে।") });
      setRx(null);
    }
  };

  return (
    <Sheet
      open={!!po}
      onClose={onClose}
      title={
        <span className="flex items-center gap-2">
          {po?.no}
          {po && <Badge tone={PO_STATUS[po.status].tone}>{t(PO_STATUS[po.status].en, PO_STATUS[po.status].bn)}</Badge>}
        </span>
      }
      sub={po ? `${sup?.name ?? t("No supplier", "সাপ্লায়ার নেই")}${po.expectedAt ? ` · ${t("expected", "প্রত্যাশিত")} ${f.date(po.expectedAt)}` : ""}${po.locationId ? ` · ${locations.find((l) => l.id === po.locationId)?.name ?? ""}` : ""}` : undefined}
      width={620}
      footer={
        po && (
          <>
            <Link href={`/po/${po.id}`} target="_blank" className="inline-flex h-10 items-center gap-2 rounded-md px-3 text-sm font-medium text-ink-2 hover:bg-sunken">
              <Printer className="size-4" />
              {t("Print", "প্রিন্ট")}
            </Link>
            {rx ? (
              <>
                <Button variant="ghost" className="ml-auto" onClick={() => setRx(null)}>
                  {t("Back", "পেছনে")}
                </Button>
                <Button variant="primary" disabled={!rxUnits} icon={<Truck className="size-4" />} onClick={submitReceive}>
                  {t(`Receive ${rxUnits} units`, `${f.num(rxUnits)}টি গ্রহণ`)}
                </Button>
              </>
            ) : (
              <>
                {["draft", "ordered"].includes(po.status) && can("edit_stock") && (
                  <Button variant="ghost" icon={<PencilSimple className="size-4" />} onClick={() => onEdit(po)}>
                    {t("Edit", "সম্পাদনা")}
                  </Button>
                )}
                <span className="ml-auto" />
                {po.status === "draft" && can("edit_stock") && (
                  <Button icon={<PaperPlaneTilt className="size-4" />} onClick={() => setStatus(po.id, "ordered")}>
                    {t("Mark ordered", "অর্ডার দেওয়া হয়েছে")}
                  </Button>
                )}
                {canReceive && (
                  <Button variant="primary" icon={<Truck className="size-4" />} onClick={startReceive}>
                    {t("Receive items", "পণ্য গ্রহণ")}
                  </Button>
                )}
              </>
            )}
          </>
        )
      }
    >
      {po && !rx && (
        <div className="p-5">
          <ul className="divide-y divide-line rounded-md border border-line">
            {po.lines.map((l) => {
              const hit = getVariant(products, l.variantId);
              const pct = l.qty ? Math.min(1, l.received / l.qty) : 0;
              return (
                <li key={l.variantId} className="flex items-center gap-3 px-3 py-3">
                  {hit && <ProductThumb product={hit.p} size={36} rounded="sm" />}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-medium text-ink">{hit?.p.name ?? l.variantId}</span>
                    <span className="block truncate text-xs text-ink-3">{hit ? Object.values(hit.v.options).join(" / ") || hit.v.sku : ""}</span>
                    <span className="mt-1.5 flex h-1 w-32 overflow-hidden rounded-full bg-sunken">
                      <span className={cn("rounded-full", pct >= 1 ? "bg-ok" : "bg-cash")} style={{ width: `${pct * 100}%` }} />
                    </span>
                  </span>
                  <span className="tnum text-right text-[13px]">
                    <span className="block font-semibold text-ink">{t(`${l.received} / ${l.qty}`, `${f.num(l.received)} / ${f.num(l.qty)}`)}</span>
                    {showCost && <span className="block text-xs text-ink-3">× {f.money(l.unitCost)}</span>}
                  </span>
                </li>
              );
            })}
          </ul>
          {showCost && (
            <p className="tnum mt-3 text-right text-sm text-ink-2">
              {t("Order total", "অর্ডারের মোট")} <b className="text-ink">{f.money(poTotal(po))}</b>
            </p>
          )}
          {po.note && <p className="mt-4 rounded-md bg-surface-2 px-3 py-2 text-[13px] text-ink-2">{po.note}</p>}
          <h4 className="mb-2 mt-6 text-[13px] font-semibold text-ink">{t("History", "ইতিহাস")}</h4>
          <ol className="space-y-2.5 border-l-2 border-line pl-4">
            {[...po.history].reverse().map((h, i) => (
              <li key={i} className="relative text-[13px]">
                <span className="absolute -left-[21px] top-1.5 size-2 rounded-full bg-line-strong" />
                <span className="text-ink">{h.note}</span>
                <span className="text-ink-3"> · {h.by} · {f.relative(h.at)}</span>
              </li>
            ))}
          </ol>
          {["draft", "ordered", "partial", "received"].includes(po.status) && can("edit_stock") && (
            <div className="mt-6 flex flex-wrap gap-2 border-t border-line pt-4">
              {["partial", "received", "ordered"].includes(po.status) && (
                <Button
                  size="sm"
                  variant="ghost"
                  icon={<CheckCircle className="size-4" />}
                  onClick={async () => {
                    if (await confirm({ title: t(`Close ${po.no}?`, `${po.no} বন্ধ করবেন?`), body: t("Anything not received yet won't be expected any more.", "যা আসেনি তা আর প্রত্যাশিত থাকবে না।"), confirm: t("Close", "বন্ধ") })) setStatus(po.id, "closed");
                  }}
                >
                  {t("Close order", "অর্ডার বন্ধ")}
                </Button>
              )}
              {["draft", "ordered"].includes(po.status) && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-danger"
                  icon={<XCircle className="size-4" />}
                  onClick={async () => {
                    if (await confirm({ title: t(`Cancel ${po.no}?`, `${po.no} বাতিল করবেন?`), confirm: t("Cancel order", "বাতিল"), danger: true })) setStatus(po.id, "cancelled");
                  }}
                >
                  {t("Cancel order", "অর্ডার বাতিল")}
                </Button>
              )}
            </div>
          )}
        </div>
      )}
      {po && rx && (
        <div className="space-y-4 p-5">
          <p className="text-[13px] text-ink-3">{t("Enter what actually arrived. You can receive the rest later.", "যা এসেছে তা লিখুন। বাকিটা পরে গ্রহণ করতে পারবেন।")}</p>
          <ul className="divide-y divide-line rounded-md border border-line">
            {po.lines.map((l) => {
              const hit = getVariant(products, l.variantId);
              const r = rx.lines[l.variantId];
              const upd = (patch: Partial<typeof r>) => setRx({ ...rx, lines: { ...rx.lines, [l.variantId]: { ...r, ...patch } } });
              return (
                <li key={l.variantId} className="space-y-2 px-3 py-3">
                  <div className="flex flex-wrap items-center gap-3">
                    {hit && <ProductThumb product={hit.p} size={34} rounded="sm" />}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-medium text-ink">{hit?.p.name}</span>
                      <span className="block text-xs text-ink-3">{t(`${Math.max(0, l.qty - l.received)} still to come`, `${f.num(Math.max(0, l.qty - l.received))}টি আসা বাকি`)}</span>
                    </span>
                    <Stepper size="sm" value={r.qty} min={0} onChange={(n) => upd({ qty: n })} />
                    {showCost && (
                      <div className="w-28">
                        <MoneyInput size="sm" value={r.unitCost} onChange={(n) => upd({ unitCost: n })} ariaLabel={t("Unit cost", "একক খরচ")} />
                      </div>
                    )}
                  </div>
                  {hit?.p.trackBatches && r.qty > 0 && (
                    <div className="flex flex-wrap gap-2 pl-[46px]">
                      <Input inputSize="sm" className="w-28" placeholder={t("Batch no.", "ব্যাচ নং")} aria-label={t("Batch number", "ব্যাচ নম্বর")} value={r.code} onChange={(e) => upd({ code: e.target.value })} />
                      <Input inputSize="sm" type="date" className="w-40" aria-label={t("Expiry date", "মেয়াদ শেষ")} value={r.expiry} onChange={(e) => upd({ expiry: e.target.value })} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          {showCost && (
            <Field label={t("Paid to supplier now", "এখন পরিশোধ")} htmlFor="rx-paid" hint={rxTotal - rx.paid > 0 ? t(`${f.money(rxTotal - rx.paid)} added to what you owe`, `${f.money(rxTotal - rx.paid)} বাকি হিসেবে যোগ হবে`) : t("Paid in full", "পুরো পরিশোধ")}>
              <MoneyInput id="rx-paid" value={rx.paid} onChange={(n) => setRx({ ...rx, paid: Math.min(n, rxTotal) })} />
            </Field>
          )}
        </div>
      )}
      {confirmNode}
    </Sheet>
  );
}
