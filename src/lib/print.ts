import type { InvoiceTemplate } from "./state";

/** Parcel label stock. `a4sheet` is 8 labels on plain or sticker A4 for shops without a label printer. */
export type LabelPaper = "l100x75" | "l100x150" | "l75x50" | "a4sheet";

/** What this device's printers take. Lives on the device only: the counter PC and the owner's laptop differ. */
export interface PrinterPrefs {
  /** Undefined follows the shop's default invoice paper. */
  invoice?: InvoiceTemplate;
  label: LabelPaper;
  copies: 1 | 2;
  /** Show the paper chooser every time instead of printing straight away. */
  ask: boolean;
}

export const DEFAULT_PRINTER: PrinterPrefs = { label: "l100x75", copies: 1, ask: false };

export type PaperGroup = "roll" | "sheet" | "label";

export interface PaperSpec<T extends string = string> {
  id: T;
  group: PaperGroup;
  en: string;
  bn: string;
  hintEn: string;
  hintBn: string;
  /** Physical size in mm; rolls have no fixed height. */
  w: number;
  h?: number;
  /** CSS `@page size`. */
  page: string;
}

export const INVOICE_PAPERS: PaperSpec<InvoiceTemplate>[] = [
  { id: "thermal58", group: "roll", en: "58 mm roll", bn: "৫৮ মিমি রোল", hintEn: "Small POS printer", hintBn: "ছোট POS প্রিন্টার", w: 58, page: "58mm auto" },
  { id: "thermal80", group: "roll", en: "80 mm roll", bn: "৮০ মিমি রোল", hintEn: "Standard POS printer", hintBn: "সাধারণ POS প্রিন্টার", w: 80, page: "80mm auto" },
  { id: "a5", group: "sheet", en: "A5 memo", bn: "A5 মেমো", hintEn: "Half an A4 page", hintBn: "A4-এর অর্ধেক", w: 148, h: 210, page: "A5" },
  { id: "a4", group: "sheet", en: "A4", bn: "A4", hintEn: "Office printer", hintBn: "অফিস প্রিন্টার", w: 210, h: 297, page: "A4" },
  { id: "a4duo", group: "sheet", en: "A4 · 2 copies", bn: "A4 · ২ কপি", hintEn: "Customer + shop copy", hintBn: "কাস্টমার + দোকানের কপি", w: 297, h: 210, page: "A4 landscape" },
  { id: "letter", group: "sheet", en: "Letter", bn: "লেটার", hintEn: "8.5 × 11 inch", hintBn: "৮.৫ × ১১ ইঞ্চি", w: 216, h: 279, page: "letter" },
  { id: "mushak", group: "sheet", en: "Mushak-6.3", bn: "মূসক-৬.৩", hintEn: "VAT invoice on A4", hintBn: "A4-এ ভ্যাট চালান", w: 210, h: 297, page: "A4" },
];

export const LABEL_PAPERS: PaperSpec<LabelPaper>[] = [
  { id: "l100x75", group: "label", en: "100 × 75 mm", bn: "১০০ × ৭৫ মিমি", hintEn: "Most label printers", hintBn: "বেশিরভাগ লেবেল প্রিন্টার", w: 100, h: 75, page: "100mm 75mm" },
  { id: "l100x150", group: "label", en: "4 × 6 inch", bn: "৪ × ৬ ইঞ্চি", hintEn: "Courier-size, with packing list", hintBn: "কুরিয়ার সাইজ, পণ্যের তালিকাসহ", w: 100, h: 150, page: "100mm 150mm" },
  { id: "l75x50", group: "label", en: "75 × 50 mm", bn: "৭৫ × ৫০ মিমি", hintEn: "Small stickers", hintBn: "ছোট স্টিকার", w: 75, h: 50, page: "75mm 50mm" },
  { id: "a4sheet", group: "sheet", en: "A4 · 8 labels", bn: "A4 · ৮টি লেবেল", hintEn: "Any printer, sticker or plain paper", hintBn: "যেকোনো প্রিন্টার, স্টিকার বা সাধারণ কাগজ", w: 210, h: 297, page: "A4" },
];

/** Labels per A4 sheet (2 × 4 grid of 105 × 74.25 mm). */
export const LABELS_PER_SHEET = 8;

export const invoicePaper = (id: InvoiceTemplate) => INVOICE_PAPERS.find((p) => p.id === id) ?? INVOICE_PAPERS[2];
export const labelPaper = (id: LabelPaper) => LABEL_PAPERS.find((p) => p.id === id) ?? LABEL_PAPERS[0];
export const isInvoicePaper = (v: string | null): v is InvoiceTemplate => INVOICE_PAPERS.some((p) => p.id === v);
export const isLabelPaper = (v: string | null): v is LabelPaper => LABEL_PAPERS.some((p) => p.id === v);

/** Invoice papers worth offering: Mushak only for VAT-registered shops. */
export function invoicePapersFor(vatRegistered: boolean) {
  return INVOICE_PAPERS.filter((p) => p.id !== "mushak" || vatRegistered);
}

export type PrintDoc = "invoice" | "label";

/** URL of the print page for these orders on this paper. */
export function printHref(ids: string[], o: { doc: PrintDoc; invoice?: InvoiceTemplate; label?: LabelPaper; copies?: 1 | 2; print?: boolean }) {
  const q = new URLSearchParams();
  if (o.doc === "label") {
    q.set("doc", "label");
    if (o.label) q.set("label", o.label);
  } else {
    if (o.invoice) q.set("template", o.invoice);
    if (o.copies && o.invoice !== "a4duo") q.set("copies", String(o.copies));
  }
  if (o.print) q.set("print", "1");
  const s = q.toString();
  return `/invoice/${ids.join(",")}${s ? `?${s}` : ""}`;
}
