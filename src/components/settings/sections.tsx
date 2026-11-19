"use client";

import { ArrowSquareOut, DownloadSimple, Plus, Trash, ArrowCounterClockwise } from "@phosphor-icons/react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { BrandMark } from "../bits";
import { BillingSettings } from "../billing-admin/billing-settings";
import { TeamSettings } from "../billing-admin/team-settings";
import { PaperShelf } from "../invoice/paper-picker";
import { Badge, Button, Field, Input, Panel, Segmented, Select, Switch, Textarea } from "../ui/core";
import { useConfirm, useToast } from "../ui/overlays";
import { normalizePhone } from "@/lib/domain";
import { useFmt, useT } from "@/lib/hooks";
import { invoicePapersFor, LABEL_PAPERS } from "@/lib/print";
import { useStore, type InvoiceTemplate } from "@/lib/store";
import type { Lang, Numerals } from "@/lib/types";

export function SettingsCard({ title, sub, children, footer }: { title: string; sub?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <Panel className="overflow-hidden">
      <div className="border-b border-line px-5 py-4">
        <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
        {sub && <p className="mt-0.5 text-[13px] text-ink-3">{sub}</p>}
      </div>
      <div className="px-5 py-5">{children}</div>
      {footer && <div className="flex justify-end gap-2 border-t border-line bg-surface-2 px-5 py-3">{footer}</div>}
    </Panel>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-line py-3.5 first:pt-0 last:border-b-0 last:pb-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">{label}</p>
        {hint && <p className="mt-0.5 text-[13px] text-ink-3">{hint}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------ business */

export function BusinessSettings() {
  const t = useT();
  const toast = useToast();
  const business = useStore((s) => s.business);
  const setBusiness = useStore((s) => s.setBusiness);
  const [d, setD] = useState(business);
  const phoneOk = !d.phone || normalizePhone(d.phone);
  const dirty = JSON.stringify(d) !== JSON.stringify(business);
  return (
    <SettingsCard
      title={t("Business profile", "ব্যবসার তথ্য")}
      sub={t("Printed on every invoice and label.", "প্রতিটি ইনভয়েস ও লেবেলে ছাপা হয়।")}
      footer={
        <>
          <Button variant="ghost" disabled={!dirty} onClick={() => setD(business)}>
            {t("Discard", "বাতিল")}
          </Button>
          <Button
            variant="primary"
            disabled={!dirty || !d.name.trim() || !phoneOk}
            onClick={() => {
              setBusiness({ ...d, phone: normalizePhone(d.phone) ?? d.phone });
              toast({ title: t("Business profile saved", "ব্যবসার তথ্য সেভ হয়েছে") });
            }}
          >
            {t("Save changes", "সেভ করুন")}
          </Button>
        </>
      }
    >
      <div className="flex items-center gap-4 pb-5">
        <BrandMark size={56} />
        <div>
          <p className="text-sm font-medium text-ink">{t("Logo and colours", "লোগো ও রং")}</p>
          <Link href="/settings?tab=brand" className="text-[13px] font-medium text-brand-ink hover:underline">
            {t("Change in Brand studio", "ব্র্যান্ড স্টুডিওতে বদলান")}
          </Link>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("Business name", "ব্যবসার নাম")} htmlFor="b-name" error={!d.name.trim() ? t("Your business needs a name", "ব্যবসার নাম দিন") : undefined}>
          <Input id="b-name" value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} />
        </Field>
        <Field label={t("Name in Bangla", "বাংলায় নাম")} htmlFor="b-namebn" optional={t("optional", "ঐচ্ছিক")}>
          <Input id="b-namebn" value={d.nameBn} onChange={(e) => setD({ ...d, nameBn: e.target.value })} lang="bn" />
        </Field>
        <Field label={t("Tagline", "ট্যাগলাইন")} htmlFor="b-tag" className="sm:col-span-2" optional={t("optional", "ঐচ্ছিক")}>
          <Input id="b-tag" value={d.tagline} onChange={(e) => setD({ ...d, tagline: e.target.value })} />
        </Field>
        <Field label={t("Phone", "ফোন")} htmlFor="b-phone" error={!phoneOk ? t("Enter a Bangladeshi mobile number like 017XXXXXXXX", "০১৭XXXXXXXX এর মতো নম্বর দিন") : undefined}>
          <Input id="b-phone" inputMode="tel" value={d.phone} onChange={(e) => setD({ ...d, phone: e.target.value })} aria-invalid={!phoneOk} />
        </Field>
        <Field label={t("Email", "ইমেইল")} htmlFor="b-email" optional={t("optional", "ঐচ্ছিক")}>
          <Input id="b-email" type="email" value={d.email} onChange={(e) => setD({ ...d, email: e.target.value })} />
        </Field>
        <Field label={t("Address", "ঠিকানা")} htmlFor="b-addr" className="sm:col-span-2">
          <Textarea id="b-addr" rows={2} value={d.address} onChange={(e) => setD({ ...d, address: e.target.value })} />
        </Field>
        <Field label={t("Facebook page", "ফেসবুক পেজ")} htmlFor="b-fb" className="sm:col-span-2" optional={t("optional", "ঐচ্ছিক")}>
          <Input id="b-fb" value={d.facebook} onChange={(e) => setD({ ...d, facebook: e.target.value })} />
        </Field>
      </div>
    </SettingsCard>
  );
}

/* ------------------------------------------------------------ invoice */

export function InvoiceSettings() {
  const t = useT();
  const inv = useStore((s) => s.invoice);
  const setInv = useStore((s) => s.setInvoice);
  const lastOrder = useStore((s) => [...s.orders].reverse().find((o) => o.invoiceNo)?.id);
  const printer = useStore((s) => s.printer);
  const setPrinter = useStore((s) => s.setPrinter);
  const papers = invoicePapersFor((inv.vatPercent ?? 0) > 0 || !!inv.bin);
  return (
    <div className="space-y-5">
      <SettingsCard
        title={t("Printing on this device", "এই ডিভাইসের প্রিন্টিং")}
        sub={t("Each computer or phone remembers its own printer, so the counter can print 80 mm receipts while your laptop prints A4.", "প্রতিটি কম্পিউটার বা ফোন নিজের প্রিন্টার মনে রাখে — কাউন্টারে ৮০ মিমি রসিদ, ল্যাপটপে A4।")}
      >
        <p className="mb-3 text-sm font-medium text-ink">{t("Invoices", "ইনভয়েস")}</p>
        <PaperShelf papers={papers} value={printer.invoice ?? inv.template} onChange={(v) => setPrinter({ invoice: v })} ariaLabel={t("Invoice paper on this device", "এই ডিভাইসে ইনভয়েসের কাগজ")} />
        <p className="mb-3 mt-7 text-sm font-medium text-ink">{t("Parcel labels", "পার্সেল লেবেল")}</p>
        <PaperShelf papers={LABEL_PAPERS} value={printer.label} onChange={(v) => setPrinter({ label: v })} ariaLabel={t("Label size on this device", "এই ডিভাইসে লেবেলের মাপ")} />
        <div className="mt-6 border-t border-line pt-4">
          <Row label={t("Shop copy", "দোকানের কপি")} hint={t("Print a second copy marked “Shop copy” for your records.", "রেকর্ডের জন্য “দোকানের কপি” লেখা দ্বিতীয় কপি।")}>
            <Switch checked={printer.copies === 2} onChange={(v) => setPrinter({ copies: v ? 2 : 1 })} label={t("Shop copy", "দোকানের কপি")} />
          </Row>
          <Row label={t("Ask which paper every time", "প্রতিবার কাগজ জিজ্ঞেস করুন")} hint={t("Useful when one computer has both a POS printer and an office printer.", "এক কম্পিউটারে POS ও অফিস দুই প্রিন্টার থাকলে কাজে লাগে।")}>
            <Switch checked={printer.ask} onChange={(v) => setPrinter({ ask: v })} label={t("Ask every time", "প্রতিবার জিজ্ঞেস")} />
          </Row>
          <Row label={t("Shop default", "দোকানের ডিফল্ট")} hint={t("Used by new devices and customer invoice links.", "নতুন ডিভাইস ও কাস্টমারের ইনভয়েস লিংকে।")}>
            <Select inputSize="sm" value={inv.template} onChange={(e) => setInv({ template: e.target.value as InvoiceTemplate })} aria-label={t("Shop default paper", "দোকানের ডিফল্ট কাগজ")}>
              {papers.map((p) => (
                <option key={p.id} value={p.id}>
                  {t(p.en, p.bn)}
                </option>
              ))}
            </Select>
          </Row>
        </div>
        {lastOrder && (
          <Link href={`/invoice/${lastOrder}`} className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-ink hover:underline">
            {t("Preview with your latest order", "সর্বশেষ অর্ডার দিয়ে দেখুন")}
            <ArrowSquareOut className="size-4" />
          </Link>
        )}
      </SettingsCard>

      <SettingsCard title={t("What appears on invoices", "ইনভয়েসে যা থাকবে")}>
        <Row label={t("Invoice language", "ইনভয়েসের ভাষা")} hint={t("Independent of the app language.", "অ্যাপের ভাষা থেকে আলাদা।")}>
          <Segmented<Lang> size="sm" value={inv.lang} onChange={(v) => setInv({ lang: v })} options={[{ value: "en", label: "English" }, { value: "bn", label: "বাংলা" }]} />
        </Row>
        <Row label={t("Numbers", "সংখ্যা")}>
          <Segmented<Numerals> size="sm" value={inv.numerals} onChange={(v) => setInv({ numerals: v })} options={[{ value: "latin", label: "123" }, { value: "bangla", label: "১২৩" }]} />
        </Row>
        <Row label={t("Use brand colour", "ব্র্যান্ড রং ব্যবহার")} hint={t("Accents headings and totals.", "শিরোনাম ও মোট টাকায় রং।")}>
          <Switch checked={inv.useBrandColor} onChange={(v) => setInv({ useBrandColor: v })} label={t("Use brand colour", "ব্র্যান্ড রং")} />
        </Row>
        <Row label={t("Show SKU codes", "SKU কোড দেখান")}>
          <Switch checked={inv.showSku} onChange={(v) => setInv({ showSku: v })} label="SKU" />
        </Row>
        <Row label={t("QR code to track the order", "অর্ডার ট্র্যাকের QR কোড")} hint={t("Customers scan it to see delivery status.", "কাস্টমার স্ক্যান করে ডেলিভারির অবস্থা দেখবেন।")}>
          <Switch checked={inv.showQr} onChange={(v) => setInv({ showQr: v })} label="QR" />
        </Row>
        <Row label={t("Invoice number prefix", "ইনভয়েস নম্বরের শুরু")} hint={`${inv.prefix}-2026-000123`}>
          <Input inputSize="sm" className="w-24" value={inv.prefix} maxLength={6} onChange={(e) => setInv({ prefix: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "") || "INV" })} />
        </Row>
        <p className="mt-4 rounded-md bg-surface-2 px-3 py-2 text-xs text-ink-3">{t("Buying prices never appear on anything a customer sees.", "কেনা দাম কখনো কাস্টমারের কাগজে দেখা যায় না।")}</p>
      </SettingsCard>

      <SettingsCard title={t("Footer text", "নিচের লেখা")}>
        <div className="grid gap-4">
          <Field label={t("Thank-you line", "ধন্যবাদ বার্তা")} htmlFor="i-thanks">
            <Input id="i-thanks" value={inv.thanks} onChange={(e) => setInv({ thanks: e.target.value })} />
          </Field>
          <Field label={t("Exchange & return policy", "বদল ও ফেরত নীতি")} htmlFor="i-footer">
            <Textarea id="i-footer" rows={2} value={inv.footer} onChange={(e) => setInv({ footer: e.target.value })} />
          </Field>
          <Field label={t("Note to customer", "কাস্টমারের জন্য নোট")} htmlFor="i-terms">
            <Textarea id="i-terms" rows={2} value={inv.terms} onChange={(e) => setInv({ terms: e.target.value })} />
          </Field>
        </div>
      </SettingsCard>
    </div>
  );
}

