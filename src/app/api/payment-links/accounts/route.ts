import { z } from "zod";
import { connectPaymentAccount, disconnectPaymentAccount, listPaymentAccounts } from "@/server/integrations/payments/service";
import { json, route } from "@/server/http";
import { actor } from "../../couriers/_auth";

export const GET = route(async () => listPaymentAccounts((await actor()).businessId));

export const POST = route(async (req: Request) => {
  const a = await actor(["owner"]);
  const { provider, credentials } = await json(req, z.object({ provider: z.enum(["bkash", "nagad"]), credentials: z.record(z.string(), z.string().max(8000)) }));
  await connectPaymentAccount(a.businessId, provider, credentials);
  return listPaymentAccounts(a.businessId);
});

export const DELETE = route(async (req: Request) => {
  const a = await actor(["owner"]);
  const p = new URL(req.url).searchParams.get("provider");
  if (p === "bkash" || p === "nagad") await disconnectPaymentAccount(a.businessId, p);
  return listPaymentAccounts(a.businessId);
});
