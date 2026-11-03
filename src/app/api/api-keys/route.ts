import { z } from "zod";
import { createApiKey, listApiKeys } from "@/server/api-keys";
import { requireBusiness } from "@/server/auth/session";
import { requireRole } from "@/server/business";
import { json, route } from "@/server/http";

export const GET = route(async () => {
  const a = await requireBusiness();
  await requireRole(a.role, ["owner"]);
  return { keys: await listApiKeys(a.businessId) };
});

/** Creates a key. The secret is returned once and never stored in plain text. */
export const POST = route(async (req: Request) => {
  const a = await requireBusiness();
  await requireRole(a.role, ["owner"]);
  const input = await json(req, z.object({ name: z.string().trim().min(1).max(60), scopes: z.array(z.enum(["read", "write"])).min(1) }));
  return createApiKey(a.businessId, { ...input, createdBy: a.user.id });
});
