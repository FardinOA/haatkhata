"use client";

import Link from "next/link";
import { Badge, Field, Input, Panel, Segmented } from "../ui/core";
import { useFmt, useT } from "@/lib/hooks";
import { useStore } from "@/lib/store";
import { vatIn } from "@/lib/vat";

const RATES = ["0", "5", "7.5", "10", "15"] as const;

/** VAT registration for invoices (FR-INV-12). Drop into Settings → Invoices. */
export function VatSettingsCard() {
  const t = useT();
  const f = useFmt();
  const inv = useStore((s) => s.invoice);
  const setInvoice = useStore((s) => s.setInvoice);
  const lastOrder = useStore((s) => [...s.orders].reverse().find((o) => o.invoiceNo)?.id);
  const rate = inv.vatPercent ?? 0;
  const binOk = !inv.bin || /^\d{9}(-\d{4})?$|^\d{13}$/.test(inv.bin);
  return (
    <Panel className="overflow-hidden">
      <div className="border-b border-line px-5 py-4">
        <h3 className="flex items-center gap-2 text-[15px] font-semibold text-ink">
          {t("VAT", "ভ্যাট")}
          {rate > 0 && <Badge tone="brand">{t("Registered", "নিবন্ধিত")}</Badge>}
        </h3>
        <p className="mt-0.5 text-[13px] text-ink-3">{t("Only if you're VAT-registered. Your prices stay the same — invoices show the VAT inside them.", "শুধু ভ্যাট নিবন্ধিত হলে। দাম একই থাকবে — ইনভয়েসে ভেতরের ভ্যাট দেখাবে।")}</p>
      </div>
      <div className="grid gap-4 px-5 py-5 sm:grid-cols-2">
        <Field label={t("VAT rate", "ভ্যাটের হার")}>
          <Segmented<(typeof RATES)[number]>
            size="sm"
            value={(RATES.find((r) => Number(r) === rate) ?? "0") as (typeof RATES)[number]}
            onChange={(v) => setInvoice({ vatPercent: Number(v) })}
            options={RATES.map((r) => ({ value: r, label: r === "0" ? t("None", "নেই") : `${r}%` }))}
          />
        </Field>
        <Field label={t("BIN (business identification number)", "বিআইএন")} htmlFor="vat-bin" error={!binOk ? t("A BIN has 9 or 13 digits", "বিআইএন ৯ বা ১৩ সংখ্যার") : undefined}>
          <Input id="vat-bin" inputMode="numeric" className="tnum" placeholder="000123456-0101" value={inv.bin ?? ""} onChange={(e) => setInvoice({ bin: e.target.value.replace(/[^\d-]/g, "") || undefined })} aria-invalid={!binOk} />
        </Field>
        {rate > 0 && (
          <p className="rounded-md bg-surface-2 px-3 py-2.5 text-[13px] text-ink-2 sm:col-span-2">
            {t(`A ${f.money(1150)} sale includes ${f.money(vatIn(1150, rate), { decimals: true })} VAT.`, `${f.money(1150)} বিক্রিতে ভ্যাট ${f.money(vatIn(1150, rate), { decimals: true })}।`)}{" "}
            {lastOrder && (
              <Link href={`/invoice/${lastOrder}?template=mushak`} className="font-medium text-brand-ink hover:underline">
                {t("Preview a Mushak-6.3 invoice", "মূসক-৬.৩ ইনভয়েস দেখুন")}
              </Link>
            )}
          </p>
        )}
      </div>
    </Panel>
  );
}
