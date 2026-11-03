"use client";

import {
  ChatCircleText,
  DotsThree,
  NotePencil,
  PauseCircle,
  Plus,
  ShoppingBagOpen,
  Trash,
  Warning,
  WarningOctagon,
  X,
} from "@phosphor-icons/react";
import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from "react";
import { CHANNEL_ICON, ProductThumb, RiskLabel, RiskRing } from "@/components/bits";
import { NetworkRisk } from "@/components/couriers/network-risk";
import { Button, cn, Field, Input, Kbd, Segmented, Select, Stepper, Textarea } from "@/components/ui/core";
import { useToast } from "@/components/ui/overlays";
import { CHANNELS, formatPhone, maxDiscountPct, normalizePhone } from "@/lib/domain";
import { DHAKA_AREAS, DISTRICTS, isInsideDhaka } from "@/lib/geo";
import { useCan, useFmt, useT } from "@/lib/hooks";
import { CHANNEL_COLOR, CHANNEL_LABEL, PAY_COLOR, PAY_LABEL } from "@/lib/labels";
import { useMe, useStore } from "@/lib/store";
import type { PayMethod } from "@/lib/types";
import { QuickPaste } from "./quick-paste";
import { newKey, usePos } from "./use-pos";

export type ComposerHandle = { focusPhone: () => void; focusPayment: () => void };

const PAY_ORDER: PayMethod[] = ["cash", "bkash", "nagad", "rocket", "bank", "card"];

/* ------------------------------------------------------------------ shell */

export const Composer = forwardRef<ComposerHandle, { onSubmit: (mode: "draft" | "confirm" | "complete", print?: boolean) => void; className?: string; inSheet?: boolean }>(
  function Composer({ onSubmit, className, inSheet }, ref) {
    const phoneRef = useRef<HTMLInputElement>(null);
    const payRef = useRef<HTMLInputElement>(null);
    const { patch, draft } = usePos();
    useImperativeHandle(ref, () => ({
      focusPhone: () => phoneRef.current?.focus(),
      focusPayment: () => {
        if (!draft.payments.length) patch((d) => ({ payments: [{ key: newKey(), method: d.channel === "walkin" ? "cash" : "bkash", amount: 0, txnId: "" }] }));
        setTimeout(() => payRef.current?.focus(), 30);
      },
    }));
    return (
      <div className={cn("flex min-h-0 flex-col", className)}>
        {!inSheet && <ComposerHeader />}
        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">
          {inSheet && <ParkedStrip className="px-5 pt-4" />}
          <CartSection />
          <CustomerSection phoneRef={phoneRef} />
          <ChargesSection />
          <PaymentSection payRef={payRef} />
          <NotesSection />
        </div>
        <Footer onSubmit={onSubmit} />
      </div>
    );
  },
);

function Section({ title, aside, children, className }: { title: React.ReactNode; aside?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("border-b border-line px-5 py-4", className)}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-[13px] font-semibold text-ink-2">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

/* ------------------------------------------------------------------ header + parked */

function ComposerHeader() {
  const t = useT();
  const f = useFmt();
  const nextNo = useStore((s) => s.nextOrderNo);
  return (
    <div className="border-b border-line px-5 pb-3 pt-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-xl font-semibold tracking-[-0.01em] text-ink">
          {t("New order", "নতুন অর্ডার")} <span className="tnum font-normal text-ink-4">#{f.digits(String(nextNo))}</span>
        </h2>
        <ParkButton />
      </div>
      <ParkedStrip className="mt-3" />
    </div>
  );
}

function ParkButton() {
  const t = useT();
  const toast = useToast();
  const { draft, reset } = usePos();
  const parkCart = useStore((s) => s.parkCart);
  const parked = useStore((s) => s.parked);
  const empty = !draft.lines.length;
  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={empty}
      icon={<PauseCircle className="size-4" />}
      onClick={() => {
        const label = draft.name.trim() || t(`Cart ${parked.length + 1}`, `কার্ট ${parked.length + 1}`);
        parkCart({ label, lines: draft.lines, channel: draft.channel, customer: draft.phone ? { name: draft.name, phone: normalizePhone(draft.phone) ?? draft.phone, address: draft.address } : null });
        reset();
        toast({ title: t(`Parked “${label}”`, `“${label}” রাখা হলো`), body: t("Pick it up from the tabs above anytime.", "উপরের ট্যাব থেকে যেকোনো সময় আবার খুলুন।"), tone: "info" });
      }}
    >
      {t("Park", "রাখুন")}
    </Button>
  );
}

