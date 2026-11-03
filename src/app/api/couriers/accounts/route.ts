import { z } from "zod";
import { PROVIDER_IDS } from "@/components/couriers/courier-meta";
import type { CourierProvider } from "@/lib/types";
import { connectAccount, disconnectAccount, listAccounts } from "@/server/integrations/couriers/service";
import { json, route } from "@/server/http";
import { actor } from "../_auth";

export const GET = route(async () => {
  const a = await actor();
  return listAccounts(a.businessId);
});

const body = z.object({ provider: z.enum(PROVIDER_IDS as [CourierProvider, ...CourierProvider[]]), credentials: z.record(z.string(), z.string().max(4000)).default({}), settings: z.record(z.string(), z.unknown()).default({}) });

/** Connect (or update) a courier account — owner/manager only. Credentials are tested first. */
export const POST = route(async (req: Request) => {
  const a = await actor(["owner", "manager"]);
  const { provider, credentials, settings } = await json(req, body);
  await connectAccount(a.businessId, provider, credentials, settings);
  return listAccounts(a.businessId);
});

export const DELETE = route(async (req: Request) => {
  const a = await actor(["owner", "manager"]);
  const provider = new URL(req.url).searchParams.get("provider") as CourierProvider;
  if (!PROVIDER_IDS.includes(provider)) return { ok: false };
  await disconnectAccount(a.businessId, provider);
  return listAccounts(a.businessId);
});
