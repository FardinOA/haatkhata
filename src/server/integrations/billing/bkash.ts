import "server-only";
/**
 * bKash Tokenized Checkout (v1.2.0-beta): grant token → create → (customer
 * pays in bKash) → callback → execute → query.
 * Env: BKASH_APP_KEY, BKASH_APP_SECRET, BKASH_USERNAME, BKASH_PASSWORD, BKASH_LIVE=true|false
 */
import { GatewayError, type Gateway } from "./types";

const base = () => (process.env.BKASH_LIVE === "true" ? "https://tokenized.pay.bka.sh/v1.2.0-beta" : "https://tokenized.sandbox.bka.sh/v1.2.0-beta");
export const bkashConfigured = () => !!(process.env.BKASH_APP_KEY && process.env.BKASH_APP_SECRET && process.env.BKASH_USERNAME && process.env.BKASH_PASSWORD);

let cached: { token: string; until: number } | null = null;

/** bKash's integration guide: give every API call 30 seconds, then treat it as timed out. */
const TIMEOUT_MS = 30_000;

class BkashTimeout extends GatewayError {}

async function post(url: string, init: RequestInit) {
  try {
    return await fetch(url, { ...init, method: "POST", signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (e) {
    if (e instanceof DOMException && e.name === "TimeoutError") throw new BkashTimeout("bKash didn't answer in time. Please try again.");
    throw e;
  }
}

async function grantToken() {
  if (cached && cached.until > Date.now()) return cached.token;
  const res = await post(`${base()}/tokenized/checkout/token/grant`, {
    headers: { "content-type": "application/json", accept: "application/json", username: process.env.BKASH_USERNAME!, password: process.env.BKASH_PASSWORD! },
    body: JSON.stringify({ app_key: process.env.BKASH_APP_KEY, app_secret: process.env.BKASH_APP_SECRET }),
  });
  const body = (await res.json().catch(() => ({}))) as { id_token?: string; expires_in?: number; statusMessage?: string };
  if (!body.id_token) throw new GatewayError(body.statusMessage ?? "bKash sign-in failed");
  cached = { token: body.id_token, until: Date.now() + Math.max(60, (body.expires_in ?? 3600) - 120) * 1000 };
  return cached.token;
}

async function call<T>(path: string, payload: unknown): Promise<T> {
  const token = await grantToken();
  const res = await post(`${base()}${path}`, {
    headers: { "content-type": "application/json", accept: "application/json", authorization: token, "x-app-key": process.env.BKASH_APP_KEY! },
    body: JSON.stringify(payload),
  });
  return (await res.json().catch(() => ({}))) as T;
}

export const bkashGateway: Gateway = {
  id: "bkash",
  async create(req) {
    const body = await call<{ paymentID?: string; bkashURL?: string; statusMessage?: string; errorMessage?: string }>("/tokenized/checkout/create", {
      mode: "0011",
      payerReference: req.customer.phone,
      callbackURL: req.urls.callback,
      amount: req.amount.toFixed(2),
      currency: "BDT",
      intent: "sale",
      merchantInvoiceNumber: req.paymentId,
    });
    if (!body.paymentID || !body.bkashURL) throw new GatewayError(body.errorMessage ?? body.statusMessage ?? "bKash didn't start the payment");
    return { redirectUrl: body.bkashURL, ref: body.paymentID };
  },
};

export type BkashResult = { completed: boolean; trxId?: string; amount?: number; invoice?: string; message?: string };

export async function executeBkash(paymentID: string): Promise<BkashResult> {
  type Executed = { transactionStatus?: string; trxID?: string; amount?: string; merchantInvoiceNumber?: string; statusMessage?: string; errorMessage?: string };
  let body: Executed = {};
  try {
    body = await call<Executed>("/tokenized/checkout/execute", { paymentID });
  } catch (e) {
    if (!(e instanceof BkashTimeout)) throw e;
  }
  if (body.transactionStatus === "Completed") return { completed: true, trxId: body.trxID, amount: Number(body.amount), invoice: body.merchantInvoiceNumber };
  // Execute can fail or time out after the customer paid — always confirm with a query.
  return queryBkash(paymentID);
}

export async function queryBkash(paymentID: string): Promise<BkashResult> {
  const body = await call<{ transactionStatus?: string; trxID?: string; amount?: string; merchantInvoiceNumber?: string; statusMessage?: string }>("/tokenized/checkout/payment/status", { paymentID });
  return { completed: body.transactionStatus === "Completed", trxId: body.trxID, amount: Number(body.amount), invoice: body.merchantInvoiceNumber, message: body.statusMessage };
}
