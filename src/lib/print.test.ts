import { describe, expect, it } from "vitest";
import { INVOICE_PAPERS, invoicePapersFor, isInvoicePaper, isLabelPaper, LABEL_PAPERS, printHref } from "./print";

describe("print papers", () => {
  it("builds invoice links with paper and copies", () => {
    expect(printHref(["o1"], { doc: "invoice", invoice: "thermal80", copies: 2, print: true })).toBe("/invoice/o1?template=thermal80&copies=2&print=1");
    expect(printHref(["o1", "o2"], { doc: "invoice" })).toBe("/invoice/o1,o2");
  });

  it("never asks for extra copies on the two-up A4 (it already has both)", () => {
    expect(printHref(["o1"], { doc: "invoice", invoice: "a4duo", copies: 2 })).toBe("/invoice/o1?template=a4duo");
  });

  it("builds label links with the label size", () => {
    expect(printHref(["o1"], { doc: "label", label: "a4sheet", invoice: "a4", copies: 2 })).toBe("/invoice/o1?doc=label&label=a4sheet");
  });

  it("only offers the Mushak VAT invoice to VAT-registered shops", () => {
    expect(invoicePapersFor(false).some((p) => p.id === "mushak")).toBe(false);
    expect(invoicePapersFor(true)).toHaveLength(INVOICE_PAPERS.length);
  });

  it("rejects unknown paper ids from the URL", () => {
    expect(isInvoicePaper("thermal58")).toBe(true);
    expect(isInvoicePaper("a3")).toBe(false);
    expect(isLabelPaper("l100x150")).toBe(true);
    expect(isLabelPaper(null)).toBe(false);
    expect(new Set(LABEL_PAPERS.map((p) => p.id)).size).toBe(LABEL_PAPERS.length);
  });
});
