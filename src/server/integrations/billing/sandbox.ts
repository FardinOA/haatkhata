import "server-only";
import type { Gateway } from "./types";

/**
 * Development gateway: sends the buyer to a local checkout page where they can
 * approve or decline. Never enabled in production unless BILLING_ALLOW_SANDBOX=1.
 */
export const sandboxGateway: Gateway = {
  id: "sandbox",
  async create(req) {
    return { redirectUrl: `${req.urls.sandbox}?payment=${encodeURIComponent(req.paymentId)}`, ref: `SBX-${req.paymentId}` };
  },
};

export const sandboxAllowed = () => process.env.NODE_ENV !== "production" || process.env.BILLING_ALLOW_SANDBOX === "1";
