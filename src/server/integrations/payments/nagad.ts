import "server-only";
/**
 * Nagad Online Payment API (check-out, v-0.2.0).
 * Request data is encrypted with Nagad's public key and signed with the
 * merchant private key (RSA, SHA256withRSA); Nagad's responses are
 * encrypted to the merchant key. NAGAD_BASE_URL defaults to the sandbox.
 * TODO(nagad): confirm the client IP header and callback parameters against
 * the integration kit Nagad issues with your merchant account.
 */
import { constants, createSign, privateDecrypt, publicEncrypt } from "node:crypto";
import { jsonCall, type PayAdapter, type PayCreds } from "./types";

const BASE = process.env.NAGAD_BASE_URL ?? "http://sandbox.mynagad.com:10080/remote-payment-gateway-1.0/api/dfs";

const pem = (key: string, kind: "PUBLIC" | "PRIVATE") => (key.includes("BEGIN") ? key : `-----BEGIN ${kind} KEY-----\n${key.replace(/\s+/g, "").match(/.{1,64}/g)?.join("\n")}\n-----END ${kind} KEY-----`);
const encrypt = (c: PayCreds, data: object) => publicEncrypt({ key: pem(c.nagadPublicKey, "PUBLIC"), padding: constants.RSA_PKCS1_PADDING }, Buffer.from(JSON.stringify(data))).toString("base64");
const sign = (c: PayCreds, data: object) => createSign("SHA256").update(JSON.stringify(data)).sign(pem(c.merchantPrivateKey, "PRIVATE"), "base64");
const decrypt = (c: PayCreds, b64: string) => JSON.parse(privateDecrypt({ key: pem(c.merchantPrivateKey, "PRIVATE"), padding: constants.RSA_PKCS1_PADDING }, Buffer.from(b64, "base64")).toString("utf8"));

const stamp = () => new Date(Date.now() + 6 * 3_600_000).toISOString().replace(/[-:T]/g, "").slice(0, 14); // Asia/Dhaka
const headers = { "X-KM-Api-Version": "v-0.2.0", "X-KM-Client-Type": "PC_WEB", "X-KM-IP-V4": "127.0.0.1" };

export const nagad: PayAdapter = {
  provider: "nagad",
  fields: [
    { key: "merchantId", en: "Merchant ID", bn: "মার্চেন্ট আইডি" },
    { key: "merchantNumber", en: "Merchant wallet number", bn: "মার্চেন্ট নম্বর" },
    { key: "merchantPrivateKey", en: "Merchant private key", bn: "মার্চেন্ট প্রাইভেট কী", secret: true, multiline: true },
    { key: "nagadPublicKey", en: "Nagad public key", bn: "নগদ পাবলিক কী", multiline: true },
  ],
  async test(c) {
    for (const k of ["merchantId", "merchantPrivateKey", "nagadPublicKey"]) if (!c[k]) throw new Error(`Missing ${k}`);
    encrypt(c, { probe: 1 });
    sign(c, { probe: 1 });
  },
  async start(c, p) {
    const orderId = p.token.replace(/[^A-Za-z0-9]/g, "").slice(0, 20);
    const datetime = stamp();
    const sensitive = { merchantId: c.merchantId, datetime, orderId, challenge: p.token.slice(0, 40) };
    const init = await jsonCall<{ sensitiveData: string; signature: string }>(`${BASE}/check-out/initialize/${c.merchantId}/${orderId}?locale=EN`, {
      method: "POST",
      headers,
      body: JSON.stringify({ accountNumber: c.merchantNumber, dateTime: datetime, sensitiveData: encrypt(c, sensitive), signature: sign(c, sensitive) }),
    });
    const { paymentReferenceId, challenge } = decrypt(c, init.sensitiveData) as { paymentReferenceId: string; challenge: string };
    const order = { merchantId: c.merchantId, orderId, currencyCode: "050", amount: p.amount.toFixed(2), challenge };
    const done = await jsonCall<{ status: string; callBackUrl?: string; message?: string }>(`${BASE}/check-out/complete/${paymentReferenceId}`, {
      method: "POST",
      headers,
      body: JSON.stringify({ sensitiveData: encrypt(c, order), signature: sign(c, order), merchantCallbackURL: p.callbackUrl, additionalMerchantInfo: { reference: p.reference } }),
    });
    if (done.status !== "Success" || !done.callBackUrl) throw new Error(done.message ?? "Nagad couldn't start the payment");
    return { redirectUrl: done.callBackUrl, providerRef: paymentReferenceId };
  },
  async verify(_c, params, link) {
    const ref = params.get("payment_ref_id");
    if (!ref || params.get("status") !== "Success") return { ok: false, amount: 0, message: params.get("message") ?? "Payment failed" };
    const v = await jsonCall<{ status: string; amount: string; issuerPaymentRefNo?: string; paymentRefId?: string }>(`${BASE}/verify/payment/${encodeURIComponent(ref)}`, { method: "GET", headers });
    const ok = v.status === "Success" && Number(v.amount) >= link.amount - 0.01 && (!link.providerRef || link.providerRef === ref);
    return { ok, amount: Number(v.amount), trxId: v.issuerPaymentRefNo, providerRef: ref, message: ok ? undefined : "Nagad couldn't confirm this payment" };
  },
};
