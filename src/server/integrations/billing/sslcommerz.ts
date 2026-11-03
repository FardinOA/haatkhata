import "server-only";
/**
 * SSLCommerz (cards, bKash, Nagad, Rocket, net banking) — Session API v4,
 * IPN hash validation and the Order Validation API.
 * Env: SSLCOMMERZ_STORE_ID, SSLCOMMERZ_STORE_PASSWORD, SSLCOMMERZ_LIVE=true|false
 */
import { createHash } from "node:crypto";
import { GatewayError, type Gateway } from "./types";

const base = () => (process.env.SSLCOMMERZ_LIVE === "true" ? "https://securepay.sslcommerz.com" : "https://sandbox.sslcommerz.com");
export const sslcommerzConfigured = () => !!(process.env.SSLCOMMERZ_STORE_ID && process.env.SSLCOMMERZ_STORE_PASSWORD);

export const sslcommerzGateway: Gateway = {
  id: "sslcommerz",
  async create(req) {
    const form = new URLSearchParams({
      store_id: process.env.SSLCOMMERZ_STORE_ID!,
      store_passwd: process.env.SSLCOMMERZ_STORE_PASSWORD!,
      total_amount: req.amount.toFixed(2),
      currency: "BDT",
      tran_id: req.paymentId,
      success_url: req.urls.success,
      fail_url: req.urls.fail,
      cancel_url: req.urls.cancel,
      ipn_url: req.urls.ipn,
      cus_name: req.customer.name || "BechaKena customer",
      cus_email: req.customer.email || "billing@bechakena.app",
      cus_phone: req.customer.phone,
      cus_add1: "Dhaka",
      cus_city: "Dhaka",
      cus_country: "Bangladesh",
      shipping_method: "NO",
      num_of_item: "1",
      product_name: req.description.slice(0, 250),
      product_category: "Software subscription",
      product_profile: "non-physical-goods",
    });
    const res = await fetch(`${base()}/gwprocess/v4/api.php`, { method: "POST", body: form });
    const body = (await res.json().catch(() => ({}))) as { status?: string; GatewayPageURL?: string; sessionkey?: string; failedreason?: string };
    if (body.status !== "SUCCESS" || !body.GatewayPageURL) throw new GatewayError(body.failedreason ?? "SSLCommerz didn't start the payment");
    return { redirectUrl: body.GatewayPageURL, ref: body.sessionkey };
  },
};

/**
 * IPN hash check (SSLCommerz "verify_sign"): md5 over the fields named in
 * `verify_key` plus md5(store password), sorted by key and joined as k=v&.
 */
export function verifySslcommerzSignature(fields: Record<string, string>, storePassword = process.env.SSLCOMMERZ_STORE_PASSWORD ?? "") {
  const { verify_sign, verify_key } = fields;
  if (!verify_sign || !verify_key) return false;
  const data: Record<string, string> = {};
  for (const k of verify_key.split(",")) data[k] = fields[k] ?? "";
  data.store_passwd = createHash("md5").update(storePassword).digest("hex");
  const str = Object.keys(data)
    .sort()
    .map((k) => `${k}=${data[k]}`)
    .join("&");
  return createHash("md5").update(str).digest("hex") === verify_sign;
}

/** Server-to-server confirmation that a `val_id` is genuinely paid. */
export async function validateSslcommerz(valId: string) {
  const u = new URL(`${base()}/validator/api/validationserverAPI.php`);
  u.searchParams.set("val_id", valId);
  u.searchParams.set("store_id", process.env.SSLCOMMERZ_STORE_ID ?? "");
  u.searchParams.set("store_passwd", process.env.SSLCOMMERZ_STORE_PASSWORD ?? "");
  u.searchParams.set("format", "json");
  const res = await fetch(u);
  const body = (await res.json().catch(() => ({}))) as { status?: string; tran_id?: string; amount?: string; currency?: string; bank_tran_id?: string; card_type?: string };
  return { valid: body.status === "VALID" || body.status === "VALIDATED", tranId: body.tran_id, amount: Number(body.amount), currency: body.currency, bankTranId: body.bank_tran_id, cardType: body.card_type };
}
