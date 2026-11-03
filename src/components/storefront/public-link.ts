"use client";
/**
 * Customer-facing links for orders (FR-INV-04). Only available in account
 * mode — the link lives on the server so customers can open it anywhere.
 */
import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";

async function call(url: string, method: string, body?: unknown) {
  const res = await fetch(url, { method, headers: body ? { "content-type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Couldn't reach the server");
  return data;
}

export const createCustomerLink = (orderId: string): Promise<string> => call(`/api/orders/${orderId}/public-link`, "POST").then((d) => d.url);
export const revokeCustomerLink = (orderId: string) => call(`/api/orders/${orderId}/public-link`, "DELETE");

/** Live links for the given orders; creates missing ones so printed QR codes always work. */
export function useCustomerLinks(orderIds: string[]) {
  const mode = useStore((s) => s.sync.mode);
  const key = orderIds.join(",");
  const [links, setLinks] = useState<Record<string, string>>({});
  useEffect(() => {
    if (mode !== "account" || !key) return;
    let alive = true;
    call("/api/orders/public-links", "POST", { ids: key.split(","), ensure: true })
      .then((d) => alive && setLinks(d.links ?? {}))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [mode, key]);
  return links;
}
