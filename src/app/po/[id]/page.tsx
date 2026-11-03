"use client";

import { Printer } from "@phosphor-icons/react";
import { useParams } from "next/navigation";
import { useState } from "react";
import { PrintFrame, PrintToolbar } from "@/components/invoice/print-frame";
import { PaperDoc } from "@/components/invoice/paper-doc";
import { Button, EmptyState, Segmented } from "@/components/ui/core";
import { useT } from "@/lib/hooks";
import { getVariant, useStore } from "@/lib/store";
import type { Lang } from "@/lib/types";

/** Printable purchase order (FR-STK-11). */
export default function PurchaseOrderPrint() {
  return <PrintFrame>{() => <View />}</PrintFrame>;
}

function View() {
  const t = useT();
  const { id } = useParams<{ id: string }>();
  const po = useStore((s) => s.purchaseOrders.find((p) => p.id === id));
  const suppliers = useStore((s) => s.suppliers);
  const products = useStore((s) => s.products);
  const locations = useStore((s) => s.locations);
  const invoiceLang = useStore((s) => s.invoice.lang);
  const [lang, setLang] = useState<Lang>(invoiceLang);
  if (!po) return <EmptyState title={t("Purchase order not found", "ক্রয় অর্ডার পাওয়া যায়নি")} />;
  const sup = suppliers.find((s) => s.id === po.supplierId);
  const L = (en: string, bn: string) => (lang === "bn" ? bn : en);
  const rows = po.lines.map((l) => {
    const hit = getVariant(products, l.variantId);
    return { name: hit?.p.name ?? l.variantId, sub: hit ? [Object.values(hit.v.options).join(" / "), hit.v.sku].filter(Boolean).join(" · ") : undefined, qty: l.qty, price: l.unitCost, amount: l.qty * l.unitCost };
  });
  const total = rows.reduce((s, r) => s + r.amount, 0);
  const loc = locations.find((l) => l.id === po.locationId);
  return (
    <div className="min-h-dvh bg-canvas">
      <style>{`@media print { @page { size: A4; margin: 0; } body { background: #fff; } }`}</style>
      <PrintToolbar back="/inventory?tab=purchase-orders" title={po.no} sub={sup?.name}>
        <Segmented<Lang> size="sm" value={lang} onChange={setLang} options={[{ value: "en", label: "English" }, { value: "bn", label: "বাংলা" }]} />
        <Button variant="primary" icon={<Printer className="size-4" />} onClick={() => window.print()}>
          {t("Print", "প্রিন্ট")}
        </Button>
      </PrintToolbar>
      <div className="py-8 print:py-0">
        <PaperDoc
          lang={lang}
          kind={L("Purchase order", "ক্রয় অর্ডার")}
          number={po.no}
          date={po.createdAt}
          partyTitle={L("Supplier", "সাপ্লায়ার")}
          party={
            <>
              <p className="font-semibold">{sup?.name ?? "—"}</p>
              {sup?.phone && <p className="tnum">{sup.phone}</p>}
              {sup?.address && <p className="text-[#666]">{sup.address}</p>}
            </>
          }
          meta={[
            ...(po.expectedAt ? ([[L("Deliver by", "ডেলিভারির তারিখ"), new Date(po.expectedAt).toLocaleDateString("en-GB")]] as [string, string][]) : []),
            ...(loc ? ([[L("Deliver to", "যেখানে দেবেন"), loc.name]] as [string, string][]) : []),
          ]}
          rows={rows}
          totals={[[L("Order total", "মোট"), `৳${total.toLocaleString("en-IN")}`, true]]}
          notes={po.note ? <p>{po.note}</p> : undefined}
          footer={<p>{L("Please send the memo with the goods and mention this purchase order number.", "পণ্যের সাথে মেমো পাঠান ও এই অর্ডার নম্বর উল্লেখ করুন।")}</p>}
        />
      </div>
    </div>
  );
}
