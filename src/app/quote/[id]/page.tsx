"use client";

import { DownloadSimple, Printer } from "@phosphor-icons/react";
import { toPng } from "html-to-image";
import { useParams } from "next/navigation";
import { useRef, useState } from "react";
import { PrintFrame, PrintToolbar } from "@/components/invoice/print-frame";
import { PaperDoc } from "@/components/invoice/paper-doc";
import { usePrintGate } from "@/components/invoice/print-gate";
import { Button, EmptyState, Segmented } from "@/components/ui/core";
import { orderTotals } from "@/lib/domain";
import { useT } from "@/lib/hooks";
import { useStore } from "@/lib/store";
import type { Lang } from "@/lib/types";

/** Printable / shareable quotation (FR-INV-11). */
export default function QuotePrint() {
  return <PrintFrame>{() => <View />}</PrintFrame>;
}

function View() {
  const t = useT();
  const { id } = useParams<{ id: string }>();
  const quote = useStore((s) => s.quotes.find((q) => q.id === id));
  const invoice = useStore((s) => s.invoice);
  const [lang, setLang] = useState<Lang>(invoice.lang);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const gate = usePrintGate();
  if (!quote) return <EmptyState title={t("Quotation not found", "কোটেশন পাওয়া যায়নি")} />;
  const L = (en: string, bn: string) => (lang === "bn" ? bn : en);
  const money = (n: number) => `৳${n.toLocaleString("en-IN")}`;
  const totals = orderTotals({ lines: quote.lines.map((l) => ({ ...l, cost: 0, returnedQty: 0 })) as never, discount: quote.discount, deliveryCharge: quote.deliveryCharge, otherCharges: 0, payments: [], settlement: "cod" });

  const savePng = async () => {
    if (!ref.current) return;
    setBusy(true);
    try {
      if (!(await gate.claim([`quote:${quote.id}`]))) return;
      const url = await toPng(ref.current, { pixelRatio: 2, backgroundColor: "#ffffff" });
      const a = document.createElement("a");
      a.href = url;
      a.download = `${quote.no}.png`;
      a.click();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-dvh bg-canvas">
      <style>{`@media print { @page { size: A4; margin: 0; } body { background: #fff; } }`}</style>
      <PrintToolbar back="/quotes" title={quote.no} sub={quote.customer?.name}>
        <Segmented<Lang> size="sm" value={lang} onChange={setLang} options={[{ value: "en", label: "English" }, { value: "bn", label: "বাংলা" }]} />
        <Button icon={<DownloadSimple className="size-4" />} loading={busy} onClick={savePng}>
          PNG
        </Button>
        <Button variant="primary" icon={<Printer className="size-4" />} onClick={async () => (await gate.claim([`quote:${quote.id}`])) && window.print()}>
          {t("Print", "প্রিন্ট")}
        </Button>
      </PrintToolbar>
      <div className="py-8 print:py-0">
        <div ref={ref} className="w-fit mx-auto" data-print-gated>
          <PaperDoc
            lang={lang}
            kind={L("Quotation", "কোটেশন")}
            number={quote.no}
            date={quote.createdAt}
            partyTitle={L("Prepared for", "যার জন্য")}
            party={
              <>
                <p className="font-semibold">{quote.customer?.name ?? "—"}</p>
                {quote.customer?.phone && <p className="tnum">{quote.customer.phone}</p>}
                {quote.customer?.address && <p className="text-[#666]">{[quote.customer.address.line, quote.customer.address.area, quote.customer.address.district].filter(Boolean).join(", ")}</p>}
              </>
            }
            meta={[[L("Valid until", "মেয়াদ"), new Date(`${quote.validUntil}T12:00:00`).toLocaleDateString("en-GB")]]}
            rows={quote.lines.map((l) => ({ name: l.name, sub: l.variantLabel || undefined, qty: l.qty, price: l.price, amount: l.qty * l.price - l.discount }))}
            totals={[
              [L("Subtotal", "উপমোট"), money(totals.subtotal)],
              ...(totals.discount ? ([[L("Discount", "ছাড়"), `−${money(totals.discount)}`]] as [string, string][]) : []),
              ...(quote.deliveryCharge ? ([[L("Delivery", "ডেলিভারি"), money(quote.deliveryCharge)]] as [string, string][]) : []),
              [L("Total", "মোট"), money(totals.total), true],
            ]}
            notes={quote.notes ? <p>{quote.notes}</p> : undefined}
            footer={<p>{L("Prices are held until the date above. Reply on chat to confirm and we'll start packing.", "উপরের তারিখ পর্যন্ত দাম বহাল। নিশ্চিত করতে চ্যাটে জানান, আমরা প্যাক শুরু করব।")}</p>}
          />
        </div>
        {gate.note && <p className="no-print mx-auto mt-4 max-w-md text-center text-xs font-medium text-cash-ink">{gate.note}</p>}
      </div>
      {gate.ui}
    </div>
  );
}
