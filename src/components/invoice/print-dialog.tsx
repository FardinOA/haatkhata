"use client";

import { Eye, Printer } from "@phosphor-icons/react";
import { useCallback, useState, type ReactNode } from "react";
import { Button, Checkbox, Segmented } from "@/components/ui/core";
import { Dialog } from "@/components/ui/overlays";
import { useFmt, useT } from "@/lib/hooks";
import { invoicePaper, invoicePapersFor, LABEL_PAPERS, labelPaper, printHref, type LabelPaper, type PrintDoc } from "@/lib/print";
import { useStore, type InvoiceTemplate } from "@/lib/store";
import { PaperShelf } from "./paper-picker";

type Request = { key: number; ids: string[]; doc: PrintDoc; labels: boolean };

/**
 * Printing from anywhere in the app. `print` goes straight to this device's
 * saved paper; `choose` (or a device set to "ask every time") opens the paper
 * chooser first. The print page logs to each order's timeline once it actually prints.
 */
export function usePrint() {
  const printer = useStore((s) => s.printer);
  const shopDefault = useStore((s) => s.invoice.template);
  // The request outlives `open` so the dialog keeps its content while it animates out.
  const [req, setReq] = useState<Request | null>(null);
  const [open, setOpen] = useState(false);

  const choose = useCallback((ids: string[], doc: PrintDoc = "invoice", opts?: { labels?: boolean }) => {
    if (!ids.length) return;
    setReq((r) => ({ key: (r?.key ?? 0) + 1, ids, doc, labels: opts?.labels ?? true }));
    setOpen(true);
  }, []);

  const print = useCallback(
    (ids: string[], doc: PrintDoc = "invoice", opts?: { labels?: boolean }) => {
      if (!ids.length) return;
      // First print on this device: ask once, then remember.
      if (printer.ask || (doc === "invoice" && !printer.invoice)) return choose(ids, doc, opts);
      window.open(printHref(ids, { doc, invoice: printer.invoice, label: printer.label, copies: printer.copies, print: true }), "_blank");
    },
    [printer, choose],
  );

  const node = req && <PrintDialog key={req.key} req={req} open={open} shopDefault={shopDefault} onClose={() => setOpen(false)} />;
  return { print, choose, node, isOpen: open };
}

/** Short name of the paper this device prints on, for "Change paper" hints. */
export function useDevicePaperName(doc: PrintDoc) {
  const t = useT();
  const printer = useStore((s) => s.printer);
  const shopDefault = useStore((s) => s.invoice.template);
  const p = doc === "label" ? labelPaper(printer.label) : invoicePaper(printer.invoice ?? shopDefault);
  return t(p.en, p.bn);
}

function PrintDialog({ req, open, shopDefault, onClose }: { req: Request; open: boolean; shopDefault: InvoiceTemplate; onClose: () => void }) {
  const t = useT();
  const f = useFmt();
  const printer = useStore((s) => s.printer);
  const vat = useStore((s) => (s.invoice.vatPercent ?? 0) > 0 || !!s.invoice.bin);
  const setPrinter = useStore((s) => s.setPrinter);

  const [doc, setDoc] = useState<PrintDoc>(req.doc);
  const [invoice, setInvoice] = useState<InvoiceTemplate>(printer.invoice ?? shopDefault);
  const [label, setLabel] = useState<LabelPaper>(printer.label);
  const [copies, setCopies] = useState<1 | 2>(printer.copies);
  const [remember, setRemember] = useState(true);

  const n = req.ids.length;
  const paper = doc === "label" ? labelPaper(label) : invoicePaper(invoice);
  const duo = doc === "invoice" && invoice === "a4duo";

  const go = (print: boolean) => {
    if (remember) setPrinter(doc === "label" ? { label } : { invoice, copies });
    window.open(printHref(req.ids, { doc, invoice, label, copies, print }), "_blank");
    onClose();
  };

  const what = doc === "label" ? t(n === 1 ? "label" : "labels", "লেবেল") : t(n === 1 ? "invoice" : "invoices", "ইনভয়েস");
  const title = n === 1 ? t(`Print ${what}`, `${what} প্রিন্ট`) : t(`Print ${n} ${what}`, `${f.num(n)}টি ${what} প্রিন্ট`);

  let sheets: ReactNode = null;
  if (doc === "label" && label === "a4sheet") sheets = t(`${Math.ceil(n / 8)} A4 sheet${n > 8 ? "s" : ""}`, `${f.num(Math.ceil(n / 8))}টি A4 পাতা`);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      width={780}
      title={title}
      footer={
        <>
          <span className="mr-auto self-center text-xs text-ink-3">{sheets}</span>
          <Button variant="ghost" icon={<Eye className="size-4" />} onClick={() => go(false)}>
            {t("Preview", "আগে দেখুন")}
          </Button>
          <Button variant="primary" icon={<Printer className="size-4" />} onClick={() => go(true)} data-autofocus>
            {t(`Print on ${paper.en}`, `${paper.bn}-এ প্রিন্ট`)}
          </Button>
        </>
      }
    >
      <div className="-mt-0.5 space-y-5">
        {req.labels && (
          <Segmented<PrintDoc>
            size="sm"
            value={doc}
            onChange={setDoc}
            ariaLabel={t("Document", "ডকুমেন্ট")}
            options={[
              { value: "invoice", label: t("Invoice", "ইনভয়েস") },
              { value: "label", label: t("Parcel label", "পার্সেল লেবেল") },
            ]}
          />
        )}

        <div className="max-h-[60vh] overflow-y-auto overscroll-contain pb-1">
          {doc === "label" ? (
            <PaperShelf papers={LABEL_PAPERS} value={label} onChange={setLabel} ariaLabel={t("Label size", "লেবেলের মাপ")} />
          ) : (
            <PaperShelf papers={invoicePapersFor(vat)} value={invoice} onChange={setInvoice} ariaLabel={t("Paper size", "কাগজের মাপ")} />
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-line pt-4">
          {doc === "invoice" && !duo && (
            <div className="flex items-center gap-3">
              <span className="text-[13px] text-ink-2">{t("Copies", "কপি")}</span>
              <Segmented<"1" | "2">
                size="sm"
                value={String(copies) as "1" | "2"}
                onChange={(v) => setCopies(v === "2" ? 2 : 1)}
                ariaLabel={t("Copies", "কপি")}
                options={[
                  { value: "1", label: t("Customer only", "শুধু কাস্টমার") },
                  { value: "2", label: t("+ Shop copy", "+ দোকানের কপি") },
                ]}
              />
            </div>
          )}
          <div className="flex items-center gap-2.5">
            <Checkbox checked={remember} onChange={setRemember} label={t("Use this paper next time on this device", "এই ডিভাইসে পরেরবারও এই কাগজ")} />
            <span aria-hidden className="cursor-pointer select-none text-[13px] text-ink-2" onClick={() => setRemember(!remember)}>
              {t("Use this paper next time on this device", "এই ডিভাইসে পরেরবারও এই কাগজ")}
            </span>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
