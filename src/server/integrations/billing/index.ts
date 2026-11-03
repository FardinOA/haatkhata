import "server-only";
import { bkashConfigured, bkashGateway } from "./bkash";
import { sandboxAllowed, sandboxGateway } from "./sandbox";
import { sslcommerzConfigured, sslcommerzGateway } from "./sslcommerz";
import { GatewayError, type Gateway } from "./types";

export type CheckoutMethod = "bkash" | "nagad" | "card" | "rocket" | "bank";

/** bKash goes straight to bKash; everything else through SSLCommerz. Sandbox when nothing is configured. */
export function gatewayFor(method: CheckoutMethod): Gateway {
  if (method === "bkash" && bkashConfigured()) return bkashGateway;
  if (method !== "bkash" && sslcommerzConfigured()) return sslcommerzGateway;
  if (method === "bkash" && sslcommerzConfigured()) return sslcommerzGateway;
  if (sandboxAllowed()) return sandboxGateway;
  throw new GatewayError("Online payments aren't set up yet. Contact support to pay by bKash.");
}

export function availableMethods(): { method: CheckoutMethod; gateway: Gateway["id"] }[] {
  const all: CheckoutMethod[] = ["bkash", "nagad", "card"];
  return all.flatMap((m) => {
    try {
      return [{ method: m, gateway: gatewayFor(m).id }];
    } catch {
      return [];
    }
  });
}

export { GatewayError };
