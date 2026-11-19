import Link from "next/link";
import { notFound } from "next/navigation";
import { makeFormatters } from "@/lib/format";
import { STATUS_LABEL } from "@/lib/labels";
import { getPublicInvoice } from "@/server/public/invoice";
import type { OrderStatus } from "@/lib/types";
import { brandStyle, SellerMark } from "./public-kit";
import { InvoiceActions } from "./public-invoice-actions";

const STEPS: OrderStatus[] = ["confirmed", "packed", "shipped", "delivered"];

/**
 * What a customer sees when they open the link or scan the invoice QR:
 * where the parcel is, how much to pay the rider, and the itemised invoice.
 */
export async function PublicInvoiceView({ token, lang: langParam }: { token: string; lang?: "en" | "bn" }) {
  const data = await getPublicInvoice(token);
  if (!data) notFound();
  const { business: b, order: o } = data;
  const lang = langParam ?? (b.lang as "en" | "bn");
  const f = makeFormatters({ lang, numerals: lang === "bn" ? (b.numerals as "latin" | "bangla") : "latin" });
  const t = (en: string, bn: string) => (lang === "bn" ? bn : en);
  const shopName = lang === "bn" && b.nameBn ? b.nameBn : b.name;

  const reached = new Map<OrderStatus, string>();
  for (const e of o.timeline) reached.set(e.status, e.at);
  const ended = o.status === "cancelled" || o.status === "returned" || o.status === "partially_returned";
  const currentIdx = STEPS.indexOf(o.status === "partially_returned" ? "delivered" : o.status);
  const headline: Record<OrderStatus, [string, string]> = {
    draft: ["We've got your order", "আপনার অর্ডার পেয়েছি"],
    confirmed: ["Order confirmed — we're getting it ready", "অর্ডার নিশ্চিত — প্যাক করা হচ্ছে"],
    packed: ["Packed and waiting for the courier", "প্যাক হয়েছে, কুরিয়ারের অপেক্ষায়"],
    shipped: [`On the way${o.courier ? ` with ${o.courier.name}` : ""}`, `পথে আছে${o.courier ? ` — ${o.courier.name}` : ""}`],
    delivered: ["Delivered. Enjoy!", "ডেলিভারি হয়েছে। উপভোগ করুন!"],
    returned: ["This parcel was returned", "পার্সেলটি ফেরত গেছে"],
    partially_returned: ["Delivered — part of it was returned", "ডেলিভারি হয়েছে — কিছু অংশ ফেরত"],
    cancelled: ["This order was cancelled", "অর্ডারটি বাতিল হয়েছে"],
  };
  const toPay = o.settlement === "cod" ? o.totals.cod : o.totals.due;
  const payDone = toPay <= 0 || o.codReceived || o.status === "delivered";
  const wa = b.phone ? `https://wa.me/88${b.phone}?text=${encodeURIComponent(t(`Hi! About my order #${o.no}`, `আসসালামু আলাইকুম! আমার অর্ডার #${o.no} সম্পর্কে`))}` : null;

  return (
    <div lang={lang} style={brandStyle(b.accent)} className="min-h-dvh bg-canvas pb-16">
      <header className="no-print border-b border-line/70 bg-surface/80 backdrop-blur">
        <div className="mx-auto flex max-w-[720px] items-center gap-3 px-4 py-3">
          <SellerMark name={b.name} logo={b.logo} shape={b.logoShape} size={36} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-[15px] font-semibold text-ink">{shopName}</p>
            {b.tagline && <p className="truncate text-xs text-ink-3">{b.tagline}</p>}
          </div>
          <a href={`?lang=${lang === "bn" ? "en" : "bn"}`} className="h-9 rounded-full px-3 text-[13px] font-medium leading-9 text-ink-2 hover:bg-sunken">
            {lang === "bn" ? "English" : "বাংলা"}
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-[720px] px-4 pt-6">
        {/* Where is it? */}
        <section className="rounded-xl border border-line bg-surface p-5 shadow-1 sm:p-6" aria-labelledby="status-h">
          <p className="text-[13px] font-medium text-ink-3">
            {t("Order", "অর্ডার")} #{f.digits(String(o.no))} · {f.date(o.createdAt)}
          </p>
          <h1 id="status-h" className="mt-1 font-display text-[26px] font-semibold leading-tight tracking-[-0.02em] text-ink sm:text-[30px]">
            {t(...headline[o.status])}
          </h1>
          {o.courier?.tracking && (
            <p className="mt-2 text-sm text-ink-2">
              {t("Tracking number", "ট্র্যাকিং নম্বর")} <b className="tnum font-semibold text-ink">{o.courier.tracking}</b>
            </p>
          )}
          {!ended && o.status !== "draft" && (
            <ol className="mt-6 grid grid-cols-4" aria-label={t("Delivery progress", "ডেলিভারির অগ্রগতি")}>
              {STEPS.map((s, i) => {
                const done = i <= currentIdx;
                return (
                  <li key={s} className="relative flex flex-col items-center text-center">
                    {i > 0 && <span className={`absolute right-1/2 top-[11px] h-0.5 w-full ${i <= currentIdx ? "bg-brand" : "bg-line"}`} aria-hidden />}
                    <span className={`relative z-10 grid size-6 place-items-center rounded-full border-2 text-[11px] font-bold ${done ? "border-brand bg-brand text-brand-contrast" : "border-line-strong bg-surface text-transparent"}`}>✓</span>
                    <span className={`mt-2 text-[12px] font-medium ${done ? "text-ink" : "text-ink-4"}`}>{t(...STATUS_LABEL[s])}</span>
                    <span className="tnum text-[11px] text-ink-4">{reached.get(s) ? f.dateShort(reached.get(s)!) : ""}</span>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        {/* What to pay */}
        {o.status !== "cancelled" && (
          <section className={`mt-4 flex items-center justify-between gap-4 rounded-xl px-5 py-4 ${payDone ? "border border-line bg-surface" : "bg-cash-soft"}`}>
            <div>
              <p className={`text-[13px] font-medium ${payDone ? "text-ink-3" : "text-cash-ink"}`}>
                {payDone ? t("Nothing left to pay", "আর কিছু দিতে হবে না") : o.settlement === "cod" ? t("Pay the rider on delivery", "ডেলিভারির সময় রাইডারকে দিন") : t("Amount due", "বাকি টাকা")}
              </p>
              {!payDone && <p className="mt-0.5 text-xs text-cash-ink/80">{t("Check your parcel in front of the rider before paying.", "টাকা দেওয়ার আগে রাইডারের সামনে পার্সেল দেখে নিন।")}</p>}
            </div>
            <p className={`figure text-[30px] font-semibold leading-none ${payDone ? "text-ok" : "text-cash-ink"}`}>{payDone ? "✓" : f.money(toPay)}</p>
          </section>
        )}

        {/* The invoice */}
        <article className="relative mt-4 overflow-hidden rounded-xl border border-line bg-surface shadow-1" aria-labelledby="inv-h">
          {b.trial && <TrialStamp label={t("HaatKhata trial", "হাটখাতা ট্রায়াল")} />}
          <div className="flex flex-col items-start justify-between gap-3 border-b border-line px-5 py-4 sm:flex-row sm:px-6">
            <div>
              <h2 id="inv-h" className="font-display text-lg font-semibold text-brand-ink">
                {o.status === "cancelled" ? t("Invoice — VOID", "ইনভয়েস — বাতিল") : t("Invoice", "ইনভয়েস")}
              </h2>
              <p className="tnum text-[13px] text-ink-3">{o.invoiceNo ?? t("Not issued yet", "এখনো ইস্যু হয়নি")}</p>
            </div>
            {o.customer && (
              <div className="text-[13px] text-ink-2 sm:text-right">
                <p className="font-semibold text-ink">{o.customer.name}</p>
                {o.customer.phone && <p className="tnum">{o.customer.phone}</p>}
                {o.customer.address && (
                  <p>
                    {[o.customer.address.line, o.customer.address.area, o.customer.address.district].filter(Boolean).join(", ")}
                  </p>
                )}
              </div>
            )}
          </div>
          <ul className="divide-y divide-line px-5 sm:px-6">
            {o.lines.map((l, i) => (
              <li key={i} className="flex items-start gap-3 py-3 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="block font-medium text-ink">{l.name}</span>
                  <span className="block text-[13px] text-ink-3">
                    {[l.variantLabel, `${f.num(l.qty)} × ${f.money(l.price)}`].filter(Boolean).join(" · ")}
                    {l.returnedQty > 0 && ` · ${t(`${l.returnedQty} returned`, `${f.num(l.returnedQty)}টি ফেরত`)}`}
                  </span>
                </span>
                <span className="tnum font-semibold text-ink">{f.money(l.qty * l.price - l.discount)}</span>
              </li>
            ))}
          </ul>
          <dl className="space-y-1.5 border-t border-line px-5 py-4 text-sm sm:px-6">
            {(
              [
                [t("Subtotal", "সাবটোটাল"), o.totals.subtotal],
                o.totals.discount ? [t("Discount", "ছাড়"), -o.totals.discount] : null,
                o.totals.delivery ? [t("Delivery", "ডেলিভারি"), o.totals.delivery] : null,
                o.totals.other ? [t("Other charges", "অন্যান্য চার্জ"), o.totals.other] : null,
              ].filter(Boolean) as [string, number][]
            ).map(([k, v]) => (
              <div key={k} className="flex justify-between text-ink-2">
                <dt>{k}</dt>
                <dd className="tnum">{f.money(v)}</dd>
              </div>
            ))}
            <div className="flex justify-between border-t border-line pt-2 text-base font-semibold text-ink">
              <dt>{t("Total", "মোট")}</dt>
              <dd className="tnum">{f.money(o.totals.total)}</dd>
            </div>
            {o.totals.paid > 0 && (
              <div className="flex justify-between text-ink-2">
                <dt>{t("Paid", "পরিশোধিত")}</dt>
                <dd className="tnum">{f.money(o.totals.paid)}</dd>
              </div>
            )}
          </dl>
          {(o.noteForCustomer || b.terms || b.footer) && (
            <div className="space-y-1 border-t border-line px-5 py-4 text-[13px] text-ink-3 sm:px-6">
              {o.noteForCustomer && <p className="text-ink-2">{o.noteForCustomer}</p>}
              {b.terms && <p>{b.terms}</p>}
              {b.footer && <p>{b.footer}</p>}
            </div>
          )}
          {b.thanks && <p className="border-t border-line px-5 py-4 font-display text-[15px] font-semibold text-brand-ink sm:px-6">{b.thanks}</p>}
        </article>

        <InvoiceActions phone={b.phone} whatsapp={wa} lang={lang} />

        <footer className="mt-10 text-center text-xs text-ink-4">
          <p>
            {shopName}
            {b.address ? ` · ${b.address}` : ""}
          </p>
          <p className="mt-3">
            {b.trial ? t("Trial invoice made with", "ট্রায়াল ইনভয়েস তৈরি") : t("Invoice made with", "ইনভয়েস তৈরি")}{" "}
            <Link href="/" className="font-semibold text-ink-3 hover:text-ink">
              HaatKhata
            </Link>
          </p>
        </footer>
      </main>
    </div>
  );
}

/** Diagonal repeat over the invoice for shops without a paid plan; prints too. */
function TrialStamp({ label }: { label: string }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-10 grid select-none place-content-center gap-16 overflow-hidden [print-color-adjust:exact]">
      {[0, 1, 2].map((i) => (
        <p key={i} className="-rotate-[24deg] whitespace-nowrap text-center font-display text-[44px] font-bold uppercase tracking-[0.08em] text-ink/[0.07]">
          {label} · {label}
        </p>
      ))}
    </div>
  );
}
