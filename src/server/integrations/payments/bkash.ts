import "server-only";
/**
 * bKash Tokenized Checkout (v1.2.0-beta).
 * grant token → create payment (redirect buyer to bkashURL) → bKash
 * redirects to our callback with paymentID & status → execute → verify.
 * BKASH_BASE_URL defaults to the sandbox; set it to
 * https://tokenized.pay.bka.sh/v1.2.0-beta for live.
 */
import { jsonCall, type PayAdapter, type PayCreds } from "./types";

const BASE = process.env.BKASH_BASE_URL ?? "https://tokenized.sandbox.bka.sh/v1.2.0-beta";
const grants = new Map<string, { token: string; until: number }>();

async function grant(c: PayCreds) {
  const hit = grants.get(c.appKey);
  if (hit && hit.until > Date.now()) return hit.token;
  const r = await jsonCall<{ id_token: string; expires_in: number; statusCode?: string; statusMessage?: string }>(`${BASE}/tokenized/checkout/token/grant`, {
    method: "POST",
    headers: { username: c.username, password: c.password },
    body: JSON.stringify({ app_key: c.appKey, app_secret: c.appSecret }),
  });
  if (!r.id_token) throw new Error(r.statusMessage ?? "bKash refused the credentials");
  grants.set(c.appKey, { token: r.id_token, until: Date.now() + (r.expires_in - 120) * 1000 });
  return r.id_token;
}

const authHeaders = async (c: PayCreds) => ({ authorization: await grant(c), "x-app-key": c.appKey });

export const bkash: PayAdapter = {
  provider: "bkash",
  fields: [
    { key: "username", en: "Username", bn: "ইউজারনেম" },
    { key: "password", en: "Password", bn: "পাসওয়ার্ড", secret: true },
    { key: "appKey", en: "App key", bn: "অ্যাপ কী" },
    { key: "appSecret", en: "App secret", bn: "অ্যাপ সিক্রেট", secret: true },
  ],
  async test(c) {
    await grant(c);
  },
  async start(c, p) {
    const r = await jsonCall<{ paymentID?: string; bkashURL?: string; statusMessage?: string }>(`${BASE}/tokenized/checkout/create`, {
      method: "POST",
      headers: await authHeaders(c),
      body: JSON.stringify({ mode: "0011", payerReference: p.payerReference, callbackURL: p.callbackUrl, amount: p.amount.toFixed(2), currency: "BDT", intent: "sale", merchantInvoiceNumber: p.reference.slice(0, 255) }),
    });
    if (!r.paymentID || !r.bkashURL) throw new Error(r.statusMessage ?? "bKash couldn't start the payment");
    return { redirectUrl: r.bkashURL, providerRef: r.paymentID };
  },
  async verify(c, params, link) {
    const paymentID = params.get("paymentID");
    if (!paymentID || paymentID !== link.providerRef) return { ok: false, amount: 0, message: "Payment reference doesn't match" };
    if (params.get("status") !== "success") return { ok: false, amount: 0, message: params.get("status") === "cancel" ? "Payment was cancelled" : "Payment failed" };
    const exec = await jsonCall<{ transactionStatus?: string; trxID?: string; amount?: string; statusMessage?: string }>(`${BASE}/tokenized/checkout/execute`, {
      method: "POST",
      headers: await authHeaders(c),
      body: JSON.stringify({ paymentID }),
    }).catch(async () =>
      // Execute can time out after succeeding; query status instead of failing.
      jsonCall<{ transactionStatus?: string; trxID?: string; amount?: string; statusMessage?: string }>(`${BASE}/tokenized/checkout/payment/status`, { method: "POST", headers: await authHeaders(c), body: JSON.stringify({ paymentID }) }),
    );
    const ok = exec.transactionStatus === "Completed" && Number(exec.amount) >= link.amount - 0.01;
    return { ok, amount: Number(exec.amount ?? 0), trxId: exec.trxID, providerRef: paymentID, message: ok ? undefined : exec.statusMessage ?? "Payment not completed" };
  },
};
