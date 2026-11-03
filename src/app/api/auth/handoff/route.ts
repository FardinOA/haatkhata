import { NextResponse } from "next/server";
import { claimImpersonation } from "@/server/admin/service";
import { createSession } from "@/server/auth/session";
import { clientIp, HttpError, route } from "@/server/http";

/**
 * Redeems an admin console ticket: signs this browser in as the shop's owner,
 * marked as impersonated. Opened in a browser tab, so failures land on a page
 * that explains them rather than raw JSON.
 */
export const GET = route(async (req: Request) => {
  const url = new URL(req.url);
  const page = new URL("/handoff", url.origin);
  try {
    const t = await claimImpersonation(url.searchParams.get("t") ?? "");
    await createSession(t.owner, { businessId: t.business, impersonatedBy: t.admin, ip: clientIp(req), userAgent: req.headers.get("user-agent") ?? undefined });
  } catch (e) {
    if (!(e instanceof HttpError)) throw e;
    page.searchParams.set("error", e.message);
  }
  return NextResponse.redirect(page);
});
