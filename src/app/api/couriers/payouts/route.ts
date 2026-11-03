import { randomBytes } from "node:crypto";
import { z } from "zod";
import { withTenant } from "@/server/db";
import { payoutImports } from "@/server/db/schema-couriers";
import { json, route } from "@/server/http";
import { actor } from "../_auth";

/** Keeps a record of each imported payout statement (the matching itself happens on the device). */
export const POST = route(async (req: Request) => {
  const a = await actor(["owner", "manager", "accountant"]);
  const { provider, fileName, summary } = await json(req, z.object({ provider: z.string().max(40), fileName: z.string().max(200), summary: z.record(z.string(), z.unknown()) }));
  await withTenant(a.businessId, (tx) => tx.insert(payoutImports).values({ businessId: a.businessId, id: `pi_${randomBytes(9).toString("base64url")}`, provider, fileName, summary, createdBy: a.userName }));
  return { ok: true };
});
