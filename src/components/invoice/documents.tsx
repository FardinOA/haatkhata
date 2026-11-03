"use client";

import QRCode from "qrcode";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/components/ui/core";
import { formatPhone, orderTotals } from "@/lib/domain";
import { makeFormatters } from "@/lib/format";
import { districtBn } from "@/lib/geo";
import { PAY_LABEL, pick } from "@/lib/labels";
import { useStore, type InvoiceTemplate } from "@/lib/store";
import { vatIn } from "@/lib/vat";
import type { LabelPaper } from "@/lib/print";
import type { Lang, Numerals, Order } from "@/lib/types";
import { Barcode } from "../products/barcode";

/* ------------------------------------------------------------------ shared */

export type DocOptions = { lang: Lang; numerals: Numerals; template: InvoiceTemplate };

/** Paper sizes in CSS units — screen preview and @page agree. */
export const PAPER: Record<InvoiceTemplate | LabelPaper, { w: string; h?: string; px: number }> = {
  a4: { w: "210mm", h: "297mm", px: 794 },
  a5: { w: "148mm", h: "210mm", px: 559 },
  a4duo: { w: "297mm", h: "210mm", px: 1123 },
  letter: { w: "215.9mm", h: "279.4mm", px: 816 },
  mushak: { w: "210mm", h: "297mm", px: 794 },
  thermal80: { w: "80mm", px: 302 },
  thermal58: { w: "58mm", px: 219 },
  l100x75: { w: "100mm", h: "75mm", px: 378 },
  l100x150: { w: "100mm", h: "150mm", px: 378 },
  l75x50: { w: "75mm", h: "50mm", px: 283 },
  a4sheet: { w: "210mm", h: "297mm", px: 794 },
};

/** Small tag that tells the customer's copy from the one the shop keeps. */
function CopyTag({ text, className }: { text?: string; className?: string }) {
  if (!text) return null;
  return <span className={cn("rounded-full border border-[#C9CDC4] px-2 py-px text-[9.5px] font-medium text-[#686E74]", className)}>{text}</span>;
}

function useDoc(o: DocOptions) {
  return useMemo(() => {
    const f = makeFormatters({ lang: o.lang, numerals: o.numerals });
    const tt = (en: string, bn: string) => (o.lang === "bn" ? bn : en);
    return { f, tt };
  }, [o.lang, o.numerals]);
}

export function useQr(text: string, dark = "#16181A") {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    QRCode.toDataURL(text, { margin: 0, width: 240, errorCorrectionLevel: "M", color: { dark, light: "#0000" } })
      .then((d) => live && setSrc(d))
      .catch(() => live && setSrc(null));
    return () => {
      live = false;
    };
  }, [text, dark]);
  return src;
}

function Logo({ size, mono }: { size: number; mono?: boolean }) {
  const logo = useStore((s) => s.business.logo);
  const name = useStore((s) => s.business.name);
  const shape = useStore((s) => s.business.logoShape);
  const radius = shape === "circle" ? "9999px" : shape === "square" ? `${size * 0.14}px` : `${size * 0.26}px`;
  if (logo)
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={logo} alt="" style={{ width: size, height: size, borderRadius: radius, objectFit: "contain", filter: mono ? "grayscale(1) contrast(1.2)" : undefined }} />;
  const letters = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  return (
    <span
      className="grid shrink-0 place-items-center font-display font-semibold"
      style={{ width: size, height: size, borderRadius: radius, fontSize: size * 0.4, background: mono ? "#16181A" : "var(--doc-accent)", color: mono ? "#fff" : "var(--doc-accent-contrast)" }}
    >
      {letters}
    </span>
  );
}

function useLineNames(order: Order, lang: Lang) {
  const products = useStore((s) => s.products);
  return (productId: string, fallback: string) => {
    if (lang !== "bn") return fallback;
    return products.find((p) => p.id === productId)?.nameBn ?? fallback;
  };
}

