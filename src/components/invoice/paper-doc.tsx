"use client";

import type { ReactNode } from "react";
import { BrandMark } from "../bits";
import { useQr } from "./documents";
import { makeFormatters } from "@/lib/format";
import { useStore } from "@/lib/store";
import type { Lang } from "@/lib/types";

export type DocRow = { name: string; sub?: string; qty: number; price: number; amount: number };

/** Shared A4/A5 document: purchase orders, quotations, payment receipts. */
export function PaperDoc({
  size = "a4",
  lang,
  kind,
  number,
  date,
  meta,
  partyTitle,
  party,
  rows,
  totals,
  highlight,
  notes,
  qr,
  footer,
}: {
  size?: "a4" | "a5";
  lang: Lang;
  kind: string;
  number: string;
  date: string;
  meta?: [string, string][];
  partyTitle: string;
  party: ReactNode;
  rows?: DocRow[];
  totals?: [string, string, boolean?][];
  highlight?: { label: string; value: string };
  notes?: ReactNode;
  qr?: string;
  footer?: ReactNode;
}) {
  const business = useStore((s) => s.business);
  const invoice = useStore((s) => s.invoice);
  const f = makeFormatters({ lang, numerals: invoice.numerals });
  const accent = invoice.useBrandColor ? "var(--brand-ink)" : "#16181A";
  const qrSrc = useQr(qr ?? "");
  const bn = lang === "bn";
  const L = (en: string, b: string) => (bn ? b : en);
  return (
    <article
      className="mx-auto flex flex-col bg-white text-[#1d1f21] shadow-2 print:shadow-none"
      style={{ width: size === "a4" ? "210mm" : "148mm", minHeight: size === "a4" ? "297mm" : "210mm", padding: size === "a4" ? "16mm 16mm 14mm" : "11mm 11mm 10mm", fontSize: size === "a4" ? "10pt" : "8.6pt" }}
    >
      <header className="flex items-start justify-between gap-6">
        <div className="flex items-center gap-3">
          <BrandMark size={size === "a4" ? 46 : 38} />
          <div>
            <p className="font-display font-semibold leading-tight" style={{ fontSize: size === "a4" ? "15pt" : "12pt" }}>
              {bn ? business.nameBn || business.name : business.name}
            </p>
            {business.tagline && <p className="text-[#666]">{business.tagline}</p>}
          </div>
        </div>
        <div className="text-right">
          <p className="font-display font-semibold" style={{ color: accent, fontSize: size === "a4" ? "16pt" : "13pt" }}>
            {kind}
          </p>
          <p className="tnum font-semibold">{number}</p>
          <p className="tnum text-[#666]">{f.date(date)}</p>
        </div>
      </header>
      <div className="mt-5 h-[2px] rounded" style={{ background: accent }} />

      <section className="mt-5 grid grid-cols-2 gap-6">
        <div>
          <p className="text-[#888]">{partyTitle}</p>
          <div className="mt-1">{party}</div>
        </div>
        {meta && meta.length > 0 && (
          <dl className="space-y-1 justify-self-end">
            {meta.map(([k, v]) => (
              <div key={k} className="flex justify-end gap-6">
                <dt className="text-[#888]">{k}</dt>
                <dd className="tnum min-w-[90px] text-right font-medium">{v}</dd>
              </div>
            ))}
          </dl>
        )}
      </section>

      {rows && rows.length > 0 && (
        <table className="mt-6 w-full">
          <thead>
            <tr className="border-b-2 border-[#222] text-left text-[#888]">
              <th className="w-6 py-1.5 font-normal">#</th>
              <th className="py-1.5 font-normal">{L("Item", "পণ্য")}</th>
              <th className="py-1.5 text-right font-normal">{L("Qty", "পরিমাণ")}</th>
              <th className="py-1.5 text-right font-normal">{L("Price", "দাম")}</th>
              <th className="py-1.5 text-right font-normal">{L("Amount", "মোট")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-[#e5e5e5] align-top">
                <td className="tnum py-2 text-[#999]">{f.num(i + 1)}</td>
                <td className="py-2">
                  <p className="font-medium">{r.name}</p>
                  {r.sub && <p className="text-[#777]">{r.sub}</p>}
                </td>
                <td className="tnum py-2 text-right">{f.num(r.qty)}</td>
                <td className="tnum py-2 text-right">{f.money(r.price)}</td>
                <td className="tnum py-2 text-right font-medium">{f.money(r.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <section className="mt-5 flex items-start justify-between gap-6">
        <div className="max-w-[55%] text-[#555]">
          {qr && qrSrc && (
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrSrc} alt="" width={64} height={64} />
              <p className="text-[#777]">{L("Scan to view this document online", "স্ক্যান করে অনলাইনে দেখুন")}</p>
            </div>
          )}
        </div>
        {totals && (
          <dl className="min-w-[200px] space-y-1.5">
            {totals.map(([k, v, strong]) => (
              <div key={k} className={strong ? "flex justify-between border-t border-[#222] pt-2 font-semibold" : "flex justify-between"} style={strong ? { fontSize: "1.15em" } : undefined}>
                <dt>{k}</dt>
                <dd className="tnum">{v}</dd>
              </div>
            ))}
          </dl>
        )}
      </section>

      {highlight && (
        <div className="mt-5 flex items-center justify-between rounded-md px-4 py-3" style={{ background: "color-mix(in oklab, var(--brand) 10%, white)" }}>
          <span className="font-medium">{highlight.label}</span>
          <span className="figure font-semibold" style={{ color: accent, fontSize: "1.5em" }}>
            {highlight.value}
          </span>
        </div>
      )}

      {notes && <div className="mt-5 text-[#555]">{notes}</div>}

      <footer className="mt-auto border-t border-[#e5e5e5] pt-4 text-[#777]">
        {footer}
        <p className="mt-1">
          {[business.phone, business.facebook, business.address].filter(Boolean).join(" · ")}
        </p>
      </footer>
    </article>
  );
}
