"use client";

import { ArrowLeft, CaretDown, DownloadSimple, LinkSimple, Printer, PushPin, ShareNetwork } from "@phosphor-icons/react";
import { toPng } from "html-to-image";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LabelSheet, MemoInvoice, PAPER, ParcelLabel, ThermalReceipt, type DocOptions } from "@/components/invoice/documents";
import { PaperGlyph } from "@/components/invoice/paper-picker";
import { usePrintGate } from "@/components/invoice/print-gate";
import { ThermalPrintButton } from "@/components/invoice/thermal-print";
import { MushakInvoice, PaymentReceipt } from "@/components/invoice/vat-docs";
import { useCustomerLinks } from "@/components/storefront/public-link";
import { Button, cn, EmptyState, Segmented, Skeleton } from "@/components/ui/core";
import { Menu, ToastProvider, useToast, type MenuItem } from "@/components/ui/overlays";
import { useHydrated, useMediaQuery, useT } from "@/lib/hooks";
import { invoicePaper, invoicePapersFor, isInvoicePaper, isLabelPaper, LABEL_PAPERS, labelPaper, LABELS_PER_SHEET, type LabelPaper, type PaperSpec } from "@/lib/print";
import { useStore, type InvoiceTemplate } from "@/lib/store";
import { applyTheme } from "@/lib/theme";
import type { Lang } from "@/lib/types";

export default function InvoicePage() {
  return (
    <ToastProvider>
      <Suspense fallback={<Loading />}>
        <Gate />
      </Suspense>
    </ToastProvider>
  );
}

function Loading() {
  return (
    <div className="grid min-h-dvh place-items-center bg-canvas p-6" aria-busy="true">
      <Skeleton className="h-[70vh] w-full max-w-[560px] rounded-lg" />
    </div>
  );
}

function Gate() {
  const ready = useHydrated();
  return ready ? <InvoiceView /> : <Loading />;
}

