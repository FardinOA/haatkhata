export type GatewayId = "sandbox" | "sslcommerz" | "bkash";

export interface CheckoutRequest {
  paymentId: string;
  amount: number;
  description: string;
  customer: { name: string; phone: string; email?: string };
  /** Absolute URLs on this app. */
  urls: { success: string; fail: string; cancel: string; ipn: string; callback: string; sandbox: string };
}

export interface CheckoutStart {
  redirectUrl: string;
  ref?: string;
}

export interface Gateway {
  id: GatewayId;
  create(req: CheckoutRequest): Promise<CheckoutStart>;
}

export class GatewayError extends Error {}
