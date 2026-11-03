"use client";

import { ArrowRight, CheckCircle, FileText, PaperPlaneTilt, Plus, Printer, Trash } from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ChannelIcon, PageHeader, ProductThumb } from "../bits";
import { VariantPicker } from "../inventory/variant-picker";
import { MoneyInput } from "../products/editor";
import { Badge, Button, cn, EmptyState, Field, IconButton, Input, Panel, Segmented, Select, Stepper, Textarea, type Tone } from "../ui/core";
import { Sheet, useToast } from "../ui/overlays";
import { CHANNELS, normalizePhone, orderTotals } from "@/lib/domain";
import { useCan, useFmt, useNow, useT } from "@/lib/hooks";
import { CHANNEL_LABEL } from "@/lib/labels";
import { getVariant, useStore } from "@/lib/store";
import type { Channel, Quote, QuoteStatus } from "@/lib/types";

const STATUS: Record<QuoteStatus, { en: string; bn: string; tone: Tone }> = {
  draft: { en: "Draft", bn: "খসড়া", tone: "neutral" },
  sent: { en: "Sent", bn: "পাঠানো", tone: "info" },
  accepted: { en: "Accepted", bn: "গৃহীত", tone: "ok" },
  converted: { en: "Became an order", bn: "অর্ডার হয়েছে", tone: "brand" },
  expired: { en: "Expired", bn: "মেয়াদ শেষ", tone: "danger" },
};

const quoteTotals = (q: Pick<Quote, "lines" | "discount" | "deliveryCharge">) =>
  orderTotals({ lines: q.lines.map((l) => ({ ...l, cost: 0, returnedQty: 0 })) as never, discount: q.discount, deliveryCharge: q.deliveryCharge, otherCharges: 0, payments: [], settlement: "cod" });

