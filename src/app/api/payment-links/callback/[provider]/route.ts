import { NextResponse } from "next/server";
import { completePayment } from "@/server/integrations/payments/service";

/** bKash / Nagad redirect the buyer here; we verify server-to-server, then show the result. */
export async function GET(req: Request, ctx: RouteContext<"/api/payment-links/callback/[provider]">) {
  await ctx.params;
  const url = new URL(req.url);
  const token = url.searchParams.get("token") ?? "";
  let ok = false;
  try {
    ok = (await completePayment(token, url.searchParams)).ok;
  } catch (e) {
    console.error("payment callback", e);
  }
  return NextResponse.redirect(new URL(`/pay/${encodeURIComponent(token)}?result=${ok ? "paid" : "failed"}`, url.origin));
}