/* ------------------------------------------------------------ selling */

export function SellingSettings() {
  const t = useT();
  const f = useFmt();
  const pos = useStore((s) => s.pos);
  const setPos = useStore((s) => s.setPos);
  const update = (id: string, patch: Partial<(typeof pos.deliveryPresets)[number]>) => setPos({ deliveryPresets: pos.deliveryPresets.map((p) => (p.id === id ? { ...p, ...patch } : p)) });
  return (
    <div className="space-y-5">
      <SettingsCard title={t("Delivery charges", "ডেলিভারি চার্জ")} sub={t("One tap on the order screen. You can still type any amount.", "অর্ডার স্ক্রিনে এক ট্যাপে বসবে। চাইলে যেকোনো পরিমাণ লেখা যায়।")}>
        <ul className="space-y-2">
          {pos.deliveryPresets.map((p) => (
            <li key={p.id} className="grid grid-cols-[1fr_1fr_110px_40px] items-center gap-2 max-sm:grid-cols-[1fr_96px_40px]">
              <Input inputSize="sm" value={p.label} onChange={(e) => update(p.id, { label: e.target.value })} aria-label={t("Name", "নাম")} />
              <Input inputSize="sm" value={p.labelBn} onChange={(e) => update(p.id, { labelBn: e.target.value })} aria-label={t("Name in Bangla", "বাংলা নাম")} className="max-sm:hidden" />
              <Input inputSize="sm" inputMode="numeric" value={p.amount} onChange={(e) => update(p.id, { amount: Number(e.target.value.replace(/\D/g, "")) || 0 })} leading={<span className="text-xs">৳</span>} aria-label={t("Amount", "পরিমাণ")} />
              <button type="button" onClick={() => setPos({ deliveryPresets: pos.deliveryPresets.filter((x) => x.id !== p.id) })} className="grid size-8 place-items-center rounded-sm text-ink-3 hover:bg-danger-soft hover:text-danger" aria-label={t("Remove", "মুছুন")}>
                <Trash className="size-4" />
              </button>
            </li>
          ))}
        </ul>
        <Button
          size="sm"
          className="mt-3"
          icon={<Plus className="size-4" weight="bold" />}
          onClick={() => setPos({ deliveryPresets: [...pos.deliveryPresets, { id: `dp_${Date.now()}`, label: "New zone", labelBn: "নতুন এলাকা", amount: 100 }] })}
        >
          {t("Add a zone", "এলাকা যোগ")}
        </Button>
        <div className="mt-5 flex flex-wrap gap-2" aria-label={t("Preview", "প্রিভিউ")}>
          {pos.deliveryPresets.map((p) => (
            <span key={p.id} className="inline-flex h-9 items-center gap-2 rounded-full border border-line bg-surface px-3.5 text-[13px] text-ink-2">
              {t(p.label, p.labelBn)} <b className="tnum font-semibold text-ink">{f.money(p.amount)}</b>
            </span>
          ))}
        </div>
      </SettingsCard>

      <SettingsCard title={t("Order rules", "অর্ডারের নিয়ম")}>
        <Row label={t("Allow selling without stock", "স্টক ছাড়া বিক্রি")} hint={t("Off: the order screen stops you when only a few are left.", "বন্ধ থাকলে স্টক শেষ হলে অর্ডার আটকে যাবে।")}>
          <Switch checked={pos.allowNegativeStock} onChange={(v) => setPos({ allowNegativeStock: v })} label={t("Allow selling without stock", "স্টক ছাড়া বিক্রি")} />
        </Row>
        <Row label={t("Unpaid amount on online orders", "অনলাইন অর্ডারের বাকি টাকা")} hint={t("Usually collected by the courier.", "সাধারণত কুরিয়ার আদায় করে।")}>
          <Segmented<"cod" | "due">
            size="sm"
            value={pos.defaultSettlement}
            onChange={(v) => setPos({ defaultSettlement: v })}
            options={[
              { value: "cod", label: t("Cash on delivery", "ক্যাশ অন ডেলিভারি") },
              { value: "due", label: t("Customer due", "কাস্টমারের বাকি") },
            ]}
          />
        </Row>
      </SettingsCard>
    </div>
  );
}