/** Quotations (FR-INV-11): price offers you can share, then turn into orders. */
export function QuotesScreen() {
  const t = useT();
  const f = useFmt();
  const nowMs = useNow(3_600_000);
  const quotes = useStore((s) => s.quotes);
  const [filter, setFilter] = useState<"open" | "all">("open");
  const [editing, setEditing] = useState<Quote | "new" | null>(null);
  const today = new Date(nowMs).toISOString().slice(0, 10);
  const effective = (q: Quote): QuoteStatus => (q.status !== "converted" && q.status !== "accepted" && q.validUntil < today ? "expired" : q.status);
  const list = quotes.filter((q) => filter === "all" || !["converted", "expired"].includes(effective(q)));
  const openValue = quotes.filter((q) => ["draft", "sent", "accepted"].includes(effective(q))).reduce((s, q) => s + quoteTotals(q).total, 0);

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-6 md:px-8 md:py-8">
      <PageHeader
        title={t("Quotations", "কোটেশন")}
        sub={t(`Price offers for bulk and wholesale buyers · ${f.money(openValue)} open`, `পাইকারি ক্রেতাদের দামের প্রস্তাব · খোলা ${f.money(openValue)}`)}
        actions={
          <Button variant="primary" icon={<Plus className="size-4" weight="bold" />} onClick={() => setEditing("new")}>
            {t("New quotation", "নতুন কোটেশন")}
          </Button>
        }
      />
      <div className="mt-6 flex items-center justify-between">
        <Segmented<"open" | "all">
          value={filter}
          onChange={setFilter}
          options={[
            { value: "open", label: t("Open", "খোলা") },
            { value: "all", label: t("All", "সব") },
          ]}
        />
      </div>
      <Panel className="mt-4 overflow-hidden">
        {list.length ? (
          <ul className="divide-y divide-line">
            {list.map((q) => {
              const st = STATUS[effective(q)];
              return (
                <li key={q.id}>
                  <button type="button" onClick={() => setEditing(q)} className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-5 py-4 text-left hover:bg-surface-2 md:grid-cols-[110px_minmax(0,1fr)_140px_120px_110px]">
                    <span className="tnum text-sm font-semibold text-ink">{q.no}</span>
                    <span className="min-w-0 max-md:order-first max-md:col-span-2">
                      <span className="flex items-center gap-2 text-[14px] font-medium text-ink">
                        <ChannelIcon channel={q.channel} />
                        <span className="truncate">{q.customer?.name ?? t("No customer", "কাস্টমার নেই")}</span>
                      </span>
                      <span className="block truncate text-xs text-ink-3">{t(`${q.lines.reduce((s, l) => s + l.qty, 0)} pieces · ${q.lines.length} items`, `${f.num(q.lines.reduce((s, l) => s + l.qty, 0))}টি · ${f.num(q.lines.length)} পণ্য`)}</span>
                    </span>
                    <Badge tone={st.tone}>{t(st.en, st.bn)}</Badge>
                    <span className="text-xs text-ink-3 max-md:hidden">{t(`Valid till ${f.dateShort(`${q.validUntil}T12:00:00`)}`, `${f.dateShort(`${q.validUntil}T12:00:00`)} পর্যন্ত`)}</span>
                    <span className="tnum text-right text-sm font-semibold text-ink">{f.money(quoteTotals(q).total)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState
            icon={<FileText />}
            title={t("No quotations here", "এখানে কোনো কোটেশন নেই")}
            body={t("Send a buyer a clean price list with your logo. When they say yes, turn it into an order in one tap.", "লোগোসহ দামের তালিকা পাঠান। রাজি হলে এক ট্যাপে অর্ডার বানান।")}
            action={
              <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setEditing("new")}>
                {t("New quotation", "নতুন কোটেশন")}
              </Button>
            }
          />
        )}
      </Panel>
      <QuoteEditor value={editing} onClose={() => setEditing(null)} status={editing && editing !== "new" ? effective(editing) : "draft"} />
    </div>
  );
}

type Line = Quote["lines"][number];

function QuoteEditor({ value, onClose, status }: { value: Quote | "new" | null; onClose: () => void; status: QuoteStatus }) {
  const t = useT();
  const f = useFmt();
  const can = useCan();
  const toast = useToast();
  const router = useRouter();
  const products = useStore((s) => s.products);
  const presets = useStore((s) => s.pos.deliveryPresets);
  const saveQuote = useStore((s) => s.saveQuote);
  const setStatus = useStore((s) => s.setQuoteStatus);
  const convert = useStore((s) => s.convertQuote);
  type Form = { key: string; name: string; phone: string; line: string; area: string; district: string; channel: Channel; lines: Line[]; discount: number; deliveryCharge: number; validUntil: string; notes: string };
  const [form, setForm] = useState<Form | null>(null);
  const nowMs = useNow(3_600_000);
  const key = value === "new" ? "new" : (value?.id ?? "");
  if (value && form?.key !== key) {
    const in7 = new Date(nowMs + 7 * 86_400_000).toISOString().slice(0, 10);
    setForm(
      value === "new"
        ? { key, name: "", phone: "", line: "", area: "", district: "Dhaka", channel: "whatsapp", lines: [], discount: 0, deliveryCharge: 0, validUntil: in7, notes: "" }
        : {
            key,
            name: value.customer?.name ?? "",
            phone: value.customer?.phone ?? "",
            line: value.customer?.address?.line ?? "",
            area: value.customer?.address?.area ?? "",
            district: value.customer?.address?.district ?? "Dhaka",
            channel: value.channel,
            lines: value.lines.map((l) => ({ ...l })),
            discount: value.discount.value,
            deliveryCharge: value.deliveryCharge,
            validUntil: value.validUntil,
            notes: value.notes ?? "",
          },
    );
  }
  if (!value && form) setForm(null);
  const locked = status === "converted";
  const exclude = useMemo(() => new Set(form?.lines.map((l) => l.variantId) ?? []), [form?.lines]);
  const totals = form ? quoteTotals({ lines: form.lines, discount: { type: "flat", value: form.discount }, deliveryCharge: form.deliveryCharge }) : null;
  const phoneOk = !form?.phone || !!normalizePhone(form.phone);

  const persist = (): string | undefined => {
    if (!form || !form.lines.length || !phoneOk) return;
    const phone = normalizePhone(form.phone);
    return saveQuote({
      id: value !== "new" ? value?.id : undefined,
      customer: form.name.trim() || phone ? { name: form.name.trim() || "Customer", phone: phone ?? "", address: form.line || form.area ? { line: form.line, area: form.area, district: form.district } : undefined } : null,
      channel: form.channel,
      lines: form.lines,
      discount: { type: "flat", value: form.discount },
      deliveryCharge: form.deliveryCharge,
      validUntil: form.validUntil,
      notes: form.notes.trim() || undefined,
    });
  };

  return (
    <Sheet
      open={!!value}
      onClose={onClose}
      title={value === "new" ? t("New quotation", "নতুন কোটেশন") : (value?.no ?? "")}
      sub={value !== "new" && value ? t(STATUS[status].en, STATUS[status].bn) : t("A price offer the buyer can accept later.", "ক্রেতা পরে গ্রহণ করতে পারবেন এমন দামের প্রস্তাব।")}
      width={680}
      footer={
        form &&
        (locked ? (
          <>
            <Link href={`/quote/${(value as Quote).id}`} className="inline-flex h-10 items-center gap-2 rounded-md px-3 text-sm font-medium text-ink-2 hover:bg-sunken">
              <Printer className="size-4" />
              {t("View", "দেখুন")}
            </Link>
            <Button variant="primary" className="ml-auto" iconRight={<ArrowRight className="size-4" />} onClick={() => router.push(`/orders?id=${(value as Quote).orderId}`)}>
              {t("Open the order", "অর্ডার খুলুন")}
            </Button>
          </>
        ) : (
          <>
            {totals && <span className="tnum text-sm text-ink-2">{t("Total", "মোট")} <b className="text-ink">{f.money(totals.total)}</b></span>}
            <Button
              variant="secondary"
              className="ml-auto"
              disabled={!form.lines.length || !phoneOk}
              icon={<Printer className="size-4" />}
              onClick={() => {
                const id = persist();
                if (id) router.push(`/quote/${id}`);
              }}
            >
              {t("Save & share", "সেভ ও শেয়ার")}
            </Button>
            {value !== "new" && can("create_order") && (
              <Button
                variant="primary"
                disabled={!form.lines.length}
                icon={<CheckCircle className="size-4" />}
                onClick={() => {
                  const id = persist();
                  if (!id) return;
                  const order = convert(id, "confirm");
                  if (order) {
                    toast({ title: t(`Order #${order.no} created`, `অর্ডার #${f.num(order.no)} তৈরি হয়েছে`), body: t("Stock is held for it.", "স্টক রিজার্ভ হয়েছে।") });
                    onClose();
                    router.push(`/orders?id=${order.id}`);
                  }
                }}
              >
                {t("Turn into order", "অর্ডার বানান")}
              </Button>
            )}
            {value === "new" && (
              <Button
                variant="primary"
                disabled={!form.lines.length || !phoneOk}
                onClick={() => {
                  if (persist()) {
                    toast({ title: t("Quotation saved", "কোটেশন সেভ হয়েছে") });
                    onClose();
                  }
                }}
              >
                {t("Save", "সেভ")}
              </Button>
            )}
          </>
        ))
      }
    >
      {form && (
        <fieldset disabled={locked} className="space-y-5 p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("Buyer's name", "ক্রেতার নাম")} htmlFor="q-name">
              <Input id="q-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label={t("Phone", "ফোন")} htmlFor="q-phone" error={!phoneOk ? t("Use a Bangladeshi mobile number", "বাংলাদেশি মোবাইল নম্বর দিন") : undefined}>
              <Input id="q-phone" inputMode="tel" placeholder="01XXXXXXXXX" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} aria-invalid={!phoneOk} />
            </Field>
            <Field label={t("Address", "ঠিকানা")} htmlFor="q-line" optional={t("optional", "ঐচ্ছিক")}>
              <Input id="q-line" value={form.line} onChange={(e) => setForm({ ...form, line: e.target.value })} />
            </Field>
            <Field label={t("Area", "এলাকা")} htmlFor="q-area" optional={t("optional", "ঐচ্ছিক")}>
              <Input id="q-area" value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} />
            </Field>
            <Field label={t("Talking on", "কোথায় কথা হচ্ছে")} htmlFor="q-ch">
              <Select id="q-ch" value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value as Channel })}>
                {CHANNELS.map((c) => (
                  <option key={c} value={c}>
                    {t.pick(CHANNEL_LABEL[c])}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t("Valid until", "মেয়াদ")} htmlFor="q-valid">
              <Input id="q-valid" type="date" value={form.validUntil} onChange={(e) => setForm({ ...form, validUntil: e.target.value })} />
            </Field>
          </div>

          {!locked && <VariantPicker onPick={({ p, v }) => setForm({ ...form, lines: [...form.lines, { productId: p.id, variantId: v.id, name: p.name, variantLabel: Object.values(v.options).join(" / "), qty: 1, price: v.price, discount: 0 }] })} exclude={exclude} placeholder={t("Add an item", "পণ্য যোগ করুন")} />}
          {form.lines.length > 0 && (
            <ul className="divide-y divide-line rounded-md border border-line">
              {form.lines.map((l) => {
                const hit = getVariant(products, l.variantId);
                return (
                  <li key={l.variantId} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                    {hit && <ProductThumb product={hit.p} size={36} rounded="sm" />}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-medium text-ink">{l.name}</span>
                      <span className="block truncate text-xs text-ink-3">{l.variantLabel || hit?.v.sku}</span>
                    </span>
                    <Stepper size="sm" value={l.qty} min={1} onChange={(n) => setForm({ ...form, lines: form.lines.map((x) => (x.variantId === l.variantId ? { ...x, qty: n } : x)) })} />
                    <div className="w-28">
                      <MoneyInput size="sm" value={l.price} disabled={!can("edit_price")} onChange={(n) => setForm({ ...form, lines: form.lines.map((x) => (x.variantId === l.variantId ? { ...x, price: n } : x)) })} ariaLabel={t("Price each", "একক দাম")} />
                    </div>
                    <span className="tnum w-20 text-right text-sm font-semibold text-ink">{f.money(l.qty * l.price - l.discount)}</span>
                    {!locked && (
                      <IconButton label={t("Remove", "সরান")} size="sm" onClick={() => setForm({ ...form, lines: form.lines.filter((x) => x.variantId !== l.variantId) })}>
                        <Trash className="size-4" />
                      </IconButton>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("Discount on the total", "মোটের উপর ছাড়")} htmlFor="q-disc">
              <MoneyInput id="q-disc" value={form.discount} onChange={(n) => setForm({ ...form, discount: n })} />
            </Field>
            <Field label={t("Delivery charge", "ডেলিভারি চার্জ")} htmlFor="q-del">
              <MoneyInput id="q-del" value={form.deliveryCharge} onChange={(n) => setForm({ ...form, deliveryCharge: n })} />
            </Field>
          </div>
          <div className="-mt-2 flex flex-wrap gap-1.5">
            {[{ id: "free", label: "Free", labelBn: "ফ্রি", amount: 0 }, ...presets].map((p) => (
              <button key={p.id} type="button" onClick={() => setForm({ ...form, deliveryCharge: p.amount })} className={cn("h-8 rounded-full border px-3 text-xs font-medium", form.deliveryCharge === p.amount ? "border-brand bg-brand-50 text-ink" : "border-line text-ink-2 hover:border-line-strong")}>
                {t(p.label, p.labelBn)} {p.amount ? f.money(p.amount) : ""}
              </button>
            ))}
          </div>
          <Field label={t("Note to the buyer", "ক্রেতার জন্য নোট")} optional={t("optional", "ঐচ্ছিক")} htmlFor="q-notes">
            <Textarea id="q-notes" className="min-h-16" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder={t("e.g. Wholesale price for 18+ pieces", "যেমন ১৮+ পিসের পাইকারি দাম")} />
          </Field>

          {value !== "new" && value && !locked && (
            <div className="flex flex-wrap gap-2 border-t border-line pt-4">
              <span className="mr-1 self-center text-[13px] text-ink-3">{t("Mark as", "চিহ্নিত করুন")}</span>
              {(["sent", "accepted"] as const).map((s) => (
                <Button key={s} size="sm" variant={value.status === s ? "soft" : "secondary"} icon={s === "sent" ? <PaperPlaneTilt className="size-4" /> : <CheckCircle className="size-4" />} onClick={() => setStatus(value.id, s)}>
                  {t(STATUS[s].en, STATUS[s].bn)}
                </Button>
              ))}
            </div>
          )}
        </fieldset>
      )}
    </Sheet>
  );
}
