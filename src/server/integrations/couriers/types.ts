import "server-only";
import type { CourierStatus } from "@/components/couriers/courier-meta";
import type { CourierProvider } from "@/lib/types";

export type { CourierStatus };

export type Credentials = Record<string, string>;

export interface ConsignmentRequest {
  orderId: string;
  invoice: string; // merchant reference shown to the courier
  recipientName: string;
  recipientPhone: string;
  recipientAddress: string;
  area: string;
  district: string;
  codAmount: number;
  itemCount: number;
  itemDescription: string;
  note?: string;
  weightKg?: number;
}

export interface BookResult {
  consignmentId: string;
  trackingCode: string;
  fee?: number;
  raw?: unknown;
}

export interface StatusResult {
  status: CourierStatus;
  raw: string;
}

export interface WebhookEvent {
  consignmentId: string;
  status: CourierStatus;
  raw: string;
}

export interface CourierAdapter {
  provider: CourierProvider;
  /** Cheap authenticated call used by "Test connection". */
  test(creds: Credentials): Promise<void>;
  create(creds: Credentials, req: ConsignmentRequest): Promise<BookResult>;
  /** Defaults to sequential create() when a courier has no bulk endpoint. */
  bulkCreate?(creds: Credentials, reqs: ConsignmentRequest[]): Promise<(BookResult | Error)[]>;
  status(creds: Credentials, consignmentId: string): Promise<StatusResult>;
  cancel?(creds: Credentials, consignmentId: string): Promise<void>;
  /** Validates and parses a status webhook. Returns null for events we ignore. */
  parseWebhook(body: unknown, headers: Headers, creds: Credentials): WebhookEvent | null;
}

export class CourierError extends Error {
  constructor(
    message: string,
    public provider: CourierProvider,
    public status?: number,
  ) {
    super(message);
  }
}

/** fetch with a timeout and JSON parsing; non-2xx becomes a CourierError. */
export async function call<T>(provider: CourierProvider, url: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), init.timeoutMs ?? 15_000);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal, headers: { accept: "application/json", "content-type": "application/json", ...init.headers } });
    const text = await res.text();
    let body: unknown = text;
    try {
      body = JSON.parse(text);
    } catch {
      /* some couriers answer errors in plain text */
    }
    if (!res.ok) {
      const msg = (body as { message?: string; error?: string })?.message ?? (body as { error?: string })?.error ?? text.slice(0, 200);
      throw new CourierError(`${provider}: ${msg || `HTTP ${res.status}`}`, provider, res.status);
    }
    return body as T;
  } catch (e) {
    if (e instanceof CourierError) throw e;
    throw new CourierError(`${provider}: ${(e as Error).name === "AbortError" ? "the courier didn't answer in time" : (e as Error).message}`, provider);
  } finally {
    clearTimeout(timer);
  }
}

export function requireCreds(provider: CourierProvider, creds: Credentials, keys: string[]) {
  for (const k of keys) if (!creds[k]) throw new CourierError(`${provider}: missing ${k}`, provider, 400);
}
