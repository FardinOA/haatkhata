import { describe, expect, it } from "vitest";
import type { Order } from "@/lib/types";
import { detect, matchRows, parseCsv, summarize } from "./payout-match";
import { scoreRisk } from "./risk-score";
import { sandboxBook, sandboxStatus, scoreCouriers } from "./courier-meta";

function order(no: number, cod: number, patch: Partial<Order> = {}): Order {
  return {
    id: `o${no}`,
    no,
    invoiceNo: `INV-2026-${String(no).padStart(6, "0")}`,
    channel: "facebook",
    customer: { name: "A", phone: `01711${String(no).padStart(6, "0")}`, address: { line: "x", area: "Mirpur", district: "Dhaka" } },
    lines: [{ id: "l", productId: "p", variantId: "v", name: "Bag", variantLabel: "", sku: "B", qty: 1, price: cod - 70, discount: 0, cost: 100, returnedQty: 0 }],
    discount: { type: "flat", value: 0 },
    deliveryCharge: 70,
    otherCharges: 0,
    payments: [],
    settlement: "cod",
    status: "delivered",
    courier: { name: "Steadfast", tracking: `TR${no}`, consignmentId: `${9000 + no}`, provider: "steadfast" },
    events: [],
    returns: [],
    createdAt: "2026-10-20T10:00:00Z",
    createdBy: "x",
    ...patch,
  };
}

describe("payout import", () => {
  it("parses quoted CSV with BOM and detects the Steadfast layout", () => {
    const rows = parseCsv('﻿Consignment ID,Invoice,"Recipient Phone",COD Amount,Delivery Charge,Payable Amount\r\n9001,INV-2026-000001,01711000001,"1,070",60,1010\n');
    expect(rows).toHaveLength(2);
    expect(rows[1][3]).toBe("1,070");
    const d = detect(rows[0]);
    expect(d.layout).toBe("steadfast");
    expect(d.mapping).toMatchObject({ consignment: 0, invoice: 1, phone: 2, collected: 3, fee: 4, payout: 5 });
  });

  it("matches by consignment, invoice and phone+amount, and flags short or unknown rows", () => {
    const orders = [order(1, 1070), order(2, 520), order(3, 900), order(4, 300, { codReceived: { at: "2026-10-25T00:00:00Z" } }), order(5, 800, { status: "shipped" })];
    const csv = [
      ["Consignment ID", "Invoice", "Recipient Phone", "COD Amount"],
      ["9001", "", "", "1070"], // consignment
      ["", "INV-2026-000002", "", "500"], // invoice, short by 20
      ["", "", "01711000003", "900"], // phone + amount
      ["9004", "", "", "300"], // already received
      ["9005", "", "", "800"], // not delivered yet
      ["7777", "", "", "100"], // unknown
    ];
    const { mapping } = detect(csv[0]);
    const m = matchRows(csv.slice(1), mapping, orders);
    expect(m.map((r) => [r.order?.no ?? null, r.kind, r.via])).toEqual([
      [1, "matched", "consignment"],
      [2, "short", "invoice"],
      [3, "matched", "phone"],
      [4, "already", "consignment"],
      [5, "not_delivered", "consignment"],
      [null, "unmatched", null],
    ]);
    expect(summarize(m)).toMatchObject({ matched: 2, short: 1, shortBy: 20, unmatched: 1 });
  });
});

describe("risk score", () => {
  it("needs a pattern, not one bad day", () => {
    expect(scoreRisk({ delivered: 0, returned: 0, cancelled: 0 }, null).level).toBe("new");
    expect(scoreRisk({ delivered: 5, returned: 1, cancelled: 0 }, null).level).toBe("trusted");
    expect(scoreRisk({ delivered: 0, returned: 2, cancelled: 0 }, null)).toMatchObject({ level: "risky", askAdvance: true });
    expect(scoreRisk({ delivered: 3, returned: 0, cancelled: 0 }, null, true).level).toBe("risky");
  });
});

describe("couriers", () => {
  it("sandbox parcels progress deterministically", () => {
    const t0 = Date.UTC(2026, 10, 2, 10);
    const b = sandboxBook("o_123", 520, "Dhaka", t0);
    expect(b.fee).toBe(60);
    expect(sandboxStatus(b.consignmentId, t0 + 10_000)).toBe("booked");
    expect(sandboxStatus(b.consignmentId, t0 + 120_000)).toBe("in_transit");
    expect(["delivered", "returned"]).toContain(sandboxStatus(b.consignmentId, t0 + 600_000));
  });

  it("ranks couriers by success in the district, then by fee", () => {
    const mk = (no: number, name: string, status: Order["status"], fee: number) => order(no, 500, { status, courier: { name, fee } });
    const orders = [mk(1, "Steadfast", "delivered", 60), mk(2, "Steadfast", "delivered", 60), mk(3, "Steadfast", "returned", 60), mk(4, "Pathao", "delivered", 70), mk(5, "Pathao", "delivered", 70), mk(6, "Pathao", "delivered", 70)];
    const s = scoreCouriers(orders, "Dhaka", ["steadfast", "pathao", "redx"]);
    expect(s.map((x) => x.provider)).toEqual(["pathao", "steadfast", "redx"]);
    expect(s[0]).toMatchObject({ successRate: 1, avgFee: 70, source: "yours" });
    expect(s[2].successRate).toBeNull();
  });
});