/* ------------------------------------------------------------ staff */

/** Team, roles (incl. custom roles) and the device PIN live in billing-admin. */
export function StaffSettings() {
  return <TeamSettings />;
}

/* ------------------------------------------------------------ language */

export function LanguageSettings() {
  const t = useT();
  const f = useFmt();
  const lang = useStore((s) => s.lang);
  const numerals = useStore((s) => s.numerals);
  const setLang = useStore((s) => s.setLang);
  const setNumerals = useStore((s) => s.setNumerals);
  return (
    <SettingsCard title={t("Language & numbers", "ভাষা ও সংখ্যা")} sub={t("Just for you on this device. Each staff member picks their own.", "শুধু আপনার জন্য। প্রত্যেক স্টাফ নিজেরটা বাছতে পারেন।")}>
      <Row label={t("App language", "অ্যাপের ভাষা")}>
        <Segmented<Lang> size="sm" value={lang} onChange={setLang} options={[{ value: "en", label: "English" }, { value: "bn", label: "বাংলা" }]} />
      </Row>
      <Row label={t("Numbers in the app", "অ্যাপে সংখ্যা")} hint={`${t("Looks like", "দেখতে")} ${f.money(124500)} · ${f.date(new Date())}`}>
        <Segmented<Numerals> size="sm" value={numerals} onChange={setNumerals} options={[{ value: "latin", label: "123" }, { value: "bangla", label: "১২৩" }]} />
      </Row>
      <Row label={t("Currency & grouping", "মুদ্রা ও কমা")} hint={t("Taka with lakh–crore grouping, e.g. ৳12,34,567", "টাকা, লাখ–কোটি কমা সহ, যেমন ৳১২,৩৪,৫৬৭")}>
        <Badge>BDT ৳</Badge>
      </Row>
      <Row label={t("Time zone", "সময় অঞ্চল")}>
        <Badge>Asia/Dhaka</Badge>
      </Row>
    </SettingsCard>
  );
}

