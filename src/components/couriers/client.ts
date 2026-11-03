"use client";
/** Small JSON client for the courier/payment APIs (account mode only). */
export async function api<T>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const res = await fetch(path, {
    ...init,
    body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
    headers: { "content-type": "application/json", ...init?.headers },
    credentials: "same-origin",
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { error?: string }).error ?? `Request failed (${res.status})`);
  return body as T;
}

type Prefs = { defaultProvider: string | null; pickup: Record<string, string>; advanceOnHighRisk: boolean };
let prefsCache: Promise<Prefs> | null = null;
/** Courier preferences, fetched once per page load. */
export function loadPrefs(force = false) {
  if (!prefsCache || force) prefsCache = api<Prefs>("/api/couriers/prefs").catch(() => ({ defaultProvider: null, pickup: {}, advanceOnHighRisk: true }));
  return prefsCache;
}
