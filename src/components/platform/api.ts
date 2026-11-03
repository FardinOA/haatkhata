"use client";
/** Small JSON fetch helper for the platform screens: throws with the server's message. */
export async function api<T>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  const res = await fetch(path, {
    ...rest,
    headers: { ...(json !== undefined ? { "content-type": "application/json" } : {}), ...rest.headers },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(body.error?.message ?? body.error ?? `Request failed (${res.status})`), { status: res.status, code: body.code });
  return body as T;
}

export type AiParsed = {
  name?: string;
  phone?: string;
  address?: string;
  area?: string;
  district?: string;
  items: { productId?: string; variantId?: string; text: string; qty: number }[];
  confidence: number;
  source: "ai" | "rules";
  notes?: string;
  usage: { used: number; limit: number };
};