function addressText(order: Order, lang: Lang) {
  const a = order.customer?.address;
  if (!a) return "";
  return [a.line, a.area, lang === "bn" ? districtBn(a.district) : a.district].filter(Boolean).join(", ");
}

function VoidStamp({ tt }: { tt: (en: string, bn: string) => string }) {
  return (
    <div className="pointer-events-none absolute inset-0 grid place-items-center overflow-hidden" aria-label="Void">
      <span className="rotate-[-18deg] rounded-md border-[5px] border-[#C8342F]/70 px-8 py-2 font-display text-[64px] font-bold tracking-[0.12em] text-[#C8342F]/70">
        {tt("VOID", "বাতিল")}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ memo (A4 / A5) */

/** A4, A5 and Letter. `bare` drops the page wrapper so two can share an A4 sheet. */
export function MemoInvoice({ order, opts, url, copy, bare }: { order: Order; opts: DocOptions; url: string; copy?: string; bare?: boolean }) {
  const { f, tt } = useDoc(opts);
  const biz = useStore((s) => s.business);
  const inv = useStore((s) => s.invoice);
  const nameOf = useLineNames(order, opts.lang);
  const tot = orderTotals(order);
  const qr = useQr(url);
  const a5 = opts.template === "a5" || opts.template === "a4duo";
  const size = a5 ? PAPER.a5 : PAPER[opts.template];
  const cancelled = order.status === "cancelled";
  const owed = tot.remaining;
  const bizName = opts.lang === "bn" ? biz.nameBn || biz.name : biz.name;

  return (
    <article
      className={cn(!bare && "doc-page", "relative flex flex-col bg-white text-[#16181A]", a5 ? "px-[11mm] pb-[9mm] pt-[10mm] text-[11px]" : "px-[16mm] pb-[14mm] pt-[15mm] text-[12.5px]")}
      style={{ width: size.w, minHeight: size.h, height: bare ? size.h : undefined }}
      lang={opts.lang}
    >
      <CopyTag text={copy} className="absolute left-1/2 top-[4mm] -translate-x-1/2" />
      {/* Header */}
      <header className="flex items-start justify-between gap-6">
        <div className="flex items-center gap-3">
          <Logo size={a5 ? 40 : 52} />
          <div>
            <p className={cn("font-display font-semibold leading-tight tracking-[-0.01em]", a5 ? "text-[17px]" : "text-[22px]")}>{bizName}</p>
            {biz.tagline && <p className="text-[#686E74]">{biz.tagline}</p>}
          </div>
        </div>
        <div className="text-right">
          <p className={cn("font-display font-semibold tracking-[-0.01em]", a5 ? "text-[18px]" : "text-[24px]")} style={{ color: "var(--doc-accent-ink)" }}>
            {tt("Invoice", "ইনভয়েস")}
          </p>
          <p className="tnum mt-1 font-semibold">{f.digits(order.invoiceNo ?? `#${order.no}`)}</p>
          <p className="tnum text-[#686E74]">{f.date(order.createdAt)}</p>
        </div>
      </header>

      <div className="mt-4 h-[3px] rounded-full" style={{ background: "var(--doc-accent)" }} />

      {/* Parties */}
      <section className={cn("grid grid-cols-[1.3fr_1fr] gap-6", a5 ? "mt-4" : "mt-6")}>
        <div>
          <p className="text-[#686E74]">{tt("Deliver to", "ডেলিভারি ঠিকানা")}</p>
          {order.customer ? (
            <>
              <p className={cn("mt-1 font-semibold", a5 ? "text-[13px]" : "text-[15px]")}>{order.customer.name}</p>
              <p className="tnum">{f.digits(formatPhone(order.customer.phone))}</p>
              {order.customer.address && <p className="mt-0.5 max-w-[60ch] leading-snug text-[#464B50]">{addressText(order, opts.lang)}</p>}
            </>
          ) : (
            <p className="mt-1 font-semibold">{tt("Walk-in customer", "দোকানের কাস্টমার")}</p>
          )}
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 self-start">
          <dt className="text-[#686E74]">{tt("Order", "অর্ডার")}</dt>
          <dd className="tnum text-right font-medium">#{f.digits(String(order.no))}</dd>
          {order.courier?.name && (
            <>
              <dt className="text-[#686E74]">{tt("Courier", "কুরিয়ার")}</dt>
              <dd className="text-right font-medium">{order.courier.name}</dd>
            </>
          )}
          {order.courier?.tracking && (
            <>
              <dt className="text-[#686E74]">{tt("Tracking", "ট্র্যাকিং")}</dt>
              <dd className="tnum text-right font-medium">{order.courier.tracking}</dd>
            </>
          )}
          <dt className="text-[#686E74]">{tt("Payment", "পেমেন্ট")}</dt>
          <dd className="text-right font-medium">
            {owed <= 0 ? tt("Paid", "পরিশোধিত") : order.settlement === "cod" ? tt("Cash on delivery", "ক্যাশ অন ডেলিভারি") : tt("Due", "বাকি")}
          </dd>
        </dl>
      </section>

      {/* Items */}
      <table className={cn("w-full border-collapse", a5 ? "mt-5" : "mt-8")}>
        <thead>
          <tr className="text-left text-[#686E74]">
            <th className="w-6 pb-2 font-normal">#</th>
            <th className="pb-2 font-normal">{tt("Item", "পণ্য")}</th>
            <th className="w-12 pb-2 text-right font-normal">{tt("Qty", "পরিমাণ")}</th>
            <th className="w-20 pb-2 text-right font-normal">{tt("Price", "দাম")}</th>
            <th className="w-24 pb-2 text-right font-normal">{tt("Amount", "মোট")}</th>
          </tr>
        </thead>
        <tbody className="border-y-[1.5px] border-[#16181A]">
          {order.lines.map((l, i) => (
            <tr key={l.id} className="border-b border-[#E2E4DE] last:border-0 align-top">
              <td className="tnum py-2.5 text-[#9AA0A5]">{f.num(i + 1)}</td>
              <td className="py-2.5 pr-3">
                <p className="font-medium">{nameOf(l.productId, l.name)}</p>
                <p className="text-[#686E74]">
                  {[l.variantLabel, inv.showSku ? l.sku : ""].filter(Boolean).join(" · ")}
                  {l.discount > 0 && <span> · {tt("less", "ছাড়")} {f.money(l.discount)}</span>}
                </p>
              </td>
              <td className="tnum py-2.5 text-right">{f.num(l.qty)}</td>
              <td className="tnum py-2.5 text-right">{f.money(l.price)}</td>
              <td className="tnum py-2.5 text-right font-medium">{f.money(Math.max(0, l.qty * l.price - l.discount))}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals + QR */}
      <section className={cn("grid grid-cols-[1fr_auto] items-start gap-8", a5 ? "mt-4" : "mt-6")}>
        <div className="flex items-start gap-4">
          {inv.showQr && qr && (
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qr} alt="" className={a5 ? "size-16" : "size-20"} />
              <p className="max-w-[18ch] leading-snug text-[#686E74]">{tt("Scan to see this invoice and your order status", "স্ক্যান করে ইনভয়েস ও অর্ডারের অবস্থা দেখুন")}</p>
            </div>
          )}
        </div>
        <dl className={cn("grid grid-cols-[1fr_auto] gap-x-8 gap-y-1", a5 ? "min-w-[52mm]" : "min-w-[70mm]")}>
          <dt className="text-[#686E74]">{tt("Subtotal", "সাবটোটাল")}</dt>
          <dd className="tnum text-right">{f.money(tot.subtotal)}</dd>
          {tot.discount > 0 && (
            <>
              <dt className="text-[#686E74]">{tt("Discount", "ছাড়")}</dt>
              <dd className="tnum text-right">−{f.money(tot.discount)}</dd>
            </>
          )}
          {order.deliveryCharge > 0 && (
            <>
              <dt className="text-[#686E74]">{tt("Delivery", "ডেলিভারি চার্জ")}</dt>
              <dd className="tnum text-right">{f.money(order.deliveryCharge)}</dd>
            </>
          )}
          {order.otherCharges > 0 && (
            <>
              <dt className="text-[#686E74]">{tt("Other charges", "অন্যান্য চার্জ")}</dt>
              <dd className="tnum text-right">{f.money(order.otherCharges)}</dd>
            </>
          )}
          <div className="col-span-2 mb-0.5 mt-1.5 border-t border-[#16181A]" />
          <dt className="self-center font-semibold">{tt("Total", "সর্বমোট")}</dt>
          <dd className={cn("figure text-right font-semibold", a5 ? "text-[17px]" : "text-[20px]")}>{f.money(tot.total)}</dd>
          {(inv.vatPercent ?? 0) > 0 && (
            <>
              <dt className="text-[#686E74]">{tt(`Includes VAT ${inv.vatPercent}%`, `ভ্যাট ${inv.vatPercent}% সহ`)}</dt>
              <dd className="tnum text-right text-[#686E74]">{f.money(vatIn(tot.total, inv.vatPercent ?? 0), { decimals: true })}</dd>
            </>
          )}
          {order.payments.map((p) => (
            <div key={p.id} className="contents">
              <dt className="text-[#686E74]">
                {p.amount < 0 ? tt("Refund", "ফেরত") : tt("Paid", "পরিশোধ")} · {pick(PAY_LABEL[p.method], opts.lang)}
              </dt>
              <dd className="tnum text-right">{f.money(p.amount)}</dd>
            </div>
          ))}
        </dl>
      </section>

      {owed > 0 && !cancelled && (
        <div className="mt-4 flex items-center justify-between rounded-[6px] px-4 py-3" style={{ background: "#FDF1D9", color: "#5C3A00" }}>
          <span className="font-medium">
            {order.settlement === "cod" ? tt("Please pay the rider on delivery", "ডেলিভারির সময় রাইডারকে পরিশোধ করুন") : tt("Amount due", "বাকি টাকা")}
          </span>
          <span className={cn("figure font-semibold", a5 ? "text-[18px]" : "text-[22px]")}>{f.money(owed)}</span>
        </div>
      )}

      {/* Notes & footer */}
      <div className="mt-auto pt-6">
        {order.notesInvoice && (
          <p className="mb-3 rounded-[6px] bg-[#F3F4F0] px-3 py-2">
            <span className="text-[#686E74]">{tt("Note", "নোট")}: </span>
            {order.notesInvoice}
          </p>
        )}
        {(inv.terms || inv.footer) && <p className="leading-snug text-[#686E74]">{[inv.terms, inv.footer].filter(Boolean).join(" ")}</p>}
        <div className="mt-4 flex items-end justify-between gap-6 border-t border-[#E2E4DE] pt-3">
          <p className={cn("font-display font-semibold", a5 ? "text-[14px]" : "text-[17px]")} style={{ color: "var(--doc-accent-ink)" }}>
            {inv.thanks || tt("Thank you!", "ধন্যবাদ!")}
          </p>
          <p className="tnum text-right text-[#686E74]">
            {[f.digits(formatPhone(biz.phone)), biz.facebook].filter(Boolean).join("  ·  ")}
            <br />
            {biz.address}
          </p>
        </div>
      </div>
      {cancelled && <VoidStamp tt={tt} />}
    </article>
  );
}

/* ------------------------------------------------------------------ thermal */

export function ThermalReceipt({ order, opts, url, copy }: { order: Order; opts: DocOptions; url: string; copy?: string }) {
  const { f, tt } = useDoc(opts);
  const biz = useStore((s) => s.business);
  const inv = useStore((s) => s.invoice);
  const nameOf = useLineNames(order, opts.lang);
  const tot = orderTotals(order);
  const qr = useQr(url);
  const narrow = opts.template === "thermal58";
  const owed = tot.remaining;
  const cancelled = order.status === "cancelled";
  const bizName = opts.lang === "bn" ? biz.nameBn || biz.name : biz.name;
  const rule = <div className="my-2 border-t border-dashed border-[#16181A]/50" />;
  const row = (k: React.ReactNode, v: React.ReactNode, strong = false) => (
    <div className={cn("flex justify-between gap-2", strong && "font-semibold")}>
      <span>{k}</span>
      <span className="tnum text-right">{v}</span>
    </div>
  );
  return (
    <article
      className={cn("doc-page relative bg-white text-[#16181A]", narrow ? "px-[3mm] pb-[6mm] pt-[4mm] text-[10.5px]" : "px-[4mm] pb-[7mm] pt-[5mm] text-[11.5px]")}
      style={{ width: PAPER[opts.template].w }}
      lang={opts.lang}
    >
      {copy && <p className="mb-2 border-y border-dashed border-[#16181A]/50 py-0.5 text-center font-medium">{copy}</p>}
      <div className="flex flex-col items-center text-center">
        <Logo size={narrow ? 30 : 38} mono />
        <p className={cn("mt-1.5 font-display font-semibold leading-tight", narrow ? "text-[13px]" : "text-[15px]")}>{bizName}</p>
        <p className="leading-snug">{biz.address}</p>
        <p className="tnum">{f.digits(formatPhone(biz.phone))}</p>
      </div>
      {rule}
      {row(tt("Invoice", "ইনভয়েস"), f.digits(order.invoiceNo ?? `#${order.no}`))}
      {row(tt("Date", "তারিখ"), `${f.date(order.createdAt)} ${f.time(order.createdAt)}`)}
      {order.customer && row(tt("Customer", "কাস্টমার"), order.customer.name)}
      {order.customer && row(tt("Phone", "ফোন"), f.digits(order.customer.phone))}
      {rule}
      {order.lines.map((l) => (
        <div key={l.id} className="mb-1.5">
          <p className="font-medium leading-snug">{nameOf(l.productId, l.name)}</p>
          {(l.variantLabel || inv.showSku) && <p className="leading-snug opacity-75">{[l.variantLabel, inv.showSku ? l.sku : ""].filter(Boolean).join(" · ")}</p>}
          {row(`${f.num(l.qty)} × ${f.money(l.price)}`, f.money(Math.max(0, l.qty * l.price - l.discount)))}
        </div>
      ))}
      {rule}
      {row(tt("Subtotal", "সাবটোটাল"), f.money(tot.subtotal))}
      {tot.discount > 0 && row(tt("Discount", "ছাড়"), `−${f.money(tot.discount)}`)}
      {order.deliveryCharge > 0 && row(tt("Delivery", "ডেলিভারি"), f.money(order.deliveryCharge))}
      {order.otherCharges > 0 && row(tt("Other", "অন্যান্য"), f.money(order.otherCharges))}
      <div className="my-1.5 border-t border-[#16181A]" />
      <div className={cn("flex items-baseline justify-between font-semibold", narrow ? "text-[14px]" : "text-[16px]")}>
        <span>{tt("Total", "সর্বমোট")}</span>
        <span className="figure">{f.money(tot.total)}</span>
      </div>
      {(inv.vatPercent ?? 0) > 0 && row(tt(`Incl. VAT ${inv.vatPercent}%`, `ভ্যাট ${inv.vatPercent}% সহ`), f.money(vatIn(tot.total, inv.vatPercent ?? 0), { decimals: true }))}
      {inv.bin && <p className="text-center opacity-75">BIN {inv.bin}</p>}
      {order.payments.map((p) => (
        <div key={p.id}>{row(`${tt("Paid", "পরিশোধ")} · ${pick(PAY_LABEL[p.method], opts.lang)}`, f.money(p.amount))}</div>
      ))}
      {owed > 0 && !cancelled && (
        <div className="mt-2 border-[1.5px] border-[#16181A] px-2 py-1.5 text-center">
          <p>{order.settlement === "cod" ? tt("Collect on delivery", "ডেলিভারিতে নিতে হবে") : tt("Amount due", "বাকি")}</p>
          <p className={cn("figure font-bold", narrow ? "text-[18px]" : "text-[22px]")}>{f.money(owed)}</p>
        </div>
      )}
      {rule}
      {order.notesInvoice && <p className="mb-2 text-center">{order.notesInvoice}</p>}
      <div className="flex flex-col items-center text-center">
        {inv.showQr && qr && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qr} alt="" className={narrow ? "size-16" : "size-20"} />
        )}
        <p className={cn("mt-2 font-display font-semibold", narrow ? "text-[12px]" : "text-[13px]")}>{inv.thanks || tt("Thank you!", "ধন্যবাদ!")}</p>
        {inv.footer && <p className="mt-1 leading-snug opacity-80">{inv.footer}</p>}
      </div>
      {cancelled && <VoidStamp tt={tt} />}
    </article>
  );
}

/* ------------------------------------------------------------------ labels */

type LabelSize = Exclude<LabelPaper, "a4sheet"> | "cell";

/** One cell of the A4 sheet: 2 × 4 labels, 105 × 74.25 mm each. */
const CELL = { w: "105mm", h: "74.25mm" };

/** Parcel sticker (FR-INV-08) in every common size. The COD amount is the hero on all of them. */
export function ParcelLabel({ order, opts, url, size = "l100x75" }: { order: Order; opts: DocOptions; url: string; size?: LabelSize }) {
  if (size === "l100x150") return <TallLabel order={order} opts={opts} url={url} />;
  if (size === "l75x50") return <SmallLabel order={order} opts={opts} />;
  return <StandardLabel order={order} opts={opts} url={url} cell={size === "cell"} />;
}

function useLabel(order: Order, opts: DocOptions) {
  const { f, tt } = useDoc(opts);
  const biz = useStore((s) => s.business);
  const tot = orderTotals(order);
  const owed = order.settlement === "cod" ? tot.remaining : 0;
  const bizName = opts.lang === "bn" ? biz.nameBn || biz.name : biz.name;
  const cod = (big: string) => (
    <>
      <span className="text-[10px] font-semibold">{owed > 0 ? tt("Collect (COD)", "সংগ্রহ (COD)") : tt("Paid — collect nothing", "পরিশোধিত — কিছু নেবেন না")}</span>
      <span className={cn("figure font-bold leading-none", big)}>{f.money(owed > 0 ? owed : 0)}</span>
    </>
  );
  return { f, tt, biz, tot, bizName, cod };
}

function StandardLabel({ order, opts, url, cell }: { order: Order; opts: DocOptions; url: string; cell: boolean }) {
  const { f, tt, biz, tot, bizName, cod } = useLabel(order, opts);
  const qr = useQr(url);
  return (
    <article
      className={cn(!cell && "doc-page", "relative flex flex-col overflow-hidden bg-white p-[3.5mm] text-[11px] text-[#16181A]", cell && "px-[5mm] py-[4mm]")}
      style={cell ? { width: CELL.w, height: CELL.h } : { width: PAPER.l100x75.w, height: PAPER.l100x75.h }}
      lang={opts.lang}
    >
      <div className="flex items-center justify-between gap-2 border-b-[1.5px] border-[#16181A] pb-[2mm]">
        <div className="flex min-w-0 items-center gap-2">
          <Logo size={22} mono />
          <span className="truncate font-display text-[12px] font-semibold">{bizName}</span>
        </div>
        <span className="tnum shrink-0 font-semibold">#{f.digits(String(order.no))}</span>
      </div>
      <div className="flex min-h-0 flex-1 gap-[3mm] pt-[2.5mm]">
        <div className="min-w-0 flex-1">
          <p className="text-[9.5px] text-[#686E74]">{tt("Deliver to", "প্রাপক")}</p>
          <p className="truncate text-[15px] font-bold leading-tight">{order.customer?.name ?? "—"}</p>
          <p className="tnum text-[13px] font-semibold">{order.customer ? f.digits(formatPhone(order.customer.phone)) : ""}</p>
          <p className="mt-1 line-clamp-4 text-[12px] leading-snug">{addressText(order, opts.lang)}</p>
        </div>
        {qr && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qr} alt="" className="size-[22mm] shrink-0 self-start" />
        )}
      </div>
      <div className="mt-[2mm] flex items-stretch gap-[2.5mm]">
        <div className="flex flex-1 flex-col justify-center rounded-[4px] border-2 border-[#16181A] px-[2.5mm] py-[1.5mm]">{cod("text-[24px]")}</div>
        <div className="flex w-[34mm] flex-col justify-center text-right leading-snug">
          <span className="font-semibold">{order.courier?.name ?? tt("Courier: —", "কুরিয়ার: —")}</span>
          {order.courier?.tracking && <span className="tnum">{order.courier.tracking}</span>}
          <span className="text-[#686E74]">
            {f.num(tot.units)} {tt("item(s)", "টি পণ্য")}
          </span>
        </div>
      </div>
      <p className="mt-[1.5mm] truncate text-[8.5px] text-[#686E74]">
        {tt("From", "প্রেরক")}: {bizName} · {f.digits(formatPhone(biz.phone))}
      </p>
    </article>
  );
}

