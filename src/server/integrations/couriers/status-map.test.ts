/**
 * Each courier's status words → our CourierStatus, and webhook bodies →
 * events. Values come from RedX's public docs, Pathao's own WooCommerce
 * plugin, and open-source Paperfly and Carrybee integrations.
 */
import { describe, expect, it } from "vitest";
import { carrybee, mapCarrybee } from "./carrybee";
import { mapPaperfly, paperfly } from "./paperfly";
import { mapPathao, pathao } from "./pathao";
import { mapRedx } from "./redx";

const parse = (a: { parseWebhook: (b: unknown, h: Headers, c: Record<string, string>) => unknown }, body: unknown) => a.parseWebhook(body, new Headers(), {});

describe("courier status mapping", () => {
  it("Pathao: every spelling of a status lands in the same place", () => {
    for (const s of ["Pickup_Requested", "pickup-requested", "Pickup Requested"]) expect(mapPathao(s)).toBe("booked");
    expect(mapPathao("created")).toBe("booked");
    expect(mapPathao("Delivery_Failed")).toBe("returned");
    expect(mapPathao("pickup-cancelled")).toBe("returned");
    expect(mapPathao("returned-to-merchant")).toBe("returned");
    expect(mapPathao("partial-delivery")).toBe("partial");
    expect(mapPathao("in-transit")).toBe("in_transit");
  });

  it("payment events after delivery never reopen a parcel", () => {
    expect(mapPathao("paid")).toBe("delivered");
    expect(mapPathao("Payment_Invoice")).toBe("delivered");
    expect(mapPathao("exchanged")).toBe("delivered");
    expect(mapRedx("paid")).toBe("delivered");
    expect(mapPaperfly("invoiced")).toBe("delivered");
    expect(mapCarrybee("paid")).toBe("delivered");
  });

  it("Paperfly: 'assigned for delivery' is still on the way", () => {
    expect(mapPaperfly("assigned_for_delivery")).toBe("in_transit");
    expect(mapPaperfly("delivered")).toBe("delivered");
    expect(mapPaperfly("return_to_merchant")).toBe("returned");
    expect(mapPaperfly("created")).toBe("booked");
  });

  it("Carrybee: snake_case slugs", () => {
    expect(mapCarrybee("pickup_requested")).toBe("booked");
    expect(mapCarrybee("delivery_on_hold")).toBe("hold");
    expect(mapCarrybee("delivery_failed")).toBe("returned");
    expect(mapCarrybee("partial_delivery")).toBe("partial");
  });
});

describe("courier webhook bodies", () => {
  it("Pathao: reads hyphenated events, ignores the handshake and order.updated", () => {
    expect(parse(pathao, { event: "order.delivered", consignment_id: "DL1" })).toEqual({ consignmentId: "DL1", status: "delivered", raw: "delivered" });
    expect(parse(pathao, { event: "webhook_integration" })).toBeNull();
    expect(parse(pathao, { event: "order.updated", consignment_id: "DL1" })).toBeNull();
  });

  it("Paperfly: event + data.order_number", () => {
    expect(parse(paperfly, { event: "parcel.return_to_merchant", data: { order_number: "PF9" } })).toEqual({ consignmentId: "PF9", status: "returned", raw: "return to merchant" });
  });

  it("Carrybee: order.* events", () => {
    expect(parse(carrybee, { event: "order.delivered", consignment_id: "CB7" })).toEqual({ consignmentId: "CB7", status: "delivered", raw: "delivered" });
  });
});
