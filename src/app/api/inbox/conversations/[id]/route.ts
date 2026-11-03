import { eq } from "drizzle-orm";
import { z } from "zod";
import { requireBusiness } from "@/server/auth/session";
import { withTenant } from "@/server/db";
import { conversations } from "@/server/db/schema-platform";
import { HttpError, json, route } from "@/server/http";
import { recentMessages, sendMessage, windowOpen } from "@/server/messaging/meta";

export const GET = route(async (_req: Request, ctx: RouteContext<"/api/inbox/conversations/[id]">) => {
  const a = await requireBusiness();
  const { id } = await ctx.params;
  const [conv] = await withTenant(a.businessId, (tx) => tx.select().from(conversations).where(eq(conversations.id, id)));
  if (!conv) throw new HttpError(404, "Conversation not found");
  if (conv.unread) await withTenant(a.businessId, (tx) => tx.update(conversations).set({ unread: 0 }).where(eq(conversations.id, id)));
  const msgs = await recentMessages(a.businessId, id);
  return { conversation: { ...conv, unread: 0, windowOpen: windowOpen(conv.lastInboundAt) }, messages: msgs.reverse() };
});

/** Reply in the conversation. */
export const POST = route(async (req: Request, ctx: RouteContext<"/api/inbox/conversations/[id]">) => {
  const a = await requireBusiness();
  const { id } = await ctx.params;
  const body = await json(req, z.object({ text: z.string().trim().min(1).max(2000), attachments: z.array(z.object({ type: z.string(), title: z.string().optional(), price: z.number().optional(), url: z.string().optional() })).max(5).optional() }));
  return sendMessage(a.businessId, id, body.text, { byName: a.user.name || a.user.phone, attachments: body.attachments });
});

/** Mark done/open, link a customer, or record the phone number. */
export const PATCH = route(async (req: Request, ctx: RouteContext<"/api/inbox/conversations/[id]">) => {
  const a = await requireBusiness();
  const { id } = await ctx.params;
  const patch = await json(req, z.object({ status: z.enum(["open", "done"]).optional(), customerId: z.string().nullable().optional(), phone: z.string().max(20).nullable().optional(), name: z.string().max(80).optional() }));
  await withTenant(a.businessId, (tx) => tx.update(conversations).set(patch).where(eq(conversations.id, id)));
  return { ok: true };
});