/* ------------------------------------------------------------ plan */

/** Real subscription billing: usage, checkout, receipts and referrals. */
export function PlanSettings() {
  return <BillingSettings />;
}

/* ------------------------------------------------------------ data */

export function DataSettings() {
  const t = useT();
  const toast = useToast();
  const resetDemo = useStore((s) => s.resetDemo);
  const [confirm, node] = useConfirm();
  const exportAll = () => {
    const s = useStore.getState();
    const data = { exportedAt: new Date().toISOString(), business: s.business, products: s.products, customers: s.customers, orders: s.orders, movements: s.movements, suppliers: s.suppliers, purchases: s.purchases, expenses: s.expenses };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `haatkhata-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast({ title: t("Backup downloaded", "ব্যাকআপ ডাউনলোড হয়েছে") });
  };
  return (
    <div className="space-y-5">
      <SettingsCard title={t("Your data", "আপনার তথ্য")} sub={t("It's yours. Take a full copy any time.", "তথ্য আপনার। যেকোনো সময় পুরো কপি নিন।")}>
        <Row label={t("Download everything", "সব ডাউনলোড করুন")} hint={t("Products, stock ledger, orders, customers, expenses.", "পণ্য, স্টক খাতা, অর্ডার, কাস্টমার, খরচ।")}>
          <Button size="sm" icon={<DownloadSimple className="size-4" />} onClick={exportAll}>
            {t("Download", "ডাউনলোড")}
          </Button>
        </Row>
      </SettingsCard>
      <SettingsCard title={t("Demo data", "ডেমো তথ্য")} sub={t("This prototype stores everything on this device.", "এই প্রোটোটাইপ সব তথ্য এই ডিভাইসেই রাখে।")}>
        <Row label={t("Start over with fresh sample data", "নতুন নমুনা তথ্য দিয়ে শুরু")} hint={t("Replaces every order, product and setting on this device.", "এই ডিভাইসের সব অর্ডার, পণ্য ও সেটিং বদলে যাবে।")}>
          <Button
            size="sm"
            variant="danger"
            icon={<ArrowCounterClockwise className="size-4" />}
            onClick={async () => {
              if (await confirm({ title: t("Reset all demo data?", "সব ডেমো তথ্য রিসেট করবেন?"), body: t("Your theme, logo and every change you've made will be replaced.", "আপনার থিম, লোগো ও সব পরিবর্তন মুছে যাবে।"), confirm: t("Reset", "রিসেট"), danger: true })) {
                resetDemo();
                toast({ title: t("Fresh demo data loaded", "নতুন ডেমো তথ্য লোড হয়েছে") });
              }
            }}
          >
            {t("Reset", "রিসেট")}
          </Button>
        </Row>
      </SettingsCard>
      {node}
    </div>
  );
}
