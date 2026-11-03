import { z } from "zod";
import { parseOrder } from "@/server/ai/parse-order";
import { requireBusiness } from "@/server/auth/session";
import { withTenant } from "@/server/db";
import { json, route } from "@/server/http";

/** AI order parsing from a pasted chat (FR-POS-10). Falls back to rules without a key or credits. */
export const POST = route(async (req: Request) => {
  const a = await requireBusiness();
  const { text } = await json(req, z.object({ text: z.string().trim().min(3).max(8000) }));
  return withTenant(a.businessId, (tx) => parseOrder(tx, a.businessId, text));
});
