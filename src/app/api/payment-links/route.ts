import { z } from "zod";
import { cancelLink, createLink, linksForOrder } from "@/server/integrations/payments/service";
import { json, route } from "@/server/http";
import { actor } from "../couriers/_auth";

export const GET = route(async (req: Request) => {
  const a = await actor();
  const orderId = new URL(req.url).searchParams.get("orderId") ?? "";
  const links = await linksForOrder(a.businessId, orderId);
  // Internal ids and the provider's reference stay on the server.
  return { links: links.map((l) => ({ id: l.id, token: l.token, provider: l.provider, amount: l.amount, purpose: l.purpose, status: l.status, createdAt: l.createdAt, paidAt: l.paidAt, trxId: l.trxId, expiresAt: l.expiresAt })) };
});

export const POST = route(async (req: Request) => {
  const a = await actor();
  const input = await json(req, z.object({ orderId: z.string(), amount: z.number().positive().max(1e7), purpose: z.enum(["advance", "due"]), provider: z.enum(["bkash", "nagad", "sandbox"]) }));
  return createLink(a, input);
});

export const DELETE = route(async (req: Request) => {
  const a = await actor();
  await cancelLink(a.businessId, new URL(req.url).searchParams.get("id") ?? "");
  return { ok: true };
});