function InvoiceView() {
  const t = useT();
  const toast = useToast();
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const theme = useStore((s) => s.theme);
  const uiLang = useStore((s) => s.lang);
  const invoice = useStore((s) => s.invoice);
  const allOrders = useStore((s) => s.orders);
  const logPrint = useStore((s) => s.logPrint);
  const printer = useStore((s) => s.printer);
  const setPrinter = useStore((s) => s.setPrinter);
  const narrow = useMediaQuery("(max-width: 640px)");
  const midWidth = useMediaQuery("(max-width: 1180px)");

  const ids = useMemo(() => decodeURIComponent(params.id ?? "").split(",").filter(Boolean), [params.id]);
  const orders = useMemo(() => ids.map((id) => allOrders.find((o) => o.id === id)).filter((o): o is NonNullable<typeof o> => !!o), [ids, allOrders]);

  const initialTpl = search.get("template");
  const initialLabel = search.get("label");
  const initialCopies = search.get("copies");
  const [doc, setDoc] = useState<"invoice" | "label" | "receipt">(search.get("doc") === "label" ? "label" : search.get("doc") === "receipt" ? "receipt" : "invoice");
  // URL wins (it's what the print chooser picked), then this device's printer, then the shop default.
  const [template, setTemplate] = useState<InvoiceTemplate>(isInvoicePaper(initialTpl) ? initialTpl : (printer.invoice ?? invoice.template));
  const [label, setLabel] = useState<LabelPaper>(isLabelPaper(initialLabel) ? initialLabel : printer.label);
  const [copies, setCopies] = useState<1 | 2>(initialCopies === "2" ? 2 : initialCopies === "1" ? 1 : printer.copies);
  const [lang, setLang] = useState<Lang>(invoice.lang);
  const [busy, setBusy] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const autoPrinted = useRef(false);
  const shareMode = search.get("share") === "1";
  const gate = usePrintGate();
  const claimPrint = gate.claim;

  useEffect(() => applyTheme(theme, uiLang), [theme, uiLang]);

  const opts: DocOptions = { lang, numerals: invoice.numerals, template };
  const spec = doc === "label" ? labelPaper(label) : invoicePaper(doc === "receipt" ? "a5" : template);
  const paper = PAPER[spec.id as InvoiceTemplate | LabelPaper];
  const pageSize = spec.page;
  const tt = (en: string, bn: string) => (lang === "bn" ? bn : en);
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  // QR codes open the customer's live invoice page when signed in (FR-INV-04).
  const customerLinks = useCustomerLinks(orders.map((o) => o.id));

  const doPrint = useCallback(async () => {
    if (!(await claimPrint(orders.map((o) => o.id)))) return;
    logPrint(
      orders.map((o) => o.id),
      doc === "label" ? `Label printed (${spec.en})` : `Invoice printed (${spec.en}${copies === 2 ? " × 2" : ""})`,
    );
    window.print();
  }, [orders, doc, spec.en, copies, logPrint, claimPrint]);

  // print=1 opens the dialog once fonts and QR codes are ready.
  useEffect(() => {
    if (search.get("print") !== "1" || autoPrinted.current || !orders.length) return;
    autoPrinted.current = true;
    const timer = setTimeout(() => {
      document.fonts.ready.then(() => doPrint());
    }, 600);
    return () => clearTimeout(timer);
  }, [search, orders.length, doPrint]);

  const renderPng = async () => {
    const node = sheetRef.current?.querySelector<HTMLElement>(".doc-page");
    if (!node) return null;
    await document.fonts.ready;
    return toPng(node, { pixelRatio: 2, backgroundColor: "#ffffff", cacheBust: true });
  };

  const download = async () => {
    setBusy(true);
    try {
      if (!(await gate.claim(orders.map((o) => o.id)))) return;
      const url = await renderPng();
      if (!url) return;
      const a = document.createElement("a");
      a.href = url;
      a.download = `${orders[0]?.invoiceNo ?? `order-${orders[0]?.no}`}${doc === "label" ? "-label" : ""}.png`;
      a.click();
      toast({ title: t("Image saved", "ছবি সেভ হয়েছে") });
    } catch {
      toast({ title: t("Couldn't create the image", "ছবি তৈরি করা যায়নি"), body: t("Try Print → Save as PDF instead.", "এর বদলে প্রিন্ট → PDF হিসেবে সেভ করুন।"), tone: "warn" });
    } finally {
      setBusy(false);
    }
  };

  const share = async () => {
    setBusy(true);
    try {
      if (!(await gate.claim(orders.map((o) => o.id)))) return;
      const url = await renderPng();
      if (!url) return;
      const blob = await (await fetch(url)).blob();
      const file = new File([blob], `${orders[0]?.invoiceNo ?? "invoice"}.png`, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: orders[0]?.invoiceNo });
      } else {
        const a = document.createElement("a");
        a.href = url;
        a.download = file.name;
        a.click();
        toast({ title: t("Image saved — attach it in Messenger or WhatsApp", "ছবি সেভ হয়েছে — মেসেঞ্জার বা হোয়াটসঅ্যাপে পাঠান"), tone: "info" });
      }
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") toast({ title: t("Couldn't share the image", "ছবি শেয়ার করা যায়নি"), tone: "warn" });
    } finally {
      setBusy(false);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${origin}/invoice/${ids.join(",")}`);
      toast({ title: t("Link copied", "লিংক কপি হয়েছে") });
    } catch {
      toast({ title: t("Couldn't copy the link", "লিংক কপি করা যায়নি"), tone: "warn" });
    }
  };

  if (!orders.length)
    return (
      <div className="grid min-h-dvh place-items-center bg-canvas p-6">
        <EmptyState
          title={t("This invoice isn't on this device", "এই ইনভয়েসটি এই ডিভাইসে নেই")}
          body={t("It may have been deleted, or it was created on another phone that hasn't synced yet.", "হয়তো মুছে ফেলা হয়েছে, অথবা অন্য ফোনে তৈরি হয়ে এখনো সিঙ্ক হয়নি।")}
          action={
            <Link href="/orders" className="inline-flex h-10 items-center rounded-md bg-brand px-4 text-sm font-medium text-brand-contrast">
              {t("Go to orders", "অর্ডারে যান")}
            </Link>
          }
        />
      </div>
    );

  const thermal = doc === "invoice" && template.startsWith("thermal");
  const duo = doc === "invoice" && template === "a4duo";
  const canCopy = doc === "invoice" && !duo && template !== "mushak";
  const copyNames = canCopy && copies === 2 ? [tt("Customer copy", "কাস্টমার কপি"), tt("Shop copy", "দোকানের কপি")] : [undefined];
  // Fit wide paper on smaller screens for the preview only (print uses real size).
  const zoom = narrow || (midWidth && paper.px > 900) ? Math.min(1, (typeof window !== "undefined" ? window.innerWidth - 32 : 360) / paper.px) : 1;
  const accent = invoice.useBrandColor
    ? { "--doc-accent": "var(--brand)", "--doc-accent-contrast": "var(--brand-contrast)", "--doc-accent-ink": "var(--brand-ink)" }
    : { "--doc-accent": "#16181A", "--doc-accent-contrast": "#FFFFFF", "--doc-accent-ink": "#16181A" };
  const urlOf = (id: string) => customerLinks[id] ?? `${origin}/invoice/${id}`;

  type Page = { key: string; kind: "sheet" | "thermal" | "label"; node: React.ReactNode };
  const pages: Page[] =
    doc === "label"
      ? label === "a4sheet"
        ? chunk(orders, LABELS_PER_SHEET).map((group) => ({ key: `sheet-${group[0].id}`, kind: "sheet", node: <LabelSheet orders={group} opts={opts} urlOf={urlOf} /> }))
        : orders.map((o) => ({ key: o.id, kind: "label", node: <ParcelLabel order={o} opts={opts} url={urlOf(o.id)} size={label} /> }))
      : doc === "receipt"
        ? orders.map((o) => ({ key: o.id, kind: "sheet", node: <PaymentReceipt order={o} opts={opts} paymentId={search.get("payment") ?? undefined} /> }))
        : template === "mushak"
          ? orders.map((o) => ({ key: o.id, kind: "sheet", node: <MushakInvoice order={o} opts={opts} /> }))
          : duo
            ? orders.map((o) => ({
                key: o.id,
                kind: "sheet",
                node: (
                  <article className="doc-page relative flex bg-white" style={{ width: paper.w, height: paper.h }}>
                    <MemoInvoice order={o} opts={opts} url={urlOf(o.id)} copy={tt("Customer copy", "কাস্টমার কপি")} bare />
                    <span className="absolute inset-y-[6mm] left-1/2 border-l border-dashed border-[#C9CDC4]" aria-hidden />
                    <MemoInvoice order={o} opts={opts} url={urlOf(o.id)} copy={tt("Shop copy", "দোকানের কপি")} bare />
                  </article>
                ),
              }))
            : orders.flatMap((o) =>
                copyNames.map((c, k) => ({
                  key: `${o.id}-${k}`,
                  kind: thermal ? "thermal" : "sheet",
                  node: thermal ? (
                    // Shadow on the parent, torn-paper mask here, so the shadow follows the teeth.
                    <div className="receipt-edge bg-white pb-3">
                      <div data-escpos>
                        <ThermalReceipt order={o} opts={opts} url={urlOf(o.id)} copy={c} />
                      </div>
                    </div>
                  ) : (
                    <MemoInvoice order={o} opts={opts} url={urlOf(o.id)} copy={c} />
                  ),
                })),
              );

  const devicePaper = doc === "label" ? printer.label : (printer.invoice ?? invoice.template);
  const papers: PaperSpec[] = doc === "label" ? LABEL_PAPERS : invoicePapersFor((invoice.vatPercent ?? 0) > 0 || !!invoice.bin);
  const paperItems: MenuItem[] = [];
  for (const [group, title] of [
    ["roll", t("Receipt printer · POS machine", "রসিদ প্রিন্টার · POS মেশিন")],
    ["label", t("Label printer", "লেবেল প্রিন্টার")],
    ["sheet", t("Office printer", "অফিস প্রিন্টার")],
  ] as const) {
    const list = papers.filter((p) => p.group === group);
    if (!list.length) continue;
    paperItems.push({ type: "label", label: title });
    for (const p of list)
      paperItems.push({
        icon: (
          <span className="grid size-6 place-items-center">
            <PaperGlyph spec={p} fit={20} active={p.id === spec.id} />
          </span>
        ),
        label: <span className={p.id === spec.id ? "font-semibold text-brand-ink" : undefined}>{t(p.en, p.bn)}</span>,
        hint: t(p.hintEn, p.hintBn),
        onSelect: () => (doc === "label" ? setLabel(p.id as LabelPaper) : setTemplate(p.id as InvoiceTemplate)),
      });
  }
  if (doc !== "receipt" && spec.id !== devicePaper)
    paperItems.push(
      { type: "divider" },
      {
        icon: <PushPin />,
        label: t(`Always use ${spec.en} on this device`, `এই ডিভাইসে সবসময় ${spec.bn}`),
        onSelect: () => {
          setPrinter(doc === "label" ? { label } : { invoice: template, copies });
          toast({ title: t(`This device now prints on ${spec.en}`, `এই ডিভাইস এখন ${spec.bn}-এ প্রিন্ট করবে`) });
        },
      },
    );

  const count = doc === "label" ? t(`${orders.length} labels`, `${orders.length}টি লেবেল`) : t(`${orders.length} invoices`, `${orders.length}টি ইনভয়েস`);
  const tip =
    doc === "label"
      ? label === "a4sheet"
        ? t("Prints 8 labels on each A4 page. Use A4 sticker paper, or plain paper and cut along the dashed lines.", "প্রতি A4 পাতায় ৮টি লেবেল। A4 স্টিকার পেপার দিন, অথবা সাধারণ কাগজে ছেপে দাগ বরাবর কাটুন।")
        : t(`Prints at ${spec.en}. Pick your label printer and set margins to none.`, `${spec.bn} মাপে প্রিন্ট হবে। লেবেল প্রিন্টার বেছে নিন এবং মার্জিন 'none' দিন।`)
      : thermal
        ? t("For POS printers: choose the printer, the paper width, and margins: none.", "POS প্রিন্টারে: প্রিন্টার ও কাগজের মাপ বেছে নিন, মার্জিন 'none' দিন।")
        : duo
          ? t("Both copies print side by side on one A4 page in landscape. Cut along the dashed line.", "দুই কপি এক A4 পাতায় পাশাপাশি (landscape) প্রিন্ট হবে। মাঝের দাগ বরাবর কাটুন।")
          : t("Tip: choose “Save as PDF” in the print dialog to send a PDF.", "টিপ: PDF পাঠাতে প্রিন্ট ডায়ালগে “Save as PDF” বেছে নিন।");

  return (
    <div className="min-h-dvh bg-canvas print:bg-white" style={accent as React.CSSProperties}>
      <style>{`@page { size: ${pageSize}; margin: 0; } @media print { .doc-page { box-shadow: none !important; break-after: page; zoom: 1 !important; } .doc-stack { gap: 0 !important; padding: 0 !important; } .receipt-edge { mask: none !important; -webkit-mask: none !important; } }`}</style>

      <header className="no-print sticky top-0 z-20 border-b border-line bg-canvas/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1100px] flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
          <Link href="/orders" className="grid size-9 place-items-center rounded-full text-ink-2 hover:bg-sunken" aria-label={t("Back to orders", "অর্ডারে ফিরে যান")}>
            <ArrowLeft className="size-5" />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-[17px] font-semibold text-ink">
              {orders.length > 1
                ? count
                : `${doc === "label" ? t("Label", "লেবেল") : t("Invoice", "ইনভয়েস")} ${orders[0].invoiceNo ?? `#${orders[0].no}`}`}
            </p>
            <p className="truncate text-xs text-ink-3">{orders.length === 1 ? (orders[0].customer?.name ?? t("Walk-in customer", "দোকানের কাস্টমার")) : doc === "label" && label === "a4sheet" ? t(`8 per A4 page · ${Math.ceil(orders.length / LABELS_PER_SHEET)} pages`, `প্রতি A4 পাতায় ৮টি · ${Math.ceil(orders.length / LABELS_PER_SHEET)} পাতা`) : t("One per page", "প্রতি পাতায় একটি")}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" icon={<LinkSimple className="size-4" />} onClick={copyLink} aria-label={t("Copy link", "লিংক কপি")}>
              <span className="hidden sm:inline">{t("Copy link", "লিংক কপি")}</span>
            </Button>
            <Button variant={shareMode ? "primary" : "secondary"} size="sm" icon={<ShareNetwork className="size-4" />} onClick={share} disabled={busy || orders.length > 1}>
              {t("Share", "শেয়ার")}
            </Button>
            <Button variant="secondary" size="sm" icon={<DownloadSimple className="size-4" />} onClick={download} disabled={busy || orders.length > 1} aria-label={t("Download image", "ছবি ডাউনলোড")}>
              <span className="hidden sm:inline">PNG</span>
            </Button>
            {doc === "invoice" && template.startsWith("thermal") && (
              <ThermalPrintButton
                paper={template as "thermal58" | "thermal80"}
                getElements={() => [...(sheetRef.current?.querySelectorAll<HTMLElement>("[data-escpos]") ?? [])]}
                beforePrint={() => gate.claim(orders.map((o) => o.id))}
                onPrinted={() => logPrint(orders.map((o) => o.id), `Printed on Bluetooth thermal (${template})`)}
              />
            )}
            <Button variant={shareMode ? "secondary" : "primary"} size="sm" icon={<Printer className="size-4" />} onClick={doPrint}>
              {t("Print", "প্রিন্ট")}
            </Button>
          </div>
        </div>
        <div className="mx-auto flex max-w-[1100px] flex-wrap items-center gap-2 px-4 pb-3">
          <Segmented
            size="sm"
            value={doc}
            onChange={setDoc}
            ariaLabel={t("Document", "ডকুমেন্ট")}
            options={[
              { value: "invoice", label: t("Invoice", "ইনভয়েস") },
              { value: "label", label: t("Parcel label", "পার্সেল লেবেল") },
              ...(orders.length === 1 && orders[0].payments.some((p) => p.amount > 0) ? [{ value: "receipt" as const, label: t("Payment receipt", "টাকার রসিদ") }] : []),
            ]}
          />
          {doc !== "receipt" && (
            <Menu
              width={330}
              align="start"
              items={paperItems}
              trigger={({ toggle, ref, open }) => (
                <button
                  ref={ref}
                  type="button"
                  onClick={toggle}
                  aria-haspopup="menu"
                  aria-expanded={open}
                  aria-label={t(`Paper: ${spec.en}`, `কাগজ: ${spec.bn}`)}
                  className="inline-flex h-8 items-center gap-2 rounded-md border border-line bg-surface pl-1.5 pr-2.5 text-[13px] font-medium text-ink shadow-1 transition-colors hover:border-line-strong"
                >
                  <span className="grid size-6 place-items-center">
                    <PaperGlyph spec={spec} fit={20} active />
                  </span>
                  {t(spec.en, spec.bn)}
                  <span className="hidden text-ink-3 sm:inline">· {t(spec.hintEn, spec.hintBn)}</span>
                  <CaretDown className="size-3.5 text-ink-3" />
                </button>
              )}
            />
          )}
          {canCopy && (
            <Segmented<"1" | "2">
              size="sm"
              value={String(copies) as "1" | "2"}
              onChange={(v) => setCopies(v === "2" ? 2 : 1)}
              ariaLabel={t("Copies", "কপি")}
              options={[
                { value: "1", label: t("1 copy", "১ কপি") },
                { value: "2", label: t("+ Shop copy", "+ দোকানের কপি") },
              ]}
            />
          )}
          <Segmented
            size="sm"
            value={lang}
            onChange={setLang}
            ariaLabel={t("Invoice language", "ইনভয়েসের ভাষা")}
            options={[
              { value: "en", label: "English" },
              { value: "bn", label: "বাংলা" },
            ]}
            className="ml-auto"
          />
        </div>
      </header>

      <main ref={sheetRef} data-print-gated className="doc-stack flex flex-col items-center gap-8 px-4 py-8 print:p-0">
        {pages.map((p) => (
          <div
            key={p.key}
            className={cn(
              "shrink-0 print:shadow-none print:filter-none",
              p.kind === "thermal" ? "drop-shadow-[0_10px_16px_rgb(22_24_26/0.14)]" : "shadow-[0_1px_2px_rgb(22_24_26/0.06),0_18px_44px_-14px_rgb(22_24_26/0.22)]",
              p.kind === "label" && "rounded-[6px] outline outline-1 outline-line-strong print:outline-0",
            )}
            style={{ zoom } as React.CSSProperties}
          >
            {p.node}
          </div>
        ))}
        <p className="no-print max-w-md text-center text-xs text-ink-3">
          {tip}
          {gate.note && <span className="mt-1 block font-medium text-cash-ink">{gate.note}</span>}
        </p>
      </main>
      {gate.ui}
    </div>
  );
}

function chunk<T>(list: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}
