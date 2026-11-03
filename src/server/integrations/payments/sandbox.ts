import "server-only";
/** Test payments: the pay page shows Approve / Decline instead of a wallet. */
import type { PayAdapter } from "./types";

export const sandboxPay: PayAdapter = {
  provider: "sandbox",
  fields: [],
  async test() {},
  async start(_c, p) {
    return { redirectUrl: `/pay/${p.token}?sandbox=1`, providerRef: `SBP${p.token.slice(0, 10)}` };
  },
  async verify(_c, params, link) {
    if (params.get("outcome") !== "approve") return { ok: false, amount: 0, message: "Payment was declined" };
    return { ok: true, amount: link.amount, trxId: `TEST${Date.now().toString(36).toUpperCase()}`, providerRef: link.providerRef ?? undefined };
  },
};
