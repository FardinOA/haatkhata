import { PROVIDER_IDS } from "@/components/couriers/courier-meta";
import type { CourierProvider } from "@/lib/types";
import { handleWebhook } from "@/server/integrations/couriers/service";
import { HttpError, route } from "@/server/http";

/**
 * Courier status callbacks. Each courier account has its own secret key in
 * the callback URL (shown in Settings); Steadfast also sends it as a Bearer token.
 */

/**
 * Pathao registers a webhook URL only when it answers 202 with this header.
 * The value is the same fixed UUID for every merchant (from Pathao's own
 * WooCommerce plugin), and Pathao expects it on every response.
 */
const PATHAO_HANDSHAKE = "f3992ecc-59da-4cbe-a049-a13da2018d51";

export const POST = route(async (req: Request, ctx: RouteContext<"/api/webhooks/couriers/[provider]">) => {
  const { provider } = await ctx.params;
  if (!PROVIDER_IDS.includes(provider as CourierProvider)) throw new HttpError(404, "Unknown courier");
  const key = new URL(req.url).searchParams.get("key") ?? "";
  if (key.length < 16) throw new HttpError(401, "Missing key");
  const body = await req.json().catch(() => {
    throw new HttpError(400, "Expected JSON");
  });
  const out = await handleWebhook(provider as CourierProvider, key, body, req.headers);
  if (provider !== "pathao") return out;
  return Response.json(out, { status: 202, headers: { "X-Pathao-Merchant-Webhook-Integration-Secret": PATHAO_HANDSHAKE } });
});
