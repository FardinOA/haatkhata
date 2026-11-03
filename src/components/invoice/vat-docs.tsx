"use client";

import { BrandMark } from "../bits";
import { PaperDoc } from "./paper-doc";
import type { DocOptions } from "./documents";
import { lineTotal, orderTotals } from "@/lib/domain";
import { makeFormatters } from "@/lib/format";
import { PAY_LABEL, pick } from "@/lib/labels";
import { useStore } from "@/lib/store";
import type { Order } from "@/lib/types";

import { vatIn } from "@/lib/vat";

/**
 * Mushak-6.3 tax invoice (FR-INV-12) for VAT-registered sellers. Prices in the
 * app are VAT-inclusive, so each line is split into value and VAT.
 */
export function MushakInvoice({ order, opts }: { order: Order; opts: DocOptions }) {
  const business = useStore((s) => s.business);
  const invoice = useStore((s) => s.invoice);
  const products = useStore((s) => s.products);
  const f = makeFormatters({ lang: opts.lang, numerals: opts.numerals });
  const rate = invoice.vatPercent ?? 0;
  const tot = orderTotals(order);
  const share = tot.subtotal ? (tot.subtotal - tot.discount) / tot.subtotal : 1;
  const rows = order.lines.map((l) => {
    const gross = lineTotal(l) * share;
    const vat = vatIn(gross, rate);
    const unitText = products.find((p) => p.id === l.productId)?.unit ?? "pcs";
    return { l, gross, vat, net: gross - vat, unit: unitText };
  });
  const delivery = order.deliveryCharge + order.otherCharges;
  const deliveryVat = vatIn(delivery, rate);
  const sumNet = rows.reduce((s, r) => s + r.net, 0) + delivery - deliveryVat;
  const sumVat = rows.reduce((s, r) => s + r.vat, 0) + deliveryVat;
  const issued = new Date(order.events.find((e) => e.to === "confirmed" || e.to === "delivered")?.at ?? order.createdAt);
  const cell = "border border-[#333] px-1.5 py-1";
  return (
    <article className="mx-auto bg-white text-[#111] shadow-2 print:shadow-none" style={{ width: "210mm", minHeight: "297mm", padding: "12mm 12mm", fontSize: "8.6pt" }}>
      <header className="text-center leading-snug">
        <p>গণপ্রজাতন্ত্রী বাংলাদেশ সরকার, জাতীয় রাজস্ব বোর্ড</p>
        <p className="mt-1 text-[11pt] font-bold">কর চালানপত্র · Tax invoice</p>
        <p className="text-[#444]">[বিধি ৪০ এর উপ-বিধি (১) এর দফা (গ) ও দফা (চ) দ্রষ্টব্য]</p>
      </header>
      <div className="mt-1 flex justify-end">
        <span className="rounded border border-[#333] px-2 py-0.5 font-bold">মূসক-৬.৩</span>
      </div>
      <section className="mt-3 grid grid-cols-[auto_1fr] items-center gap-3 border-y border-[#333] py-3">
        <BrandMark size={40} />
        <div className="grid grid-cols-2 gap-x-6 gap-y-0.5">
          <p>
            নিবন্ধিত ব্যক্তির নাম: <b>{business.nameBn || business.name}</b>
          </p>
          <p>
            বিআইএন (BIN): <b className="tnum">{invoice.bin || "—"}</b>
          </p>
          <p className="col-span-2">চালানপত্র ইস্যুর ঠিকানা: {business.address}</p>
        </div>
      </section>
      <section className="mt-3 grid grid-cols-2 gap-x-6 gap-y-0.5">
        <p>
          ক্রেতার নাম: <b>{order.customer?.name ?? "—"}</b>
        </p>
        <p>
          চালানপত্র নম্বর: <b className="tnum">{order.invoiceNo ?? `#${order.no}`}</b>
        </p>
        <p>ক্রেতার বিআইএন: —</p>
        <p className="tnum">
          ইস্যুর তারিখ: {f.date(issued)} · সময়: {f.time(issued)}
        </p>
        <p className="col-span-2">সরবরাহের গন্তব্যস্থল: {order.customer?.address ? [order.customer.address.line, order.customer.address.area, order.customer.address.district].filter(Boolean).join(", ") : business.address}</p>
      </section>
      <table className="mt-4 w-full border-collapse text-[8pt]">
        <thead className="bg-[#f2f2f2] text-center">
          <tr>
            <th className={cell}>ক্রমিক</th>
            <th className={cell}>পণ্য বা সেবার বর্ণনা</th>
            <th className={cell}>সরবরাহের একক</th>
            <th className={cell}>পরিমাণ</th>
            <th className={cell}>একক মূল্য (টাকায়)</th>
            <th className={cell}>মোট মূল্য (টাকায়)</th>
            <th className={cell}>সম্পূরক শুল্কের হার ও পরিমাণ</th>
            <th className={cell}>মূসকের হার</th>
            <th className={cell}>মূসকের পরিমাণ (টাকায়)</th>
            <th className={cell}>সকল প্রকার শুল্ক ও করসহ মূল্য</th>
          </tr>
          <tr className="text-[7pt] text-[#555]">
            {Array.from({ length: 10 }, (_, i) => (
              <th key={i} className={cell}>
                ({i + 1})
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="tnum">
          {rows.map((r, i) => (
            <tr key={r.l.id}>
              <td className={`${cell} text-center`}>{f.num(i + 1)}</td>
              <td className={cell}>
                {r.l.name}
                {r.l.variantLabel ? ` (${r.l.variantLabel})` : ""}
              </td>
              <td className={`${cell} text-center`}>{r.unit}</td>
              <td className={`${cell} text-right`}>{f.num(r.l.qty)}</td>
              <td className={`${cell} text-right`}>{f.num(r.net / r.l.qty, true)}</td>
              <td className={`${cell} text-right`}>{f.num(r.net, true)}</td>
              <td className={`${cell} text-center`}>—</td>
              <td className={`${cell} text-center`}>{f.num(rate, true)}%</td>
              <td className={`${cell} text-right`}>{f.num(r.vat, true)}</td>
              <td className={`${cell} text-right`}>{f.num(r.gross, true)}</td>
            </tr>
          ))}
          {delivery > 0 && (
            <tr>
              <td className={`${cell} text-center`}>{f.num(rows.length + 1)}</td>
              <td className={cell}>ডেলিভারি সেবা</td>
              <td className={`${cell} text-center`}>সেবা</td>
              <td className={`${cell} text-right`}>{f.num(1)}</td>
              <td className={`${cell} text-right`}>{f.num(delivery - deliveryVat, true)}</td>
              <td className={`${cell} text-right`}>{f.num(delivery - deliveryVat, true)}</td>
              <td className={`${cell} text-center`}>—</td>
              <td className={`${cell} text-center`}>{f.num(rate, true)}%</td>
              <td className={`${cell} text-right`}>{f.num(deliveryVat, true)}</td>
              <td className={`${cell} text-right`}>{f.num(delivery, true)}</td>
            </tr>
          )}
          <tr className="font-bold">
            <td className={cell} colSpan={5}>
              সর্বমোট
            </td>
            <td className={`${cell} text-right`}>{f.num(sumNet, true)}</td>
            <td className={`${cell} text-center`}>—</td>
            <td className={cell} />
            <td className={`${cell} text-right`}>{f.num(sumVat, true)}</td>
            <td className={`${cell} text-right`}>{f.num(tot.total, true)}</td>
          </tr>
        </tbody>
      </table>
      <section className="mt-10 grid grid-cols-2 gap-10">
        <div />
        <div className="text-center">
          <div className="mx-auto mb-1 h-px w-48 bg-[#333]" />
          <p>প্রতিষ্ঠান কর্তৃপক্ষের দায়িত্বপ্রাপ্ত ব্যক্তির স্বাক্ষর</p>
          <p className="text-[#555]">নাম: ____________________</p>
        </div>
      </section>
      <p className="mt-6 text-[7.5pt] text-[#555]">* উৎসে কর্তনযোগ্য সরবরাহের ক্ষেত্রে ফরমটি সমন্বিত কর চালানপত্র ও উৎসে কর কর্তন সনদপত্র হিসেবে বিবেচিত হইবে এবং উহা উৎসে কর কর্তনযোগ্য সরবরাহের ক্ষেত্রে প্রযোজ্য হইবে।</p>
    </article>
  );
}

/** Receipt for money collected against an order or a due (FR-INV-10). */
export function PaymentReceipt({ order, opts, paymentId }: { order: Order; opts: DocOptions; paymentId?: string }) {
  const payments = order.payments.filter((p) => p.amount > 0);
  const p = payments.find((x) => x.id === paymentId) ?? payments.at(-1);
  const f = makeFormatters({ lang: opts.lang, numerals: opts.numerals });
  const L = (en: string, bn: string) => (opts.lang === "bn" ? bn : en);
  if (!p) return <p className="p-8 text-center text-ink-3">{L("No payments on this order yet.", "এই অর্ডারে এখনো কোনো পেমেন্ট নেই।")}</p>;
  const tot = orderTotals(order);
  const paidUpTo = order.payments.filter((x) => x.at <= p.at).reduce((s, x) => s + x.amount, 0);
  const left = Math.max(0, tot.total - paidUpTo);
  const idx = payments.indexOf(p) + 1;
  return (
    <PaperDoc
      size="a5"
      lang={opts.lang}
      kind={L("Payment receipt", "টাকা প্রাপ্তির রসিদ")}
      number={`RCPT-${order.no}-${idx}`}
      date={p.at}
      partyTitle={L("Received from", "যার কাছ থেকে")}
      party={
        <>
          <p className="font-semibold">{order.customer?.name ?? L("Walk-in customer", "দোকানের কাস্টমার")}</p>
          {order.customer?.phone && <p className="tnum">{order.customer.phone}</p>}
        </>
      }
      meta={[
        [L("For invoice", "ইনভয়েস"), order.invoiceNo ?? `#${order.no}`],
        [L("Paid by", "মাধ্যম"), pick(PAY_LABEL[p.method], opts.lang)],
        ...(p.txnId ? ([[L("Transaction ID", "ট্রানজেকশন আইডি"), p.txnId]] as [string, string][]) : []),
        [L("Received by", "গ্রহণকারী"), p.by],
      ]}
      totals={[
        [L("Invoice total", "ইনভয়েসের মোট"), f.money(tot.total)],
        [L("Paid so far", "এ পর্যন্ত পরিশোধ"), f.money(paidUpTo)],
        [L("Still to pay", "বাকি"), f.money(left), true],
      ]}
      highlight={{ label: L("Amount received", "প্রাপ্ত টাকা"), value: f.money(p.amount) }}
      footer={<p>{left > 0 ? L("Thank you. Please keep this receipt until the balance is cleared.", "ধন্যবাদ। বাকি পরিশোধ পর্যন্ত রসিদটি রাখুন।") : L("Thank you — this invoice is fully paid.", "ধন্যবাদ — ইনভয়েস সম্পূর্ণ পরিশোধিত।")}</p>}
    />
  );
}