/** 75 × 50 mm: name, phone, area and the amount to collect. No QR — it wouldn't scan at this size. */
function SmallLabel({ order, opts }: { order: Order; opts: DocOptions }) {
  const { f, tt, bizName, cod } = useLabel(order, opts);
  return (
    <article className="doc-page relative flex flex-col overflow-hidden bg-white p-[2.5mm] text-[10px] text-[#16181A]" style={{ width: PAPER.l75x50.w, height: PAPER.l75x50.h }} lang={opts.lang}>
      <div className="flex items-center justify-between gap-2 border-b border-[#16181A] pb-[1mm]">
        <span className="truncate font-display text-[10.5px] font-semibold">{bizName}</span>
        <span className="tnum shrink-0 font-semibold">#{f.digits(String(order.no))}</span>
      </div>
      <div className="min-h-0 flex-1 pt-[1.5mm]">
        <p className="truncate text-[13px] font-bold leading-tight">{order.customer?.name ?? "—"}</p>
        <p className="tnum text-[11.5px] font-semibold">{order.customer ? f.digits(formatPhone(order.customer.phone)) : ""}</p>
        <p className="line-clamp-2 text-[10px] leading-snug">{addressText(order, opts.lang)}</p>
      </div>
      <div className="flex items-end justify-between gap-2">
        <div className="flex flex-col rounded-[3px] border-[1.5px] border-[#16181A] px-[2mm] py-[1mm]">{cod("text-[17px]")}</div>
        <span className="truncate pb-0.5 text-right font-semibold">{order.courier?.name ?? tt("Courier: —", "কুরিয়ার: —")}</span>
      </div>
    </article>
  );
}