function ParkedStrip({ className }: { className?: string }) {
  const t = useT();
  const f = useFmt();
  const { draft, setDraft, reset } = usePos();
  const parked = useStore((s) => s.parked);
  const parkCart = useStore((s) => s.parkCart);
  const unpark = useStore((s) => s.unpark);
  if (!parked.length) return null;
  return (
    <div className={cn("no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1", className)} aria-label={t("Parked carts", "রাখা কার্ট")}>
      <span className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-brand-50 px-3 text-xs font-semibold text-brand-ink">
        <span className="size-1.5 rounded-full bg-brand" />
        {t("This cart", "এই কার্ট")}
      </span>
      {parked.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => {
            // Swap: park what's open now, then resume the chosen cart.
            if (draft.lines.length) parkCart({ label: draft.name.trim() || t("Cart", "কার্ট"), lines: draft.lines, channel: draft.channel, customer: draft.phone ? { name: draft.name, phone: draft.phone, address: draft.address } : null });
            const got = unpark(c.id);
            if (!got) return;
            reset();
            setDraft((d) => ({
              ...d,
              lines: got.lines,
              channel: got.channel,
              name: got.customer?.name ?? "",
              phone: got.customer?.phone ?? "",
              address: got.customer?.address ?? d.address,
            }));
          }}
          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-xs font-medium text-ink-2 transition-colors hover:border-line-strong hover:text-ink"
          title={t("Resume this cart", "এই কার্ট খুলুন")}
        >
          {(() => {
            const I = CHANNEL_ICON[c.channel];
            return <I className="size-3.5" weight="fill" style={{ color: CHANNEL_COLOR[c.channel] }} />;
          })()}
          <span className="max-w-[110px] truncate">{c.label}</span>
          <span className="tnum text-ink-4">{f.num(c.lines.reduce((s, l) => s + l.qty, 0))}</span>
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ channel */

/** One row: the chosen channel shows its name, the rest are icons. */
function ChannelPicker() {
  const t = useT();
  const { draft, setChannel } = usePos();
  return (
    <div className="mb-3 flex flex-wrap gap-0.5" role="radiogroup" aria-label={t("Where did this order come from?", "অর্ডার কোথা থেকে এলো?")}>
      {CHANNELS.map((c) => {
        const I = CHANNEL_ICON[c];
        const on = draft.channel === c;
        return (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={t.pick(CHANNEL_LABEL[c])}
            title={t.pick(CHANNEL_LABEL[c])}
            onClick={() => setChannel(c)}
            className={cn(
              "inline-flex h-9 items-center gap-1.5 rounded-full text-[13px] font-medium transition-all duration-200",
              on ? "mr-1 px-3 text-ink" : "w-9 justify-center text-ink-3 hover:bg-sunken hover:text-ink-2 max-[400px]:w-8",
            )}
            style={on ? { background: `color-mix(in oklab, ${CHANNEL_COLOR[c]} 12%, white)`, boxShadow: `inset 0 0 0 1.5px ${CHANNEL_COLOR[c]}` } : undefined}
          >
            <I className="size-[18px] shrink-0" weight={on ? "fill" : "regular"} style={on ? { color: CHANNEL_COLOR[c] } : undefined} />
            {on && <span className="whitespace-nowrap">{t.pick(CHANNEL_LABEL[c])}</span>}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ customer */

function CustomerSection({ phoneRef }: { phoneRef: React.RefObject<HTMLInputElement | null> }) {
  const syncMode = useStore((s) => s.sync.mode);
  const t = useT();
  const f = useFmt();
  const { draft, patch, pickCustomer, clearCustomer, matched, matchedStats, matchedRisk, setDistrict, phoneValid } = usePos();
  const customers = useStore((s) => s.customers);
  const [focus, setFocus] = useState(false);
  const [paste, setPaste] = useState(false);
  const [showAddress, setShowAddress] = useState(true);
  const walkin = draft.channel === "walkin";
  const [optionalOpen, setOptionalOpen] = useState(false);

  const digits = draft.phone.replace(/[০-৯]/g, (d) => String("০১২৩৪৫৬৭৮৯".indexOf(d))).replace(/\D/g, "");
  const suggestions = useMemo(() => {
    if (matched || (digits.length < 3 && draft.phone.trim().length < 2)) return [];
    const q = draft.phone.trim().toLowerCase();
    return customers.filter((c) => (digits.length >= 3 && c.phone.includes(digits)) || c.name.toLowerCase().includes(q)).slice(0, 5);
  }, [customers, digits, draft.phone, matched]);

  if (walkin && !optionalOpen && !draft.phone) {
    return (
      <Section title={t("Customer", "কাস্টমার")}>
        <ChannelPicker />
        <button
          type="button"
          onClick={() => setOptionalOpen(true)}
          className="flex w-full items-center gap-3 rounded-md border border-dashed border-line-strong px-4 py-3 text-left text-sm text-ink-3 transition-colors hover:border-brand hover:text-brand-ink"
        >
          <Plus className="size-4" />
          {t("Add customer (optional for walk-in)", "কাস্টমার যোগ করুন (দোকানের বিক্রিতে ঐচ্ছিক)")}
        </button>
      </Section>
    );
  }

  return (
    <Section
      title={t("Customer", "কাস্টমার")}
      aside={
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => setPaste(true)} className="inline-flex h-7 items-center gap-1.5 rounded-full bg-brand-50 px-2.5 text-xs font-semibold text-brand-ink hover:bg-brand-100">
            <ChatCircleText className="size-3.5" weight="fill" />
            {t("Paste chat", "চ্যাট পেস্ট")}
          </button>
          <span className="hidden lg:inline"><Kbd>F4</Kbd></span>
        </div>
      }
    >
      <ChannelPicker />
      {matched && matchedStats && matchedRisk ? (
        <div className={cn("rounded-md border p-3", matchedRisk === "risky" ? "border-danger/30 bg-danger-soft/50" : "border-line bg-surface-2")}>
          <div className="flex items-center gap-3">
            <RiskRing level={matchedRisk} delivered={matchedStats.delivered} returned={matchedStats.returned} size={44} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-[15px] font-semibold text-ink">{matched.name}</p>
              </div>
              <p className="tnum text-[13px] text-ink-3">{f.digits(formatPhone(matched.phone))}</p>
              <RiskLabel level={matchedRisk} className="mt-0.5" />
            </div>
            <button type="button" onClick={clearCustomer} className="grid size-8 place-items-center rounded-full text-ink-3 hover:bg-sunken" aria-label={t("Change customer", "কাস্টমার বদলান")}>
              <X className="size-4" />
            </button>
          </div>
          <dl className="mt-3 grid grid-cols-4 gap-2 border-t border-line/70 pt-3 text-center">
            {[
              [t("Orders", "অর্ডার"), f.num(matchedStats.orders)],
              [t("Returned", "ফেরত"), f.pct(matchedStats.returnRate)],
              [t("Spent", "খরচ"), f.compact(matchedStats.spent)],
              [t("Last order", "শেষ অর্ডার"), matchedStats.lastOrder ? f.relative(matchedStats.lastOrder) : "—"],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-[11px] text-ink-4">{k}</dt>
                <dd className="tnum mt-0.5 truncate text-[13px] font-semibold text-ink">{v}</dd>
              </div>
            ))}
          </dl>
          {matchedRisk === "risky" && (
            <p className="mt-3 flex items-start gap-2 rounded-sm bg-surface px-3 py-2 text-[13px] text-danger">
              <WarningOctagon className="mt-0.5 size-4 shrink-0" weight="fill" />
              <span>
                {matched.notes || t("This customer returns many parcels.", "এই কাস্টমার অনেক পার্সেল ফেরত দেন।")} {t("Take the delivery charge in advance before shipping.", "পাঠানোর আগে ডেলিভারি চার্জ অগ্রিম নিন।")}
              </span>
            </p>
          )}
          {matchedStats.due > 0 && (
            <p className="mt-2 text-[13px] text-cash-ink">
              {t("Already owes", "আগের বাকি")} <span className="tnum font-semibold">{f.money(matchedStats.due)}</span>
            </p>
          )}
          {syncMode === "account" && <NetworkRisk phone={matched.phone} className="mt-3" />}
        </div>
      ) : (
        <div className="relative grid gap-2.5">
          <Input
            ref={phoneRef}
            inputMode="tel"
            value={draft.phone}
            onChange={(e) => {
              const known = customers.find((c) => c.phone === normalizePhone(e.target.value));
              if (known) pickCustomer(known);
              else patch({ phone: e.target.value, customerId: undefined });
            }}
            onFocus={() => setFocus(true)}
            onBlur={() => setTimeout(() => setFocus(false), 150)}
            placeholder={t("Phone number — 01XXXXXXXXX", "ফোন নম্বর — ০১XXXXXXXXX")}
            aria-label={t("Customer phone", "কাস্টমারের ফোন")}
            aria-invalid={!phoneValid && draft.phone.replace(/\D/g, "").length >= 11}
            inputSize="lg"
          />
          {phoneValid && !focus && <NetworkRisk phone={draft.phone} />}
          {focus && suggestions.length > 0 && (
            <ul className="absolute inset-x-0 top-[52px] z-20 overflow-hidden rounded-md border border-line bg-surface shadow-3" role="listbox">
              {suggestions.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      pickCustomer(c);
                      setFocus(false);
                    }}
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-sunken"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink">{c.name}</span>
                      <span className="tnum block truncate text-xs text-ink-3">
                        {f.digits(formatPhone(c.phone))} · {c.address.area}, {c.address.district}
                      </span>
                    </span>
                    {c.risky && <Warning className="size-4 text-danger" weight="fill" />}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {!phoneValid && draft.phone.replace(/\D/g, "").length >= 11 && <p className="text-xs text-danger">{t("Use a Bangladeshi mobile number: 01 then 9 digits.", "বাংলাদেশি মোবাইল নম্বর দিন: ০১ এর পরে ৯ সংখ্যা।")}</p>}
          <Input value={draft.name} onChange={(e) => patch({ name: e.target.value })} placeholder={t("Customer name", "কাস্টমারের নাম")} aria-label={t("Customer name", "কাস্টমারের নাম")} />
        </div>
      )}

      {!walkin && (
        <div className="mt-3">
          {showAddress ? (
            <div className="grid gap-2.5">
              <Input value={draft.address.line} onChange={(e) => patch((d) => ({ address: { ...d.address, line: e.target.value } }))} placeholder={t("House, road, flat", "বাসা, রোড, ফ্ল্যাট")} aria-label={t("Address", "ঠিকানা")} />
              <div className="grid grid-cols-2 gap-2.5">
                <Input
                  value={draft.address.area}
                  onChange={(e) => patch((d) => ({ address: { ...d.address, area: e.target.value } }))}
                  placeholder={t("Area / thana", "এলাকা / থানা")}
                  aria-label={t("Area", "এলাকা")}
                  list="pos-areas"
                />
                <Select value={draft.address.district} onChange={(e) => setDistrict(e.target.value)} aria-label={t("District", "জেলা")}>
                  {DISTRICTS.map(([en, bn]) => (
                    <option key={en} value={en}>
                      {t(en, bn)}
                    </option>
                  ))}
                </Select>
              </div>
              <datalist id="pos-areas">
                {(isInsideDhaka(draft.address.district) ? DHAKA_AREAS : []).map((a) => (
                  <option key={a} value={a} />
                ))}
              </datalist>
            </div>
          ) : (
            <button type="button" className="text-[13px] font-medium text-brand-ink" onClick={() => setShowAddress(true)}>
              {t("Add delivery address", "ডেলিভারির ঠিকানা দিন")}
            </button>
          )}
        </div>
      )}

      <QuickPaste
        open={paste}
        onClose={() => setPaste(false)}
        onApply={(p) => {
          const existing = p.phone ? customers.find((c) => c.phone === p.phone) : undefined;
          if (existing) {
            pickCustomer(existing);
            return;
          }
          patch((d) => ({
            customerId: undefined,
            name: p.name ?? d.name,
            phone: p.phone ?? d.phone,
            address: p.address ? { line: p.address.line || d.address.line, area: p.address.area || d.address.area, district: d.address.district } : d.address,
            notesInternal: p.leftover ? [d.notesInternal, p.leftover].filter(Boolean).join("\n") : d.notesInternal,
          }));
          if (p.address?.district) setDistrict(p.address.district);
          setShowAddress(true);
        }}
      />
    </Section>
  );
}

/* ------------------------------------------------------------------ cart */

function CartSection() {
  const t = useT();
  const f = useFmt();
  const can = useCan();
  const { resolved, updateLine, removeLine, totals } = usePos();
  const allowNegative = useStore((s) => s.pos.allowNegativeStock);
  const [editing, setEditing] = useState<string | null>(null);
  return (
    <Section
      title={
        <span className="flex items-center gap-2">
          {t("Items", "পণ্য")}
          {totals.units > 0 && <span className="tnum rounded-full bg-sunken px-2 py-0.5 text-xs font-medium text-ink-3">{f.num(totals.units)}</span>}
        </span>
      }
    >
      {resolved.length === 0 ? (
        <div className="flex flex-col items-center rounded-md border border-dashed border-line-strong px-4 py-7 text-center">
          <ShoppingBagOpen className="size-7 text-ink-4" />
          <p className="mt-2 text-sm font-medium text-ink-2">{t("Tap a product to add it", "পণ্য যোগ করতে ট্যাপ করুন")}</p>
          <p className="mt-0.5 text-xs text-ink-3">
            {t("Or scan a barcode — the search box listens.", "অথবা বারকোড স্ক্যান করুন — সার্চ বক্স প্রস্তুত।")}
          </p>
        </div>
      ) : (
        <ul className="-my-1 divide-y divide-line">
          {resolved.map(({ line, product, variant, avail, over }) => {
            if (!product || !variant) return null;
            const label = Object.values(variant.options).join(" / ");
            const open = editing === line.key;
            return (
              <li key={line.key} className="py-3">
                <div className="flex items-start gap-3">
                  <ProductThumb product={product} size={44} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-medium leading-snug text-ink">{t(product.name, product.nameBn ?? product.name)}</p>
                    <p className="tnum truncate text-xs text-ink-3">
                      {label && `${label} · `}
                      {f.money(line.price)} {t("each", "প্রতিটি")}
                      {line.discount > 0 && <span className="text-ok"> · −{f.money(line.discount)}</span>}
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <Stepper size="sm" value={line.qty} min={1} max={999} onChange={(n) => updateLine(line.key, { qty: n })} />
                      <button
                        type="button"
                        onClick={() => setEditing(open ? null : line.key)}
                        className={cn("grid size-8 place-items-center rounded-sm text-ink-3 transition-colors hover:bg-sunken hover:text-ink", open && "bg-sunken text-ink")}
                        aria-label={t("Edit price or discount", "দাম বা ছাড় বদলান")}
                        aria-expanded={open}
                      >
                        <DotsThree className="size-5" weight="bold" />
                      </button>
                      <button type="button" onClick={() => removeLine(line.key)} className="grid size-8 place-items-center rounded-sm text-ink-4 transition-colors hover:bg-danger-soft hover:text-danger" aria-label={t("Remove", "সরান")}>
                        <Trash className="size-4" />
                      </button>
                    </div>
                  </div>
                  <span className="figure pt-0.5 text-[15px] font-semibold text-ink">{f.money(Math.max(0, line.qty * line.price - line.discount))}</span>
                </div>
                {over && (
                  <p className={cn("ml-14 mt-2 flex items-center gap-1.5 text-xs font-medium", allowNegative ? "text-warn" : "text-danger")}>
                    <Warning className="size-3.5" weight="fill" />
                    {avail <= 0 ? t("Out of stock", "স্টক নেই") : t(`Only ${avail} available`, `মাত্র ${f.num(avail)}টি আছে`)}
                    {allowNegative && t(" — will go below zero", " — স্টক শূন্যের নিচে যাবে")}
                  </p>
                )}
                {open && (
                  <div className="ml-14 mt-3 grid grid-cols-2 gap-2.5">
                    <Field label={t("Unit price", "একক দাম")} hint={!can("edit_price") ? t("Only managers can change prices", "শুধু ম্যানেজার দাম বদলাতে পারেন") : undefined}>
                      <Input
                        inputSize="sm"
                        inputMode="numeric"
                        disabled={!can("edit_price")}
                        value={line.price}
                        onChange={(e) => updateLine(line.key, { price: Math.max(0, Number(e.target.value.replace(/\D/g, "")) || 0) })}
                        leading={<span className="text-xs">৳</span>}
                      />
                    </Field>
                    <Field label={t("Line discount", "ছাড়")}>
                      <Input
                        inputSize="sm"
                        inputMode="numeric"
                        value={line.discount || ""}
                        placeholder="0"
                        onChange={(e) => updateLine(line.key, { discount: Math.min(line.qty * line.price, Math.max(0, Number(e.target.value.replace(/\D/g, "")) || 0)) })}
                        leading={<span className="text-xs">৳</span>}
                      />
                    </Field>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}

/* ------------------------------------------------------------------ charges */

function ChargesSection() {
  const t = useT();
  const f = useFmt();
  const can = useCan();
  const { draft, patch, totals } = usePos();
  const presets = useStore((s) => s.pos.deliveryPresets);
  const walkin = draft.channel === "walkin";
  const me = useMe();
  const pctCap = can("big_discount") ? 100 : maxDiscountPct(me.role);
  return (
    <Section title={t("Discount & delivery", "ছাড় ও ডেলিভারি")}>
      <div className="grid gap-3">
        <div className="flex items-center gap-2">
          <Segmented
            size="sm"
            value={draft.discount.type}
            onChange={(type) => patch((d) => ({ discount: { type, value: type === "pct" ? Math.min(d.discount.value, pctCap) : d.discount.value } }))}
            options={[
              { value: "flat", label: "৳" },
              { value: "pct", label: "%" },
            ]}
            ariaLabel={t("Discount type", "ছাড়ের ধরন")}
          />
          <Input
            inputSize="sm"
            inputMode="numeric"
            className="flex-1"
            value={draft.discount.value || ""}
            placeholder={t("Order discount", "অর্ডারে ছাড়")}
            aria-label={t("Order discount", "অর্ডারে ছাড়")}
            onChange={(e) => {
              const n = Math.max(0, Number(e.target.value.replace(/\D/g, "")) || 0);
              patch((d) => ({ discount: { ...d.discount, value: d.discount.type === "pct" ? Math.min(pctCap, n) : n } }));
            }}
          />
          {totals.discount > 0 && <span className="tnum text-[13px] font-medium text-ok">−{f.money(totals.discount)}</span>}
        </div>
        {draft.discount.type === "pct" && !can("big_discount") && <p className="-mt-1.5 text-xs text-ink-3">{t("Your role can give up to 15% off.", "আপনার রোল সর্বোচ্চ ১৫% ছাড় দিতে পারে।")}</p>}

        {!walkin && (
          <div>
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={t("Delivery charge", "ডেলিভারি চার্জ")}>
              {presets.map((p) => {
                const on = draft.deliveryPresetId === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => patch({ deliveryPresetId: p.id, deliveryCharge: p.amount, deliveryTouched: true })}
                    className={cn(
                      "inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-[13px] transition-colors",
                      on ? "border-brand bg-brand-50 font-medium text-brand-ink" : "border-line bg-surface text-ink-2 hover:border-line-strong",
                    )}
                  >
                    {t(p.label, p.labelBn)}
                    <span className="tnum font-semibold">{f.money(p.amount)}</span>
                  </button>
                );
              })}
              {(["free", "custom"] as const).map((k) => {
                const on = draft.deliveryPresetId === k;
                return (
                  <button
                    key={k}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => patch({ deliveryPresetId: k, deliveryCharge: k === "free" ? 0 : draft.deliveryCharge, deliveryTouched: true })}
                    className={cn(
                      "inline-flex h-9 items-center rounded-full border px-3 text-[13px] transition-colors",
                      on ? "border-brand bg-brand-50 font-medium text-brand-ink" : "border-line bg-surface text-ink-2 hover:border-line-strong",
                    )}
                  >
                    {k === "free" ? t("Free delivery", "ফ্রি ডেলিভারি") : t("Custom", "অন্য")}
                  </button>
                );
              })}
            </div>
            {draft.deliveryPresetId === "custom" && (
              <Input
                inputSize="sm"
                inputMode="numeric"
                className="mt-2 w-40"
                value={draft.deliveryCharge || ""}
                placeholder="0"
                aria-label={t("Delivery charge", "ডেলিভারি চার্জ")}
                leading={<span className="text-xs">৳</span>}
                onChange={(e) => patch({ deliveryCharge: Math.max(0, Number(e.target.value.replace(/\D/g, "")) || 0) })}
              />
            )}
          </div>
        )}
        <div className="flex items-center gap-2">
          <span className="w-28 shrink-0 text-[13px] text-ink-3">{t("Other charges", "অন্যান্য চার্জ")}</span>
          <Input
            inputSize="sm"
            inputMode="numeric"
            className="flex-1"
            value={draft.otherCharges || ""}
            placeholder={t("Packaging, COD fee…", "প্যাকেজিং, COD ফি…")}
            leading={<span className="text-xs">৳</span>}
            aria-label={t("Other charges", "অন্যান্য চার্জ")}
            onChange={(e) => patch({ otherCharges: Math.max(0, Number(e.target.value.replace(/\D/g, "")) || 0) })}
          />
        </div>
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------------ payment */

function PaymentSection({ payRef }: { payRef: React.RefObject<HTMLInputElement | null> }) {
  const t = useT();
  const f = useFmt();
  const { draft, patch, totals } = usePos();
  const walkin = draft.channel === "walkin";
  const addRow = (method: PayMethod, amount: number) => patch((d) => ({ payments: [...d.payments, { key: newKey(), method, amount, txnId: "" }] }));
  return (
    <Section
      title={t("Payment", "পেমেন্ট")}
      aside={<span className="hidden lg:inline"><Kbd>F8</Kbd></span>}
    >
      {draft.payments.length > 0 && (
        <ul className="mb-3 grid gap-2">
          {draft.payments.map((p, i) => (
            <li key={p.key} className="rounded-md border border-line bg-surface-2 p-2.5">
              <div className="flex items-center gap-2">
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 size-2 -translate-y-1/2 rounded-full" style={{ background: PAY_COLOR[p.method] }} />
                  <Select
                    inputSize="sm"
                    value={p.method}
                    onChange={(e) => patch((d) => ({ payments: d.payments.map((x) => (x.key === p.key ? { ...x, method: e.target.value as PayMethod } : x)) }))}
                    aria-label={t("Payment method", "পেমেন্ট মাধ্যম")}
                    className="w-[124px] [&_select]:pl-7"
                  >
                    {PAY_ORDER.map((m) => (
                      <option key={m} value={m}>
                        {t.pick(PAY_LABEL[m])}
                      </option>
                    ))}
                  </Select>
                </div>
                <Input
                  ref={i === 0 ? payRef : undefined}
                  inputSize="sm"
                  inputMode="numeric"
                  className="flex-1"
                  value={p.amount || ""}
                  placeholder="0"
                  leading={<span className="text-xs">৳</span>}
                  aria-label={t("Amount", "পরিমাণ")}
                  onChange={(e) => patch((d) => ({ payments: d.payments.map((x) => (x.key === p.key ? { ...x, amount: Math.max(0, Number(e.target.value.replace(/\D/g, "")) || 0) } : x)) }))}
                />
                <button type="button" onClick={() => patch((d) => ({ payments: d.payments.filter((x) => x.key !== p.key) }))} className="grid size-8 place-items-center rounded-sm text-ink-4 hover:bg-danger-soft hover:text-danger" aria-label={t("Remove payment", "পেমেন্ট সরান")}>
                  <X className="size-4" />
                </button>
              </div>
              {p.method !== "cash" && (
                <Input
                  inputSize="sm"
                  className="mt-2"
                  value={p.txnId}
                  placeholder={t("Transaction ID (optional)", "ট্রানজ্যাকশন আইডি (ঐচ্ছিক)")}
                  aria-label={t("Transaction ID", "ট্রানজ্যাকশন আইডি")}
                  onChange={(e) => patch((d) => ({ payments: d.payments.map((x) => (x.key === p.key ? { ...x, txnId: e.target.value } : x)) }))}
                />
              )}
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap gap-1.5">
        {!walkin && draft.deliveryCharge > 0 && (
          <QuickChip onClick={() => addRow("bkash", draft.deliveryCharge)}>
            <span className="size-2 rounded-full bg-bkash" />
            {t("Advance = delivery", "অগ্রিম = ডেলিভারি")} <span className="tnum font-semibold">{f.money(draft.deliveryCharge)}</span>
          </QuickChip>
        )}
        {totals.remaining > 0 && (
          <QuickChip onClick={() => addRow(walkin ? "cash" : "bkash", totals.remaining)}>
            {t("Paid in full", "পুরো টাকা পরিশোধ")} <span className="tnum font-semibold">{f.money(totals.remaining)}</span>
          </QuickChip>
        )}
        <QuickChip onClick={() => addRow(walkin ? "cash" : "bkash", 0)}>
          <Plus className="size-3.5" weight="bold" />
          {t("Add payment", "পেমেন্ট যোগ")}
        </QuickChip>
      </div>
      {totals.remaining > 0 && totals.total > 0 && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-md bg-cash-soft px-3 py-2.5">
          <span className="text-[13px] text-cash-ink">{t("Collect the rest as", "বাকি টাকা নেবেন")}</span>
          <Segmented
            size="sm"
            value={draft.settlement}
            onChange={(settlement) => patch({ settlement })}
            options={[
              { value: "cod", label: t("Cash on delivery", "ক্যাশ অন ডেলিভারি") },
              { value: "due", label: t("Customer due", "বাকিতে") },
            ]}
            ariaLabel={t("Settlement", "বাকি টাকা")}
            className="bg-white/70"
          />
        </div>
      )}
    </Section>
  );
}

function QuickChip({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-[12.5px] text-ink-2 transition-colors hover:border-brand hover:text-brand-ink">
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ notes */

function NotesSection() {
  const t = useT();
  const { draft, patch } = usePos();
  const [open, setOpen] = useState(false);
  const has = !!(draft.notesInvoice || draft.notesInternal);
  if (!open && !has)
    return (
      <div className="px-5 py-3">
        <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-2 text-[13px] font-medium text-ink-3 hover:text-ink">
          <NotePencil className="size-4" />
          {t("Add a note", "নোট যোগ করুন")}
        </button>
      </div>
    );
  return (
    <Section title={t("Notes", "নোট")}>
      <div className="grid gap-3">
        <Field label={t("Printed on the invoice", "ইনভয়েসে ছাপা হবে")}>
          <Textarea rows={2} value={draft.notesInvoice} onChange={(e) => patch({ notesInvoice: e.target.value })} placeholder={t("e.g. Gift wrap, please", "যেমন: গিফট র‍্যাপ করে দিন")} />
        </Field>
        <Field label={t("For your team only", "শুধু টিমের জন্য")}>
          <Textarea rows={2} value={draft.notesInternal} onChange={(e) => patch({ notesInternal: e.target.value })} placeholder={t("e.g. Call before 6 pm", "যেমন: সন্ধ্যা ৬টার আগে ফোন দিন")} />
        </Field>
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------------ footer */

function Footer({ onSubmit }: { onSubmit: (mode: "draft" | "confirm" | "complete", print?: boolean) => void }) {
  const t = useT();
  const f = useFmt();
  const { draft, totals, stockBlocked, phoneValid, normalized } = usePos();
  const walkin = draft.channel === "walkin";
  const empty = draft.lines.length === 0;
  const needsCustomer = !walkin && (!normalized || !draft.name.trim());
  const reason = empty
    ? null
    : stockBlocked
      ? t("Reduce quantities to what's in stock to confirm.", "নিশ্চিত করতে স্টকের মধ্যে পরিমাণ রাখুন।")
      : !phoneValid
        ? t("Fix the phone number to continue.", "চালিয়ে যেতে ফোন নম্বর ঠিক করুন।")
        : needsCustomer
          ? t("Add the customer's name and phone to confirm.", "নিশ্চিত করতে কাস্টমারের নাম ও ফোন দিন।")
          : null;
  const owed = empty ? 0 : totals.remaining;
  const total = empty ? 0 : totals.total;
  const rows: [string, number, string?][] = [
    [t("Subtotal", "সাবটোটাল"), totals.subtotal],
    ...(totals.discount ? [[t("Discount", "ছাড়"), -totals.discount, "text-ok"] as [string, number, string]] : []),
    ...(!walkin && !empty ? [[t("Delivery", "ডেলিভারি"), draft.deliveryCharge] as [string, number]] : []),
    ...(draft.otherCharges ? [[t("Other", "অন্যান্য"), draft.otherCharges] as [string, number]] : []),
  ];
  return (
    <div className="sticky bottom-0 border-t border-line bg-surface px-5 pb-[max(16px,env(safe-area-inset-bottom))] pt-3.5">
      <dl className="grid gap-1 text-[13px]">
        {rows.map(([k, v, cls]) => (
          <div key={k} className="flex justify-between text-ink-3">
            <dt>{k}</dt>
            <dd className={cn("tnum", cls ?? "text-ink-2")}>{f.money(v)}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-2.5 flex items-start justify-between gap-3 border-t border-dashed border-line-strong pt-3">
        <div className="pt-1">
          <p className="text-[13px] font-medium text-ink-2">{t("Total", "মোট")}</p>
          {totals.paid > 0 && <p className="tnum text-xs text-ok">{t("Paid", "পরিশোধ")} {f.money(totals.paid)}</p>}
        </div>
        <div className="text-right">
          <p className="figure text-[30px] font-semibold leading-none text-ink">{f.money(total)}</p>
          {owed > 0 && (
            <p className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-cash-soft px-2 py-0.5 text-xs font-semibold text-cash-ink">
              <span className="size-1.5 rounded-full bg-cash" />
              {draft.settlement === "cod" ? t("COD", "COD") : t("Due", "বাকি")} <span className="tnum">{f.money(owed)}</span>
            </p>
          )}
        </div>
      </div>
      {reason && <p className="mt-2.5 text-xs font-medium text-danger">{reason}</p>}
      <div className="mt-3 flex gap-2">
        <Button variant="secondary" size="lg" disabled={empty || !phoneValid} onClick={() => onSubmit("draft")} className="px-4">
          {t("Save draft", "খসড়া")}
        </Button>
        <Button
          variant="primary"
          size="lg"
          className="flex-1"
          disabled={empty || !!reason}
          onClick={() => onSubmit(walkin ? "complete" : "confirm")}
          iconRight={<span className="hidden rounded-[5px] bg-white/20 px-1.5 py-0.5 text-[11px] font-semibold leading-none lg:inline">F9</span>}
        >
          {walkin ? t("Complete sale", "বিক্রি সম্পন্ন") : t("Confirm order", "অর্ডার নিশ্চিত")}
        </Button>
      </div>
    </div>
  );
}
