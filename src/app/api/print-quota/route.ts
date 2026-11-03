import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuth } from "@/server/auth/session";
import { claimPrints, printAllowance, type PrintWho } from "@/server/billing/print-quota";
import { clientIp, json, route } from "@/server/http";

const DEVICE_COOKIE = "bk_device";

/** Who is printing: device cookie (set on first visit), IP, and the signed-in shop. */
async function who(req: Request): Promise<PrintWho> {
  const jar = await cookies();
  let device = jar.get(DEVICE_COOKIE)?.value;
  if (!device || !/^[\w-]{16,40}$/.test(device)) {
    device = randomBytes(16).toString("base64url");
    jar.set(DEVICE_COOKIE, device, { httpOnly: true, sameSite: "lax", secure: (req.headers.get("x-forwarded-proto") ?? new URL(req.url).protocol.replace(":", "")) === "https", path: "/", maxAge: 5 * 365 * 86_400 });
  }
  const a = await getAuth();
  return { ip: clientIp(req), device, businessId: a?.businessId ?? null };
}

/** How many invoices can still be printed without a paid plan. */
export const GET = route(async (req: Request) => printAllowance(await who(req)));

/** Call before printing, saving or sharing an invoice; 402 means pay first. */
export const POST = route(async (req: Request) => {
  const { orders } = await json(req, z.object({ orders: z.array(z.string().min(1).max(80)).min(1).max(500) }));
  const r = await claimPrints(await who(req), orders);
  return r.ok ? r : NextResponse.json({ ...r, error: `You've printed ${r.limit} invoices without a plan. Pick a plan to keep printing.`, code: "print_limit" }, { status: 402 });
});