/** 4 × 6 inch courier label: big address, packing list so the packer can check the parcel, scannable tracking. */
function TallLabel({ order, opts, url }: { order: Order; opts: DocOptions; url: string }) {
  const { f, tt, biz, tot, bizName, cod } = useLabel(order, opts);
  const qr = useQr(url);
  const nameOf = useLineNames(order, opts.lang);
  const shown = order.lines.slice(0, 6);
  const more = order.lines.length - shown.length;
  const code = order.courier?.tracking ?? order.invoiceNo ?? String(order.no);
  return (
    <article className="doc-page relative flex flex-col overflow-hidden bg-white p-[4.5mm] text-[12px] text-[#16181A]" style={{ width: PAPER.l100x150.w, height: PAPER.l100x150.h }} lang={opts.lang}>
      <div className="flex items-center justify-between gap-2 border-b-2 border-[#16181A] pb-[2.5mm]">
        <div className="flex min-w-0 items-center gap-2">
          <Logo size={28} mono />
          <span className="truncate font-display text-[14px] font-semibold">{bizName}</span>
        </div>
        <span className="tnum shrink-0 text-[14px] font-bold">#{f.digits(String(order.no))}</span>
      </div>

      <div className="flex gap-[3mm] pt-[3mm]">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] text-[#686E74]">{tt("Deliver to", "প্রাপক")}</p>
          <p className="text-[19px] font-bold leading-tight">{order.customer?.name ?? "—"}</p>
          <p className="tnum text-[16px] font-semibold">{order.customer ? f.digits(formatPhone(order.customer.phone)) : ""}</p>
          <p className="mt-1 line-clamp-5 text-[13.5px] leading-snug">{addressText(order, opts.lang)}</p>
        </div>
        {qr && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qr} alt="" className="size-[24mm] shrink-0 self-start" />
        )}
      </div>

      <div className="mt-[3mm] min-h-0 flex-1 border-t border-dashed border-[#16181A]/60 pt-[2mm]">
        <p className="flex justify-between text-[10px] text-[#686E74]">
          <span>{tt("In this parcel", "পার্সেলে আছে")}</span>
          <span className="tnum">
            {f.num(tot.units)} {tt("item(s)", "টি পণ্য")}
          </span>
        </p>
        <ul className="mt-1 space-y-0.5">
          {shown.map((l) => (
            <li key={l.id} className="flex gap-2 leading-snug">
              <span className="tnum w-6 shrink-0 font-semibold">{f.num(l.qty)}×</span>
              <span className="min-w-0 truncate">
                {nameOf(l.productId, l.name)}
                {l.variantLabel && <span className="text-[#686E74]"> · {l.variantLabel}</span>}
              </span>
            </li>
          ))}
          {more > 0 && <li className="pl-8 text-[#686E74]">{tt(`+ ${more} more`, `+ আরও ${f.num(more)}টি`)}</li>}
        </ul>
      </div>

      <div className="mt-[2mm] flex items-end gap-[3mm]">
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{order.courier?.name ?? tt("Courier: —", "কুরিয়ার: —")}</p>
          <Barcode value={code} height={34} className="mt-1 h-[13mm] w-full" />
        </div>
      </div>
      <div className="mt-[2.5mm] flex flex-col rounded-[4px] border-[2.5px] border-[#16181A] px-[3mm] py-[2mm]">{cod("text-[30px]")}</div>
      <p className="mt-[1.5mm] truncate text-[9px] text-[#686E74]">
        {tt("From", "প্রেরক")}: {bizName} · {f.digits(formatPhone(biz.phone))}
      </p>
    </article>
  );
}

/** Eight labels on one A4 page with cut guides, for any office printer. */
export function LabelSheet({ orders, opts, urlOf }: { orders: Order[]; opts: DocOptions; urlOf: (id: string) => string }) {
  return (
    <article className="doc-page grid grid-cols-2 grid-rows-4 bg-white" style={{ width: PAPER.a4sheet.w, height: PAPER.a4sheet.h }}>
      {Array.from({ length: 8 }, (_, i) => {
        const o = orders[i];
        return (
          <div key={o?.id ?? `empty-${i}`} className={cn("relative border-dashed border-[#C9CDC4]", i % 2 === 0 && "border-r", i < 6 && "border-b")}>
            {o && <ParcelLabel order={o} opts={opts} url={urlOf(o.id)} size="cell" />}
          </div>
        );
      })}
    </article>
  );
}
