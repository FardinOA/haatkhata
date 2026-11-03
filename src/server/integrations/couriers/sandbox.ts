import "server-only";
/** Test courier: books instantly and progresses on its own, no keys needed. */
import { sandboxBook, sandboxStatus, type CourierStatus } from "@/components/couriers/courier-meta";
import type { CourierAdapter } from "./types";

const VALID: CourierStatus[] = ["booked", "in_transit", "hold", "delivered", "partial", "returned", "cancelled"];

export const sandbox: CourierAdapter = {
  provider: "sandbox",
  async test() {},
  async create(_c, r) {
    const b = sandboxBook(r.orderId, r.codAmount, r.district);
    return { consignmentId: b.consignmentId, trackingCode: b.trackingCode, fee: b.fee };
  },
  async status(_c, id) {
    const s = sandboxStatus(id);
    return { status: s, raw: `sandbox:${s}` };
  },
  async cancel() {},
  parseWebhook(body) {
    // Lets you simulate a courier callback: { consignment_id, status }.
    const b = body as { consignment_id?: string; status?: CourierStatus };
    if (!b.consignment_id || !b.status || !VALID.includes(b.status)) return null;
    return { consignmentId: b.consignment_id, status: b.status, raw: `sandbox:${b.status}` };
  },
};
