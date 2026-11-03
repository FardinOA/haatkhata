import "server-only";

export type PayProvider = "bkash" | "nagad" | "sandbox";
export type PayCreds = Record<string, string>;

export interface StartResult {
  redirectUrl: string;
  providerRef?: string;
}

export interface VerifiedPayment {
  ok: boolean;
  amount: number;
  trxId?: string;
  providerRef?: string;
  message?: string;
}

export interface PayAdapter {
  provider: PayProvider;
  fields: { key: string; en: string; bn: string; secret?: boolean; multiline?: boolean }[];
  test(creds: PayCreds): Promise<void>;
  /** Starts a checkout and returns where to send the buyer. */
  start(creds: PayCreds, p: { token: string; amount: number; reference: string; callbackUrl: string; payerReference: string }): Promise<StartResult>;
  /** Confirms the payment with the provider from callback parameters. Never trusts the browser. */
  verify(creds: PayCreds, params: URLSearchParams, link: { providerRef: string | null; amount: number }): Promise<VerifiedPayment>;
}

export async function jsonCall<T>(url: string, init: RequestInit): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 20_000);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal, headers: { accept: "application/json", "content-type": "application/json", ...init.headers } });
    const body = (await res.json().catch(() => ({}))) as T & { statusMessage?: string; message?: string };
    if (!res.ok) throw new Error(body.statusMessage ?? body.message ?? `HTTP ${res.status}`);
    return body;
  } finally {
    clearTimeout(t);
  }
}
